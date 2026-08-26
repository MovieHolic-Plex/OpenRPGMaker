// 샤드 저작 결과(JSON 프래그먼트)를 시맨틱 테이블 .ts 파일로 조립한다.
//
// 왜 스크립트인가: 조립은 결정론적 변환이다. 이걸 에이전트에게 맡기면 조립 단계에서
// 인덱스 누락·중복·라벨 변조가 새로 생긴다(실측: 시트 1개=노드 1개 방식은 5/5 노드가
// 산출물 0으로 끝났다). 판독(판단)만 에이전트가 하고, 조립(기계 작업)은 여기서 한다.
//
// 입력:  .omo/evidence/tile-semantics/<sheet>/rows-<a>-<b>.json
//        [{ "index": 0, "label": "...", "role": "water", "passage": "solid", "tags": ["...", "..."] }, ...]
// 출력:  src/project/defaults/tileSemantics<Sheet>.ts
//
// 연속 인덱스가 같은 (label, role, passage, tags) 를 가지면 entries([...]) 한 줄로 묶는다.
// 기존 파일(tileSemanticsDungeon.ts)의 문체를 그대로 재현한다.
//
// 사용:
//   vite-node scripts/build-tile-semantics.mts               # 프래그먼트가 있는 시트 전부
//   vite-node scripts/build-tile-semantics.mts --sheet ship

import fs from "node:fs";
import path from "node:path";

interface Entry {
  index: number;
  label: string;
  role: string;
  passage: "passable" | "solid";
  tags: string[];
}

interface SheetTarget {
  readonly id: string;
  readonly konst: string;
  readonly typeName: string;
  readonly file: string;
  readonly title: string;
  readonly textureKey: string;
}

const TARGETS: readonly SheetTarget[] = [
  { id: "retro_dungeon", konst: "RETRO_DUNGEON_TILE_SEMANTICS", typeName: "RetroDungeonTileSemanticEntry", file: "src/project/defaults/tileSemanticsRetroDungeon.ts", title: "retro_Dungeon(레트로 던전)", textureKey: "tex_easyrpg_chipset_retro_dungeon" },
  { id: "retro_exterior", konst: "RETRO_EXTERIOR_TILE_SEMANTICS", typeName: "RetroExteriorTileSemanticEntry", file: "src/project/defaults/tileSemanticsRetroExterior.ts", title: "retro_Exterior(레트로 바깥)", textureKey: "tex_easyrpg_chipset_retro_exterior" },
  { id: "retro_house", konst: "RETRO_HOUSE_TILE_SEMANTICS", typeName: "RetroHouseTileSemanticEntry", file: "src/project/defaults/tileSemanticsRetroHouse.ts", title: "retro_House(레트로 집)", textureKey: "tex_easyrpg_chipset_retro_house" },
  { id: "retro_world", konst: "RETRO_WORLD_TILE_SEMANTICS", typeName: "RetroWorldTileSemanticEntry", file: "src/project/defaults/tileSemanticsRetroWorld.ts", title: "retro_World(레트로 월드맵)", textureKey: "tex_easyrpg_chipset_retro_world" },
  { id: "ship", konst: "SHIP_TILE_SEMANTICS", typeName: "ShipTileSemanticEntry", file: "src/project/defaults/tileSemanticsShip.ts", title: "Ship(배)", textureKey: "tex_easyrpg_chipset_ship" },
  { id: "world", konst: "WORLD_TILE_SEMANTICS", typeName: "WorldTileSemanticEntry", file: "src/project/defaults/tileSemanticsWorld.ts", title: "World(월드맵)", textureKey: "tex_easyrpg_chipset_world" },
];

const FRAGMENT_ROOT = ".omo/evidence/tile-semantics";

function readFragments(sheet: string): Entry[] {
  const dir = path.join(FRAGMENT_ROOT, sheet);
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
  const all: Entry[] = [];
  for (const file of files) {
    const raw = fs.readFileSync(path.join(dir, file), "utf8");
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      throw new Error(`${sheet}/${file}: JSON 파싱 실패 — ${(error as Error).message}`);
    }
    if (!Array.isArray(parsed)) throw new Error(`${sheet}/${file}: 배열이 아니다`);
    for (const item of parsed as Entry[]) {
      if (typeof item?.index !== "number" || !item.label || !item.role || !item.passage) {
        throw new Error(`${sheet}/${file}: 엔트리 형식 오류 — ${JSON.stringify(item).slice(0, 120)}`);
      }
      all.push({
        index: item.index,
        label: String(item.label).trim(),
        role: String(item.role).trim(),
        passage: item.passage,
        tags: (item.tags ?? []).map((t) => String(t).trim()).filter(Boolean),
      });
    }
  }
  all.sort((a, b) => a.index - b.index);
  return all;
}

function quote(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/** entries() 헬퍼가 라벨을 tags 앞에 자동으로 넣으므로, 저장할 tags 에서 라벨을 뺀다. */
function tailTags(entry: Entry): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const tag of entry.tags) {
    if (tag === entry.label || seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
  }
  return out;
}

function groupKey(entry: Entry): string {
  return [entry.label, entry.role, entry.passage, tailTags(entry).join("\u0001")].join("\u0000");
}

