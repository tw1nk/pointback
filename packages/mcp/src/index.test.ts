import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { startDaemon, projectId, projectToken } from "@pointback/daemon";

test("MCP client retrieves feedback and resolves comments", async () => {
  const dir = mkdtempSync(join(tmpdir(), "pointback-mcp-"));
  const daemon = startDaemon({ port: 0, dataDir: dir });
  const old = { data: process.env.POINTBACK_DATA_DIR, port: process.env.POINTBACK_PORT, root: process.env.POINTBACK_PROJECT_ROOT };
  await new Promise<void>((resolve) => daemon.server.once("listening", resolve));
  const address = daemon.server.address(); if (!address || typeof address === "string") throw new Error("No port");
  process.env.POINTBACK_DATA_DIR = dir; process.env.POINTBACK_PORT = String(address.port); process.env.POINTBACK_PROJECT_ROOT = dir;
  const project = projectId(dir);
  const server = (await import("../dist/index.js")).createPointbackMcpServer();
  const client = new Client({ name: "pointback-test", version: "1.0.0" });
  const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();
  try {
    await server.connect(serverTransport); await client.connect(clientTransport);
    const headers = { "content-type": "application/json", "x-pointback-project": project, "x-pointback-token": projectToken(project, dir) };
    const base = `http://127.0.0.1:${address.port}`;
    const session = await (await fetch(base + "/sessions", { method: "POST", headers, body: "{}" })).json() as { id: string };
    const comments = await (await fetch(base + `/sessions/${session.id}/submit`, { method: "POST", headers, body: JSON.stringify([{ url: "http://localhost:5173/", message: "Change heading", target: { type: "page" }, viewport: { width: 800, height: 600 } }]) })).json() as { id: string }[];
    const pending = await client.callTool({ name: "pointback_get_pending", arguments: {} });
    assert.match(JSON.stringify(pending), /Change heading/);
    await client.callTool({ name: "pointback_resolve_comment", arguments: { comment_id: comments[0].id } });
    const after = await client.callTool({ name: "pointback_get_pending", arguments: {} });
    assert.doesNotMatch(JSON.stringify(after), /Change heading/);
  } finally {
    await client.close(); await server.close(); await daemon.close(); rmSync(dir, { recursive: true, force: true });
    for (const [key, value] of Object.entries({ POINTBACK_DATA_DIR: old.data, POINTBACK_PORT: old.port, POINTBACK_PROJECT_ROOT: old.root })) if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
});
