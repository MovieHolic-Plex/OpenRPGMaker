import type { BattleActionBeat } from "@/player/battleActionBeats";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import type { BattleBattlerSnapshot, BattleSnapshot } from "@/battle/runtime";
import { getBattleSkin, resolveSkinId } from "@/battle/skins/registry";
import type { BattleSkin, BattleSkinId } from "@/battle/skins/types";
import type { DamageFeedback } from "@/player/battleSequencer";
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
  rm2003: { partyFacing: "front", partyScale: 1.2, enemy: (i) => ({ x: 66 + (i % 2) * 40, y: 60 + i * 28 }), party: (i) => ({ x: 250 - (i % 2) * 16, y: 50 + i * 27 }) },
  // RM2000 프론트뷰: 아군 스프라이트 없음, 적 정면 중앙 정렬.
  rm2000: { partyFacing: "hidden", enemy: (i, n) => ({ x: 160 + (i - (n - 1) / 2) * 48, y: 82 }), party: () => ({ x: 160, y: 150 }) },
  // 옥토패스 HD-2D: 적 좌측, 아군 뒷모습 우측(오버숄더).
  octopath: { partyFacing: "back", partyScale: 1.2, enemy: (i) => ({ x: 66 + (i % 2) * 38, y: 58 + i * 28 }), party: (i) => ({ x: 248 - (i % 2) * 16, y: 50 + i * 27 }) },
  // 크로노 액티브: 대각 배치 — 아군 좌하 클러스터, 적 우상, 아군 정면.
  chrono: { partyFacing: "front", partyScale: 1.2, enemy: (i) => ({ x: 220 - i * 38, y: 48 }), party: (i) => ({ x: 62 + (i % 2) * 42, y: 104 + Math.floor(i / 2) * 30 }) },
  // 브레이블리: 사이드뷰, 아군 뒷모습 우측, 회화풍.
  bravely: { partyFacing: "back", partyScale: 1.2, enemy: (i) => ({ x: 68 + (i % 2) * 38, y: 60 + i * 28 }), party: (i) => ({ x: 248 - (i % 2) * 16, y: 50 + i * 27 }) },
  // 드퀘 1인칭: 아군 없음, 적 중앙 정면.
  dragonquest: { partyFacing: "hidden", enemy: (i, n) => ({ x: 160 + (i - (n - 1) / 2) * 54, y: 78 }), party: () => ({ x: 160, y: 150 }) },
  // FF 정통 사이드뷰: 적 좌측, 아군 정면 우측 세로열.
  ff: { partyFacing: "front", partyScale: 1.2, enemy: (i) => ({ x: 66 + (i % 2) * 38, y: 58 + i * 28 }), party: (i) => ({ x: 252 - (i % 2) * 16, y: 50 + i * 27 }) },
  // 마더 1인칭: 아군 없음, 적 정면 중앙.
  mother: { partyFacing: "hidden", enemy: (i, n) => ({ x: 160 + (i - (n - 1) / 2) * 46, y: 74 }), party: () => ({ x: 160, y: 150 }) },
  // 골든선 저앵글: 카메라 파티 뒤 → 아군 뒷모습 우측하단, 적 좌측.
  goldensun: { partyFacing: "back", partyScale: 1.3, enemy: (i) => ({ x: 74 + (i % 2) * 36, y: 62 + i * 26 }), party: (i) => ({ x: 244 - (i % 2) * 16, y: 62 + i * 27 }) },
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
  for (const actor of snapshot.actors) {
    const row = party.querySelector<HTMLElement>(`.battle-actor-status[data-record-id="${actor.recordId}"]`);
    if (!row) continue;
    const hp = row.querySelector(".battle-actor-hp");
    if (hp) hp.textContent = `HP ${actor.hp}/${actor.maxHp}`;
    const mp = row.querySelector(".battle-actor-mp");
    if (mp) mp.textContent = `MP ${actor.mp}/${actor.maxMp}`;
    const hpBar = row.querySelector<HTMLElement>(".battle-stat-bar-hp");
    if (hpBar) {
      const pct = hpPercent(actor.hp, actor.maxHp);
      hpBar.style.setProperty("--battle-stat", `${pct}%`);
      hpBar.dataset.hpState = hpBarState(pct);
    }
    const atbBar = row.querySelector<HTMLElement>(".battle-atb-bar");
    if (atbBar) atbBar.style.setProperty("--battle-atb", `${Math.max(0, Math.min(100, Math.round(actor.gauge)))}%`);
    row.classList.toggle("defeated", actor.defeated);
  }
}

