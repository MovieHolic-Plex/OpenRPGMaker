import type { BattleActionBeat } from "@/player/battleActionBeats";
import { fitBattleEnemy } from "@/player/battleEnemyFit";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import {
  battlerIdleAnimation,
  battlerIdleAnimationDurationMs,
  battlerIdleAnimationUrl,
  type BattlerIdleAnimation,
} from "@/assets/battlerIdleAnimations";
import type { BattleBattlerSnapshot, BattleSnapshot } from "@/battle/runtime";
import { POSE_FRAME } from "@/battle/battlePose";
import { skinPartySpriteUrl } from "@/battle/partySpriteResources";
import { getBattleSkin, resolveSkinId } from "@/battle/skins/registry";
import type { BattleSkin } from "@/battle/skins/types";
import {
  BATTLER_PLACEMENTS,
  resolveSkinEnemyPositions,
} from "@/battle/battlerPlacements";
export {
  BATTLER_PLACEMENTS,
  CANONICAL_SIDEVIEW_ANCHOR_X,
  MANUAL_FRONTAL_DAMPING,
  resolveManualFrontalRow,
  resolveSkinEnemyPosition,
  resolveSkinEnemyPositions,
  RM2000_PARTY_SLOTS,
  type BattlerPartyFacing,
} from "@/battle/battlerPlacements";
import type { DamageFeedback } from "@/player/battleSequencer";
import type { BattlePresentationLedger } from "@/player/battlePresentation";
import { BATTLE_ASSET_PIXEL_SCALE } from "@/player/battleStageScale";
import { battlerHiresSheet, battlerHiresSheetUrl } from "@/assets/battlerHiresSheets";
import { defaultActorFaceResourceId } from "@/project/actorFaceDefaults";
import { store } from "@/project/store";

/** 같은 이름이 둘 이상이면 1-base 순번을 붙여 구분한다("초원 슬라임 1/2").
 *  필드 이름표·대상 목록·전투 로그가 **같은 문자열**을 쓰도록 이 함수 하나만 쓴다 —
 *  이름표만 원본 이름을 쓰던 시절엔 동명 2마리가 화면에서 전혀 구분되지 않았다(실상). */
export function disambiguatedBattlerName(
  battler: BattleBattlerSnapshot,
  peers: readonly BattleBattlerSnapshot[],
): string {
  const duplicates = peers.filter((peer) => peer.name === battler.name);
  if (duplicates.length < 2) return battler.name;
  const index = duplicates.findIndex((peer) => peer.id === battler.id);
  return `${battler.name} ${Math.max(0, index) + 1}`;
}

/** targetId(적 id·아군 배틀러 id·recordId)를 실제 DOM 노드로 해석한다.
 *  아군 노드 testid는 `battle-actor-<recordId>`라 직접 조회가 실패하던 버그의 단일 수정 지점. */
export function findBattlerNode(scope: HTMLElement | Document, targetId: string): HTMLElement | null {
  return scope.querySelector<HTMLElement>(`[data-testid="${targetId}"]`)
    ?? scope.querySelector<HTMLElement>(`[data-testid="battle-actor-${targetId}"]`)
    ?? scope.querySelector<HTMLElement>(`.battle-enemy[data-record-id="${targetId}"]`);
}

/**
 * 배틀러 노드에서 **그림이 실제로 그려지는 자식**을 고른다.
 *
 * 노드를 그대로 재면 안 된다 — 아군 노드는 `.battle-actor-group .battle-actor { width: 176px;
 * height: 192px }` 로 고정된 그리드 박스라 노드 중심과 스프라이트 중심이 다르다. 몬스터
 * 배틀러도 `battle-actor-image battle-monster-image battle-monster-back` 로 첫 클래스를
 * 공유하므로 이 목록에 걸린다.
 *
 * 데미지 팝업과 애니메이션 앵커가 **같은 목록**을 쓰게 하려고 export 한다. 두 곳이 각자
 * 선택자를 들고 있으면 한쪽만 고쳐졌을 때 숫자와 이펙트가 서로 다른 높이에 뜬다.
 */
export function battlerSpriteNode(node: HTMLElement): HTMLElement {
  return node.querySelector<HTMLElement>(
    ".battle-enemy-image, .battle-actor-image, .battle-actor-sprite"
  ) ?? node;
}

/** 현재 프로젝트 설정에서 활성 전투 스킨을 해석한다. */
function activeSkin(): BattleSkin {
  return getBattleSkin(resolveSkinId(store.getCurrent().system.battleUiStyle));
}

/** 정면 스킨(드퀘·마더·rm2000)은 아군 필드 노드를 만들지 않는다 — 그때 파티 상태 행이
 *  아군 상태 배지의 유일한 살림터다. 필드 노드가 있는 스킨에도 행에 달면 같은 testid 가
 *  두 번 생기므로 이 조건으로만 단다. */
function partyStatusRowsCarryIcons(): boolean {
  return BATTLER_PLACEMENTS[activeSkin().id].partyFacing === "hidden";
}

/** 스킨 전용 적 스프라이트(bskin-enemy-<id>)를 우선 사용. 없으면 null. */
function skinEnemySpriteUrl(): string | null {
  return resolveAssetResourceUrl(`bskin-enemy-${activeSkin().id}`, { project: store.getCurrent() });
}

/**
 * 등록된 idle 애니메이션을 `<img>` 배틀러에 얹는다.
 *
 * 엘리먼트는 `<img>` 그대로 두고 `src` 도 정적 원본을 유지한다 — 스킨별 width/height
 * `!important` 규칙이 intrinsic 크기를 전제로 걸려 있고, rect 프로브와 `naturalWidth` 대기,
 * `src` 계약이 모두 이 엘리먼트를 본다. CSS 는 내용 이미지를 상자 밖으로 밀고 배경 스트립을
 * 그린다(`src/styles/runtime/battle-skins/_battlers.css` 의 배틀러 idle 애니메이션 절).
 * 카탈로그에 없으면 아무것도 하지 않는다 = 지금까지의 정적 렌더.
 */
function applyIdleAnimationToImage(image: HTMLImageElement, resourceId: string | undefined): void {
  const anim = battlerIdleAnimation(resourceId);
  if (!anim || anim.tier !== "image-strip") return;
  const url = battlerIdleAnimationUrl(anim);
  image.dataset.battlerAnim = anim.resourceId;
  image.style.setProperty("--battler-anim-url", `url("${url}")`);
  image.style.setProperty("--battler-anim-frames", String(anim.frameCount));
  image.style.setProperty("--battler-anim-duration", `${battlerIdleAnimationDurationMs(anim)}ms`);
  // 스트립을 못 불러오면 배경이 비고, 내용 이미지는 상자 밖에 있으므로 **빈 상자**가 된다.
  // 그때는 애니메이션 표시를 걷어 정적 `src` 가 다시 보이게 한다 — 주석이 약속한 폴백이
  // 에셋 실패에도 성립해야 한다. 프리로드는 CSS 배경 요청과 같은 URL 이라 캐시에서 합쳐진다.
  const probe = new Image();
  probe.addEventListener("error", () => {
    delete image.dataset.battlerAnim;
    image.style.removeProperty("--battler-anim-url");
    image.style.removeProperty("--battler-anim-frames");
    image.style.removeProperty("--battler-anim-duration");
  });
  probe.src = url;
}

/**
 * 48px 전투 캐릭터셋 스프라이트를 idle 스트립으로 바꾼다.
 * 세로(포즈 행)는 인라인으로 남기고 가로만 CSS 애니메이션이 굴린다 — 롱핸드가 달라서
 * 애니메이션이 인라인 포즈 오프셋을 덮지 않는다.
 */
function applyIdleAnimationToSheetSprite(sprite: HTMLElement, anim: BattlerIdleAnimation, frameW: number): void {
  // 이미 같은 스트립을 돌리는 중이면 아무것도 다시 쓰지 않는다. `backgroundImage` 를 매번
  // 재대입하면 브라우저에 따라 애니메이션 루프가 처음으로 되감긴다.
  if (sprite.dataset.battlerAnim === anim.resourceId) return;
  // 시트 셀(48px)과 화면 프레임 폭(96px = 셀 × BATTLE_ASSET_PIXEL_SCALE)의 배율.
  const scale = frameW / anim.cellWidth;
  sprite.dataset.battlerAnim = anim.resourceId;
  sprite.style.setProperty("--battler-anim-frames", String(anim.frameCount));
  sprite.style.setProperty("--battler-anim-duration", `${battlerIdleAnimationDurationMs(anim)}ms`);
  sprite.style.backgroundImage = `url("${battlerIdleAnimationUrl(anim)}")`;
  sprite.style.backgroundSize = `${anim.frameCount * anim.cellWidth * scale}px ${anim.cellHeight * scale}px`;
  sprite.style.backgroundPositionX = "0px";
  sprite.style.backgroundPositionY = "0px";
}

