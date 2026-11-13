import { defineConfig } from "vitepress";

// Static build of the example site for GitHub Pages (no comment bridge).
export default defineConfig({
  title: "Agent Doc Review",
  base: process.env.SITE_BASE || "/",
  appearance: "force-dark",
  srcExclude: ["papers/**"],
  vite: { optimizeDeps: { include: ["cytoscape"] } },
});
