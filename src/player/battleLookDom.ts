/**
 * 전투 화면 꾸미기(project/battleLook.ts)를 전투 DOM 에 옮기는 층.
 *
 * 모양은 거의 전부 CSS(styles/runtime/battle-skins/_battle-look.css)다. 여기서는 루트에 칸 값을 data 속성·CSS 변수로
 * 심고, CSS 만으로는 못 만드는 겹만 붙인다:
 *  - 무대 연출 겹(빛내림·먼지·가장자리 어둡게·위아래 흐림) — 필드 안, 배틀러 아래(z 1)
 *  - 영화 띠 두 장 — 루트 맨 위
 *  - 차례 순서 줄 — 살아 있는 배틀러를 행동 게이지(턴제는 민첩) 순으로. 규칙 엔진의 예측이 아니라 지금 값 정렬이다.
 * 도트 측면 전투(motionStyle "retro")에서만 부른다. 다른 스킨의 DOM 은 건드리지 않는다.
 */
import type { BattleBattlerSnapshot, BattleSnapshot } from "@/battle/types";
import type { ResolvedBattleLook } from "@/project/battleLook";

const DUST_COUNT = 18;
const TURN_ORDER_MAX = 8;

export function applyBattleLook(root: HTMLElement, field: HTMLElement, look: ResolvedBattleLook): void {
  root.dataset.battleLook = look.preset;
  if (look.customized) root.dataset.battleLookCustom = "true";
  root.dataset.battleWindow = look.window;
  root.dataset.battleWindowFamily = look.retroWindow ? "retro" : "modern";
  root.dataset.lookParty = look.party;
  root.dataset.lookCommand = look.command;
  root.dataset.lookField = look.field;
  root.dataset.lookTurns = look.turnOrder ? "on" : "off";
  root.dataset.lookNames = look.enemyNames ? "on" : "off";
  root.dataset.lookLetterbox = look.letterbox ? "on" : "off";
  if (look.fontStack) root.style.setProperty("--battle-look-font", look.fontStack);
  if (look.accent) {
    root.style.setProperty("--battle-look-accent", look.accent);
    root.style.setProperty("--retro-accent", look.accent);
  }
  root.style.setProperty("--look-light", String(look.light));
  root.style.setProperty("--look-dust", String(look.dust));
  root.style.setProperty("--look-vignette", String(look.vignette));
  root.style.setProperty("--look-blur", String(look.blur));
  root.style.setProperty("--look-grade", look.grade ? "1" : "0");

  if (look.light || look.dust || look.vignette || look.blur || look.field === "full") field.append(stageFxLayer());
  if (look.letterbox) {
    for (const edge of ["top", "bottom"] as const) {
      const bar = document.createElement("div");
      bar.className = `battle-look-letterbox battle-look-letterbox-${edge}`;
      bar.setAttribute("aria-hidden", "true");
      root.append(bar);
    }
  }
  if (look.turnOrder) {
    const strip = document.createElement("div");
    strip.className = "battle-turn-order";
    strip.dataset.testid = "battle-turn-order";
    strip.setAttribute("aria-label", "차례 순서");
    root.append(strip);
  }
}

function stageFxLayer(): HTMLElement {
  const layer = document.createElement("div");
  layer.className = "battle-look-fx";
  layer.setAttribute("aria-hidden", "true");
  for (const name of ["blur-top", "blur-bottom", "rays", "vignette"]) {
    const part = document.createElement("div");
    part.className = `battle-look-${name}`;
    layer.append(part);
  }
  const dust = document.createElement("div");
  dust.className = "battle-look-dust";
  // 위치·속도는 인덱스로 정한다 — 같은 전투는 늘 같은 모양(스크린샷 비교 가능).
  for (let index = 0; index < DUST_COUNT; index += 1) {
    const mote = document.createElement("i");
    const seed = (index * 7919) % 997;
    mote.style.left = `${8 + (seed % 84)}%`;
    mote.style.top = `${30 + ((seed * 13) % 60)}%`;
    mote.style.setProperty("--mote-size", `${2 + (seed % 4)}px`);
    mote.style.animationDuration = `${5 + (seed % 6)}s`;
    mote.style.animationDelay = `-${(seed % 80) / 10}s`;
    dust.append(mote);
  }
  layer.append(dust);
  return layer;
}

