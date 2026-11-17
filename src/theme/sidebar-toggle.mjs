const KEY = "adr-hide-sidebar";

// A button (and the `\` key) toggles the index (side columns); hidden by default so content and graphs use the full width. The choice is remembered.
export function installSidebarToggle() {
  const root = document.documentElement;
  const label = () => { button.textContent = root.classList.contains("adr-no-sidebar") ? "+ Show index" : "− Hide index"; };
  const apply = hidden => { root.classList.toggle("adr-no-sidebar", hidden); localStorage.setItem(KEY, hidden ? "1" : "0"); label(); window.dispatchEvent(new Event("resize")); };
  root.classList.toggle("adr-no-sidebar", localStorage.getItem(KEY) !== "0");
  const button = document.createElement("button");
  button.className = "adr-sidebar-toggle";
  button.title = "Show or hide the side columns (\\)";
  button.addEventListener("click", () => apply(!root.classList.contains("adr-no-sidebar")));
  document.body.append(button);
  label();
  document.addEventListener("keydown", event => {
    if (event.key !== "\\" || event.ctrlKey || event.metaKey || event.altKey) return;
    const target = event.target;
    if (target.closest?.("input,textarea,select,[contenteditable]") || localStorage.getItem("preview-comments-vim") === "off") return;
    event.preventDefault();
    apply(!root.classList.contains("adr-no-sidebar"));
  });
}
