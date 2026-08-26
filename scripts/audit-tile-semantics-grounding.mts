// 저작된 타일 라벨이 실제 픽셀에 근거하는지 검사한다 — 커버리지 게이트가 못 잡는 실패를 잡는다.
//
// 왜: scripts/verify-tile-semantics.mts 는 "모든 칸이 서술됐고 라벨이 다양한가"만 본다.
// 실측(2026-08-26): retro_dungeon 4행에서 커버리지 478/478 PASS 인데도 138-140(금테 붉은 카펫)이
// "타오르는 용암", 144-149(투명 배경 난간·묘비·천사상·십자가)가 전부 "바닥/벽"으로 라벨링됐다.
// 판독 노드가 인덱스 정렬을 잃거나 아트를 못 보고 지어낸 경우다. 그걸 픽셀로 반증한다.
//
// 두 가지 반증만 한다. 둘 다 오탐이 적고 근거가 픽셀에 있다.
//   A. 투명 소품 오분류 — 투명 픽셀이 25% 이상인 타일은 upper 레이어 소품이다.
//      그런 타일을 통행 가능한 바닥/지형으로 적으면 라벨이 아트를 보지 않았다는 뜻이다.
//   B. 색상어 불일치 — 라벨이 색을 명시했는데(갈색/회색/붉은/파란/흰...) 타일의 지배 색상이
//      그 색 계열이 아니면 라벨이 다른 타일을 서술하고 있다.
//
// 사용:
//   vite-node scripts/audit-tile-semantics-grounding.mts
//   vite-node scripts/audit-tile-semantics-grounding.mts --sheet retro_dungeon --rows 4-7
//   vite-node scripts/audit-tile-semantics-grounding.mts --json

import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

const COLS = 30;
const TILE = 16;
const KEY = { r: 255, g: 103, b: 139 } as const;
const KEY_TOL = 12;

const SHEETS: Record<string, string> = {
  retro_dungeon: "public/assets/easyrpg-chipset-retro-dungeon-transparent.png",
  retro_exterior: "public/assets/easyrpg-chipset-retro-exterior-transparent.png",
  retro_house: "public/assets/easyrpg-chipset-retro-house-transparent.png",
  retro_world: "public/assets/easyrpg-chipset-retro-world-transparent.png",
  ship: "public/assets/easyrpg-chipset-ship-transparent.png",
  world: "public/assets/easyrpg-chipset-world-transparent.png",
};

/** 통행 가능한 지면으로 읽히는 role — 투명 소품이 여기 오면 오분류다. */
const GROUND_ROLES = new Set(["floor", "terrain", "path", "sand", "snow", "ice", "grass", "road", "stairs", "bridge"]);

/** 라벨에 쓰이는 색상어 -> 허용 색조. hue 는 0-360, sat/val 은 0-1. */
interface ColorRule {
  readonly words: readonly string[];
  /** 픽셀이 이 색에 해당하는지 */
  readonly test: (h: number, s: number, v: number) => boolean;
}
// 저채도 팔레트와 복합 색어(분홍빛/청회색/푸른)에서 오탐이 확인됐으므로 고신뢰 색어만 남긴다.
// 실측: retro_world 0행은 스트립 대조로 정확했는데 "분홍빛 갈라진 땅"(살구색, hue~15)과
// "푸른 회색 암반"(저채도 청회색)이 색상어 규칙에 걸렸다. 판별력은 prop-as-ground 가 담당한다.
const COLOR_RULES: readonly ColorRule[] = [
  { words: ["붉은", "빨간", "적색"], test: (h, s, v) => s > 0.3 && v > 0.15 && (h < 22 || h > 335) },
  { words: ["초록", "녹색"], test: (h, s) => s > 0.2 && h >= 70 && h <= 175 },
  { words: ["노란", "황색"], test: (h, s) => s > 0.3 && h >= 38 && h <= 75 },
  { words: ["검은", "흑색"], test: (_h, _s, v) => v < 0.35 },
  { words: ["흰", "하얀", "순백", "백색"], test: (_h, s, v) => v > 0.68 && s < 0.3 },
];

function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) * 60;
    else if (max === gn) h = ((bn - rn) / d + 2) * 60;
    else h = ((rn - gn) / d + 4) * 60;
  }
  return [h, max === 0 ? 0 : d / max, max];
}

interface TileStat {
  readonly transparentRatio: number;
  readonly pixels: readonly [number, number, number][];
}

