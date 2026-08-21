window.__ModuleLoader__.load({
	id: "dsh-grok-plan-mode",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		let react_jsx_runtime = require("react/jsx-runtime");
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
		//#region \0dshx-css-module:/tmp/dsh-grok-plan-mode/src/client/PlanReview.module.css.mjs
		const css = ".N147tq_frame{padding:6px calc(var(--dsh-composer-side-clearance) + 16px) 10px;justify-content:center;display:flex}.N147tq_card{width:100%;max-width:var(--dsh-chat-content-width);border:1px solid var(--dsw-alias-state-warn-secondary);background:var(--dsw-specific-input-major);max-height:min(70vh,640px);box-shadow:var(--dsw-shadow-lv2);color:var(--dsw-alias-label-primary);border-radius:20px;flex-direction:column;display:flex;overflow:hidden}.N147tq_strip{background:var(--dsw-alias-state-warn-tertiary);color:var(--dsw-alias-state-warn-primary);flex-shrink:0;align-items:center;gap:8px;padding:10px 16px;font-size:13px;line-height:18px;display:flex}.N147tq_dot{background:var(--dsw-alias-state-warn-primary);border-radius:50%;width:8px;height:8px}.N147tq_body{flex:auto;min-height:0;padding:12px 16px 4px;font-size:14px;line-height:22px;overflow-y:auto}.N147tq_lines{user-select:text}.N147tq_comments{color:var(--dsw-alias-label-secondary);margin:12px 0 0;padding-left:18px;font-size:12px}.N147tq_composer{flex-direction:column;gap:8px;padding:8px 16px;display:flex}.N147tq_label{color:var(--dsw-alias-label-secondary);flex-direction:column;gap:4px;font-size:12px;display:flex}.N147tq_row{gap:8px;display:flex}.N147tq_input,.N147tq_notes{border:1px solid var(--dsw-alias-border-secondary,transparent);width:100%;color:inherit;background:0 0;border-radius:8px;padding:6px 8px}.N147tq_notes{resize:vertical;min-height:56px}.N147tq_footer{justify-content:space-between;align-items:center;gap:12px;padding:8px 16px 12px;display:flex}.N147tq_feedback{min-height:16px;color:var(--dsw-alias-state-error-primary);font-size:11px}.N147tq_actions{align-items:center;gap:8px;display:flex}";
		const tagId = "dsh-grok-plan-mode/PlanReview.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-grok-plan-mode";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var PlanReview_module_css_default = {
			"actions": "N147tq_actions",
			"body": "N147tq_body",
			"card": "N147tq_card",
			"comments": "N147tq_comments",
			"composer": "N147tq_composer",
			"dot": "N147tq_dot",
			"feedback": "N147tq_feedback",
			"footer": "N147tq_footer",
			"frame": "N147tq_frame",
			"input": "N147tq_input",
			"label": "N147tq_label",
			"lines": "N147tq_lines",
			"notes": "N147tq_notes",
			"row": "N147tq_row",
			"strip": "N147tq_strip"
		};
		//#endregion
		//#region src/client/PlanReview.tsx
		function PlanReview({ matched, t }) {
			const question = matched.payload.questions[0];
			const raw = question?.detail ?? "";
			const hasPlan = raw.trim() !== "" && raw !== EMPTY_PLAN_PLACEHOLDER;
			const plan = hasPlan ? raw : EMPTY_PLAN_PLACEHOLDER;
			const lines = plan.split("\n");
			const [busy, setBusy] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)(null);
			const [notes, setNotes] = (0, react.useState)("");
			const [commentText, setCommentText] = (0, react.useState)("");
			const [selection, setSelection] = (0, react.useState)(null);
			const [comments, setComments] = (0, react.useState)([]);
			const [nextId, setNextId] = (0, react.useState)(0);
			const pending = (0, react.useMemo)(() => matched, [matched]);
			const send = (label, custom) => {
				setBusy(true);
				setError(null);
				pending.respond({
					ok: true,
					value: {
						sessionId: pending.sessionId,
						answer: { answers: [{
							id: REVIEW_QUESTION_ID,
							selected: [label],
							...custom !== void 0 && custom.trim() !== "" ? { custom } : {}
						}] }
					}
				}).then((receipt) => {
					if (!receipt.accepted) {
						setBusy(false);
						setError(receipt.reason ?? "review response rejected");
					}
				}, (cause) => {
					setBusy(false);
					setError(cause instanceof Error ? cause.message : String(cause));
				});
			};
			const addComment = () => {
				if (selection === null || commentText.trim() === "") return;
				const start = Math.min(selection.start, selection.end);
				const end = Math.max(selection.start, selection.end) + 1;
				setComments((current) => [...current, {
					id: nextId,
					lineStart: start,
					lineEnd: end,
					text: commentText.trim()
				}]);
				setNextId((id) => id + 1);
				setCommentText("");
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: PlanReview_module_css_default.frame,
				"data-grok-plan-review": pending.key,
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
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: PlanReview_module_css_default.lines,
								onMouseUp: () => {
									const picked = window.getSelection();
									if (picked === null || picked.rangeCount === 0) return;
									if (picked.toString().trim() === "") return;
									const start = lineIndex(lines, picked.anchorOffset, plan);
									const end = lineIndex(lines, picked.focusOffset, plan);
									if (start === void 0 || end === void 0) return;
									setSelection({
										start: Math.min(start, end),
										end: Math.max(start, end)
									});
								},
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.MarkdownText, { text: plan })
							}), comments.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ol", {
								className: PlanReview_module_css_default.comments,
								children: comments.map((comment) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", { children: [
									"@",
									`plan.md:${comment.lineStart}`,
									comment.lineEnd - comment.lineStart > 1 ? `-${comment.lineEnd - 1}` : "",
									" ",
									comment.text
								] }, comment.id))
							})]
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
												freeform: notes
											}));
										},
										children: t("review.changes")
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
										variant: "primary",
										disabled: busy,
										onClick: () => {
											const extra = formatFeedback({
												comments,
												planContent: hasPlan ? plan : void 0,
												freeform: notes
											});
											send(APPROVE_LABEL, extra === "" ? void 0 : extra);
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
		function lineIndex(lines, offset, source) {
			if (offset < 0 || offset > source.length) return void 0;
			let seen = 0;
			for (let index = 0; index < lines.length; index += 1) {
				const line = lines[index] ?? "";
				const next = seen + line.length + (index < lines.length - 1 ? 1 : 0);
				if (offset <= next) return index + 1;
				seen = next;
			}
			return lines.length;
		}
		//#endregion
		//#region src/client/locales.ts
		const en = {
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
			"review.addComment": "Add comment"
		};
		const zh = {
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
			"review.addComment": "添加批注"
		};
		//#endregion
		//#region src/client/index.tsx
		const NS = "grok-plan";
		const name = "grok-plan-mode-ui";
		const inject = ["slots", "locale"];
		function selectReview({ interactions }) {
			const wait = interactions.find((item) => {
				return item !== null && typeof item === "object" && "kind" in item && item.kind === "question";
			});
			if (wait === void 0) return null;
			if (wait.payload.questions.length !== 1) return null;
			if (wait.payload.questions[0]?.id !== "grok-plan-review") return null;
			return wait;
		}
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "grok-plan-mode: dictionaries");
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