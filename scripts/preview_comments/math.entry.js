import temml from "temml";
window.__adrMath = (tex, display, el) => temml.render(tex, el, { displayMode: display, throwOnError: true, trust: false });
