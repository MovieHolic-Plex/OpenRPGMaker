// 몬스터 수집 장르 전용 — 종 하나의 그림 다섯 면이 한 그림(한 원본 묶음)에서 나왔는지 보는 단일 정본 계약과 검사.
//
// 종 하나가 화면에 나오는 다섯 면: 초상(스타터 카드·도감·파티 상세), 전투 앞모습, 전투 뒷모습, 따라다니기 걷기 칩, 파티 아이콘.
// 2026-10-18 사용자 반려(c-1792294716295 다음, 16:08): 「몬스터 하나에 서로 다른 이미지들이 혼재되어 있다」 — 진화 계통 한 줄 안에서
// 1·2단은 하네스 도트(사람이 고른 생성형 도트), 3단은 다른 생성기(mx_art_* 다각형)였고, 따라다니기 칩이 없는 종은 다른 생물 칩으로 대체되거나
// 아예 사라졌다. 다섯 면을 각자 다른 도구가 정하던 것이 원인이다.
//
// 계약: 면마다 「원본 묶음(pack)」을 런타임과 같은 해석으로 정한다. 한 종의 다섯 면과 한 진화 계통의 모든 종은 같은 계열 묶음이어야 한다.
// 그림 검사는 주입된 래스터 로더로 한다(브라우저·노드 공용, 이 모듈은 파일을 읽지 않는다):
//   - 뒷모습·칩·아이콘 색이 앞모습 팔레트 안에 있는가(Lab ΔE)
//   - 칩 12칸이 칸 경계에 잘리지 않고, 칩 밑에 배경 띠·불투명 상자가 없는가
//   - 앞모습·뒷모습에 외톨이 도트·반투명 잔점이 없는가
//   - 진화 단계마다 앞모습 외곽 상자 넓이가 커지고(1단 < 2단 < 3단) 색 계열을 잇는가 — 하네스 fit 이 단계별 몸집을 외곽 상자로 맞춘다
import { charsetFrameSource, decodeCharsetFrameIndex, CHARSET_FRAME_HEIGHT, CHARSET_FRAME_WIDTH, type CharsetDirection } from "@/assets/easyrpgRtp";
import { harnessSpeciesForFieldChip, resolveHarnessMonsterUrl } from "@/assets/harnessMonsterArt";
import { resolveAssetResourceUrl } from "@/assets/generatedAssetResourceResolver";
import { findCharsetAsset } from "@/assets/charsetCatalog";
import { isEmeraldMonsterStyle } from "@/project/emeraldMonsterStyle";
import { monsterSpeciesForEnemy } from "@/project/monsterCollection";
import type { MonsterSpeciesRecord, Project } from "@/project/types";

export type MonsterSurface = "portrait" | "front" | "back" | "field" | "icon";
export const MONSTER_SURFACES: readonly MonsterSurface[] = ["portrait", "front", "back", "field", "icon"];
export const MONSTER_SURFACE_LABEL: Readonly<Record<MonsterSurface, string>> = {
  portrait: "초상", front: "앞모습", back: "뒷모습", field: "동행 칩", icon: "아이콘",
};

/** 따라다니기 칩이 없을 때 비에메랄드 런타임이 쓰는 기본 칩(followers.ts 와 같은 값) — 다른 생물이다. */
const DEFAULT_MONSTER_FIELD_CHARSET = "tex_easyrpg_charset_monster1";
const HARNESS_URL = /\/assets\/harnesses\/monster-collect-species\/([a-z][a-z0-9-]*)\/(?:front|back)\.png/u;
const MX_ART = /^mx_art_([a-z][a-z0-9]*)_(?:front|back|icon)$/u;

