/** Give an attached editor shell a paint before building its expensive contents. */
export function afterOpeningPaint(shell: HTMLElement, render: () => void): void {
  // Hidden documents and surfaces without a layout box have no frame to wait for.
  if (document.visibilityState !== "visible" || typeof requestAnimationFrame !== "function" || !shell.offsetWidth) {
    render();
    return;
  }
  let rendered = false;
  const finish = (): void => {
    if (rendered) return;
    rendered = true;
    clearTimeout(fallback);
    render();
  };
  // A window minimized between the click and the frame may stop receiving rAF.
  const fallback = setTimeout(finish, 100);
  requestAnimationFrame(() => setTimeout(finish, 0));
}
