#!/usr/bin/env node
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { startDaemon } from "@pointback/daemon";

const command = process.argv[2];
const port = process.env.POINTBACK_PORT ? Number(process.env.POINTBACK_PORT) : 47832;
if (command === "init") {
  const root = process.cwd();
  const config = ["vite.config.ts", "vite.config.mts", "vite.config.js", "vite.config.mjs"].find((name) => existsSync(join(root, name)));
  if (!config) { console.error("No Vite config found. Pointback currently supports Vite projects."); process.exitCode = 1; }
  else {
    const pkg = existsSync(join(root, "package.json")) ? JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> } : {};
    const react = Boolean(pkg.dependencies?.react || pkg.devDependencies?.react);
    console.log(`Detected Vite${react ? " + React" : ""} in ${root}.`);
    console.log(`1. Install: npm install -D @pointback/vite`);
    console.log(`2. In ${config}, add: import pointback from "@pointback/vite";`);
    console.log(`3. Add pointback() to defineConfig({ plugins: [${react ? "react(), " : ""}pointback()] }).`);
    console.log("4. Run: pointback dev -- npm run dev");
    console.log("5. Configure your coding agent with the Pointback MCP server or Pi extension (see README.md).");
  }
} else if (command === "start" || command === "dev") {
  const args = process.argv.slice(3).filter((part, index) => !(part === "--" && index === 0));
  if (command === "dev" && !args.length) {
    console.error("Usage: pointback dev -- <your development command>");
    process.exitCode = 1;
  } else {
    const daemon = startDaemon({ port });
    let child: ReturnType<typeof spawn> | undefined;
    let closing = false;
    const close = async () => {
      if (closing) return;
      closing = true;
      if (child && child.exitCode === null) child.kill("SIGTERM");
      await daemon.close();
    };
    daemon.server.on("listening", () => {
      console.log(`Pointback listening at http://127.0.0.1:${port}`);
      if (command === "dev") {
        child = spawn(args[0], args.slice(1), { cwd: process.cwd(), env: process.env, stdio: "inherit" });
        child.on("error", (error) => { console.error(`Development command failed: ${error.message}`); process.exitCode = 1; void close(); });
        child.on("exit", (code) => { process.exitCode = code ?? 1; void close(); });
      }
    });
    daemon.server.on("error", (error) => { console.error(`Pointback failed to start: ${error.message}`); process.exitCode = 1; void close(); });
    for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => { void close().then(() => process.exit(0)); });
  }
} else {
  console.log("Usage: pointback init | pointback start | pointback dev -- <your development command>");
  if (command) process.exitCode = 1;
}