export interface MonsterSurfaceRef {
  readonly surface: MonsterSurface;
  readonly resourceId?: string;
  readonly url: string | null;
  /** 원본 묶음 — 같은 그림에서 나온 면은 같은 값. 예 `harness:leafling`, `mx_art:grovewarden`. */
  readonly pack: string | null;
  /** 걷기 칩이면 시트 안 캐릭터 칸. */
  readonly characterIndex?: number;
  /** 종 그림이 아닌 대체 그림(기본 몬스터 칩 등). */
  readonly fallback?: boolean;
}

function packOf(resourceId: string | undefined, url: string | null): string | null {
  if (!resourceId) return null;
  const harness = HARNESS_URL.exec(resolveHarnessMonsterUrl(resourceId) ?? url ?? "");
  if (harness) return `harness:${harness[1]}`;
  const mx = MX_ART.exec(resourceId);
  if (mx) return `mx_art:${mx[1]}`;
  return `asset:${resourceId}`;
}

/** 파티·박스 아이콘 — 런타임 monsterMenuIconResourceId 와 같은 해석(에메랄드면 `_icon` 형제, 없으면 앞모습). */
function iconResourceId(project: Project, frontId: string | undefined): string | undefined {
  if (!frontId || !isEmeraldMonsterStyle(project)) return frontId;
  const iconId = frontId.replace(/_front$/u, "_icon");
  return iconId !== frontId && resolveAssetResourceUrl(iconId, { project }) ? iconId : frontId;
}

function fieldRef(project: Project, species: MonsterSpeciesRecord): MonsterSurfaceRef {
  const graphic = species.graphic;
  const authored = graphic.fieldGraphic?.sprite?.id ? graphic.fieldGraphic : undefined;
  const textureKey = authored?.sprite?.id ?? graphic.fieldCharsetId?.trim();
  // 에메랄드 런타임은 칩 없는 종을 따라다니게 하지 않는다(면 없음). 그 밖은 기본 몬스터 칩 0번(다른 생물)으로 떨어진다.
  if (!textureKey) {
    if (isEmeraldMonsterStyle(project)) return { surface: "field", url: null, pack: null };
    return { surface: "field", resourceId: DEFAULT_MONSTER_FIELD_CHARSET, url: resolveAssetResourceUrl(DEFAULT_MONSTER_FIELD_CHARSET, { project }), pack: `charset:${DEFAULT_MONSTER_FIELD_CHARSET}#0`, characterIndex: 0, fallback: true };
  }
  const pattern = authored?.pattern;
  const characterIndex = typeof pattern === "number" && pattern >= 3 ? decodeCharsetFrameIndex(pattern).characterIndex : 0;
  const asset = findCharsetAsset(textureKey);
  const url = resolveAssetResourceUrl(textureKey, { project });
  const harness = harnessSpeciesForFieldChip(asset?.textureKey ?? textureKey, characterIndex);
  return { surface: "field", resourceId: textureKey, url, pack: harness ? `harness:${harness}` : `charset:${asset?.textureKey ?? textureKey}#${characterIndex}`, characterIndex };
}

/** 종 하나의 다섯 면을 런타임과 같은 규칙으로 해석한다. */
export function monsterSpeciesSurfaces(project: Project, species: MonsterSpeciesRecord): Readonly<Record<MonsterSurface, MonsterSurfaceRef>> {
  const front = species.graphic.monsterResourceId;
  // 뒷모습이 없으면 런타임은 앞모습을 뒤집지 않고 그대로 쓴다(battleFieldDom) — 같은 그림이므로 묶음도 같다.
  const back = species.graphic.backResourceId ?? front;
  const icon = iconResourceId(project, front);
  const ref = (surface: MonsterSurface, resourceId: string | undefined): MonsterSurfaceRef => {
    const url = resourceId ? resolveAssetResourceUrl(resourceId, { project }) : null;
    return { surface, ...(resourceId ? { resourceId } : {}), url, pack: url ? packOf(resourceId, url) : null };
  };
  return {
    // 초상은 별도 그림이 없다 — 스타터 카드·도감·파티 상세가 모두 앞모습을 그대로 쓴다(starterChoice.ts·playerMonsterDexDetail.ts).
    portrait: ref("portrait", front),
    front: ref("front", front),
    back: ref("back", back),
    field: fieldRef(project, species),
    icon: ref("icon", icon),
  };
}

