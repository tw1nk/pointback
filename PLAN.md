# Pointback

**Live UI review feedback for coding agents.**

Pointback is a local-first development tool for reviewing UI work performed by coding agents directly inside the running application.

The core loop is:

```text
Agent changes code
      ↓
Vite HMR updates the real application
      ↓
Developer opens Pointback review mode
      ↓
Developer clicks/boxes UI elements and adds comments
      ↓
Screenshots + DOM/component context are captured
      ↓
Feedback automatically reaches the active coding agent
      ↓
Agent fixes issues
      ↓
Developer sees changes immediately through HMR
```

The key distinction from an artifact-review system is that Pointback reviews the **actual running application**, including its backend, authentication, routing, state, API requests, WebSockets, responsive behavior, and other runtime behavior.

---

# 1. Product architecture

Pointback consists of four major layers:

```text
┌───────────────────────────────────────────────┐
│ Running application                           │
│                                               │
│ Go backend              Vite frontend         │
│                              │                │
│                       Pointback Overlay        │
└──────────────────────────────┼────────────────┘
                               │
                         localhost WS/HTTP
                               │
                               ▼
┌───────────────────────────────────────────────┐
│ Pointback Daemon                              │
│                                               │
│ sessions                                      │
│ comments                                      │
│ screenshots                                   │
│ DOM metadata                                  │
│ review state                                  │
│ agent connections                             │
└───────────────────┬───────────────────────────┘
                    │
          ┌─────────┼──────────┐
          │         │          │
          ▼         ▼          ▼
        Codex       Pi      Claude/OpenCode/etc.
        adapter   adapter        adapter
```

The **Pointback Daemon** should be the central abstraction.

Neither the browser overlay nor the agent-specific integrations should need to know much about each other.

---

# 2. Project identity

Use **Pointback** consistently as the user-facing name.

Suggested repository:

```text
pointback
```

Suggested CLI:

```bash
pointback
```

Suggested packages:

```text
@pointback/browser
@pointback/vite
@pointback/protocol
@pointback/mcp
@pointback/daemon
```

If the npm scope is unavailable:

```text
@pointback-dev/*
```

or:

```text
@usepointback/*
```

Suggested tagline:

> Live UI review feedback for coding agents.

A shorter alternative:

> Point at it. Send it back.

---

# 3. Browser overlay

Build a browser package:

```text
@pointback/browser
```

Direct usage:

```ts
import "@pointback/browser";
```

For Vite, provide:

```text
@pointback/vite
```

Example:

```ts
import { defineConfig } from "vite";
import pointback from "@pointback/vite";

export default defineConfig({
  plugins: [
    pointback()
  ]
});
```

The plugin should inject Pointback automatically during development.

Production builds should omit it.

---

# 4. Review mode

Normal mode:

```text
application behaves normally
```

Pointback mode:

```text
┌──────────────────────────────┐
│ Pointback                     │
│                               │
│ [Select element]              │
│ [Draw region]                 │
│ [Comment on page]             │
│                               │
│ 3 review comments             │
│                               │
│ [Send to agent]               │
└──────────────────────────────┘
```

A keyboard shortcut should toggle Pointback:

```text
Cmd/Ctrl + Shift + R
```

The exact shortcut can be configurable later.

---

# 5. Annotation modes

Support three annotation types initially.

## Element annotation

Hovering highlights DOM elements similarly to browser DevTools.

Click an element:

```text
┌─────────────────────────────┐
│ Save button                 │
│                             │
│ "Needs more spacing above"  │
│                             │
│ [Add comment]               │
└─────────────────────────────┘
```

Capture structured information:

```json
{
  "type": "element",
  "selector": "[data-pointback-id='profile-save']",
  "tag": "button",
  "text": "Save",
  "rect": {
    "x": 812,
    "y": 621,
    "width": 120,
    "height": 40
  }
}
```

## Region annotation

Allow the user to draw a rectangle over part of the viewport.

Useful for feedback such as:

```text
"These three cards should align."
```

No particular DOM element needs to be selected.

## Page annotation

Allow general feedback tied to the route:

```text
"The visual hierarchy on this page feels too flat."
```

---

# 6. Screenshot capture

Each annotation should be able to capture a screenshot.

Prefer storing:

```text
original screenshot
+
annotation coordinates
```

rather than permanently drawing arrows or rectangles onto the screenshot.

Example:

