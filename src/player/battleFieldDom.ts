import type { BattleActionBeat } from "@/player/battleActionBeats";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import type { BattleBattlerSnapshot, BattleSnapshot } from "@/battle/runtime";
import { getBattleSkin, resolveSkinId } from "@/battle/skins/registry";
import type { BattleSkin, BattleSkinId } from "@/battle/skins/types";
import type { DamageFeedback } from "@/player/battleSequencer";
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

const BATTLER_PLACEMENTS: Record<BattleSkinId, SkinBattlerPlacement> = {
  // 포켓몬: 내 몬스터 뒷모습 좌하 + 적 몬스터 정면 상단(좌측 플레이존), 선두 1마리만.
  pokemon: { partyFacing: "back", partyMax: 1, partyScale: 1.25, enemy: (i) => ({ x: 150 - i * 40, y: 84 }), party: (i) => ({ x: 78 + i * 36, y: 138 }) },
  // RM2003 사이드뷰: 적 좌측 열, 아군 정면 우측 세로열.
    rm2003: { partyFacing: "front", partyScale: 1.2, enemy: (i) => ({ x: 76 + (i % 2) * 56, y: 82 + Math.floor(i / 2) * 58 }), party: (i) => ({ x: 226 + (i % 2) * 48, y: 82 + Math.floor(i / 2) * 58 }) },
  // RM2000 프론트뷰: 아군 스프라이트 없음, 적 정면 중앙 정렬.
  rm2000: { partyFacing: "hidden", enemy: (i, n) => ({ x: 160 + (i - (n - 1) / 2) * 48, y: 82 }), party: () => ({ x: 160, y: 150 }) },
  // 옥토패스 HD-2D: 적 좌측, 아군 뒷모습 우측(오버숄더).
  octopath: { partyFacing: "back", partyScale: 1.2, enemy: (i) => ({ x: 76 + (i % 2) * 56, y: 82 + Math.floor(i / 2) * 58 }), party: (i) => ({ x: 226 + (i % 2) * 48, y: 82 + Math.floor(i / 2) * 58 }) },
  // 크로노 액티브: 대각 배치 — 아군 좌하 클러스터, 적 우상, 아군 정면.
  chrono: { partyFacing: "front", partyScale: 1.2, enemy: (i) => ({ x: 220 - i * 38, y: 48 }), party: (i) => ({ x: 62 + (i % 2) * 42, y: 104 + Math.floor(i / 2) * 30 }) },
  // 브레이블리: 사이드뷰, 아군 뒷모습 우측, 회화풍.
  bravely: { partyFacing: "back", partyScale: 1.2, enemy: (i) => ({ x: 76 + (i % 2) * 56, y: 82 + Math.floor(i / 2) * 58 }), party: (i) => ({ x: 226 + (i % 2) * 48, y: 82 + Math.floor(i / 2) * 58 }) },
  // 드퀘 1인칭: 아군 없음, 적 중앙 정면.
  dragonquest: { partyFacing: "hidden", enemy: (i, n) => ({ x: 160 + (i - (n - 1) / 2) * 54, y: 78 }), party: () => ({ x: 160, y: 150 }) },
  // FF 정통 사이드뷰: 적 좌측, 아군 정면 우측 세로열.
  ff: { partyFacing: "front", partyScale: 1.2, enemy: (i) => ({ x: 76 + (i % 2) * 56, y: 82 + Math.floor(i / 2) * 58 }), party: (i) => ({ x: 226 + (i % 2) * 48, y: 82 + Math.floor(i / 2) * 58 }) },
  // 마더 1인칭: 아군 없음, 적 정면 중앙.
  mother: { partyFacing: "hidden", enemy: (i, n) => ({ x: 160 + (i - (n - 1) / 2) * 46, y: 74 }), party: () => ({ x: 160, y: 150 }) },
  // 골든선 저앵글: 카메라 파티 뒤 → 아군 뒷모습 우측하단, 적 좌측.
  goldensun: { partyFacing: "back", partyScale: 1.3, enemy: (i) => ({ x: 76 + (i % 2) * 56, y: 82 + Math.floor(i / 2) * 58 }), party: (i) => ({ x: 226 + (i % 2) * 48, y: 82 + Math.floor(i / 2) * 58 }) },
  // RPG Maker MV 프론트뷰: 아군 스프라이트 없음, 적 정면 중앙 정렬(rm2000과 동일 배치).
  mv: { partyFacing: "hidden", enemy: (i, n) => ({ x: 160 + (i - (n - 1) / 2) * 48, y: 82 }), party: () => ({ x: 160, y: 150 }) },
  // VX Ace 프론트뷰: 아군 스프라이트 없음(하단 파티 셀이 아군 표시), 적은 필드 좌측 2/3 안에 정면 정렬.
  // 우측은 세로 명령창이 덮는다 — 실제 명령창 폭은 _vxace.css 의 .battle-command-host width: 150px
  // (640 논리 기준, 이 0..320 저작 좌표계로는 75 에 해당)이므로 적 중심을 x=112 로 왼쪽으로 당긴다.
  vxace: { partyFacing: "hidden", enemy: (i, n) => ({ x: 112 + (i - (n - 1) / 2) * 52, y: 104 }), party: () => ({ x: 112, y: 150 }) },
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

export function syncBattleField(field: HTMLElement, snapshot: BattleSnapshot, feedback?: DamageFeedback): void {
  syncBackdrop(field, snapshot.backdropResourceId);
  syncEnemyGroup(field, snapshot);
  syncActorGroup(field, snapshot.actors);
  if (feedback) showDamageFeedback(field, feedback);
}

export function battlePartyStatus(snapshot: BattleSnapshot): HTMLElement {
  return partyStatusGroup(snapshot.actors, snapshot.battleFlow);
}

export function syncBattleParty(party: HTMLElement, snapshot: BattleSnapshot): void {
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
    const hp = row.querySelector(".battle-actor-hp");
    if (hp) setVitalNode(hp, "hp", actor.hp, actor.maxHp);
    const mp = row.querySelector(".battle-actor-mp");
    if (mp) setVitalNode(mp, "mp", actor.mp, actor.maxMp);
    // 참조의 ▼ 표식 — 지금 명령을 입력받는 액터의 셀 위에 붙는다(실제 스냅샷 값).
    row.classList.toggle("is-active-actor", Boolean(snapshot.activeActorId) && actor.recordId === snapshot.activeActorId);
    const hpBar = row.querySelector<HTMLElement>(".battle-stat-bar-hp");
    if (hpBar) {
      const pct = hpPercent(actor.hp, actor.maxHp);
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
    row.classList.toggle("defeated", actor.defeated);
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

function syncEnemyGroup(field: HTMLElement, snapshot: BattleSnapshot): void {
  const group = field.querySelector(".battle-enemy-group");
  if (!group) return;
  for (const [index, enemy] of snapshot.enemies.entries()) {
    let node = group.querySelector<HTMLElement>(`[data-testid="${enemy.id}"]`);
    if (!node) {
      group.append(enemyButton(enemy, snapshot, index));
      node = group.querySelector<HTMLElement>(`[data-testid="${enemy.id}"]`);
    }
    if (!node) continue;
    syncEnemyNode(node, enemy, snapshot);
  }
}

function syncActorGroup(field: HTMLElement, actors: readonly BattleBattlerSnapshot[]): void {
  const group = field.querySelector(".battle-actor-group");
  if (!group) return;
  for (const actor of actors) {
    const node = group.querySelector<HTMLElement>(`[data-testid="battle-actor-${actor.recordId}"]`);
    if (!node) continue;
    node.classList.toggle("defeated", actor.defeated);
    applyBattlerPose(node, actor.pose);
    syncStatusIcons(node, actor);
  }
}

function syncEnemyNode(node: HTMLElement, enemy: BattleBattlerSnapshot, snapshot: BattleSnapshot): void {
  const targetable = snapshot.targetSelection?.targetEnemyIds.includes(enemy.id) ?? false;
  const selected = snapshot.targetSelection?.selectedEnemyId === enemy.id;
  node.classList.toggle("battle-target-candidate", targetable);
  node.classList.toggle("battle-target-selected", selected);
  node.classList.toggle("defeated", enemy.defeated);
  applyBattlerPose(node, enemy.pose);
  node.dataset.battleTargetable = targetable ? "true" : "false";
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
  if (hpText) hpText.textContent = `${enemy.hp}/${enemy.maxHp}`;
  const hpBar = node.querySelector<HTMLElement>(".battle-enemy-hp-bar");
  if (hpBar) hpBar.style.setProperty("--battle-stat", `${hpPercent(enemy.hp, enemy.maxHp)}%`);
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
    // Frame width must match actorBattleImage display frame (192px = 48 × 2 × BATTLE_ASSET_PIXEL_SCALE).
    const frameW = Number.parseFloat(sprite.style.getPropertyValue("--battle-sprite-frame-width")) || 192;
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
  backdrop.title = "전투 배경";
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
  enemyNode.dataset.testid = enemy.id;
  enemyNode.dataset.recordId = enemy.recordId;
  enemyNode.dataset.facing = "right";
  if (snapshot.targetSelection?.targetEnemyIds.includes(enemy.id)) {
    enemyNode.dataset.battleTargetable = "true";
    enemyNode.classList.add("battle-target-candidate");
  }
  if (snapshot.targetSelection?.selectedEnemyId === enemy.id) {
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
  if (snapshot.targetSelection?.selectedEnemyId === enemy.id) {
    const brackets = document.createElement("span");
    brackets.className = "battle-target-brackets";
    brackets.dataset.testid = "battle-target-brackets";
    brackets.setAttribute("aria-hidden", "true");
    enemyNode.append(brackets);
  }
  if (enemy.defeated) enemyNode.classList.add("defeated");
  enemyNode.disabled = enemy.defeated || !snapshot.targetSelection?.targetEnemyIds.includes(enemy.id);
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
  if (monsterResource) {
    node.dataset.monsterBattler = "true";
    const url = resolveAssetResourceUrl(monsterResource, { project: store.getCurrent() });
    if (url) {
      const image = document.createElement("img");
      image.className = "battle-actor-image battle-monster-image battle-monster-back";
      image.alt = `${actor.name} 몬스터`;
      image.src = url;
      node.append(image);
    }
    applyBattlerPose(node, actor.pose);
    node.append(statusIconCluster(actor));
    if (actor.defeated) node.classList.add("defeated");
    const platform = document.createElement("span");
    platform.className = "battle-actor-platform";
    node.append(platform);
    return node;
  }
  // 스킨 전용 파티 스프라이트(정면/후면)를 우선 사용한다.
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
  // 스킨이 아닌 일반 액터: 캐릭터셋 그래픽을 사용한다.
  const resourceId = battleCharsetResourceId(actor.recordId);
  if (resourceId) {
    node.dataset.battleCharsetResourceId = resourceId;
    const url = resolveAssetResourceUrl(resourceId, { project: store.getCurrent() });
    if (url) {
      node.append(actorBattleImage(actor.name, resourceId, url));
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
  node.title = className ?? "";
  node.textContent = initial;
  return node;
}

/** 파티 행 왼쪽의 얼굴 초상. faceset 시트(4×4, 셀 48px)를 CSS 변수로 크롭한다.
 *  얼굴 리소스가 없으면 노드를 만들지 않는다(가짜 플레이스홀더를 넣지 않는다). */
function actorFaceNode(actor: BattleBattlerSnapshot): HTMLElement | null {
  const project = store.getCurrent();
  const record = project.database.actors.find((entry) => entry.id === actor.recordId);
  if (!record) return null;
  const resourceId = record.faceResourceId ?? defaultActorFaceResourceId(record);
  if (!resourceId) return null;
  const url = resolveAssetResourceUrl(resourceId, { project });
  if (!url) return null;
  const index = Math.max(0, Math.trunc(record.faceIndex ?? 0)) % FACE_SHEET_GRID ** 2;
  const node = document.createElement("span");
  node.className = "battle-actor-face";
  node.dataset.testid = `battle-actor-face-${actor.recordId}`;
  node.setAttribute("role", "img");
  node.setAttribute("aria-label", `${actor.name} 얼굴`);
  node.style.setProperty("--battle-face-url", `url("${url}")`);
  applyFaceGrid(node, FACE_SHEET_GRID, index);
  // 모든 얼굴 리소스가 4×4 시트는 아니다 — 단일 초상 파일(예: 1254×1254 버스트)도 등록돼 있고,
  // 그걸 4×4 로 크롭하면 **좌상단 1/4 만** 나온다. 실제 크기를 읽어 격자를 정정한다.
  // (동기로는 알 수 없어 로드 후 CSS 변수만 갈아끼운다 — 첫 프레임은 4×4 로 그려진다.)
  correctFaceGridOnLoad(node, url, index);
  return node;
}

/** EasyRPG RTP faceset 시트는 192×192 = 4열×4행(48px 셀). */
const FACE_SHEET_GRID = 4;
/** RM 계열 faceset 한 칸의 변 길이(px). */
const FACE_CELL_PX = 48;

function applyFaceGrid(node: HTMLElement, grid: number, index: number): void {
  const wrapped = grid <= 1 ? 0 : index % (grid * grid);
  node.style.setProperty("--battle-face-grid", String(grid));
  node.style.setProperty("--battle-face-col", String(grid <= 1 ? 0 : wrapped % grid));
  node.style.setProperty("--battle-face-row", String(grid <= 1 ? 0 : Math.floor(wrapped / grid)));
  node.dataset.faceGrid = String(grid);
}

/** 실제 이미지 크기에서 격자 수를 추론한다. 폭과 높이를 함께 본다.
 *  RM 계열 faceset 은 정사각 시트이고 셀도 정사각 48px 다. 그래서 '폭==높이 이고 폭/48 이
 *  2~4 의 정수' 일 때만 시트(그 배수)로 보고, 그 외에는 전부 단일 초상(1)으로 본다.
 *
 *  이 판정으로 **실제로 고쳐진** 오판 사례(폭만 보던 시절에는 시트로 오판했다):
 *   - 384×384 단일 초상 → cells=8 은 4 초과 → grid 1 로 정정(예전엔 grid 8, 좌상단 1/64 만 표시)
 *   - 192×48 (4열 1행) 스트립 → 폭≠높이 → grid 1 로 정정(예전엔 grid 4, 없는 행을 크롭)
 *
 *  **여전히 모호해서 시트로 가정하는** 사례:
 *   - 96×96 → cells=2 는 2~4 범위 안이라 grid 2 로 판정한다. 이건 원리적으로 모호하다 —
 *     48px 얼굴의 2×2 시트일 수도, VX Ace 규격 96px 단일 얼굴일 수도 있고 이미지 크기만으로는
 *     구분할 수 없다. RM 관례상 96×96 은 2×2 시트가 흔하므로 시트로 가정하는 현재 동작이 합리적이다.
 *     96px 단일 얼굴을 쓰려면 이미지 크기로는 해결되지 않으므로 리소스 메타데이터로 격자를 명시해야 한다.
 *
 *  폭이 0 이하이거나 유한하지 않으면(로드 실패 등) 기존처럼 기본 격자를 유지한다. */
function faceGridFromNaturalSize(width: number, height: number): number {
  if (!Number.isFinite(width) || width <= 0) return FACE_SHEET_GRID;
  if (width !== height) return 1;
  const cells = width / FACE_CELL_PX;
  if (!Number.isInteger(cells) || cells < 2 || cells > 4) return 1;
  return cells;
}

/** 로드 성공/실패를 모두 다룬다.
 *  성공: 실제 이미지 크기(폭·높이)로 격자를 정정한다.
 *  실패(404 등): 얼굴 노드를 DOM 에서 제거한다. 그러면 '얼굴 리소스가 없으면 노드를 만들지
 *  않는다'는 기존 원칙이 404 에도 적용되어, vxace 스킨에서 셀 배경이 비고 테두리만 남지 않는다.
 *  vxace CSS 가 :not(:has(.battle-actor-face)) 로 열을 접으므로 레이아웃도 알아서 맞는다. */
function correctFaceGridOnLoad(node: HTMLElement, url: string, index: number): void {
  if (typeof Image === "undefined") return;
  const probe = new Image();
  probe.onload = () => {
    const grid = faceGridFromNaturalSize(probe.naturalWidth, probe.naturalHeight);
    if (grid !== FACE_SHEET_GRID) applyFaceGrid(node, grid, index);
  };
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
  if (stateId.includes("poison")) return "poison";
  if (stateId.includes("sleep")) return "sleep";
  if (stateId.includes("paraly") || stateId.includes("bind")) return "paralysis";
  if (stateId.includes("blind") || stateId.includes("dark")) return "blind";
  if (stateId.includes("silence") || stateId.includes("mute")) return "silence";
  if (stateId.includes("confuse") || stateId.includes("charm")) return "confuse";
  if (stateId.includes("death") || stateId.includes("down") || stateId.includes("ko")) return "death";
  return "burst";
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
    node.dataset.statusIcon = entry.icon;
    node.dataset.statusName = entry.name;
    node.title = entry.name;
    node.setAttribute("role", "img");
    node.setAttribute("aria-label", entry.name);
    cluster.append(node);
  }
  return cluster;
}

function battleCharsetResourceId(recordId: string): string | undefined {
  return store.getCurrent().database.actors.find((actor) => actor.id === recordId)?.battleCharacterResourceId;
}

function actorBattleImage(name: string, resourceId: string, url: string): HTMLElement {
  if (resourceId === "hero" || isGeneratedBattleActor(resourceId)) {
    // Generated battle sheets are 3×N grids of 48×64 cells (144×384 source).
    // Display at 2× so actors read as field protagonists, not stickers.
    // 논리 해상도가 640×480 이라 자산 px 를 그대로 쓰면 화면에서 절반으로 보인다
    // (battleStageScale: BATTLE_ASSET_PIXEL_SCALE).
    const frameW = 48 * 2 * BATTLE_ASSET_PIXEL_SCALE;
    const frameH = 64 * 2 * BATTLE_ASSET_PIXEL_SCALE;
    const sprite = document.createElement("span");
    sprite.className = "battle-actor-sprite";
    sprite.dataset.testid = `battle-actor-sprite-${resourceId}`;
    sprite.setAttribute("role", "img");
    sprite.setAttribute("aria-label", `${name} 전투 캐릭터`);
    sprite.style.setProperty("--battle-sprite-frame-width", `${frameW}px`);
    sprite.style.setProperty("--battle-sprite-frame-height", `${frameH}px`);
    sprite.style.backgroundPosition = "0 0";
    sprite.style.backgroundSize = `${frameW * 3}px ${frameH * 6}px`;
    sprite.style.backgroundImage = `url("${url}")`;
    return sprite;
  }
  const image = document.createElement("img");
  image.className = "battle-actor-image";
  image.alt = `${name} 전투 캐릭터`;
  image.src = url;
  return image;
}

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
