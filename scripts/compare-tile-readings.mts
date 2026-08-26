// 독립 판독 2인 + 출하 라벨을 타일별 판정으로 접는다.
//
// 왜 2인 합의를 기준으로 삼는가 (실측): 같은 타일을 두고 리드와 비전 자식이 각각 3분의 1쯤
// 틀렸다. 자식은 retro_house 12-17(벽 머리보)·42-44(벽판)를 맞히고 retro_exterior 179 를
// "awning" 으로 틀렸고, 리드는 179(깃발)를 맞히고 앞의 둘을 틀렸다. 한 명의 판독은 근거가 아니다.
//
// 그래서 라벨을 통째로 다시 쓰지 않는다. 2,856칸을 새 판독으로 전부 덮으면 지금 맞는 칸에
// 새 오류가 섞인다. **두 판독이 서로 합의하고 그 합의가 출하 라벨과 어긋나는 칸만** 교정
// 후보로 올린다. 갈리는 칸은 사람(감독자)이 아틀라스를 확대해 판정한다.
//
// role 을 1차 판별자로 쓰는 이유: 확인된 오류가 전부 role 수준에서 틀렸다.
// wall<-furniture(retro_house 12-17 반대 방향), roof<-decoration(179 깃발),
// water<-rock(253), fence<-decoration(265 묘비), door<-furniture(rows4-7 x cols24-29 24칸).
// 색·통행성만 보는 기존 감사가 못 잡던 층이 정확히 이 층이다.
//
// 판정 값:
//   KEEP      두 판독의 role 이 출하 role 과 같다 — 건드리지 않는다
//   FIX       두 판독이 서로 같고 출하와 다르다 — 교정 후보(근거: 독립 2인 합의)
//   SPLIT     두 판독이 서로 다르다 — 감독자 판정 필요
//   NOUN      role 은 맞지만 두 판독 명사가 출하 라벨과 글자 하나도 겹치지 않는다 — 명사 재검
//   MISSING   판독 파일이 없거나 그 칸이 비었다
//
// 사용:
//   vite-node scripts/compare-tile-readings.mts
//   vite-node scripts/compare-tile-readings.mts --sheet retro_exterior
//   vite-node scripts/compare-tile-readings.mts --verdict FIX --sheet retro_exterior

import fs from "node:fs";
import path from "node:path";
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
  readonly why?: string;
  readonly partOf?: string;
}

type Verdict = "KEEP" | "FIX" | "SPLIT" | "NOUN" | "MISSING";

interface Row {
  readonly sheet: string;
  readonly block: string;
  readonly index: number;
  readonly verdict: Verdict;
  readonly shipped: Shipped | undefined;
  readonly a: Reading | undefined;
  readonly b: Reading | undefined;
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
const BLOCKS: readonly (readonly [number, number])[] = [[0, 3], [4, 7], [8, 11], [12, 15]];
const p2 = (n: number): string => String(n).padStart(2, "0");

/** 한국어 라벨끼리 글자 2-gram 이 하나라도 겹치는지. 형태소 분석 없이 "완전히 다른 말인가"만 본다. */
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

function loadReading(sheet: string, a: number, b: number, reader: "A" | "B"): Map<number, Reading> {
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

function judge(shipped: Shipped | undefined, a: Reading | undefined, b: Reading | undefined): Verdict {
  if (!a || !b) return "MISSING";
  if (a.role !== b.role) return "SPLIT";
  // 두 판독이 role 에서 합의했다.
  if (!shipped) return "FIX"; // 출하 테이블에 없던 칸 — 판독이 물건을 봤다면 새로 채울 후보
  if (a.role !== shipped.role) return "FIX";
  // role 은 일치. 명사가 통째로 다르면 따로 본다.
  const shippedText = `${shipped.label} ${shipped.tags.join(" ")}`;
  if (!shareBigram(a.noun, shippedText) && !shareBigram(b.noun, shippedText)) return "NOUN";
  return "KEEP";
}

function main(): void {
  const args = process.argv.slice(2);
  const arg = (name: string): string | undefined => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const onlySheet = arg("--sheet");
  const onlyVerdict = arg("--verdict") as Verdict | undefined;
  const outPath = arg("--out");

  if (onlySheet && !SHEETS[onlySheet]) {
    console.error(`알 수 없는 시트: ${onlySheet}`);
    process.exit(2);
  }

  const rows: Row[] = [];
  for (const [sheet, table] of Object.entries(SHEETS)) {
    if (onlySheet && sheet !== onlySheet) continue;
    const byIndex = new Map(table.map((e) => [e.index, e]));
    for (const [a, b] of BLOCKS) {
      const block = `${p2(a)}-${p2(b)}`;
      const ra = loadReading(sheet, a, b, "A");
      const rb = loadReading(sheet, a, b, "B");
      for (let index = a * 30; index <= b * 30 + 29; index += 1) {
        rows.push({
          sheet,
          block,
          index,
          verdict: judge(byIndex.get(index), ra.get(index), rb.get(index)),
          shipped: byIndex.get(index),
          a: ra.get(index),
          b: rb.get(index),
        });
      }
    }
  }

  const tally: Record<string, number> = {};
  for (const r of rows) tally[r.verdict] = (tally[r.verdict] ?? 0) + 1;

  const lines: string[] = [];
  lines.push("# 타일 판독 판정 (독립 2인 vs 출하 라벨)");
  lines.push("");
  lines.push(`총 ${rows.length}칸 — ${Object.entries(tally).map(([k, v]) => `${k} ${v}`).join(" / ")}`);
  lines.push("");

  const shown = rows.filter((r) => (onlyVerdict ? r.verdict === onlyVerdict : r.verdict !== "KEEP" && r.verdict !== "MISSING"));
  let lastKey = "";
  for (const r of shown) {
    const key = `${r.sheet} ${r.block}`;
    if (key !== lastKey) {
      lines.push("");
      lines.push(`## ${key}`);
      lines.push("");
      lines.push("| idx | 판정 | 출하 | A | B |");
      lines.push("|---|---|---|---|---|");
      lastKey = key;
    }
    const ship = r.shipped ? `${r.shipped.label} \`${r.shipped.role}\`` : "(없음)";
    const av = r.a ? `${r.a.noun} \`${r.a.role}\`${r.a.confidence === "low" ? " (low)" : ""}` : "-";
    const bv = r.b ? `${r.b.noun} \`${r.b.role}\`${r.b.confidence === "low" ? " (low)" : ""}` : "-";
    lines.push(`| ${r.index} | ${r.verdict} | ${ship} | ${av} | ${bv} |`);
  }

  const text = lines.join("\n");
  if (outPath) {
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, `${text}\n`);
    console.log(`${outPath} 기록`);
  }
  console.log(`총 ${rows.length}칸 — ${Object.entries(tally).map(([k, v]) => `${k} ${v}`).join(" / ")}`);
  console.log(`검토 대상 ${shown.length}칸`);
}

main();