```json
{
  "screenshot": "screenshots/01J....webp",
  "rect": {
    "x": 410,
    "y": 220,
    "width": 380,
    "height": 160
  }
}
```

The agent can receive:

```text
full screenshot
cropped target screenshot
structured coordinates
```

This keeps screenshots useful to humans and multimodal agents.

---

# 7. DOM context

Pointback should send more than screenshots.

For an element annotation:

```json
{
  "url": "http://localhost:5173/settings/profile",
  "route": "/settings/profile",

  "viewport": {
    "width": 1440,
    "height": 900
  },

  "element": {
    "tag": "button",
    "text": "Save",
    "role": "button",
    "ariaLabel": null,
    "selector": "[data-pointback-id='profile-save']"
  },

  "ancestors": [
    {
      "tag": "form",
      "id": "profile-form"
    },
    {
      "tag": "section",
      "dataComponent": "ProfileSettings"
    }
  ]
}
```

Also capture a small sanitized HTML fragment:

```html
<form data-component="ProfileSettings">
  ...
  <button data-pointback-id="profile-save">
    Save
  </button>
</form>
```

Avoid sending the entire DOM.

---

# 8. Stable Pointback identifiers

Introduce an optional convention:

```tsx
<Button data-pointback-id="profile-save">
  Save
</Button>
```

This gives Pointback a stable target across re-renders and code changes.

Automatically generated selectors such as:

```css
main > div:nth-child(2) > div:nth-child(4) > button
```

are too fragile.

Suggested target priority:

```text
data-pointback-id
↓
data-testid
↓
id
↓
accessible role + text
↓
generated CSS selector
```

Pointback IDs should remain optional.

The tool should still work without them.

---

# 9. Source-code mapping

This should come after the basic product works, but could become one of Pointback's strongest features.

An annotation could eventually resolve to:

```json
{
  "component": "ProfileSaveButton",
  "source": "src/components/profile/ProfileSaveButton.tsx",
  "line": 37,
  "column": 5
}
```

One possible approach is a Vite/compiler transform.

During development:

```tsx
<Button />
```

could conceptually become:

```tsx
<Button
  data-pointback-source="src/Profile.tsx:82"
/>
```

These attributes disappear from production builds.

Then agent feedback becomes extremely actionable:

```text
Pointback comment

src/Profile.tsx:82

"The primary action should align to the right."
```

---

# 10. Pointback daemon

Create a local daemon managed through the CLI:

```bash
pointback start
```

It could bind to something like:

```text
http://127.0.0.1:47832
ws://127.0.0.1:47832
```

The browser overlay connects automatically.

The daemon owns:

```text
projects
review sessions
comments
screenshots
agent registrations
review status
WebSocket events
```

Suggested storage:

```text
~/.local/share/pointback/
    projects/
      <project-id>/
        sessions/
        screenshots/
        comments/
```

SQLite is appropriate for metadata.

Screenshots can remain ordinary files.

---

# 11. Core data model

Keep the initial model small.

```ts
interface ReviewSession {
  id: string;
  projectId: string;
  createdAt: string;

  status:
    | "active"
    | "submitted"
    | "resolved";

  git?: {
    branch?: string;
    commit?: string;
  };
}

interface ReviewComment {
  id: string;
  sessionId: string;

  url: string;
  message: string;

  target:
    | ElementTarget
    | RegionTarget
    | PageTarget;

  screenshotId?: string;

  status:
    | "open"
    | "acknowledged"
    | "resolved";

  createdAt: string;
}
```

---

# 12. Review submission

Do not send every comment to the coding agent immediately.

Use a batch.

Workflow:

```text
Start Pointback Review

Add comment
Add comment
Add comment

Send to Agent (3)
```

The coding agent receives one coherent review batch.

This avoids interrupting the agent while the developer is still reviewing.

Realtime delivery can be added later as an option.

---

# 13. Agent integration model

Pointback should have an adapter architecture.

```text
Pointback daemon
       │
       ├── Codex adapter
       ├── Pi adapter
       ├── Claude Code adapter
       ├── OpenCode adapter
       ├── Cursor adapter
       └── Generic MCP adapter
```

Internal interface:

```ts
interface AgentAdapter {
  detect(): Promise<boolean>;

  sendReview(
    session: ReviewSession,
    comments: ReviewComment[]
  ): Promise<void>;
}
```

The review system should otherwise remain agent-independent.

---

# 14. Generic MCP integration

MCP should be Pointback's universal baseline integration.

