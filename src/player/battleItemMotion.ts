import type { BattleTimelineEntrySnapshot } from "@/battle/types";
import type { BattleActionBeat } from "@/player/battleActionBeats";
import { scheduleBattleTimer } from "@/player/battleTimerScope";
import { store } from "@/project/store";
import type { ItemRecord } from "@/project/types";

export type BattleItemVisualKind =
  | "hp_potion"
  | "mp_ether"
  | "elixir"
  | "cure_herb"
  | "revive"
  | "throw_damage"
  | "throw_status"
  | "talisman";

export interface BattleItemPalette {
  readonly core: string;
  readonly light: string;
  readonly mid: string;
  readonly dark: string;
  readonly outline: string;
}

const ITEM_PALETTES: Readonly<Record<BattleItemVisualKind, BattleItemPalette>> = {
  hp_potion:    { core: "#fff2f2", light: "#ff8a8a", mid: "#e83444", dark: "#8c1624", outline: "#181822" },
  mp_ether:     { core: "#eefaff", light: "#8ae0ff", mid: "#2892f0", dark: "#16468c", outline: "#181822" },
  elixir:       { core: "#fffef0", light: "#ffe978", mid: "#f5a623", dark: "#9c5210", outline: "#181822" },
  cure_herb:    { core: "#ecfff4", light: "#7ef6a8", mid: "#26c06c", dark: "#147444", outline: "#181822" },
  revive:       { core: "#ffffff", light: "#fff4a8", mid: "#ffc840", dark: "#d46a18", outline: "#181822" },
  throw_damage: { core: "#fff6d8", light: "#ffb84d", mid: "#e84a28", dark: "#582424", outline: "#181822" },
  throw_status: { core: "#f6e6ff", light: "#c884ff", mid: "#8838d4", dark: "#401670", outline: "#181822" },
  talisman:     { core: "#fffbe6", light: "#ffe688", mid: "#d89c32", dark: "#7c4c14", outline: "#181822" },
};

/** 12x12 binary-alpha pixel sprites per item category ('.' transparent, 'O' outline, 'W'/'L'/'M'/'D' palette, 'C' cork/wood, 'G' glass/steel). */
const ITEM_SPRITES: Readonly<Record<BattleItemVisualKind, readonly string[]>> = {
  hp_potion: [
    "....OOOO....",
    "....OCCO....",
    "....OGGO....",
    "...OOGGOO...",
    "..OOWLLMMO..",
    ".OOWWLLMMDO.",
    ".OOWLLLMMDO.",
    ".OOLLMMMMDO.",
    "..OOMMMMDO..",
    "...OODDDDO..",
    "....OOOOO...",
    "............",
  ],
  mp_ether: [
    ".....OO.....",
    "....OCCO....",
    "....OGGO....",
    "...OOWLOO...",
    "..OOWLLMMO..",
    ".OOWWLLMMDO.",
    ".OOWLLLMMDO.",
    "..OOLLMMDO..",
    "...OOMMDO...",
    "....ODDO....",
    ".....OO.....",
    "............",
  ],
  elixir: [
    "....OOOO....",
    "...OOWWOO...",
    "....OLLO....",
    "..OOOGGOOO..",
    ".OOWWLLMMOO.",
    ".OOWCLLMMDO.",
    ".OOWWLLMMDO.",
    "..OOMMMMDO..",
    "...OODDDDO..",
    "..OOOMMMOOO.",
    "...OOOOOOO..",
    "............",
  ],
  cure_herb: [
    ".......OO...",
    ".....OOWLO..",
    "....OWWLLMO.",
    "..OO.OLLMDO.",
    ".OWLOOLMDO..",
    ".OWLLOMMDO..",
    "..OLMOOODO..",
    "...OOMMDO...",
    "....OODO....",
    "...OODDO....",
    "..OODDO.....",
    "............",
  ],
  revive: [
    "........OO..",
    "......OOWLO.",
    ".....OWWLLMO",
    "....OWWLLMDO",
    "...OWWLLMDO.",
    "..OWWLLMDO..",
    "..OWLLMDO...",
    ".OWLLMDO....",
    ".OLLMDO.....",
    ".ODDO.......",
    "ODO.........",
    "............",
  ],
  throw_damage: [
    ".......W.L..",
    "......O.M...",
    ".....OCCO...",
    "....OOOOOO..",
    "..OODDDDDDO.",
    ".ODDLWDDDDDO",
    ".ODDWDDDDDDO",
    ".ODDDDDDDDDO",
    ".ODDDDDDDDDO",
    "..ODDDDDDDO.",
    "...OOOOOOO..",
    "............",
  ],
  throw_status: [
    "....OOOO....",
    "....OLLO....",
    "....OGGO....",
    "...OOGGOO...",
    "..OOWLLMMO..",
    ".OOWWLLMMDO.",
    ".OOWMLMMMDO.",
    ".OOMLMMMMDO.",
    "..OOMMMMDO..",
    "...OODDDDO..",
    "....OOOOO...",
    "............",
  ],
  talisman: [
    "...OOOOOO...",
    "..OWWWWWWO..",
    "..OWLLLLWO..",
    "..OWLMMLWO..",
    "..OWMLLMWO..",
    "..OWLMMLWO..",
    "..OWMLLMWO..",
    "..OWLLLLWO..",
    "..OWDDDDWO..",
    "...OOOOOO...",
    "............",
    "............",
  ],
};

