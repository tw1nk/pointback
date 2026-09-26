import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pointback from "../dist/index.js";
import { startDaemon, projectId, projectToken } from "@pointback/daemon";

test("Pi extension receives submitted reviews and acknowledges them", async () => {
  const dir = mkdtempSync(join(tmpdir(), "pointback-pi-"));
  const previous = { port: process.env.POINTBACK_PORT, data: process.env.POINTBACK_DATA_DIR };
  process.env.POINTBACK_DATA_DIR = dir;
  const daemon = startDaemon({ port: 0, dataDir: dir });
  await new Promise<void>((resolve) => daemon.server.once("listening", resolve));
  const address = daemon.server.address();
  if (!address || typeof address === "string") throw new Error("No port");
  process.env.POINTBACK_PORT = String(address.port);
  const project = projectId(dir);
  const callbacks = new Map<string, (...args: unknown[]) => void>();
  let received = "";
  const pi = {
    on: (event: string, callback: (...args: unknown[]) => void) => callbacks.set(event, callback),
    registerTool: () => {},
    registerCommand: () => {},
    sendUserMessage: (text: string) => { received = text; },
  };
  try {
    pointback(pi as never);
    callbacks.get("session_start")?.(null, { cwd: dir, sessionManager: { getSessionId: () => "pi-test-session" } });
    const base = `http://127.0.0.1:${address.port}`;
    const req = (path: string, body: unknown) => fetch(base + path, {
      method: "POST", headers: { "content-type": "application/json", "x-pointback-project": project, "x-pointback-token": projectToken(project, dir) }, body: JSON.stringify(body),
    });
    const session = await (await req("/sessions", {})).json() as { id: string };
    await req(`/sessions/${session.id}/submit`, [{ url: "http://localhost:5173/", message: "Align save button", target: { type: "page" }, viewport: { width: 800, height: 600 } }]);
    const deadline = Date.now() + 3000;
    while (!received && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 20));
    assert.match(received, /Align save button/);
  } finally {
    callbacks.get("session_shutdown")?.();
    await daemon.close();
    rmSync(dir, { recursive: true, force: true });
    if (previous.port === undefined) delete process.env.POINTBACK_PORT; else process.env.POINTBACK_PORT = previous.port;
    if (previous.data === undefined) delete process.env.POINTBACK_DATA_DIR; else process.env.POINTBACK_DATA_DIR = previous.data;
  }
});
