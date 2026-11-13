// 싸우는 단계의 상대가 맵에 서는 모습을 싸움과 맞춘다 — 앞선 빌드가 지은 것도 고친다(경로를 다시 짓지 않는 «계속» 턴이 옛 판을 고친다).
//  - 이긴 뒤 페이지: 몬스터 그림으로 선 상대는 맵에서 걷는다(그림 없음 · 밟고 지나감). 「모래 속으로 물러난다」 뒤에도 용이 그 자리에 서 있었다.
//  - 서 있는 그림: 그 무리 앞장선 적의 전투 도트 그대로(foeGraphic). 필드에서는 붉은 용, 전투에서는 황토빛 용이었다.
//  - 전투가 나는 세계 장소의 전투 배경을 그 장소의 테마로(place/placeTheme).
import { fieldGraphicForBattler } from "@/editor/tools/fieldEnemyGraphics";
import { isGeneratedMonsterSprite } from "@/assets/generatedMonsterSprites";
import type { EventPage, Project } from "@/project/types";
import { applyThemeBackdrop } from "../place/placeTheme";
import { charsetFrameIndex } from "@/assets/easyrpgRtp";
import { FITTED_TROOP_PREFIX } from "@/editor/tools/bossThreatScaling";
import { hasCurrentArt, leadEnemyId } from "./currentFoes";
import { foeTroop } from "./stepFoeTroop";

type Obj = Record<string, unknown>;
type Page = EventPage;

function walk(node: unknown, visit: (cmd: Obj) => void): void {
  if (Array.isArray(node)) { for (const n of node) walk(n, visit); return; }
  if (!node || typeof node !== "object") return;
  visit(node as Obj);
  for (const v of Object.values(node as Obj)) if (v && typeof v === "object") walk(v, visit);
}

const spriteId = (page: Page): string => String(((page.graphic ?? {}) as { sprite?: { id?: unknown } }).sprite?.id ?? "");

/** 사슬이 지은 싸우는 단계 이벤트(ev_chain_*)마다 서 있는 그림과 이긴 뒤 페이지를 맞춘다. 고친 것 한 줄씩. */
export function settleStepFoesIn(project: Project): string[] {
  const notes: string[] = [];
  for (const map of Object.values(project.maps)) for (const ev of map.events ?? []) {
    if (!ev.id.startsWith("ev_chain_")) continue;
    const pages = (ev.pages ?? []) as Page[];
    const fightAt = pages.findIndex((p) => JSON.stringify(p.commands ?? []).includes('"battleProcessing"'));
    if (fightAt < 0) continue;
    let troopId = "";
    const won = new Set<string>();
    walk(pages[fightAt]!.commands, (c) => {
      if (c.kind === "battleProcessing" && typeof c.troopId === "string") troopId ||= c.troopId;
      if (c.kind === "setSwitch" && c.value === true && typeof c.switchId === "string") won.add(c.switchId);
    });
    const look = troopId ? foeGraphic(project, troopId) : undefined;
    if (!look) continue;
    const troop = project.database.troops.find((t) => t.id === troopId);
    const lead = project.database.enemies.find((e) => e.id === (troop?.members?.[0]?.enemyId ?? troop?.enemyIds?.[0]));
    const chip = fieldGraphicForBattler((lead as { monsterResourceId?: string } | undefined)?.monsterResourceId)?.textureKey;
    // 이 상대의 몬스터 그림(전투 도트 또는 같은 종류의 걷기 칩)으로 선 페이지만 만진다 — 모델이 사람 칩으로 바꿔 세운 상대는 그대로.
    const monster = (page: Page) => { const id = spriteId(page); return !!id && (isGeneratedMonsterSprite(id) || id === chip); };
    let changed = false;
    const next = pages.map((page, i) => {
      if (!monster(page)) return page;
      const after = i > fightAt && (page.conditions ?? []).some((c) => { const r = c as { kind?: string; switchId?: string; value?: unknown }; return r.kind === "switch" && r.value !== false && !!r.switchId && won.has(r.switchId); });
      const talksOnly = ((page.commands ?? []) as unknown as Obj[]).every((c) => c.kind === "text");
      if (after && talksOnly) {
        changed = true;
        const { nearSparkle: _spark, ...rest } = page as Page & { nearSparkle?: unknown };
        return { ...rest, priority: "below", overlapForbidden: false, graphic: { transparent: true }, commands: [] } as unknown as Page;
      }
      if (spriteId(page) === String((look.sprite as { id?: unknown }).id)) return page;
      changed = true;
      return { ...page, graphic: { ...look } } as unknown as Page;
    });
    if (!changed) continue;
    map.events = map.events.map((e) => (e.id === ev.id ? { ...e, pages: next } : e));
    notes.push(`「${String(ev.name ?? ev.id)}」 — 서 있는 그림을 전투 그림으로, 이긴 뒤에는 맵에서 걷힘`);
  }
  return notes;
}