/** 묶음의 계열(생성기). 같은 진화 계통은 같은 계열이어야 한다. */
export function packFamily(pack: string | null): string | null {
  return pack ? pack.slice(0, pack.indexOf(":")) : null;
}

// ---- 그림 측정 -------------------------------------------------------------------

export interface CoherenceRaster { readonly width: number; readonly height: number; readonly data: Uint8Array | Uint8ClampedArray }
export type CoherenceImageLoader = (url: string) => CoherenceRaster | null;

type Lab = readonly [number, number, number];
interface Swatch { readonly lab: Lab; readonly share: number }

function srgbToLinear(v: number): number {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function toLab(r: number, g: number, b: number): Lab {
  const lr = srgbToLinear(r), lg = srgbToLinear(g), lb = srgbToLinear(b);
  const x = (lr * 0.4124 + lg * 0.3576 + lb * 0.1805) / 0.95047;
  const y = lr * 0.2126 + lg * 0.7152 + lb * 0.0722;
  const z = (lr * 0.0193 + lg * 0.1192 + lb * 0.9505) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

function deltaE(a: Lab, b: Lab): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

export interface Rect { readonly x: number; readonly y: number; readonly width: number; readonly height: number }

function fullRect(image: CoherenceRaster): Rect {
  return { x: 0, y: 0, width: image.width, height: image.height };
}

function alphaAt(image: CoherenceRaster, x: number, y: number): number {
  return image.data[(y * image.width + x) * 4 + 3]!;
}

/** 칠해진 색(윤곽선처럼 아주 어두운 색 제외)의 비율 팔레트. 묶음 그림끼리 같은 생물인지 비교하는 바탕. */
function swatches(image: CoherenceRaster, rect: Rect): Swatch[] {
  const counts = new Map<number, number>();
  let total = 0;
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) {
      const i = (y * image.width + x) * 4;
      if (image.data[i + 3]! < 128) continue;
      const key = (image.data[i]! << 16) | (image.data[i + 1]! << 8) | image.data[i + 2]!;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  const out: Swatch[] = [];
  for (const [key, count] of counts) {
    const lab = toLab(key >> 16, (key >> 8) & 255, key & 255);
    if (lab[0] < 22) continue;
    out.push({ lab, share: count });
    total += count;
  }
  return total ? out.map((swatch) => ({ lab: swatch.lab, share: swatch.share / total })).sort((a, b) => b.share - a.share) : [];
}

/** `subject` 의 칠한 색 중 `reference` 팔레트에서 ΔE `tolerance` 안에 짝이 있는 비율(0~1). */
export function paletteCoverage(reference: readonly Swatch[], subject: readonly Swatch[], tolerance: number): number {
  const significant = reference.filter((swatch) => swatch.share >= 0.01);
  let covered = 0;
  for (const swatch of subject) if (significant.some((ref) => deltaE(ref.lab, swatch.lab) <= tolerance)) covered += swatch.share;
  return covered;
}

interface InkStats { readonly bbox: Rect | null; readonly area: number; readonly strays: number; readonly translucent: number }

/** 외곽 상자·칠한 칸 수·외톨이 도트(8방향 이웃 없음 — 대각선으로 이어진 1px 선은 선이다)·반투명 잔점 수. */
export function inkStats(image: CoherenceRaster, rect: Rect = fullRect(image)): InkStats {
  let area = 0, strays = 0, translucent = 0;
  let minX = Infinity, minY = Infinity, maxX = -1, maxY = -1;
  for (let y = rect.y; y < rect.y + rect.height; y++) {
    for (let x = rect.x; x < rect.x + rect.width; x++) {
      const a = alphaAt(image, x, y);
      if (a === 0) continue;
      area++;
      if (a < 255) translucent++;
      minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
      const neighbour = (nx: number, ny: number) => nx >= rect.x && ny >= rect.y && nx < rect.x + rect.width && ny < rect.y + rect.height && alphaAt(image, nx, ny) > 0;
      let alone = true;
      for (let dy = -1; dy <= 1 && alone; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && neighbour(x + dx, y + dy)) { alone = false; break; }
      if (alone) strays++;
    }
  }
  return { area, strays, translucent, bbox: maxX < 0 ? null : { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 } };
}

const CHIP_DIRECTIONS: readonly CharsetDirection[] = ["down", "left", "right", "up"];

export interface ChipFrameDefect { readonly direction: CharsetDirection; readonly pattern: number; readonly kind: "clipped" | "background" | "empty" }

/** 걷기 칩 12칸: 칸 경계에 닿은 잉크(잘림), 칸 대부분을 채운 불투명 상자·발밑 한 색 띠(배경 띠), 빈 칸. */
export function chipFrameDefects(sheet: CoherenceRaster, characterIndex: number): ChipFrameDefect[] {
  const defects: ChipFrameDefect[] = [];
  for (const direction of CHIP_DIRECTIONS) {
    for (const pattern of [0, 1, 2] as const) {
      const source = charsetFrameSource({ characterIndex, direction, pattern });
      if (source.x + source.width > sheet.width || source.y + source.height > sheet.height) { defects.push({ direction, pattern, kind: "empty" }); continue; }
      const stats = inkStats(sheet, source);
      if (!stats.bbox) { defects.push({ direction, pattern, kind: "empty" }); continue; }
      const box = stats.bbox;
      if (box.x === source.x || box.x + box.width === source.x + source.width || box.y === source.y) defects.push({ direction, pattern, kind: "clipped" });
      if (stats.area >= source.width * source.height * 0.85 || hasBottomBand(sheet, source)) defects.push({ direction, pattern, kind: "background" });
    }
  }
  return defects;
}

/** 칸 아래 네 줄 중 한 줄이 칸 너비 85% 이상을 같은 색 하나로 채우면 발밑 배경 띠다(몸이 넓어도 한 색 한 줄로 꽉 차지 않는다). */
function hasBottomBand(sheet: CoherenceRaster, rect: Rect): boolean {
  for (let y = rect.y + rect.height - 4; y < rect.y + rect.height; y++) {
    const runs = new Map<number, number>();
    for (let x = rect.x; x < rect.x + rect.width; x++) {
      const i = (y * sheet.width + x) * 4;
      if (sheet.data[i + 3]! < 255) continue;
      const key = (sheet.data[i]! << 16) | (sheet.data[i + 1]! << 8) | sheet.data[i + 2]!;
      runs.set(key, (runs.get(key) ?? 0) + 1);
    }
    if ([...runs.values()].some((count) => count >= rect.width * 0.85)) return true;
  }
  return false;
}

/** 칩의 칠한 색은 앞 방향 서 있는 칸 하나로 본다(뒷면은 등 색만 나와 팔레트가 치우친다). */
function chipFrontRect(characterIndex: number): Rect {
  return charsetFrameSource({ characterIndex, direction: "down", pattern: 1 });
}

// ---- 검사 ------------------------------------------------------------------------

/** 앞모습 팔레트 안에 있어야 하는 비율(ΔE 허용). 실측(2026-10-18): 같은 그림 뒷모습 0.93~1.0, 하네스 칩 0.82~0.99, 다른 종 0.05~0.45. */
export const COHERENCE_TOLERANCE = { deltaE: 16, sameDrawing: 0.7, chip: 0.6, evolution: 0.35 } as const;

export type CoherenceSeverity = "blocker" | "warning";
export interface CoherenceFinding {
  readonly severity: CoherenceSeverity;
  readonly code: string;
  readonly speciesId: string;
  readonly message: string;
}

export interface SpeciesCoherenceRow {
  readonly speciesId: string;
  readonly name: string;
  readonly stage: number;
  readonly line: readonly string[];
  readonly surfaces: Readonly<Record<MonsterSurface, MonsterSurfaceRef>>;
  /** 앞모습 대비 팔레트 일치율(면별, 그림을 읽은 면만). */
  readonly coverage: Partial<Record<MonsterSurface, number>>;
  /** 앞모습 잉크의 외곽 상자 넓이(가로×세로) — 진화 계통 몸집 비교 기준. */
  readonly frontBoxArea?: number;
  readonly findings: readonly CoherenceFinding[];
}

export interface MonsterSpeciesCoherenceReport {
  readonly emerald: boolean;
  readonly rows: readonly SpeciesCoherenceRow[];
  readonly findings: readonly CoherenceFinding[];
  readonly pass: boolean;
}

/** 진화 계통(1단부터 끝까지). 진화 전 단계가 없는 종이 1단이다. 갈래 진화는 각 갈래가 한 줄이다. */
export function monsterEvolutionLines(project: Project): string[][] {
  const species = project.database.monsterSpecies ?? [];
  const parents = new Set(species.flatMap((record) => (record.evolutions ?? []).map((evolution) => evolution.toSpeciesId)));
  const byId = new Map(species.map((record) => [record.id, record]));
  const lines: string[][] = [];
  const walk = (id: string, path: string[]) => {
    const next = [...new Set((byId.get(id)?.evolutions ?? []).map((evolution) => evolution.toSpeciesId))].filter((to) => byId.has(to) && !path.includes(to));
    if (next.length === 0) { lines.push([...path, id]); return; }
    for (const to of next) walk(to, [...path, id]);
  };
  for (const record of species) if (!parents.has(record.id)) walk(record.id, []);
  return lines;
}

/**
 * 몬스터 종 다섯 면 일관성 게이트. 몬스터 수집 게임이 아니면 호출자가 부르지 않는다.
 * `load` 가 null 을 주는 그림은 「읽을 수 없는 면」으로 막힘이다(가짜 통과 없음).
 */
export function auditMonsterSpeciesCoherence(project: Project, load: CoherenceImageLoader): MonsterSpeciesCoherenceReport {
  const emerald = isEmeraldMonsterStyle(project);
  const species = project.database.monsterSpecies ?? [];
  const lines = monsterEvolutionLines(project);
  const lineOf = new Map<string, string[]>();
  for (const line of lines) for (const id of line) if (!lineOf.has(id)) lineOf.set(id, line);
  const cache = new Map<string, CoherenceRaster | null>();
  const image = (url: string | null) => {
    if (!url) return null;
    if (!cache.has(url)) cache.set(url, load(url));
    return cache.get(url)!;
  };
  const frontSwatches = new Map<string, Swatch[]>();
  const frontArea = new Map<string, number>();
  const rows: SpeciesCoherenceRow[] = [];

  for (const record of species) {
    const findings: CoherenceFinding[] = [];
    const add = (severity: CoherenceSeverity, code: string, message: string) => findings.push({ severity, code, speciesId: record.id, message });
    const surfaces = monsterSpeciesSurfaces(project, record);
    const coverage: Partial<Record<MonsterSurface, number>> = {};
    const line = lineOf.get(record.id) ?? [record.id];

    for (const surface of MONSTER_SURFACES) {
      const ref = surfaces[surface];
      // 칩이 없는 종은 따라다니지 않을 뿐 다른 그림이 섞이진 않는다 — 계통 안에서 칩이 있다 없다 하면 아래 계통 검사가 막는다.
      if (surface === "field" && !ref.resourceId) {
        add("warning", "monster-surface-missing", `${record.name}: 따라다니기 칩이 없다 — 파티 선두일 때 필드에 나타나지 않는다`);
        continue;
      }
      if (!ref.resourceId) { add("blocker", "monster-surface-missing", `${record.name}: ${MONSTER_SURFACE_LABEL[surface]} 그림이 없다`); continue; }
      if (ref.fallback) add("blocker", "monster-surface-fallback", `${record.name}: ${MONSTER_SURFACE_LABEL[surface]}이 종 그림이 아니라 기본 칩(${ref.resourceId} 0번, 다른 생물)이다`);
      if (!image(ref.url)) add("blocker", "monster-surface-unreadable", `${record.name}: ${MONSTER_SURFACE_LABEL[surface]} 그림(${ref.resourceId})을 읽을 수 없다`);
    }

    const packs = new Set(MONSTER_SURFACES.map((surface) => surfaces[surface].pack).filter((pack): pack is string => !!pack));
    if (packs.size > 1) {
      add("blocker", "monster-surface-mixed", `${record.name}: 다섯 면이 서로 다른 그림 묶음에서 왔다 — ${MONSTER_SURFACES.filter((s) => surfaces[s].pack).map((s) => `${MONSTER_SURFACE_LABEL[s]} ${surfaces[s].pack}`).join(", ")}`);
    }

    const front = image(surfaces.front.url);
    if (front) {
      const reference = swatches(front, fullRect(front));
      frontSwatches.set(record.id, reference);
      const stats = inkStats(front);
      if (stats.bbox) frontArea.set(record.id, stats.bbox.width * stats.bbox.height);
      if (stats.strays > 0 || stats.translucent > 0) add("blocker", "monster-sprite-noise", `${record.name}: 앞모습에 외톨이 도트 ${stats.strays}개·반투명 잔점 ${stats.translucent}개`);
      coverage.portrait = 1;
      for (const surface of ["back", "icon"] as const) {
        const ref = surfaces[surface];
        const other = image(ref.url);
        if (!other || ref.url === surfaces.front.url) { if (other) coverage[surface] = 1; continue; }
        const value = paletteCoverage(reference, swatches(other, fullRect(other)), COHERENCE_TOLERANCE.deltaE);
        coverage[surface] = value;
        if (value < COHERENCE_TOLERANCE.sameDrawing) add("blocker", "monster-surface-palette", `${record.name}: ${MONSTER_SURFACE_LABEL[surface]} 색 ${Math.round(value * 100)}% 만 앞모습 팔레트 안 — 다른 그림이다`);
        if (surface === "back") {
          const backStats = inkStats(other);
          if (backStats.strays > 0 || backStats.translucent > 0) add("blocker", "monster-sprite-noise", `${record.name}: 뒷모습에 외톨이 도트 ${backStats.strays}개·반투명 잔점 ${backStats.translucent}개`);
        }
      }
      const field = surfaces.field;
      const sheet = field.resourceId && !field.fallback ? image(field.url) : null;
      if (sheet && field.characterIndex !== undefined) {
        const rect = chipFrontRect(field.characterIndex);
        if (rect.x + CHARSET_FRAME_WIDTH <= sheet.width && rect.y + CHARSET_FRAME_HEIGHT <= sheet.height) {
          const value = paletteCoverage(reference, swatches(sheet, rect), COHERENCE_TOLERANCE.deltaE);
          coverage.field = value;
          if (value < COHERENCE_TOLERANCE.chip) add("blocker", "monster-surface-palette", `${record.name}: 동행 칩 색 ${Math.round(value * 100)}% 만 앞모습 팔레트 안 — 다른 생물 칩이다`);
        }
        const defects = chipFrameDefects(sheet, field.characterIndex);
        for (const kind of ["clipped", "background", "empty"] as const) {
          const hits = defects.filter((defect) => defect.kind === kind);
          if (hits.length === 0) continue;
          const label = kind === "clipped" ? "칸 경계에 잘림" : kind === "background" ? "배경 띠·불투명 상자" : "빈 칸";
          add("blocker", `monster-chip-${kind}`, `${record.name}: 동행 칩 ${hits.length}칸 ${label} (${hits.slice(0, 4).map((hit) => `${hit.direction}${hit.pattern}`).join(", ")})`);
        }
      }
    }
    rows.push({ speciesId: record.id, name: record.name, stage: line.indexOf(record.id) + 1, line, surfaces, coverage, ...(frontArea.has(record.id) ? { frontBoxArea: frontArea.get(record.id)! } : {}), findings });
  }

  const rowById = new Map(rows.map((row) => [row.speciesId, row]));
  const lineFindings: CoherenceFinding[] = [];
  for (const line of lines) {
    if (line.length < 2) continue;
    const families = new Set(line.map((id) => packFamily(rowById.get(id)?.surfaces.front.pack ?? null)).filter(Boolean));
    const names = line.map((id) => rowById.get(id)?.name ?? id);
    if (families.size > 1) {
      lineFindings.push({ severity: "blocker", code: "monster-line-mixed", speciesId: line[0]!, message: `진화 계통 ${names.join("→")}: 단계마다 다른 생성기 그림이 섞였다 (${line.map((id) => rowById.get(id)?.surfaces.front.pack ?? "없음").join(" / ")})` });
    }
    const withChip = line.filter((id) => rowById.get(id)?.surfaces.field.resourceId);
    if (withChip.length > 0 && withChip.length < line.length) {
      const missing = line.filter((id) => !withChip.includes(id)).map((id) => rowById.get(id)?.name ?? id);
      lineFindings.push({ severity: "blocker", code: "monster-line-field", speciesId: line[0]!, message: `진화 계통 ${names.join("→")}: ${missing.join("·")} 만 따라다니기 칩이 없다 — 진화하면 따라오던 몬스터가 사라진다` });
    }
    for (let i = 1; i < line.length; i++) {
      const before = line[i - 1]!, after = line[i]!;
      const a = frontArea.get(before), b = frontArea.get(after);
      if (a !== undefined && b !== undefined && b <= a) {
        lineFindings.push({ severity: "blocker", code: "monster-line-size", speciesId: after, message: `진화 계통 ${names.join("→")}: ${rowById.get(after)?.name} 앞모습 외곽 상자 ${b}px² 가 진화 전 ${rowById.get(before)?.name} ${a}px² 보다 크지 않다` });
      }
      const sa = frontSwatches.get(before), sb = frontSwatches.get(after);
      if (sa && sb) {
        const value = paletteCoverage(sa, sb, COHERENCE_TOLERANCE.deltaE);
        if (value < COHERENCE_TOLERANCE.evolution) {
          lineFindings.push({ severity: "blocker", code: "monster-line-palette", speciesId: after, message: `진화 계통 ${names.join("→")}: ${rowById.get(after)?.name} 색 ${Math.round(value * 100)}% 만 진화 전 팔레트를 잇는다` });
        }
      }
    }
  }

  // 전투 적 기록(야생·트레이너)은 종의 앞모습을 그대로 써야 한다 — 다르면 같은 종이 전투마다 다른 그림이다.
  for (const enemy of project.database.enemies ?? []) {
    const record = monsterSpeciesForEnemy(project, enemy);
    if (!record || !enemy.monsterResourceId || enemy.monsterResourceId === record.graphic.monsterResourceId) continue;
    lineFindings.push({ severity: "blocker", code: "monster-enemy-art", speciesId: record.id, message: `${record.name}: 전투 적 ${enemy.id} 그림(${enemy.monsterResourceId})이 종 앞모습(${record.graphic.monsterResourceId ?? "없음"})과 다르다` });
  }

  const findings = [...rows.flatMap((row) => row.findings), ...lineFindings];
  return { emerald, rows, findings, pass: findings.every((finding) => finding.severity !== "blocker") };
}
