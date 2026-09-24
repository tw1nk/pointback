import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startDaemon, projectToken } from "../dist/index.js";
import sharp from "sharp";
import WebSocket from "ws";

test("project reviews persist and reject foreign credentials", async () => {
  const dir = mkdtempSync(join(tmpdir(), "pointback-test-"));
  const id = "project_" + "a".repeat(24);
  const other = "project_" + "b".repeat(24);
  const daemon = startDaemon({ port: 0, dataDir: dir });
  try {
    await new Promise<void>((resolve) => daemon.server.once("listening", resolve));
    const address = daemon.server.address();
    if (!address || typeof address === "string") throw new Error("No port");
    const base = `http://127.0.0.1:${address.port}`;
    const req = (path: string, method = "GET", body?: unknown, project = id, token = projectToken(project, dir)) => fetch(base + path, {
      method, headers: { "content-type": "application/json", "x-pointback-project": project, "x-pointback-token": token }, body: body ? JSON.stringify(body) : undefined,
    });
    assert.equal((await req("/sessions", "GET", undefined, other, projectToken(id, dir))).status, 403);
    const ws = new WebSocket(`ws://127.0.0.1:${address.port}/events?project=${id}&token=${projectToken(id, dir)}`);
    await new Promise<void>((resolve) => ws.once("open", resolve));
    const second = new WebSocket(`ws://127.0.0.1:${address.port}/events?project=${id}&token=${projectToken(id, dir)}`);
    await new Promise<void>((resolve) => second.once("open", resolve));
    const event = new Promise<string>((resolve) => ws.once("message", (data) => resolve(data.toString())));
    const secondEvent = new Promise<string>((resolve) => second.once("message", (data) => resolve(data.toString())));
    const created = await req("/sessions", "POST", { git: { branch: "feature/ui", commit: "abc123", dirty: true } });
    assert.equal(created.status, 201);
    assert.equal((JSON.parse(await event) as { type: string }).type, "session.created");
    assert.equal((JSON.parse(await secondEvent) as { type: string }).type, "session.created");
    ws.close(); second.close();
    const reconnected = new WebSocket(`ws://127.0.0.1:${address.port}/events?project=${id}&token=${projectToken(id, dir)}`);
    await new Promise<void>((resolve) => reconnected.once("open", resolve));
    const replayedSessions = await req("/sessions").then((response) => response.json()) as unknown[];
    assert.equal(replayedSessions.length, 1);
    reconnected.close();
    const session = await created.json() as { id: string; git?: { branch?: string } };
    assert.equal(session.git?.branch, "feature/ui");
    const png = (await sharp({ create: { width: 1, height: 1, channels: 4, background: "black" } }).png().toBuffer()).toString("base64");
    const upload = await req(`/sessions/${session.id}/screenshots`, "POST", { image: png });
    assert.equal(upload.status, 201);
    const { id: screenshotId } = await upload.json() as { id: string };
    assert.equal((await req(`/screenshots/${screenshotId}`).then((r) => r.json()) as { image: string }).image, png);
    assert.equal((await req(`/screenshots/${screenshotId}`, "GET", undefined, other)).status, 404);
    assert.equal((await req(`/screenshots/${screenshotId}?crop=0,0,1,1`).then((r) => r.json()) as { width: number }).width, 1);
    assert.equal((await req(`/screenshots/${screenshotId}?crop=4,4,1,1`)).status, 400);
    assert.equal((await req(`/sessions/${session.id}/submit`, "POST", [{ message: "missing required fields" }])).status, 400);
    const submission = await req(`/sessions/${session.id}/submit`, "POST", [
      { url: "http://localhost:5173/", message: "Fix spacing", target: { type: "page" }, viewport: { width: 800, height: 600 }, screenshotId },
      { url: "http://localhost:5173/", message: "Fix alignment", target: { type: "page" }, viewport: { width: 800, height: 600 }, screenshotId },
    ]);
    assert.equal(submission.status, 201);
    const comments = await submission.json() as { id: string }[];
    assert.equal((await req(`/sessions/${session.id}/submit`, "POST", [], other)).status, 404);
    assert.equal((await req("/comments", "GET", undefined, other).then((r) => r.json()) as unknown[]).length, 0);
    assert.equal((await req(`/comments/${comments[0].id}/accept`, "POST")).status, 409);
    assert.equal((await req(`/comments/${comments[0].id}/resolve`, "POST")).status, 200);
    assert.equal((await req("/comments").then((r) => r.json()) as { status: string }[])[0].status, "resolved");
    assert.equal((await req(`/comments/${comments[0].id}/reopen`, "POST", { message: "Still too cramped" })).status, 200);
    const reopened = await req("/comments").then((r) => r.json()) as { followUps?: { message: string }[] }[];
    assert.equal(reopened[0].followUps?.[0].message, "Still too cramped");
    assert.equal((await req(`/comments/${comments[0].id}/resolve`, "POST")).status, 200);
    assert.equal((await req(`/comments/${comments[0].id}/accept`, "POST")).status, 200);
    assert.equal((await req(`/comments/${comments[1].id}`, "DELETE")).status, 409);
    assert.equal((await req(`/comments/${comments[0].id}`, "DELETE", undefined, other)).status, 404);
    assert.equal((await req(`/comments/${comments[0].id}`, "DELETE")).status, 200);
    assert.equal((await req(`/screenshots/${screenshotId}`)).status, 200, "shared screenshot is retained");
    assert.equal((await req(`/comments/${comments[1].id}/resolve`, "POST")).status, 200);
    assert.equal((await req(`/comments/${comments[1].id}`, "DELETE")).status, 200);
    assert.equal((await req(`/screenshots/${screenshotId}`)).status, 404, "last deletion removes screenshot");
    assert.deepEqual(await req("/comments").then((r) => r.json()), []);
    assert.equal((await req("/request-review", "POST")).status, 201);
  } finally { await daemon.close(); rmSync(dir, { recursive: true, force: true }); }
});
