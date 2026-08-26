// 판정을 시맨틱 프래그먼트로 굽는다. compare-tile-readings.mts 와 같은 판정 규칙을 쓴다.
//
// 정책: **출하 라벨을 기본값으로 두고, 독립 2인이 합의해 뒤집은 칸만 교체한다.**
// 2,856칸을 새 판독으로 통째로 덮지 않는 이유는 지금 맞는 칸에 새 오류를 섞지 않기 위해서다.
//
//   FIX     두 판독의 role 이 서로 같고 출하와 다르다 -> 판독을 채택
//   KEEP    두 판독 role 이 출하와 같다 -> 출하 유지
//   NOUN    role 은 같고 명사만 완전히 다르다 -> 출하 유지(정보량 하락 방지), 보고서에만 남긴다
//   SPLIT   두 판독이 갈린다 -> 출하 유지, 감독자가 고배율로 판정할 목록에 올린다
//   MISSING 판독이 없다 -> 출하 유지
//
// --overrides 로 감독자 판정 파일을 얹는다. 이 파일이 최우선이다(사람이 확대해 확인한 칸).
//   [{ "sheet": "retro_exterior", "index": 179, "label": "붉은 깃발 상단", "role": "decoration",
//      "passage": "solid", "tags": ["깃발", "banner"] }]
//
// 출력: .omo/evidence/tile-semantics/<sheet>/rows-<a>-<b>.json  (build-tile-semantics.mts 입력)
//
// 사용:
//   vite-node scripts/apply-tile-verdicts.mts
//   vite-node scripts/apply-tile-verdicts.mts --sheet retro_exterior --overrides .omo/evidence/tile-reaudit/overrides.json

import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import { RETRO_EXTERIOR_TILE_SEMANTICS } from "../src/project/defaults/tileSemanticsRetroExterior";
import { RETRO_HOUSE_TILE_SEMANTICS } from "../src/project/defaults/tileSemanticsRetroHouse";
import { RETRO_WORLD_TILE_SEMANTICS } from "../src/project/defaults/tileSemanticsRetroWorld";
import { RETRO_DUNGEON_TILE_SEMANTICS } from "../src/project/defaults/tileSemanticsRetroDungeon";
import { SHIP_TILE_SEMANTICS } from "../src/project/defaults/tileSemanticsShip";
import { WORLD_TILE_SEMANTICS } from "../src/project/defaults/tileSemanticsWorld";

interface Shipped {
  readonly index: number;
  readonly label: string;
  readonly role: string;
  readonly passage: "passable" | "solid";
  readonly tags: readonly string[];
}
interface Reading {
  readonly index: number;
  readonly noun: string;
  readonly role: string;
  readonly passage: string;
  readonly confidence: string;
  readonly partOf?: string;
}
interface Override {
  readonly sheet: string;
  readonly index: number;
  readonly label: string;
  readonly role: string;
  readonly passage: "passable" | "solid";
  readonly tags?: readonly string[];
}
interface Out {
  index: number;
  label: string;
  role: string;
  passage: "passable" | "solid";
  tags: string[];
}

const SHEETS: Record<string, readonly Shipped[]> = {
  retro_dungeon: RETRO_DUNGEON_TILE_SEMANTICS as readonly Shipped[],
  retro_exterior: RETRO_EXTERIOR_TILE_SEMANTICS as readonly Shipped[],
  retro_house: RETRO_HOUSE_TILE_SEMANTICS as readonly Shipped[],
  retro_world: RETRO_WORLD_TILE_SEMANTICS as readonly Shipped[],
  ship: SHIP_TILE_SEMANTICS as readonly Shipped[],
  world: WORLD_TILE_SEMANTICS as readonly Shipped[],
};

const READ_ROOT = ".omo/evidence/tile-reaudit/read";
const OUT_ROOT = ".omo/evidence/tile-semantics";
const BASELINE_ROOT = ".omo/evidence/tile-reaudit/baseline";

