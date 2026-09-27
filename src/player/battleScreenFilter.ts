/**
 * 전투 이벤트의 Tint Screen(m2-046)을 전투장에 그린다: 색조 오버레이 + 색 필터(채도·흑백·세피아).
 *
 * 레이어는 `.battle-field` 의 마지막 자식이다. backdrop-filter 가 그 뒤(배경·배틀러)를 거르고, 배경색이 색조를
 * 얹는다. 명령 창·파티 HUD 는 필드 밖이라 그대로 읽힌다. 전환은 CSS transition(tintDurationMs)이 맡는다.
 * 전투가 끝나면 씬과 함께 사라진다 — 필드 화면 상태(m2Runtime.screen)에는 되돌려 쓰지 않는다.
 */
import type { BattleScreenState } from "@/battle/types";
import { isNeutralScreenFilter, normalizeScreenFilter, screenFilterCss } from "@/project/eventCommands/screenFilter";
import { isVisibleTint, parseTintColor, rgbaToCss } from "@/player/screen/tintModel";

export const BATTLE_SCREEN_LAYER_TESTID = "battle-screen-filter";

export function syncBattleScreenFilter(field: HTMLElement, screen: BattleScreenState | undefined): void {
  let layer = field.querySelector<HTMLElement>(`[data-testid='${BATTLE_SCREEN_LAYER_TESTID}']`);
  const color = parseTintColor(screen?.tint);
  const filter = normalizeScreenFilter(screen?.filter);
  const filterCss = screenFilterCss(filter);
  const tintCss = isVisibleTint(color) ? rgbaToCss(color) : "";
  if (!screen || (!tintCss && isNeutralScreenFilter(filter))) {
    // 트윈 중에 중립으로 돌아가면 transition 이 끝날 때까지 레이어를 남겨 두는 대신 바로 걷는다 —
    // 되돌림은 보통 즉시(0ms)이고, 남은 레이어가 다음 전투 동기화에 섞이지 않게 한다.
    layer?.remove();
    return;
  }
  const signature = `${screen.tint}|${filterCss}|${screen.tintDurationMs}`;
  if (layer?.dataset.signature === signature) return;
  if (!layer) {
    layer = document.createElement("div");
    layer.className = "battle-screen-filter";
    layer.dataset.testid = BATTLE_SCREEN_LAYER_TESTID;
    layer.setAttribute("aria-hidden", "true");
    layer.style.position = "absolute";
    layer.style.inset = "0";
    layer.style.pointerEvents = "none";
    layer.style.zIndex = "30";
    field.append(layer);
  }
  const duration = Math.max(0, Math.round(screen.tintDurationMs));
  layer.style.transition = duration > 0
    ? `background-color ${duration}ms linear, backdrop-filter ${duration}ms linear`
    : "none";
  layer.style.backgroundColor = tintCss || "transparent";
  layer.style.setProperty("backdrop-filter", filterCss || "none");
  layer.style.setProperty("-webkit-backdrop-filter", filterCss || "none");
  layer.dataset.signature = signature;
  layer.dataset.filter = filterCss;
  layer.dataset.tint = tintCss;
}
