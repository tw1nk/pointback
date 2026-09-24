import assert from "node:assert/strict";
import { test } from "node:test";
import { commentSchema, eventSchema, targetSchema } from "./index.ts";

test("review events survive JSON serialization", () => {
  const event = { type: "review.submitted", sessionId: "rev_1", commentIds: ["comment_1"] };
  assert.deepEqual(eventSchema.parse(JSON.parse(JSON.stringify(event))), event);
});

test("targets require type-specific context", () => {
  assert.deepEqual(targetSchema.parse({ type: "page" }), { type: "page" });
  assert.equal(targetSchema.safeParse({ type: "region" }).success, false);
  assert.deepEqual(targetSchema.parse({ type: "region", rect: { x: 10, y: 20, width: 80, height: 40 }, scroll: { x: 0, y: 180 } }), { type: "region", rect: { x: 10, y: 20, width: 80, height: 40 }, scroll: { x: 0, y: 180 } });
});

test("comments reject empty messages and invalid URLs", () => {
  const comment = { id: "c1", sessionId: "s1", url: "not a url", message: " ", target: { type: "page" }, viewport: { width: 1440, height: 900 }, status: "open", createdAt: new Date().toISOString() };
  assert.equal(commentSchema.safeParse(comment).success, false);
  assert.equal(commentSchema.safeParse({ ...comment, url: "http://localhost:5173/", message: "Fix spacing" }).success, true);
});