function tileStats(pngPath: string): TileStat[] {
  const png = PNG.sync.read(fs.readFileSync(pngPath));
  const out: TileStat[] = [];
  for (let slot = 0; slot < 480; slot += 1) {
    const row = Math.floor(slot / COLS), col = slot % COLS;
    const pixels: [number, number, number][] = [];
    let clear = 0;
    for (let y = 0; y < TILE; y += 1) {
      for (let x = 0; x < TILE; x += 1) {
        const i = ((row * TILE + y) * png.width + (col * TILE + x)) * 4;
        const a = png.data[i + 3]!;
        const r = png.data[i]!, g = png.data[i + 1]!, b = png.data[i + 2]!;
        const isKey = Math.abs(r - KEY.r) + Math.abs(g - KEY.g) + Math.abs(b - KEY.b) < KEY_TOL;
        if (a <= 8 || isKey) { clear += 1; continue; }
        pixels.push([r, g, b]);
      }
    }
    out.push({ transparentRatio: clear / (TILE * TILE), pixels });
  }
  return out;
}

interface Entry { index: number; label: string; role: string; passage: string; tags: string[] }

function loadEntries(sheet: string, rowRange: [number, number] | null): Entry[] {
  const dir = path.join(".omo/evidence/tile-semantics", sheet);
  if (!fs.existsSync(dir)) return [];
  const out: Entry[] = [];
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
    for (const e of JSON.parse(fs.readFileSync(path.join(dir, file), "utf8")) as Entry[]) {
      const row = Math.floor(e.index / COLS);
      if (rowRange && (row < rowRange[0] || row > rowRange[1])) continue;
      out.push(e);
    }
  }
  return out.sort((a, b) => a.index - b.index);
}

interface Violation { index: number; kind: "prop-as-ground" | "color-mismatch"; label: string; detail: string }

function auditSheet(sheet: string, rowRange: [number, number] | null): { violations: Violation[]; checked: number } {
  const stats = tileStats(SHEETS[sheet]!);
  const entries = loadEntries(sheet, rowRange);
  const violations: Violation[] = [];
  for (const e of entries) {
    const stat = stats[e.index]!;
    if (stat.pixels.length === 0) continue;

    // A. 투명 소품을 통행 가능 지면으로 적었는가
    if (stat.transparentRatio >= 0.25 && GROUND_ROLES.has(e.role) && e.passage === "passable") {
      violations.push({
        index: e.index, kind: "prop-as-ground", label: e.label,
        detail: `투명 ${(stat.transparentRatio * 100).toFixed(0)}% 인 upper 소품인데 role=${e.role} passage=passable`,
      });
    }

    // B. 라벨이 명시한 색이 타일에 실제로 있는가
    const rule = COLOR_RULES.find((r) => r.words.some((w) => e.label.includes(w)));
    if (rule) {
      let hits = 0;
      for (const [r, g, b] of stat.pixels) {
        const [h, s, v] = rgbToHsv(r, g, b);
        if (rule.test(h, s, v)) hits += 1;
      }
      const share = hits / stat.pixels.length;
      if (share < 0.08) {
        violations.push({
          index: e.index, kind: "color-mismatch", label: e.label,
          detail: `라벨의 색상어에 맞는 픽셀이 ${(share * 100).toFixed(0)}% 뿐이다 (기준 8%)`,
        });
      }
    }
  }
  return { violations, checked: entries.length };
}

function main(): void {
  const args = process.argv.slice(2);
  const asJson = args.includes("--json");
  const si = args.indexOf("--sheet");
  const ri = args.indexOf("--rows");
  const only = si >= 0 ? args[si + 1]! : null;
  const rowRange: [number, number] | null = ri >= 0 ? (args[ri + 1]!.split("-").map(Number) as [number, number]) : null;
  const targets = only ? [only] : Object.keys(SHEETS);

  const report: Record<string, { checked: number; violations: Violation[]; rate: string }> = {};
  let worst = 0;
  for (const sheet of targets) {
    if (!SHEETS[sheet]) { console.error(`알 수 없는 시트: ${sheet}`); process.exit(2); }
    const { violations, checked } = auditSheet(sheet, rowRange);
    const rate = checked > 0 ? violations.length / checked : 0;
    worst = Math.max(worst, rate);
    report[sheet] = { checked, violations, rate: `${(rate * 100).toFixed(1)}%` };
  }

  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    for (const [sheet, r] of Object.entries(report)) {
      console.log(`\n${sheet}: ${r.violations.length}/${r.checked} 위반 (${r.rate})`);
      const byRow = new Map<number, number>();
      for (const v of r.violations) {
        const row = Math.floor(v.index / COLS);
        byRow.set(row, (byRow.get(row) ?? 0) + 1);
      }
      if (byRow.size > 0) {
        console.log(`  행별: ${[...byRow.entries()].sort((a, b) => a[0] - b[0]).map(([row, n]) => `${row}행:${n}`).join(" ")}`);
      }
      for (const v of r.violations.slice(0, 12)) {
        console.log(`  ${String(v.index).padStart(3)} [${v.kind}] "${v.label}" — ${v.detail}`);
      }
      if (r.violations.length > 12) console.log(`  ... 그리고 ${r.violations.length - 12}건 더`);
    }
  }
  // 5% 를 넘으면 그 시트의 판독은 신뢰할 수 없다.
  process.exit(worst > 0.05 ? 1 : 0);
}

main();
