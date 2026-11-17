import { h } from "vue";
import DefaultTheme from "vitepress/theme";
import TeamGraph from "../components/TeamGraph.vue";
import DocGraph from "../components/DocGraph.vue";
import RerunViewer from "../components/RerunViewer.vue";
import WorkstreamLinks from "../components/WorkstreamLinks.vue";
import ClassificationBanner from "../components/ClassificationBanner.vue";
import WorkstreamBoard from "../components/WorkstreamBoard.vue";
import WorkstreamNow from "../components/WorkstreamNow.vue";
import PageTree from "../components/PageTree.vue";
import { enhanceTables } from "./table-tools.mjs";
import "./task-lists.css";
import "./layout.css";

// The default theme plus <DocGraph src="/graph.json" /> (an editable layered graph) <RerunViewer src="x.rrd" /> (hosted Rerun web viewer) and the page tree:
// breadcrumbs, child pages and a collapsible tree (`t`) driven by `parent:` / `order:` front matter.
const tree = pad => () => h(PageTree, { pad });
export default {
  extends: DefaultTheme,
  Layout: () => h(DefaultTheme.Layout, null, { "doc-before": tree(false), "page-top": tree(true), "home-hero-before": tree(true), "layout-top": () => h(ClassificationBanner), "layout-bottom": () => h(WorkstreamLinks) }),
  enhanceApp({ app, router }) {
    if (typeof window !== "undefined") {
      const run = () => setTimeout(() => enhanceTables(document, location.pathname), 150);
      router.onAfterRouteChange = run;
      window.addEventListener("load", run);
    }
    app.component("DocGraph", DocGraph); app.component("TeamGraph", TeamGraph); app.component("RerunViewer", RerunViewer); app.component("WorkstreamBoard", WorkstreamBoard); app.component("WorkstreamNow", WorkstreamNow); },
};
