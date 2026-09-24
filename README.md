# Pointback (early prototype)

Live UI review feedback for coding agents. This repository is under active development; Pi push delivery is available as an early integration; other native adapters and robust cross-browser screenshot validation are not implemented yet.

## Try the local review flow

Prerequisites: [Devbox](https://www.jetify.com/devbox) and Node 24 (provided by Devbox).

```sh
devbox run -- npm install
devbox run -- npm run build
devbox run -- node packages/cli/dist/index.js start
# Alternatively, from a Vite project's root:
# devbox run -- node /absolute/path/to/pointback/packages/cli/dist/index.js dev -- npm run dev
```

In another terminal:

```sh
devbox run -- npm run dev -w @pointback/example-react
# or: devbox run -- npm run dev -w @pointback/example-vanilla
```

Open the Vite URL. Click the bottom-right Pointback launcher (or press Cmd/Ctrl+Shift+R), pick an element, region, or page, write a comment, and click **Send comment** (or press Cmd/Ctrl+Enter). To send several comments as one review, use **Queue comment** for each, then **Send queued**. The open menu, selection, editor text, and queued comments survive reloads in the current tab. The compact popup has icon-labeled controls with hover/focus tooltips and a **?** help dialog. Drag its header to move it away from the UI under review; double-click the header to reset it, or focus it and use arrow keys / Home. Position persists across reloads in the current tab. Markers and comments share the same number, and each task shows its target type. Element markers track the live element while scrolling, falling back to the captured position if it disappears; region markers move with page scroll. Click a marker to scroll its task into view in the popup; click a task to bring its off-screen marker into view on the page and highlight it. Click again to dismiss the highlight, or let it fade after three seconds. Use **Hide accepted** to declutter without hiding resolved comments, or **Delete** a resolved/accepted comment permanently (including its screenshot once no comments reference it). Comments are stored in SQLite under `~/.local/share/pointback/`. Configure an MCP client with executable `node`, arguments `[/absolute/path/to/pointback/packages/mcp/dist/index.js]`, and working directory set to `examples/react-vite` (or set `POINTBACK_PROJECT_ROOT` to the Vite project root). The MCP tools list pending comments, retrieve screenshots, and acknowledge/resolve/reopen comments. Screenshot capture uses DOM rendering and may fail on pages with unsupported or cross-origin resources; failed captures leave drafts unsent. Without the Pi extension, the agent must poll. For live Pi delivery, run `pi -e ./packages/adapters/pi` from the same Vite project root (using an absolute path to the adapter package if needed). The extension connects during Pi session startup, injects submitted reviews as follow-up messages, and exposes Pointback tools.

`POINTBACK_DATA_DIR` overrides storage; `POINTBACK_PORT` overrides the default `47832` for daemon, plugin, and MCP. Set both consistently in all processes. The daemon binds only to 127.0.0.1 and accepts per-project HMAC tokens derived from a local secret; the Vite development page receives its project's token. Do not expose your development server to untrusted users. No secrets or screenshots should be added to comments manually.

Checks: `devbox run -- npm run typecheck`, `devbox run -- npm test`, `devbox run -- npm run build`.

See [TASKS.md](TASKS.md) for outstanding work and [PLAN.md](PLAN.md) for product direction.
