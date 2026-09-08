#!/usr/bin/env node
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { resolve, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { test } from 'node:test'
import { installPlanReplacement } from '../src/host/replacement.ts'

const i = process.argv.indexOf('--harness')
if (i < 0 || !process.argv[i + 1]) throw new Error('Pass --harness <checkout>')
const req = createRequire(join(resolve(process.argv[i + 1]), 'apps/cli/package.json'))
const { Context } = await import(pathToFileURL(req.resolve('@deepseek-ai/cordis')))
const { default: Loader, EntryTree } = await import(pathToFileURL(req.resolve('@deepseek-ai/cordis-plugin-loader')))
const tick = () => new Promise(r => setImmediate(r))

async function fixture() {
  const ctx = new Context()
  await ctx.plugin(Loader)
  const stats = { starts: 0, stops: 0, writes: 0 }
  function Official(ctx) {
    stats.starts++
    ctx.effect(() => () => { stats.stops++ })
  }
  class Preset extends EntryTree {
    import() { return Official }
    write() { stats.writes++ }
  }
  const tree = new Preset(ctx)
  const add = (id, name = '@deepseek-ai/dsh-plan-mode') => tree.create({ id, name })
  const replace = () => ctx.plugin({ name: 'replacement', apply: installPlanReplacement })
  return {ctx, tree, stats, add, replace}
}

test('existing official generations stop, unrelated plugins stay, unload restores', async () => {
  const f = await fixture()
  try {
    await f.add('standard'); await f.add('ptc'); await f.add('other', 'other-plugin')
    const writes = f.stats.writes
    const plugin = await f.replace()
    assert.equal(f.stats.stops, 2)
    assert.equal(f.tree.resolve('standard').options.disabled, true)
    assert.equal(f.tree.resolve('ptc').options.disabled, true)
    assert.ok(f.tree.resolve('other').fiber.uid)
    assert.equal(f.stats.writes, writes, 'no persistent composition writes')
    await plugin.dispose()
    assert.equal(f.tree.resolve('standard').options.disabled, undefined)
    assert.ok(f.tree.resolve('standard').fiber.uid)
    assert.ok(f.tree.resolve('ptc').fiber.uid)
  } finally { await f.ctx.fiber.dispose() }
})

test('all later presets are suppressed before their constructor runs', async () => {
  const f = await fixture()
  try {
    const plugin = await f.replace()
    for (const id of ['standard','ptc','cordis','creator-plus','future-custom']) {
      await f.add(id)
      assert.equal(f.tree.resolve(id).disabled, true)
      assert.equal(f.tree.resolve(id).fiber?.uid, null)
    }
    assert.equal(f.stats.starts, 0)
    await plugin.dispose()
    assert.equal(f.stats.starts, 5)
  } finally { await f.ctx.fiber.dispose() }
})

test('replacement reload reclaims rows and explicit disabled rows stay disabled', async () => {
  const f = await fixture()
  try {
    await f.tree.create({id:'disabled', name:'@deepseek-ai/dsh-plan-mode', disabled:true})
    await f.add('standard')
    const first = await f.replace(); await first.dispose()
    const second = await f.replace()
    assert.equal(f.tree.resolve('standard').disabled, true)
    await second.dispose()
    assert.equal(f.tree.resolve('disabled').disabled, true)
    assert.ok(f.tree.resolve('standard').fiber.uid)
  } finally { await f.ctx.fiber.dispose() }
})

test('separate Hosts are unaffected and shutdown has no resurrection', async () => {
  const a = await fixture(), b = await fixture()
  await a.replace(); await a.add('standard'); await b.add('standard')
  assert.equal(a.stats.starts,0); assert.equal(b.stats.starts,1)
  await a.ctx.fiber.dispose(); await tick()
  assert.equal(a.stats.starts,0)
  await b.ctx.fiber.dispose()
})

test('real official Plan service loses command and tool ownership to Grok', async () => {
  const dirs = {'@deepseek-ai/dsh-system-prompt':'core/system-prompt','@deepseek-ai/dsh-tools':'core/tools','@deepseek-ai/dsh-commands':'interaction/commands','@deepseek-ai/dsh-session-projection':'session/session-projection','@deepseek-ai/dsh-plan-mode':'plan/plan-mode'}
  const load = async name => (await import(pathToFileURL(join(resolve(process.argv[i+1]), 'packages',dirs[name],'lib/index.js')))).default
  const ctx = new Context()
  try {
    await ctx.plugin(Loader)
    await ctx.plugin(await load('@deepseek-ai/dsh-system-prompt'), {persona:''})
    await ctx.plugin(await load('@deepseek-ai/dsh-tools'))
    await ctx.plugin(await load('@deepseek-ai/dsh-commands'))
    await ctx.plugin(await load('@deepseek-ai/dsh-session-projection'))
    const Official = await load('@deepseek-ai/dsh-plan-mode')
    class Preset extends EntryTree {
      import() { return Official }
      write() { throw new Error('must not rewrite a shipped preset') }
    }
    const tree = new Preset(ctx)
    // Root group create does not call tree.write(), just like preset loading.
    await tree.root.create({id:'standard',name:'@deepseek-ai/dsh-plan-mode',config:{section:'OFFICIAL POLICY'}})
    assert.ok(ctx.tools.schemas().find(x=>x.name==='exit_plan_mode').parameters.properties.plan)
    const {apply,name,inject}=await import('../src/index.ts')
    const replacement=await ctx.plugin({apply,name,inject})
    const schema=ctx.tools.schemas().find(x=>x.name==='exit_plan_mode')
    assert.deepEqual(schema.parameters.properties,{})
    assert.equal(ctx.get('planMode'),undefined)
    for(const id of ['ptc','cordis','creator-plus','future-custom']) {
      await tree.root.create({id,name:'@deepseek-ai/dsh-plan-mode',config:{section:'OFFICIAL POLICY'}})
      assert.equal(tree.resolve(id).disabled,true)
    }
    assert.equal(ctx.tools.schemas().filter(x=>x.name==='exit_plan_mode').length,1)
    // Remove the later test rows before rollback: real deployment presets have
    // separate service realms; these deliberately share one fixture realm.
    for(const id of ['ptc','cordis','creator-plus','future-custom']) await tree.root.remove(id)
    await replacement.dispose()
    assert.ok(ctx.tools.schemas().find(x=>x.name==='exit_plan_mode').parameters.properties.plan)
  } finally { await ctx.fiber.dispose() }
})
