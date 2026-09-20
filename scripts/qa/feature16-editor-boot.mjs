/** Real boot gates shared by feature evidence scripts. */
export async function readyEditor(page) {
  const deadline = Date.now() + 90000;
  let readySince = 0;
  while (Date.now() < deadline) {
    let overlay = false;
    for (const id of ['login-guest', 'standard-welcome-start', 'coach-mark-skip']) {
      const control = page.getByTestId(id);
      if (!await control.isVisible()) continue;
      overlay = true;
      try { await control.click({ timeout: 1000 }); } catch (error) { if (error.name !== 'TimeoutError') throw error; }
    }
    if (!overlay && await page.getByTestId('edit-canvas').isVisible()) {
      readySince ||= Date.now();
      if (Date.now() - readySince >= 1000) return;
    } else readySince = 0;
    await page.waitForTimeout(100);
  }
  throw new Error('Editor boot did not expose its canvas after dismissing welcome overlays');
}
