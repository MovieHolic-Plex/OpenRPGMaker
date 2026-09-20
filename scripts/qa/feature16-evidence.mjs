// Evidence helpers for the selected engine features. These inspect real DOM;
// they never replace a product surface or synthesize a successful result.
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export async function captureFeatureSurface(page, { path, root, required = [] }) {
  const surface = page.locator(root);
  await surface.waitFor({ state: 'visible', timeout: 30000 });
  for (const selector of required) {
    const control = page.locator(selector);
    await control.scrollIntoViewIfNeeded();
    const geometry = await control.evaluate((node) => {
      const box = node.getBoundingClientRect();
      const failures = [];
      const ownStyle = getComputedStyle(node);
      if (box.width <= 0 || box.height <= 0 || ownStyle.visibility === 'hidden') failures.push('invisible');
      if (box.left < -1 || box.top < -1 || box.right > innerWidth + 1 || box.bottom > innerHeight + 1) failures.push('outside viewport');
      for (let ancestor = node.parentElement; ancestor; ancestor = ancestor.parentElement) {
        const style = getComputedStyle(ancestor), clip = ancestor.getBoundingClientRect();
        if (Number(style.opacity) === 0 || style.visibility === 'hidden') failures.push('hidden ancestor');
        if (/(hidden|clip|auto|scroll)/.test(style.overflowX) && (box.left < clip.left - 2 || box.right > clip.right + 2)) failures.push('clipped horizontally');
        if (/(hidden|clip|auto|scroll)/.test(style.overflowY) && (box.top < clip.top - 2 || box.bottom > clip.bottom + 2)) failures.push('clipped vertically');
      }
      return { failures, box: { x: box.x, y: box.y, width: box.width, height: box.height } };
    });
    assert.deepEqual(geometry.failures, [], `${selector}: ${JSON.stringify(geometry)}`);
  }
  await mkdir(dirname(path), { recursive: true });
  await page.screenshot({ path, animations: 'disabled' });
  return { path, root, required };
}

export async function writeFeatureEvidence(path, { checks, screenshots, errors = [] }) {
  assert.equal(errors.length, 0, `Browser errors: ${errors.join('; ')}`);
  assert(checks.length > 0, 'Evidence must record actual checks');
  assert(screenshots.length > 0, 'Evidence must include a captured surface');
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify({ checks, screenshots, errors }, null, 2) + '\n');
}
