import { writeFileSync } from "node:fs";
import { findCharsetAsset } from "../../../src/assets/charsetCatalog.ts";
import { decodeCharsetFrameIndex } from "../../../src/assets/easyrpgRtp.ts";
import { charsetFamilyOf, type CharsetFamilyId } from "../../../src/project/charsetFamily.ts";
import { activeGenreLock } from "../../../src/project/genreLock.ts";
import type { Project } from "../../../src/project/types.ts";

export interface Ref { group?: string; verdict?: string; kind: string; where: string; path: string; id: string; index?: number; family: string; note?: string }
const ALLOWED_MONSTER = new Set(["scarloxy-people","oprn-creature","rtp-creature","object","uploaded","other"]);

/** 강한 허용: 사람 칩은 scarloxy, 생물 칩은 oprn/rtp creature. */
export function walk(value: unknown, path: string, visit: (path: string, key: string, v: unknown, parent: any) => void, parent?: any) {
  if (Array.isArray(value)) { value.forEach((v, i) => walk(v, `${path}[${i}]`, visit, value)); return; }
  if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value as any)) { visit(path, k, v, value); walk(v, `${path}.${k}`, visit, value); }
  }
}

export function faceFamily(id: string): string {
  const s = id.toLowerCase();
  if (/^easyrpg-faceset-(actor|people)/.test(s)) return "rtp-face";
  if (/scarloxy/.test(s)) return "scarloxy-face";
  if (/wizard/.test(s)) return "wizarding-face";
  if (/heroes/.test(s)) return "heroes-face";
  if (/^shared-/.test(s)) return "shared-portrait";
  return "other-face(" + s.replace(/[0-9]+/g,"#").slice(0,40) + ")";
}

/** 프로젝트 전체에서 캐릭터·얼굴·초상·트레이너·몬스터 그림을 가리키는 문자열을 전부 모은다(타일·자산·참고 프로필 제외). */
export function dumpRefs(project: Project): Ref[] {
  const refs: Ref[] = [];
  const root: any = {};
  for (const [k, v] of Object.entries(project)) if (!["tilesets", "assets", "resourceProfiles"].includes(k)) root[k] = v;
  const maps: any = {};
  for (const [id, m] of Object.entries<any>(project.maps)) { const { lowerTiles, upperTiles, lowerOverlayTiles, upperOverlayTiles, shadowBits, relief, passage, ...rest } = m; maps[id] = rest; }
  root.maps = maps;
  const consumed = new Set<string>();
  const whereOf = (full: string): string => {
    const mm = full.match(/^\$\.maps\.([^.]+)\.events\[(\d+)\]/);
    if (mm) { const ev: any = (project.maps as any)[mm[1]].events[Number(mm[2])]; return `맵 ${mm[1]} / ${ev.id}「${ev.name ?? ""}」@${ev.x},${ev.y}`; }
    const am = full.match(/^\$\.database\.actors\[(\d+)\]/);
    if (am) { const a: any = project.database.actors[Number(am[1])]; return `배우 ${a.id}「${a.name}」`; }
    const tm = full.match(/^\$\.database\.troops\[(\d+)\]/);
    if (tm) { const a: any = project.database.troops[Number(tm[1])]; return `전투조 ${a.id}「${a.name}」`; }
    const sm = full.match(/^\$\.database\.monsterSpecies\[(\d+)\]/);
    if (sm) { const a: any = project.database.monsterSpecies[Number(sm[1])]; return `종 ${a.id}「${a.name}」`; }
    const em = full.match(/^\$\.database\.enemies\[(\d+)\]/);
    if (em) { const a: any = project.database.enemies[Number(em[1])]; return `적 ${a.id}「${a.name}」`; }
    return full;
  };
  walk(root, "$", (path, key, v, parent) => {
    const full = `${path}.${key}`;
    if (consumed.has(full)) return;
    if (key === "graphic" && v && typeof v === "object" && (v as any).sprite?.id) {
      const g: any = v;
      if (g.transparent === true) return;
      consumed.add(`${full}.sprite.id`);
      const idx = decodeCharsetFrameIndex(typeof g.pattern === "number" ? g.pattern : 0).characterIndex;
      refs.push({ kind: "charset", where: whereOf(full), path: full + ".sprite", id: g.sprite.id, index: idx, family: charsetFamilyOf(project, g.sprite.id) });
      return;
    }
    if (key === "graphic" && v && typeof v === "object" && (v as any).appearanceId && !(v as any).sprite) {
      refs.push({ kind: "appearanceId", where: whereOf(full), path: full, id: (v as any).appearanceId, family: appearanceFamily(project, (v as any).appearanceId) });
      return;
    }
    if (typeof v !== "string" || !v) return;
    const asset = findCharsetAsset(v);
    if (asset && !/^(name|label|title|summary|description)$/.test(key)) {
      const idx = typeof parent?.characterIndex === "number" ? parent.characterIndex : undefined;
      refs.push({ kind: "charset", where: whereOf(full), path: full, id: v, index: idx, family: charsetFamilyOf(project, v) });
      return;
    }
    if (/^(front|back|throw|backThrow)$/.test(key) && /trainerSprite/.test(path)) { refs.push({ kind: "trainerSprite." + key, where: whereOf(full), path: full, id: v, family: trainerFamily(v) }); return; }
    if (/faceset|^shared-(bust|face|full|portrait)|portrait|bust/i.test(v) && !/\s/.test(v) && v.length < 90 && !/^(name|label|title|summary|description)$/.test(key)) refs.push({ kind: "face/portrait", where: whereOf(full), path: full, id: v, family: faceFamily(v) });
    else if (/^(monsterResourceId|backResourceId|battleCharacterResourceId|fieldCharsetId)$/.test(key)) refs.push({ kind: "monster-art:" + key, where: whereOf(full), path: full, id: v, family: monsterArtFamily(v) });
  });
  return refs;
}

