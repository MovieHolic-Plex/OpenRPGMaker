import type { BattleActionBeat } from "@/player/battleActionBeats";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import type { BattleBattlerSnapshot, BattleSnapshot } from "@/battle/runtime";
import { getBattleSkin, resolveSkinId } from "@/battle/skins/registry";
import type { BattleSkin, BattleSkinId } from "@/battle/skins/types";
import type { DamageFeedback } from "@/player/battleSequencer";
import type { BattlePresentationLedger } from "@/player/battlePresentation";
import { BATTLE_ASSET_PIXEL_SCALE } from "@/player/battleStageScale";
import { defaultActorFaceResourceId } from "@/project/actorFaceDefaults";
import { store } from "@/project/store";

/** targetId(적 id·아군 배틀러 id·recordId)를 실제 DOM 노드로 해석한다.
 *  아군 노드 testid는 `battle-actor-<recordId>`라 직접 조회가 실패하던 버그의 단일 수정 지점. */
export function findBattlerNode(scope: HTMLElement | Document, targetId: string): HTMLElement | null {
  return scope.querySelector<HTMLElement>(`[data-testid="${targetId}"]`)
    ?? scope.querySelector<HTMLElement>(`[data-testid="battle-actor-${targetId}"]`)
    ?? scope.querySelector<HTMLElement>(`.battle-enemy[data-record-id="${targetId}"]`);
}

/** 현재 프로젝트 설정에서 활성 전투 스킨을 해석한다. */
function activeSkin(): BattleSkin {
  return getBattleSkin(resolveSkinId(store.getCurrent().system.battleUiStyle));
}

/** 스킨별 배틀러 배치 문법: 뷰(사이드/프론트/1인칭/액티브)에 따라
 *  적·아군의 좌표(x 0-320, y 0-160), 아군 표시 방식(정면/후면/숨김)을 정한다. */
type PartyFacing = "front" | "back" | "hidden";
interface SkinBattlerPlacement {
  readonly enemy: (i: number, n: number) => { x: number; y: number };
  readonly party: (i: number, n: number) => { x: number; y: number };
  readonly partyFacing: PartyFacing;
  /** 편성 스프라이트 최대 표시 수(포켓몬은 선두 1). */
  readonly partyMax?: number;
  /** 컬럼 밀집 시 겹침 방지용 스프라이트 배율(기본 1.65). */
  readonly partyScale?: number;
}

