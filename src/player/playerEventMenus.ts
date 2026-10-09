/** An event resumes only after its menu closes, including cancel and load. */
export function openEventMenu(root: HTMLElement, render: () => void): Promise<void> {
  render();
  if (!root.querySelector("[data-testid='main-menu']")) return Promise.resolve();
  return new Promise(resolve => {
    const observer = new MutationObserver(() => {
      if (!root.isConnected || !root.querySelector("[data-testid='main-menu']")) {
        observer.disconnect();
        resolve();
      }
    });
    observer.observe(root.ownerDocument, { childList: true, subtree: true });
  });
}