/**
 * 버전 기준은 얼려둔 스냅샷이 우선이다.
 * .ts 테이버을 그대로 쓰면 build-tile-semantics 가 그 테이버을 덮어쓴 다음부터
 * 자기 산출물을 기준으로 삼게 되어(FIX 0 / KEEP 폭등) 진단이 무엇도 가리키지 않는다.
 */
function shippedTable(sheet: string, fallback: readonly Shipped[]): readonly Shipped[] {
  const snap = path.join(BASELINE_ROOT, `${sheet}.json`);
  if (!fs.existsSync(snap)) return fallback;
  try {
    const parsed = JSON.parse(fs.readFileSync(snap, "utf8")) as Shipped[];
    if (Array.isArray(parsed) && parsed.length) return parsed;
  } catch { /* 스냅샷이 깨졌으면 조용하게 테이물로 돌아간다 */ }
  return fallback;
}
const BLOCKS: readonly (readonly [number, number])[] = [[0, 3], [4, 7], [8, 11], [12, 15]];
const p2 = (n: number): string => String(n).padStart(2, "0");

// 픽셀이 사실상 같은 시트 묶음 — 같은 인덱스는 같은 그림이므로 판독을 합쳐 쓴다.
// 실측(480x256 전수 대조): retro_exterior vs retro_house 는 RGB 차이 0.4%.
// 묶으면 한 칸에 최대 4명의 독립 판독이 모이고, 2인으로는 갈리던 칸이 다수결로 정리된다.
// combined_town 은 3% 차이라 넣지 않는다 — 그 정도면 실제로 다른 타일이 섞인다.
const DUPLICATE_GROUPS: readonly (readonly string[])[] = [["retro_exterior", "retro_house"]];

function groupOf(sheet: string): readonly string[] {
  return DUPLICATE_GROUPS.find((g) => g.includes(sheet)) ?? [sheet];
}

/**
 * 판독자 role 어회는 18가지지만 기존 테이버은 44가지를 쓴다.
 * 그래서 role 을 단순 부드으로 바꾸면 궜재하지만 더 자상한 라벨이 거친 라벨로 덮인다.
 * 실측: sand->terrain 49칸, coast->water 36칸, forest->tree 26칸, statue->prop 19칸,
 * pillar->prop 13칸. 이건 교정이 아니라 정보 손실이다 — 모래배은 지형이 맞고,
 * 물가는 물이 맞고, 석상은 소품이 맞다. 다만 전자가 더 정밀하다.
 *
 * 그래서 기존 role 이 판독 role 의 하위 개념이면 기존것을 살린다.
 * 반대로 하위 개념 관계가 아닌 변경(예: chest -> cliff)은 그대로 교정 후보로 남긴다.
 */
const SPECIALIZATIONS: Record<string, readonly string[]> = {
  water: ["coast", "ice", "lava"],
  terrain: ["sand", "snow", "path", "mountain", "ice", "lava", "forest", "grass", "dirt"],
  floor: ["path", "bridge", "counter", "sand"],
  wall: ["pillar", "awning"],
  prop: ["statue", "chest", "barrel", "crate", "torch", "sign", "shelf", "machine", "rope", "ladder", "banner", "ship", "town-icon", "pillar"],
  decoration: ["banner", "sign", "statue", "town-icon", "awning", "animation", "torch"],
  tree: ["forest"],
  plant: ["forest", "tree"],
  furniture: ["bed", "shelf", "counter", "chest", "barrel"],
  rock: ["mountain", "cliff", "stone"],
  cliff: ["mountain", "rock"],
  fence: ["gate", "rope"],
  gate: ["fence", "door"],
  stairs: ["ladder"],
  roof: ["awning"],
};

/** 기존 role 이 판독 role 의 더 자상한 변종인가. */
function isSpecializationOf(shippedRole: string, readRole: string): boolean {
  return (SPECIALIZATIONS[readRole] ?? []).includes(shippedRole);
}

