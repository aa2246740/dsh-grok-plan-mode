export const zh = {
  'chip.label': 'Plan',
  'chip.approval': 'Plan approval',
  'chip.on.aria': '计划模式已开启。点击退出。',
  'chip.on.title': '计划模式已开启 — 点击退出（/plan off）',
  'chip.approval.aria': '计划审批已打开。点击退出计划模式。',
  'chip.exitFailed': '退出计划模式失败',
  'review.header': '计划审批',
  'review.empty': '还没有写计划 — 批准、去聊天里说或放弃',
  'review.waiting': '等待计划审批',
  'review.approve': '批准',
  'review.quit': '放弃',
  'review.discuss': '去聊天里说',
  'copy': '复制',
  'copied': '已复制',
  'markdown.footnotes': '脚注',
} satisfies Record<string, string>

export type GrokPlanKey = keyof typeof zh

export const en = {
  'chip.label': 'Plan',
  'chip.approval': 'Plan approval',
  'chip.on.aria': 'Plan mode on. Click to leave.',
  'chip.on.title': 'Plan mode on — click to leave (/plan off)',
  'chip.approval.aria': 'Plan approval is open. Click to leave plan mode.',
  'chip.exitFailed': 'Failed to exit plan mode',
  'review.header': 'Plan approval',
  'review.empty': 'No plan written — approve, chat about it, or quit',
  'review.waiting': 'Waiting on plan approval',
  'review.approve': 'Approve',
  'review.quit': 'Quit',
  'review.discuss': 'Chat about it',
  'copy': 'Copy',
  'copied': 'Copied',
  'markdown.footnotes': 'Footnotes',
} satisfies Record<GrokPlanKey, string>