Expose tools such as:

```text
pointback_list_sessions
pointback_get_session
pointback_get_comments
pointback_get_comment
pointback_get_screenshot
pointback_resolve_comment
pointback_get_pending
```

Possibly:

```text
pointback_wait_for_feedback
```

For example:

```json
{
  "session_id": "rev_123"
}
```

The agent can wait for or retrieve newly submitted feedback.

Agents without live event delivery can poll:

```text
pointback_get_pending
```

---

# 15. Live delivery

MCP alone should not define the ideal Pointback experience.

Avoid:

```text
Developer:
"I submitted feedback."

Agent:
"Let me check Pointback."
```

Prefer:

```text
Developer presses Send to Agent
        ↓
active coding session receives Pointback review
        ↓
agent resumes automatically
```

Adapters should therefore advertise capabilities:

```ts
interface AgentCapabilities {
  polling: boolean;
  liveDelivery: boolean;
}
```

Agents supporting hooks/session APIs can receive push delivery.

Other agents fall back to MCP.

---

# 16. Pi integration

Pi should be a strong candidate for the first native integration.

Installation could eventually resemble:

```bash
pi install pointback
```

or whatever mechanism fits Pi's extension model.

When Pi starts inside a repository:

```text
Pi Pointback extension
        ↓
connects to pointback daemon
        ↓
registers current working directory
        ↓
registers active agent session
```

When the developer clicks:

```text
Send to Agent
```

the daemon knows:

```text
project → active Pi session
```

The agent receives something like:

```text
POINTBACK REVIEW

Route: /settings/profile

2 comments were submitted.

1. Target: profile-save
   "Move this below the form and align it right."

2. Region: x=212 y=410 w=700 h=180
   "These fields feel too spread out vertically."

Use Pointback tools to inspect screenshots and metadata.

Address each comment and mark it resolved after implementing the change.
```

---

# 17. Codex integration

Codex should use the same conceptual model.

Potential setup:

```bash
pointback connect codex
```

The command configures the appropriate hooks or integration.

The central model should remain:

```text
session registration
+
Pointback daemon
+
review events
```

Agent-specific hooks are transports, not the product architecture.

---

# 18. Portable Pointback agent skill

Ship a portable agent skill:

```text
skills/pointback/SKILL.md
```

Its instructions could say:

```text
When Pointback is available:

1. Connect to the project's active Pointback session.
2. Keep the application's development server running while doing UI work.
3. When Pointback feedback arrives, inspect every unresolved comment.
4. Use screenshots, DOM metadata, route information, and source metadata to locate the issue.
5. Make the requested changes.
6. Mark comments resolved only after implementing them.
7. Do not create a separate preview unless explicitly requested.
```

This gives Pointback a portable integration path even where native hooks are unavailable.

---

# 19. Project detection

Pointback should pair browser and agent automatically based on project root.

Example:

```text
/home/me/code/acme
```

becomes:

```text
project_82f2...
```

The Vite plugin knows:

```ts
process.cwd()
```

The coding agent integration also knows its working directory.

Therefore:

```text
browser
   ↓
project_82f2

agent
   ↓
project_82f2
```

The common case requires no manual pairing.

---

# 20. Agent acknowledgement

After review submission:

```text
3 comments sent to Codex
```

When received:

```text
✓ Agent received review
```

While being addressed:

```text
● Agent addressing 3 comments
```

As work progresses:

```text
✓ #1 Button alignment
✓ #2 Form spacing
● #3 Mobile overflow
```

The Pointback overlay therefore doubles as lightweight agent-status UI.

---

# 21. Re-review workflow

After changes:

```text
Agent resolves Pointback comments
        ↓
Vite HMR updates the running application
        ↓
resolved markers remain visible but faded
        ↓
developer verifies them
```

The developer can:

```text
Accept resolution
```

or:

```text
Reopen
```

Example:

```text
"This still wraps incorrectly at tablet width."
```

This creates an actual iterative review process instead of one-way chat messages.

---

# 22. Agent-requested review

A later version should let the coding agent ask for review.

For example:

```text
Agent:
"I've completed the dashboard changes."

        ↓

pointback_request_review()

        ↓

browser shows:

"Codex requested review"
```

Developer reviews the actual application.

Submitting the review wakes the agent again.

Ideal cycle:

```text
agent works
   ↓
requests Pointback review
   ↓
human reviews
   ↓
feedback automatically returns
   ↓
agent fixes
   ↓
requests re-review
```