/**
 * 자상한 기존 role 을 살려도 되는가.
 *
 * 그냥 살렸다가 한 번 담기다(실측): 중복 시트 다수결이 같은 role 을 가리키는데
 * 한쪽 표는 "sand"(보존), 다른 표는 "prop"(교정->terrain) 이라 끝나서 같은 그림이
 * 서로 다른 role 을 유지했다. 재유도 표 합치도가 86.2% -> 72.4% 로 떨어졌다.
 *
 * 자상함을 살려준다는 건 기존 라벨을 및는다는 뜻이다. 그런데 이 테이버들은
 * 서로 24.5% 만 일치한다 — 한 칸에 대해 둘 다 맞을 수는 없다. 무조건 및으면 지어낸
 * 라벨을 "자상하니까" 로 보존하게 된다.
 *
 * 그래서 보존은 **다른 중복 시트가 같은 말을 해 줌 때만** 한다. 시트 간 일치는
 * 판독자 간 일치와 마찬가지로 독립적인 백업이다. 단독 시트는 대조할 상대가 없으므로
 * 덜 파괴적인 보존을 기본으로 둔다.
 */
function specializationIsCorroborated(
  sheet: string,
  index: number,
  shippedRole: string,
  tables: Record<string, Map<number, Shipped>>,
): boolean {
  const group = groupOf(sheet);
  if (group.length < 2) return true; // 단독 시트: 대조할 상대가 없으니 보존
  for (const other of group) {
    if (other === sheet) continue;
    const peer = tables[other]?.get(index);
    if (!peer) continue;
    if (peer.role === shippedRole) return true;
    if (isSpecializationOf(peer.role, shippedRole) || isSpecializationOf(shippedRole, peer.role)) return true;
  }
  return false;
}

// 칩셋 PNG — "도화 가능" 여부를 사람 잡었던 상수가 아니라 그림에서 직접 으다.
const SHEET_PNG: Record<string, string> = {
  retro_dungeon: "public/assets/easyrpg-chipset-retro-dungeon-transparent.png",
  retro_exterior: "public/assets/easyrpg-chipset-retro-exterior-transparent.png",
  retro_house: "public/assets/easyrpg-chipset-retro-house-transparent.png",
  retro_world: "public/assets/easyrpg-chipset-retro-world-transparent.png",
  ship: "public/assets/easyrpg-chipset-ship-transparent.png",
  world: "public/assets/easyrpg-chipset-world-transparent.png",
};

/**
 * 그려진 것이 없는 칸은 타일 테이므로 라벨을 내지 않는다.
 * 토파지 오토타임이 아니라 재보다: 불통젔 픽셀이 하나도 없거나 전부 키색이면 번 칸이다.
 * 이 산식은 test/tileSemanticsSixChipsets.test.ts 의 drawable 상수
 * (478/478/478/480/464/478) 와 6시트 모다 일치한다 — 상수를 보고 맞춘 게 아니라
 * 그림에서 유도해 우연힐 일이 없지 않은 일치다.
 */
const imgCache = new Map<string, PNG | null>();
function sheetImage(sheet: string): PNG | null {
  if (imgCache.has(sheet)) return imgCache.get(sheet)!;
  const file = SHEET_PNG[sheet];
  const img = file && fs.existsSync(file) ? PNG.sync.read(fs.readFileSync(file)) : null;
  imgCache.set(sheet, img);
  return img;
}

/**
 * 두 시트의 같은 인덱스가 정말 같은 그림인가.
 *
 * 중복 시트라도 전부 같지는 않다. retro_exterior/retro_house 는 전체로는 RGB 차이 0.4% 인데,
 * 그 0.4% 가 실제로 몇몇 칸을 다른 그림으로 만든다 — 예를 들어 116 은 한쪽이 78픽셀만 칠해져
 * 있고 다른 쪽은 256픽셀 전부가 칠해져 있다. 시트 단위로 판독을 합치면 그런 칸에서
 * **서로 다른 그림을 본 판독을 한 표로 섞는다**(실제로 116 에서 창문 3표 대 문 2표가 섞였다).
 * 그래서 합치는 단위는 시트가 아니라 타일이다.
 */
