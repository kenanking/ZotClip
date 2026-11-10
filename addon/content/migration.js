/* global window */
window.addEventListener(
  "DOMContentLoaded",
  () => {
    window.arguments[0].mount(window);
  },
  { once: true },
);
