import { h } from "vue";
import DefaultTheme from "vitepress/theme";
import DocGraph from "../components/DocGraph.vue";
import PageTree from "../components/PageTree.vue";

// The default theme plus <DocGraph src="/graph.json" /> (an editable layered graph) and the page tree:
// breadcrumbs, child pages and a collapsible tree (`t`) driven by `parent:` / `order:` front matter.
const tree = pad => () => h(PageTree, { pad });
export default {
  extends: DefaultTheme,
  Layout: () => h(DefaultTheme.Layout, null, { "doc-before": tree(false), "page-top": tree(true), "home-hero-before": tree(true) }),
  enhanceApp({ app }) { app.component("DocGraph", DocGraph); },
};