/** idle 스트립을 걷고 정적 시트로 되돌린다. 되돌릴 원본은 생성 시점에 노드에 적어 둔다. */
function clearIdleAnimationOnSheetSprite(sprite: HTMLElement): void {
  // 가드는 "복원 스킵" 이 아니라 **한 번도 애니메이션을 켠 적 없는 스프라이트** 용이다.
  // apply 는 항상 `dataset.battlerAnim` 을 먼저 쓰므로, 켠 적이 있으면 여기로 들어온다.
  if (!sprite.dataset.battlerAnim) return;
  delete sprite.dataset.battlerAnim;
  sprite.style.removeProperty("--battler-anim-frames");
  sprite.style.removeProperty("--battler-anim-duration");
  // apply 가 심은 롱핸드를 직접 지운다. 지금은 호출자가 곧바로 숏핸드 `background-position` 을
  // 쓰지만, 그 순서에 복원을 기대면 조용히 깨진다.
  sprite.style.removeProperty("background-position-x");
  sprite.style.removeProperty("background-position-y");
  const sheetUrl = sprite.dataset.battlerSheetUrl;
  const sheetSize = sprite.dataset.battlerSheetSize;
  if (sheetUrl) sprite.style.backgroundImage = `url("${sheetUrl}")`;
  if (sheetSize) sprite.style.backgroundSize = sheetSize;
}


export function battleField(snapshot: BattleSnapshot): HTMLElement {
  const field = document.createElement("div");
  field.className = "battle-field";
  field.dataset.testid = "battle-field";
  field.append(
    battleBackdrop(snapshot.backdropResourceId),
    battleTitle(snapshot.troopId),
    enemyGroup(snapshot.enemies, snapshot),
    actorSpriteGroup(snapshot.actors)
  );
  return field;
}

export interface BattleFieldPresentation {
  readonly ledger?: BattlePresentationLedger;
  /** 시퀀스가 돌지 않는 화면(명령/타깃 선택)에서 지난 액션의 attack/hit pose 잔류를 걷는다. */
  readonly calm?: boolean;
  /** 지금 impact 비트로 맞고 있는 배틀러 — 이 배틀러만 hit pose 를 보여준다. */
  readonly hitTargetId?: string;
}

export function syncBattleField(
  field: HTMLElement,
  snapshot: BattleSnapshot,
  feedback?: DamageFeedback,
  presentation?: BattleFieldPresentation,
): void {
  syncBackdrop(field, snapshot.backdropResourceId);
  syncEnemyGroup(field, snapshot, presentation);
  syncActorGroup(field, snapshot, presentation);
  if (feedback) showDamageFeedback(field, feedback);
}

/** 원장이 있으면 원장의 HP/사망을, 없으면 스냅샷 값을 쓴다. 연출이 상태를 앞지르지 않게
 *  하는 단일 지점 — pose 도 원장 기준으로 보정한다(아직 안 죽었으면 dead 를 보여주지 않는다).
 *  calm(명령 화면)에서는 지난 액션의 attack/hit pose 를 idle/defend 로 되돌린다 —
 *  런타임의 lastActionResult 는 라운드가 끝나도 남기 때문(적 pose=attack 박제 결함). */
function presentedState(
  battler: BattleBattlerSnapshot,
  presentation: BattleFieldPresentation | undefined,
): { hp: number; defeated: boolean; pose: BattleBattlerSnapshot["pose"] } {
  const ledger = presentation?.ledger;
  const vitals = ledger?.vitalsFor(battler.id) ?? ledger?.vitalsFor(battler.recordId);
  let pose = battler.pose;
  if (presentation?.calm && (pose === "attack" || pose === "hit")) {
    pose = battler.defending ? "defend" : "idle";
  }
  // 스냅샷 pose 는 라운드 "마지막" 액션 기준이라 비트 중에는 엉뚱한 배틀러가 hit 로
  // 보일 수 있다 — 지금 재생 중인 impact 의 대상에게만 hit 를 준다.
  const beingHit = presentation?.hitTargetId !== undefined
    && (presentation.hitTargetId === battler.id || presentation.hitTargetId === battler.recordId);
  if (!vitals) {
    if (beingHit && !battler.defeated) pose = "hit";
    return { hp: battler.hp, defeated: battler.defeated, pose };
  }
  const defeated = vitals.defeated;
  if (!defeated && (pose === "dead" || beingHit)) pose = beingHit ? "hit" : "idle";
  if (defeated) pose = "dead";
  return { hp: vitals.hp, defeated, pose };
}

export function battlePartyStatus(snapshot: BattleSnapshot): HTMLElement {
  return partyStatusGroup(snapshot.actors, snapshot.battleFlow);
}

export function syncBattleParty(party: HTMLElement, snapshot: BattleSnapshot, presentation?: BattleFieldPresentation): void {
  // 파티 패널은 마운트 시 한 번만 만들어지고 호출자가 요소 참조를 쥐고 있다. 교대(멤버 교체)로
  // 스냅샷의 액터 집합과 DOM 행 집합이 어긋나면, 새로 들어온 액터의 행은 없어 스킵되고 빠져나간
  // 액터의 행은 마지막 클래스를 그대로 유지한다. 그 액터가 교대 직전 활성 액터였다면 파티에 없는
  // 셀에 `is-active-actor`(▼)가 박혀 있고 HP/MP 도 옛 값으로 굳는다. 그래서 집합이 다를 때만
  // partyStatusGroup 으로 행을 통째로 다시 만들어 갈아끼운다(battleFlow 는 스냅샷에서 얻는다).
  // 재구성 후 아래 갱신 루프가 activeActorId 하나에만 ▼ 를 붙이므로 활성 표식은 항상 하나다.
  // 집합이 같을 때는 절대 재생성하지 않는다 — 얼굴 노드의 Image 프로브가 매 틱 다시 돌면
  // 초상이 깜빡이고 프로브 요청이 폭증하기 때문이다.
  if (!partyRowsMatchSnapshot(party, snapshot)) {
    const rebuilt = partyStatusGroup(snapshot.actors, snapshot.battleFlow);
    party.replaceChildren(...Array.from(rebuilt.childNodes));
  }
  for (const actor of snapshot.actors) {
    const row = party.querySelector<HTMLElement>(`.battle-actor-status[data-record-id="${actor.recordId}"]`);
    if (!row) continue;
    const level = row.querySelector(".battle-actor-level .battle-vital-value");
    if (level && actor.level !== undefined) level.textContent = ` ${actor.level}`;
    const presented = presentedState(actor, presentation);
    const hp = row.querySelector(".battle-actor-hp");
    if (hp) setVitalNode(hp, "hp", presented.hp, actor.maxHp);
    const mp = row.querySelector(".battle-actor-mp");
    if (mp) setVitalNode(mp, "mp", actor.mp, actor.maxMp);
    // 참조의 ▼ 표식 — 지금 명령을 입력받는 액터의 셀 위에 붙는다(실제 스냅샷 값).
    row.classList.toggle("is-active-actor", Boolean(snapshot.activeActorId) && actor.recordId === snapshot.activeActorId);
    const hpBar = row.querySelector<HTMLElement>(".battle-stat-bar-hp");
    if (hpBar) {
      const pct = hpPercent(presented.hp, actor.maxHp);
      hpBar.style.setProperty("--battle-stat", `${pct}%`);
      hpBar.dataset.hpState = hpBarState(pct);
    }
    const mpBar = row.querySelector<HTMLElement>(".battle-stat-bar-mp");
    if (mpBar) mpBar.style.setProperty("--battle-stat", `${hpPercent(actor.mp, actor.maxMp)}%`);
    const gaugePct = Math.max(0, Math.min(100, Math.round(actor.gauge)));
    const atbBar = row.querySelector<HTMLElement>(".battle-atb-bar");
    if (atbBar) atbBar.style.setProperty("--battle-atb", `${gaugePct}%`);
    const atbValueNode = row.querySelector<HTMLElement>(".battle-atb-value");
    if (atbValueNode) atbValueNode.textContent = `${gaugePct}%`;
    if (partyStatusRowsCarryIcons()) {
      // 이름 셀 안에 넣으면 rm2000 계열의 overflow:hidden + 고정 폭 열에 잘린다(실측:
      // 배지가 2px 조각으로만 보임) — 행의 직계 자식으로 달고 배치는 스킨 CSS 가 한다.
      syncStatusIcons(row, { ...actor, defeated: presented.defeated });
    }
    let strictOrder = row.querySelector<HTMLElement>(".battle-strict-order");
    if (snapshot.battleFlow === "strict") {
      if (!strictOrder) {
        strictOrder = document.createElement("span");
        strictOrder.className = "battle-strict-order";
        row.append(strictOrder);
      }
      const pendingIndex = snapshot.strictPendingActorIds.indexOf(actor.recordId);
      strictOrder.textContent = snapshot.strictQueuedActorIds.includes(actor.recordId)
        ? "입력 완료"
        : pendingIndex >= 0 ? `대기 ${pendingIndex + 1}` : "행동 불가";
    } else {
      strictOrder?.remove();
    }
    row.classList.toggle("defeated", presented.defeated);
  }
}

/** 스냅샷의 액터 recordId 집합과 현재 DOM 행의 recordId 집합이 같은지 비교한다.
 *  다르면 교대 등으로 파티 구성이 바뀐 것이므로 파티 패널을 재구성해야 한다. */
function partyRowsMatchSnapshot(party: HTMLElement, snapshot: BattleSnapshot): boolean {
  const snapshotIds = new Set(snapshot.actors.map((actor) => actor.recordId));
  const rows = party.querySelectorAll<HTMLElement>(".battle-actor-status[data-record-id]");
  if (rows.length !== snapshotIds.size) return false;
  for (const row of rows) {
    if (!snapshotIds.has(row.dataset.recordId ?? "")) return false;
  }
  return true;
}

