// 요청 건물 — 마을을 지을 때 조수가 킷 id 나 종류 낱말로 청하는 건물(「광장 곁 대성당」·「시장이 있는 마을」).
//
// 왜(2026-11-16 실모델 확인 빌드 r6 «갈매나루»): 요청은 «광장 곁 대성당» 이었는데 마을 시공기에는 건물을 청할 길이 없었다. 모델은 성당 킷을 손으로 찍다
// 네 번 거절당하고 북동쪽 윗단 벼랑 위에 세웠다(문 앞이 절벽, 지붕 위에 나무). 이제 시공기가 청한 건물을 모이는 곳(광장) 가장자리에 스스로 앉힌다.
//
// 낱말 → 킷은 손으로 만든 별칭 표가 아니라 킷이 가진 것으로만 찾는다: id(토막) · 꼬리표(ai.tags) · 이름. 그래서 새 건물 킷이 들어오면 그대로 청할 수 있다.
import type { StructureKitDef } from "@/project/types";

/** 허용·검수 건물(bd-house-rv-* · bd-house-mk-*)의 문 부위는 두 칸 높이(dy = 문 윗칸)다 — 시공기(beodeulVillage kitIndex)와 같은 셈. */
const TALL_DOOR = /^bd-house-(rv|mk)-/u;

/** 마을 시공기가 문 앞을 잡을 수 있는 건물 킷인가 — 문(입구 부위)이 하나이고 그 문이 그림 맨 아랫줄에 있다. */
export function isSeatableBuilding(kit: StructureKitDef): boolean {
  const doors = (kit.parts ?? []).filter((p) => p.kind === "entrance");
  if (doors.length !== 1) return false;
  const d = doors[0]!;
  return (TALL_DOOR.test(kit.id) ? d.dy + Math.max(1, d.h ?? 1) - 1 : d.dy) === kit.height - 1;
}

const norm = (s: string): string => s.trim().toLowerCase().replace(/^kit:[^/]*\//u, "");
const tagsOf = (kit: StructureKitDef): string[] => ((kit as { ai?: { tags?: readonly string[] } }).ai?.tags ?? []).map((t) => t.toLowerCase());

/**
 * 낱말 하나가 킷에 걸리는 세기(작을수록 세다, 안 걸리면 0): 1 id 그대로 · 2 id 의 끝 토막(bd-house-cathedral ← cathedral) · 3 id 의 가운데 토막 ·
 * 4 꼬리표 · 5 이름에 든 낱말(성당 · 여관 · 시청) · 6 이름의 낱말로 끝나는 낱말(대성당 ← 성당).
 */
function strength(kit: StructureKitDef, word: string): number {
  const id = kit.id.toLowerCase();
  if (id === word) return 1;
  if (id.endsWith(`-${word}`)) return 2;
  if (id.includes(`-${word}-`)) return 3;
  if (tagsOf(kit).includes(word)) return 4;
  if (word.length < 2) return 0;
  const name = (kit.name ?? "").toLowerCase();
  if (name.includes(word)) return 5;
  const tail = name.split(/[\s·,()]+/u).some((t) => t.length >= 2 && !/[0-9×]/u.test(t) && word.length > t.length && word.endsWith(t));
  return tail ? 6 : 0;
}

/** 요청의 특징 낱말(spec.features)을 건물로 읽을 때의 세기 한도 — id 그대로이거나 id 의 끝 토막일 때만(「port」 가 fishing-port-lighthouse 를 세우지 않게). */
export const FEATURE_WORD_STRENGTH = 2;

/**
 * 청한 낱말(킷 id — 앞의 `kit:<칩셋>/` 는 떼고 — 또는 종류 낱말 한둘)에 맞는 건물 킷. 여러 낱말이면 더 많은 낱말에 걸리는 킷, 같으면 더 세게 걸리는 킷만 남긴다.
 * maxStrength = 이 세기까지만 받는다(기본 6 = 전부).
 */
export function askedBuildingKits(kits: readonly StructureKitDef[], asked: string, maxStrength = 6, any = false): StructureKitDef[] {
  const whole = norm(asked);
  if (!whole) return [];
  const words = [...new Set([whole, ...whole.split(/[\s,·]+/u)].filter(Boolean))];
  let best: StructureKitDef[] = [], bestHits = 0, bestSum = Infinity;
  for (const kit of kits) {
    if (!any && !isSeatableBuilding(kit)) continue;
    let hits = 0, sum = 0;
    for (const w of words) { const s = strength(kit, w); if (s && s <= maxStrength) { hits += 1; sum += s; } }
    if (!hits) continue;
    // 통째로 걸린 것(낱말 전체가 id·이름)은 토막 몇 개가 걸린 것보다 앞선다
    const s0 = strength(kit, whole); const key = s0 && s0 <= maxStrength ? s0 - 10 : sum / hits;
    if (hits > bestHits || (hits === bestHits && key < bestSum)) { best = [kit]; bestHits = hits; bestSum = key; }
    else if (hits === bestHits && key === bestSum) best.push(kit);
  }
  return best;
}

const nameWords = (kit: StructureKitDef): string[] => (kit.name ?? "").toLowerCase().split(/[\s·,()]+/u).filter((t) => t.length >= 2 && !/[0-9×]/u.test(t));
function editDistance(a: string, b: string): number {
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) { const next = [i]; for (let j = 1; j <= b.length; j += 1) next.push(Math.min(row[j]! + 1, next[j - 1]! + 1, row[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1))); row = next; }
  return row[b.length]!;
}