This is likely the long-term defining workflow.

---

# 23. Git integration

Capture Git state when a review session starts:

```json
{
  "branch": "feature/profile",
  "head": "147bf97",
  "dirty": true
}
```

Optionally record which commit resolved a comment:

```text
resolvedByCommit: 926acc1
```

Then history can show:

```text
Pointback Review #42
3 comments
all resolved
commit 926acc1
```

Git should not be required for the MVP.

---

# 24. Privacy and security

The Pointback overlay runs inside the application, so data handling should be conservative.

Defaults:

```text
bind only to 127.0.0.1
require a per-project token
reject arbitrary cross-origin requests
sanitize captured DOM
never capture password values
avoid capturing normal input values
never expose cookies
never expose authorization headers
exclude hidden DOM
exclude Pointback's own UI from capture
```

Allow explicit private sections:

```html
<div data-pointback-private>
  customer financial details
</div>
```

Pointback should redact that area from screenshots:

```text
████████████████
```

and replace DOM metadata with:

```text
[REDACTED]
```

---

# 25. Repository structure

Suggested monorepo:

```text
pointback/
├── packages/
│   ├── protocol/
│   │   └── shared types
│   │
│   ├── browser/
│   │   └── Pointback overlay
│   │
│   ├── vite/
│   │   └── automatic injection
│   │
│   ├── daemon/
│   │   └── sessions + storage + WebSocket
│   │
│   ├── mcp/
│   │   └── MCP server
│   │
│   ├── cli/
│   │   └── pointback command
│   │
│   └── adapters/
│       ├── pi/
│       ├── codex/
│       ├── claude/
│       └── opencode/
│
├── skills/
│   └── pointback/
│       └── SKILL.md
│
└── examples/
    ├── react-vite/
    └── vanilla-vite/
```

---

# 26. Pointback protocol

Define the protocol before building multiple agent integrations.

For example:

```ts
type PointbackEvent =
  | {
      type: "session.created";
      session: ReviewSession;
    }
  | {
      type: "review.submitted";
      sessionId: string;
      commentIds: string[];
    }
  | {
      type: "comment.acknowledged";
      commentId: string;
    }
  | {
      type: "comment.resolved";
      commentId: string;
    }
  | {
      type: "comment.reopened";
      commentId: string;
    };
```

Use WebSockets for local events.

Use HTTP for larger resources such as screenshots.

---

# 27. MVP scope

The first version should remain small.

## Browser

Implement:

```text
✓ Vite-injected Pointback overlay
✓ element picker
✓ region picker
✓ page comments
✓ comment editor
✓ viewport screenshot
✓ current URL
✓ selector
✓ element text
✓ bounding rectangle
✓ Send to Agent button
```

## Daemon

Implement:

```text
✓ localhost server
✓ WebSocket
✓ sessions
✓ comments
✓ screenshots
✓ SQLite
✓ project association
```

## Agent

Implement:

```text
✓ generic MCP server
✓ pending review tool
✓ screenshot retrieval
✓ resolve comment tool
✓ portable Pointback skill
```

That is enough to validate the product.

---

# 28. MVP installation

Install:

```bash
npm install -D @pointback/vite
```

Configure Vite:

```ts
import pointback from "@pointback/vite";

export default defineConfig({
  plugins: [
    react(),
    pointback()
  ]
});
```

Configure an agent:

```bash
pointback connect codex
```

Run:

```bash
pointback start
bun dev
```

Then:

```text
1. Agent edits UI.
2. Vite updates browser.
3. Open Pointback.
4. Click UI.
5. Add comments.
6. Press Send to Agent.
7. Agent receives Pointback review.
8. Agent fixes code.
9. Vite updates browser.
10. Verify and accept/reopen comments.
```

---

# 29. Suggested implementation milestones

## Milestone 1 — Browser proof of concept

```text
Vite plugin
↓
inject Pointback
↓
select DOM element
↓
comment
↓
screenshot
↓
POST JSON to localhost
```

No agent integrations yet.

Validate whether reviewing a real running application feels good.

## Milestone 2 — Pointback daemon

```text
pointback start
↓
store review sessions
↓
review API
↓
WebSocket events
```

## Milestone 3 — MCP

Expose:

```text
pointback_get_pending
pointback_get_comment
pointback_get_screenshot
pointback_resolve_comment
```

At this point any MCP-capable coding agent can participate.

