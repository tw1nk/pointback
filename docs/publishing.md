# Publishing Pointback to npm

The npm packages are `@pointback/protocol`, `@pointback/browser`, `@pointback/daemon`, `@pointback/vite`, `@pointback/cli`, `@pointback/mcp`, and `@pointback/pi`. The examples and workspace root remain private. All packages share the same version and use matching `^` ranges for internal dependencies.

1. Ensure you control the `@pointback` npm scope and are authenticated with `npm login`. Publishing requires registry access; changing package metadata does not reserve a scope.
2. Update **all seven versions** and their internal `@pointback/*` dependency ranges together. Run `npm install --package-lock-only` to synchronize the lockfile.
3. Run `npm run build`, `npm run typecheck`, `npm test`, and `npm run pack:check`. Inspect any test failures before release. `npm pack --workspace @pointback/vite --dry-run` shows an individual tarball's files.
4. Publish dependencies first, then consumers:

```sh
npm publish --workspace @pointback/protocol
npm publish --workspace @pointback/browser
npm publish --workspace @pointback/daemon
npm publish --workspace @pointback/vite
npm publish --workspace @pointback/cli
npm publish --workspace @pointback/mcp
npm publish --workspace @pointback/pi
```

The manifests set `publishConfig.access` to `public`. Never reuse a published version. After publishing, test `npm install -D @pointback/vite @pointback/cli` in a **separate, clean Vite project**, start it with `npx pointback dev -- npm run dev`, and install the Pi integration via `pi install npm:@pointback/pi` if desired. The MCP executable is `pointback-mcp` from `@pointback/mcp`.

For local development without publishing, use the source-build instructions in the main README.