// 세로 배치의 단일 규칙(12종 공통):
//  · 저작 y 는 **스프라이트의 발**이다. 노드는 `translate(-50%, -100%)` 라 앵커가 원래
//    이름표+HUD 스택 **아래**에 잡혔고(그래서 스프라이트가 그만큼 떠 있었다), 지금은
//    `alignEnemyFeetToAuthoredY` 가 그 스택 높이를 실측해 노드를 내려 보정한다.
//    실측 스택 높이: rm2003 33px · vxace 60 · rm2000·dragonquest 97 · octopath·bravely 109
//    · mv 115 · chrono·ff·mother·goldensun 133.
//  · 그래서 y 의 상한은 "발 + 스택이 필드 안" 이다 — 스택이 두꺼운 스킨은 y 를 더 못 내린다.
//    ff·goldensun 은 접지 띠(발 ≥ 60%)와 그 상한 사이가 36px 뿐이라 두 줄을 세우면 줄 간격이
//    이름표 높이(38px)보다 좁아 이름이 겹쳤다(실측 교차 109×4px) → 1열로 바꿨다.
//  · 좌표계는 필드에서 `--battle-stage-inset-top` 만큼 들어간 배틀러 그룹 박스다
//    (rm2003 8px, 나머지 11종 48px — `01-scene-base.css` 의 단일 선언).
//  · 그래서 스프라이트 상자가 큰 스킨은 y 가 작을 때 **위로 잘린다**(필드는 overflow:hidden).
//  · 백드롭 그라디언트는 필드 높이 33% 에 지평선을 둔다 → 발(이미지 bottom)이 그보다
//    위면 몬스터가 하늘에 떠 보인다.
// 아래 y 값은 이 두 축을 실브라우저 rect 로 측정해 정한 것이다. 게이트:
//   node scripts/runtime-qa.mjs --scenario battle  (+ 12종 스킨 스윕, `battlerGeometry` 기대치)
// 가로 간격의 하한은 스프라이트 폭이 아니라 **공용 적 이름표**가 정한다:
//   `03-vxace-status-nodes.css` 의 `.battle-enemy-hud { min-width: 104px }` + 이름 18px.
//   간격이 그보다 훨씬 좁으면 스프라이트는 안 겹쳐도 이름/게이지 글자가 뭉개진다
//   (실측: chrono 38 → 이름 잉크 24px 교차, mother 42 → 11px 교차, mv 44 → 판독 불가).
//   그래서 chrono 38→50, mother 42→50 으로 넓혔고 mv 는 44→52 + `_mv.css` 에서 열 폭을 좁혔다.
//   게이트의 `battlerGeometry` 이름표 축이 이 하한을 지킨다.
export const BATTLER_PLACEMENTS: Record<BattleSkinId, SkinBattlerPlacement> = {
  // 포켓몬: 1:1 대치 — 선두 1명만, 적 크고 중앙 상단, 아군 좌하 대형.
  // 다마리 분기 y +10: 148px 스프라이트가 y=76 줄에서 필드 위로 11px 잘렸다(실측).
  pokemon: { partyFacing: "back", partyMax: 1, partyScale: 1.25, enemy: (i, n) => (n <= 1 ? { x: 245, y: 92 } : { x: 250 - i * 58, y: 100 - (i % 2) * 14 }), party: () => ({ x: 84, y: 152 }) },
  // RM2003 사이드뷰: 고전 2×2 그리드 — 적 좌열, 아군 우열, 지그재그 없음.
  // y 96/152 는 임의값이 아니다(실측 기하에서 역산). 노드는 `translate(-50%, -100%)` 라
  // 저작 y 가 노드의 **바닥**이고, 이 스킨의 적 노드는 논리 161px(이미지 140 + 이름표 21)이다.
  // 좌표계는 필드에서 `--battle-stage-inset-top`(8px) 만큼 들어간 배틀러 그룹 박스(논리 272px)다.
  //   앞줄 상단이 필드 안:  8 + y/160*272 - 161 >= 0  → y >= 90
  //   뒷줄 바닥이 필드 안:  y + 56 <= 160             → y <= 104
  // 예전 값 78 은 첫 조건을 14 단위 어겨 앞줄 몬스터가 필드 위로 잘렸고(실측: 1024×768 에서
  // image.top=-13 vs field.top=24, 37px 잘림) 필드 하단 100px 가 비어 있었다. 96 은 그 구간의
  // 가운데라 위아래 여백이 균형을 이룬다. 아군도 같은 두 줄에 세운다 — 사이드뷰는 양쪽이
  // 같은 지면 띠에 서야 대치 구도가 성립한다(아군 노드는 논리 96px 라 애초에 잘리지 않았다).
  rm2003: { partyFacing: "front", partyScale: 1.2, enemy: (i) => ({ x: 68 + (i % 2) * 58, y: 96 + Math.floor(i / 2) * 46 }), party: (i) => ({ x: 224 + (i % 2) * 46, y: 96 + Math.floor(i / 2) * 56 }) },
  // RM2000 프론트뷰: 숨김 파티, 적 중앙 수평.
  rm2000: { partyFacing: "hidden", enemy: (i, n) => ({ x: 160 + (i - (n - 1) / 2) * 48, y: 76 }), party: () => ({ x: 160, y: 150 }) },
  // 옥토패스 HD-2D: 오버숄더 — 적 상단 얕게, 아군 하단 깊게, HD 간격.
  octopath: { partyFacing: "back", partyScale: 1.15, enemy: (i) => ({ x: 72 + (i % 2) * 54, y: 47 + Math.floor(i / 2) * 27 }), party: (i) => ({ x: 236 + (i % 2) * 42, y: 88 + Math.floor(i / 2) * 52 }) },
  // 크로노 액티브: 대각 액티브 — 적 우상 일렬, 아군 좌하 클러스터.
  // y 48 → 86: 한 줄 전원이 필드 위로 55px 잘리고 발이 지평선보다 66px 위에 떠 있었다(실측).
  chrono: { partyFacing: "front", partyScale: 1.2, enemy: (i) => ({ x: 250 - i * 50, y: 48 }), party: (i) => ({ x: 62 + (i % 2) * 42, y: 104 + Math.floor(i / 2) * 30 }) },
  // 브레이블리: 사이드뷰 회화풍 — 더 촘촘, 아군 대형 스케일.
  bravely: { partyFacing: "back", partyScale: 1.35, enemy: (i) => ({ x: 64 + (i % 2) * 60, y: 47 + Math.floor(i / 2) * 27 }), party: (i) => ({ x: 218 + (i % 2) * 50, y: 84 + Math.floor(i / 2) * 56 }) },
  // 드퀘 1인칭: 대형 단일 적 중앙, 아군 없음.
  dragonquest: { partyFacing: "hidden", enemy: (i, n) => ({ x: 160 + (i - (n - 1) / 2) * 60, y: 68 }), party: () => ({ x: 160, y: 150 }) },
  // FF 정통 사이드뷰: 적 좌측 2열, 아군 우측 세로 1열(진짜 칼럼).
  // 앞줄 y 76 → 82: 발이 지평선보다 5px 위였다(실측) — 줄 간격 58 은 그대로.
  ff: { partyFacing: "front", partyScale: 1.2, enemy: (i, n) => ({ x: 120 + (i - (n - 1) / 2) * 52, y: 46 }), party: (i) => ({ x: 242, y: 62 + i * 36 }) },
  // 마더: 사이키델릭 프론트뷰 — 적 상단, 간격 좁게.
  // y 62 → 84: 한 줄 전원이 필드 위로 24px 잘리고 발이 지평선보다 36px 위였다(실측).
  mother: { partyFacing: "hidden", enemy: (i, n) => ({ x: 160 + (i - (n - 1) / 2) * 50, y: 48 }), party: () => ({ x: 160, y: 150 }) },
  // 골든선 저앵글: 로우앵글 — 아군 대형·전방, 적 원경.
  goldensun: { partyFacing: "back", partyScale: 1.4, enemy: (i, n) => ({ x: 116 + (i - (n - 1) / 2) * 50, y: 46 }), party: (i) => ({ x: 232 + (i % 2) * 40, y: 92 + Math.floor(i / 2) * 48 }) },
  // MV 프론트뷰: 숨김 파티, RM2000보다 살짝 높은 중앙.
  // y 86 → 96: 필드 위로 2px 잘리고 발이 지평선보다 11px 위였다(실측).
  mv: { partyFacing: "hidden", enemy: (i, n) => ({ x: 160 + (i - (n - 1) / 2) * 52, y: 60 }), party: () => ({ x: 160, y: 150 }) },
  // VX Ace 프론트뷰: 좌측 2/3 정렬 — 우측 세로 명령창 회피.
  vxace: { partyFacing: "hidden", enemy: (i, n) => ({ x: 112 + (i - (n - 1) / 2) * 52, y: 96 }), party: () => ({ x: 112, y: 150 }) },
};