/** 트룹/시스템에서 지정한 배경을 스킨 기본 배경보다 우선한다.
 *  트룹 배경이 없으면 스킨 기본 배경으로 폴백한다. */
function effectiveBackdropId(resourceId: string | undefined): string | undefined {
  return resourceId ?? activeSkin().defaultBackdropResourceId;
}

function syncBackdrop(field: HTMLElement, resourceId: string | undefined): void {
  const backdrop = field.querySelector<HTMLElement>("[data-testid='battle-backdrop']");
  if (!backdrop) return;
  const effectiveId = effectiveBackdropId(resourceId);
  if (effectiveId && backdrop.dataset.backdropResourceId !== effectiveId) {
    backdrop.dataset.backdropResourceId = effectiveId;
    const url = resolveAssetResourceUrl(effectiveId, { project: store.getCurrent() });
    backdrop.style.backgroundImage = url ? battleBackdropImage(url) : "";
    syncSceneBackdropVar(field);
  }
}

/** 필드의 배경 그림을 씬 루트(.battle-scene)에 `--battle-backdrop-url` 로 비춘다.
 *  스킨 CSS 가 HUD 띠 뒤에 같은 그림을 흐리게 이어 그릴 수 있게(rm2000: `.battle-scene::before`).
 *  필드는 1행만 차지하고 overflow:hidden 이라 필드 안의 요소로는 HUD 띠까지 닿을 수 없고,
 *  형제(카드)들은 필드의 인라인 스타일을 읽을 수 없다 — 루트 변수가 유일한 통로다.
 *  아직 루트에 붙지 않은 필드(생성 직후)면 아무것도 하지 않으므로 마운트 뒤 한 번 더 부른다. */
export function syncSceneBackdropVar(field: HTMLElement): void {
  const scene = field.parentElement;
  if (!scene || !scene.classList.contains("battle-scene")) return;
  const image = field.querySelector<HTMLElement>("[data-testid='battle-backdrop']")?.style.backgroundImage ?? "";
  if (image && image !== "none") scene.style.setProperty("--battle-backdrop-url", image);
  else scene.style.removeProperty("--battle-backdrop-url");
}

function syncEnemyGroup(field: HTMLElement, snapshot: BattleSnapshot, presentation?: BattleFieldPresentation): void {
  const group = field.querySelector(".battle-enemy-group");
  if (!group) return;
  const positions = resolveEnemyRowPositions(snapshot, snapshot.enemies);
  for (const [index, enemy] of snapshot.enemies.entries()) {
    let node = group.querySelector<HTMLElement>(`[data-testid="${enemy.id}"]`);
    if (!node) {
      group.append(enemyButton(enemy, snapshot, index, positions[index]));
      node = group.querySelector<HTMLElement>(`[data-testid="${enemy.id}"]`);
    }
    if (!node) continue;
    syncEnemyNode(node, enemy, snapshot, presentation);
    const position = fitBattleEnemy(field, node, positions[index]);
    positionBattleNode(node, position.x, position.y);
  }
}

/* 옛 `alignEnemyFeetToAuthoredY` 가 여기 있었다.
 *
 * 저작 y 를 스프라이트의 **발**로 읽히게 하려고 (node.bottom − image.bottom) 을 실측해
 * 노드 top 에 더했다. 전제는 "노드 높이는 불변" 이었는데, 적 HUD 를 펼치고 접을 때마다
 * 높이가 변해서 전제가 깨졌다 — 그래서 몬스터가 흰 HUD 박스에 따라 눈에 보이게 튀었다.
 * 이제 이름·HUD 를 `.battle-enemy-chrome` 으로 흐름에서 빼내 노드 높이 = 스프라이트 높이가
 * 되므로, 실측 보정 자체가 필요 없다. CSS 의 `--battle-enemy-label-drop` 도 함께 지웠다. */

function syncActorGroup(field: HTMLElement, snapshot: BattleSnapshot, presentation?: BattleFieldPresentation): void {
  const group = field.querySelector(".battle-actor-group");
  if (!group) return;
  for (const actor of snapshot.actors) {
    const node = group.querySelector<HTMLElement>(`[data-testid="battle-actor-${actor.recordId}"]`);
    if (!node) continue;
    const targetable = snapshot.targetSelection?.side === "actor" && snapshot.targetSelection.targetIds.some((id) => id === actor.id || id === actor.recordId);
    const selected = snapshot.targetSelection?.side === "actor" && (snapshot.targetSelection.selectedTargetId === actor.id || snapshot.targetSelection.selectedTargetId === actor.recordId);
    node.classList.toggle("battle-target-candidate", targetable);
    node.classList.toggle("battle-target-selected", selected);
    node.classList.toggle("is-active-actor", Boolean(snapshot.activeActorId) && actor.recordId === snapshot.activeActorId);
    node.dataset.battleTargetable = targetable ? "true" : "false";
    if (targetable) {
      const targetId = snapshot.targetSelection?.targetIds.find((id) => id === actor.id || id === actor.recordId);
      if (targetId) node.dataset.battleTargetId = targetId;
    } else {
      delete node.dataset.battleTargetId;
    }
    node.setAttribute("aria-selected", selected ? "true" : "false");
    const brackets = node.querySelector<HTMLElement>(".battle-target-brackets");
    if (selected && !brackets) {
      const next = document.createElement("span");
      next.className = "battle-target-brackets";
      next.dataset.testid = "battle-target-brackets";
      next.setAttribute("aria-hidden", "true");
      node.append(next);
    } else if (!selected) {
      brackets?.remove();
    }
    const presented = presentedState(actor, presentation);
    node.classList.toggle("defeated", presented.defeated);
    applyBattlerPose(node, presented.pose);
    // KO 배지는 연출 원장(presented)을 따른다 — 스냅샷은 명령 즉시 해결돼 타격 연출 전에 이미 죽어 있다.
    syncStatusIcons(node, { ...actor, defeated: presented.defeated });
  }
}

function syncEnemyNode(node: HTMLElement, enemy: BattleBattlerSnapshot, snapshot: BattleSnapshot, presentation?: BattleFieldPresentation): void {
  const presented = presentedState(enemy, presentation);
  const targetable = snapshot.targetSelection?.side === "enemy" && snapshot.targetSelection.targetIds.includes(enemy.id);
  const selected = snapshot.targetSelection?.side === "enemy" && snapshot.targetSelection.selectedTargetId === enemy.id;
  node.classList.toggle("battle-target-candidate", targetable);
  node.classList.toggle("battle-target-selected", selected);
  // 쓰러지는 순간(살아 있음 → 격파) 조각을 한 번 뿌린다. 이후 동기화에서는 다시 뿌리지 않는다.
  if (presented.defeated && !node.classList.contains("defeated")) spawnDeathShards(node);
  node.classList.toggle("defeated", presented.defeated);
  applyBattlerPose(node, presented.pose);
  node.dataset.battleTargetable = targetable ? "true" : "false";
  if (targetable) node.dataset.battleTargetId = enemy.id;
  else delete node.dataset.battleTargetId;
  if (node instanceof HTMLButtonElement) {
    node.disabled = enemy.defeated || !targetable;
  }
  const existingBrackets = node.querySelector<HTMLElement>(".battle-target-brackets");
  if (selected && !existingBrackets) {
    const brackets = document.createElement("span");
    brackets.className = "battle-target-brackets";
    brackets.dataset.testid = "battle-target-brackets";
    brackets.setAttribute("aria-hidden", "true");
    node.append(brackets);
  } else if (!selected) {
    existingBrackets?.remove();
  }
  if (!node.querySelector(".battle-enemy-hud")) {
    // chrome 겹 안에 넣는다 — 노드 직계로 붙이면 흐름 높이가 늘어 발 위치가 흔들린다.
    (node.querySelector<HTMLElement>(".battle-enemy-chrome") ?? node).append(enemyHpHud(enemy));
  }
  // 한 번이라도 피해를 입은 적은 HP 를 계속 보여준다.
  //
  // rm2000 스킨은 원작 고증을 이유로 적 HUD 를 targetSelect 중 선택된 적에게만 펼쳤다.
  // 그 결과 "한 방 더면 죽는다" 는 판단이 구조적으로 불가능해 모든 턴이 같은 무게가
  // 됐다. 아직 안 때린 적은 그대로 감추고(정보 수집도 플레이다), 때린 순간부터 남은
  // 체력을 노출한다. CSS 가 [data-battle-hp-revealed="true"] 로 HUD 를 펼친다.
  node.dataset.battleHpRevealed = presented.hp < enemy.maxHp ? "true" : "false";
  const hpText = node.querySelector<HTMLElement>(".battle-enemy-hp-text");
  if (hpText) hpText.textContent = `${presented.hp}/${enemy.maxHp}`;
  const hpBar = node.querySelector<HTMLElement>(".battle-enemy-hp-bar");
  if (hpBar) hpBar.style.setProperty("--battle-stat", `${hpPercent(presented.hp, enemy.maxHp)}%`);
  const mpBar = node.querySelector<HTMLElement>(".battle-enemy-mp-bar");
  if (mpBar) mpBar.style.setProperty("--battle-stat", `${hpPercent(enemy.mp, enemy.maxMp)}%`);
  const atbBar = node.querySelector<HTMLElement>(".battle-enemy-atb-bar");
  if (atbBar) atbBar.style.setProperty("--battle-stat", `${clampGauge(enemy.gauge)}%`);
  // KO 배지는 연출 원장(presented)을 따른다 — 스냅샷은 명령 즉시 해결돼 타격 연출 전에 이미 죽어 있다
  // (실측: 불꽃이 닿기 전 「KO 74/144」 가 떴다).
  syncStatusIcons(node, { ...enemy, defeated: presented.defeated });
}

