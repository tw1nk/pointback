import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { projectId, projectToken } from "@pointback/daemon";
import { commentSchema, sessionSchema } from "@pointback/protocol";

const project = projectId(process.env.POINTBACK_PROJECT_ROOT ?? process.cwd());
const port = process.env.POINTBACK_PORT ?? "47832";
async function request(path: string, method = "GET") {
  const response = await fetch(`http://127.0.0.1:${port}${path}`, {
    method, headers: { "x-pointback-project": project, "x-pointback-token": projectToken(project) },
  });
  if (!response.ok) throw new Error(`Pointback ${response.status}: ${await response.text()}`);
  return response.json() as Promise<unknown>;
}
const output = (value: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] });
export function createPointbackMcpServer() {
  const server = new McpServer({ name: "pointback", version: "0.1.0" });
  server.registerTool("pointback_request_review", { description: "Ask the developer to review the running UI" }, async () => output(await request("/request-review", "POST")));
  server.registerTool("pointback_get_pending", { description: "List submitted, unresolved Pointback review comments for this project" }, async () => {
    const sessions = sessionSchema.array().parse(await request("/sessions"));
    const comments = commentSchema.array().parse(await request("/comments"));
    return output(comments.filter((c) => c.status !== "resolved" && c.status !== "accepted" && sessions.some((s) => s.id === c.sessionId && s.status === "submitted")));
  });
  server.registerTool("pointback_get_comment", { description: "Get one review comment including DOM and viewport context", inputSchema: { comment_id: z.string() } }, async ({ comment_id }) => {
    const comments = commentSchema.array().parse(await request("/comments"));
    return output(comments.find((c) => c.id === comment_id) ?? { error: "Comment not found" });
  });
  server.registerTool("pointback_get_screenshot", { description: "Get a Pointback screenshot as an image", inputSchema: { screenshot_id: z.string(), crop: z.object({ x: z.number(), y: z.number(), width: z.number().positive(), height: z.number().positive() }).optional() } }, async ({ screenshot_id, crop }) => {
    const query = crop ? `?crop=${[crop.x, crop.y, crop.width, crop.height].join(",")}` : "";
    const screenshot = await request(`/screenshots/${encodeURIComponent(screenshot_id)}${query}`) as { image: string; mimeType: string };
    return { content: [{ type: "image" as const, data: screenshot.image, mimeType: screenshot.mimeType }] };
  });
  server.registerTool("pointback_resolve_comment", { description: "Mark a comment resolved after implementing the requested change", inputSchema: { comment_id: z.string() } }, async ({ comment_id }) => output(await request(`/comments/${encodeURIComponent(comment_id)}/resolve`, "POST")));
  server.registerTool("pointback_acknowledge_comment", { description: "Acknowledge receipt without resolving the comment", inputSchema: { comment_id: z.string() } }, async ({ comment_id }) => output(await request(`/comments/${encodeURIComponent(comment_id)}/acknowledge`, "POST")));
  server.registerTool("pointback_reopen_comment", { description: "Reopen a comment for re-review", inputSchema: { comment_id: z.string() } }, async ({ comment_id }) => output(await request(`/comments/${encodeURIComponent(comment_id)}/reopen`, "POST")));
  return server;
}
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  await createPointbackMcpServer().connect(new StdioServerTransport());
}