function skinPlacement(): SkinBattlerPlacement {
  return BATTLER_PLACEMENTS[activeSkin().id];
}

/** 스킨 전용 적 스프라이트(bskin-enemy-<id>)를 우선 사용. 없으면 null. */
function skinEnemySpriteUrl(): string | null {
  return resolveAssetResourceUrl(`bskin-enemy-${activeSkin().id}`, { project: store.getCurrent() });
}

/** 스킨 파티 스프라이트(정면/후면). 포켓몬은 몬스터 뒷모습을 쓴다. */
function skinPartySpriteUrl(index: number, facing: PartyFacing): string | null {
  if (facing === "hidden") return null;
  const id = activeSkin().id === "pokemon"
    ? "bskin-ally-creature-back"
    : `bskin-party-${index % 2 === 0 ? "warrior" : "mage"}-${facing}`;
  return resolveAssetResourceUrl(id, { project: store.getCurrent() });
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
    backdrop.style.backgroundImage = url
      ? `linear-gradient(rgba(5, 10, 24, 0.08), rgba(2, 4, 12, 0.22)), url("${url}")`
      : "";
  }
}

function syncEnemyGroup(field: HTMLElement, snapshot: BattleSnapshot, presentation?: BattleFieldPresentation): void {
  const group = field.querySelector(".battle-enemy-group");
  if (!group) return;
  for (const [index, enemy] of snapshot.enemies.entries()) {
    let node = group.querySelector<HTMLElement>(`[data-testid="${enemy.id}"]`);
    if (!node) {
      group.append(enemyButton(enemy, snapshot, index));
      node = group.querySelector<HTMLElement>(`[data-testid="${enemy.id}"]`);
    }
    if (!node) continue;
    syncEnemyNode(node, enemy, snapshot, presentation);
  }
  alignEnemyFeetToAuthoredY(group);
}

