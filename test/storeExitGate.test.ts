// test/storeExitGate.test.ts
//
// 공식 번들 게시기의 스토어 출구 칸 검사(scripts/store/storeExitGate.mts)의 계약.
// 왜 (2026-11-15): 번들 게시기(publish-bundle · publish-buildings)는 번들 시트를 통째로 싣는데 올리기 전 검사가 매니페스트 형식과
// 제3자 이름만 봤다. 오너의 상시 규칙 «Fable 5.2 그림은 오너 면제로 번들에 굽고 스토어에는 올리지 않는다» 를 코드가 아니라
// «돌리지 않는 것» 이 지키고 있었다. 여기서 고정하는 것: 오너 면제 칸이 든 시트는 거절(어느 묶음 몇 칸인지 말한다), 깨끗한 시트는 통과.
// 출구 규칙은 흉내 내지 않고 진짜 것을 쓴다 — 임시 폴더에 면제 묶음·기준선을 놓고 passingCellIndex 가 그것을 읽게 한다.
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PNG } from "pngjs";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { StoreAssetKind, StorePackManifest } from "@/assetStore/format";

type Gate = typeof import("../scripts/store/storeExitGate.mts");
type Cells = typeof import("@/harnesses/object-gate/node/cells");

const TILE = 16;
/** 한 칸(16×16)을 한 색으로 채운 RGBA. 색이 다르면 칸 해시가 다르다. */
const tile = (r: number, g: number, b: number): Uint8Array => {
  const data = new Uint8Array(TILE * TILE * 4);
  for (let i = 0; i < data.length; i += 4) { data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255; }
  return data;
};
/** 칸들을 가로로 이어 붙인 시트 PNG. */
const sheetPng = (tiles: readonly Uint8Array[]): Uint8Array => {
  const png = new PNG({ width: TILE * tiles.length, height: TILE });
  tiles.forEach((data, col) => {
    for (let y = 0; y < TILE; y += 1) for (let x = 0; x < TILE; x += 1) {
      const s = (y * TILE + x) * 4, d = (y * png.width + col * TILE + x) * 4;
      png.data[d] = data[s]!; png.data[d + 1] = data[s + 1]!; png.data[d + 2] = data[s + 2]!; png.data[d + 3] = data[s + 3]!;
    }
  });
  return new Uint8Array(PNG.sync.write(png));
};
const packOf = (bytes: Uint8Array, kind: StoreAssetKind = "chipset") => {
  const sha = createHash("sha256").update(bytes).digest("hex");
  const manifest: StorePackManifest = {
    schema: "oprn-store-pack/1", title: "시험 번들", summary: "", description: "", tags: [], kind: "tileset", license: "OPRN-GAME", aiGenerated: true, credits: "",
    content: { assets: { sheet: { id: "sheet", name: "시험 시트", kind, blob: sha, mime: "image/png", meta: { width: TILE, height: TILE, tileSize: TILE } } }, tilesets: {} },
    previews: [], blobs: [{ sha256: sha, mime: "image/png", bytes: bytes.byteLength }],
  };
  return { manifest, blobs: new Map([[sha, bytes]]) };
};

const WAIVED = tile(200, 40, 40), CLEAN = tile(40, 200, 40), ALSO_CLEAN = tile(40, 40, 200), UNKNOWN = tile(120, 120, 120);
const BATCH = "fable-test-beodeul-2026-11-15";
const saved = { data: process.env.OBJECT_GATE_DATA, key: process.env.OBJECT_GATE_HOLD_KEY };
let dir = "";
let gate: Gate;
let cells: Cells;

