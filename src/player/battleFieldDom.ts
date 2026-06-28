import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import type { BattleBattlerSnapshot, BattleSnapshot } from "@/battle/runtime";
import { store } from "@/project/store";

export function battleField(snapshot: BattleSnapshot): HTMLElement {
  const field = document.createElement("div");
  field.className = "battle-field";
  field.append(
    battleBackdrop(snapshot.backdropResourceId),
    battleTitle(snapshot.troopId),
    enemyGroup(snapshot.enemies),
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
      backdrop.style.backgroundImage = `linear-gradient(rgba(14, 18, 28, 0.18), rgba(14, 18, 28, 0.24)), url("${url}")`;
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

function enemyGroup(enemies: readonly BattleBattlerSnapshot[]): HTMLElement {
  const group = document.createElement("div");
  group.className = "battle-enemy-group";
  for (const enemy of enemies) {
    group.append(enemyButton(enemy));
  }
  return group;
}

function enemyButton(enemy: BattleBattlerSnapshot): HTMLButtonElement {
  const enemyNode = document.createElement("button");
  enemyNode.type = "button";
  enemyNode.className = "battle-enemy";
  enemyNode.dataset.testid = enemy.id;
  enemyNode.dataset.recordId = enemy.recordId;
  enemyNode.dataset.facing = "right";
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
  enemyNode.append(statusIconCluster(enemy.id));
  enemyNode.append(document.createTextNode(`${enemy.name} ${enemy.hp}/${enemy.maxHp}`));
  enemyNode.disabled = enemy.defeated;
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
  node.append(statusIconCluster(actor.recordId));
  if (actor.defeated) node.classList.add("defeated");
  return node;
}

function actorStatusRow(actor: BattleBattlerSnapshot): HTMLElement {
  const row = document.createElement("div");
  row.className = "battle-actor-status";
  row.dataset.recordId = actor.recordId;
  const name = document.createElement("span");
  name.className = "battle-actor-name";
  name.textContent = actor.name;
  const state = document.createElement("span");
  state.className = "battle-actor-state";
  state.textContent = actor.defeated ? "전투불능" : "정상";
  const hp = document.createElement("span");
  hp.className = "battle-actor-hp";
  hp.textContent = `${actor.hp}`;
  const gauge = document.createElement("span");
  gauge.className = "battle-actor-gauge";
  gauge.append(atbLabel(), atbBar(actor.gauge));
  row.append(name, state, hp, gauge);
  return row;
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

function statusIconCluster(key: string): HTMLElement {
  const cluster = document.createElement("span");
  cluster.className = "battle-status-icons";
  const icons = key.includes("sylph") || key.endsWith("_klaus")
    ? ["sleep"]
    : key.includes("slime") || key.endsWith("_albert")
      ? ["question", "poison"]
      : ["burst"];
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
  if (resourceId === "hero" || (resourceId.startsWith("generated-actor-") && resourceId.endsWith("-battle"))) {
    const sprite = document.createElement("span");
    sprite.className = "battle-actor-sprite";
    sprite.dataset.testid = `battle-actor-sprite-${resourceId}`;
    sprite.setAttribute("role", "img");
    sprite.setAttribute("aria-label", `${name} 전투 캐릭터`);
    sprite.style.setProperty("--battle-sprite-frame-width", "48px");
    sprite.style.setProperty("--battle-sprite-frame-height", "48px");
    sprite.style.backgroundPosition = "0 0";
    sprite.style.backgroundImage = `url("${url}")`;
    return sprite;
  }
  const image = document.createElement("img");
  image.className = "battle-actor-image";
  image.alt = `${name} 전투 캐릭터`;
  image.src = url;
  return image;
}

function monsterResourceId(recordId: string): string | undefined {
  return store.getCurrent().database.enemies.find((enemy) => enemy.id === recordId)?.monsterResourceId;
}
