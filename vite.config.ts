import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5175,
    host: true,
    proxy: {
      "/api": {
        target: process.env.VITE_API_URL ?? "http://127.0.0.1:8787",
        changeOrigin: true,
        secure: false,
      },
    },
  },
  preview: { port: 4175, host: true },
  build: {
    outDir: "dist",
    sourcemap: false,
    target: "es2022",
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom", "react-router-dom"],
        },
      },
    },
  },
});
