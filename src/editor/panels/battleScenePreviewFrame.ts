// 편집기 안 전투 화면 조각 미리보기의 틀(qa1124 항목 7·6).
//
// 전투 스킨 CSS(styles/runtime/battle-skins)는 `.battle-scene[data-battle-…]` 루트 아래 요소만 칠한다. 편집기 탭에 런타임 부품(명령 창 등)을
// 그 스킨 그대로 보이려면 같은 루트 속성을 단 상자 안에 넣어야 한다. 속성은 mountBattleScene(player/battleDom.ts)과 같은 출처
// (스킨 레지스트리·battleSkinFamily·전투 화면 꾸미기 resolveBattleLook·시스템 그래픽)에서 읽는다. 저장소에는 아무것도 쓰지 않는다.
import { preloadRuntimeStyles } from "@/app/runtimeStyles";
import { battleSkinFamily, getBattleSkin, resolveSkinId } from "@/battle/skins/registry";
import { resolveBattleLook } from "@/project/battleLook";
import type { Project } from "@/project/types";
import { applyBattleLook } from "@/player/battleLookDom";
import { applyBattleSystemGraphic } from "@/player/systemGraphics";
import { el } from "@/util/dom";

/** `.battle-scene` 루트(스킨·꾸미기 속성을 단) 미리보기 틀. 장면처럼 필드와 명령 자리(.battle-command-host)를 두어 스킨이 제자리에 놓는다. */
export function battleScenePreviewFrame(project: Project, parts: { readonly field?: readonly HTMLElement[]; readonly command?: HTMLElement }, testid: string): HTMLElement {
  void preloadRuntimeStyles();
  const root = el("section", { class: "battle-scene battle-scene-preview", attrs: { "aria-label": "전투 화면 미리보기" } });
  root.dataset.battleUiStyle = project.system.battleUiStyle === "pokemon" ? "pokemon" : "classic";
  const skinId = resolveSkinId(project.system.battleUiStyle);
  const skin = getBattleSkin(skinId);
  root.dataset.battleSkin = skinId;
  if (skin.motionStyle === "retro") root.dataset.battleMotion = "retro";
  root.dataset.battleSkinFamily = battleSkinFamily(skinId);
  root.dataset.battleHud = skin.hudTemplate;
  root.dataset.battleLayout = skin.layout;
  for (const [key, value] of Object.entries(skin.themeVars)) root.style.setProperty(key, value as string);
  applyBattleSystemGraphic(root, project);
  const field = el("div", { class: "battle-field", children: [...(parts.field ?? [])] });
  const commandHost = el("div", { class: "battle-command-host", children: parts.command ? [parts.command] : [] });
  root.append(field, commandHost);
  if (skin.motionStyle === "retro") applyBattleLook(root, field, resolveBattleLook(project.system.battleLook));
  // 장면은 640×480 논리 무대(01-scene-base.css, position absolute)다 — 틀 폭에 맞춰 --battle-stage-scale 로 줄인다.
  const frame = el("div", { class: "db-battle-scene-preview", dataset: { testid }, children: [root] });
  const fit = (): void => {
    const width = frame.clientWidth;
    if (width > 0) root.style.setProperty("--battle-stage-scale", String(Math.round((width / 640) * 1000) / 1000));
  };
  if (typeof ResizeObserver === "function") new ResizeObserver(fit).observe(frame);
  return frame;
}
