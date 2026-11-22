// Apply the saved theme before first paint to avoid a flash.
// External (not inline) so the Content-Security-Policy can forbid inline scripts.
(function () {
  try {
    var saved = localStorage.getItem("theme") || "light";
    var dark = saved === "dark" || (saved === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
  } catch (e) {}
})();
