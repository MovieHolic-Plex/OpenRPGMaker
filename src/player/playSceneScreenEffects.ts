import { screenColorToRgb } from "@/player/interpreter/commandCatalog";
import { dialogueHost } from "@/player/playSceneDom";
import { el } from "@/util/dom";
import type { PlaySceneContext } from "@/player/playSceneTypes";

// tint/hide screen 같은 "지속형" 화면 효과를 DOM 풀스크린 오버레이로 반영한다.
// 인터프리터는 이 값을 session.m2Runtime.screen 에 기록하며, 이 함수는
// refreshRuntimeSurfaces() 호출 시점(상태 갱신마다)에 함께 호출되어
// 화면 위의 단일 오버레이 레이어를 동기화한다.
//
// 일회형 효과(flash/shake)는 Phaser 카메라 API 로 별도 처리되며 여기서 다루지 않는다.
export function syncScreenEffects(scene: PlaySceneContext): void {
  const host = dialogueHost(scene);
  if (!host) return;

  const screen = scene.session.m2Runtime?.screen;
  const tint = screen?.tint;
  const hidden = screen?.hidden === true;

  // 우선순위: 화면 숨김 > 색조. 둘 다 없으면 레이어 제거.
  if (hidden) {
    upsertScreenLayer(host, "rgba(0,0,0,1)", "screen-hidden");
    return;
  }
  if (tint && tint !== "neutral") {
    const rgba = tintToRgba(tint);
    if (rgba) {
      upsertScreenLayer(host, rgba, "screen-tint");
      return;
    }
  }
  removeScreenLayer(host);
}

function upsertScreenLayer(host: HTMLElement, background: string, mode: string): void {
  let layer = host.querySelector<HTMLElement>("[data-testid='runtime-screen-effect']");
  if (!layer) {
    layer = el("div", {
      class: "runtime-screen-effect",
      dataset: { testid: "runtime-screen-effect" },
    });
    host.append(layer);
  }
  layer.style.background = background;
  layer.dataset.mode = mode;
}

function removeScreenLayer(host: HTMLElement): void {
  host.querySelector("[data-testid='runtime-screen-effect']")?.remove();
}

// tint 값(색 이름 / hex / "r,g,b")을 rgba 오버레이 색으로 변환한다.
// RM2K3 tint 는 색을 입히는 것이므로 반투명(0.45)으로 표현한다.
function tintToRgba(tint: string): string | null {
  if (!tint) return null;
  // "r,g,b[,a]" 형태(게터/기록기가 쓸 수 있음)
  const parts = tint.split(",").map((part) => part.trim());
  if (parts.length >= 3 && parts.every((part) => /^\d+(\.\d+)?$/.test(part))) {
    const r = Number(parts[0]);
    const g = Number(parts[1]);
    const b = Number(parts[2]);
    const a = parts[3] !== undefined ? Number(parts[3]) : 0.45;
    return `rgba(${r},${g},${b},${a})`;
  }
  // 색 이름 / hex
  const rgb = screenColorToRgb(tint);
  return `rgba(${rgb.red},${rgb.green},${rgb.blue},0.45)`;
}
