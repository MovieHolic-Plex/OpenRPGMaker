/** Minimal Graphics command recorder, matching Phaser's installed public methods. */
export function graphicsRecorder() {
  return {
    commandBuffer: [] as number[], lines: 0, clears: 0,
    clear() { this.clears++; this.commandBuffer.length = 0; },
    lineStyle(width: number, color: number, alpha: number) { this.commandBuffer.push(6, width, color, alpha); },
    lineBetween(x: number, y: number, ex: number, ey: number) { this.lines++; this.commandBuffer.push(1, 5, x, y, 4, ex, ey, 9); },
    fillStyle(color: number, alpha: number) { this.commandBuffer.push(7, color, alpha); },
    fillRect(x: number, y: number, w: number, h: number) { this.commandBuffer.push(3, x, y, w, h); },
  };
}
