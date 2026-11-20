import { h } from "vue";
import DefaultTheme from "vitepress/theme";
import TeamGraph from "../components/TeamGraph.vue";
import DocGraph from "../components/DocGraph.vue";
import RerunViewer from "../components/RerunViewer.vue";
import RouteMap from "../components/RouteMap.vue";
import SplatViewer from "../components/SplatViewer.vue";
import WorkstreamLinks from "../components/WorkstreamLinks.vue";
import ClassificationBanner from "../components/ClassificationBanner.vue";
import WorkstreamBoard from "../components/WorkstreamBoard.vue";
import WorkstreamNow from "../components/WorkstreamNow.vue";
import PageCard from "../components/PageCard.vue";
import VoteHistory from "../components/VoteHistory.vue";
import PageTree from "../components/PageTree.vue";
import AutoPageCard from "../components/AutoPageCard.vue";
import { installSidebarToggle } from "./sidebar-toggle.mjs";
import { enhanceTables } from "./table-tools.mjs";
import { installPublishing } from "./publish.mjs";
import "./task-lists.css";
import "./layout.css";

// The default theme plus <DocGraph src="/graph.json" /> (an editable layered graph) <RerunViewer src="x.rrd" /> (hosted Rerun web viewer) and the page tree:
// breadcrumbs, child pages and a collapsible tree (`t`) driven by `parent:` / `order:` front matter.
const tree = pad => () => h(PageTree, { pad });
export default {
  extends: DefaultTheme,
  Layout: () => h(DefaultTheme.Layout, null, { "doc-before": () => [tree(false)(), h(AutoPageCard)], "page-top": tree(true), "home-hero-before": tree(true), "layout-top": () => h(ClassificationBanner), "layout-bottom": () => h(WorkstreamLinks) }),
  enhanceApp({ app, router }) {
    if (typeof window !== "undefined") {
      const run = () => setTimeout(() => enhanceTables(document, location.pathname), 150);
      router.onAfterRouteChange = run;
      window.addEventListener("load", run);
      installSidebarToggle();
      installPublishing();
    }
    app.component("DocGraph", DocGraph); app.component("TeamGraph", TeamGraph); app.component("RerunViewer", RerunViewer); app.component("RouteMap", RouteMap); app.component("SplatViewer", SplatViewer); app.component("PageCard", PageCard); app.component("VoteHistory", VoteHistory); app.component("WorkstreamBoard", WorkstreamBoard); app.component("WorkstreamNow", WorkstreamNow); },
};
