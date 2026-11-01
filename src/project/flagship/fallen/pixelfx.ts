// 폴른 스타 · pixelfx 코드 픽셀 효과 층(2026-10-31, PR #4121 의 효과를 데모에 입힌다).
//
// 다른 작업자(B4 숲 어귀·B5·2막 다듬기·1막 금고 전투)가 같은 맵·비트를 동시에 고치므로 이 파일은 **덧붙이기만** 한다:
// 데모 빌드 맨 끝에서 한 번 불러, 기술 id·맵 id·이벤트 id 로 찾아 붙인다. 찾지 못한 id 는 건너뛰고 skipped 에 남긴다
// (이름이 바뀌었거나 아직 없는 것 — 빌드를 깨지 않는다).
//
// 1. 기술: 원래 애니메이션 레코드의 소리·흔들림을 효과의 터지는 박자로 옮긴 pixelfx 레코드(anim_pfx_fs_*)로 바꾼다.
//    직업 연출 계약이 있는 기술(십자베기 등)은 연출이 제 소리를 내므로 소리를 옮기지 않는다(두 번 울린다).
// 2. 필드: 서리나루 광장 모닥불, 북쪽 숲 어귀(밤) 반딧불, 우물 밑 물방울.
//    16px 칩셋에는 효과 불꽃이 크다(spirit-flame 은 두 칸 반) — 벽난로·화덕·벽 촛대에 얹어 보니 아궁이 밖으로 솟아 뺐다
//    (2026-10-31 실화면). 벽 촛대는 상층 벽 칸 밑에 가려 보이지도 않았다. 낮 맵에는 반딧불을 두지 않는다.
// 3. 이야기: 성벽 개구멍 먼지, 하늘탑 마법진 순간이동.
import type { BattleAnimationRecord, BattleAnimationTiming, Command, EventPage, EventPixelFx, GameEvent, GameMap, PixelFxSpec, Project, SkillRecord } from "@/project/types";
import { normalizeBattleAnimationRecord } from "@/project/databaseAnimationRecordModel";
import { normalizePixelFxSpec } from "@/project/pixelFxSpec";
import { resolveSkillChoreography } from "@/assets/retroSkillCatalog";

/** 어두운 → 밝은 색 띠. */
const PAL = {
  steel: ["#1b2333", "#34465e", "#5b7594", "#8aa6c4", "#bcd2e6", "#e6f0fa", "#ffffff"],
  fire: ["#3a0d08", "#7a1a0c", "#c2340f", "#ee6a1a", "#f9a73a", "#ffd97a", "#fff6d8", "#ffffff"],
  hearth: ["#3a0d08", "#6e1a0a", "#b8320e", "#e8641a", "#f6a238", "#ffd27a", "#fff0c8", "#fffaf0", "#ffffff"],
  moon: ["#141a33", "#2c3a66", "#4d6aa3", "#86a8d6", "#bcd4f0", "#e4eefc", "#ffffff", "#ffffff"],
  ash: ["#1a1716", "#2e2a28", "#4a4441", "#6b6460", "#8f8883", "#b5afa9", "#d8d3ce", "#f2efeb"],
  dust: ["#2a2018", "#4a3a2a", "#6e5a44", "#93806a", "#b8a892", "#d8ccba"],
  gold: ["#3a2a08", "#6e4f12", "#a87a1c", "#d8a832", "#f2d266", "#fbeaa8", "#fffbe6", "#ffffff"],
} as const;

export interface FallenPixelFxReport {
  readonly applied: string[];
  readonly skipped: string[];
}

interface SkillFx {
  readonly skill: string;
  readonly spec: PixelFxSpec;
  /** 소리·흔들림을 낼 프레임(120ms 단위) — 효과가 터지는 순간. */
  readonly hit: number;
  readonly position?: BattleAnimationRecord["position"];
  readonly note: string;
}

const fx = (effectId: string, extra: Omit<PixelFxSpec, "effectId"> = {}): PixelFxSpec => ({ effectId, ...extra });

