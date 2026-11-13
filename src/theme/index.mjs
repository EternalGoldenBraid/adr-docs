import DefaultTheme from "vitepress/theme";
import DocGraph from "../components/DocGraph.vue";

// The default theme plus <DocGraph src="/graph.json" />, an editable layered graph.
export default {
  extends: DefaultTheme,
  enhanceApp({ app }) { app.component("DocGraph", DocGraph); },
};