/** 저작 y 가 **스프라이트의 발**을 뜻하도록 노드를 라벨 스택 높이만큼 내린다.
 *  `.battle-enemy` 는 이미지 → 이름 → HUD 순 흐름 열인데 노드가 `translate(-50%, -100%)` 라
 *  앵커가 라벨 스택 **아래**에 잡힌다. 그래서 스프라이트는 저작 y 보다 라벨 높이만큼 떠 있었다
 *  (실측 node.bottom − image.bottom: rm2003 33px, rm2000 97px, octopath·bravely 109px,
 *  chrono 133px). 이게 "몬스터가 너무 위에 달려 있다"의 뿌리다 — y 값을 스킨마다 만지는 건
 *  증상 치료였다.
 *  라벨 높이는 스킨·이름 길이·게이지 수마다 달라 CSS 상수로 박을 수 없어 실측해서 심는다.
 *  오프셋은 노드 **높이**를 바꾸지 않으므로 (node.bottom − image.bottom) 이 불변이고,
 *  한 번의 패스로 수렴한다(재진입해도 같은 값). jsdom 은 rect 가 0 이라 자동으로 무해하다. */
function alignEnemyFeetToAuthoredY(group: Element): void {
  for (const node of group.querySelectorAll<HTMLElement>(".battle-enemy")) {
    const image = node.querySelector<HTMLElement>(".battle-enemy-image");
    if (!image) continue;
    const drop = node.getBoundingClientRect().bottom - image.getBoundingClientRect().bottom;
    if (!Number.isFinite(drop) || drop <= 0) continue;
    node.style.setProperty("--battle-enemy-label-drop", `${Math.round(drop)}px`);
  }
}

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
    syncStatusIcons(node, actor);
  }
}