beforeAll(async () => {
  // 관문 기록 폴더는 모듈을 읽을 때 정해진다 — 임시 폴더를 가리킨 뒤에 읽는다. 서명 열쇠는 없는 경로로 둔다(읽지 않는다).
  dir = mkdtempSync(join(tmpdir(), "store-exit-gate-"));
  process.env.OBJECT_GATE_DATA = dir;
  process.env.OBJECT_GATE_HOLD_KEY = join(dir, "no-such-key");
  vi.resetModules();
  cells = await import("@/harnesses/object-gate/node/cells");
  gate = await import("../scripts/store/storeExitGate.mts");
  // 오너 면제 묶음 하나: WAIVED 그림(번들·공용 출구만). 기준선: CLEAN · ALSO_CLEAN 칸.
  mkdirSync(join(dir, "waivers"), { recursive: true });
  writeFileSync(join(dir, "waivers", `${BATCH}.json`), JSON.stringify({
    schema: "oprn-object-gate-owner-waiver/1", id: BATCH, owner: "구워도 되고 앞으로는 전부 오너 면제다", decidedAt: "2026-11-15", recordedBy: "test", contexts: ["bundle", "shared"],
    items: [{ pixelSha256: "a".repeat(64), kind: "container", label: "beodeul_city/test-crate", width: TILE, height: TILE, cells: cells.receiptCells(TILE, TILE, WAIVED) }],
  }));
  writeFileSync(join(dir, "baseline-cells.txt"), `${cells.cellHash(TILE, CLEAN)}\n${cells.cellHash(TILE, ALSO_CLEAN)}\n`);
});

afterAll(() => {
  if (saved.data === undefined) delete process.env.OBJECT_GATE_DATA; else process.env.OBJECT_GATE_DATA = saved.data;
  if (saved.key === undefined) delete process.env.OBJECT_GATE_HOLD_KEY; else process.env.OBJECT_GATE_HOLD_KEY = saved.key;
  if (dir) rmSync(dir, { recursive: true, force: true });
});

describe("번들 게시기의 스토어 출구 칸 검사", () => {
  it("시험 자료가 진짜 출구 규칙을 탄다 — 오너 면제 칸은 번들 출구를 지나고 스토어 출구는 지나지 못한다", () => {
    const hash = cells.cellHash(TILE, WAIVED)!;
    expect(cells.passingCellIndex("bundle").has(hash)).toBe(true);
    expect(cells.passingCellIndex("store").has(hash)).toBe(false);
  });

  it("오너 면제 칸이 든 시트는 거절하고, 어느 묶음의 몇 칸인지 말한다", () => {
    const reports = gate.storeExitSheetReports(packOf(sheetPng([CLEAN, WAIVED, ALSO_CLEAN])));
    expect(reports).toEqual([{ asset: "시험 시트", uncovered: 1, waived: { [BATCH]: 1 }, unreceipted: 0, examples: ["#1(1,0)"] }]);
    const problems = gate.storeExitProblems(reports);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("스토어 출구(3/4 관문)를 통과하지 못한 칸 1개");
    expect(problems[0]).toContain(`오너 면제 칸 1개(${BATCH} 1)`);
    expect(problems[0]).toContain("이 검사를 끄는 깃발은 없다");
  });

  it("깨끗한 시트(모든 칸이 기준선·스토어 출구 통과 기록에 있다)는 통과한다", () => {
    const reports = gate.storeExitSheetReports(packOf(sheetPng([CLEAN, ALSO_CLEAN])));
    expect(reports).toEqual([]);
    expect(gate.storeExitProblems(reports)).toEqual([]);
  });

  it("면제 묶음에도 없는 새 칸은 따로 센다 — 면제 칸과 섞여도", () => {
    const reports = gate.storeExitSheetReports(packOf(sheetPng([UNKNOWN, WAIVED, CLEAN])));
    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({ uncovered: 2, waived: { [BATCH]: 1 }, unreceipted: 1 });
    expect(gate.storeExitProblems(reports)[0]).toContain("면제 묶음에도 없는 칸 1개");
  });

  it("맵에 깔리지 않는 그림(캐릭터 시트)은 에이전트 제출과 같이 이 관문을 받지 않는다", () => {
    expect(gate.storeExitSheetReports(packOf(sheetPng([WAIVED]), "charset"))).toEqual([]);
  });
});
