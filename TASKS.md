# Pointback task backlog

Derived from [PLAN.md](PLAN.md). Work top to bottom within each milestone. Check a task only when its acceptance criteria are met. **MVP = milestones 0–3**; native push delivery and source mapping come later.

## Milestone 0 — Foundations

- [x] **0.1 Scaffold monorepo.** Create workspace packages for `protocol`, `browser`, `vite`, `daemon`, `mcp`, and `cli`, plus a minimal Vite example. Add build, typecheck, and test commands. Done when the example installs and all packages build from a clean checkout.
- [x] **0.2 Define shared model and wire protocol.** Specify project IDs, review sessions, element/region/page targets, comments, screenshots, statuses, and events (`session.created`, `review.submitted`, `comment.acknowledged`, `comment.resolved`, `comment.reopened`). Validate HTTP/WS payloads at runtime. Done when browser, daemon, and MCP share the same types and serialization tests pass.
- [x] **0.3 Decide local pairing and security contract.** Define canonical project-root hashing, per-project token issuance/hand-off to the Vite plugin, allowed origins, and localhost-only binding. Document endpoint and token handling. Done when unrelated projects and unauthorized origins cannot access each other's reviews.

## Milestone 1 — Browser proof of concept

- [x] **1.1 Build dev-only Vite injection.** Inject `@pointback/browser` into the running app in development, never production. Done when the example app shows the overlay in dev and production output contains no Pointback code.
- [x] **1.2 Build review-mode shell.** Toggle via Cmd/Ctrl+Shift+R; show annotation controls, draft count, and Send to Agent. Keep normal app interaction intact when off. Done when toggle and overlay work across navigation and HMR.
- [x] **1.3 Implement element picker.** Highlight on hover, select on click, and collect rect, text, tag, role, accessible label, URL, viewport, ancestors, and a short sanitized HTML fragment. Choose selector by `data-pointback-id` → `data-testid` → `id` → role/text → CSS fallback. Done when a selection survives ordinary rerenders where a stable identifier exists.
- [x] **1.4 Implement region and page targets.** Drag to select a viewport rectangle or comment on the current route without a target. Done when each mode yields a valid protocol target.
- [x] **1.5 Implement comment editor and draft batch.** Add/edit/delete drafts locally; submit only on Send to Agent, not per keystroke or comment. Done when multiple comments produce one submitted review event.
- [x] **1.6 Capture screenshots safely.** Store original viewport capture and target coordinates separately; support full image and cropped target retrieval. Redact `[data-pointback-private]` areas, hidden content, input values, passwords, and overlay UI. Done when privacy fixtures show no sensitive pixels or DOM data in saved artifacts.
- [x] **1.7 Connect overlay to daemon.** Create/load project session, upload drafts and screenshots over authenticated localhost HTTP, and show submission/errors without losing drafts. Done when a running example sends a review that survives a page refresh.

## Milestone 2 — Local daemon

- [x] **2.1 Implement `pointback start`.** Start HTTP + WS on `127.0.0.1`, configure port/data directory, handle shutdown and port conflicts. Done when CLI starts and stops cleanly with actionable errors.
- [x] **2.2 Implement SQLite persistence.** Store projects, sessions, comments, statuses, and screenshot metadata; keep screenshot files on disk. Add schema migrations. Done when data persists across daemon restarts.
- [x] **2.3 Implement review HTTP API.** Create/read sessions and comments, submit a batch atomically, retrieve images/crops, and update comment status with validation and authorization. Done when API tests cover success, malformed payloads, and cross-project access.
- [x] **2.4 Publish WS events.** Emit session, submission, acknowledgement, resolution, and reopening events to authorized project clients; reconnect without duplicating submissions. Done when two clients observe the same persisted state after reconnect.
- [x] **2.5 Add integration tests.** Exercise Vite example → overlay → daemon → persisted review, including project isolation and redaction. Done when the full path runs in CI without an agent.

## Milestone 3 — Agent-accessible MVP

- [x] **3.1 Build generic MCP server.** Expose `pointback_get_pending`, `pointback_get_comment`, `pointback_get_screenshot`, and `pointback_resolve_comment`; add session/comment listing if needed for navigation. Done when an MCP client can fetch one submitted batch, inspect its image/context, and resolve a comment.
- [x] **3.2 Define pending/acknowledgement semantics.** Submitted reviews remain retrievable until acknowledged; acknowledgement does not resolve comments. Done when polling never loses a review and repeated reads do not create duplicates.
- [x] **3.3 Write portable agent skill.** Add `skills/pointback/SKILL.md` with setup, retrieval, screenshot/context inspection, implementation, and resolve-after-fix guidance. Done when an MCP-capable agent can follow the workflow without a native adapter.
- [x] **3.4 Document and validate MVP setup.** Provide install/configure/start instructions and a React Vite example. Done when a fresh checkout can run the app, annotate an element, send a batch, retrieve it through MCP, fix UI, and resolve it.

## Milestone 4 — First native agent integration

- [x] **4.1 Specify adapter contract.** Define detection, project/session registration, capabilities (`polling`, `liveDelivery`), review delivery, and lifecycle handling. Keep agent details out of browser and core protocol.
- [x] **4.2 Implement one adapter (Pi *or* Codex).** Register an active coding session by project root and push a submitted review with routes, targets, comments, and links to screenshots. Done when Send to Agent reaches the active session without manual polling.
- [x] **4.3 Show delivery state.** Surface sent, received, addressing, and per-comment status in overlay; handle disconnected agent with a clear MCP fallback. Done when the UI never claims delivery without acknowledgement.

## Milestone 5 — Re-review and source mapping

- [x] **5.1 Add developer verification.** Show faded resolved markers and allow Accept resolution or Reopen with a follow-up comment. Done when reopened work returns to pending feedback without losing history.
- [x] **5.2 Capture optional Git context.** Record branch, HEAD, and dirty state at session creation; optionally associate a resolving commit. Done when reviews still work outside Git repositories.
- [x] **5.3 Prototype dev-only source mapping.** Resolve DOM target to component/file/line via a Vite transform or framework-specific instrumentation. Done when mapped elements include correct source positions and production builds omit metadata.

## Milestone 6 — Full review loop and expansion

- [x] **6.1 Add `pointback_request_review`.** An agent requests review; the browser announces it; developer feedback returns through the existing submission channel. Done when agent → developer → agent works across one re-review cycle.
- [ ] **6.2 Add further native adapters one at a time.** Implement and test Codex, Pi, Claude Code, OpenCode, or Cursor using the same adapter contract; do not change the core review model for individual harnesses.
- [ ] **6.3 Add richer visual tools only after workflow validation.** Evaluate arrows, drawing, spacing/alignment guides, viewport presets, and before/after comparison against real user needs.
- [x] **6.4 Simplify onboarding.** Explore `pointback init` and `pointback dev` after manual installation is reliable.

## Explicitly out of scope for MVP

Cloud accounts, team workspaces, hosted review pages, deployment, PR review, application proxying, browser automation, video recording, and advanced image editing.