/**
 * 테스트 전용 진입점 — `test/battlerPoseFrame.test.ts` 가 backgroundPosition 산식을 잰다.
 * 전투 스냅샷 하나를 굴리지 않고 포즈만 바꿔볼 수 있어야 회귀가 산식 단위에서 잡힌다.
 */
export function applyBattlerPoseForTest(node: HTMLElement, pose: BattleBattlerSnapshot["pose"]): void {
  applyBattlerPose(node, pose);
}

function applyBattlerPose(node: HTMLElement, pose: BattleBattlerSnapshot["pose"]): void {
  node.dataset.battlePose = pose;
  node.classList.toggle("battle-pose-idle", pose === "idle");
  node.classList.toggle("battle-pose-attack", pose === "attack");
  node.classList.toggle("battle-pose-hit", pose === "hit");
  node.classList.toggle("battle-pose-defend", pose === "defend");
  node.classList.toggle("battle-pose-dead", pose === "dead");
  const sprite = node.querySelector<HTMLElement>(".battle-actor-sprite, .battle-enemy-image, .battle-actor-image");
  if (sprite?.classList.contains("battle-actor-sprite")) {
    // 생성 전투 시트는 5포즈가 (열, 행) 좌표를 갖는다 — POSE_FRAME 이 정본이다.
    // 2026-08-29 까지는 X 만 움직여 defend 가 idle 칸을, dead 가 hit 칸을 돌려 썼다.
    // 프레임 크기는 actorBattleImage 가 심은 인라인 커스텀 프로퍼티와 같아야 한다
    // (BATTLE_SHEET_CELL × BATTLE_ASSET_PIXEL_SCALE).
    const fallback = BATTLE_SHEET_CELL * BATTLE_ASSET_PIXEL_SCALE;
    const frameW = Number.parseFloat(sprite.style.getPropertyValue("--battle-sprite-frame-width")) || fallback;
    const frameH = Number.parseFloat(sprite.style.getPropertyValue("--battle-sprite-frame-height")) || fallback;
    // idle 은 전투의 기본 상태다 — 카탈로그에 스트립이 있으면 숨을 심는다.
    // idle 이 아닌 포즈는 사건 연출이므로 정적 칸으로 즉시 돌아간다(POSE_FRAME 이 이긴다).
    const idleAnimation = pose === "idle" ? battlerIdleAnimation(sprite.dataset.battlerResourceId) : undefined;
    if (idleAnimation?.tier === "sheet-cell") {
      applyIdleAnimationToSheetSprite(sprite, idleAnimation, frameW);
      return;
    }
    clearIdleAnimationOnSheetSprite(sprite);
    const frame = POSE_FRAME[pose] ?? POSE_FRAME.idle;
    // 0 에는 음수 부호를 붙이지 않는다 — CSSOM 이 "-0px" 를 "0px" 로 정규화하므로 그대로 두면
    // 우리가 쓴 값과 읽히는 값이 달라진다(실측: happy-dom).
    const offset = (value: number) => (value === 0 ? "0px" : `-${value}px`);
    sprite.style.backgroundPosition = `${offset(frame.col * frameW)} ${offset(frame.row * frameH)}`;
  }
}

function showDamageFeedback(field: HTMLElement, feedback: DamageFeedback): void {
  const layer = field.querySelector<HTMLElement>(".battle-effects-layer")
    ?? appendEffectsLayer(field);
  const popup = document.createElement("span");
  popup.className = "battle-damage-popup";
  popup.dataset.testid = "battle-damage-popup";
  popup.dataset.targetId = feedback.targetId;
  popup.classList.toggle("battle-damage-popup-critical", feedback.critical);
  popup.classList.toggle("battle-damage-popup-heal", feedback.healing);
  popup.classList.toggle("battle-damage-popup-miss", feedback.miss === true);
  // 완전 방어(명중했지만 0 피해)는 "0" 으로 분명히 보여준다. 예전에는 이 경우
  // 피드백 자체가 만들어지지 않아 화면이 조용했다.
  popup.classList.toggle("battle-damage-popup-blocked", feedback.blocked === true);
  popup.textContent = feedback.miss
    ? "MISS"
    : feedback.blocked
      ? "0"
      : feedback.healing
        ? `+${feedback.amount}`
        : `-${feedback.amount}`;
  const anchor = findBattlerNode(field, feedback.targetId);
  if (anchor) {
    popup.style.setProperty("--battle-node-x", anchor.style.getPropertyValue("--battle-node-x"));
    popup.style.setProperty("--battle-node-y", anchor.style.getPropertyValue("--battle-node-y"));
    // 고정 -12% 오프셋은 스프라이트 키에 따라 몸통 한가운데(적)나 발밑(아군)으로
    // 흩어진다 — 실측한 스프라이트 상단 30% 지점(머리께)에 띄운다(9차 리뷰).
    // 상단 0% 를 쓰면 팝업 전체가 스프라이트 박스 위로 나가 높이 배치된 적에서는
    // 필드 밖(HUD 영역)까지 밀려났다.
    const sprite = battlerSpriteNode(anchor);
    const layerRect = layer.getBoundingClientRect();
    const spriteRect = sprite.getBoundingClientRect();
    if (layerRect.height > 0 && spriteRect.height > 0) {
      popup.style.top = `${((spriteRect.top - layerRect.top + spriteRect.height * 0.3) / layerRect.height) * 100}%`;
    }
    // 막타 팝업(900ms)이 기절 페이드(550~620ms)보다 오래 남아 빈 자리에 떠 있었다 —
    // 사망 대상의 팝업은 페이드와 함께 끝낸다(9차 리뷰).
    if (anchor.classList.contains("defeated")) popup.classList.add("battle-damage-popup-final");
    layer.append(popup);
  } else if (!showPartyRowDamage(field, feedback, popup)) {
    layer.append(popup);
  }
  window.setTimeout(() => popup.remove(), 900);
}

/** 아군 스프라이트를 그리지 않는 정면 스킨(rm2000 등)에는 필드에 아군 노드가 없어 팝업이 앵커를
 *  잃는다 — 그러면 `--battle-node-x/y` 없이 효과 레이어 원점(필드 좌상단)에 떠서 누가 얼마나 맞았는지
 *  읽을 수 없었다(실측: 적 턴의 피해가 화면 왼쪽 위에 "-31" 로만 떴다). 파티 카드의 해당 행,
 *  HP 수치 자리에 띄우고 행에 `is-hit` 를 잠깐 붙여 스킨이 흔들림·붉은 기운을 그릴 수 있게 한다.
 *  카드나 행을 못 찾으면 false — 호출자가 예전처럼 효과 레이어에 붙인다. */
function showPartyRowDamage(field: HTMLElement, feedback: DamageFeedback, popup: HTMLElement): boolean {
  const party = field.parentElement?.querySelector<HTMLElement>(".battle-party");
  const row = party?.querySelector<HTMLElement>(`.battle-actor-status[data-record-id="${feedback.targetId}"]`);
  if (!party || !row || typeof party.getBoundingClientRect !== "function") return false;
  const target = row.querySelector<HTMLElement>(".battle-actor-hp") ?? row;
  const partyRect = party.getBoundingClientRect();
  const rect = target.getBoundingClientRect();
  if (!(partyRect.width > 0) || !(partyRect.height > 0) || !(rect.width > 0)) return false;
  // 카드가 팝업의 containing block 이어야 백분율 좌표가 맞다. rm2000 CSS 는 카드를 relative 로 두지만
  // 다른 정면 스킨은 그렇지 않을 수 있으니 여기서 보장한다.
  if (typeof getComputedStyle === "function" && getComputedStyle(party).position === "static") party.style.position = "relative";
  popup.classList.add("battle-damage-popup-party");
  popup.style.left = `${((rect.left + rect.width / 2 - partyRect.left) / partyRect.width) * 100}%`;
  popup.style.top = `${((rect.top - partyRect.top) / partyRect.height) * 100}%`;
  party.append(popup);
  row.classList.remove("is-hit");
  void row.offsetWidth; // 같은 프레임에 떼고 다시 붙이면 애니메이션이 재시작하지 않는다 — 리플로우로 끊는다.
  row.classList.add("is-hit");
  window.setTimeout(() => row.classList.remove("is-hit"), 480);
  return true;
}

function appendEffectsLayer(field: HTMLElement): HTMLElement {
  const layer = document.createElement("div");
  layer.className = "battle-effects-layer";
  layer.dataset.testid = "battle-effects-layer";
  field.append(layer);
  return layer;
}

/** rm2000 은 필드 위에 어두운 그라데이션을 얹지 않는다 — 그게 몬스터 PNG 알파를
 *  반투명처럼 보이게 했다. 다른 스킨은 기존 스크림을 유지한다. */
