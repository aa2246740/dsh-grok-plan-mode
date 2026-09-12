import { createUserMessage } from "@deepseek-ai/dsh-llm";
import { defineTool } from "@deepseek-ai/dsh-tools";
import { UserQuestionError } from "@deepseek-ai/dsh-user-questions";
import { statSync } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { z } from "zod";
//#region src/host/replacement.ts
const OFFICIAL_PLAN = "@deepseek-ai/dsh-plan-mode";
/** Suppress the official implementation across existing and future presets.
* The Loader row stays visible as disabled; no preset file is rewritten.
* Cordis publishes internal/plugin before executing a new fiber, explicitly
* allowing synchronous disposal there. Keep that observer active until rollback
* starts, then restore only rows still carrying our exact options object.
*/
function installPlanReplacement(ctx) {
	const owned = /* @__PURE__ */ new Map();
	const pending = /* @__PURE__ */ new Set();
	let restoring = false;
	const track = (work) => {
		pending.add(work);
		work.finally(() => pending.delete(work)).catch((error) => {
			ctx.logger.error("grok-plan replacement lifecycle failed: %o", error);
		});
		return work;
	};
	const suppress = (fiber) => {
		if (restoring || fiber.uid === null) return;
		const entry = fiber.entry;
		if (entry?.options.name !== OFFICIAL_PLAN || entry.options.disabled === true) return;
		if (entry.fiber !== void 0 && entry.fiber.uid !== null && entry.fiber.uid !== fiber.uid) return;
		const previous = entry.options.disabled;
		const update = entry.update({ disabled: true });
		const saved = {
			previous,
			options: entry.options
		};
		owned.set(entry, saved);
		const dispose = fiber.uid === null ? Promise.resolve() : fiber.dispose();
		track(Promise.all([update, dispose]).then(() => {
			saved.options = entry.options;
		}));
	};
	const stop = ctx.on("internal/plugin", suppress, { global: true });
	ctx.effect(() => async () => {
		restoring = true;
		stop();
		await Promise.allSettled([...pending]);
		for (const [entry, saved] of owned) {
			if (entry.context.fiber.uid === null || entry.options !== saved.options || entry.options.disabled !== true) continue;
			await entry.update({ disabled: saved.previous ?? null });
		}
		owned.clear();
	}, "grok-plan: restore replaced official rows");
	for (const runtime of [...ctx.registry.values()]) for (const fiber of [...runtime.fibers]) suppress(fiber);
	return Promise.all([...pending]).then(() => void 0);
}
//#endregion
//#region src/tracker.ts
/**
* Pure port of Grok Build `PlanModeTracker`.
*
* Inactive → Pending → Active → ExitPending
* Transient Pending / ExitPending collapse on resume.
*/
var PlanModeTracker = class PlanModeTracker {
	state;
	wasPreviouslyActive;
	reminderCount;
	pendingExitReminder;
	awaitingPlanApproval;
	pendingActivation;
	planFilePathValue;
	constructor(sessionDir, planFilePath) {
		this.state = "Inactive";
		this.wasPreviouslyActive = false;
		this.reminderCount = 0;
		this.pendingExitReminder = false;
		this.awaitingPlanApproval = false;
		this.pendingActivation = void 0;
		this.planFilePathValue = planFilePath ?? joinPlanFile(sessionDir);
	}
	static fromSnapshot(sessionDir, snapshot, planFilePath) {
		const next = { ...snapshot };
		if (next.state === "Pending") next.state = "Inactive";
		else if (next.state === "ExitPending") {
			next.state = "Inactive";
			next.pending_exit_reminder = true;
		}
		const tracker = new PlanModeTracker(sessionDir, planFilePath);
		tracker.state = next.state;
		tracker.wasPreviouslyActive = next.was_previously_active;
		tracker.reminderCount = next.reminder_count;
		tracker.pendingExitReminder = next.pending_exit_reminder;
		tracker.awaitingPlanApproval = next.awaiting_plan_approval;
		return tracker;
	}
	snapshot() {
		return {
			state: this.state,
			was_previously_active: this.wasPreviouslyActive,
			reminder_count: this.reminderCount,
			pending_exit_reminder: this.pendingExitReminder,
			awaiting_plan_approval: this.awaitingPlanApproval
		};
	}
	getState() {
		return this.state;
	}
	isActive() {
		return this.state === "Active";
	}
	planFilePath() {
		return this.planFilePathValue;
	}
	setAwaitingPlanApproval(awaiting) {
		this.awaitingPlanApproval = awaiting;
	}
	isAwaitingPlanApproval() {
		return this.awaitingPlanApproval;
	}
	shouldAutoApproveEdit(editPath) {
		return this.isActive() && isPlanFileWrite(editPath, this.planFilePathValue);
	}
	shouldUseFullReminder() {
		return this.reminderCount % 2 === 0;
	}
	hasPendingExitReminder() {
		return this.pendingExitReminder;
	}
	isReentry() {
		return this.wasPreviouslyActive && this.state === "Pending";
	}
	hasPendingActivation() {
		return this.pendingActivation !== void 0;
	}
	enterPending() {
		if (this.state === "Inactive") {
			this.state = "Pending";
			this.pendingExitReminder = false;
			return true;
		}
		if (this.state === "ExitPending") {
			this.state = "Active";
			this.pendingExitReminder = false;
			return true;
		}
		return false;
	}
	activate() {
		if (this.state !== "Pending") return false;
		this.state = "Active";
		this.wasPreviouslyActive = true;
		this.reminderCount = 0;
		return true;
	}
	activateMidTurn(renderedReminder) {
		if (this.state !== "Pending") return false;
		const priorWasPreviouslyActive = this.wasPreviouslyActive;
		this.state = "Active";
		this.wasPreviouslyActive = true;
		this.reminderCount = 0;
		this.pendingActivation = {
			text: renderedReminder,
			priorWasPreviouslyActive
		};
		return true;
	}
	takePendingActivation() {
		const pending = this.pendingActivation;
		this.pendingActivation = void 0;
		return pending?.text;
	}
	activateFromTool() {
		if (this.state !== "Inactive") return false;
		this.state = "Active";
		this.wasPreviouslyActive = true;
		this.reminderCount = 0;
		this.pendingExitReminder = false;
		return true;
	}
	deactivateApproved() {
		if (this.state !== "Active") return false;
		this.state = "Inactive";
		this.reminderCount = 0;
		this.awaitingPlanApproval = false;
		this.pendingActivation = void 0;
		return true;
	}
	userExit(turnInFlight) {
		this.awaitingPlanApproval = false;
		if (this.pendingActivation !== void 0 && this.state === "Active") {
			this.state = "Inactive";
			this.wasPreviouslyActive = this.pendingActivation.priorWasPreviouslyActive;
			this.pendingActivation = void 0;
			return;
		}
		if (this.state === "Pending") {
			this.state = "Inactive";
			return;
		}
		if (this.state === "Active") {
			if (turnInFlight) this.state = "ExitPending";
			else {
				this.state = "Inactive";
				this.pendingExitReminder = true;
			}
		}
	}
	completeDeferredExit() {
		if (this.state !== "ExitPending") return;
		this.state = "Inactive";
		this.pendingExitReminder = true;
	}
	queueExitReminder() {
		this.pendingExitReminder = true;
	}
	recordReminderInjected() {
		this.reminderCount += 1;
	}
	clearPendingExitReminder() {
		this.pendingExitReminder = false;
	}
	resetAfterCompaction() {
		if (this.state === "Active") {
			this.reminderCount = 0;
			this.pendingActivation = void 0;
		}
	}
};
function joinPlanFile(sessionDir) {
	if (sessionDir.endsWith("/") || sessionDir.endsWith("\\")) return `${sessionDir}plan.md`;
	return `${sessionDir}/plan.md`;
}
function isPlanFileWrite(targetPath, planFile) {
	return normalizePath(targetPath) === normalizePath(planFile);
}
/** Grok compares absolute paths for equality. Normalize separators only. */
function normalizePath(value) {
	return value.replace(/\\/g, "/");
}
//#endregion
//#region src/gate.ts
const DSH_EDIT_TOOLS = /* @__PURE__ */ new Set([
	"write",
	"edit",
	"str_replace_editor",
	"apply_patch"
]);
/**
* Grok's `plan_mode_edit_gate`.
*
* Active plan mode rejects every edit that is not the session plan file,
* including under auto / always-approve. Bash, reads, MCP, and the plan
* tools themselves are not gated here.
*/
function planModeEditGate(tracker, access) {
	if (!tracker.isActive()) return "allow";
	if (access.kind === "apply_patch") return "reject_non_plan_file";
	if (access.kind === "edit" && !tracker.shouldAutoApproveEdit(access.path)) return "reject_non_plan_file";
	return "allow";
}
function classifyToolAccess(input) {
	if (input.name === "apply_patch") return { kind: "apply_patch" };
	if (!DSH_EDIT_TOOLS.has(input.name)) return { kind: "other" };
	if (input.name === "str_replace_editor" && isViewCommand(input.arguments)) return { kind: "other" };
	const path = extractEditPath(input.arguments);
	if (path === void 0) return { kind: "apply_patch" };
	return {
		kind: "edit",
		path
	};
}
function isViewCommand(args) {
	return isRecord(args) && args.command === "view";
}
function extractEditPath(args) {
	if (!isRecord(args)) return void 0;
	for (const key of [
		"path",
		"file_path",
		"filePath"
	]) {
		const value = args[key];
		if (typeof value === "string" && value.trim() !== "") return value;
	}
}
function resolveEditPath(target, cwd) {
	if (isAbsolutePath(target) || cwd === void 0 || cwd.trim() === "") return target;
	return `${cwd.endsWith("/") ? cwd.slice(0, -1) : cwd}/${target.startsWith("./") ? target.slice(2) : target}`;
}
function isPlanningAgent(meta) {
	if (meta.origin === "subagent") return false;
	if ((meta.delegationDepth ?? 0) > 0) return false;
	return true;
}
function isAbsolutePath(value) {
	return value.startsWith("/") || /^[A-Za-z]:[\\/]/.test(value);
}
function isRecord(value) {
	return typeof value === "object" && value !== null;
}
//#endregion
//#region src/fold.ts
const GROK_PLAN_EVENT = "plan/mode";
function isPlanModeState(value) {
	return value === "Inactive" || value === "Pending" || value === "Active" || value === "ExitPending";
}
function isGrokPlanEventData(value) {
	if (typeof value !== "object" || value === null) return false;
	if (!("state" in value) || !isPlanModeState(value.state)) return false;
	if (!("was_previously_active" in value) || typeof value.was_previously_active !== "boolean") return false;
	if (!("reminder_count" in value) || typeof value.reminder_count !== "number") return false;
	if (!("pending_exit_reminder" in value) || typeof value.pending_exit_reminder !== "boolean") return false;
	if (!("awaiting_plan_approval" in value) || typeof value.awaiting_plan_approval !== "boolean") return false;
	if (!("plan_file_path" in value) || typeof value.plan_file_path !== "string") return false;
	if ("plan_has_content" in value && typeof value.plan_has_content !== "boolean") return false;
	return true;
}
function viewFromSnapshot(snapshot) {
	const state = snapshot?.state ?? "Inactive";
	const awaiting = snapshot?.awaiting_plan_approval ?? false;
	const active = state === "Active";
	const pending = state === "Pending" || state === "ExitPending";
	let status = "off";
	if (awaiting) status = "plan approval";
	else if (state !== "Inactive") status = "plan";
	return {
		state,
		active,
		pending,
		awaitingApproval: awaiting,
		hasPlan: snapshot?.plan_has_content === true,
		planContent: null,
		planFilePath: snapshot?.plan_file_path ?? "",
		status
	};
}
function hasOpenTurn(events) {
	let open = false;
	for (const event of events) if (event.type === "turn/start") open = true;
	else if (event.type === "turn/end") open = false;
	return open;
}
/** Preserve an old official Plan selection during global replacement.
* Grok snapshots always win, including an explicit Inactive snapshot. A pending
* exit is not approval, so an active legacy plan stays constrained until the
* person exits through the new surface.
*/
function legacyPlanNeedsMigration(events) {
	let active = false;
	let wanted = false;
	let pending;
	for (const event of events) {
		if ((event.type === "plan/mode" || event.type === "grok-plan/state") && isGrokPlanEventData(event.data)) return false;
		if (typeof event.data !== "object" || event.data === null) continue;
		const data = event.data;
		if (event.type === "plan/mode") {
			active = data.active === true;
			wanted = false;
		}
		if (event.type === "command/run" && data.name === "plan" && typeof data.args === "string") pending = {
			id: data.commandId,
			wanted: data.args.trim() !== "off"
		};
		if (event.type === "command/done" && pending !== void 0 && data.commandId === pending.id) {
			if (data.kind === "success") wanted = pending.wanted;
			pending = void 0;
		}
	}
	return active || wanted || pending?.wanted === true;
}
//#endregion
//#region src/plan-file.ts
function dshHome(env = process.env) {
	return env.DSH_HOME && env.DSH_HOME.trim() !== "" ? env.DSH_HOME : join(homedir(), ".dsh");
}
function encodeCwd(cwd) {
	return encodeURIComponent(cwd);
}
function sessionDir(input) {
	const home = input.home ?? dshHome();
	const cwdKey = input.cwd && input.cwd.trim() !== "" ? encodeCwd(input.cwd) : "_no_cwd";
	return join(home, "sessions", cwdKey, input.sessionId);
}
function fallbackPlanPath(cwd) {
	if (cwd === void 0 || cwd.trim() === "") return ".grok/plan.md";
	return join(cwd, ".grok", "plan.md");
}
/** Grok: session dir `plan.md` first; workspace `.grok/plan.md` if no cwd/session path. */
function resolvePlanFilePath(input) {
	const dir = sessionDir(input);
	const fallback = fallbackPlanPath(input.cwd);
	return {
		sessionDir: dir,
		planFilePath: input.cwd !== void 0 && input.cwd.trim() !== "" ? join(dir, "plan.md") : fallback,
		fallbackPath: fallback
	};
}
async function planFileHasContent(path) {
	try {
		const info = await stat(path);
		return info.isFile() && info.size > 0;
	} catch {
		return false;
	}
}
function planFileHasContentSync(path) {
	try {
		const info = statSync(path);
		return info.isFile() && info.size > 0;
	} catch {
		return false;
	}
}
async function readPlanFile(path) {
	try {
		const text = await readFile(path, "utf8");
		return text.trim() === "" ? void 0 : text;
	} catch {
		return;
	}
}
/**
* Probe the plan file; create an empty one only on not-found.
* Never truncates existing content.
*/
async function probeOrCreateEmptyPlanFile(path) {
	try {
		return (await readFile(path)).length === 0 ? { kind: "empty" } : { kind: "non_empty" };
	} catch (error) {
		const failure = seedFailureFromReadError(error);
		if (failure !== void 0) return {
			kind: "missing",
			reason: failure
		};
		try {
			await mkdir(dirname(path), { recursive: true });
			await writeFile(path, "", { flag: "wx" });
			return { kind: "empty" };
		} catch (writeError) {
			if (isAlreadyExists(writeError)) try {
				return (await readFile(path)).length === 0 ? { kind: "empty" } : { kind: "non_empty" };
			} catch {
				return {
					kind: "missing",
					reason: "inaccessible"
				};
			}
			return {
				kind: "missing",
				reason: "not_created"
			};
		}
	}
}
async function writePlanModeJson(sessionDirectory, json) {
	await mkdir(sessionDirectory, { recursive: true });
	await writeFile(join(sessionDirectory, "plan_mode.json"), `${JSON.stringify(json, null, 2)}\n`);
}
function seedFailureFromReadError(error) {
	const code = errorCode(error);
	if (code === "ENOENT") return void 0;
	if (code === "EISDIR") return "not_a_file";
	if (code === "EACCES" || code === "EPERM") return "inaccessible";
	if (code !== void 0) return "inaccessible";
	return "inaccessible";
}
function isAlreadyExists(error) {
	return errorCode(error) === "EEXIST";
}
function errorCode(error) {
	if (typeof error === "object" && error !== null && "code" in error) {
		const code = error.code;
		return typeof code === "string" ? code : void 0;
	}
}
//#endregion
//#region src/projection.ts
const grokPlanStateSchema = z.union([z.null(), z.object({
	state: z.enum([
		"Inactive",
		"Pending",
		"Active",
		"ExitPending"
	]),
	was_previously_active: z.boolean(),
	reminder_count: z.number(),
	pending_exit_reminder: z.boolean(),
	awaiting_plan_approval: z.boolean(),
	plan_file_path: z.string(),
	plan_has_content: z.boolean().optional()
})]);
const grokPlanProjectionDefinition = {
	key: "grok-plan",
	stateVersion: 1,
	stateSchema: grokPlanStateSchema,
	init: () => null,
	apply: (state, event) => {
		if (event.type !== "plan/mode" && event.type !== "grok-plan/state") return state;
		const parsed = grokPlanStateSchema.safeParse(event.data);
		if (!parsed.success || parsed.data === null) return state;
		return parsed.data;
	},
	wire: {
		viewSchema: z.object({
			state: z.enum([
				"Inactive",
				"Pending",
				"Active",
				"ExitPending"
			]),
			active: z.boolean(),
			pending: z.boolean(),
			awaitingApproval: z.boolean(),
			hasPlan: z.boolean(),
			planContent: z.string().nullable(),
			planFilePath: z.string(),
			status: z.enum([
				"off",
				"plan",
				"plan approval"
			])
		}),
		view: (state) => viewFromSnapshot(state ?? void 0)
	}
};
//#endregion
//#region src/types.ts
const REVIEW_QUESTION_ID = "grok-plan-review";
const APPROVE_LABEL = "Approve";
const REQUEST_CHANGES_LABEL = "Request changes";
const QUIT_LABEL = "Quit";
const EMPTY_PLAN_PLACEHOLDER = `\
# No plan written yet

The agent exited plan mode without writing a plan.

- **Approve** — leave plan mode and start implementing
- **Request changes** — send the agent back to planning
- **Quit** — abandon and turn plan mode off
`;
const PLAN_APPROVED_IMPLEMENT_MESSAGE = "The user approved the plan. Implement the plan in plan.md.";
const ENTER_PLAN_MODE = "enter_plan_mode";
const EXIT_PLAN_MODE = "exit_plan_mode";
const DEFAULT_TOOL_HINTS = {
	ask_user: "ask_user_question",
	exit_plan: EXIT_PLAN_MODE,
	task: ""
};
function outcomeFromLabel(label) {
	if (label === "Approve") return "approved";
	if (label === "Quit") return "abandoned";
	return "cancelled";
}
//#endregion
//#region src/prompts.ts
const ENTERED_PLAN_MODE_MESSAGE = "You have entered plan mode. You should now focus on exploring the codebase and creating an implementation plan.";
const EXIT_PLAN_APPROVED_MESSAGE = "Your plan has been approved. You can now start coding.";
const EXIT_EMPTY_PLAN_MESSAGE = "Plan mode exit approved. No plan content was found — you can proceed.";
function formatEnterPlanMode(input) {
	const hints = {
		...DEFAULT_TOOL_HINTS,
		...input.toolHints
	};
	const ask = hints.ask_user;
	const exit = hints.exit_plan;
	const taskHint = hints.task === "" ? "" : `\n   You can use the ${hints.task} tool with subagent_type="explore" to parallelize codebase exploration without filling your context window.`;
	const planStatus = formatPlanSeedStatus(input.planFilePath, input.planFileSeed);
	return `${input.message ?? "You have entered plan mode. You should now focus on exploring the codebase and creating an implementation plan."}

${planStatus}

In plan mode, you should:
1. Thoroughly explore the codebase to understand existing patterns${taskHint}
2. Identify similar features, codebase architecture, and understand trade-offs
3. Use ${ask} if you need to clarify the approach
4. Design a concrete implementation strategy
5. Write your plan to the plan file above
6. When ready, use ${exit} to present your plan to the user.`;
}
function formatExitPlanReady(input) {
	return `${input.message ?? "Your plan has been approved. You can now start coding."}\n\nYour plan has been saved at: ${input.planFilePath}\n\n## Plan:\n${input.planContent}`;
}
function formatPlanSeedStatus(planFilePath, seed) {
	if (seed.kind === "empty") return `Write your plan to ${planFilePath}. The file exists and is empty.`;
	if (seed.kind === "non_empty") return `Write your plan to ${planFilePath}. The file exists but is not empty.`;
	return `Write your plan to ${planFilePath}. ${{
		not_created: "The file has not yet been created.",
		not_a_file: "A directory already exists at that path.",
		inaccessible: "The file could not be accessed.",
		unavailable: "The plan file location is unavailable."
	}[seed.reason]}`;
}
const ENTER_PLAN_MODE_DESCRIPTION = "Use this tool when a task has ambiguity about the right approach or when the user asks you to write a plan. This tool enables a read-only plan mode where you explore the codebase and create an implementation plan for the user.";
const EXIT_PLAN_MODE_DESCRIPTION = "Exit plan mode and present your plan to the user.\n\nUse this after you have finished writing your plan to the plan file in plan mode.";
//#endregion
//#region src/reminders.ts
function wrapSystemReminder(text) {
	return `<system-reminder>\n${text}\n</system-reminder>`;
}
function planModeReminderFull(input) {
	const edit = input.tools?.edit ?? "edit";
	const ask = input.tools?.ask_user ?? DEFAULT_TOOL_HINTS.ask_user;
	const exit = input.tools?.exit_plan ?? DEFAULT_TOOL_HINTS.exit_plan;
	return [
		"Plan mode is active. Do not make any edits or writes to the system.",
		"",
		"## Plan File:",
		input.planHasContent ? `A plan file exists at ${input.planPath}. You can read it and make edits using the ${edit} tool.` : `No plan written yet. Write your plan to ${input.planPath} using the ${edit} tool.`,
		"",
		"You should build your plan by writing to or editing this file. Note that this is the only file you are allowed to edit.",
		"",
		`Your turn should only end with either ${ask} to clarify requirements or ${exit} to present your plan to the user.`
	].join("\n");
}
function planModeReminderSparse() {
	return "Plan mode is still active. Do not make any edits or writes to the system except for the plan file.";
}
function planModeReentryReminder(input) {
	const ask = input.tools?.ask_user ?? DEFAULT_TOOL_HINTS.ask_user;
	const exit = input.tools?.exit_plan ?? DEFAULT_TOOL_HINTS.exit_plan;
	return [
		"## Returning to Plan Mode",
		"",
		`You are entering plan mode again after having previously exited it. A plan file exists at ${input.planPath} from your previous planning session.`,
		"",
		`Your turn should only end with either ${ask} to clarify requirements or ${exit} to present your plan to the user.`
	].join("\n");
}
function planModeExitReminder() {
	return "You have exited plan mode. You can now make edits, run tools, and take actions.";
}
function planModeEditRejected(planPath) {
	return `Rejected: file edits are not allowed in plan mode - the only editable file is the plan file (${planPath}).`;
}
//#endregion
//#region src/review.ts
function normalizePlanContent(planContent) {
	if (planContent === void 0 || planContent === null) return void 0;
	return planContent.trim() === "" ? void 0 : planContent;
}
function displayPlanContent(planContent) {
	return normalizePlanContent(planContent) ?? EMPTY_PLAN_PLACEHOLDER;
}
function revisePlanMessage(feedback) {
	const trimmed = feedback.trim();
	if (trimmed === "") return "The user wants to revise the plan. Ask the user what changes they would like to make.";
	return `The user wants to revise the plan. The user said:\n${trimmed}`;
}
function abandonedPlanMessage() {
	return "The user abandoned the plan and turned plan mode off. Stop here and wait for their next message.";
}
function resumeActionFor(outcome, feedback) {
	if (outcome === "approved") return { kind: "leave_and_implement" };
	if (outcome === "abandoned") return { kind: "leave_only" };
	return {
		kind: "stay_and_revise",
		message: revisePlanMessage(feedback ?? "")
	};
}
//#endregion
//#region src/host/plugin.ts
function applyGrokPlanMode(ctx) {
	const trackers = /* @__PURE__ */ new WeakMap();
	const trackerOf = (agent) => {
		const existing = trackers.get(agent.session);
		if (existing !== void 0) return existing;
		const paths = pathsOf(agent);
		const folded = ctx.sessionProjections.stateOf(agent.session, "grok-plan");
		const tracker = folded === void 0 || folded === null ? new PlanModeTracker(paths.sessionDir, paths.planFilePath) : PlanModeTracker.fromSnapshot(paths.sessionDir, folded, folded.plan_file_path);
		trackers.set(agent.session, tracker);
		if (legacyPlanNeedsMigration(agent.session.snapshotEvents())) {
			tracker.activateFromTool();
			persist(agent);
		}
		return tracker;
	};
	const persist = (agent) => {
		const tracker = trackerOf(agent);
		const planFilePath = tracker.planFilePath();
		const data = {
			...tracker.snapshot(),
			plan_file_path: planFilePath,
			plan_has_content: planFileHasContentSync(planFilePath)
		};
		agent.session.append(GROK_PLAN_EVENT, {
			...data,
			active: data.state !== "Inactive"
		});
		writePlanModeJson(pathsOf(agent).sessionDir, data).catch((error) => {
			ctx.logger.warn("dsh-grok-plan-mode: failed to write plan_mode.json: %o", error);
		});
	};
	ctx.on("agent/created", ({ agent }) => {
		trackerOf(agent);
	});
	ctx.on("agent/session-start", ({ agent, source }) => {
		const tracker = trackerOf(agent);
		if (source === "compact") tracker.resetAfterCompaction();
	});
	ctx.on("session/event", (session, event) => {
		if (event.type !== "turn/end") return;
		const tracker = trackers.get(session);
		if (tracker === void 0 || tracker.getState() !== "ExitPending") return;
		tracker.completeDeferredExit();
		const agent = findAgent(ctx, session);
		if (agent !== void 0) persist(agent);
	});
	ctx.on("agent/pre-step", async ({ agent, signal }, next) => {
		const decision = await next();
		if (decision.kind === "reject" || signal.aborted) return decision;
		const tracker = trackerOf(agent);
		const injections = [];
		const hints = toolHints(ctx, agent);
		if (tracker.getState() === "Pending") {
			const reentry = tracker.isReentry();
			tracker.activate();
			persist(agent);
			const text = reentry ? planModeReentryReminder({
				planPath: tracker.planFilePath(),
				tools: hints
			}) : planModeReminderFull({
				planPath: tracker.planFilePath(),
				planHasContent: await planFileHasContent(tracker.planFilePath()),
				tools: hints
			});
			injections.push(notice(wrapSystemReminder(text)));
			tracker.recordReminderInjected();
			persist(agent);
		} else if (tracker.hasPendingActivation()) {
			const text = tracker.takePendingActivation();
			if (text !== void 0) {
				injections.push(notice(text));
				tracker.recordReminderInjected();
				persist(agent);
			}
		} else if (tracker.hasPendingExitReminder()) {
			injections.push(notice(wrapSystemReminder(planModeExitReminder())));
			tracker.clearPendingExitReminder();
			persist(agent);
		} else if (tracker.isActive()) {
			const text = tracker.shouldUseFullReminder() ? planModeReminderFull({
				planPath: tracker.planFilePath(),
				planHasContent: await planFileHasContent(tracker.planFilePath()),
				tools: hints
			}) : planModeReminderSparse();
			injections.push(notice(wrapSystemReminder(text)));
			tracker.recordReminderInjected();
			persist(agent);
		}
		if (injections.length === 0) return decision;
		return {
			kind: "enter",
			messages: [...decision.messages, ...injections]
		};
	});
	ctx.on("tools/pre-execute", async (exec, next) => {
		const agent = exec.agent;
		if (agent === void 0) return next();
		if (!isPlanningAgent(agent.session.header)) return next();
		const tracker = trackerOf(agent);
		const access = classifyToolAccess({
			name: exec.name,
			arguments: exec.arguments
		});
		if (planModeEditGate(tracker, access.kind === "edit" ? {
			kind: "edit",
			path: resolveEditPath(access.path, agent.session.header.cwd)
		} : access) === "reject_non_plan_file") return {
			kind: "deny",
			reason: planModeEditRejected(tracker.planFilePath())
		};
		return next();
	});
	{
		const register = (name, description, hint, handler) => {
			ctx.commands.register({
				name,
				description,
				...hint.trim() === "" ? {} : { input: {
					hint,
					images: true
				} },
				handler
			});
		};
		const leave = ({ agent }) => {
			const tracker = trackerOf(agent);
			reviews.get(tracker)?.abort();
			if (tracker.getState() === "Inactive" && !tracker.isAwaitingPlanApproval()) return {
				kind: "success",
				text: "Plan mode is already off."
			};
			tracker.userExit(hasOpenTurn(agent.session.snapshotEvents()));
			persist(agent);
			return {
				kind: "success",
				text: "Left plan mode."
			};
		};
		const handlePlan = ({ agent, rawInput, attachments }) => {
			const message = rawInput.trim();
			if (message === "off") {
				if (attachments.length > 0) return {
					kind: "error",
					text: "Image attachments cannot accompany /plan off."
				};
				return leave({ agent });
			}
			const tracker = trackerOf(agent);
			if (message === "" && attachments.length === 0) {
				if (tracker.getState() === "Inactive" || tracker.getState() === "ExitPending") {
					enterFromCommand(agent, tracker);
					persist(agent);
					return {
						kind: "success",
						text: "Plan mode on. Active on your next prompt."
					};
				}
				return {
					kind: "success",
					text: alreadyInPlanText(tracker)
				};
			}
			enterFromCommand(agent, tracker);
			persist(agent);
			agent.steer(createUserMessage({
				content: [...attachments, ...message === "" ? [] : [{
					type: "text",
					text: message
				}]],
				source: { kind: "user" }
			}));
			return {
				kind: "success",
				text: "Plan mode on. Starting this turn under plan mode."
			};
		};
		register("plan", "Enter or leave plan mode", "[off|message]", handlePlan);
		register("grok-plan-leave", "Leave plan mode", "", leave);
		const viewPlan = async ({ agent, signal }) => {
			const tracker = trackerOf(agent);
			if (tracker.getState() === "Inactive" && !tracker.isAwaitingPlanApproval()) return {
				kind: "error",
				text: "No plan mode session is active. Use /plan first."
			};
			try {
				const { outcome, feedback } = await presentReview(ctx, agent, tracker, signal, persist);
				if (outcome === "approved") {
					agent.steer(createUserMessage({
						content: [{
							type: "text",
							text: PLAN_APPROVED_IMPLEMENT_MESSAGE
						}],
						source: { kind: "user" }
					}));
					return {
						kind: "success",
						text: "Plan approved. Starting implementation."
					};
				}
				if (outcome === "cancelled") {
					agent.steer(createUserMessage({
						content: [{
							type: "text",
							text: revisePlanMessage(feedback)
						}],
						source: { kind: "user" }
					}));
					return {
						kind: "success",
						text: "Staying in plan mode with your notes."
					};
				}
				return {
					kind: "success",
					text: "Plan abandoned. Plan mode is off."
				};
			} catch (error) {
				return {
					kind: "error",
					text: errorMessage(error)
				};
			}
		};
		for (const name of [
			"view-plan",
			"show-plan",
			"plan-view"
		]) register(name, "Open a preview of the current saved plan", "", viewPlan);
	}
	ctx.sessionProjections.register(grokPlanProjectionDefinition);
	ctx.tools.register(defineTool({
		name: ENTER_PLAN_MODE,
		description: ENTER_PLAN_MODE_DESCRIPTION,
		parameters: {},
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: {
					message: {
						type: "string",
						required: true
					},
					plan_file_path: {
						type: "string",
						required: true
					},
					plan_file_seed: {
						type: "string",
						required: true
					}
				}
			},
			render: (_args, value) => [{
				type: "text",
				text: value.message
			}]
		},
		execute: async (_args, exec) => {
			const agent = exec.agent;
			if (agent === void 0) throw new Error(`${ENTER_PLAN_MODE} requires a calling agent`);
			const tracker = trackerOf(agent);
			const changed = tracker.activateFromTool();
			const seed = await probeOrCreateEmptyPlanFile(tracker.planFilePath());
			if (changed) persist(agent);
			const hints = toolHints(ctx, agent);
			return {
				message: formatEnterPlanMode({
					message: ENTERED_PLAN_MODE_MESSAGE,
					planFilePath: tracker.planFilePath(),
					planFileSeed: seed,
					toolHints: hints
				}),
				plan_file_path: tracker.planFilePath(),
				plan_file_seed: seed.kind
			};
		}
	}));
	ctx.tools.register(defineTool({
		name: EXIT_PLAN_MODE,
		description: EXIT_PLAN_MODE_DESCRIPTION,
		parameters: {},
		output: {
			schema: {
				type: "object",
				additionalProperties: false,
				properties: {
					message: {
						type: "string",
						required: true
					},
					approved: {
						type: "boolean",
						required: true
					}
				}
			},
			render: (_args, value) => [{
				type: "text",
				text: value.message
			}]
		},
		execute: async (_args, exec) => {
			const agent = exec.agent;
			if (agent === void 0) throw new Error(`${EXIT_PLAN_MODE} requires a calling agent`);
			const tracker = trackerOf(agent);
			if (!tracker.isActive()) throw new Error(`${EXIT_PLAN_MODE} is only available in plan mode`);
			const { outcome, feedback, plan: content } = await presentReview(ctx, agent, tracker, exec.signal, persist);
			if (outcome === "approved") return {
				message: content === void 0 ? EXIT_EMPTY_PLAN_MESSAGE : formatExitPlanReady({
					message: EXIT_PLAN_APPROVED_MESSAGE,
					planFilePath: tracker.planFilePath(),
					planContent: content
				}),
				approved: true
			};
			if (outcome === "abandoned") throw new Error(abandonedPlanMessage());
			throw new Error(revisePlanMessage(feedback));
		}
	}));
	for (const agent of ctx.get("agents")?.list() ?? []) trackerOf(agent);
}
const reviews = /* @__PURE__ */ new WeakMap();
async function presentReview(ctx, agent, tracker, signal, persist) {
	const questions = ctx.get("userQuestions");
	if (questions === void 0) throw new Error("no interactive client is available to review the plan; stay in plan mode");
	if (!tracker.isActive()) throw new Error("Plan mode must be active before review.");
	if (reviews.has(tracker)) throw new Error("A plan review is already open.");
	const controller = new AbortController();
	reviews.set(tracker, controller);
	const lifetime = signal === void 0 ? controller.signal : AbortSignal.any([signal, controller.signal]);
	const assertCurrent = () => {
		if (lifetime.aborted || !tracker.isActive()) throw new Error("Plan review expired; no implementation was approved.");
	};
	try {
		const plan = await readPlanFile(tracker.planFilePath());
		assertCurrent();
		tracker.setAwaitingPlanApproval(true);
		persist(agent);
		const answer = await questions.ask({
			questions: [{
				id: REVIEW_QUESTION_ID,
				header: "Plan approval",
				question: "Review this plan. Auto and always-approve do not skip this step.",
				detail: displayPlanContent(plan),
				multiSelect: true,
				options: [
					{
						label: APPROVE_LABEL,
						description: "Leave plan mode and start implementing."
					},
					{
						label: REQUEST_CHANGES_LABEL,
						description: "Stay in plan mode and send notes back to the model."
					},
					{
						label: QUIT_LABEL,
						description: "Abandon the plan and turn plan mode off."
					}
				]
			}],
			agent,
			signal: lifetime
		});
		assertCurrent();
		const item = answer.answers[0];
		if (answer.answers.length !== 1 || item?.id !== "grok-plan-review" || item.selected.length !== 1) throw new Error("Choose exactly one plan review action; no implementation was approved.");
		const label = item.selected[0];
		if (label !== "Approve" && label !== "Request changes" && label !== "Quit") throw new Error("Unknown plan review action; no implementation was approved.");
		if (label === "Approve") {
			const currentPlan = await readPlanFile(tracker.planFilePath());
			assertCurrent();
			if (currentPlan !== plan) throw new Error("The plan changed during review. Review it again before approval.");
		}
		const outcome = outcomeFromLabel(label);
		const feedback = outcome === "cancelled" ? item?.custom ?? "" : "";
		applyOutcome(tracker, outcome, feedback);
		persist(agent);
		return {
			outcome,
			feedback,
			plan
		};
	} catch (error) {
		tracker.setAwaitingPlanApproval(false);
		persist(agent);
		if (error instanceof UserQuestionError && error.code === "ASK_CANCELLED") throw new Error("The user dismissed the plan review to speak instead; stay in plan mode, stop here, and wait for their message.");
		if (error instanceof UserQuestionError && error.code === "NO_PROVIDER") throw new Error("no interactive client is available to review the plan; stay in plan mode");
		throw error;
	} finally {
		reviews.delete(tracker);
	}
}
function applyOutcome(tracker, outcome, feedback) {
	const action = resumeActionFor(outcome, feedback);
	if (action.kind === "leave_and_implement") {
		tracker.deactivateApproved();
		return;
	}
	if (action.kind === "leave_only") {
		tracker.userExit(false);
		return;
	}
	tracker.setAwaitingPlanApproval(false);
}
function enterFromCommand(agent, tracker) {
	tracker.enterPending();
	if (hasOpenTurn(agent.session.snapshotEvents()) && tracker.getState() === "Pending") {
		const text = wrapSystemReminder(planModeReminderFull({
			planPath: tracker.planFilePath(),
			planHasContent: false
		}));
		tracker.activateMidTurn(text);
	}
}
function alreadyInPlanText(tracker) {
	if (tracker.isAwaitingPlanApproval()) return "Plan approval is already open. Use the review surface or /view-plan.";
	return "Plan mode is already on.";
}
function pathsOf(agent) {
	return resolvePlanFilePath({
		sessionId: agent.session.id,
		cwd: agent.session.header.cwd
	});
}
function toolHints(ctx, agent) {
	const names = /* @__PURE__ */ new Set();
	const tools = agent.ctx.get("tools") ?? ctx.tools;
	for (const item of tools.schemas()) names.add(item.name);
	const edit = names.has("str_replace_editor") ? "str_replace_editor" : names.has("edit") ? "edit" : names.has("write") ? "write" : "edit";
	return {
		...DEFAULT_TOOL_HINTS,
		ask_user: names.has("ask_user_question") ? "ask_user_question" : DEFAULT_TOOL_HINTS.ask_user,
		edit,
		task: names.has("task") ? "task" : ""
	};
}
function notice(text) {
	return createUserMessage({
		content: [{
			type: "text",
			text
		}],
		source: {
			kind: "plugin",
			plugin: "grok-plan-mode",
			form: "notice",
			summary: text.split("\n")[0] ?? "plan mode"
		}
	});
}
function findAgent(ctx, session) {
	return ctx.get("agents")?.get(session.id);
}
function errorMessage(error) {
	return error instanceof Error ? error.message : String(error);
}
//#endregion
//#region src/index.ts
const name = "grok-plan-mode";
const inject = [
	"tools",
	"commands",
	"sessionProjections"
];
async function apply(ctx) {
	ctx.logger.info("[dsh-grok-plan-mode] loaded");
	await installPlanReplacement(ctx);
	applyGrokPlanMode(ctx);
}
//#endregion
export { PlanModeTracker, apply, classifyToolAccess, inject, name, planModeEditGate, planModeEditRejected, planModeExitReminder, planModeReentryReminder, planModeReminderFull, planModeReminderSparse };
