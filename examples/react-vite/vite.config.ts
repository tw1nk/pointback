import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import pointback from "@pointback/vite";

export default defineConfig({ base: process.env.GITHUB_PAGES === "true" ? "/pointback/" : "/", plugins: [react(), pointback()] });
