import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import pointback from "@pointback/vite";

export default defineConfig({ plugins: [react(), pointback()] });
