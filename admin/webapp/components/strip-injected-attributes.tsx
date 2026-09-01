import Script from 'next/script';

/**
 * Browser extensions that scan the page — Bitdefender's is the common one —
 * stamp their own attributes onto elements in the server-rendered HTML before
 * React gets to it: `bis_skin_checked`, `bis_register`, `__processed_<uuid>__`.
 * React then compares that mutated DOM against what it meant to render and
 * reports a hydration mismatch on essentially every <div> on the page.
 *
 * It is cosmetic — the attributes do nothing and the app works — but the noise
 * buries real hydration bugs, which is the actual cost. This strips them back
 * out while hydration is happening.
 *
 * It runs with next/script's `beforeInteractive` strategy, which Next
 * guarantees executes before any of its own code and before hydration -- so
 * the observer is installed in time to catch the attributes as they appear,
 * rather than racing to clean up after the fact. It disconnects shortly after
 * load: past that point the extension is welcome to do as it likes, because
 * React is no longer comparing the DOM against server output.
 *
 * This cannot be done from a normal effect — hydration has already failed by
 * the time one runs.
 */
const SCRIPT = `(function () {
  var NOISE = /^(bis_skin_checked|bis_register|bis_size|bis_id)$|^__processed_[0-9a-fA-F-]+__$/;

  function clean(node) {
    if (!node || node.nodeType !== 1 || !node.attributes) return;
    for (var i = node.attributes.length - 1; i >= 0; i--) {
      var name = node.attributes[i].name;
      if (NOISE.test(name)) node.removeAttribute(name);
    }
  }

  function sweep(root) {
    clean(root);
    if (root.querySelectorAll) {
      var all = root.querySelectorAll('*');
      for (var i = 0; i < all.length; i++) clean(all[i]);
    }
  }

  var observer = new MutationObserver(function (records) {
    for (var i = 0; i < records.length; i++) {
      var record = records[i];
      if (record.type === 'attributes') {
        if (NOISE.test(record.attributeName)) record.target.removeAttribute(record.attributeName);
      } else {
        for (var j = 0; j < record.addedNodes.length; j++) sweep(record.addedNodes[j]);
      }
    }
  });

  observer.observe(document.documentElement, { attributes: true, subtree: true, childList: true });

  function stop() {
    sweep(document.documentElement);
    observer.disconnect();
  }

  // Hydration is long finished a beat after load; stop watching then.
  if (document.readyState === 'complete') setTimeout(stop, 1000);
  else addEventListener('load', function () { setTimeout(stop, 1000); });
})();`;

export function StripInjectedAttributes() {
  return (
    <Script
      id="strip-injected-attributes"
      strategy="beforeInteractive"
      dangerouslySetInnerHTML={{ __html: SCRIPT }}
    />
  );
}
