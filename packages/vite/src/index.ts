import type { Plugin } from "vite";
import { projectId, projectToken } from "@pointback/daemon";
import { execFileSync } from "node:child_process";
import { relative } from "node:path";
import { parse } from "@babel/parser";
import MagicString from "magic-string";

export default function pointback(): Plugin {
  let root = process.cwd();
  return {
    name: "pointback",
    apply: "serve",
    configResolved(config) { root = config.root; },
    enforce: "pre",
    transform(code, id) {
      if (!/\.[jt]sx(?:\?|$)/.test(id) || id.includes("node_modules")) return;
      const file = id.split("?")[0];
      const source = relative(root, file).replaceAll("\\", "/");
      if (source.startsWith("..")) return;
      let ast;
      try { ast = parse(code, { sourceType: "module", plugins: ["jsx", ...(file.endsWith("tsx") ? ["typescript" as const] : [])] }); }
      catch { return; }
      const output = new MagicString(code);
      let changed = false;
      const visit = (node: unknown, parentComponent?: string) => {
        if (!node || typeof node !== "object") return;
        const value = node as Record<string, unknown>;
        const declaration = value.id as { name?: string } | undefined;
        const variable = value.id as { name?: string } | undefined;
        const component = (value.type === "FunctionDeclaration" ? declaration?.name : value.type === "VariableDeclarator" ? variable?.name : undefined);
        const currentComponent = component && /^[A-Z]/.test(component) ? component : parentComponent;
        if (value.type === "JSXOpeningElement") {
          const name = value.name as { type: string; name?: string; end: number };
          const attributes = value.attributes as { name?: { name?: string } }[];
          const loc = value.loc as { start: { line: number; column: number } } | undefined;
          if (name.type === "JSXIdentifier" && /^[a-z]/.test(name.name ?? "") && !attributes.some((attr) => attr.name?.name === "data-pointback-source") && loc) {
            output.appendLeft(name.end, ` data-pointback-source="${encodeURI(source)}:${loc.start.line}:${loc.start.column + 1}"${currentComponent && !attributes.some((attr) => attr.name?.name === "data-pointback-component") ? ` data-pointback-component="${currentComponent}"` : ""}`);
            changed = true;
          }
        }
        for (const [key, child] of Object.entries(value)) {
          if (key === "loc" || key === "tokens" || key === "comments" || key === "errors") continue;
          if (Array.isArray(child)) child.forEach((item) => visit(item, currentComponent));
          else if (child && typeof child === "object") visit(child, currentComponent);
        }
      };
      visit(ast.program);
      return changed ? { code: output.toString(), map: output.generateMap({ hires: true }).toString() } : undefined;
    },
    resolveId(id) { if (id === "virtual:pointback-client") return "\0virtual:pointback-client"; },
    load(id) { if (id === "\0virtual:pointback-client") return 'import "@pointback/browser";'; },
    transformIndexHtml() {
      const project = projectId(root);
      const git = (() => {
        try {
          const run = (...args: string[]) => execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
          return { branch: run("branch", "--show-current"), commit: run("rev-parse", "HEAD"), dirty: !!run("status", "--porcelain") };
        } catch { return undefined; }
      })();
      const settings = { project, token: projectToken(project), port: Number(process.env.POINTBACK_PORT ?? 47832), git };
      return [
        { tag: "script", children: `window.__POINTBACK__ = ${JSON.stringify(settings)};`, injectTo: "body" },
        { tag: "script", attrs: { type: "module", src: "/@id/__x00__virtual:pointback-client" }, injectTo: "body" },
      ];
    },
  };
}
