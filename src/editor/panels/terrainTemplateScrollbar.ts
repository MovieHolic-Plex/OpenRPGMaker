export function bindTerrainTemplateScrollbar(scroller: HTMLElement, thumb: HTMLElement): () => void {
  let animationFrame = 0;

  const update = (): void => {
    animationFrame = 0;
    const maxScroll = scroller.scrollHeight - scroller.clientHeight;
    const trackHeight = scroller.clientHeight;
    if (maxScroll <= 0 || trackHeight <= 0) {
      thumb.hidden = true;
      return;
    }
    thumb.hidden = false;
    const thumbHeight = Math.max(48, Math.floor((scroller.clientHeight / scroller.scrollHeight) * trackHeight));
    const maxThumbTop = Math.max(0, trackHeight - thumbHeight);
    const thumbTop = Math.round((scroller.scrollTop / maxScroll) * maxThumbTop);
    thumb.style.height = `${thumbHeight}px`;
    thumb.style.transform = `translateY(${thumbTop}px)`;
  };

  const scheduleUpdate = (): void => {
    if (animationFrame !== 0) return;
    animationFrame = window.requestAnimationFrame(update);
  };

  const resizeObserver = new ResizeObserver(scheduleUpdate);
  resizeObserver.observe(scroller);
  scroller.addEventListener("scroll", scheduleUpdate, { passive: true });
  scheduleUpdate();

  return (): void => {
    if (animationFrame !== 0) window.cancelAnimationFrame(animationFrame);
    resizeObserver.disconnect();
    scroller.removeEventListener("scroll", scheduleUpdate);
  };
}