export function appearanceFamily(p: Project, id: string): string {
  const a: any = (p.database as any).characterAppearances?.find((r: any) => r.id === id);
  return a?.charset ? "appearance->" + charsetFamilyOf(p, a.charset.resourceId) : "appearance(no charset)";
}
export function trainerFamily(id: string): string { return /^(boy|bug_catcher|elder|fisher|girl|gym_|hero_|hiker|punk|scientist)/.test(id) ? "bundled-battle-trainer" : "other-trainer"; }
export function monsterArtFamily(id: string): string {
  const s = id.toLowerCase();
  if (/^mx_art_|emerald|oprn-monster|monster-kit|oprn_monster|species/.test(s)) return "oprn-monster";
  if (/easyrpg|rtp/.test(s)) return "rtp-monster";
  return "other(" + s.slice(0, 30) + ")";
}

export function lockInfo(p: Project) {
  const a = activeGenreLock(p);
  return { genre: p.system.genre ?? null, lock: p.system.genreLock ? { preset: p.system.genreLock.preset, mode: p.system.genreLock.mode, chars: p.system.genreLock.allowedCharsetFamilies ?? null } : null, active: !!a };
}

export function summarize(refs: Ref[]) {
  const by = new Map<string, number>();
  for (const r of refs) by.set(`${r.kind}|${r.family}`, (by.get(`${r.kind}|${r.family}`) ?? 0) + 1);
  return Object.fromEntries([...by].sort());
}
export function save(path: string, data: unknown) { writeFileSync(path, JSON.stringify(data, null, 1)); }

/** battler id 의 charset 시트 계열(charset-battler-actor1-3 → rtp-people). */
export function battlerCharsetFamily(id: string): string | undefined {
  const m = id.match(/^charset-battler-(actor\d|people\d|monster\d|animal)(?:-|$)/) ?? id.match(/^party-pixel-(animal|monster\d|actor\d|people\d)-/);
  if (!m) return undefined;
  return charsetFamilyOf(undefined, `easyrpg-charset-${m[1]}`);
}

const OK_CHAR = new Set(["scarloxy-people", "oprn-creature"]);
const WEAK_CHAR = new Set(["rtp-creature", "object", "uploaded"]);

export function judge(r: Ref): "OK" | "WEAK" | "BAD" | "UNKNOWN" {
  if (r.kind === "charset") {
    if (OK_CHAR.has(r.family)) return "OK";
    if (WEAK_CHAR.has(r.family)) return "WEAK";
    if (r.family === "other") return "UNKNOWN";
    return "BAD";
  }
  if (r.kind === "face/portrait") {
    if (r.family === "scarloxy-face") return "OK";
    if (/monster/.test(r.family)) return "OK";
    if (/missing-people/.test(r.family)) return "UNKNOWN";
    if (r.family === "rtp-face" || r.family === "wizarding-face" || r.family === "heroes-face") return "BAD";
    return "UNKNOWN";
  }
  if (r.kind.startsWith("trainerSprite")) return r.family === "bundled-battle-trainer" ? "WEAK" : "UNKNOWN";
  if (r.kind === "appearanceId") return /->(scarloxy-people|oprn-creature)/.test(r.family) ? "OK" : /no charset/.test(r.family) ? "UNKNOWN" : "BAD";
  if (r.kind.startsWith("monster-art")) {
    const bf = battlerCharsetFamily(r.id);
    if (bf) return OK_CHAR.has(bf) ? "OK" : WEAK_CHAR.has(bf) ? "WEAK" : "BAD";
    return r.family === "oprn-monster" ? "OK" : /harness-monster/.test(r.id) ? "OK" : "UNKNOWN";
  }
  return "UNKNOWN";
}

export function groupOf(project: Project, r: Ref): string {
  if (r.path.startsWith("$.maps")) return "맵 이벤트";
  const am = r.path.match(/^\$\.database\.actors\[(\d+)\]/);
  if (am) { const a: any = project.database.actors[Number(am[1])]; const start = (project.database as any).startActorIds ?? (project.system as any).startActorIds ?? ["actor_hero"]; return start.includes(a.id) ? "배우(시작 파티)" : "배우(기본 명단·비시작)"; }
  if (r.path.startsWith("$.database.troops")) return "전투조(트레이너)";
  if (r.path.startsWith("$.database.monsterSpecies")) return "몬스터 종";
  if (r.path.startsWith("$.database.enemies")) return "적";
  if (r.path.startsWith("$.database.characterAppearances")) return "외형 프리셋";
  if (r.path.startsWith("$.commonEvents")) return "공용 이벤트";
  if (r.path.startsWith("$.system") || r.path.startsWith("$.meta")) return "시스템·오프닝";
  return "기타 " + r.path.split(".").slice(0, 3).join(".");
}

export function judged(project: Project): Ref[] {
  const refs = dumpRefs(project);
  for (const r of refs) { r.group = groupOf(project, r); r.verdict = judge(r); }
  return refs;
}

export function table(refs: Ref[]): string {
  const m = new Map<string, Record<string, number>>();
  for (const r of refs) { const k = `${r.group} · ${r.kind.replace(/:.*/, "")}`; const row = m.get(k) ?? {}; row[r.verdict!] = (row[r.verdict!] ?? 0) + 1; m.set(k, row); }
  return [...m].sort().map(([k, v]) => `${k.padEnd(38)} OK ${v.OK ?? 0} WEAK ${v.WEAK ?? 0} BAD ${v.BAD ?? 0} ?? ${v.UNKNOWN ?? 0}`).join("\n");
}