/**
 * 청한 건물의 킷 — 그대로 맞는 건물이 없어도 실제로 있는 것에 가장 가까운 건물을 준다(near = true). 거절하지 않고 세운 뒤 무엇으로 세웠는지 알린다
 * (2026-11-16 오너 «에셋을 자유롭게 쓰는 방향» — 거절은 게임이 깨질 때만).
 *  (가) 그 낱말이 걸리는 다른 킷(문이 아랫줄에 없는 건물 · 거리 블록 · 마당 딸린 시설 — 시공기가 문 앞을 못 잡는 것)이 있으면, 그 킷 이름의 낱말 가운데
 *       가장 드문 낱말을 이름에 가진 건물(「church」 → 블록 «성당 앞» → «첨탑 성당»).
 *  (나) 한두 글자 틀린 id 토막·이름 낱말(«cathedrel» → cathedral).
 * 그래도 없으면 빈 목록 — 시공기는 그 마을의 제 큰 건물을 세우고 알린다.
 */
export function nearestBuildingKits(kits: readonly StructureKitDef[], asked: string): { kits: StructureKitDef[]; near: boolean } {
  const exact = askedBuildingKits(kits, asked);
  if (exact.length) return { kits: exact, near: false };
  const seatable = kits.filter(isSeatableBuilding);
  const bySize = (list: StructureKitDef[]) => [...list].sort((a, b) => b.width * b.height - a.width * a.height || a.id.localeCompare(b.id));
  // (가) 다리가 되는 것은 문이 있는 킷(건물)뿐이다 — 소품 이름의 낱말로 건물을 고르지 않는다(«dock» 이 부두 소품을 거쳐 바위 굴을 세웠다).
  const others = askedBuildingKits(kits, asked, 6, true).filter((kit) => (kit.parts ?? []).some((p) => p.kind === "entrance"));
  if (others.length) {
    const have = new Map<string, StructureKitDef[]>(), everywhere = new Map<string, number>();
    for (const kit of seatable) for (const t of new Set(nameWords(kit))) { const list = have.get(t); if (list) list.push(kit); else have.set(t, [kit]); }
    for (const kit of kits) for (const t of new Set(nameWords(kit))) everywhere.set(t, (everywhere.get(t) ?? 0) + 1);
    // 그 킷들의 이름 낱말 가운데 칩셋 전체에서 가장 드문 것(«블록» 35 · «성당» 5 → 성당) — 그 낱말을 이름에 가진 건물
    const shared = [...new Set(others.flatMap(nameWords))].filter((t) => have.has(t)).sort((a, b) => everywhere.get(a)! - everywhere.get(b)! || have.get(a)!.length - have.get(b)!.length || a.localeCompare(b));
    if (shared.length) return { kits: bySize(have.get(shared[0]!)!).slice(0, 4), near: true };
  }
  const word = norm(asked);
  let best: StructureKitDef[] = [], bd = Infinity;
  for (const kit of seatable) {
    const tokens = [...kit.id.toLowerCase().split("-").filter((t) => t.length >= 4), ...nameWords(kit)];
    const d = Math.min(...tokens.map((t) => editDistance(word, t)), Infinity);
    if (d > (word.length <= 5 ? 1 : 2)) continue;
    if (d < bd) { best = [kit]; bd = d; } else if (d === bd) best.push(kit);
  }
  return { kits: bySize(best).slice(0, 4), near: best.length > 0 };
}

const label = (kit: StructureKitDef): string => `${kit.id} (${(kit.name ?? "").replace(/^버들항\s*/u, "")}${/×/u.test(kit.name ?? "") ? "" : ` ${kit.width}×${kit.height}`})`;

/** 조수가 읽는 건물 목록 한 줄 — 큰 것부터 n 채(청할 수 있는 건물이 무엇인지 모를 때, 모르는 이름을 적었을 때). */
export function askedBuildingMenu(kits: readonly StructureKitDef[], n = 24): string {
  return kits.filter(isSeatableBuilding).sort((a, b) => b.width * b.height - a.width * a.height || a.id.localeCompare(b.id)).slice(0, n).map(label).join(" · ");
}

/** 건물 한 채를 적는 글(id · 이름 · 크기). */
export const askedBuildingLabel = label;
