import { createHash, createHmac, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const dataDirectory = () => process.env.POINTBACK_DATA_DIR ?? join(homedir(), ".local", "share", "pointback");
export function projectId(root: string): string {
  return "project_" + createHash("sha256").update(realpathSync(root)).digest("hex").slice(0, 24);
}
export function secret(dataDir = dataDirectory()): Buffer {
  mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  const path = join(dataDir, "secret");
  if (!existsSync(path)) writeFileSync(path, randomBytes(32), { flag: "wx", mode: 0o600 });
  return readFileSync(path);
}
export function projectToken(id: string, dataDir = dataDirectory()): string {
  return createHmac("sha256", secret(dataDir)).update(id).digest("hex");
}