function battleBackdropImage(url: string): string {
  if (activeSkin().id === "rm2000") return `url("${url}")`;
  return `linear-gradient(rgba(4, 10, 24, 0.12), rgba(2, 6, 14, 0.28)), url("${url}")`;
}

function battleBackdrop(resourceId: string | undefined): HTMLElement {
  const backdrop = document.createElement("div");
  backdrop.className = "battle-backdrop";
  backdrop.dataset.testid = "battle-backdrop";
  // 활성 스킨의 전용 배경이 전투장을 결정한다. 없으면 troop/system 배경,
  // 그것도 없으면 forest 레퍼런스로 폴백한다.
  const effectiveId = effectiveBackdropId(resourceId);
  const resolvedId = effectiveId || "generated-battle-reference-forest";
  const url =
    resolveAssetResourceUrl(resolvedId, { project: store.getCurrent() })
    ?? (!effectiveId ? "/generated/battle-reference-forest.png" : undefined);
  if (effectiveId) backdrop.dataset.backdropResourceId = effectiveId;
  else backdrop.dataset.backdropFallback = "forest";
  backdrop.setAttribute("aria-label", "전투 배경");
  if (url) backdrop.style.backgroundImage = battleBackdropImage(url);
  return backdrop;
}

function battleTitle(troopId: string): HTMLElement {
  const title = document.createElement("div");
  title.className = "battle-title";
  title.textContent = store.getCurrent().database.troops.find((troop) => troop.id === troopId)?.name ?? troopId;
  return title;
}

function enemyGroup(enemies: readonly BattleBattlerSnapshot[], snapshot: BattleSnapshot): HTMLElement {
  const group = document.createElement("div");
  group.className = "battle-enemy-group";
  const positions = resolveEnemyRowPositions(snapshot, enemies);
  for (const [index, enemy] of enemies.entries()) {
    group.append(enemyButton(enemy, snapshot, index, positions[index]));
  }
  return group;
}

function resolveEnemyRowPositions(
  snapshot: BattleSnapshot,
  enemies: readonly BattleBattlerSnapshot[],
): readonly { x: number; y: number }[] {
  const skinId = activeSkin().id;
  const autoAlign =
    store.getCurrent().database.troops.find((troop) => troop.id === snapshot.troopId)?.autoAlign ?? true;
  return resolveSkinEnemyPositions(
    skinId,
    enemies.map((enemy) => ({ x: enemy.authoredX, y: enemy.authoredY })),
    autoAlign,
  );
}

function enemyButton(
  enemy: BattleBattlerSnapshot,
  snapshot: BattleSnapshot,
  index = 0,
  position: { readonly x: number; readonly y: number },
): HTMLButtonElement {
  const enemyNode = document.createElement("button");
  enemyNode.type = "button";
  enemyNode.className = "battle-enemy";
  const ep = position;
  positionBattleNode(enemyNode, ep.x, ep.y);
  // 겹칠 때 화면 아래(가까운) 적이 앞에 오도록 — z 는 CSS 변수로만 소비해
  // 모션 클래스(z-index 상승)가 인라인에 눌리지 않게 한다.
  enemyNode.style.setProperty("--battle-depth", String(1 + Math.round(ep.y / 16)));
  enemyNode.dataset.testid = enemy.id;
  enemyNode.dataset.recordId = enemy.recordId;
  enemyNode.dataset.facing = "right";
  if (snapshot.targetSelection?.side === "enemy" && snapshot.targetSelection.targetIds.includes(enemy.id)) {
    enemyNode.dataset.battleTargetable = "true";
    enemyNode.classList.add("battle-target-candidate");
  }
  if (snapshot.targetSelection?.side === "enemy" && snapshot.targetSelection.selectedTargetId === enemy.id) {
    enemyNode.classList.add("battle-target-selected");
  }
  // 각 적 레코드의 고유 몬스터 이미지를 우선 사용. 없으면 스킨 공용 스프라이트로 대체.
  const record = store.getCurrent().database.enemies.find((entry) => entry.id === enemy.recordId);
  const resourceId = record?.monsterResourceId;
  // 이미지 치수만 배율 적용: 노드의 이동/피격 transform과 이미지의 숨쉬기 scale은 그대로 둔다.
  enemyNode.style.setProperty("--battle-enemy-scale", String((record?.battleScalePercent ?? 100) / 100));
  const perEnemyUrl = resourceId ? resolveAssetResourceUrl(resourceId, { project: store.getCurrent() }) : null;
  const skinUrl = skinEnemySpriteUrl();
  const url = perEnemyUrl ?? skinUrl;
  if (resourceId) enemyNode.dataset.monsterResourceId = resourceId;
  if (url) {
    const image = document.createElement("img");
    image.className = "battle-enemy-image";
    // 필드 적은 정적 원본만 그린다. idle 스트립은 영상 키드 프레임이라 반투명 픽셀이
    // 섞여 있고, CSS 가 `object-position` 으로 src 를 밀어 그 스트립만 보여 몬스터가
    // 반투명해 보였다(실측: 정적 원본 mid-alpha 0%, idle 스트립 골렘 1.23%).
    image.alt = `${enemy.name} 몬스터`;
    image.src = url;
    // CSS 숨쉬기(_battlers.css battler-breathe)의 위상을 적마다 어긋나게 — 같이 부풀면 한 덩이로 보인다.
    image.style.setProperty("--breathe-delay", `-${index * 730}ms`);
    enemyNode.append(image);
  }
  applyBattlerPose(enemyNode, enemy.pose);
  const name = document.createElement("span");
  name.className = "battle-enemy-name";
  name.textContent = disambiguatedBattlerName(enemy, snapshot.enemies);
  // 이름·순번·상태·HP 는 스프라이트 **아래에 겹쳐** 놓는다(.battle-enemy-chrome 이 절대 배치).
  // 흐름에 두면 HUD 를 펼칠 때 노드 높이가 변하고, 그 높이로 스프라이트 top 을 보정하던
  // 옛 코드(alignEnemyFeetToAuthoredY) 때문에 몬스터가 눈에 보이게 튀었다.
  enemyNode.append(enemyChrome(name, enemyIndexBadge(index), statusIconCluster(enemy), enemyHpHud(enemy)));
  if (snapshot.targetSelection?.side === "enemy" && snapshot.targetSelection.selectedTargetId === enemy.id) {
    const brackets = document.createElement("span");
    brackets.className = "battle-target-brackets";
    brackets.dataset.testid = "battle-target-brackets";
    brackets.setAttribute("aria-hidden", "true");
    enemyNode.append(brackets);
  }
  if (enemy.defeated) enemyNode.classList.add("defeated");
  enemyNode.disabled = enemy.defeated || snapshot.targetSelection?.side !== "enemy" || !snapshot.targetSelection.targetIds.includes(enemy.id);
  return enemyNode;
}

/**
 * 적 스프라이트 아래에 붙는 UI 를 한 겹으로 묶는다.
 *
 * 이 겹이 있어야 `.battle-enemy` 의 높이가 **스프라이트 높이와 같게** 유지된다.
 * 노드는 `translate(-50%, -100%)` 로 아래쪽 앵커를 쓰므로, 높이가 곧 발 위치다.
 * 겹이 없던 시절에는 HUD 를 펼칠 때마다 노드가 자라 발 위치가 흔들렸다.
 *
 * flex 열로 두는 이유: 스킨이 자식에 걸어둔 `order`(vxace 배지 1 / HUD 2)가
 * 계속 먹어야 한다. 흐름 순서를 그대로 보존한다.
 */
function enemyChrome(...children: HTMLElement[]): HTMLElement {
  const chrome = document.createElement("span");
  chrome.className = "battle-enemy-chrome";
  chrome.append(...children);
  return chrome;
}

/** 적 스프라이트 위의 순번 배지(1-base). 기본은 CSS 로 숨기고 vxace 스킨에서만 노출한다. */
function enemyIndexBadge(index: number): HTMLElement {
  const badge = document.createElement("span");
  badge.className = "battle-enemy-index-badge";
  badge.dataset.enemyIndex = String(index + 1);
  badge.setAttribute("aria-hidden", "true");
  badge.textContent = String(index + 1);
  return badge;
}

function enemyHpHud(enemy: BattleBattlerSnapshot): HTMLElement {
  const hud = document.createElement("span");
  hud.className = "battle-enemy-hud";
  hud.dataset.testid = `battle-enemy-hud-${enemy.id}`;
  const bar = document.createElement("span");
  bar.className = "battle-enemy-hp-bar battle-stat-bar battle-stat-bar-hp";
  bar.style.setProperty("--battle-stat", `${hpPercent(enemy.hp, enemy.maxHp)}%`);
  const text = document.createElement("span");
  text.className = "battle-enemy-hp-text";
  text.dataset.testid = `battle-enemy-hp-${enemy.id}`;
  text.textContent = `${enemy.hp}/${enemy.maxHp}`;
  const mpBar = document.createElement("span");
  mpBar.className = "battle-enemy-mp-bar battle-stat-bar battle-stat-bar-mp";
  mpBar.style.setProperty("--battle-stat", `${hpPercent(enemy.mp, enemy.maxMp)}%`);
  // 참조 스크린샷의 2단 게이지 아래줄은 **보라색 = 행동 게이지**다(HP 바보다 넓고 더 왼쪽에서 시작).
  // 실제 스냅샷의 gauge 값을 쓴다. 기본 숨김, vxace 에서만 노출한다.
  const atbBar = document.createElement("span");
  atbBar.className = "battle-enemy-atb-bar battle-stat-bar";
  atbBar.style.setProperty("--battle-stat", `${clampGauge(enemy.gauge)}%`);
  hud.append(bar, mpBar, atbBar, text);
  return hud;
}