function syncEnemyNode(node: HTMLElement, enemy: BattleBattlerSnapshot, snapshot: BattleSnapshot, presentation?: BattleFieldPresentation): void {
  const presented = presentedState(enemy, presentation);
  const targetable = snapshot.targetSelection?.side === "enemy" && snapshot.targetSelection.targetIds.includes(enemy.id);
  const selected = snapshot.targetSelection?.side === "enemy" && snapshot.targetSelection.selectedTargetId === enemy.id;
  node.classList.toggle("battle-target-candidate", targetable);
  node.classList.toggle("battle-target-selected", selected);
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
    node.append(enemyHpHud(enemy));
  }
  const hpText = node.querySelector<HTMLElement>(".battle-enemy-hp-text");
  if (hpText) hpText.textContent = `${presented.hp}/${enemy.maxHp}`;
  const hpBar = node.querySelector<HTMLElement>(".battle-enemy-hp-bar");
  if (hpBar) hpBar.style.setProperty("--battle-stat", `${hpPercent(presented.hp, enemy.maxHp)}%`);
  const mpBar = node.querySelector<HTMLElement>(".battle-enemy-mp-bar");
  if (mpBar) mpBar.style.setProperty("--battle-stat", `${hpPercent(enemy.mp, enemy.maxMp)}%`);
  const atbBar = node.querySelector<HTMLElement>(".battle-enemy-atb-bar");
  if (atbBar) atbBar.style.setProperty("--battle-stat", `${clampGauge(enemy.gauge)}%`);
  syncStatusIcons(node, enemy);
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
    // Generated battle sheets: 3 columns × idle/attack/hit along X.
    // Frame width must match actorBattleImage display frame (BATTLE_SHEET_CELL × BATTLE_ASSET_PIXEL_SCALE).
    const frameW = Number.parseFloat(sprite.style.getPropertyValue("--battle-sprite-frame-width"))
      || BATTLE_SHEET_CELL * BATTLE_ASSET_PIXEL_SCALE;
    const col = pose === "attack" ? 1 : pose === "hit" || pose === "dead" ? 2 : 0;
    sprite.style.backgroundPosition = `-${col * frameW}px 0`;
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
  popup.textContent = feedback.miss ? "MISS" : feedback.healing ? `+${feedback.amount}` : `-${feedback.amount}`;
  const anchor = findBattlerNode(field, feedback.targetId);
  if (anchor) {
    popup.style.setProperty("--battle-node-x", anchor.style.getPropertyValue("--battle-node-x"));
    popup.style.setProperty("--battle-node-y", anchor.style.getPropertyValue("--battle-node-y"));
    // 고정 -12% 오프셋은 스프라이트 키에 따라 몸통 한가운데(적)나 발밑(아군)으로
    // 흩어진다 — 실측한 스프라이트 상단 30% 지점(머리께)에 띄운다(9차 리뷰).
    // 상단 0% 를 쓰면 팝업 전체가 스프라이트 박스 위로 나가 높이 배치된 적에서는
    // 필드 밖(HUD 영역)까지 밀려났다.
    const sprite = anchor.querySelector<HTMLElement>(".battle-enemy-image, .battle-actor-image, .battle-actor-sprite") ?? anchor;
    const layerRect = layer.getBoundingClientRect();
    const spriteRect = sprite.getBoundingClientRect();
    if (layerRect.height > 0 && spriteRect.height > 0) {
      popup.style.top = `${((spriteRect.top - layerRect.top + spriteRect.height * 0.3) / layerRect.height) * 100}%`;
    }
    // 막타 팝업(900ms)이 기절 페이드(550~620ms)보다 오래 남아 빈 자리에 떠 있었다 —
    // 사망 대상의 팝업은 페이드와 함께 끝낸다(9차 리뷰).
    if (anchor.classList.contains("defeated")) popup.classList.add("battle-damage-popup-final");
  }
  layer.append(popup);
  window.setTimeout(() => popup.remove(), 900);
}

function appendEffectsLayer(field: HTMLElement): HTMLElement {
  const layer = document.createElement("div");
  layer.className = "battle-effects-layer";
  layer.dataset.testid = "battle-effects-layer";
  field.append(layer);
  return layer;
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
  if (url) {
    backdrop.style.backgroundImage = `linear-gradient(rgba(4, 10, 24, 0.12), rgba(2, 6, 14, 0.28)), url("${url}")`;
  }
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
  for (const [index, enemy] of enemies.entries()) {
    group.append(enemyButton(enemy, snapshot, index));
  }
  return group;
}