export const FALLEN_SKILL_FX: readonly SkillFx[] = [
  // 카엘 — 검
  { skill: "skill_sword_slash", spec: fx("melee/sword-slash"), hit: 1, note: "검격" },
  { skill: "skill_hero_cross_slash", spec: fx("melee/double-slash", { palette: [...PAL.steel] }), hit: 2, note: "십자베기" },
  { skill: "skill_hero_rush_pierce", spec: fx("melee/thrust", { palette: [...PAL.steel] }), hit: 1, note: "돌진 찌르기" },
  { skill: "skill_hero_flame_sword", spec: fx("melee/sword-slash", { palette: [...PAL.fire] }), hit: 1, note: "화염검(불 띠 베기)" },
  // 마도사
  { skill: "skill_mage_fireball", spec: fx("explosions/small-explosion"), hit: 1, note: "파이어볼" },
  { skill: "skill_mage_chain_lightning", spec: fx("lightning/chain-lightning"), hit: 2, note: "연쇄 번개" },
  { skill: "skill_mage_blizzard", spec: fx("ice/frost-nova"), hit: 2, note: "블리자드" },
  // 회복·보조
  { skill: "skill_heal", spec: fx("holy/blessing"), hit: 2, note: "치유" },
  { skill: "skill_fs_moss_dew", spec: fx("holy/blessing"), hit: 2, note: "이슬 치유" },
  { skill: "skill_fs_meditate", spec: fx("holy/blessing"), hit: 2, note: "명상" },
  { skill: "skill_fs2_iris_be_well", spec: fx("holy/blessing"), hit: 2, note: "잘 지내" },
  { skill: "skill_fs_leaf_hymn", spec: fx("nature/healing-bloom"), hit: 4, note: "잎새 노래" },
  { skill: "skill_fs_tonic", spec: fx("holy/divine-shield"), hit: 2, note: "투지 강장제" },
  { skill: "skill_fs_judgment", spec: fx("holy/smite"), hit: 4, note: "심판의 빛" },
  // 잡화
  { skill: "skill_fs_smoke_pellet", spec: fx("explosions/smoke-bomb"), hit: 2, note: "연막" },
  { skill: "skill_fs_venom", spec: fx("nature/acid-splash"), hit: 1, note: "독침" },
  { skill: "skill_fs_fire_flask", spec: fx("fire/fire-ring"), hit: 1, note: "불씨 병" },
  { skill: "skill_fs_water_flask", spec: fx("water/splash"), hit: 1, note: "물 주머니" },
  // 이리스
  { skill: "skill_gunner_snipe", spec: fx("impacts/crit-hit", { palette: [...PAL.gold] }), hit: 1, note: "충전 광선포" },
  { skill: "skill_fs_iris_shock", spec: fx("lightning/zap-hit"), hit: 1, note: "전격탄" },
  // 적
  { skill: "skill_mon_frost_orb", spec: fx("ice/snowflake-burst"), hit: 1, note: "얼음 구체" },
  { skill: "skill_mon_frost_nova", spec: fx("ice/frost-nova"), hit: 2, note: "서리 폭풍" },
  { skill: "skill_fs_dragon_breath", spec: fx("ice/frost-nova", { palette: [...PAL.moon] }), hit: 2, note: "달빛 숨결(달빛 용)" },
  { skill: "skill_fs_valen_overload", spec: fx("lightning/thunderclap"), hit: 1, note: "과부하(발렌)" },
  { skill: "skill_fs2_ash_scatter", spec: fx("explosions/smoke-bomb", { palette: [...PAL.ash] }), hit: 2, note: "재 흩뿌리기(회수자)" },
  { skill: "skill_fs2_ash_recall", spec: fx("explosions/small-explosion"), hit: 1, note: "재의 회수(회수자)" },
  { skill: "skill_fs2_swallowed_flare", spec: fx("fire/fire-ring"), hit: 1, note: "새벽샘의 불(회수자)" },
];

function applySkillFx(project: Project, report: { applied: string[]; skipped: string[] }): void {
  const db = project.database;
  for (const entry of FALLEN_SKILL_FX) {
    const skill = db.skills.find((s) => s.id === entry.skill) as SkillRecord | undefined;
    const spec = normalizePixelFxSpec(entry.spec);
    if (!skill || !spec) { report.skipped.push(`기술 ${entry.skill} (${entry.note}) — ${skill ? "효과 지정 오류" : "기술 없음"}`); continue; }
    const old = skill.animationId ? db.battleAnimations.find((a) => a.id === skill.animationId) : undefined;
    // 직업 연출이 있으면 연출이 제 소리를 낸다 — 옛 레코드의 소리를 옮기면 두 번 울린다. 흔들림만 옮긴다.
    const choreographed = Boolean(resolveSkillChoreography(skill, db.skillChoreographies));
    const timings: BattleAnimationTiming[] = (old?.timings ?? [])
      .filter((t) => t.soundResourceId || t.screenShake)
      .map((t, i) => ({
        frameIndex: entry.hit + i,
        ...(t.soundResourceId && !choreographed ? { soundResourceId: t.soundResourceId } : {}),
        ...(t.screenShake ? { screenShake: t.screenShake } : {}),
      }))
      .filter((t) => t.soundResourceId || t.screenShake);
    const id = `anim_pfx_fs_${entry.skill.replace(/^skill_/, "")}`;
    const record = normalizeBattleAnimationRecord({
      id, name: `${entry.note} · pixelfx ${spec.effectId}`,
      scope: old?.scope === "screen" ? "allTargets" : old?.scope ?? "singleTarget",
      position: entry.position ?? "feet",
      pixelFx: spec,
      timings,
    });
    db.battleAnimations = [...db.battleAnimations.filter((a) => a.id !== id), record];
    skill.animationId = id;
    report.applied.push(`기술 ${entry.note} → ${spec.effectId}${choreographed ? " (직업 연출 위)" : ""}`);
  }
}