function actorSpriteGroup(actors: readonly BattleBattlerSnapshot[]): HTMLElement {
  const group = document.createElement("div");
  group.className = "battle-actor-group";
  group.dataset.testid = "battle-actor-sprites";
  const place = BATTLER_PLACEMENTS[activeSkin().id];
  group.dataset.partyFacing = place.partyFacing;
  // 1인칭/프론트뷰 스킨(드퀘·마더·rm2000)은 아군 스프라이트를 그리지 않는다.
  if (place.partyFacing === "hidden") {
    group.dataset.hidden = "true";
    return group;
  }
  // 포켓몬은 선두 1마리(몬스터 뒷모습)만 필드에 세운다.
  const shown = place.partyMax ? actors.slice(0, place.partyMax) : actors;
  for (const [index, actor] of shown.entries()) {
    group.append(actorNode(actor, index, shown.length));
  }
  return group;
}

function partyStatusGroup(actors: readonly BattleBattlerSnapshot[], battleFlow: BattleSnapshot["battleFlow"]): HTMLElement {
  const group = document.createElement("div");
  group.className = "battle-party";
  group.dataset.testid = "battle-party";
  for (const actor of actors) {
    group.append(actorStatusRow(actor, battleFlow));
  }
  return group;
}

function actorNode(actor: BattleBattlerSnapshot, index = 0, count = 4): HTMLElement {
  const node = document.createElement("div");
  node.className = "battle-actor";
  const place = BATTLER_PLACEMENTS[activeSkin().id];
  const ap = place.party(index, count);
  positionBattleNode(node, ap.x, ap.y);
  if (place.partyScale) node.style.setProperty("--battle-actor-scale", String(place.partyScale));
  node.dataset.partyFacing = place.partyFacing;
  node.dataset.testid = `battle-actor-${actor.recordId}`;
  node.dataset.recordId = actor.recordId;
  node.dataset.facing = "left";
  node.setAttribute("aria-label", actor.name);
  // SC13/L5: 파티 몬스터가 필드에 나선 경우 종족 그래픽을 아군측(back) 스프라이트로
  // 렌더한다. 스킨 전용 파티 스프라이트보다 우선한다(몬스터는 종족 그래픽이 필수).
  const monsterResource = actor.speciesId ? monsterSpeciesResourceId(actor.speciesId) : undefined;
  if (actor.speciesId) {
    node.dataset.monsterBattler = "true";
    if (monsterResource) {
      const url = resolveAssetResourceUrl(monsterResource, { project: store.getCurrent() });
      if (url) {
        const image = document.createElement("img");
        image.className = "battle-actor-image battle-monster-image battle-monster-back";
        applyIdleAnimationToImage(image, monsterResource);
        image.alt = `${actor.name} 몬스터`;
        image.src = url;
        node.append(image);
      }
    }
    applyBattlerPose(node, actor.pose);
    node.append(statusIconCluster(actor));
    if (actor.defeated) node.classList.add("defeated");
    const platform = document.createElement("span");
    platform.className = "battle-actor-platform";
    node.append(platform);
    return node;
  }
  // 정면 사이드뷰에서는 배우가 저작한 전투 시트를 최우선으로 쓴다. 스킨 공용 전사/마법사를
  // 먼저 쓰면 모든 짝수 배우와 홀수 배우가 각각 같은 사람으로 보이고 faceset과도 어긋난다.
  const resourceId = place.partyFacing === "front" ? actor.battleCharacterResourceId : undefined;
  if (resourceId) {
    node.dataset.authoredBattler = "true";
    node.dataset.battleCharsetResourceId = resourceId;
    const url = resolveAssetResourceUrl(resourceId, { project: store.getCurrent() });
    if (url) node.append(actorBattleImage(actor.name, resourceId, url));
    applyBattlerPose(node, actor.pose);
    node.append(statusIconCluster(actor));
    if (actor.defeated) node.classList.add("defeated");
    const authoredPlatform = document.createElement("span");
    authoredPlatform.className = "battle-actor-platform";
    node.append(authoredPlatform);
    return node;
  }
  // authored 정면 시트가 없거나 후면 구도가 필요한 스킨만 스킨 공용 파티 스프라이트로 폴백한다.
  // 후면이면 액터별 뒷모습이 먼저 잡힌다(skinPartySpriteUrl).
  const skinSprite = skinPartySpriteUrl(store.getCurrent(), activeSkin().id, index, place.partyFacing, actor);
  if (skinSprite) {
    const image = document.createElement("img");
    image.className = "battle-actor-image battle-skin-actor-image";
    applyIdleAnimationToImage(image, skinSprite.resourceId);
    image.alt = actor.name;
    image.src = skinSprite.url;
    // 액터별 뒷모습이 잡혔는지 테스트·디버깅에서 구별할 수 있게 표시한다.
    if (skinSprite.perActor) node.dataset.actorBackBattler = "true";
    node.append(image);
    applyBattlerPose(node, actor.pose);
    node.append(statusIconCluster(actor));
    if (actor.defeated) node.classList.add("defeated");
    const skinPlatform = document.createElement("span");
    skinPlatform.className = "battle-actor-platform";
    node.append(skinPlatform);
    return node;
  }
  applyBattlerPose(node, actor.pose);
  node.append(statusIconCluster(actor));
  if (actor.defeated) node.classList.add("defeated");
  const platform = document.createElement("span");
  platform.className = "battle-actor-platform";
  node.append(platform);
  return node;
}

/** 배틀러 위치. 입력 x/y 는 **0..320 × 0..160 저작 좌표계**이고 백분율로 환산해 심는다.
 *  이 320/160 은 논리 해상도(640×480)와 무관한 고정 저작 단위다 — 해상도를 바꿔도 손대지 않는다. */
function positionBattleNode(node: HTMLElement, x: number | undefined, y: number | undefined): void {
  node.style.setProperty("--battle-node-x", `${clampBattleCoordinate(x ?? 160, 0, 320) / 320 * 100}%`);
  node.style.setProperty("--battle-node-y", `${clampBattleCoordinate(y ?? 96, 0, 160) / 160 * 100}%`);
}

/** 격파 조각 수. 12개면 사방으로 흩어지는 인상이 나고 DOM 부담은 없다. */
const DEATH_SHARD_COUNT = 12;

/**
 * 격파 조각을 배틀러 노드에 뿌린다(CSS: 15-juice-capture-fx.css `.battle-death-shard`).
 * 방향·거리·지연·크기는 인덱스로 결정해 같은 격파는 항상 같은 모양이다(스크린샷 비교 가능).
 * 조각은 노드 발끝 중심 위 `--shard-rise`(몸통 높이의 절반쯤)에서 출발한다.
 */
export function spawnDeathShards(node: HTMLElement): void {
  node.querySelector(".battle-death-shards")?.remove();
  const container = document.createElement("span");
  container.className = "battle-death-shards";
  container.dataset.testid = "battle-death-shards";
  container.setAttribute("aria-hidden", "true");
  const sprite = battlerSpriteNode(node);
  // 레이아웃 px(offsetHeight)로 잰다 — getBoundingClientRect 는 무대 배율이 곱해진 CSS px 라 배율 1.5 에서
  // 출발점이 몸통 중심이 아니라 머리 위로 올라갔다(실측).
  const spriteHeight = sprite.offsetHeight > 0 ? sprite.offsetHeight : 120;
  container.style.setProperty("--shard-rise", `${Math.round(spriteHeight * 0.5)}px`);
  for (let index = 0; index < DEATH_SHARD_COUNT; index += 1) {
    const shard = document.createElement("i");
    shard.className = "battle-death-shard";
    const angle = (index / DEATH_SHARD_COUNT) * Math.PI * 2 + ((index * 7) % 5) * 0.11;
    const distance = 52 + ((index * 13) % 7) * 8;
    shard.style.setProperty("--sx", `${Math.round(Math.cos(angle) * distance)}px`);
    shard.style.setProperty("--sy", `${Math.round(Math.sin(angle) * distance * 0.8 - 18)}px`);
    shard.style.setProperty("--sd", `${(index * 37) % 120}ms`);
    shard.style.setProperty("--ss", `${10 + ((index * 5) % 3) * 4}px`);
    container.append(shard);
  }
  node.append(container);
  window.setTimeout(() => container.remove(), 900);
}