function enemyButton(enemy: BattleBattlerSnapshot, snapshot: BattleSnapshot, index = 0): HTMLButtonElement {
  const enemyNode = document.createElement("button");
  enemyNode.type = "button";
  enemyNode.className = "battle-enemy";
  // 스킨 뷰 문법에 따라 적 위치를 결정한다(사이드=좌측, 프론트/1인칭=중앙, 포켓몬=우상).
  const enemyCount = snapshot.enemies.length;
  const ep = skinPlacement().enemy(index, enemyCount);
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
  const resourceId = monsterResourceId(enemy.recordId);
  const perEnemyUrl = resourceId ? resolveAssetResourceUrl(resourceId, { project: store.getCurrent() }) : null;
  const skinUrl = skinEnemySpriteUrl();
  const url = perEnemyUrl ?? skinUrl;
  if (resourceId) enemyNode.dataset.monsterResourceId = resourceId;
  if (url) {
    const image = document.createElement("img");
    image.className = "battle-enemy-image";
    image.alt = `${enemy.name} 몬스터`;
    image.src = url;
    enemyNode.append(image);
  }
  applyBattlerPose(enemyNode, enemy.pose);
  const name = document.createElement("span");
  name.className = "battle-enemy-name";
  name.textContent = enemy.name;
  enemyNode.append(name, enemyIndexBadge(index), statusIconCluster(enemy), enemyHpHud(enemy));
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
  const place = skinPlacement();
  group.dataset.partyFacing = place.partyFacing;
  // 1인칭/프론트뷰 스킨(드퀘·마더·rm2000)은 아군 스프라이트를 그리지 않는다.
  if (place.partyFacing === "hidden") {
    group.dataset.hidden = "true";
    return group;
  }
  // 포켓몬은 선두 1마리(몬스터 뒷모습)만 필드에 세운다.
  const shown = place.partyMax ? actors.slice(0, place.partyMax) : actors;
  for (const [index, actor] of shown.entries()) {
    group.append(actorNode(actor, index));
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

function actorNode(actor: BattleBattlerSnapshot, index = 0): HTMLElement {
  const node = document.createElement("div");
  node.className = "battle-actor";
  const place = skinPlacement();
  const ap = place.party(index, 4);
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
  const skinSprite = skinPartySpriteUrl(index, place.partyFacing);
  if (skinSprite) {
    const image = document.createElement("img");
    image.className = "battle-actor-image battle-skin-actor-image";
    image.alt = actor.name;
    image.src = skinSprite;
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

/** Side-view approach / knockback classes for the current resolve beat. */
export function applyActionMotion(field: HTMLElement, beat: BattleActionBeat | undefined): void {
  for (const node of field.querySelectorAll<HTMLElement>(".battle-actor, .battle-enemy")) {
    node.classList.remove(
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
    if (beat.userMotion === "lunge") user.classList.add("battle-motion-lunge");
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
  // 스킨 CSS(_vxace/_rm2003)는 아직 셀 크기 × 격자로 background 를 계산한다. 격자 1 · 열/행 0 이
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
    sprite.setAttribute("role", "img");
    sprite.setAttribute("aria-label", `${name} 전투 캐릭터`);
    sprite.style.setProperty("--battle-sprite-frame-width", `${frameW}px`);
    sprite.style.setProperty("--battle-sprite-frame-height", `${frameH}px`);
    sprite.style.backgroundPosition = "0 0";
    sprite.style.backgroundSize = `${frameW * BATTLE_SHEET_COLUMNS}px ${frameH * BATTLE_SHEET_ROWS}px`;
    sprite.style.backgroundImage = `url("${url}")`;
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

function monsterResourceId(recordId: string): string | undefined {
  return store.getCurrent().database.enemies.find((enemy) => enemy.id === recordId)?.monsterResourceId;
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
