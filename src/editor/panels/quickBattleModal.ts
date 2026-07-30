import { createBattleRuntime } from "@/battle/runtime";
import { mountBattleScene, type BattleDomController } from "@/player/battleDom";
import { nextSessionRandom, startSession } from "@/project/session";
import { store } from "@/project/store";
import { el } from "@/util/dom";

// 이전 퀵 전투 모달의 컨트롤러. 새 모달을 열 때 DOM만 지우면 이전 컨트롤러의
// setInterval(200ms 틱)·window keydown 리스너가 남아 보이지 않는 전투의 효과음이
// 들리고 Escape 리스너가 중복된다(결함 1b). testPlayModal.battleSceneController 와
// 동일한 패턴으로 모듈 레벨에서 추적해 새 모달 오픈 시 먼저 destroy() 한다.
let quickBattleController: BattleDomController | null = null;
// 이전 모달의 Escape keydown 리스너 제거 함수. 새 모달 오픈 시 호출해 중복을 막는다.
let removeQuickBattleKeydown: (() => void) | null = null;

// 데이터베이스 기본 레코드 폼의 "퀵 전투 테스트" 버튼(databaseBasicRecordFields.ts)이
// 여는 경량 전투 모달. testPlayModal.openTroopBattleTestModal 과 동일한 세션 기반
// RNG/party/sessionState 를 쓰고, 종료 시 BattleDomController.destroy() 로 틱/키보드
// 리스너를 정리하며, 결과 화면의 확인/Z/클릭이 모달을 닫게 한다.
export function openQuickBattleModal(troopId: string): void {
  // 이전 모달의 컨트롤러·리스너를 먼저 정리한다. 오버레이 DOM만 remove() 하면
  // 이전 전투의 틱·리스너가 영구히 남는다(결함 1b).
  removeQuickBattleKeydown?.();
  removeQuickBattleKeydown = null;
  quickBattleController?.destroy();
  quickBattleController = null;
  const existing = document.querySelector(".quick-battle-modal-overlay");
  if (existing) existing.remove();

  const project = store.getCurrent();
  const troop = project.database.troops.find((t) => t.id === troopId);
  if (!troop) return;

  const overlay = el("div", { class: "quick-battle-modal-overlay", dataset: { testid: "quick-battle-modal" } });
  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.85);
    z-index: 9999;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    font-family: var(--runtime-pixel-font, sans-serif);
  `;

  const modalHeader = el("div", { class: "quick-battle-modal-header" });
  modalHeader.style.cssText = `
    width: 640px;
    background: #1742a5;
    border: 2px solid #e7f2ff;
    border-bottom: 0;
    color: #fff;
    padding: 6px 12px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 12px;
    box-sizing: border-box;
  `;

  const title = el("span", { text: `⚔️ 퀵 전투 시뮬레이션: [${troop.name}]` });
  const closeBtn = el("button", { text: "✕ 닫기 (ESC)", dataset: { testid: "quick-battle-close-btn" } });
  closeBtn.style.cssText = `
    background: #e76f51;
    border: 1px solid #fff;
    color: #fff;
    font-size: 10px;
    padding: 2px 8px;
    cursor: pointer;
    border-radius: 2px;
  `;

  modalHeader.append(title, closeBtn);

  const stageHost = el("div", { class: "quick-battle-stage-host" });
  stageHost.style.cssText = `
    width: 640px;
    height: 480px;
    position: relative;
    background: #000;
    border: 2px solid #e7f2ff;
    box-sizing: border-box;
    overflow: hidden;
  `;

  overlay.append(modalHeader, stageHost);
  document.body.append(overlay);

  const session = startSession(project);
  const runtime = createBattleRuntime({
    project,
    troopId,
    canEscape: true,
    canLose: true,
    party: {
      levels: session.actorLevels,
      experience: session.actorExperience,
      names: session.actorNames,
      // NOTE: main 의 faceResourceIds/faceIndices 는 이 브랜치의 BattlePartyProgress /
      // PlaySession 에 아직 없는 필드다. 얼굴 오버라이드는 이 브랜치 범위 밖이라 뺀다.
      vitals: session.actorVitals,
      paramBonuses: session.actorParamBonuses,
      equipment: session.actorEquipment,
      skillIds: session.actorSkillIds,
      classOverrides: session.classOverrides,
      stateIds: session.actorStateIds,
      partyActorIds: session.partyActorIds,
      battleCommands: session.actorBattleCommands,
    },
    sessionState: {
      switches: session.switches,
      variables: session.variables,
      inventory: session.inventory,
      gold: session.gold,
      partyActorIds: session.partyActorIds,
      actorSkillIds: session.actorSkillIds,
      actorExperience: session.actorExperience,
      actorLevels: session.actorLevels,
      actorBattleCommands: session.actorBattleCommands,
    },
    rng: () => nextSessionRandom(session, "battle"),
  });

  // 결과 화면 "확인" / Z / 클릭 / 자동 타이머 → onResult → 모달 종료.
  const battleController = mountBattleScene({
    host: stageHost,
    runtime,
    onResult: () => close(),
  });
  // 다음 openQuickBattleModal 가 이전 컨트롤러를 정리할 수 있게 등록한다(결함 1b).
  quickBattleController = battleController;

  function close(): void {
    removeQuickBattleKeydown?.();
    removeQuickBattleKeydown = null;
    battleController.destroy();
    if (quickBattleController === battleController) quickBattleController = null;
    overlay.remove();
  }

  closeBtn.onclick = close;

  function onKeydown(e: KeyboardEvent): void {
    if (e.key === "Escape") {
      e.stopPropagation();
      close();
    }
  }
  window.addEventListener("keydown", onKeydown);
  removeQuickBattleKeydown = () => window.removeEventListener("keydown", onKeydown);
}