function hasRecovery(cost: { readonly flat?: number; readonly percentMax?: number } | undefined): boolean {
  return Boolean(cost && ((cost.flat ?? 0) > 0 || (cost.percentMax ?? 0) > 0));
}

export function classifyBattleItem(item: Partial<ItemRecord> | undefined): BattleItemVisualKind {
  if (!item) return "hp_potion";
  const name = `${item.name ?? ""} ${item.id ?? ""} ${item.iconResourceId ?? ""}`;
  if (item.onlyEffectiveOnDeadActors || /부활|불사조|소생|revive|phoenix/i.test(name)) return "revive";
  const enemyScoped = item.scope === "enemy";
  if (enemyScoped) {
    if (/독|마비|수면|혼란|침묵|연막|poison|vial|dart|smoke|sleep/i.test(name)) return "throw_status";
    return "throw_damage";
  }
  const hp = hasRecovery(item.hpRecovery);
  const mp = hasRecovery(item.mpRecovery) || hasRecovery(item.ppRecovery);
  if ((hp && mp) || /엘릭서|영약|elixir/i.test(name)) return "elixir";
  if (mp && !hp) return "mp_ether";
  if (/마력|에테르|마나|ether|mana/i.test(name) && !hp) return "mp_ether";
  const curesState = (item.healStateIds?.length ?? 0) > 0
    || Boolean(item.stateEffects?.some((e) => e.operation === "remove"));
  if (curesState || /해독|각성|만능|허브|초|가루|antidote|herb|panacea|salts/i.test(name)) return "cure_herb";
  if (/부적|주문서|스크롤|수호|강화|talisman|scroll|charm|manual|book/i.test(name)) return "talisman";
  if (!hp && (item.type === "special" || item.type === "book" || item.type === "normalGoods")) return "talisman";
  return "hp_potion";
}

export function isThrownItemKind(kind: BattleItemVisualKind): boolean {
  return kind === "throw_damage" || kind === "throw_status";
}

export function battleItemRecordForEntry(entry: BattleTimelineEntrySnapshot | undefined): ItemRecord | undefined {
  if (!entry || entry.commandKind !== "item") return undefined;
  const items = store.getCurrent().database.items;
  if (entry.itemId) {
    const byId = items.find((record) => record.id === entry.itemId);
    if (byId) return byId;
  }
  if (entry.skillId) {
    const bySkill = items.find((record) => record.activateSkillId === entry.skillId || record.skillId === entry.skillId);
    if (bySkill) return bySkill;
  }
  return undefined;
}

export function drawBattleItemSprite(ctx: CanvasRenderingContext2D, kind: BattleItemVisualKind, scale = 2): void {
  const rows = ITEM_SPRITES[kind];
  const pal = ITEM_PALETTES[kind];
  const map: Record<string, string> = {
    O: pal.outline,
    W: pal.core,
    L: pal.light,
    M: pal.mid,
    D: pal.dark,
    C: "#b87a44",
    G: "#cce0ec",
  };
  ctx.imageSmoothingEnabled = false;
  for (let y = 0; y < rows.length; y += 1) {
    const row = rows[y]!;
    for (let x = 0; x < row.length; x += 1) {
      const col = map[row[x]!];
      if (!col) continue;
      ctx.fillStyle = col;
      ctx.fillRect(x * scale, y * scale, scale, scale);
    }
  }
}

function makeItemCanvas(kind: BattleItemVisualKind): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 24;
  canvas.height = 24;
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.position = "absolute";
  canvas.style.pointerEvents = "none";
  canvas.style.imageRendering = "pixelated";
  canvas.style.zIndex = "35";
  const ctx = canvas.getContext("2d");
  if (ctx) drawBattleItemSprite(ctx, kind, 2);
  return canvas;
}

function spawnSparkBurst(host: HTMLElement, x: number, y: number, pal: BattleItemPalette, count: number, durationMs: number): void {
  const canvas = document.createElement("canvas");
  canvas.width = 48;
  canvas.height = 48;
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.position = "absolute";
  canvas.style.left = `${Math.round(x - 24)}px`;
  canvas.style.top = `${Math.round(y - 24)}px`;
  canvas.style.width = "48px";
  canvas.style.height = "48px";
  canvas.style.pointerEvents = "none";
  canvas.style.imageRendering = "pixelated";
  canvas.style.zIndex = "36";
  host.append(canvas);
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.imageSmoothingEnabled = false;
    for (let i = 0; i < count; i += 1) {
      const ang = (Math.PI * 2 * i) / count + 0.35;
      const dist = 7 + (i % 3) * 4;
      const px = Math.round(24 + Math.cos(ang) * dist);
      const py = Math.round(24 + Math.sin(ang) * dist);
      ctx.fillStyle = i % 2 === 0 ? pal.core : pal.light;
      ctx.fillRect(px, py, 2, 2);
      ctx.fillStyle = pal.mid;
      ctx.fillRect(px + (px > 24 ? 2 : -2), py, 2, 2);
    }
  }
  if (typeof canvas.animate === "function") {
    canvas.animate(
      [
        { opacity: 1, transform: "scale(0.55)" },
        { opacity: 1, transform: "scale(1.12)", offset: 0.45 },
        { opacity: 0, transform: "scale(1.4) translateY(-6px)" },
      ],
      { duration: durationMs, easing: "ease-out", fill: "forwards" },
    );
  }
  scheduleBattleTimer(() => canvas.remove(), durationMs + 40);
}