/** 활성 스킨이 전용 배경을 정의하면 그것이 전투장(battlefield)을 결정한다.
 *  스킨 배경이 없을 때만 troop/system 이 지정한 배경으로 폴백한다. */
function effectiveBackdropId(resourceId: string | undefined): string | undefined {
  return activeSkin().defaultBackdropResourceId ?? resourceId;
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
  node.classList.toggle("battle-target-candidate", snapshot.targetSelection?.targetEnemyIds.includes(enemy.id) ?? false);
  node.classList.toggle("battle-target-selected", snapshot.targetSelection?.selectedEnemyId === enemy.id);
  node.classList.toggle("defeated", enemy.defeated);
  applyBattlerPose(node, enemy.pose);
  node.dataset.battleTargetable = snapshot.targetSelection?.targetEnemyIds.includes(enemy.id) ? "true" : "false";
  if (node instanceof HTMLButtonElement) {
    node.disabled = enemy.defeated || !snapshot.targetSelection?.targetEnemyIds.includes(enemy.id);
  }
  if (!node.querySelector(".battle-enemy-hud")) {
    node.append(enemyHpHud(enemy));
  }
  const hpText = node.querySelector<HTMLElement>(".battle-enemy-hp-text");
  if (hpText) hpText.textContent = `${enemy.hp}/${enemy.maxHp}`;
  const hpBar = node.querySelector<HTMLElement>(".battle-enemy-hp-bar");
  if (hpBar) hpBar.style.setProperty("--battle-stat", `${hpPercent(enemy.hp, enemy.maxHp)}%`);
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
    // Frame width must match actorBattleImage display frame (96px = 2× of 48).
    const frameW = Number.parseFloat(sprite.style.getPropertyValue("--battle-sprite-frame-width")) || 96;
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
  // 스킨 전용 적 스프라이트를 우선(스킨마다 다른 몬스터). 없으면 troop 몬스터 그래픽.
  const resourceId = monsterResourceId(enemy.recordId);
  const skinUrl = skinEnemySpriteUrl();
  const url = skinUrl ?? (resourceId ? resolveAssetResourceUrl(resourceId, { project: store.getCurrent() }) : null);
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
  enemyNode.append(name, statusIconCluster(enemy), enemyHpHud(enemy));
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
  hud.append(bar, text);
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
  // 파티 몬스터가 필드에 나선 경우: 종족 그래픽을 아군측(back) 스프라이트로 렌더.
  // 팩엔 정면 시트만 있어 CSS(.battle-monster-back)로 좌우반전+확대해 뒷모습을 근사한다.
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
  } else {
    const resourceId = battleCharsetResourceId(actor.recordId);
    if (resourceId) {
      node.dataset.battleCharsetResourceId = resourceId;
      const url = resolveAssetResourceUrl(resourceId, { project: store.getCurrent() });
      if (url) {
        node.append(actorBattleImage(actor.name, resourceId, url));
      }
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
  const user = findBattlerNode(field, beat.userId);
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
    lv.textContent = `Lv.${actor.level}`;
    name.append(lv);
  }

  const vitals = document.createElement("span");
  vitals.className = "battle-actor-vitals";
  const hp = document.createElement("span");
  hp.className = "battle-actor-hp";
  hp.textContent = `HP ${actor.hp}/${actor.maxHp}`;
  const mp = document.createElement("span");
  mp.className = "battle-actor-mp";
  mp.textContent = `MP ${actor.mp}/${actor.maxMp}`;
  vitals.append(hp, mp);

  const hpGauge = statBar("hp", actor.hp, actor.maxHp);
  row.append(name, vitals, hpGauge);
  if (battleFlow === "gauge") {
    const gauge = document.createElement("span");
    gauge.className = "battle-actor-gauge";
    gauge.append(atbLabel(), atbBar(actor.gauge));
    row.append(gauge);
  }
  return row;
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
  label.textContent = "T";
  return label;
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
    const frameW = 96;
    const frameH = 128;
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
