window.__ModuleLoader__.load({
	id: "dsh-grok-plan-mode",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region \0dshx-css-module:/Users/wu/Documents/DSH-output/dsh-grok-planmode/src/client/PlanChip.module.css.mjs
		const css$1 = ".iPq1Oq_wrap{align-items:center;gap:6px;display:inline-flex}.iPq1Oq_chip,.iPq1Oq_approval{corner-shape:round;cursor:pointer;border:none;border-radius:999px;align-items:center;gap:4px;min-width:34px;padding:2px 8px;font-size:13px;font-weight:500;line-height:20px;display:inline-flex}.iPq1Oq_chip{background:var(--dsw-alias-state-warn-tertiary);color:var(--dsw-alias-state-warn-label)}.iPq1Oq_approval{background:var(--dsw-alias-state-info-tertiary,var(--dsw-alias-state-warn-tertiary));color:var(--dsw-alias-state-info-label,var(--dsw-alias-state-warn-label))}.iPq1Oq_chip:hover:not(:disabled),.iPq1Oq_approval:hover:not(:disabled){color:var(--dsw-alias-state-warn-primary)}.iPq1Oq_chip:focus-visible,.iPq1Oq_approval:focus-visible{outline:2px solid var(--dsw-alias-state-warn-label);outline-offset:2px}.iPq1Oq_chip:disabled,.iPq1Oq_approval:disabled{opacity:.6;cursor:default}.iPq1Oq_close{color:currentColor;align-items:center;display:inline-flex}.iPq1Oq_error{color:var(--dsw-alias-state-error-primary);font-size:12px;line-height:18px}@media (prefers-reduced-motion:reduce){.iPq1Oq_chip,.iPq1Oq_approval{transition:none}}";
		const tagId$1 = "dsh-grok-plan-mode/PlanChip.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$1) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-grok-plan-mode";
			tag.dataset.pluginCss = tagId$1;
			tag.textContent = css$1;
			document.head.appendChild(tag);
		}
		var PlanChip_module_css_default = {
			"approval": "iPq1Oq_approval",
			"chip": "iPq1Oq_chip",
			"close": "iPq1Oq_close",
			"error": "iPq1Oq_error",
			"wrap": "iPq1Oq_wrap"
		};
		//#endregion
		//#region src/client/PlanChip.tsx
		function PlanChip({ useProjection, locked, exitPlanMode, t }) {
			const plan = useProjection("grok-plan");
			const [leaving, setLeaving] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)(null);
			const aliveRef = (0, react.useRef)(true);
			(0, react.useEffect)(() => {
				aliveRef.current = true;
				return () => {
					aliveRef.current = false;
				};
			}, []);
			if (plan === void 0 || plan.status === "off") return null;
			const approval = isApproval(plan);
			const off = () => {
				setLeaving(true);
				setError(null);
				exitPlanMode().then((failure) => {
					if (!aliveRef.current) return;
					setLeaving(false);
					setError(failure);
				}, (reason) => {
					if (!aliveRef.current) return;
					setLeaving(false);
					setError(reason instanceof Error ? reason.message : String(reason));
				});
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
				className: PlanChip_module_css_default.wrap,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					className: approval ? PlanChip_module_css_default.approval : PlanChip_module_css_default.chip,
					"aria-label": approval ? t("chip.approval.aria") : t("chip.on.aria"),
					title: approval ? t("chip.approval.aria") : t("chip.on.title"),
					disabled: locked || leaving,
					onClick: off,
					children: [approval ? t("chip.approval") : t("chip.label"), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: PlanChip_module_css_default.close,
						"aria-hidden": true,
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconCloseFill14, { size: 12 })
					})]
				}), error !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: PlanChip_module_css_default.error,
					role: "status",
					title: error,
					children: t("chip.exitFailed")
				})]
			});
		}
		function isApproval(plan) {
			return plan.status === "plan approval";
		}
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
		//#endregion
		//#region \0dshx-css-module:/Users/wu/Documents/DSH-output/dsh-grok-planmode/src/client/PlanReview.module.css.mjs
		const css = ".RHiVBq_frame{padding:6px calc(var(--dsh-composer-side-clearance) + 16px) 10px;justify-content:center;display:flex}.RHiVBq_card{width:100%;max-width:var(--dsh-chat-content-width);border:1px solid var(--dsw-alias-state-warn-secondary);background:var(--dsw-specific-input-major);max-height:min(60vh,520px);box-shadow:var(--dsw-shadow-lv2);color:var(--dsw-alias-label-primary);--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2);border-radius:20px;flex-direction:column;display:flex;overflow:hidden}.RHiVBq_card,.RHiVBq_card *{box-sizing:border-box}.RHiVBq_strip{background:var(--dsw-alias-state-warn-tertiary);color:var(--dsw-alias-state-warn-primary);flex-shrink:0;align-items:center;gap:8px;padding:10px 16px;font-size:13px;line-height:18px;display:flex}.RHiVBq_dot{corner-shape:round;background:var(--dsw-alias-state-warn-primary);border-radius:50%;width:8px;height:8px}.RHiVBq_body{overscroll-behavior:contain;flex:auto;min-height:0;padding:12px 16px 4px;font-size:14px;line-height:22px;overflow-y:auto}.RHiVBq_footer{flex-shrink:0;justify-content:space-between;align-items:center;gap:12px;padding:8px 16px 12px;display:flex}.RHiVBq_feedback{min-height:16px;color:var(--dsw-alias-state-error-primary);font-size:11px;line-height:16px}.RHiVBq_actions{flex-shrink:0;align-items:center;gap:8px;display:flex}.RHiVBq_discuss{color:var(--dsw-alias-label-secondary);gap:6px}.RHiVBq_discuss:hover:not(:disabled){color:var(--dsw-alias-label-primary)}@media (width<=720px){.RHiVBq_card{border-radius:16px}.RHiVBq_body{padding:10px 12px 4px}.RHiVBq_footer{align-items:flex-end;padding:8px 12px 10px}}";
		const tagId = "dsh-grok-plan-mode/PlanReview.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-grok-plan-mode";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var PlanReview_module_css_default = {
			"actions": "RHiVBq_actions",
			"body": "RHiVBq_body",
			"card": "RHiVBq_card",
			"discuss": "RHiVBq_discuss",
			"dot": "RHiVBq_dot",
			"feedback": "RHiVBq_feedback",
			"footer": "RHiVBq_footer",
			"frame": "RHiVBq_frame",
			"strip": "RHiVBq_strip"
		};
		//#endregion
		//#region src/client/PlanReview.tsx
		function tooltip(description) {
			return description === void 0 ? {} : { title: description };
		}
		function PlanReview({ matched, t }) {
			const question = matched.questions[0];
			const raw = question?.detail ?? "";
			const hasPlan = raw.trim() !== "" && raw !== EMPTY_PLAN_PLACEHOLDER;
			const plan = hasPlan ? raw : EMPTY_PLAN_PLACEHOLDER;
			const [busy, setBusy] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)(null);
			const markdownLabels = (0, react.useMemo)(() => ({
				code: {
					copyLabel: t("copy"),
					copiedLabel: t("copied")
				},
				footnotes: t("markdown.footnotes")
			}), [t]);
			const settle = (send) => {
				setBusy(true);
				setError(null);
				send().catch((cause) => {
					setBusy(false);
					setError(cause instanceof Error ? cause.message : String(cause));
				});
			};
			const decide = (label) => {
				settle(() => matched.answer({ answers: [{
					id: REVIEW_QUESTION_ID,
					selected: [label]
				}] }));
			};
			const changes = question?.options?.find((option) => option.label === REQUEST_CHANGES_LABEL);
			const quit = question?.options?.find((option) => option.label === QUIT_LABEL);
			const approve = question?.options?.find((option) => option.label === APPROVE_LABEL);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: PlanReview_module_css_default.frame,
				"data-grok-plan-review": matched.key,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
					className: PlanReview_module_css_default.card,
					"aria-label": question?.question ?? t("review.header"),
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: PlanReview_module_css_default.strip,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: PlanReview_module_css_default.dot }), hasPlan ? t("review.waiting") : t("review.empty")]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: PlanReview_module_css_default.body,
							"data-grok-plan-review-scroll": true,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.MarkdownText, {
								text: plan,
								labels: markdownLabels
							})
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: PlanReview_module_css_default.footer,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: PlanReview_module_css_default.feedback,
								role: "status",
								children: error
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: PlanReview_module_css_default.actions,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
										variant: "ghost",
										className: PlanReview_module_css_default.discuss,
										icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconEditOutline16, { size: 14 }),
										...tooltip(changes?.description),
										disabled: busy,
										onClick: () => {
											decide(REQUEST_CHANGES_LABEL);
										},
										children: t("review.discuss")
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
										variant: "outline",
										...tooltip(quit?.description),
										disabled: busy,
										onClick: () => {
											decide(QUIT_LABEL);
										},
										children: t("review.quit")
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
										variant: "primary",
										...tooltip(approve?.description),
										disabled: busy,
										onClick: () => {
											decide(APPROVE_LABEL);
										},
										children: t("review.approve")
									})
								]
							})]
						})
					]
				})
			});
		}
		//#endregion
		//#region src/client/locales.ts
		const zh = {
			"chip.label": "Plan",
			"chip.approval": "Plan approval",
			"chip.on.aria": "计划模式已开启。点击退出。",
			"chip.on.title": "计划模式已开启 — 点击退出（/plan off）",
			"chip.approval.aria": "计划审批已打开。点击退出计划模式。",
			"chip.exitFailed": "退出计划模式失败",
			"review.header": "计划审批",
			"review.empty": "还没有写计划 — 批准、去聊天里说或放弃",
			"review.waiting": "等待计划审批",
			"review.approve": "批准",
			"review.quit": "放弃",
			"review.discuss": "去聊天里说",
			"copy": "复制",
			"copied": "已复制",
			"markdown.footnotes": "脚注"
		};
		const en = {
			"chip.label": "Plan",
			"chip.approval": "Plan approval",
			"chip.on.aria": "Plan mode on. Click to leave.",
			"chip.on.title": "Plan mode on — click to leave (/plan off)",
			"chip.approval.aria": "Plan approval is open. Click to leave plan mode.",
			"chip.exitFailed": "Failed to exit plan mode",
			"review.header": "Plan approval",
			"review.empty": "No plan written — approve, chat about it, or quit",
			"review.waiting": "Waiting on plan approval",
			"review.approve": "Approve",
			"review.quit": "Quit",
			"review.discuss": "Chat about it",
			"copy": "Copy",
			"copied": "Copied",
			"markdown.footnotes": "Footnotes"
		};
		//#endregion
		//#region src/client/index.tsx
		const NS = "grok-plan";
		const name = "grok-plan-mode-ui";
		const inject = [
			"slots",
			"remote",
			"remote.commands",
			"locale"
		];
		function isGrokReviewWait(value) {
			if (value.kind !== "question" && value.kind !== "plan-review") return false;
			if (!("questions" in value) || !Array.isArray(value.questions)) return false;
			if (!("answer" in value) || typeof value.answer !== "function") return false;
			if (!("key" in value) || typeof value.key !== "string") return false;
			if (!("sessionId" in value) || typeof value.sessionId !== "string") return false;
			return true;
		}
		function selectReview({ pendingInteraction }) {
			if (pendingInteraction === void 0) return null;
			if (!isGrokReviewWait(pendingInteraction)) return null;
			if (pendingInteraction.questions.length !== 1) return null;
			if (pendingInteraction.questions[0]?.id !== "grok-plan-review") return null;
			return pendingInteraction;
		}
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "grok-plan-mode: dictionaries");
			ctx.slots.inject("conversation.input.plan", () => ctx.slots.register({
				name: "conversation.input.plan",
				locale: NS,
				inject: (sessionId) => ({ exitPlanMode: async () => {
					const result = await ctx.remote.commands.execute(sessionId, "/plan off", []);
					if (!result.ok) return `${result.error.message} (${result.error.code})`;
					if (result.value === void 0) return "unknown command: /plan off";
					return null;
				} })
			}, PlanChip));
			ctx.slots.inject("conversation.composer", () => ctx.slots.register({
				name: "conversation.composer",
				select: selectReview,
				locale: NS,
				priority: -10
			}, PlanReview));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		exports.name = name;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map