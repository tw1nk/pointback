# Pointback

**Review a live UI and send contextual feedback to your coding agent.** Select an element, draw a region, or comment on the whole page; Pointback attaches the target and a screenshot so the agent can find and fix the issue.

> **Early prototype.** Vite integration and live delivery to Pi are available. Other agents can use MCP polling; native adapters for them and robust cross-browser screenshot validation are not yet implemented. Pull requests are welcome

## Quick start

Pointback currently runs from this repository rather than a published package. Install Node.js 24 and npm, clone the repo, then build it:

```sh
npm install
npm run build
```

### 1. Add Pointback to your Vite app

In your app's `vite.config.ts`, import the plugin and add it to `plugins`:

```ts
import { defineConfig } from "vite";
import pointback from "@pointback/vite";

export default defineConfig({ plugins: [pointback()] });
```

If you already have plugins, keep them: `plugins: [react(), pointback()]`, for example. The plugin only runs during Vite development and injects the Pointback UI automatically—no component or HTML element needs to be added manually. For a separate app, `@pointback/vite` must be available to its Vite process (for example, as a local dependency pointing to this repository's `packages/vite`). The included examples are already configured.

### 2. Start Pointback and the app

For an included example, start the daemon in one terminal:

```sh
node packages/cli/dist/index.js start
```

Then start an example in another:

```sh
npm run dev -w @pointback/example-react
# or: npm run dev -w @pointback/example-vanilla
```

For your own Vite project, run both together **from your app's root** instead:

```sh
node /absolute/path/to/pointback/packages/cli/dist/index.js dev -- npm run dev
```

### 3. Connect Pi

Start Pi **from the same Vite project root**, with Pointback's built extension loaded:

```sh
cd /path/to/your-vite-app
pi -e /absolute/path/to/pointback/packages/adapters/pi
```

For an included example, use `examples/react-vite` or `examples/vanilla-vite` as the working directory. Keep Pi running while you review: the extension connects on session startup, pushes submitted reviews as follow-up messages, and gives Pi tools to inspect screenshots and resolve comments. If Pi was already open, restart it with the extension. The Vite server and Pi must use the same project root to pair correctly.

### 4. Select an element and send feedback

1. Open the Vite URL in your browser. Click the **Pointback launcher** in the bottom-right corner, or press **Cmd/Ctrl+Shift+R**.
2. Choose **Element**, then click the UI element you want changed. Alternatively, select a **Region** or the entire **Page**.
3. Write what should change and click **Send comment** (or press **Cmd/Ctrl+Enter**). To send multiple comments as one review, **Queue comment** for each and then click **Send queued**.
4. Pi receives the review, can inspect its screenshot and target, make changes, and resolve the comment. Check the live page to verify the fix.

The popup's **?** button explains its controls. You can drag its header out of the way; double-click to reset its position. Click a marker to find its task, or click a task to locate its marker on the page. Drafts and queued comments survive reloads in the current tab.

## Other agents: MCP polling

If you are not using Pi, configure your MCP client to launch `node` with the argument `/absolute/path/to/pointback/packages/mcp/dist/index.js`. Set its working directory to the Vite app's root, or set `POINTBACK_PROJECT_ROOT` to that directory. The MCP tools let an agent list pending comments, retrieve screenshots, and acknowledge, resolve, or reopen comments. Without the Pi extension, agents must poll for new feedback.

## Configuration and limitations

- `POINTBACK_PORT` changes the default daemon port (`47832`); set it consistently for the daemon, Vite app, and agent.
- `POINTBACK_DATA_DIR` changes the data directory. Comments and screenshots are stored locally in SQLite under `~/.local/share/pointback/` by default.
- The daemon binds to `127.0.0.1` and uses per-project tokens derived from a local secret. **Do not expose your development server to untrusted users.** Avoid putting secrets in feedback.
- Screenshot capture renders the DOM and can fail with unsupported or cross-origin resources. Failed captures leave drafts unsent.

## Development

```sh
npm run typecheck
npm test
npm run build
```

See [TASKS.md](TASKS.md) for outstanding work, [PLAN.md](PLAN.md) for product direction, and [docs/agent-adapters.md](docs/agent-adapters.md) for the agent transport design.