/** Side-view approach / knockback classes for the current resolve beat. */
export function applyActionMotion(field: HTMLElement, beat: BattleActionBeat | undefined): void {
  for (const node of field.querySelectorAll<HTMLElement>(".battle-actor, .battle-enemy")) {
    node.classList.remove(
      "battle-motion-windup",
      "battle-motion-lunge",
      "battle-motion-return",
      "battle-motion-knockback",
      "battle-motion-user",
      "battle-motion-target",
    );
  }
  if (!beat) return;
  const user = beat.userId ? findBattlerNode(field, beat.userId) : null;
  if (user) {
    user.classList.add("battle-motion-user");
    if (beat.userMotion === "windup") user.classList.add("battle-motion-windup");
    else if (beat.userMotion === "lunge") user.classList.add("battle-motion-lunge");
    else if (beat.userMotion === "return") user.classList.add("battle-motion-return");
  }
  if (beat.targetId) {
    const target = findBattlerNode(field, beat.targetId);
    if (target) {
      target.classList.add("battle-motion-target");
      if (beat.targetMotion === "knockback") target.classList.add("battle-motion-knockback");
    }
  }
}

function clampBattleCoordinate(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function hpPercent(value: number, max: number): number {
  return Math.max(0, Math.min(100, Math.round(value / Math.max(1, max) * 100)));
}

function clampGauge(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function vitalLabel(text: string): HTMLElement {
  const node = document.createElement("span");
  node.className = "battle-vital-label";
  node.textContent = text;
  return node;
}

function vitalValue(text: string): HTMLElement {
  const node = document.createElement("span");
  node.className = "battle-vital-value";
  node.textContent = text;
  return node;
}

/** HP/MP 표시. `HP`(라벨) · ` 514`(현재값) · `/514`(최대값) 세 조각으로 나눈다.
 *  vxace 스킨은 참조처럼 라벨을 작은 배지로, 현재값을 큰 숫자로 그리고 최대값은 숨긴다
 *  (비율은 게이지가 말해준다). 세 조각을 합친 textContent 는 한 노드였을 때와 **글자 단위로 동일**해서
 *  `.battle-actor-hp` 의 텍스트를 읽는 기존 테스트·측정이 그대로 통한다. */
function vitalNode(kind: "hp" | "mp", value: number, max: number): HTMLElement {
  const node = document.createElement("span");
  node.className = `battle-actor-${kind}`;
  const rest = document.createElement("span");
  rest.className = "battle-vital-max";
  rest.textContent = `/${max}`;
  node.append(vitalLabel(kind === "hp" ? "HP" : "MP"), vitalValue(` ${value}`), rest);
  return node;
}

/** 위 세 조각 구조를 유지하면서 값만 갈아끼운다. 구조가 없으면(구버전 DOM) textContent 로 폴백. */
function setVitalNode(node: Element, kind: "hp" | "mp", value: number, max: number): void {
  const valueNode = node.querySelector(".battle-vital-value");
  const maxNode = node.querySelector(".battle-vital-max");
  if (!valueNode || !maxNode) {
    node.textContent = `${kind === "hp" ? "HP" : "MP"} ${value}/${max}`;
    return;
  }
  valueNode.textContent = ` ${value}`;
  maxNode.textContent = `/${max}`;
}

function actorStatusRow(actor: BattleBattlerSnapshot, battleFlow: BattleSnapshot["battleFlow"]): HTMLElement {
  const row = document.createElement("div");
  row.className = "battle-actor-status";
  row.dataset.recordId = actor.recordId;
  if (actor.defeated) row.classList.add("is-defeated");

  const name = document.createElement("span");
  name.className = "battle-actor-name";
  name.textContent = actor.name;
  if (actor.level) {
    const lv = document.createElement("span");
    lv.className = "battle-actor-level";
    // 라벨/값을 나눠 담는다 — vxace 스킨이 참조처럼 "라벨 배지 + 큰 숫자" 로 그리려면
    // 두 조각의 서식이 달라야 한다. 합친 textContent 는 "Lv 1" 로 한 노드일 때와 같다.
    lv.append(vitalLabel("Lv"), vitalValue(` ${actor.level}`));
    name.append(lv);
  }

  const vitals = document.createElement("span");
  vitals.className = "battle-actor-vitals";
  const hp = vitalNode("hp", actor.hp, actor.maxHp);
  const mp = vitalNode("mp", actor.mp, actor.maxMp);
  vitals.append(hp, mp);

  const hpGauge = statBar("hp", actor.hp, actor.maxHp);
  const mpGauge = statBar("mp", actor.mp, actor.maxMp);
  // 얼굴 초상은 vxace 스킨 전용 노출(기본 CSS 에서 display:none) — 기존 11종 레이아웃은 그대로.
  const face = actorFaceNode(actor);
  if (face) row.append(face);
  row.append(name, vitals, hpGauge, mpGauge);
  const role = actorRoleNode(actor);
  if (role) row.append(role);
  if (battleFlow === "gauge") {
    const gauge = document.createElement("span");
    gauge.className = "battle-actor-gauge";
    gauge.append(atbLabel(), atbValue(actor.gauge), atbBar(actor.gauge));
    row.append(gauge);
  }
  // 정면 스킨(필드 노드 없음)은 상태 배지를 행에 직접 단다 — 이름 셀 안은 rm2000 의
  // overflow:hidden 열에 잘린다(실측: 배지가 2px 조각으로만 보임). 배치는 스킨 CSS 책임.
  // DOM 맨 끝에 둬서 겹침 시 같은 z-index 의 다른 셀 위에 그려지게 한다.
  if (partyStatusRowsCarryIcons()) row.append(statusIconCluster(actor));
  return row;
}

/** 셀 우측의 역할 글자 한 자. 참조 스크린샷의 진형 배지(前/中/後) 자리인데 이 엔진에는
 *  진형 개념이 없다 — 대신 **실재하는** 직업명의 첫 글자를 쓴다(전사→"전"). 직업이 없으면 만들지 않는다.
 *  기본 CSS 에서 숨기고 vxace 스킨에서만 노출한다. */
function actorRoleNode(actor: BattleBattlerSnapshot): HTMLElement | null {
  if (!actor.classId) return null;
  const className = store.getCurrent().database.classes.find((entry) => entry.id === actor.classId)?.name;
  const initial = className?.trim().slice(0, 1);
  if (!initial) return null;
  const node = document.createElement("span");
  node.className = "battle-actor-role";
  node.dataset.testid = `battle-actor-role-${actor.recordId}`;
  node.setAttribute("aria-label", className ?? "");
  node.textContent = initial;
  return node;
}

/** 파티 행 왼쪽의 얼굴 초상. 얼굴은 낱장 파일(48×48) 한 장이라 통째로 그린다.
 *  얼굴 리소스가 없거나 URL 이 풀리지 않으면 노드를 만들지 않는다(가짜 플레이스홀더를 넣지 않는다). */
function actorFaceNode(actor: BattleBattlerSnapshot): HTMLElement | null {
  const project = store.getCurrent();
  const record = project.database.actors.find((entry) => entry.id === actor.recordId);
  if (!record) return null;
  const resourceId = actor.faceResourceId ?? record.faceResourceId ?? defaultActorFaceResourceId(record);
  if (!resourceId) return null;
  const url = resolveAssetResourceUrl(resourceId, { project });
  if (!url) return null;
  const node = document.createElement("span");
  node.className = "battle-actor-face";
  node.dataset.testid = `battle-actor-face-${actor.recordId}`;
  node.dataset.faceResourceId = resourceId;
  node.setAttribute("role", "img");
  node.setAttribute("aria-label", `${actor.name} 얼굴`);
  node.style.setProperty("--battle-face-url", `url("${url}")`);
  // 스킨 CSS(_vxace/_rm2000)는 아직 셀 크기 × 격자로 background 를 계산한다. 격자 1 · 열/행 0 이
  // "이미지 한 장을 셀 폭에 맞춰 통째로" 그리는 값이라, 스킨 CSS 를 건드리지 않고 낱장 얼굴을 그린다.
  node.style.setProperty("--battle-face-grid", "1");
  node.style.setProperty("--battle-face-col", "0");
  node.style.setProperty("--battle-face-row", "0");
  removeFaceNodeOnLoadError(node, url);
  return node;
}

/** 404 등 로드 실패 시 얼굴 노드를 DOM 에서 제거한다. 그러면 '얼굴 리소스가 없으면 노드를 만들지
 *  않는다'는 원칙이 404 에도 적용되어, vxace 스킨에서 셀 배경이 비고 테두리만 남지 않는다.
 *  vxace CSS 가 :not(:has(.battle-actor-face)) 로 열을 접으므로 레이아웃도 알아서 맞는다. */
function removeFaceNodeOnLoadError(node: HTMLElement, url: string): void {
  if (typeof Image === "undefined") return;
  const probe = new Image();
  probe.onerror = () => {
    node.remove();
  };
  probe.src = url;
}

function statBar(kind: "hp" | "mp" | "tp", value: number, max: number): HTMLElement {
  const bar = document.createElement("span");
  bar.className = `battle-stat-bar battle-stat-bar-${kind}`;
  const pct = hpPercent(value, max);
  bar.style.setProperty("--battle-stat", `${pct}%`);
  if (kind === "hp") bar.dataset.hpState = hpBarState(pct);
  return bar;
}

/** 포켓몬식 HP 바 색 구간: 초록(>50) · 노랑(21~50) · 빨강(≤20). */
export function hpBarState(pct: number): "high" | "mid" | "low" {
  return pct > 50 ? "high" : pct > 20 ? "mid" : "low";
}

function atbLabel(): HTMLElement {
  const label = document.createElement("span");
  label.className = "battle-atb-label";
  label.textContent = "ATB";
  label.setAttribute("aria-label", "ATB");
  return label;
}

/** 게이지 퍼센트 숫자(참조의 AP 수치에 대응). 기본 숨김, vxace 에서만 노출. */
function atbValue(gaugeValue: number): HTMLElement {
  const value = document.createElement("span");
  value.className = "battle-atb-value";
  value.textContent = `${Math.max(0, Math.min(100, Math.round(gaugeValue)))}%`;
  return value;
}

function atbBar(gaugeValue: number): HTMLElement {
  const bar = document.createElement("span");
  bar.className = "battle-atb-bar";
  bar.style.setProperty("--battle-atb", `${Math.max(0, Math.min(100, Math.round(gaugeValue)))}%`);
  return bar;
}

function stateIconToken(stateId: string): string {
  // 능력 증감은 `death`/`down` 검사보다 **먼저** 갈라야 한다. `state_attack_down` 은
  // "down" 을 품고 있어서 아래 폴백 순서로는 붉은 KO 배지로 렌더됐다(공격 하락 = 전투불능).
  const buff = buffIconToken(stateId);
  if (buff) return buff;
  if (stateId.includes("regen")) return "regen";
  if (stateId.includes("poison")) return "poison";
  if (stateId.includes("burn")) return "burn";
  if (stateId.includes("freeze") || stateId.includes("frozen")) return "freeze";
  if (stateId.includes("sleep")) return "sleep";
  if (stateId.includes("paraly") || stateId.includes("bind")) return "paralysis";
  if (stateId.includes("blind") || stateId.includes("dark")) return "blind";
  if (stateId.includes("silence") || stateId.includes("mute")) return "silence";
  if (stateId.includes("confuse") || stateId.includes("charm")) return "confuse";
  if (stateId.includes("death") || stateId.includes("down") || stateId.includes("ko")) return "death";
  return "burst";
}

/**
 * 능력 증감 상태의 배지 토큰. 저작 id 의 `attack|defense|agility|magic` + `up|down` 조합만
 * 읽는다 — 폴백(●)으로 떨어지면 공격 상승·방어 상승·재생이 화면에서 전부 같은 회색 점이 되어
 * 스크린샷으로 구별할 수 없다.
 */
function buffIconToken(stateId: string): string | null {
  const stat = stateId.includes("attack")
    ? "atk"
    : stateId.includes("defense")
      ? "def"
      : stateId.includes("agility") || stateId.includes("speed")
        ? "agi"
        : stateId.includes("magic")
          ? "mag"
          : null;
  if (!stat) return null;
  if (stateId.endsWith("_up") || stateId.includes("_up_")) return `${stat}-up`;
  if (stateId.endsWith("_down") || stateId.includes("_down_")) return `${stat}-down`;
  return null;
}

function stateName(stateId: string): string {
  return store.getCurrent().database.states.find((state) => state.id === stateId)?.name ?? stateId;
}

function syncStatusIcons(node: HTMLElement, battler: BattleBattlerSnapshot): void {
  const existing = node.querySelector(".battle-status-icons");
  const next = statusIconCluster(battler);
  if (existing) existing.replaceWith(next);
  else node.append(next);
}

function statusIconCluster(battler: BattleBattlerSnapshot): HTMLElement {
  const cluster = document.createElement("span");
  cluster.className = "battle-status-icons";
  const states = battler.stateIds.slice(0, 4).map((stateId) => ({ icon: stateIconToken(stateId), name: stateName(stateId) }));
  const entries = battler.defeated ? [{ icon: "death", name: "전투불능" }, ...states] : states;
  for (const entry of entries) {
    const node = document.createElement("span");
    node.className = `battle-status-icon battle-status-icon-${entry.icon}`;
    // 글리프는 CSS ::before 에만 있어서 textContent 로는 잡힐 수 없다 — 상태가 실제로 화면에
    // 배지로 남았는지를 QA 가 집을 수 있도록 배틀러·토큰까지 들어있는 testid 를 단다.
    node.dataset.testid = `battle-status-${battler.id}-${entry.icon}`;
    node.dataset.statusIcon = entry.icon;
    node.dataset.statusName = entry.name;
    node.setAttribute("role", "img");
    node.setAttribute("aria-label", entry.name);
    cluster.append(node);
  }
  return cluster;
}

function actorBattleImage(name: string, resourceId: string, url: string): HTMLElement {
  if (resourceId === "hero" || isGeneratedBattleActor(resourceId)) {
    // 생성 전투 시트는 144×384 새로 48×48 셀을 3열×8행으로 담는다(자산 계획서의 "3x8 battle sheet").
    // 48×64 로 잘리면 한 프레임에 아랫행 머리 16px 이 따라들어와 발밑에 쟘러기 스프라이트가 보인다.
    // Asset pixels are authored for the old 320×240 stage, so one source pixel maps
    // once through BATTLE_ASSET_PIXEL_SCALE into the 640×480 logical stage. Multiplying
    // by an additional 2 made each actor almost field-height after the stage migration.
    const frameW = BATTLE_SHEET_CELL * BATTLE_ASSET_PIXEL_SCALE;
    const frameH = BATTLE_SHEET_CELL * BATTLE_ASSET_PIXEL_SCALE;
    const sprite = document.createElement("span");
    sprite.className = "battle-actor-sprite";
    sprite.dataset.testid = `battle-actor-sprite-${resourceId}`;
    // 고해상도 짝(xBR 4배, 192px 셀)이 등록된 시트는 그걸 그린다. background-size 는 아래에서 논리 px 로
    // 고정되므로 화면 크기는 같고 밀도만 4배가 된다 — 몬스터(384px 원본)와 같은 급. 축소해 그리므로
    // pixelated 를 걷어야 가장자리가 계단으로 깨지지 않는다(`01-scene-base.css` 의 data-rendering 규칙).
    const hires = battlerHiresSheet(resourceId);
    const sheetUrl = hires ? battlerHiresSheetUrl(hires) : url;
    if (hires) {
      sprite.dataset.rendering = "smooth";
      sprite.dataset.battlerSheetCell = String(hires.cellWidth);
    }
    // idle 애니메이션 조회와 정적 시트 복원에 필요한 것을 노드에 적어 둔다 — 포즈 전환은
    // 프로젝트 상태를 다시 조회하지 않고 이 값만 보아도 결정적이어야 하기 때문이다.
    sprite.dataset.battlerResourceId = resourceId;
    sprite.dataset.battlerSheetUrl = sheetUrl;
    sprite.setAttribute("role", "img");
    sprite.setAttribute("aria-label", `${name} 전투 캐릭터`);
    sprite.style.setProperty("--battle-sprite-frame-width", `${frameW}px`);
    sprite.style.setProperty("--battle-sprite-frame-height", `${frameH}px`);
    sprite.style.backgroundPosition = "0 0";
    sprite.style.backgroundSize = `${frameW * BATTLE_SHEET_COLUMNS}px ${frameH * BATTLE_SHEET_ROWS}px`;
    sprite.dataset.battlerSheetSize = sprite.style.backgroundSize;
    sprite.style.backgroundImage = `url("${sheetUrl}")`;
    return sprite;
  }
  const image = document.createElement("img");
  image.className = "battle-actor-image";
  image.alt = `${name} 전투 캐릭터`;
  image.src = url;
  return image;
}

const BATTLE_SHEET_CELL = 48;
const BATTLE_SHEET_COLUMNS = 3;
const BATTLE_SHEET_ROWS = 8;

function isGeneratedBattleActor(resourceId: string): boolean {
  return resourceId.startsWith("generated-actor-") && resourceId.endsWith("-battle");
}

function monsterSpeciesResourceId(speciesId: string): string | undefined {
  return store.getCurrent().database.monsterSpecies?.find((species) => species.id === speciesId)?.graphic.monsterResourceId;
}

/** 포획 구슬 시네마틱을 재생하고 총 소요 ms를 반환한다.
 *  투척(480ms) → 흡수(240ms) → 흔들림 3회(1,260ms) → 성공 반짝/실패 탈출(420ms). */
export function playCaptureCinematic(field: HTMLElement, targetId: string, success: boolean): number {
  const target = findBattlerNode(field, targetId);
  if (!target) return 0;
  const orb = document.createElement("span");
  orb.className = "battle-capture-orb";
  orb.dataset.testid = "battle-capture-orb";
  orb.style.setProperty("--orb-to-x", target.style.getPropertyValue("--battle-node-x") || "70%");
  orb.style.setProperty("--orb-to-y", target.style.getPropertyValue("--battle-node-y") || "35%");
  field.append(orb);
  const timers: number[] = [];
  const at = (fn: () => void, ms: number): void => {
    timers.push(window.setTimeout(fn, ms));
  };
  at(() => target.classList.add("battle-capture-absorbed"), 460);
  at(() => orb.classList.add("battle-orb-shake"), 720);
  at(() => {
    orb.classList.remove("battle-orb-shake");
    if (success) {
      orb.classList.add("battle-orb-caught");
    } else {
      orb.classList.add("battle-orb-burst");
      target.classList.remove("battle-capture-absorbed");
    }
  }, 1980);
  at(() => {
    orb.remove();
    // 성공 시 런타임 스냅샷에서 적이 사라지므로 잔류 노드도 정리한다.
    if (success) target.remove();
  }, 2400);
  return 2400;
}
