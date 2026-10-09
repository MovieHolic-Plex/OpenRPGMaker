/** Wait for the actual project load, not the toolbar that renders before it. */
export async function waitForEditorProject(page) {
  await page.evaluate(async () => {
    const path = "/src/project/store.ts";
    const { store } = await import(path);
    if (store.isLoaded()) return;
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        unsubscribe();
        reject(new Error("Editor project load did not complete"));
      }, 60000);
      const unsubscribe = store.subscribe(() => {
        if (!store.isLoaded()) return;
        clearTimeout(timeout);
        unsubscribe();
        resolve();
      });
    });
  });
}
