/**
 * 전투 화면 CSS 첫 매칭을 진입 커버 동안 미리 치른다.
 *
 * 왜: 첫 전투 마운트에서 루트 포커스가 강제하는 스타일·레이아웃이 30~50ms 였고(두 번째 전투부터 5ms),
 * 원인은 전투 CSS(battle/*.css, battle-skins/*.css 약 380KB)의 첫 매칭이다. 실제 전투 DOM 을 화면 밖에
 * 한 번 붙였다 떼면 실제 마운트는 9ms 로 준다(브라우저 대조 4회씩). 손으로 쓴 뼈대는 34~60ms 에 그쳤다 —
 * 스킨·배틀러·게이지 규칙이 실제 노드 구조에 걸려 있어서다. 그래서 마운트와 같은 빌더로 만든다.
 *
 * 보이지 않고(visibility:hidden, 화면 밖) 포커스·접근성 트리에 들어가지 않으며(aria-hidden, inert),
 * 같은 동기 호출 안에서 떼어낸다. 명령 패널은 콜백이 필요해 넣지 않는다.
 */
import type { BattleSnapshot } from "@/battle/types";
import { battleSkinFamily, getBattleSkin, resolveSkinId } from "@/battle/skins/registry";
import { store } from "@/project/store";
import { battleField, battlePartyStatus } from "@/player/battleFieldDom";
import { enemyListPanel } from "@/player/battleCommandDom";
import { battleMessageWindow, introDirectorState } from "@/player/battleDirectorDom";
import { applyBattleSystemGraphic } from "@/player/systemGraphics";
import { clearBattleBackdropMotion } from "@/player/battleBackdropMotion";

export function warmBattleStyles(host: HTMLElement, snapshot: BattleSnapshot): void {
  if (typeof document === "undefined" || !host.isConnected) return;
  const system = store.getCurrent().system;
  const skinId = resolveSkinId(system.battleUiStyle);
  const skin = getBattleSkin(skinId);
  const stage = document.createElement("div");
  stage.className = "battle-stage";
  stage.setAttribute("aria-hidden", "true");
  stage.inert = true;
  // Keep inset:0 sizing: overriding only left with -100000px stretches the stage by 100000px.
  stage.style.cssText = "visibility:hidden;pointer-events:none;transform:translateX(-100000px)";
  const scene = document.createElement("section");
  scene.className = "battle-scene";
  scene.dataset.battleUiStyle = system.battleUiStyle === "pokemon" ? "pokemon" : "classic";
  scene.dataset.battleSkin = skinId;
  scene.dataset.battleSkinFamily = battleSkinFamily(skinId);
  scene.dataset.battleTransition = skin.transition;
  scene.dataset.battleHud = skin.hudTemplate;
  scene.dataset.battleLayout = skin.layout;
  scene.dataset.battleDirectorStep = "intro";
  for (const [key, value] of Object.entries(skin.themeVars)) scene.style.setProperty(key, value as string);
  stage.append(scene);
  try {
    applyBattleSystemGraphic(scene);
    const commandHost = document.createElement("div");
    commandHost.className = "battle-command-host";
    scene.append(
      battleField(snapshot),
      battleMessageWindow(introDirectorState(snapshot)),
      enemyListPanel(snapshot),
      commandHost,
      battlePartyStatus(snapshot),
    );
    host.append(stage);
    void scene.offsetHeight;
  } catch {
    // 준비는 최적화일 뿐이다 — 실패해도 실제 마운트가 같은 일을 한다.
  } finally {
    stage.remove();
    // 배경 물결 캔버스는 rAF 루프를 건다 — 한 번도 연결된 적 없는 채로 떼어졌으니 스스로 멈추지 않는다.
    for (const backdrop of scene.querySelectorAll<HTMLElement>("[data-testid='battle-backdrop']")) clearBattleBackdropMotion(backdrop);
  }
}