// ── 필드 ──────────────────────────────────────────────────────────────

interface FieldFx {
  readonly map: string;
  readonly key: string;
  readonly at: { x: number; y: number };
  readonly fx: EventPixelFx;
  readonly note: string;
}

export const FALLEN_FIELD_FX: readonly FieldFx[] = [
  // 서리나루 광장 모닥불 — 칩셋의 작은 모닥불 자리에 장작·불꽃·연기·불티가 움직이는 모닥불을 얹는다(눈밭에 따뜻한 빛).
  { map: "fs2_frostford", key: "bonfire", at: { x: 19, y: 45 }, fx: { effectId: "fire/campfire", light: 0.9, offsetX: 6, offsetY: -2, seed: 29, layer: "auto" }, note: "서리나루 광장 모닥불" },
  // 우물 밑 — 천장에서 바닥 물웅덩이로 떨어지는 물방울.
  { map: "fs2_well_shaft", key: "drip", at: { x: 3, y: 6 }, fx: { effectId: "water/drip", light: 0.6, offsetY: -4, layer: "back" }, note: "우물 밑 물방울" },
  // 화면 층 — 반딧불. 화면 층은 효과 그림(320×180)을 시야를 덮도록 정수배로 키운다 — 눈(weather/snow)은 눈송이가
  //   한 칸만 하게 커져 흰 눈밭에서 푸른 테두리 별처럼 보였고, 오로라는 성문·벽까지 덮었다. 둘 다 빼고 엔진 눈 날씨를 그대로 둔다.
  // 반딧불 효과의 앞 층에는 풀잎 한 줄이 화면 아래에 깔린다 — 화면 밖으로 밀어 낸다.
  //   숲 어귀 반딧불은 차가운 청록·흐리게 — 기본 노란 연두빛(빛 1.4)은 야경꾼 등불(#ffc468)과 같은 계열로 읽혀
  //   어느 빛이 들키는 등불인지 흐렸다(검수 r10 「노란 반딧불 점이 등불처럼 보인다」).
  { map: "map_field_north_1", key: "fireflies", at: { x: 1, y: 0 }, fx: { effectId: "weather/fireflies", layer: "screen", light: 0.7, offsetY: 24, seed: 3,
    palette: ["#0c2a2e", "#1c4f58", "#2f8a8c", "#5cc4bc", "#a8ece0", "#e4fff8"] }, note: "북쪽 숲 어귀(밤) 반딧불(화면 층, 청록)" },
];

function fxPage(id: string, name: string, pixelFx: EventPixelFx): EventPage {
  return {
    id, name, conditions: [], graphic: { transparent: true }, trigger: { kind: "action" }, priority: "below", overlapForbidden: false,
    movement: { type: "fixed", speed: 3, frequency: 3 }, commands: [], pixelFx,
  } as unknown as EventPage;
}

function applyFieldFx(project: Project, report: { applied: string[]; skipped: string[] }): void {
  for (const entry of FALLEN_FIELD_FX) {
    const map = project.maps[entry.map];
    if (!map) { report.skipped.push(`필드 ${entry.note} — 맵 ${entry.map} 없음`); continue; }
    if (entry.at.x >= map.width || entry.at.y >= map.height) { report.skipped.push(`필드 ${entry.note} — 칸이 맵 밖`); continue; }
    const id = `ev_pfx_${entry.map}_${entry.key}`;
    const event = { id, name: `효과 · ${entry.note}`, x: entry.at.x, y: entry.at.y, trigger: { kind: "action" }, commands: [], pages: [fxPage(`${id}_p`, entry.note, entry.fx)] } as unknown as GameEvent;
    map.events = [...map.events.filter((e) => e.id !== id), event];
    report.applied.push(`필드 ${entry.note} → ${entry.fx.effectId}${entry.fx.layer === "screen" ? " (화면 층)" : ""}`);
  }
}

// ── 이야기 한 번 효과 ────────────────────────────────────────────────

