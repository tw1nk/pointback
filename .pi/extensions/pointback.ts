import { resolve } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default async function (pi: ExtensionAPI) {
  const { default: pointback } = await import("../../packages/adapters/pi/dist/index.js");
  pointback(pi, { projectRoot: resolve(process.cwd(), "examples/react-vite") });
}
