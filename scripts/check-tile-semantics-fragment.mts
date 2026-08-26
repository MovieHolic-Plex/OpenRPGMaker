// 샤드 저작자가 자기 JSON 프래그먼트를 스스로 검사하는 게이트.
//
// 왜: 조립(build-tile-semantics.mts)은 프래그먼트를 신뢰한다. 프래그먼트 단계에서
// 인덱스 누락·중복·범위 이탈을 잡지 못하면 6개 시트를 다 조립한 뒤에야 실패가 드러난다.
// 샤드 하나당 바이너리 PASS/FAIL 을 여기서 낸다.
//
// 사용:
//   vite-node scripts/check-tile-semantics-fragment.mts --sheet ship --rows 0-3

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

const COLS = 30;
const TILE = 16;
const KEY_COLOR = { r: 255, g: 103, b: 139 } as const;
const KEY_TOLERANCE = 12;

const SHEET_PNG: Record<string, string> = {
  retro_dungeon: "public/assets/easyrpg-chipset-retro-dungeon-transparent.png",
  retro_exterior: "public/assets/easyrpg-chipset-retro-exterior-transparent.png",
  retro_house: "public/assets/easyrpg-chipset-retro-house-transparent.png",
  retro_world: "public/assets/easyrpg-chipset-retro-world-transparent.png",
  ship: "public/assets/easyrpg-chipset-ship-transparent.png",
  world: "public/assets/easyrpg-chipset-world-transparent.png",
};

function artlessSlots(pngPath: string): Set<number> {
  const png = PNG.sync.read(fs.readFileSync(pngPath));
  const out = new Set<number>();
  for (let slot = 0; slot < 480; slot += 1) {
    const row = Math.floor(slot / COLS);
    const col = slot % COLS;
    let opaque = false;
    let allKey = true;
    for (let y = 0; y < TILE; y += 1) {
      for (let x = 0; x < TILE; x += 1) {
        const i = ((row * TILE + y) * png.width + (col * TILE + x)) * 4;
        if (png.data[i + 3]! <= 8) continue;
        opaque = true;
        const d = Math.abs(png.data[i]! - KEY_COLOR.r) + Math.abs(png.data[i + 1]! - KEY_COLOR.g) + Math.abs(png.data[i + 2]! - KEY_COLOR.b);
        if (d >= KEY_TOLERANCE) allKey = false;
      }
    }
    if (!opaque || allKey) out.add(slot);
  }
  return out;
}