const sameTileCache = new Map<string, boolean>();
function sameTileAcrossSheets(a: string, b: string, slot: number): boolean {
  const key = `${a}|${b}|${slot}`;
  const hit = sameTileCache.get(key);
  if (hit !== undefined) return hit;
  const A = sheetImage(a);
  const B = sheetImage(b);
  let same = A !== null && B !== null && A.width === B.width;
  if (same && A && B) {
    const r0 = Math.floor(slot / 30) * 16;
    const c0 = (slot % 30) * 16;
    outer: for (let y = 0; y < 16; y += 1) {
      for (let x = 0; x < 16; x += 1) {
        const i = ((r0 + y) * A.width + (c0 + x)) * 4;
        const aClear = A.data[i + 3]! <= 8;
        const bClear = B.data[i + 3]! <= 8;
        if (aClear && bClear) continue;
        if (aClear !== bClear || A.data[i] !== B.data[i] || A.data[i + 1] !== B.data[i + 1] || A.data[i + 2] !== B.data[i + 2]) {
          same = false;
          break outer;
        }
      }
    }
  }
  sameTileCache.set(key, same);
  return same;
}

function drawableSlots(sheet: string): Set<number> {
  const file = SHEET_PNG[sheet];
  const out = new Set<number>();
  if (!file || !fs.existsSync(file)) {
    for (let i = 0; i < 480; i += 1) out.add(i);
    return out;
  }
  const img = PNG.sync.read(fs.readFileSync(file));
  for (let slot = 0; slot < 480; slot += 1) {
    const row0 = Math.floor(slot / 30) * 16;
    const col0 = (slot % 30) * 16;
    let painted = false;
    for (let y = 0; y < 16 && !painted; y += 1) {
      for (let x = 0; x < 16; x += 1) {
        const i = ((row0 + y) * img.width + (col0 + x)) * 4;
        if (img.data[i + 3]! <= 8) continue;
        const keyed = Math.abs(img.data[i]! - 255) + Math.abs(img.data[i + 1]! - 103) + Math.abs(img.data[i + 2]! - 139) < 12;
        if (!keyed) { painted = true; break; }
      }
    }
    if (painted) out.add(slot);
  }
  return out;
}

function shareBigram(x: string, y: string): boolean {
  const grams = (s: string): Set<string> => {
    const cleaned = s.replace(/[\s()[\]{}·,.-]/g, "");
    const out = new Set<string>();
    for (let i = 0; i + 1 < cleaned.length; i += 1) out.add(cleaned.slice(i, i + 2));
    if (cleaned.length === 1) out.add(cleaned);
    return out;
  };
  const gx = grams(x);
  for (const g of grams(y)) if (gx.has(g)) return true;
  return false;
}

function loadReading(sheet: string, a: number, b: number, reader: "A" | "B" | "C"): Map<number, Reading> {
  const file = path.join(READ_ROOT, sheet, `rows-${p2(a)}-${p2(b)}.${reader}.json`);
  if (!fs.existsSync(file)) return new Map();
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as Reading[];
    if (!Array.isArray(parsed)) return new Map();
    return new Map(parsed.filter((e) => typeof e?.index === "number").map((e) => [e.index, e]));
  } catch {
    return new Map();
  }
}

/** 판독 결과에서 라벨·태그를 만든다. 더 구체적인(긴) 명사를 쓰고, partOf 를 태그로 남긴다. */
function majorityRole(votes: readonly Reading[]): { role: string; backers: Reading[] } | null {
  const byRole = new Map<string, Reading[]>();
  for (const v of votes) {
    const list = byRole.get(v.role) ?? [];
    list.push(v);
    byRole.set(v.role, list);
  }
  const ranked = [...byRole.entries()].sort((x, y) => y[1].length - x[1].length);
  const top = ranked[0];
  if (!top || top[1].length < 2) return null;
  const second = ranked[1];
  if (second && second[1].length === top[1].length) return null;
  return { role: top[0], backers: top[1] };
}

