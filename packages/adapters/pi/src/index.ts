import { Type } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
// Use the local identity module while this adapter is loaded from the monorepo by Pi's jiti runtime.
import { projectId, projectToken } from "../../../daemon/dist/identity.js";
import type { startDaemon } from "@pointback/daemon";
import { commentSchema, sessionSchema, type ReviewComment } from "@pointback/protocol";
import WebSocket from "ws";

export default function pointback(pi: ExtensionAPI, options: { projectRoot?: string } = {}) {
  let socket: WebSocket | undefined;
  let ownedDaemon: ReturnType<typeof startDaemon> | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = true;
  let project = "";
  let agentSession = "";
  let onConnected: (() => void) | undefined;
  const port = process.env.POINTBACK_PORT ?? "47832";
  async function request(path: string, method = "GET") {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, {
      method, headers: { "x-pointback-project": project, "x-pointback-token": projectToken(project) },
    });
    if (!response.ok) throw new Error(`Pointback ${response.status}: ${await response.text()}`);
    return response.json() as Promise<unknown>;
  }
  async function deliver(comments: ReviewComment[]) {
    if (!comments.length) return;
    const lines = comments.map((c, i) => `${i + 1}. ${c.message}\n   Route: ${new URL(c.url).pathname}\n   Target: ${JSON.stringify(c.target)}\n   Comment ID: ${c.id}${c.screenshotId ? `\n   Screenshot ID: ${c.screenshotId}` : ""}${c.followUps?.length ? `\n   Follow-up: ${c.followUps.at(-1)?.message}` : ""}`);
    pi.sendUserMessage(`POINTBACK REVIEW\n\n${lines.join("\n\n")}\n\nUse Pointback tools to inspect screenshots and resolve comments after implementing changes.`, { deliverAs: "followUp" });
    for (const comment of comments) await request(`/comments/${comment.id}/acknowledge`, "POST");
  }
  function connect() {
    if (stopped) return;
    const connection = new WebSocket(`ws://127.0.0.1:${port}/events?project=${project}&token=${projectToken(project)}&role=agent&session=${encodeURIComponent(agentSession)}`);
    socket = connection;
    connection.on("open", () => {
      onConnected?.();
      void (async () => {
        const sessions = sessionSchema.array().parse(await request("/sessions"));
        const comments = commentSchema.array().parse(await request("/comments"));
        await deliver(comments.filter((c) => c.status === "open" && sessions.some((s) => s.id === c.sessionId && s.status === "submitted")));
      })().catch((error) => console.error("Pointback pending review failed:", error));
    });
    connection.on("message", (data) => {
      void (async () => {
        const event = JSON.parse(data.toString()) as { type: string; sessionId?: string; commentIds?: string[]; commentId?: string };
        if (event.type !== "review.submitted" && event.type !== "comment.reopened") return;
        const ids = event.commentIds ?? ("commentId" in event && typeof event.commentId === "string" ? [event.commentId] : []);
        if (!ids.length) return;
        const comments = commentSchema.array().parse(await request("/comments")).filter((c) => ids.includes(c.id) && c.status === "open");
        await deliver(comments);
      })().catch((error) => console.error("Pointback delivery failed:", error));
    });
    // The daemon is optional until /pointback is run. A failed connection closes
    // the socket and the close handler retries quietly.
    connection.on("error", () => {});
    connection.on("close", () => {
      if (socket !== connection) return;
      socket = undefined;
      if (!stopped) timer = setTimeout(connect, 2000);
    });
  }
  pi.registerCommand("pointback", {
    description: "Start the Pointback review daemon and connect this Pi session",
    handler: async (_args, ctx) => {
      if (!ownedDaemon) {
        try {
          const response = await fetch(`http://127.0.0.1:${port}/agents`, {
            headers: { "x-pointback-project": project, "x-pointback-token": projectToken(project) },
          });
          if (!response.ok) throw new Error(`Daemon returned HTTP ${response.status}`);
        } catch (error) {
          if (error instanceof Error && error.message.startsWith("Daemon returned")) {
            ctx.ui.notify(`Pointback: ${error.message}`, "error");
            return;
          }
          try {
            const { startDaemon } = await import("@pointback/daemon");
            ownedDaemon = startDaemon({ port: Number(port) });
            await new Promise<void>((resolve, reject) => {
              ownedDaemon!.server.once("listening", resolve);
              ownedDaemon!.server.once("error", reject);
            });
          } catch (startError) {
            ctx.ui.notify(`Pointback could not start: ${String(startError)}`, "error");
            return;
          }
        }
      }
      if (timer) clearTimeout(timer);
      if (socket && socket.readyState !== WebSocket.OPEN) {
        socket.terminate();
        socket = undefined;
      }
      if (!socket) connect();
      ctx.ui.notify("Pointback daemon is running", "info");
    },
  });
  pi.on("session_start", (_event, ctx) => {
    if (socket) socket.terminate();
    if (timer) clearTimeout(timer);
    project = projectId(options.projectRoot ?? process.env.POINTBACK_PROJECT_ROOT ?? ctx.cwd);
    agentSession = ctx.sessionManager.getSessionId();
    onConnected = () => { if (ctx.hasUI) ctx.ui.notify("Pointback connected to the review daemon", "info"); };
    stopped = false;
    connect();
  });
  pi.on("session_shutdown", () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    socket?.terminate();
    socket = undefined;
    if (ownedDaemon) void ownedDaemon.close().catch((error) => console.error("Pointback shutdown failed:", error));
    ownedDaemon = undefined;
  });
  pi.registerTool({
    name: "pointback_get_pending", label: "Pointback pending", description: "List unresolved review feedback for this project", parameters: Type.Object({}),
    async execute() {
      const sessions = sessionSchema.array().parse(await request("/sessions"));
      const comments = commentSchema.array().parse(await request("/comments"));
      return { content: [{ type: "text" as const, text: JSON.stringify(comments.filter((c) => c.status !== "resolved" && c.status !== "accepted" && sessions.some((s) => s.id === c.sessionId && s.status === "submitted"))) }], details: undefined };
    },
  });
  pi.registerTool({
    name: "pointback_get_screenshot", label: "Pointback screenshot", description: "View a screenshot of a review comment", parameters: Type.Object({ screenshotId: Type.String() }),
    async execute(_id, { screenshotId }) {
      const image = await request(`/screenshots/${encodeURIComponent(screenshotId)}`) as { image: string; mimeType: string };
      return { content: [{ type: "image" as const, data: image.image, mimeType: image.mimeType }], details: undefined };
    },
  });
  pi.registerTool({
    name: "pointback_resolve_comment", label: "Pointback resolve", description: "Resolve a comment only after implementing its requested change", parameters: Type.Object({ commentId: Type.String() }),
    async execute(_id, { commentId }) {
      const comment = await request(`/comments/${encodeURIComponent(commentId)}/resolve`, "POST");
      return { content: [{ type: "text" as const, text: JSON.stringify(comment) }], details: undefined };
    },
  });
  pi.registerTool({
    name: "pointback_request_review", label: "Pointback request review", description: "Ask the developer to review the live app", parameters: Type.Object({}),
    async execute() {
      const session = await request("/request-review", "POST");
      return { content: [{ type: "text" as const, text: JSON.stringify(session) }], details: undefined };
    },
  });
}
