const KEY = "adr-hide-sidebar";

// A button (and the `\` key) hides the side columns (index and "On this page") so content and graphs use the full width; the choice is remembered.
export function installSidebarToggle() {
  const root = document.documentElement;
  const apply = hidden => { root.classList.toggle("adr-no-sidebar", hidden); localStorage.setItem(KEY, hidden ? "1" : "0"); window.dispatchEvent(new Event("resize")); };
  root.classList.toggle("adr-no-sidebar", localStorage.getItem(KEY) === "1");
  const button = document.createElement("button");
  button.className = "adr-sidebar-toggle";
  button.title = "Show or hide the side columns (\\)";
  button.textContent = "⇤ focus";
  button.addEventListener("click", () => apply(!root.classList.contains("adr-no-sidebar")));
  document.body.append(button);
  document.addEventListener("keydown", event => {
    if (event.key !== "\\" || event.ctrlKey || event.metaKey || event.altKey) return;
    const target = event.target;
    if (target.closest?.("input,textarea,select,[contenteditable]") || localStorage.getItem("preview-comments-vim") === "off") return;
    event.preventDefault();
    apply(!root.classList.contains("adr-no-sidebar"));
  });
}
