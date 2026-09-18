import Script from 'next/script';

/**
 * Browser extensions that scan the page stamp their own attributes onto the
 * server-rendered HTML before React hydrates. React then compares that mutated
 * DOM against what it meant to render and reports a mismatch on nearly every
 * element. Two are common here:
 *
 *   Bitdefender  bis_skin_checked, bis_register, __processed_<uuid>__
 *   Grammarly    data-gr-ext-installed, data-new-gr-c-s-check-loaded
 *
 * The attributes do nothing and the app works, but the noise buries real
 * hydration bugs -- which is the actual cost.
 *
 * A MutationObserver alone cannot fix this: its callback is a microtask, while
 * React reads the DOM synchronously during hydration, so the observer always
 * arrives too late. The load-bearing part here is patching setAttribute, which
 * runs in the extension's own call stack and stops the attribute landing at
 * all. The observer stays as a backup for writes that bypass it (dataset
 * assignment, for one), and both are undone shortly after load -- past that
 * point React is no longer comparing against server output, so the extensions
 * are welcome to do as they like.
 *
 * This cannot be done from an effect: hydration has already failed by then.
 */
const SCRIPT = `(function () {
  var NOISE = /^(bis_skin_checked|bis_register|bis_size|bis_id|cz-shortcut-listen|data-lt-installed)$|^__processed_[0-9a-fA-F-]+__$|^data-(new-)?gr-/;

  var nativeSetAttribute = Element.prototype.setAttribute;
  var patched = true;

  // Synchronous, and therefore the part that actually works: the extension
  // calls this on its own stack, before React ever looks at the element.
  Element.prototype.setAttribute = function (name, value) {
    if (patched && typeof name === 'string' && NOISE.test(name)) return;
    return nativeSetAttribute.call(this, name, value);
  };

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
    Element.prototype.setAttribute = nativeSetAttribute;
    patched = false;
  }

  if (document.readyState === 'complete') setTimeout(stop, 1500);
  else addEventListener('load', function () { setTimeout(stop, 1500); });
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