function main(): void {
  const args = process.argv.slice(2);
  const sheet = args[args.indexOf("--sheet") + 1];
  const rows = args[args.indexOf("--rows") + 1];
  if (!sheet || !SHEET_PNG[sheet] || !rows || !/^\d+-\d+$/.test(rows)) {
    console.error("사용: --sheet <id> --rows <a-b>   예: --sheet ship --rows 0-3");
    process.exit(2);
  }
  const [rowA, rowB] = rows.split("-").map(Number) as [number, number];
  const lo = rowA * COLS;
  const hi = rowB * COLS + COLS - 1;

  const file = path.join(".omo/evidence/tile-semantics", sheet, `rows-${String(rowA).padStart(2, "0")}-${String(rowB).padStart(2, "0")}.json`);
  const failures: string[] = [];
  if (!fs.existsSync(file)) {
    console.error(`FAIL ${sheet} rows ${rows}: 파일 없음 — ${file}`);
    process.exit(1);
  }
  let data: unknown;
  try {
    data = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    console.error(`FAIL ${sheet} rows ${rows}: JSON 파싱 실패 — ${(error as Error).message}`);
    process.exit(1);
  }
  if (!Array.isArray(data)) {
    console.error(`FAIL ${sheet} rows ${rows}: 최상위가 배열이 아니다`);
    process.exit(1);
  }

  const artless = artlessSlots(SHEET_PNG[sheet]!);
  const expected = new Set<number>();
  for (let i = lo; i <= hi; i += 1) if (!artless.has(i)) expected.add(i);

  const seen = new Map<number, number>();
  const labels = new Map<string, number>();
  data.forEach((raw, position) => {
    const entry = raw as { index?: unknown; label?: unknown; role?: unknown; passage?: unknown; tags?: unknown };
    if (typeof entry.index !== "number") { failures.push(`[${position}] index 가 숫자가 아니다`); return; }
    seen.set(entry.index, (seen.get(entry.index) ?? 0) + 1);
    if (entry.index < lo || entry.index > hi) failures.push(`index ${entry.index} 는 담당 범위 ${lo}-${hi} 밖이다`);
    if (artless.has(entry.index)) failures.push(`index ${entry.index} 는 아트가 없는 슬롯이라 엔트리를 만들면 안 된다`);
    const label = typeof entry.label === "string" ? entry.label.trim() : "";
    if (!label) failures.push(`index ${entry.index}: label 이 비었다`);
    else labels.set(label, (labels.get(label) ?? 0) + 1);
    if (typeof entry.role !== "string" || !entry.role.trim()) failures.push(`index ${entry.index}: role 이 비었다`);
    if (entry.passage !== "passable" && entry.passage !== "solid") failures.push(`index ${entry.index}: passage 는 "passable" 또는 "solid" 여야 한다 (현재 ${JSON.stringify(entry.passage)})`);
    if (!Array.isArray(entry.tags) || entry.tags.length < 2) failures.push(`index ${entry.index}: tags 가 2개 미만이다`);
  });

  const dupes = [...seen.entries()].filter(([, n]) => n > 1).map(([i]) => i);
  if (dupes.length > 0) failures.push(`중복 인덱스: ${dupes.join(", ")}`);
  const missing = [...expected].filter((i) => !seen.has(i)).sort((a, b) => a - b);
  if (missing.length > 0) failures.push(`미커버 ${missing.length}칸: ${missing.join(", ")}`);
  const worst = [...labels.entries()].sort((a, b) => b[1] - a[1])[0];
  if (worst && worst[1] > 12) failures.push(`라벨 "${worst[0]}" 가 이 샤드에서 ${worst[1]}칸 — 한 샤드 안에서는 12칸을 넘기지 않는다`);
  const minLabels = Math.max(8, Math.floor(expected.size / 10));
  if (labels.size < minLabels) failures.push(`고유 라벨 ${labels.size} < ${minLabels} — 서술이 뭉개졌다`);

  // 근거 감사 — 커버리지가 맞아도 라벨이 아트를 안 본 경우를 픽셀로 반증한다.
  // 실측(2026-08-26): retro_dungeon 0-3행은 커버리지 PASS 인데 투명 소품을 통행 가능 바닥으로 적은
  // 위반이 48건이었다(138-140 금테 붉은 카펫 -> "타오르는 용암", 144-149 묘비/천사상 -> "바닥/벽").
globalThis.grounding = spawnSync(process.execPath, [
    path.join("node_modules", "vite-node", "vite-node.mjs"),
    "scripts/audit-tile-semantics-grounding.mts", "--sheet", sheet, "--rows", `${rowA}-${rowB}`,
  ], { encoding: "utf8" });
globalThis.groundingOut = `${grounding.stdout ?? ""}${grounding.stderr ?? ""}`;
  if (grounding.status === 1) {
globalThis.lines = groundingOut.split(/\r?\n/).filter((l) => /\[(prop-as-ground|color-mismatch)\]|위반/.test(l));
    failures.push(`근거 감사 실패 — 라벨이 아트와 어긋난다:\n      ${lines.slice(0, 14).join("\n      ")}`);
  } else if (grounding.status !== 0) {
    failures.push(`근거 감사를 실행하지 못했다 (exit ${grounding.status}): ${groundingOut.slice(0, 200)}`);
  }

  if (failures.length > 0) {
    console.error(`FAIL ${sheet} rows ${rows} (${seen.size}/${expected.size} covered)`);
    for (const f of failures.slice(0, 40)) console.error(`  - ${f}`);
    process.exit(1);
  }
  console.log(`PASS ${sheet} rows ${rows}: ${expected.size}/${expected.size} covered, ${labels.size} distinct labels, max ${worst?.[1] ?? 0} tiles per label`);
  process.exit(0);
}

main();
