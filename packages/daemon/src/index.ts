import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { DatabaseSync } from "node:sqlite";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { mkdirSync, writeFileSync, readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { WebSocketServer, WebSocket } from "ws";
import sharp from "sharp";
import { commentSchema, screenshotSchema, sessionSchema, type PointbackEvent } from "@pointback/protocol";
import { dataDirectory, projectToken } from "./identity.js";
export { dataDirectory, projectId, projectToken } from "./identity.js";

const json = (res: ServerResponse, status: number, value: unknown) => {
  res.writeHead(status, { "content-type": "application/json", "cache-control": "no-store" });
  res.end(JSON.stringify(value));
};
const readBody = async (req: IncomingMessage): Promise<unknown> => {
  let text = "";
  for await (const chunk of req) {
    text += chunk;
    if (text.length > 8_000_000) throw new Error("Payload too large");
  }
  return JSON.parse(text);
};

export function startDaemon(options: { port?: number; dataDir?: string } = {}) {
  const dir = options.dataDir ?? dataDirectory();
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(join(dir, "pointback.sqlite"));
  const version = db.prepare("PRAGMA user_version").get() as { user_version: number };
  if (version.user_version > 1) throw new Error(`Unsupported Pointback database version ${version.user_version}`);
  db.exec(`CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, payload TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS comments (id TEXT PRIMARY KEY, session_id TEXT NOT NULL, project_id TEXT NOT NULL, payload TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS comments_project ON comments(project_id);
    CREATE TABLE IF NOT EXISTS screenshots (id TEXT PRIMARY KEY, session_id TEXT NOT NULL, project_id TEXT NOT NULL, payload TEXT NOT NULL);
    PRAGMA user_version = 1;`);
  const clients = new Map<WebSocket, string>();
  const agents = new Map<WebSocket, { project: string; sessionId: string }>();
  const publish = (project: string, event: PointbackEvent) => {
    for (const [client, id] of clients) if (id === project && client.readyState === WebSocket.OPEN) client.send(JSON.stringify(event));
  };
  const server = createServer(async (req, res) => {
    const origin = req.headers.origin;
    if (origin && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return json(res, 403, { error: "Origin denied" });
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    res.setHeader("access-control-allow-origin", origin ?? "http://127.0.0.1");
    res.setHeader("vary", "Origin");
    res.setHeader("access-control-allow-headers", "content-type,x-pointback-project,x-pointback-token");
    res.setHeader("access-control-allow-methods", "GET,POST,DELETE,OPTIONS");
    if (req.method === "OPTIONS") return res.end();
    const project = req.headers["x-pointback-project"];
    const token = req.headers["x-pointback-token"];
    if (typeof project !== "string" || !/^project_[a-f0-9]{24}$/.test(project) || typeof token !== "string") return json(res, 401, { error: "Project credentials required" });
    const expected = projectToken(project, dir);
    if (token.length !== expected.length || !timingSafeEqual(Buffer.from(token), Buffer.from(expected))) return json(res, 403, { error: "Invalid project token" });
    try {
      if (req.method === "GET" && url.pathname === "/agents") {
        return json(res, 200, [...agents.values()].filter((agent) => agent.project === project).map(({ sessionId }) => ({ agent: "pi", sessionId, liveDelivery: true })));
      }
      if (req.method === "GET" && url.pathname === "/sessions") {
        return json(res, 200, db.prepare("SELECT payload FROM sessions WHERE project_id = ? ORDER BY rowid DESC").all(project).map((row) => JSON.parse(row.payload as string)));
      }
      if (req.method === "POST" && url.pathname === "/sessions") {
        const body = req.headers["content-length"] === "0" || (!req.headers["content-length"] && !req.headers["transfer-encoding"]) ? {} : await readBody(req);
        const git = sessionSchema.shape.git.parse((body as { git?: unknown }).git);
        const session = sessionSchema.parse({ id: randomUUID(), projectId: project, createdAt: new Date().toISOString(), status: "active", git });
        db.prepare("INSERT INTO sessions VALUES (?, ?, ?)").run(session.id, project, JSON.stringify(session));
        publish(project, { type: "session.created", session });
        return json(res, 201, session);
      }
      if (req.method === "POST" && url.pathname === "/request-review") {
        const session = sessionSchema.parse({ id: randomUUID(), projectId: project, createdAt: new Date().toISOString(), status: "active" });
        db.prepare("INSERT INTO sessions VALUES (?, ?, ?)").run(session.id, project, JSON.stringify(session));
        publish(project, { type: "review.requested", sessionId: session.id });
        return json(res, 201, session);
      }
      const imageMatch = /^\/sessions\/([^/]+)\/screenshots$/.exec(url.pathname);
      if (req.method === "POST" && imageMatch) {
        const session = db.prepare("SELECT id FROM sessions WHERE id = ? AND project_id = ?").get(imageMatch[1], project);
        if (!session) return json(res, 404, { error: "Session not found" });
        const body = await readBody(req) as { image?: unknown; width?: unknown; height?: unknown };
        if (typeof body.image !== "string" || body.image.length > 8_000_000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(body.image)) return json(res, 400, { error: "Invalid image" });
        const bytes = Buffer.from(body.image, "base64");
        if (bytes.length > 6_000_000 || bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") return json(res, 400, { error: "Expected PNG under 6MB" });
        const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
        if (!width || !height || width > 10000 || height > 10000) return json(res, 400, { error: "Invalid image dimensions" });
        const id = randomUUID();
        const images = join(dir, "screenshots"); mkdirSync(images, { recursive: true, mode: 0o700 });
        const screenshot = screenshotSchema.parse({ id, sessionId: imageMatch[1], path: join(images, `${id}.png`), mimeType: "image/png", width, height, createdAt: new Date().toISOString() });
        writeFileSync(screenshot.path, bytes, { mode: 0o600 });
        db.prepare("INSERT INTO screenshots VALUES (?, ?, ?, ?)").run(id, screenshot.sessionId, project, JSON.stringify(screenshot));
        return json(res, 201, { id });
      }
      const screenshotMatch = /^\/screenshots\/([^/]+)$/.exec(url.pathname);
      if (req.method === "GET" && screenshotMatch) {
        const row = db.prepare("SELECT payload FROM screenshots WHERE id = ? AND project_id = ?").get(screenshotMatch[1], project);
        if (!row) return json(res, 404, { error: "Screenshot not found" });
        const screenshot = screenshotSchema.parse(JSON.parse(row.payload as string));
        const crop = url.searchParams.get("crop");
        if (!crop) return json(res, 200, { ...screenshot, image: readFileSync(screenshot.path).toString("base64") });
        const values = crop.split(",").map(Number);
        if (values.length !== 4 || values.some((v) => !Number.isFinite(v))) return json(res, 400, { error: "Invalid crop coordinates" });
        const [x, y, width, height] = values;
        const left = Math.max(0, Math.floor(x)), top = Math.max(0, Math.floor(y));
        const right = Math.min(screenshot.width, Math.ceil(x + width));
        const bottom = Math.min(screenshot.height, Math.ceil(y + height));
        if (right <= left || bottom <= top) return json(res, 400, { error: "Crop outside screenshot" });
        const image = await sharp(screenshot.path).extract({ left, top, width: right - left, height: bottom - top }).png().toBuffer();
        return json(res, 200, { ...screenshot, width: right - left, height: bottom - top, image: image.toString("base64") });
      }
      const match = /^\/sessions\/([^/]+)\/submit$/.exec(url.pathname);
      if (req.method === "POST" && match) {
        const row = db.prepare("SELECT payload FROM sessions WHERE id = ? AND project_id = ?").get(match[1], project);
        if (!row) return json(res, 404, { error: "Session not found" });
        const body = await readBody(req);
        if (!Array.isArray(body) || body.length === 0) return json(res, 400, { error: "Expected nonempty comment array" });
        const comments = body.map((item) => commentSchema.parse({ ...(item as object), id: randomUUID(), sessionId: match[1], status: "open", createdAt: new Date().toISOString() }));
        for (const comment of comments) if (comment.screenshotId && !db.prepare("SELECT id FROM screenshots WHERE id = ? AND session_id = ? AND project_id = ?").get(comment.screenshotId, match[1], project)) return json(res, 400, { error: "Invalid screenshot reference" });
        const session = sessionSchema.parse({ ...JSON.parse(row.payload as string), status: "submitted" });
        db.exec("BEGIN");
        try {
          for (const comment of comments) db.prepare("INSERT INTO comments VALUES (?, ?, ?, ?)").run(comment.id, session.id, project, JSON.stringify(comment));
          db.prepare("UPDATE sessions SET payload = ? WHERE id = ?").run(JSON.stringify(session), session.id);
          db.exec("COMMIT");
        } catch (error) { db.exec("ROLLBACK"); throw error; }
        publish(project, { type: "review.submitted", sessionId: session.id, commentIds: comments.map((c) => c.id) });
        return json(res, 201, comments);
      }
      if (req.method === "GET" && url.pathname === "/comments") {
        return json(res, 200, db.prepare("SELECT payload FROM comments WHERE project_id = ? ORDER BY rowid").all(project).map((row) => JSON.parse(row.payload as string)));
      }
      const deleteMatch = /^\/comments\/([^/]+)$/.exec(url.pathname);
      if (req.method === "DELETE" && deleteMatch) {
        const row = db.prepare("SELECT payload FROM comments WHERE id = ? AND project_id = ?").get(deleteMatch[1], project);
        if (!row) return json(res, 404, { error: "Comment not found" });
        const comment = commentSchema.parse(JSON.parse(row.payload as string));
        if (comment.status !== "resolved" && comment.status !== "accepted") return json(res, 409, { error: "Only resolved or accepted comments can be deleted" });
        let imagePath: string | undefined;
        db.exec("BEGIN");
        try {
          db.prepare("DELETE FROM comments WHERE id = ? AND project_id = ?").run(comment.id, project);
          if (comment.screenshotId) {
            const inUse = db.prepare("SELECT payload FROM comments WHERE project_id = ?").all(project).some((entry) => commentSchema.parse(JSON.parse(entry.payload as string)).screenshotId === comment.screenshotId);
            if (!inUse) {
              const image = db.prepare("SELECT payload FROM screenshots WHERE id = ? AND project_id = ?").get(comment.screenshotId, project);
              if (image) {
                imagePath = screenshotSchema.parse(JSON.parse(image.payload as string)).path;
                db.prepare("DELETE FROM screenshots WHERE id = ? AND project_id = ?").run(comment.screenshotId, project);
              }
            }
          }
          db.exec("COMMIT");
        } catch (error) { db.exec("ROLLBACK"); throw error; }
        if (imagePath) try { unlinkSync(imagePath); } catch (error) { console.error("Pointback screenshot cleanup failed:", error); }
        publish(project, { type: "comment.deleted", commentId: comment.id });
        return json(res, 200, { id: comment.id });
      }
      const statusMatch = /^\/comments\/([^/]+)\/(acknowledge|resolve|reopen|accept)$/.exec(url.pathname);
      if (req.method === "POST" && statusMatch) {
        const row = db.prepare("SELECT payload FROM comments WHERE id = ? AND project_id = ?").get(statusMatch[1], project);
        if (!row) return json(res, 404, { error: "Comment not found" });
        const previous = commentSchema.parse(JSON.parse(row.payload as string));
        const feedback = statusMatch[2] === "reopen" && ((req.headers["content-length"] && req.headers["content-length"] !== "0") || req.headers["transfer-encoding"]) ? await readBody(req) as { message?: unknown } : {};
        if (feedback.message !== undefined && (typeof feedback.message !== "string" || !feedback.message.trim())) return json(res, 400, { error: "Invalid follow-up message" });
        if (statusMatch[2] === "accept" && previous.status !== "resolved") return json(res, 409, { error: "Only resolved comments can be accepted" });
        const comment = commentSchema.parse({ ...previous, status: statusMatch[2] === "accept" ? "accepted" : statusMatch[2] === "resolve" ? "resolved" : statusMatch[2] === "reopen" ? "open" : "acknowledged",
          followUps: feedback.message ? [...(previous.followUps ?? []), { message: feedback.message.trim(), createdAt: new Date().toISOString() }] : previous.followUps });
        db.prepare("UPDATE comments SET payload = ? WHERE id = ?").run(JSON.stringify(comment), comment.id);
        publish(project, { type: statusMatch[2] === "resolve" ? "comment.resolved" : statusMatch[2] === "reopen" ? "comment.reopened" : statusMatch[2] === "accept" ? "comment.accepted" : "comment.acknowledged", commentId: comment.id });
        return json(res, 200, comment);
      }
      return json(res, 404, { error: "Not found" });
    } catch (error) { return json(res, 400, { error: error instanceof Error ? error.message : "Invalid request" }); }
  });
  const wss = new WebSocketServer({ noServer: true });
  server.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const project = url.searchParams.get("project");
    const token = url.searchParams.get("token");
    const origin = req.headers.origin;
    if (url.pathname !== "/events" || !project || !/^project_[a-f0-9]{24}$/.test(project) || token !== projectToken(project, dir) || (origin && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin))) { socket.destroy(); return; }
    wss.handleUpgrade(req, socket, head, (client) => {
      clients.set(client, project);
      const sessionId = url.searchParams.get("session");
      if (url.searchParams.get("role") === "agent" && sessionId && sessionId.length < 128) {
        agents.set(client, { project, sessionId });
        publish(project, { type: "agent.connected", agent: "pi", sessionId });
      }
      client.on("close", () => {
        clients.delete(client);
        const agent = agents.get(client);
        if (agent) { agents.delete(client); publish(project, { type: "agent.disconnected", agent: "pi", sessionId: agent.sessionId }); }
      });
    });
  });
  server.listen(options.port ?? 47832, "127.0.0.1");
  return { server, close: () => new Promise<void>((resolve, reject) => {
    for (const client of clients.keys()) client.terminate();
    wss.close();
    server.close((error) => { db.close(); error ? reject(error) : resolve(); });
  }) };
}