/**
 * 옛 판 고치기 — 함수가 고른 싸우는 단계 상대(맞춤 사본 troop_fit_*)의 그림이 현행 세트가 아니면 지금 규칙으로 다시 고른다(같은 이름 · 같은 사본 id).
 * 모델·저자가 직접 고른 무리는 그대로 둔다. 다시 고른 것 한 줄씩과 없는 그림 줄.
 */
export function redrawStepFoesIn(project: Project): { readonly notes: string[]; readonly gaps: string[] } {
  const notes: string[] = [], gaps: string[] = [];
  const steps = project.gameBlueprint?.steps ?? [];
  const lastBattle = steps.reduce((hit, st, i) => (st.kind === "battle" ? i : hit), -1);
  for (const [k, step] of steps.entries()) {
    const map = step.kind === "battle" && step.built ? project.maps[step.built.mapId] : undefined;
    const ev = map?.events?.find((e) => e.id === step.built?.eventId);
    if (!map || !ev) continue;
    let troopId = "";
    walk(ev.pages ?? [], (c) => { if (c.kind === "battleProcessing" && typeof c.troopId === "string") troopId ||= c.troopId; });
    if (!troopId.startsWith(FITTED_TROOP_PREFIX) || hasCurrentArt(project, leadEnemyId(project, troopId))) continue;
    const troop = project.database.troops.find((t) => t.id === troopId);
    const who = troopId.startsWith(`${FITTED_TROOP_PREFIX}foe_`) ? troop?.name : undefined;
    const found: string[] = [];
    const next = foeTroop(project, step.id, who, k === lastBattle, map.id, k, found);
    if (!next || !hasCurrentArt(project, leadEnemyId(project, next))) continue;
    gaps.push(...found);
    if (next !== troopId) map.events = map.events.map((e) => (e.id === ev.id ? JSON.parse(JSON.stringify(e).split(`"troopId":${JSON.stringify(troopId)}`).join(`"troopId":${JSON.stringify(next)}`)) as typeof e : e));
    notes.push(`「${who ?? troop?.name ?? step.event}」 — 싸우는 상대를 현행 그림이 있는 종으로 다시 고름`);
  }
  return { notes, gaps };
}

/** 전투가 나는 세계 장소의 전투 배경을 테마로 맞춘다(없는 값·기본값 숲만 바꾼다). 바꾼 것과 없는 그림 줄. */
export function themeBattleBackdropsIn(project: Project): { readonly notes: string[]; readonly gaps: string[] } {
  const notes: string[] = [], gaps: string[] = [];
  for (const map of Object.values(project.maps)) {
    if (!(map.events ?? []).some((ev) => JSON.stringify(ev.pages ?? []).includes('"battleProcessing"'))) continue;
    const res = applyThemeBackdrop(project, map.id);
    if (res.note) notes.push(res.note);
    if (res.gap) gaps.push(res.gap);
  }
  return { notes, gaps };
}

/**
 * 싸우는 상대가 맵에 서는 모습 — 그 무리 앞장선 적의 전투 도트 그림 그대로, 도트 그림이 아닌 적만 같은 종류의 걷기 칩.
 * 그런 그림이 없으면 undefined(사람 칩으로 선다) — 주민 칩으로 선 짐승을 막는다.
 */
export function foeGraphic(project: Project, troopId: string): Record<string, unknown> | undefined {
  const troop = project.database.troops.find((t) => t.id === troopId);
  const leadId = troop?.members?.length ? troop.members[0]!.enemyId : troop?.enemyIds?.[0];
  const sprite = (project.database.enemies.find((e) => e.id === leadId) as { monsterResourceId?: string } | undefined)?.monsterResourceId;
  if (!sprite) return undefined;
  // 전투 도트 그림이 있으면 그 그림 그대로 선다 — «같은 종류»의 걷기 칩은 다른 그림이다(황토빛 용이 붉은 용 칩으로 서 있었다).
  // 두 배로 세운다 — 길을 막아선 상대는 돌아다니는 적(2칸)보다 크고, 런타임이 그 배수만큼 덜 줄인 칩을 뽑아 전투 화면의 그 그림으로 읽힌다(player/fieldFoeSprite).
  if (isGeneratedMonsterSprite(sprite)) return { sprite: { type: "bundled", id: sprite }, direction: "down", pattern: 0, scale: 2, scaleMode: "manual" };
  const cell = fieldGraphicForBattler(sprite);
  return cell ? { sprite: { type: "bundled", id: cell.textureKey }, direction: "down", pattern: charsetFrameIndex({ characterIndex: cell.characterIndex, direction: "down", pattern: 1 }) } : undefined;
}