function ensureFxRecord(project: Project, id: string, name: string, spec: PixelFxSpec, sound?: string, hit = 1): string {
  const record = normalizeBattleAnimationRecord({
    id, name, scope: "singleTarget", position: "feet", pixelFx: normalizePixelFxSpec(spec)!,
    timings: sound ? [{ frameIndex: hit, soundResourceId: sound }] : [],
  });
  project.database.battleAnimations = [...project.database.battleAnimations.filter((a) => a.id !== id), record];
  return id;
}

function findPage(map: GameMap | undefined, eventId: string, pageId?: string): EventPage | undefined {
  const event = map?.events.find((e) => e.id === eventId);
  return pageId ? event?.pages?.find((p) => p.id === pageId) : event?.pages?.[0];
}

function textOf(cmd: Command): string {
  const rec = cmd as unknown as Record<string, unknown>;
  return typeof rec.text === "string" ? rec.text : typeof rec.body === "string" ? rec.body : JSON.stringify(rec).slice(0, 400);
}

function applyStoryFx(project: Project, report: { applied: string[]; skipped: string[] }): void {
  // B4 — 성벽 개구멍: 브람이 돌을 빼내는 순간 돌가루가 훅 인다(맵 공개 연출의 먼지와 같은 박).
  const hole = findPage(project.maps.fs2_hub_night, "ev_fs2_hub_hole", "ev_fs2_hub_hole_open");
  const holeAt = hole?.commands.findIndex((c) => textOf(c).includes("돌 하나가 끌려 나왔다")) ?? -1;
  if (hole && holeAt >= 0) {
    const anim = ensureFxRecord(project, "anim_pfx_fs_hole_dust", "개구멍 돌가루 · pixelfx spawn/poof", { effectId: "spawn/poof", palette: [...PAL.dust], offsetY: -6 });
    hole.commands.splice(holeAt + 1, 0, { kind: "showAnimation", target: { eventId: "ev_fs2_hub_hole" }, animationId: anim, wait: false } as unknown as Command);
    report.applied.push("이야기 B4 성벽 개구멍 돌 빼기 → spawn/poof(흙먼지 색)");
  } else report.skipped.push("이야기 B4 성벽 개구멍 — ev_fs2_hub_hole_open 의 「돌 하나가 끌려 나왔다」 줄을 못 찾음");

  // 하늘탑 1층 마법진 — 사라졌다가(blink-out) 다른 마법진에서 나타난다(blink-in).
  const out = ensureFxRecord(project, "anim_pfx_fs_blink_out", "마법진 사라짐 · pixelfx arcane/blink-out", { effectId: "arcane/blink-out" });
  const into = ensureFxRecord(project, "anim_pfx_fs_blink_in", "마법진 나타남 · pixelfx arcane/blink-in", { effectId: "arcane/blink-in" });
  for (const id of ["ev_fs2_sky_tower_warp_a", "ev_fs2_sky_tower_warp_b"]) {
    const event = project.maps.fs2_sky_tower?.events.find((e) => e.id === id);
    let done = false;
    for (const page of event?.pages ?? []) {
      const at = page.commands.findIndex((c) => c.kind === "transfer" && (c as unknown as { mapId?: string }).mapId === "fs2_sky_tower");
      if (at < 0) continue;
      page.commands.splice(at + 1, 0, { kind: "showAnimation", target: "player", animationId: into, wait: false } as unknown as Command);
      page.commands.splice(at, 0, { kind: "showAnimation", target: "player", animationId: out, wait: true } as unknown as Command);
      done = true;
    }
    if (done) report.applied.push(`이야기 하늘탑 ${id} 순간이동 → arcane/blink-out → blink-in`);
    else report.skipped.push(`이야기 하늘탑 ${id} — 같은 맵 transfer 를 못 찾음`);
  }
  report.skipped.push("이야기 B5 새벽샘 돌집 문 spawn-portal — B5 재작업 중이라 필드·비트는 건드리지 않음(기술만)");
  report.skipped.push("이야기 종 장면 sunburst — 오프닝 애니매틱(fallenStarOpening)이라 맵 효과 층이 없음");
}

/** 데모 빌드 맨 끝에서 한 번 부른다. */
export function applyFallenPixelFx(project: Project): FallenPixelFxReport {
  const report = { applied: [] as string[], skipped: [] as string[] };
  // A/B 굽기용: OPRN_FS_PIXELFX=0 이면 아무것도 붙이지 않는다(효과 전 화면을 같은 코드로 굽는다).
  if (typeof process !== "undefined" && process.env?.OPRN_FS_PIXELFX === "0") return report;
  applySkillFx(project, report);
  applyFieldFx(project, report);
  applyStoryFx(project, report);
  if (typeof process !== "undefined" && process.env?.OPRN_FS_PIXELFX_REPORT === "1") console.log(JSON.stringify({ fallenPixelFx: report }, null, 1));
  return report;
}
