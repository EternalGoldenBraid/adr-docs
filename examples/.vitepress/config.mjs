import { defineConfig } from "vitepress";
import { fileURLToPath } from "node:url";
import { treeThemeConfig, treeJsonPlugin, unpublished } from "../../src/page-tree.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));

// Static build of the example site for GitHub Pages (no comment bridge).
export default defineConfig({
  title: "Agent Doc Review",
  base: process.env.SITE_BASE || "/",
  appearance: "force-dark",
  ignoreDeadLinks: [/^\/(planning|ops)\//],
  srcExclude: ["papers/**", ...unpublished(root)],
  themeConfig: treeThemeConfig(root, { publishedOnly: true }),
  vite: { optimizeDeps: { include: ["cytoscape"] }, plugins: [treeJsonPlugin(root)] },
});
