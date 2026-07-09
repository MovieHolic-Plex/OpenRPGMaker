import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import type { BattleBattlerSnapshot, BattleSnapshot } from "@/battle/runtime";
import type { DamageFeedback } from "@/player/battleSequencer";
import { store } from "@/project/store";

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
    if (hpBar) hpBar.style.setProperty("--battle-stat", `${hpPercent(actor.hp, actor.maxHp)}%`);
    const atbBar = row.querySelector<HTMLElement>(".battle-atb-bar");
    if (atbBar) atbBar.style.setProperty("--battle-atb", `${Math.max(0, Math.min(100, Math.round(actor.gauge)))}%`);
    row.classList.toggle("defeated", actor.defeated);
  }
}

function syncBackdrop(field: HTMLElement, resourceId: string | undefined): void {
  const backdrop = field.querySelector<HTMLElement>("[data-testid='battle-backdrop']");
  if (!backdrop) return;
  if (resourceId && backdrop.dataset.backdropResourceId !== resourceId) {
    backdrop.dataset.backdropResourceId = resourceId;
    const url = resolveAssetResourceUrl(resourceId, { project: store.getCurrent() });
    backdrop.style.backgroundImage = url
      ? `linear-gradient(rgba(5, 10, 24, 0.08), rgba(2, 4, 12, 0.22)), url("${url}")`
      : "";
  }
}

function syncEnemyGroup(field: HTMLElement, snapshot: BattleSnapshot): void {
  const group = field.querySelector(".battle-enemy-group");
  if (!group) return;
  for (const enemy of snapshot.enemies) {
    let node = group.querySelector<HTMLElement>(`[data-testid="${enemy.id}"]`);
    if (!node) {
      group.append(enemyButton(enemy, snapshot));
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
    syncStatusIcons(node, actor);
  }
}

function syncEnemyNode(node: HTMLElement, enemy: BattleBattlerSnapshot, snapshot: BattleSnapshot): void {
  node.classList.toggle("battle-target-candidate", snapshot.targetSelection?.targetEnemyIds.includes(enemy.id) ?? false);
  node.classList.toggle("battle-target-selected", snapshot.targetSelection?.selectedEnemyId === enemy.id);
  node.classList.toggle("defeated", enemy.defeated);
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

function showDamageFeedback(field: HTMLElement, feedback: DamageFeedback): void {
  const layer = field.querySelector<HTMLElement>(".battle-effects-layer")
    ?? appendEffectsLayer(field);
  const popup = document.createElement("span");
  popup.className = "battle-damage-popup";
  popup.dataset.testid = "battle-damage-popup";
  popup.dataset.targetId = feedback.targetId;
  popup.classList.toggle("battle-damage-popup-critical", feedback.critical);
  popup.classList.toggle("battle-damage-popup-heal", feedback.healing);
  popup.textContent = feedback.healing ? `+${feedback.amount}` : `-${feedback.amount}`;
  const anchor = field.querySelector<HTMLElement>(`[data-testid="${feedback.targetId}"]`);
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
  // Prefer troop/system authored backdrop. When absent, use the forest reference
  // so battles still read as a JRPG scene instead of a flat procedural gradient.
  const resolvedId = resourceId || "generated-battle-reference-forest";
  const url =
    resolveAssetResourceUrl(resolvedId, { project: store.getCurrent() })
    ?? (!resourceId ? "/generated/battle-reference-forest.png" : undefined);
  if (resourceId) backdrop.dataset.backdropResourceId = resourceId;
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
  for (const actor of actors) {
    group.append(actorNode(actor));
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
  bar.style.setProperty("--battle-stat", `${hpPercent(value, max)}%`);
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