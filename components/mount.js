/* -------------------------------------------------------------------------
   components/mount.js — swaps every <div data-component="…"> placeholder for
   the markup its component returns.

   Load order at the foot of each page matters and is deliberate:

     registry.js  →  navbar/footer/assistant  →  mount.js  →  page scripts

   mount.js runs synchronously at the end of <body>, so by the time js/app.js
   and js/content.js execute, the injected chrome is already in the DOM and
   their querySelector calls behave exactly as they did when the markup was
   hand-written into every page.

   A placeholder naming a component that was never loaded is left alone rather
   than blanked, so a page that omits one script degrades quietly.
   ------------------------------------------------------------------------- */

(() => {
  document.querySelectorAll('[data-component]').forEach((slot) => {
    const name = slot.dataset.component;
    const render = window.SITE.components[name];

    if (!render) {
      console.warn(`No component registered for "${name}" — is components/${name}.js loaded?`);
      return;
    }

    slot.outerHTML = render(window.SITE);
  });
})();
