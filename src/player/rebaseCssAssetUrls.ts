/**
 * Runtime CSS references public files by absolute URL (`url("/assets/fonts/Galmuri9.woff2")`, jetrel icons,
 * emerald battle backgrounds). The player build has no publicDir, so Vite leaves those URLs absolute.
 * That works when the game is served at an origin root, but an exported game hosted under a sub-path
 * (`https://host/games/demo/player.html`) then asks the host root for `/assets/...` and gets 404.
 *
 * Rewrite those URLs in the loaded style sheets to the player's asset base (exportAssetBase.ts), including
 * sheets that lazy chunks add later. No-op when the asset base is the origin root (root exports, hosted
 * editor builds) and for the standalone HTML, whose CSS URLs are already inlined data URLs.
 */
const ABSOLUTE_ASSET_URL = /url\((\s*["']?)\/assets\//g;

export function rebaseRuntimeCssAssetUrls(assetBase: URL, doc: Document = document): void {
  if (assetBase.protocol === "file:" || assetBase.origin !== doc.location.origin || assetBase.pathname === "/") return;
  const replacement = `url($1${assetBase.pathname}assets/`;
  const done = new WeakSet<CSSStyleSheet>();
  const visit = (rules: CSSRuleList): void => {
    for (const rule of Array.from(rules)) {
      const style = (rule as Partial<CSSStyleRule>).style;
      if (style) {
        for (let index = 0; index < style.length; index += 1) {
          const name = style.item(index);
          const value = style.getPropertyValue(name);
          if (!value.includes("/assets/")) continue;
          const rebased = value.replace(ABSOLUTE_ASSET_URL, replacement);
          if (rebased !== value) style.setProperty(name, rebased, style.getPropertyPriority(name));
        }
      }
      const nested = (rule as Partial<CSSGroupingRule>).cssRules;
      if (nested) visit(nested);
    }
  };
  const apply = (): void => {
    for (const sheet of Array.from(doc.styleSheets)) {
      if (done.has(sheet)) continue;
      try {
        visit(sheet.cssRules);
        done.add(sheet);
      } catch {
        // Not yet loaded or cross-origin: retried when the next sheet loads.
      }
    }
  };
  apply();
  new MutationObserver((records) => {
    for (const record of records) {
      for (const node of Array.from(record.addedNodes)) {
        if (node instanceof HTMLLinkElement) node.addEventListener("load", apply, { once: true });
        else if (node instanceof HTMLStyleElement) apply();
      }
    }
  }).observe(doc.head, { childList: true });
}
