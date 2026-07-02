import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import type { BattleBattlerSnapshot, BattleSnapshot } from "@/battle/runtime";
import { store } from "@/project/store";

export function battleField(snapshot: BattleSnapshot): HTMLElement {
  const field = document.createElement("div");
  field.className = "battle-field";
  field.append(
    battleBackdrop(snapshot.backdropResourceId),
    battleTitle(snapshot.troopId),
    enemyGroup(snapshot.enemies, snapshot),
    actorSpriteGroup(snapshot.actors)
  );
  return field;
}

export function battlePartyStatus(snapshot: BattleSnapshot): HTMLElement {
  return partyStatusGroup(snapshot.actors);
}

function battleBackdrop(resourceId: string | undefined): HTMLElement {
  const backdrop = document.createElement("div");
  backdrop.className = "battle-backdrop";
  backdrop.dataset.testid = "battle-backdrop";
  if (resourceId) {
    backdrop.dataset.backdropResourceId = resourceId;
    backdrop.title = "전투 배경";
    const url = resolveAssetResourceUrl(resourceId, { project: store.getCurrent() });
    if (url) {
      backdrop.style.backgroundImage = `linear-gradient(rgba(5, 10, 24, 0.08), rgba(2, 4, 12, 0.22)), url("/generated/battle-reference-forest.png"), url("${url}")`;
    }
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
  for (const enemy of enemies) {
    group.append(enemyButton(enemy, snapshot));
  }
  return group;
}

function enemyButton(enemy: BattleBattlerSnapshot, snapshot: BattleSnapshot): HTMLButtonElement {
  const enemyNode = document.createElement("button");
  enemyNode.type = "button";
  enemyNode.className = "battle-enemy";
  positionBattleNode(enemyNode, enemy.battleX, enemy.battleY);
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
  const resourceId = monsterResourceId(enemy.recordId);
  if (resourceId) {
    enemyNode.dataset.monsterResourceId = resourceId;
    const url = resolveAssetResourceUrl(resourceId, { project: store.getCurrent() });
    if (url) {
      const image = document.createElement("img");
      image.className = "battle-enemy-image";
      image.alt = `${enemy.name} 몬스터`;
      image.src = url;
      enemyNode.append(image);
    }
  }
  enemyNode.append(statusIconCluster(enemy));
  if (snapshot.targetSelection?.selectedEnemyId === enemy.id) {
    const brackets = document.createElement("span");
    brackets.className = "battle-target-brackets";
    brackets.dataset.testid = "battle-target-brackets";
    brackets.setAttribute("aria-hidden", "true");
    enemyNode.append(brackets);
  }
  enemyNode.append(document.createTextNode(`${enemy.name} ${enemy.hp}/${enemy.maxHp}`));
  if (enemy.defeated) enemyNode.classList.add("defeated");
  enemyNode.disabled = enemy.defeated || !snapshot.targetSelection?.targetEnemyIds.includes(enemy.id);
  return enemyNode;
}

function actorSpriteGroup(actors: readonly BattleBattlerSnapshot[]): HTMLElement {
  const group = document.createElement("div");
  group.className = "battle-actor-group";
  for (const actor of actors) {
    group.append(actorNode(actor));
  }
  return group;
}

function partyStatusGroup(actors: readonly BattleBattlerSnapshot[]): HTMLElement {
  const group = document.createElement("div");
  group.className = "battle-party";
  group.dataset.testid = "battle-party";
  for (const actor of actors) {
    group.append(actorStatusRow(actor));
  }
  return group;
}

function actorNode(actor: BattleBattlerSnapshot): HTMLElement {
  const node = document.createElement("div");
  node.className = "battle-actor";
  positionBattleNode(node, actor.battleX, actor.battleY);
  node.dataset.testid = `battle-actor-${actor.recordId}`;
  node.dataset.recordId = actor.recordId;
  node.dataset.facing = "left";
  node.setAttribute("aria-label", actor.name);
  const resourceId = battleCharsetResourceId(actor.recordId);
  if (resourceId) {
    node.dataset.battleCharsetResourceId = resourceId;
    const url = resolveAssetResourceUrl(resourceId, { project: store.getCurrent() });
    if (url) {
      node.append(actorBattleImage(actor.name, resourceId, url));
    }
  }
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

function clampBattleCoordinate(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function actorStatusRow(actor: BattleBattlerSnapshot): HTMLElement {
  const row = document.createElement("div");
  row.className = "battle-actor-status";
  row.dataset.recordId = actor.recordId;
  const name = document.createElement("span");
  name.className = "battle-actor-name";
  name.textContent = actor.name;
  const hp = document.createElement("span");
  hp.className = "battle-actor-hp";
  hp.textContent = `HP ${actor.hp}/${actor.maxHp}`;
  const mp = document.createElement("span");
  mp.className = "battle-actor-mp";
  mp.textContent = `MP ${actor.mp}/${actor.maxMp}`;
  const gauge = document.createElement("span");
  gauge.className = "battle-actor-gauge";
  gauge.append(atbLabel(), atbBar(actor.gauge));
  const hpGauge = statBar("hp", actor.hp, actor.maxHp);
  row.append(name, hp, mp, hpGauge, gauge);
  return row;
}

function statBar(kind: "hp" | "mp" | "tp", value: number, max: number): HTMLElement {
  const bar = document.createElement("span");
  bar.className = `battle-stat-bar battle-stat-bar-${kind}`;
  bar.style.setProperty("--battle-stat", `${Math.max(0, Math.min(100, Math.round(value / Math.max(1, max) * 100)))}%`);
  return bar;
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

// 상태 ID(stateIds)를 표시용 아이콘 토큰으로 매핑.
// RM2K3 핵심 상태만 시각화하고, 알 수 없는 상태는 일반 표식(burst)으로 표시한다.
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

function statusIconCluster(battler: BattleBattlerSnapshot): HTMLElement {
  const cluster = document.createElement("span");
  cluster.className = "battle-status-icons";
  // 실제 적용된 상태(stateIds)만 표시. 거짓 표시(이름 기반 추측) 제거.
  const icons = battler.stateIds.slice(0, 4).map(stateIconToken);
  if (battler.defeated) icons.unshift("death");
  for (const icon of icons) {
    const node = document.createElement("span");
    node.className = `battle-status-icon battle-status-icon-${icon}`;
    node.dataset.statusIcon = icon;
    node.setAttribute("aria-hidden", "true");
    cluster.append(node);
  }
  return cluster;
}

function battleCharsetResourceId(recordId: string): string | undefined {
  return store.getCurrent().database.actors.find((actor) => actor.id === recordId)?.battleCharacterResourceId;
}

function actorBattleImage(name: string, resourceId: string, url: string): HTMLElement {
  if (resourceId === "hero" || isGeneratedBattleActor(resourceId)) {
    const sprite = document.createElement("span");
    sprite.className = "battle-actor-sprite";
    sprite.dataset.testid = `battle-actor-sprite-${resourceId}`;
    sprite.setAttribute("role", "img");
    sprite.setAttribute("aria-label", `${name} 전투 캐릭터`);
    sprite.style.setProperty("--battle-sprite-frame-width", "36px");
    sprite.style.setProperty("--battle-sprite-frame-height", "48px");
    sprite.style.backgroundPosition = "0 0";
    sprite.style.backgroundSize = "108px 288px";
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
