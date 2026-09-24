---
name: pointback
description: Review Pointback feedback from the running local application and resolve comments after making changes.
---

# Pointback review workflow

1. Keep the application's Vite development server running; do not create a separate preview unless asked.
2. Call `pointback_get_pending` to find submitted feedback for the current project. Pointback's MCP server must run with the project root as its working directory or `POINTBACK_PROJECT_ROOT` set.
3. Inspect every comment's URL, target selector/region, viewport, sanitized DOM metadata, and message. If `screenshotId` exists, call `pointback_get_screenshot` to inspect the full image.
4. Locate the relevant source and implement each requested change. If the feedback is ambiguous, ask the developer instead of guessing.
5. Call `pointback_resolve_comment` only after implementing the corresponding change. `pointback_acknowledge_comment` only confirms receipt; it does not mark the work done.
6. Wait for the developer to verify the live HMR result; handle reopened comments in a later pass.

The Pi extension can deliver reviews live; other agents currently use MCP polling.
