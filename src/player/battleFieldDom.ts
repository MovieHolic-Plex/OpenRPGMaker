import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import type { BattleBattlerSnapshot, BattleSnapshot } from "@/battle/runtime";
import { store } from "@/project/store";
import {
  enemyWeaknesses,
  predictAttackDamage,
  predictEnemyDamageToParty,
  predictEnemyIntent,
} from "@/battle/battlePredict";

export function battleField(snapshot: BattleSnapshot): HTMLElement {
  const field = document.createElement("div");
  field.className = "battle-field";
  field.append(
    turnOrderRibbon(snapshot),
    battleBackdrop(snapshot.backdropResourceId),
    battleTitle(snapshot.troopId),
    enemyIntentCard(snapshot),
    weaknessChips(snapshot),
    targetAnalysisPanel(snapshot),
    expectedResultBanner(snapshot),
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

function turnOrderRibbon(snapshot: BattleSnapshot): HTMLElement {
  const ribbon = document.createElement("div");
  ribbon.className = "battle-turn-ribbon";
  ribbon.dataset.testid = "battle-turn-ribbon";

  const label = document.createElement("div");
  label.className = "battle-turn-label";
  const title = document.createElement("strong");
  title.textContent = "턴 순서";
  const turn = document.createElement("span");
  turn.textContent = `TURN ${String(Math.max(1, snapshot.turn + 1)).padStart(2, "0")}`;
  label.append(title, turn);
  ribbon.append(label);

  const battlers = [...snapshot.enemies.filter((enemy) => !enemy.defeated), ...snapshot.actors.filter((actor) => !actor.defeated)]
    .sort((a, b) => b.gauge - a.gauge || a.name.localeCompare(b.name))
    .slice(0, 6);
  const track = document.createElement("div");
  track.className = "battle-turn-track";
  battlers.forEach((battler, index) => {
    const token = document.createElement("span");
    token.className = "battle-turn-token";
    token.dataset.recordId = battler.recordId;
    token.dataset.kind = snapshot.enemies.some((enemy) => enemy.id === battler.id) ? "enemy" : "actor";
    if (battler.recordId === snapshot.activeActorId) token.classList.add("active");
    const image = battlerThumb(battler, token.dataset.kind);
    if (image) token.append(image);
    const order = document.createElement("span");
    order.className = "battle-turn-order";
    order.textContent = String(index + 1).padStart(2, "0");
    token.append(order);
    track.append(token);
  });
  const future = document.createElement("span");
  future.className = "battle-turn-future";
  track.append(future);
  ribbon.append(track);
  return ribbon;
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
  const preview = document.createElement("div");
  preview.className = "battle-resource-preview";
  preview.dataset.testid = "battle-resource-preview";
  const heading = document.createElement("div");
  heading.className = "battle-resource-heading";
  heading.textContent = "자원 미리보기";
  preview.append(heading);
  for (const actor of actors) {
    preview.append(actorStatusRow(actor));
  }
  const risk = document.createElement("div");
  risk.className = `battle-risk-label battle-risk-${riskLevel(actors)}`;
  risk.textContent = riskLabel(actors);
  preview.append(risk);
  group.append(preview);
  return group;
}

// 파티 전멸 위험도. 전투불능 비율과 남은 HP 비율로 판정한다.
type RiskLevel = "low" | "moderate" | "high" | "critical";

function riskLevel(actors: readonly BattleBattlerSnapshot[]): RiskLevel {
  if (actors.length === 0) return "high";
  const downed = actors.filter((actor) => actor.defeated).length;
  const remaining = actors.filter((actor) => !actor.defeated);
  if (remaining.length === 0) return "critical";
  const avgHpRatio = remaining.reduce((sum, actor) => sum + actor.hp / Math.max(1, actor.maxHp), 0) / remaining.length;
  if (downed >= Math.ceil(actors.length / 2)) return "high";
  if (avgHpRatio < 0.34 || downed > 0) return "moderate";
  return "low";
}

function riskLabel(actors: readonly BattleBattlerSnapshot[]): string {
  switch (riskLevel(actors)) {
    case "low": return "위험 낮음";
    case "moderate": return "위험 보통";
    case "high": return "위험 높음";
    case "critical": return "전멸 위기";
  }
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
  const state = document.createElement("span");
  state.className = "battle-actor-state";
  state.textContent = actor.defeated ? "전투불능" : "정상";
  const hp = document.createElement("span");
  hp.className = "battle-actor-hp";
  hp.textContent = String(actor.hp);
  const gauge = document.createElement("span");
  gauge.className = "battle-actor-gauge";
  gauge.append(atbLabel(), atbBar(actor.gauge));
  const hpGauge = statBar("hp", actor.hp, actor.maxHp);
  row.append(name, state, hp, hpGauge, gauge);
  return row;
}

function enemyIntentCard(snapshot: BattleSnapshot): HTMLElement {
  const enemy = focusEnemy(snapshot);
  const card = document.createElement("div");
  card.className = "battle-enemy-intent";
  card.dataset.testid = "battle-enemy-intent";
  const project = store.getCurrent();
  const intent = enemy ? predictEnemyIntent(project, enemy) : undefined;
  const next = document.createElement("div");
  next.className = "battle-enemy-intent-line";
  if (intent) {
    next.append(labelText("다음 행동: "), emphasisText(intent.skillName, "green"));
  } else {
    next.append(labelText("다음 행동: "), emphasisText("통상 공격", "green"));
  }
  const damage = document.createElement("div");
  damage.className = "battle-enemy-intent-line";
  const firstActor = snapshot.actors.find((actor) => !actor.defeated) ?? snapshot.actors[0];
  const predicted = enemy && firstActor ? predictEnemyDamageToParty(project, enemy, firstActor) : 0;
  damage.append(labelText("예상 "), emphasisText(String(Math.max(0, predicted)), "orange"), labelText(" 피해"));
  card.append(next, damage);
  return card;
}

function weaknessChips(snapshot: BattleSnapshot): HTMLElement {
  const chips = document.createElement("div");
  chips.className = "battle-weakness-chips";
  chips.dataset.testid = "battle-weakness-chips";
  const enemy = focusEnemy(snapshot);
  const project = store.getCurrent();
  const weaknesses = enemy ? enemyWeaknesses(project, enemy.recordId) : [];
  if (weaknesses.length === 0) {
    const label = document.createElement("span");
    label.className = "battle-weakness-label battle-weakness-label-none";
    label.textContent = "알려진 약점 없음";
    chips.append(label);
    return chips;
  }
  for (const weakness of weaknesses) {
    const label = document.createElement("span");
    label.className = "battle-weakness-label";
    label.textContent = `${weakness.name} 약점`;
    const node = document.createElement("span");
    node.className = `battle-weakness-chip battle-weakness-chip-weak battle-weakness-chip-grade-${weakness.grade.toLowerCase()}`;
    node.textContent = weakness.name;
    chips.append(label, node);
  }
  return chips;
}

function targetAnalysisPanel(snapshot: BattleSnapshot): HTMLElement {
  const panel = document.createElement("div");
  panel.className = "battle-target-analysis";
  panel.dataset.testid = "battle-target-analysis";
  const enemy = focusEnemy(snapshot);
  const project = store.getCurrent();
  const actor = snapshot.actors.find((entry) => entry.recordId === snapshot.activeActorId) ?? snapshot.actors[0];
  const damage = enemy && actor ? predictAttackDamage(project, actor, enemy) : 0;
  panel.append(
    analysisLine("대상:", enemy?.name ?? "선택된 적 없음"),
    analysisLine("예상 피해", String(Math.max(0, damage))),
    analysisLine("현재 HP", enemy ? `${enemy.hp}/${enemy.maxHp}` : "-"),
  );
  return panel;
}

function expectedResultBanner(snapshot: BattleSnapshot): HTMLElement {
  const banner = document.createElement("div");
  banner.className = "battle-expected-result";
  banner.dataset.testid = "battle-expected-result";
  const enemy = focusEnemy(snapshot);
  const project = store.getCurrent();
  const actor = snapshot.actors.find((entry) => entry.recordId === snapshot.activeActorId) ?? snapshot.actors[0];
  if (!enemy || !actor) {
    banner.textContent = "대상을 선택하십시오.";
    return banner;
  }
  const projected = predictAttackDamage(project, actor, enemy);
  if (projected >= enemy.hp && enemy.hp > 0) {
    const gold = enemyGold(project, enemy.recordId);
    banner.textContent = `예상 결과: 처치 가능, 골드 +${gold}`;
  } else if (enemy.hp <= 0) {
    banner.textContent = `처치됨`;
  } else {
    banner.textContent = `예상 피해 ${Math.max(0, projected)} (적 HP ${enemy.hp})`;
  }
  return banner;
}

// 적 1마리의 골드 보상을 원본 레코드에서 가져온다.
function enemyGold(project: ReturnType<typeof store.getCurrent>, enemyRecordId: string): number {
  return project.database.enemies.find((entry) => entry.id === enemyRecordId)?.rewards.gold ?? 0;
}

function focusEnemy(snapshot: BattleSnapshot): BattleBattlerSnapshot | undefined {
  return snapshot.enemies.find((enemy) => enemy.id === snapshot.targetSelection?.selectedEnemyId)
    ?? snapshot.enemies.find((enemy) => snapshot.targetSelection?.targetEnemyIds.includes(enemy.id))
    ?? snapshot.enemies.find((enemy) => !enemy.defeated)
    ?? snapshot.enemies[0];
}

function analysisLine(labelValue: string, value: string): HTMLElement {
  const line = document.createElement("div");
  line.className = "battle-analysis-line";
  const label = document.createElement("span");
  label.textContent = labelValue;
  const strong = document.createElement("strong");
  strong.textContent = value;
  line.append(label, strong);
  return line;
}

function labelText(value: string): Text {
  return document.createTextNode(value);
}

function emphasisText(value: string, tone: "green" | "orange"): HTMLElement {
  const node = document.createElement("strong");
  node.className = `battle-emphasis battle-emphasis-${tone}`;
  node.textContent = value;
  return node;
}

function battlerThumb(battler: BattleBattlerSnapshot, kind: string | undefined): HTMLElement | undefined {
  const resourceId = kind === "enemy" ? monsterResourceId(battler.recordId) : battleCharsetResourceId(battler.recordId);
  if (!resourceId) return undefined;
  const url = resolveAssetResourceUrl(resourceId, { project: store.getCurrent() });
  if (!url) return undefined;
  const thumb = document.createElement("span");
  thumb.className = "battle-turn-thumb";
  thumb.style.backgroundImage = `url("${url}")`;
  if (kind !== "enemy" && isGeneratedBattleActor(resourceId)) {
    thumb.style.backgroundPosition = "0 0";
    thumb.style.backgroundSize = "42px 112px";
  }
  return thumb;
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
