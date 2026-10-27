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
    // 스타일만 데우면 실제 마운트가 img.src·배경 url 을 처음 요청한다 — 그 요청은 커버가 걷힌 뒤
    // 도착해 첫 프레임을 막는다(2026-10-26 실측: mount 단계 이미지 요청 7건). 그림도 여기서 데운다.
    preloadWarmImages(scene, () => teardownWarmStage(stage, scene));
  } catch {
    // 준비는 최적화일 뿐이다 — 실패해도 실제 마운트가 같은 일을 한다.
    teardownWarmStage(stage, scene);
  }
}

/** 데운 무대를 떼고, 붙였던 동안 걸린 rAF 루프를 세운다. */
function teardownWarmStage(stage: HTMLElement, scene: HTMLElement): void {
  stage.remove();
  // 배경 물결 캔버스는 rAF 루프를 건다 — 한 번도 연결된 적 없는 채로 떼어졌으니 스스로 멈추지 않는다.
  for (const backdrop of scene.querySelectorAll<HTMLElement>("[data-testid='battle-backdrop']")) clearBattleBackdropMotion(backdrop);
}

/** 이 시간을 넘기면 그림을 기다리지 않고 무대를 뗀다 — 준비는 최적화이지 관문이 아니다. */
const WARM_IMAGE_WAIT_MS = 400;

/**
 * 데운 DOM 의 그림을 브라우저가 실제로 받게 만든 뒤 정리한다.
 *
 * 왜 그냥 떼면 안 되는가: img.src 대입이나 배경 url 은 노드가 같은 동기 호출에서 떨어지면 요청이
 * 취소된다. 그래서 무대를 붙인 채로 (1) rAF 한 번으로 레이아웃·페인트 단계를 지나 요청을 내보내고,
 * (2) 그림이 모두 settle 하거나 상한에 닿으면 뗀다. 받은 것은 캐시에 남아 마운트가 다시 요청하지 않는다.
 */
function preloadWarmImages(scene: HTMLElement, cleanup: () => void): void {
  const urls = new Set<string>();
  for (const image of scene.querySelectorAll<HTMLImageElement>("img")) if (image.src) urls.add(image.src);
  for (const node of scene.querySelectorAll<HTMLElement>("*")) {
    const match = /url\(["']?([^"')]+)["']?\)/u.exec(node.style.backgroundImage);
    if (match?.[1]) urls.add(match[1]);
  }
  const settle = (): Promise<unknown> => Promise.all([...urls].map((url) => new Promise<void>((resolve) => {
    const probe = new Image();
    probe.onload = () => resolve();
    probe.onerror = () => resolve();
    probe.src = url;
  })));
  const cap = (): Promise<unknown> => new Promise<void>((resolve) => setTimeout(resolve, WARM_IMAGE_WAIT_MS));
  const done = (): void => cleanup();
  if (urls.size === 0 || typeof requestAnimationFrame !== "function") {
    void Promise.race([settle(), cap()]).then(done);
    return;
  }
  requestAnimationFrame(() => { void Promise.race([settle(), cap()]).then(done); });
}

