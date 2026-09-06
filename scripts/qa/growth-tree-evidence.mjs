import assert from 'node:assert/strict';

export const growthEvidenceRoot = 'output/evidence/growth-presets/p1';
export const growthViewports = [[1024, 768], [1280, 800], [1440, 900]];

// Subscribe before the triggering browser action; the timer only bounds failure.
export async function armDomState(page, predicate, argument, timeoutMs = 15000) {
  await page.evaluate(({ source, argument, timeoutMs }) => {
    const check = () => Function('value', `return (${source})(value)`)(argument);
    window.__growthQaState = new Promise((resolve, reject) => {
      const finish = () => {
        if (!check()) return;
        observer.disconnect(); clearTimeout(timeout); resolve();
      };
      const observer = new MutationObserver(finish);
      const timeout = setTimeout(() => {
        observer.disconnect(); reject(new Error(`Growth QA state deadline: ${source}`));
      }, timeoutMs);
      observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });
      finish();
    });
    window.__growthQaState.catch(error => { window.__growthQaStateError = error.message; });
  }, { source: predicate.toString(), argument, timeoutMs });
}
export async function finishDomState(page) { await page.evaluate(() => window.__growthQaState); }

export async function inspectGrowthImages(page, selector, expected) {
  const images = await page.locator(selector).evaluateAll(async nodes => {
    return await Promise.all(nodes.map(async node => {
      const background = getComputedStyle(node).backgroundImage;
      const url = node instanceof HTMLImageElement ? node.currentSrc || node.src : /^url\(["']?(.*?)["']?\)$/.exec(background)?.[1];
      const image = node instanceof HTMLImageElement ? node : new Image();
      let error;
      try {
        await new Promise((resolve, reject) => {
          const cleanup = () => { clearTimeout(timeout); image.removeEventListener('load', loaded); image.removeEventListener('error', failed); };
          const loaded = () => { cleanup(); resolve(); };
          const failed = () => { cleanup(); reject(new Error('image load failed')); };
          const timeout = setTimeout(() => { cleanup(); reject(new Error('image load deadline')); }, 15000);
          image.addEventListener('load', loaded, { once: true });
          image.addEventListener('error', failed, { once: true });
          if (!(node instanceof HTMLImageElement)) image.src = url ?? '';
          if (image.complete) image.naturalWidth > 0 ? loaded() : failed();
        });
        await image.decode();
      } catch (e) { error = String(e); }
      const rect = node.getBoundingClientRect();
      const parent = node.parentElement.getBoundingClientRect();
      const style = getComputedStyle(node);
      return { url, error, naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight,
        rect: rect.toJSON(), parent: parent.toJSON(), display: style.display, visibility: style.visibility,
        draggable: node instanceof HTMLImageElement ? node.draggable : false };
    }));
  });
  console.log('IMAGE_EVIDENCE', JSON.stringify({ selector, count: images.length, failures: images.filter(i => i.error), images }));
  assert.equal(images.length, expected, `${selector}: missing rendered image slots`);
  for (const image of images) {
    assert.ok(!image.error && image.naturalWidth > 0 && image.naturalHeight > 0, JSON.stringify(image));
    assert.ok(image.rect.width > 0 && image.rect.height > 0 && image.display !== 'none' && image.visibility === 'visible', JSON.stringify(image));
    assert.ok(image.rect.left >= image.parent.left - 1 && image.rect.right <= image.parent.right + 1
      && image.rect.top >= image.parent.top - 1 && image.rect.bottom <= image.parent.bottom + 1, `Art clipped by its slot: ${JSON.stringify(image)}`);
    assert.equal(image.draggable, false);
  }
  return { selector, count: images.length, failures: 0, images };
}

export async function inspectGrowthLayout(page, selectors) {
  const boxes = await page.evaluate(selectors => selectors.flatMap(selector => [...document.querySelectorAll(selector)].map(node => {
    const r = node.getBoundingClientRect();
    return { selector, rect: r.toJSON(), overflow: node.scrollWidth - node.clientWidth,
      insideViewport: r.left >= -1 && r.top >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1 };
  })), selectors);
  for (const selector of selectors) assert.ok(boxes.some(box => box.selector === selector), `Missing layout surface: ${selector}`);
  for (const box of boxes) {
    assert.ok(box.insideViewport, `Outside viewport: ${JSON.stringify(box)}`);
    assert.ok(box.overflow <= 1, `Horizontal clipping: ${JSON.stringify(box)}`);
    if (box.selector === '.growth-canvas') assert.ok(box.rect.width >= 200, `Canvas too narrow: ${JSON.stringify(box)}`);
  }
  return boxes;
}

export async function blockRemoteWrites(page) {
  const attempts = [];
  await page.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method()) && !['127.0.0.1', 'localhost'].includes(url.hostname)) {
      attempts.push({ method: request.method(), url: `${url.origin}${url.pathname}` });
      await route.abort('blockedbyclient');
    } else await route.fallback();
  });
  return attempts;
}
