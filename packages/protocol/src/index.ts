import { z } from "zod";

const identifier = z.string().min(1).max(128);
const timestamp = z.iso.datetime();
export const rectSchema = z.object({
  x: z.number().finite(), y: z.number().finite(),
  width: z.number().nonnegative().finite(), height: z.number().nonnegative().finite(),
});
export const viewportSchema = z.object({ width: z.number().positive(), height: z.number().positive() });
export const elementSchema = z.object({
  tag: z.string(), text: z.string(), role: z.string().nullable(),
  ariaLabel: z.string().nullable(), selector: z.string().min(1),
  source: z.object({ file: z.string(), line: z.number().int().positive(), column: z.number().int().positive(), component: z.string().optional() }).optional(),
  ancestors: z.array(z.object({ tag: z.string(), id: z.string().optional(), dataComponent: z.string().optional() })),
  html: z.string().max(8192),
});
const scrollSchema = z.object({ x: z.number().finite(), y: z.number().finite() });
export const targetSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("element"), rect: rectSchema, scroll: scrollSchema.optional(), element: elementSchema }),
  z.object({ type: z.literal("region"), rect: rectSchema, scroll: scrollSchema.optional() }),
  z.object({ type: z.literal("page") }),
]);
export const gitStateSchema = z.object({ branch: z.string().optional(), commit: z.string().optional(), dirty: z.boolean().optional() });
export const sessionSchema = z.object({
  id: identifier, projectId: identifier, createdAt: timestamp,
  status: z.enum(["active", "submitted", "resolved"]), git: gitStateSchema.optional(),
});
export const screenshotSchema = z.object({
  id: identifier, sessionId: identifier, path: z.string().min(1),
  mimeType: z.enum(["image/png", "image/webp"]), width: z.number().int().positive(),
  height: z.number().int().positive(), createdAt: timestamp,
});
export const commentSchema = z.object({
  id: identifier, sessionId: identifier, url: z.url(), message: z.string().trim().min(1),
  target: targetSchema, viewport: viewportSchema, screenshotId: identifier.optional(),
  status: z.enum(["open", "acknowledged", "resolved", "accepted"]), createdAt: timestamp,
  followUps: z.array(z.object({ message: z.string().trim().min(1), createdAt: timestamp })).optional(),
});
export const eventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("session.created"), session: sessionSchema }),
  z.object({ type: z.literal("review.submitted"), sessionId: identifier, commentIds: z.array(identifier).min(1) }),
  z.object({ type: z.literal("review.requested"), sessionId: identifier }),
  z.object({ type: z.literal("agent.connected"), agent: z.string(), sessionId: identifier }),
  z.object({ type: z.literal("agent.disconnected"), agent: z.string(), sessionId: identifier }),
  z.object({ type: z.literal("comment.acknowledged"), commentId: identifier }),
  z.object({ type: z.literal("comment.resolved"), commentId: identifier }),
  z.object({ type: z.literal("comment.reopened"), commentId: identifier }),
  z.object({ type: z.literal("comment.accepted"), commentId: identifier }),
  z.object({ type: z.literal("comment.deleted"), commentId: identifier }),
]);
export type Rect = z.infer<typeof rectSchema>;
export type ReviewTarget = z.infer<typeof targetSchema>;
export type ReviewSession = z.infer<typeof sessionSchema>;
export type ReviewComment = z.infer<typeof commentSchema>;
export type Screenshot = z.infer<typeof screenshotSchema>;
export type PointbackEvent = z.infer<typeof eventSchema>;

/** A native integration's capabilities; polling remains the universal fallback. */
export interface AgentCapabilities { polling: boolean; liveDelivery: boolean }
/** Harness-specific transports should implement this without changing the review model. */
export interface AgentAdapter {
  readonly name: string;
  readonly capabilities: AgentCapabilities;
  detect(projectRoot: string): Promise<boolean>;
  sendReview(session: ReviewSession, comments: ReviewComment[]): Promise<void>;
}
