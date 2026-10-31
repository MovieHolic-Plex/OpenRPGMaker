// 자료집 「애니메이션」 탭의 pixelfx 레코드 편집면 — 실제 재생 미리보기, 효과 바꾸기, 앵커(position)·범위(scope), 셀 애니메이션으로 되돌리기.
import { updateDatabaseRecord } from "@/editor/databaseActions";
import { selectLiteral } from "@/editor/panels/databaseControls";
import { openPixelFxPicker } from "@/editor/panels/pixelFxPicker";
import { PIXEL_FX_CATEGORY_LABELS, pixelFxEntry } from "@/pixelfx/catalog";
import { mountPixelFxDom } from "@/pixelfx/domPlayer";
import type { BattleAnimationRecord } from "@/project/types";
import { el } from "@/util/dom";

const STAGE_W = 320;
const STAGE_H = 240;

export function renderPixelFxRecordEditor(animation: BattleAnimationRecord, rerender: () => void): HTMLElement {
  const spec = animation.pixelFx!;
  const entry = pixelFxEntry(spec.effectId);
  const stage = el("div", { dataset: { testid: "db-pixel-fx-stage" } });
  stage.style.cssText = `position:relative;width:${STAGE_W}px;height:${STAGE_H}px;overflow:hidden;background:#141821;border-radius:6px`;
  // 원점(발·착탄점)을 무대 아래쪽 2/3 에 둔다 — 게임에서 캐릭터 발밑에 놓이는 자리와 같다. 2배(전투 무대 배율).
  const play = mountPixelFxDom(spec, { pixelScale: 2, repeat: true });
  play.element.style.left = "50%";
  play.element.style.top = "70%";
  const ground = el("div");
  ground.style.cssText = "position:absolute;left:0;right:0;top:70%;border-top:1px dashed rgba(255,255,255,.18)";
  stage.append(ground, play.element);

  const change = el("button", { class: "btn small primary", text: "효과 바꾸기…", attrs: { type: "button" }, dataset: { testid: "db-pixel-fx-change" } });
  change.addEventListener("click", () => openPixelFxPicker({
    opener: change,
    initial: spec,
    onPick: (next) => { updateDatabaseRecord("battleAnimations", animation.id, { pixelFx: next }); rerender(); },
  }));
  const revert = el("button", { class: "btn small", text: "셀 애니메이션으로 되돌리기", attrs: { type: "button" }, dataset: { testid: "db-pixel-fx-revert" } });
  revert.addEventListener("click", () => { updateDatabaseRecord("battleAnimations", animation.id, { pixelFx: undefined }); rerender(); });

  const info = el("div", {
    children: [
      el("strong", { text: entry ? `${entry.name} · ${entry.id}` : spec.effectId, attrs: { "data-i18n-skip": "" } }),
      el("p", {
        text: entry ? `${PIXEL_FX_CATEGORY_LABELS[entry.category] ?? entry.category} · ${entry.loop ? "반복(전투에서는 한 번)" : "한 번"} · ${entry.duration}초` : "목록에 없는 효과 — 게임에서 그려지지 않습니다",
      }),
      el("p", { text: entry?.desc ?? "", attrs: { "data-i18n-skip": "" } }),
      el("p", { text: `색 ${spec.palette ? "바꿈" : "원래 색"} · ${spec.flip ? "뒤집음" : "뒤집기 자동(대상 쪽)"} · 씨앗 ${spec.seed ?? "기본"}` }),
      selectLiteral("앵커", "db-pixel-fx-position", animation.position ?? "feet", ["feet", "center", "head", "screen"], (value) => {
        updateDatabaseRecord("battleAnimations", animation.id, { position: value });
      }),
      selectLiteral("범위", "db-pixel-fx-scope", animation.scope ?? "singleTarget", ["singleTarget", "allTargets", "screen"], (value) => {
        updateDatabaseRecord("battleAnimations", animation.id, { scope: value });
      }),
      el("div", { children: [change, revert] }),
      el("p", { text: "효과: pixelfx (MIT) · patch-gg/pixelfx" }),
    ],
  });
  info.style.cssText = "display:flex;flex-direction:column;gap:6px;min-width:0;flex:1";
  const root = el("div", { dataset: { testid: "db-pixel-fx-editor" }, children: [stage, info] });
  // 전용 CSS 시트를 늘리지 않는다(고르기 창과 같은 방식) — 무대 옆에 정보 열.
  root.style.cssText = "display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap";
  return root;
}

/** 셀 애니메이션 레코드 위의 한 줄: 「픽셀 효과로 바꾸기…」. */
export function pixelFxConvertRow(animation: BattleAnimationRecord): HTMLElement {
  const button = el("button", { class: "btn small", text: "픽셀 효과로 바꾸기…", attrs: { type: "button" }, dataset: { testid: "db-pixel-fx-convert" } });
  button.addEventListener("click", () => openPixelFxPicker({
    opener: button,
    onPick: (spec) => updateDatabaseRecord("battleAnimations", animation.id, { pixelFx: spec }),
  }));
  const row = el("div", { children: [button, el("span", { text: "시트 대신 코드로 그리는 효과 232종에서 고릅니다." })] });
  row.style.cssText = "display:flex;gap:8px;align-items:center;margin:0 0 8px";
  return row;
}