/** 차례 순서 — 지금 행동할 배틀러가 먼저. 게이지 전투는 게이지가 찬 순, 턴제는 민첩 순. */
export function battleTurnOrder(snapshot: BattleSnapshot): readonly BattleBattlerSnapshot[] {
  const alive = [...snapshot.actors, ...snapshot.enemies].filter((battler) => !battler.defeated && !battler.captured);
  const agility = (battler: BattleBattlerSnapshot): number => battler.effectiveStats?.agility ?? 0;
  const ordered = alive.sort((a, b) => (snapshot.battleFlow === "gauge" ? b.gauge - a.gauge : 0) || agility(b) - agility(a));
  const activeIndex = ordered.findIndex((battler) => battler.recordId === snapshot.activeActorId && snapshot.actors.includes(battler));
  if (activeIndex > 0) ordered.unshift(...ordered.splice(activeIndex, 1));
  return ordered.slice(0, TURN_ORDER_MAX);
}

export function syncBattleTurnOrder(root: HTMLElement, snapshot: BattleSnapshot): void {
  const strip = root.querySelector<HTMLElement>(".battle-turn-order");
  if (!strip) return;
  const order = battleTurnOrder(snapshot);
  const key = order.map((battler) => battler.id).join("|");
  if (strip.dataset.orderKey === key) return;
  strip.dataset.orderKey = key;
  strip.replaceChildren(...order.map((battler, index) => turnChip(root, snapshot, battler, index === 0)));
}

function turnChip(root: HTMLElement, snapshot: BattleSnapshot, battler: BattleBattlerSnapshot, current: boolean): HTMLElement {
  const chip = document.createElement("span");
  const isEnemy = snapshot.enemies.includes(battler);
  chip.className = `battle-turn-chip${isEnemy ? " is-enemy" : ""}${current ? " is-current" : ""}`;
  chip.title = battler.name;
  chip.dataset.battlerId = battler.id;
  if (isEnemy) {
    const image = root.querySelector<HTMLImageElement>(`.battle-enemy[data-testid="${CSS.escape(battler.id)}"] .battle-enemy-image`);
    const sheet = image?.style.getPropertyValue("--pixel-enemy-url");
    const cell = Number(image?.closest<HTMLElement>(".battle-enemy")?.dataset.pixelEnemyCell ?? 0);
    if (sheet && cell > 0) paintSheetCell(chip, sheet, cell);
    else if (image?.src) chip.style.backgroundImage = `url("${image.src}")`;
    else chip.textContent = battler.name.slice(0, 1);
  } else {
    const face = root.querySelector<HTMLElement>(`[data-testid="battle-actor-face-${CSS.escape(battler.recordId)}"]`);
    const url = face?.style.getPropertyValue("--battle-face-url");
    if (url) chip.style.backgroundImage = url;
    else chip.textContent = battler.name.slice(0, 1);
  }
  return chip;
}

/** 도트 적 시트의 첫 칸(대기 0번)만 보이게 — 시트 크기를 읽어 칸 수만큼 확대한다. */
function paintSheetCell(chip: HTMLElement, sheetUrl: string, cell: number): void {
  chip.classList.add("is-sheet");
  chip.style.backgroundImage = sheetUrl;
  const src = /url\("?(.*?)"?\)/u.exec(sheetUrl)?.[1];
  if (!src || typeof Image === "undefined") return;
  const probe = new Image();
  probe.addEventListener("load", () => {
    chip.style.backgroundSize = `${(probe.naturalWidth / cell) * 100}% ${(probe.naturalHeight / cell) * 100}%`;
  });
  probe.src = src;
}