function fromReadings(index: number, backers: readonly Reading[]): Out {
  const sorted = [...backers].sort((x, y) => y.noun.length - x.noun.length);
  const noun = sorted[0]!.noun;
  const tags: string[] = [];
  const push = (t: string | undefined): void => {
    const v = (t ?? "").trim();
    if (v && v !== noun && !tags.includes(v)) tags.push(v);
  };
  push(sorted[0]!.role);
  for (const b of sorted.slice(1)) push(b.noun);
  for (const b of sorted) push(b.partOf);
  const solid = backers.filter((b) => b.passage === "solid").length;
  const passage: "passable" | "solid" = solid * 2 >= backers.length ? "solid" : "passable";
  return { index, label: noun, role: sorted[0]!.role, passage, tags: tags.slice(0, 4) };
}

function main(): void {
  const args = process.argv.slice(2);
  const arg = (name: string): string | undefined => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const onlySheet = arg("--sheet");
  const overridePath = arg("--overrides");

  const overrides = new Map<string, Override>();
  if (overridePath && fs.existsSync(overridePath)) {
    const list = JSON.parse(fs.readFileSync(overridePath, "utf8")) as Override[];
    for (const o of list) overrides.set(`${o.sheet}:${o.index}`, o);
  }

  // 시트 간 대조를 위해 기준선 표를 전부 먼저 만든다.
  const shippedTables: Record<string, Map<number, Shipped>> = {};
  for (const [s2, src2] of Object.entries(SHEETS)) {
    shippedTables[s2] = new Map(shippedTable(s2, src2).map((e) => [e.index, e]));
  }

  const tally: Record<string, number> = { KEEP: 0, FIX: 0, NOUN: 0, SPLIT: 0, MISSING: 0, OVERRIDE: 0 };
  const splits: string[] = [];
  const lows: string[] = [];

  // 시트별로 자기 판독을 모아 둔다. 합치는 건 소모 지점에서 한다 — 타일 단위로 확인해서.
  const own = new Map<string, Reading[]>();
  const poolSheets = new Set<string>();
  for (const s of Object.keys(SHEETS)) for (const g of groupOf(s)) poolSheets.add(g);
  for (const sheet of poolSheets) {
    for (const [ra, rb] of BLOCKS) {
      for (const reader of ["A", "B", "C"] as const) {
        for (const [index, entry] of loadReading(sheet, ra, rb, reader)) {
          const key = `${sheet}:${index}`;
          const list = own.get(key) ?? [];
          list.push(entry);
          own.set(key, list);
        }
      }
    }
  }

  /**
   * 한 칸에 썰 판독을 모은다: 자기 시트 판독 + 그 타일이 픽셀까지 같은 형제 시트의 판독.
   * 시트 단위로 합치면 0.4% 어긋나는 칸에서 서로 다른 그림의 판독이 한 표로 섞인다.
   */
  function votesFor(sheet: string, index: number): Reading[] {
    const list = [...(own.get(`${sheet}:${index}`) ?? [])];
    for (const peer of groupOf(sheet)) {
      if (peer === sheet) continue;
      if (!sameTileAcrossSheets(sheet, peer, index)) continue;
      list.push(...(own.get(`${peer}:${index}`) ?? []));
    }
    return list;
  }

  for (const [sheet, shippedSource] of Object.entries(SHEETS)) {
    if (onlySheet && sheet !== onlySheet) continue;
    const table = shippedTable(sheet, shippedSource);
    const byIndex = new Map(table.map((e) => [e.index, e]));
    const drawable = drawableSlots(sheet);
    const dir = path.join(OUT_ROOT, sheet);
    fs.mkdirSync(dir, { recursive: true });

    for (const [ra, rb] of BLOCKS) {
      const out: Out[] = [];

      for (let index = ra * 30; index <= rb * 30 + 29; index += 1) {
        if (!drawable.has(index)) continue; // 번 칸 — 라벨을 내지 않는다
        const ship = byIndex.get(index);
        const votes = votesFor(sheet, index);
        const keep = (): Out => ({
          index,
          label: ship?.label ?? "빈 슬롯",
          role: ship?.role ?? "empty",
          passage: ship?.passage ?? "passable",
          tags: [...(ship?.tags ?? [])],
        });

        const ov = overrides.get(`${sheet}:${index}`);
        if (ov) {
          tally.OVERRIDE! += 1;
          out.push({ index, label: ov.label, role: ov.role, passage: ov.passage, tags: [...(ov.tags ?? [])] });
          continue;
        }
        if (votes.length < 2) {
          tally.MISSING! += 1;
          out.push(keep());
          continue;
        }
        const win = majorityRole(votes);
        if (!win) {
          tally.SPLIT! += 1;
          splits.push(`${sheet} ${index}: ${votes.map((v) => `${v.noun}(${v.role})`).join(" | ")} 출하=${ship?.label ?? "-"}(${ship?.role ?? "-"})`);
          out.push(keep());
          continue;
        }
        const specOk = ship !== undefined
          && isSpecializationOf(ship.role, win.role)
          && specializationIsCorroborated(sheet, index, ship.role, shippedTables);
        if (ship && (win.role === ship.role || specOk)) {
          const shippedText = `${ship.label} ${ship.tags.join(" ")}`;
          if (win.backers.some((v) => shareBigram(v.noun, shippedText))) {
            // 명사가 겹친다 = 기존 라벨이 그림을 맞혔다는 독립적 백업이다. 그대로 둔다.
            tally.KEEP! += 1;
            out.push(keep());
            continue;
          }
          // role 은 맞는데 명사가 전혀 다른 경우(NOUN).
          //
          // 전에는 "정보량 하락 방지"를 이유로 기존 명사를 살렸다. 그건 기존 명사가
          // 그림에서 유량되었다가 가정해야 성립하는 판단이다. 그 가정은 깨졌다:
          // 픽셀이 99.6% 같은 두 시트의 기존 표가 label 에서 **0.0%** 일치했다(478칸 전부).
          // 같은 그림을 도 표가 명사 하나도 같게 적지 못했다는 건 명사가 그림에서 오지 않았다는 뜻이다.
          // 그러므로 그림을 직접 본 판독자의 명사를 추토한다. role 은 이밌 일치하니 바뀌지 않는다.
          tally.NOUN! += 1;
          const adopted = fromReadings(index, win.backers);
          out.push({ ...adopted, role: ship.role, passage: ship.passage });
          continue;
        }
        tally.FIX! += 1;
        if (win.backers.every((v) => v.confidence === "low")) {
          lows.push(`${sheet} ${index}: ${win.backers.map((v) => v.noun).join("/")} (${win.role}) 출하=${ship?.label ?? "-"}`);
        }
        out.push(fromReadings(index, win.backers));
      }

      fs.writeFileSync(path.join(dir, `rows-${p2(ra)}-${p2(rb)}.json`), `${JSON.stringify(out, null, 1)}\n`);
    }
    console.log(`${sheet}: 프래그먼트 4개 -> ${dir}`);
  }

  console.log(Object.entries(tally).map(([k, v]) => `${k} ${v}`).join(" / "));
  if (splits.length) {
    // --sheet 로 한 시트만 돌리면 그 시트 결과만 담긴 파일에 쓴다.
    // 전체 목록에 덮어쓰면 다른 시트의 보류 목록이 조용히 사라진다(실제로 사라졌다).
    const p = onlySheet
      ? `.omo/evidence/tile-reaudit/splits-${onlySheet}.txt`
      : ".omo/evidence/tile-reaudit/splits.txt";
    fs.writeFileSync(p, `${splits.join("\n")}\n`);
    console.log(`갈린 칸 ${splits.length} -> ${p} (고배율 판정 필요)`);
  }
  if (lows.length) {
    const p = ".omo/evidence/tile-reaudit/low-confidence-fixes.txt";
    fs.writeFileSync(p, `${lows.join("\n")}\n`);
    console.log(`저신뢰 교정 ${lows.length} -> ${p}`);
  }
}

main();