function buildBody(entries: Entry[]): string {
  const lines: string[] = [];
  let i = 0;
  let currentRow = -1;
  while (i < entries.length) {
    const key = groupKey(entries[i]!);
    const group: Entry[] = [entries[i]!];
    let j = i + 1;
    while (j < entries.length && groupKey(entries[j]!) === key) {
      group.push(entries[j]!);
      j += 1;
    }
    const first = group[0]!;
    const row = Math.floor(first.index / 30);
    if (row !== currentRow) {
      currentRow = row;
      lines.push("");
      lines.push(`  // ── ${row}행 (인덱스 ${row * 30}-${row * 30 + 29}) ${"─".repeat(Math.max(0, 46 - String(row).length))}`);
    }
    const tags = tailTags(first).map(quote).join(", ");
    if (group.length === 1) {
      lines.push(`  one(${first.index}, ${quote(first.label)}, ${quote(first.role)}, ${quote(first.passage)}, [${tags}]),`);
    } else {
      const idx = group.map((e) => e.index).join(", ");
      lines.push(`  ...entries([${idx}], ${quote(first.label)}, ${quote(first.role)}, ${quote(first.passage)}, [${tags}]),`);
    }
    i = j;
  }
  return lines.join("\n").replace(/^\n/, "");
}

function renderFile(target: SheetTarget, entries: Entry[]): string {
  const distinct = new Set(entries.map((e) => e.label)).size;
  const body = buildBody(entries);
  // 쓰지 않는 헬퍼는 내보내지 않는다 — noUnusedLocals 가 켜져 있어 타입체크가 깨진다.
  const usesEntries = body.includes("...entries([");
  const usesOne = body.includes("  one(");
  const entriesHelper = usesEntries
    ? `
function entries(
  indexes: readonly number[],
  label: string,
  role: string,
  passage: "passable" | "solid",
  tags: readonly string[]
): ${target.typeName}[] {
  return indexes.map((index) => ({ index, label, role, passage, tags: [label, ...tags] }));
}
`
    : "";
  const oneHelper = usesOne
    ? `
function one(
  index: number,
  label: string,
  role: string,
  passage: "passable" | "solid",
  tags: readonly string[]
): ${target.typeName} {
  return { index, label, role, passage, tags: [label, ...tags] };
}
`
    : "";
  return `// ${target.title} 칩셋(${target.textureKey}) 타일 그림판의 AI 검색용 큐레이션 시맨틱 테이블.
// 6x 업스케일 행 스트립(.omo/evidence/chipset-strips/${target.id}/row-00..15.png) 전수 판독으로 작성했다.
// tileSemanticsDungeon.ts / tileSemanticsInterior.ts 와 동일한 계약: tileset.tileMeta[] 와 별개로
// 관리되는 검색 전용 데이터다. 통행성/레이어 계약은 tilesetHarness 가, 타일별 정밀 라벨은 여기가 담당한다.
//
// 좌표 규약: 30타일/행, ID = 행×30 + 열. 아트가 없는 슬롯(완전 투명 또는 분홍 컬러키 단색)은
// 서술할 대상이 없으므로 엔트리를 만들지 않는다 — scripts/verify-tile-semantics.mts 가 픽셀에서
// 그 목록을 직접 구해 커버리지를 검증한다.
// 판독이 애매한 타일은 단정 대신 형태 서술을 쓰고 "판독보류" 태그를 남겼다(실내 465~467 전례).
//
// 실측: 도화 가능 ${entries.length}칸 전수 서술, 고유 라벨 ${distinct}개.
// 조립: scripts/build-tile-semantics.mts (수기 편집 대신 이 스크립트로 재생성한다).

import type { CombinedTownTileSemanticEntry } from "./tileSemanticsCombinedTown";

export type ${target.typeName} = CombinedTownTileSemanticEntry;
${entriesHelper}${oneHelper}
export const ${target.konst}: readonly ${target.typeName}[] = [
${body}
];
`;
}

function main(): void {
  const args = process.argv.slice(2);
  const sheetIdx = args.indexOf("--sheet");
  const only = sheetIdx >= 0 ? args[sheetIdx + 1] : null;
  const targets = only ? TARGETS.filter((t) => t.id === only) : TARGETS;
  if (targets.length === 0) {
    console.error(`알 수 없는 시트: ${only}. 가능: ${TARGETS.map((t) => t.id).join(", ")}`);
    process.exit(2);
  }

  let built = 0;
  for (const target of targets) {
    const entries = readFragments(target.id);
    if (entries.length === 0) {
      console.log(`${target.id}: 프래그먼트 없음 — 건너뜀`);
      continue;
    }
    const seen = new Set<number>();
    const dupes: number[] = [];
    for (const entry of entries) {
      if (seen.has(entry.index)) dupes.push(entry.index);
      seen.add(entry.index);
    }
    if (dupes.length > 0) {
      console.error(`${target.id}: 프래그먼트에 중복 인덱스 ${dupes.length}개 — ${[...new Set(dupes)].slice(0, 20).join(", ")}`);
      process.exit(1);
    }
    fs.writeFileSync(target.file, renderFile(target, entries), "utf8");
    const distinct = new Set(entries.map((e) => e.label)).size;
    console.log(`${target.id}: ${entries.length} entries, ${distinct} distinct labels -> ${target.file}`);
    built += 1;
  }
  console.log(`built ${built}/${targets.length} sheets`);
}

main();
