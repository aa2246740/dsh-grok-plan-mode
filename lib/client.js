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
		//#region src/review.ts
		function inlinePlanSnippets(planContent, lineStart, lineEnd) {
			if (planContent === void 0) return "> [plan content unavailable]";
			const lines = planContent.split("\n");
			if (lineStart === 0 || lineStart >= lineEnd || lineStart > lines.length) return "> [selected lines unavailable]";
			const end = Math.min(lineEnd - 1, lines.length);
			if (end < lineStart) return "> [selected lines unavailable]";
			return lines.slice(lineStart - 1, end).map((line) => `> ${line}`).join("\n");
		}
		function formatFileBackedPlanComment(comment) {
			return `${comment.lineEnd - comment.lineStart === 1 ? `@plan.md:${comment.lineStart}` : `@plan.md:${comment.lineStart}-${comment.lineEnd - 1}`}\n${comment.text}`;
		}
		function formatFeedback(input) {
			const source = input.source ?? "inline";
			const parts = input.comments.map((comment) => {
				if (source === "file_backed") return formatFileBackedPlanComment(comment);
				return `${comment.lineEnd - comment.lineStart === 1 ? `Proposed plan line ${comment.lineStart}:` : `Proposed plan lines ${comment.lineStart}-${comment.lineEnd - 1}:`}\n${inlinePlanSnippets(input.planContent, comment.lineStart, comment.lineEnd)}\n\nComment:\n${comment.text}`;
			});
			const freeform = input.freeform?.trim() ?? "";
			if (freeform !== "") {
				const text = source === "inline" && input.comments.length > 0 ? `Additional feedback:\n${freeform}` : freeform;
				parts.push(text);
			}
			return parts.join("\n\n");
		}
		//#endregion
		//#region \0dshx-css-module:/Users/wu/Documents/DSH-output/dsh-grok-planmode/src/client/PlanReview.module.css.mjs
		const css = ".RHiVBq_frame{padding:6px calc(var(--dsh-composer-side-clearance) + 16px) 10px;justify-content:center;display:flex}.RHiVBq_card{width:100%;max-width:var(--dsh-chat-content-width);border:1px solid var(--dsw-alias-state-warn-secondary);background:var(--dsw-specific-input-major);max-height:min(70vh,640px);box-shadow:var(--dsw-shadow-lv2);color:var(--dsw-alias-label-primary);--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2);border-radius:20px;flex-direction:column;display:flex;overflow:hidden}.RHiVBq_card,.RHiVBq_card *{box-sizing:border-box}.RHiVBq_strip{background:var(--dsw-alias-state-warn-tertiary);color:var(--dsw-alias-state-warn-primary);flex-shrink:0;align-items:center;gap:8px;padding:10px 16px;font-size:13px;line-height:18px;display:flex}.RHiVBq_dot{background:var(--dsw-alias-state-warn-primary);border-radius:50%;width:8px;height:8px}.RHiVBq_body{overscroll-behavior:contain;flex:auto;min-height:0;padding:12px 16px 4px;font-size:14px;line-height:22px;overflow-y:auto}.RHiVBq_hint{color:var(--dsw-alias-label-secondary);margin:12px 0 6px;font-size:12px}.RHiVBq_source{border:1px solid var(--dsw-alias-border-secondary,transparent);font-family:var(--dsw-font-mono,ui-monospace, SFMono-Regular, Menlo, monospace);border-radius:8px;margin:0;padding:0;font-size:12px;line-height:18px;list-style:none}.RHiVBq_source li{align-items:stretch;gap:8px;display:flex}.RHiVBq_selected{background:var(--dsw-alias-state-warn-tertiary)}.RHiVBq_gutter{font:inherit;color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary));text-align:right;cursor:pointer;background:0 0;border:none;flex:0 0 36px;padding:0 8px}.RHiVBq_gutter:hover:not(:disabled){color:var(--dsw-alias-state-warn-primary)}.RHiVBq_line{white-space:pre;flex:auto;margin:0;padding:0 8px 0 0;overflow-x:auto}.RHiVBq_comments{color:var(--dsw-alias-label-secondary);margin:12px 0 0;padding-left:18px;font-size:12px}.RHiVBq_composer{flex-direction:column;gap:8px;padding:8px 16px;display:flex}.RHiVBq_label{color:var(--dsw-alias-label-secondary);flex-direction:column;gap:4px;font-size:12px;display:flex}.RHiVBq_row{gap:8px;display:flex}.RHiVBq_input,.RHiVBq_notes{border:1px solid var(--dsw-alias-border-secondary,transparent);width:100%;color:inherit;background:0 0;border-radius:8px;padding:6px 8px}.RHiVBq_notes{resize:vertical;min-height:56px}.RHiVBq_footer{justify-content:space-between;align-items:center;gap:12px;padding:8px 16px 12px;display:flex}.RHiVBq_feedback{min-height:16px;color:var(--dsw-alias-state-error-primary);font-size:11px}.RHiVBq_actions{align-items:center;gap:8px;display:flex}";
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
			"comments": "RHiVBq_comments",
			"composer": "RHiVBq_composer",
			"dot": "RHiVBq_dot",
			"feedback": "RHiVBq_feedback",
			"footer": "RHiVBq_footer",
			"frame": "RHiVBq_frame",
			"gutter": "RHiVBq_gutter",
			"hint": "RHiVBq_hint",
			"input": "RHiVBq_input",
			"label": "RHiVBq_label",
			"line": "RHiVBq_line",
			"notes": "RHiVBq_notes",
			"row": "RHiVBq_row",
			"selected": "RHiVBq_selected",
			"source": "RHiVBq_source",
			"strip": "RHiVBq_strip"
		};
		//#endregion
		//#region src/client/PlanReview.tsx
		function PlanReview({ matched, t }) {
			const question = matched.questions[0];
			const raw = question?.detail ?? "";
			const hasPlan = raw.trim() !== "" && raw !== EMPTY_PLAN_PLACEHOLDER;
			const plan = hasPlan ? raw : EMPTY_PLAN_PLACEHOLDER;
			const lines = plan.split("\n");
			const [busy, setBusy] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)(null);
			const [notes, setNotes] = (0, react.useState)("");
			const [commentText, setCommentText] = (0, react.useState)("");
			const [anchor, setAnchor] = (0, react.useState)(null);
			const [focus, setFocus] = (0, react.useState)(null);
			const [comments, setComments] = (0, react.useState)([]);
			const [nextId, setNextId] = (0, react.useState)(0);
			const markdownLabels = (0, react.useMemo)(() => ({
				code: {
					copyLabel: t("copy"),
					copiedLabel: t("copied")
				},
				footnotes: t("markdown.footnotes")
			}), [t]);
			const selection = anchor === null || focus === null ? null : {
				start: Math.min(anchor, focus),
				end: Math.max(anchor, focus)
			};
			const send = (label, custom) => {
				setBusy(true);
				setError(null);
				matched.answer({ answers: [{
					id: REVIEW_QUESTION_ID,
					selected: [label],
					...custom !== void 0 && custom.trim() !== "" ? { custom } : {}
				}] }).catch((cause) => {
					setBusy(false);
					setError(cause instanceof Error ? cause.message : String(cause));
				});
			};
			const addComment = () => {
				if (selection === null || commentText.trim() === "") return;
				setComments((current) => [...current, {
					id: nextId,
					lineStart: selection.start,
					lineEnd: selection.end + 1,
					text: commentText.trim()
				}]);
				setNextId((id) => id + 1);
				setCommentText("");
			};
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
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: PlanReview_module_css_default.body,
							"data-grok-plan-review-scroll": true,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.MarkdownText, {
									text: plan,
									labels: markdownLabels
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: PlanReview_module_css_default.hint,
									children: t("review.lines")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("ol", {
									className: PlanReview_module_css_default.source,
									children: lines.map((line, index) => {
										const lineNumber = index + 1;
										const selected = selection !== null && lineNumber >= selection.start && lineNumber <= selection.end;
										return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
											className: selected ? PlanReview_module_css_default.selected : void 0,
											children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
												type: "button",
												className: PlanReview_module_css_default.gutter,
												disabled: busy,
												"aria-label": `${lineNumber}`,
												onClick: () => {
													if (anchor === null || focus !== null && anchor !== focus) {
														setAnchor(lineNumber);
														setFocus(lineNumber);
														return;
													}
													setFocus(lineNumber);
												},
												children: lineNumber
											}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("pre", {
												className: PlanReview_module_css_default.line,
												children: line.length === 0 ? " " : line
											})]
										}, lineNumber);
									})
								}),
								comments.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ol", {
									className: PlanReview_module_css_default.comments,
									children: comments.map((comment) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", { children: [
										"@",
										`plan.md:${comment.lineStart}`,
										comment.lineEnd - comment.lineStart > 1 ? `-${comment.lineEnd - 1}` : "",
										" ",
										comment.text
									] }, comment.id))
								})
							]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: PlanReview_module_css_default.composer,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
								className: PlanReview_module_css_default.label,
								children: [t("review.comment"), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: PlanReview_module_css_default.row,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
										className: PlanReview_module_css_default.input,
										value: commentText,
										placeholder: t("review.comment.placeholder"),
										disabled: busy || selection === null,
										onChange: (event) => {
											setCommentText(event.target.value);
										}
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
										variant: "outline",
										disabled: busy || selection === null || commentText.trim() === "",
										onClick: addComment,
										children: t("review.addComment")
									})]
								})]
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
								className: PlanReview_module_css_default.label,
								children: [t("review.notes"), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
									className: PlanReview_module_css_default.notes,
									value: notes,
									placeholder: t("review.notes.placeholder"),
									disabled: busy,
									onChange: (event) => {
										setNotes(event.target.value);
									}
								})]
							})]
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
										disabled: busy,
										onClick: () => {
											send(QUIT_LABEL);
										},
										children: t("review.quit")
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
										variant: "outline",
										disabled: busy,
										onClick: () => {
											send(REQUEST_CHANGES_LABEL, formatFeedback({
												comments,
												planContent: hasPlan ? plan : void 0,
												source: "file_backed",
												freeform: notes
											}));
										},
										children: t("review.changes")
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
										variant: "primary",
										disabled: busy,
										onClick: () => {
											send(APPROVE_LABEL);
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
			"review.empty": "还没有写计划 — 批准或要求修改",
			"review.waiting": "等待计划审批",
			"review.approve": "批准",
			"review.changes": "要求修改",
			"review.quit": "放弃",
			"review.comment": "给选中行写批注",
			"review.notes": "给模型的说明",
			"review.notes.placeholder": "希望怎么改？",
			"review.comment.placeholder": "对选中行的批注",
			"review.addComment": "添加批注",
			"review.lines": "点选行号来批注",
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
			"review.empty": "No plan written — approve or request changes",
			"review.waiting": "Waiting on plan approval",
			"review.approve": "Approve",
			"review.changes": "Request changes",
			"review.quit": "Quit",
			"review.comment": "Comment on selection",
			"review.notes": "Notes for the agent",
			"review.notes.placeholder": "What should change?",
			"review.comment.placeholder": "Comment on the selected lines",
			"review.addComment": "Add comment",
			"review.lines": "Click line numbers to comment",
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