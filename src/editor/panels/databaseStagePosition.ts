import { el } from "@/util/dom";

// 도트 미리보기 무대(스킬 탭·도트 연출 탭·몬스터 스킬) 안의 스프라이트 위치.
//
// 무대는 매 프레임 배우·이펙트·숫자 수십 개를 옮긴다. left/top 으로 옮기면 프레임마다 레이아웃이 다시 돌아
// 자료집 전체가 다시 배치됐다(qa1124 항목 5: 3초에 Layout 1.9초). translate 는 레이아웃을 건드리지 않는다.
// left/top 은 0 으로 한 번 고정하고 위치는 translate 로만 준다. CSS 의 transform(뒤집기·scale)과는 따로 합성된다.

export function placeStageNode(node: HTMLElement, x: number, y: number): void {
  if (node.style.left !== "0px") node.style.left = "0px";
  if (node.style.top !== "0px") node.style.top = "0px";
  node.style.translate = `${x}px ${y}px`;
}

// 아래 둘도 같은 이유다. 값이 같아도 hidden·글자를 다시 쓰면 :has() 무효화가 문서 전체로 번지고(qa1124 트레이스),
// textContent 는 글자 노드를 갈아 끼워 레이아웃을 다시 돌린다. 바뀔 때만 쓰고, 글자는 같은 노드의 data 만 바꾼다.
export function setStageHidden(node: HTMLElement, hidden: boolean): void {
  if (node.hidden !== hidden) node.hidden = hidden;
}

export function setStageText(node: HTMLElement, text: string): void {
  const first = node.firstChild;
  if (first && first === node.lastChild && first.nodeType === 3) {
    if ((first as Text).data !== text) (first as Text).data = text;
  } else if (node.textContent !== text) node.textContent = text;
}

// 재생 시각 칩(「0.4 / 1.6초」)은 0.1초마다 글자가 바뀐다. 글자 칸은 바뀔 때마다 레이아웃을 부르므로(qa1124 트레이스:
// 남은 Layout 전부가 이 칩이었다) 캔버스에 그린다. 같은 글자를 캔버스 안 대체 글자로도 두어 읽기·보조기술은 그대로다.
export type StageClock = { readonly element: HTMLElement; readonly set: (text: string) => void };

export function createStageClock(testid: string): StageClock {
  const canvas = el("canvas", { class: "db-skill-animation-chip db-skill-retro-time", dataset: { testid }, attrs: { role: "timer" } }) as HTMLCanvasElement;
  let shown = "";
  let size: { readonly width: number; readonly height: number; readonly font: string; readonly color: string } | undefined;
  let retry = 0;
  const measure = (): boolean => {
    if (size) return true;
    if (!canvas.isConnected || typeof getComputedStyle !== "function") return false;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!width || !height) return false;
    const ratio = Math.max(1, Math.round(globalThis.devicePixelRatio || 1));
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    canvas.getContext("2d")?.setTransform(ratio, 0, 0, ratio, 0, 0);
    const style = getComputedStyle(canvas);
    size = { width, height, font: `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`, color: style.color };
    return true;
  };
  const draw = (): void => {
    const context = typeof canvas.getContext === "function" ? canvas.getContext("2d") : null;
    if (!context) return;
    if (!measure()) {
      // 아직 문서에 붙기 전이다. 몇 프레임 뒤에 한 번 더 그린다(정지 상태 무대도 시각이 보이게).
      if (retry < 30 && typeof requestAnimationFrame === "function") { retry += 1; requestAnimationFrame(draw); }
      return;
    }
    const box = size!;
    context.clearRect(0, 0, box.width, box.height);
    context.font = box.font;
    context.fillStyle = box.color;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(shown, box.width / 2, box.height / 2);
  };
  return {
    element: canvas,
    set: (text) => {
      if (text === shown) return;
      shown = text;
      setStageText(canvas, text);
      draw();
    },
  };
}