/**
 * Render per-item battle visuals right above the actor's hand (potions/herbs/revive/talisman)
 * or launch a parabolic pixel throw arc across the field onto the target enemy (bombs/darts/vials).
 */
export function animateBattleItemMotion(
  field: HTMLElement,
  user: HTMLElement,
  entry: BattleTimelineEntrySnapshot | undefined,
  beat: BattleActionBeat,
): void {
  if (!entry || entry.commandKind !== "item" || !user.classList.contains("battle-actor")) return;
  if (beat.kind !== "approach") return;
  if (typeof document === "undefined" || !user.isConnected) return;
  if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

  const item = battleItemRecordForEntry(entry);
  const kind = classifyBattleItem(item);
  const pal = ITEM_PALETTES[kind];
  const duration = Math.max(240, beat.durationMs || 420);

  if (isThrownItemKind(kind)) {
    const fieldRect = field.getBoundingClientRect();
    const userRect = user.getBoundingClientRect();
    const target = entry.targetId
      ? field.querySelector<HTMLElement>(`.battle-enemy[data-battler-id="${CSS.escape(entry.targetId)}"]`)
      : field.querySelector<HTMLElement>(".battle-enemy:not(.defeated)");
    const targetRect = target?.getBoundingClientRect();
    if (!fieldRect.width || !userRect.width || !targetRect?.width) return;

    const sx = userRect.left - fieldRect.left + userRect.width * 0.25;
    const sy = userRect.top - fieldRect.top + userRect.height * 0.44;
    const ex = targetRect.left - fieldRect.left + targetRect.width * 0.5;
    const ey = targetRect.top - fieldRect.top + targetRect.height * 0.46;
    const mx = (sx + ex) * 0.5;
    const my = Math.min(sy, ey) - 34;

    const proj = makeItemCanvas(kind);
    proj.style.left = "0px";
    proj.style.top = "0px";
    proj.style.width = "24px";
    proj.style.height = "24px";
    field.append(proj);

    const flightMs = Math.max(200, Math.round(duration * 0.85));
    if (typeof proj.animate === "function") {
      proj.animate(
        [
          { transform: `translate(${Math.round(sx - 12)}px, ${Math.round(sy - 12)}px) rotate(0deg) scale(0.95)`, opacity: 1 },
          { transform: `translate(${Math.round(mx - 12)}px, ${Math.round(my - 12)}px) rotate(-180deg) scale(1.12)`, opacity: 1, offset: 0.5 },
          { transform: `translate(${Math.round(ex - 12)}px, ${Math.round(ey - 12)}px) rotate(-360deg) scale(1.0)`, opacity: 1 },
        ],
        { duration: flightMs, easing: "cubic-bezier(.3,.1,.6,1)", fill: "forwards" },
      );
    }
    scheduleBattleTimer(() => {
      proj.remove();
      if (field.isConnected) spawnSparkBurst(field, ex, ey, pal, 10, 260);
    }, flightMs);
    return;
  }

  // Non-thrown items (HP red potion, MP blue ether, gold elixir, emerald herb, revive feather, talisman):
  // Overlay the exact pixel item cleanly right over the character's raised hand + rising aura sparkles.
  const host = user.querySelector<HTMLElement>(".battle-actor-sprite") ?? user;
  const prop = makeItemCanvas(kind);
  prop.style.left = "14%";
  prop.style.top = "38%";
  prop.style.width = "24px";
  prop.style.height = "24px";
  host.append(prop);
  const holdMs = Math.max(420, duration + 260);
  if (typeof prop.animate === "function") {
    prop.animate(
      [
        { transform: "translate(0px, 4px) scale(0.82)", opacity: 0 },
        { transform: "translate(0px, -2px) scale(1.08)", opacity: 1, offset: 0.22 },
        { transform: "translate(0px, -5px) scale(1.04)", opacity: 1, offset: 0.78 },
        { transform: "translate(0px, -11px) scale(0.9)", opacity: 0 },
      ],
      { duration: holdMs, easing: "ease-out", fill: "forwards" },
    );
  }
  scheduleBattleTimer(() => {
    if (host.isConnected) {
      const r = host.getBoundingClientRect();
      spawnSparkBurst(host, Math.max(18, r.width * 0.28), Math.max(18, r.height * 0.48), pal, 8, 320);
    }
  }, Math.round(holdMs * 0.24));
  scheduleBattleTimer(() => prop.remove(), holdMs + 30);
}