## Milestone 4 — First native integration

Choose one:

```text
Pi
or
Codex
```

Do not attempt five harness integrations at once.

## Milestone 5 — Source mapping

Add:

```text
DOM → component
DOM → source file
DOM → line number
```

## Milestone 6 — Agent-requested review

The agent can pause and ask the developer to review its latest changes.

## Milestone 7 — Additional integrations

```text
Pi
Codex
Claude Code
OpenCode
Cursor
others
```

---

# 30. Phase 2 — native delivery

After validating MCP:

```text
Pi adapter
Codex adapter
Claude Code adapter
OpenCode adapter
```

All implement the same internal Pointback adapter interface.

Agent integrations should never leak into the core review protocol.

---

# 31. Phase 3 — source mapping

Add development-only metadata:

```text
DOM
 ↓
framework component
 ↓
source file
 ↓
line/column
```

Then Pointback feedback can look like:

```text
POINTBACK COMMENT #17

File:
src/components/Settings/ProfileForm.tsx:118

Target:
<Button data-pointback-id="profile-save">

Comment:
"The primary action should align with the right side of the form."

Screenshot:
pointback://comment/17/screenshot
```

This could become one of Pointback's defining advantages over general screenshot annotation tools.

---

# 32. Phase 4 — full review loop

Add:

```text
pointback_request_review
```

The agent asks for review after completing UI changes.

Flow:

```text
agent changes UI
       ↓
Pointback review requested
       ↓
developer reviews running app
       ↓
developer sends feedback
       ↓
agent automatically resumes
       ↓
agent resolves comments
       ↓
developer verifies
```

This is the target user experience.

---

# 33. Phase 5 — richer visual annotation

Only after the workflow is proven, add:

```text
arrows
freehand drawing
text labels
spacing measurement
alignment guides
color picker
responsive viewport presets
before/after comparison
```

These should remain secondary to reliable feedback delivery.

---

# 34. What Pointback should not initially become

Avoid building:

```text
cloud accounts
team workspaces
hosted review pages
deployment infrastructure
artifact hosting
GitHub PR review
full browser automation
application proxying
video recording
complex image editing
```

Those expand the scope substantially.

The first product should solve one problem extremely well:

> I'm looking at what my coding agent just changed. I want to point at the wrong parts of the actual application, explain what should change, and send that feedback directly back to the same agent.

---

# 35. Core design principle

Keep three systems separate:

```text
Pointback Browser Protocol
          │
          ▼
    Pointback Daemon
          │
          ▼
Pointback Agent Protocol
```

The browser should not care whether the agent is:

```text
Codex
Pi
Claude
OpenCode
Cursor
something not created yet
```

The agent integration should not care whether a comment came from:

```text
DOM selection
rectangle annotation
page comment
future browser extension
future desktop client
```

Everything flows through the common Pointback review model.

---

# 36. Smallest compelling prototype

The first compelling version may require only:

```text
@pointback/vite
Pointback daemon
Pointback MCP server
```

Interaction:

```text
Developer clicks an element
        ↓
types:
"Make this less prominent."
        ↓
Send to Agent
        ↓
agent receives:

POINTBACK REVIEW

Route: /dashboard

Target:
[data-pointback-id="recent-orders"]

Comment:
Make this less prominent.

Screenshot:
<image>

        ↓
agent changes code
        ↓
Vite HMR updates browser
```

If that feels natural, native Pi/Codex hooks and source mapping are worth building.

---

# 37. Long-term developer experience

Eventually setup could be:

```bash
npx pointback init
```

Pointback detects:

```text
✓ Vite
✓ React
✓ Codex
```

and configures:

```text
✓ @pointback/vite
✓ Pointback daemon
✓ Codex integration
✓ Pointback agent skill
```

Then development could simply be:

```bash
pointback dev
```

Pointback starts its daemon alongside the project's normal development command.

The developer should not need to think about how review comments reach the agent.

---

# 38. Product language

Use terminology consistently.

Instead of:

```text
annotation server
feedback daemon
agent review transport
```

prefer:

```text
Pointback
Pointback Review
Pointback Comment
Pointback Session
Send to Agent
Request Review
Resolve
Reopen
```

This makes the workflow easier to explain.

A concise description of the project:

> Pointback adds Figma-style comments to your running development environment and sends them directly back to your coding agent.

Another:

> Point at your UI. Leave feedback. Send it back to the agent.

And the shortest:

> Point at it. Send it back.
