import { execFileSync } from "node:child_process";

const packages = ["protocol", "browser", "daemon", "vite", "cli", "mcp", "pi"];
for (const name of packages) {
  const id = `@pointback/${name}`;
  const [pack] = JSON.parse(execFileSync("npm", ["pack", "--workspace", id, "--dry-run", "--json"], { encoding: "utf8" }));
  const files = new Set(pack.files.map((file) => file.path));
  if (!files.has("dist/index.js") || !files.has("package.json")) throw new Error(`${id}: missing compiled entry point or manifest`);
  console.log(`${id}@${pack.version}: ${files.size} files (${pack.size} bytes)`);
}
