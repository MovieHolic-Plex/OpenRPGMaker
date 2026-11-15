// test/storeExitGate.test.ts
//
// 공식 번들 게시기의 스토어 출구 칸 검사(scripts/store/storeExitGate.mts)의 계약.
// 왜 (2026-11-15): 번들 게시기(publish-bundle · publish-buildings)는 번들 시트를 통째로 싣는데 올리기 전 검사가 매니페스트 형식과
// 제3자 이름만 봤다. 오너의 상시 규칙 «Fable 5.2 그림은 오너 면제로 번들에 굽고 스토어에는 올리지 않는다» 를 코드가 아니라
// «돌리지 않는 것» 이 지키고 있었다. 여기서 고정하는 것: 스토어 출구가 열리지 않은 오너 면제 칸이 든 시트는 거절(어느 묶음 몇 칸인지 말한다),
// 깨끗한 시트는 통과. 2026-11-15 부터 통과하는 칸은 셋이다 — 기준선 · 관문 통과 기록 · 스토어 출구를 적은 오너 면제 묶음.
// 출구 규칙은 흉내 내지 않고 진짜 것을 쓴다 — 임시 폴더에 면제 묶음·기준선을 놓고 passingCellIndex 가 그것을 읽게 한다.
// 출구를 넓히는 것도 진짜 길(`object-gate owner-waive-extend` 가 부르는 extendOwnerWaiver)로 한다: Fable 묶음은 넓어지고, Fable 이 아닌 오너 묶음은 거절된다.
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PNG } from "pngjs";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { StoreAssetKind, StorePackManifest } from "@/assetStore/format";

type Gate = typeof import("../scripts/store/storeExitGate.mts");
type Cells = typeof import("@/harnesses/object-gate/node/cells");
type Extend = typeof import("@/harnesses/object-gate/node/waiverExtend");
type Baseline = typeof import("@/harnesses/object-gate/node/baseline");

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
const TO_OPEN = tile(200, 200, 40), OWNER_ONLY = tile(40, 200, 200);
const BATCH = "fable-test-beodeul-2026-11-15";
/** 시험 안에서 스토어 출구를 넓힐 Fable 묶음과, 넓혀지면 안 되는 Fable 아닌 오너 묶음. */
const FABLE_TO_OPEN = "fable-test-open-2026-11-15", OWNER_BATCH = "owner-test-stairs-2026-11-15";
const OWNER_SAYS = "스토어는 니가 좀 알아서해라.... 거절이 너무 빡센게 문젠거같은데 흠 .... Fable 이 만든거는 좀 쉽게 통과시키고싶음.";
const saved = { data: process.env.OBJECT_GATE_DATA, key: process.env.OBJECT_GATE_HOLD_KEY };
let dir = "";
let gate: Gate;
let cells: Cells;
let waiverExtend: Extend;
let baseline: Baseline;
const batchFile = (id: string) => join(dir, "waivers", `${id}.json`);
const writeBatch = (id: string, sha: string, rgba: Uint8Array) => writeFileSync(batchFile(id), JSON.stringify({
  schema: "oprn-object-gate-owner-waiver/1", id, owner: "구워도 되고 앞으로는 전부 오너 면제다", decidedAt: "2026-11-15", recordedBy: "test", contexts: ["bundle", "shared"],
  items: [{ pixelSha256: sha, kind: "container", label: `beodeul_city/${id}`, width: TILE, height: TILE, cells: cells.receiptCells(TILE, TILE, rgba) }],
}));
/** `object-gate owner-waive-extend` 가 부르는 바로 그 함수(cli.ts 는 인자를 넘기고 결과를 찍을 뿐이다). */
const extend = (batch: string, owner: string | undefined = OWNER_SAYS, contexts = "store") =>
  waiverExtend.extendOwnerWaiver({ batch, contexts, owner, decidedAt: "2026-11-15", recordedBy: "test — 감독이 전한 오너의 말" }).code;

beforeAll(async () => {
  // 관문 기록 폴더는 모듈을 읽을 때 정해진다 — 임시 폴더를 가리킨 뒤에 읽는다. 서명 열쇠는 없는 경로로 둔다(읽지 않는다).
  dir = mkdtempSync(join(tmpdir(), "store-exit-gate-"));
  process.env.OBJECT_GATE_DATA = dir;
  process.env.OBJECT_GATE_HOLD_KEY = join(dir, "no-such-key");
  vi.resetModules();
  cells = await import("@/harnesses/object-gate/node/cells");
  gate = await import("../scripts/store/storeExitGate.mts");
  waiverExtend = await import("@/harnesses/object-gate/node/waiverExtend");
  baseline = await import("@/harnesses/object-gate/node/baseline");
  // 오너 면제 묶음 셋(모두 번들·공용 출구만으로 시작): WAIVED(끝까지 스토어가 안 열린다) · TO_OPEN(시험에서 넓힌다) · OWNER_ONLY(Fable 이 아니다).
  // 기준선: CLEAN · ALSO_CLEAN 칸.
  mkdirSync(join(dir, "waivers"), { recursive: true });
  writeBatch(BATCH, "a".repeat(64), WAIVED);
  writeBatch(FABLE_TO_OPEN, "b".repeat(64), TO_OPEN);
  writeBatch(OWNER_BATCH, "c".repeat(64), OWNER_ONLY);
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

describe("오너 면제의 스토어 출구 넓히기 — object-gate owner-waive-extend", () => {
  it("넓히기 전에는 Fable 묶음의 칸도 스토어 출구에서 걸린다", () => {
    expect(gate.storeExitSheetReports(packOf(sheetPng([CLEAN, TO_OPEN])))).toMatchObject([{ uncovered: 1, waived: { [FABLE_TO_OPEN]: 1 } }]);
  });

  it("오너의 말 없이는 넓히지 못한다", () => {
    expect(() => extend(FABLE_TO_OPEN, "  ")).toThrow("--owner");
    expect(JSON.parse(readFileSync(batchFile(FABLE_TO_OPEN), "utf8")).extensions).toBeUndefined();
  });

  it("Fable 묶음은 오너의 말과 함께 스토어 출구가 넓어지고, 그 칸이 든 시트는 통과한다", () => {
    expect(extend(FABLE_TO_OPEN)).toBe(0);
    const batch = JSON.parse(readFileSync(batchFile(FABLE_TO_OPEN), "utf8"));
    // 묶음 머리(처음 오너의 말 · 기본 출구)는 그대로이고, 넓힘 기록이 제 오너 문장을 따로 든다.
    expect(batch.contexts).toEqual(["bundle", "shared"]);
    expect(batch.extensions).toEqual([{ contexts: ["store"], owner: OWNER_SAYS, decidedAt: "2026-11-15", recordedBy: "test — 감독이 전한 오너의 말" }]);
    expect(cells.passingCellIndex("store").has(cells.cellHash(TILE, TO_OPEN)!)).toBe(true);
    expect(gate.storeExitSheetReports(packOf(sheetPng([CLEAN, TO_OPEN, ALSO_CLEAN])))).toEqual([]);
    // 같은 출구를 다시 넓혀도 기록이 겹치지 않는다.
    expect(extend(FABLE_TO_OPEN)).toBe(0);
    expect(JSON.parse(readFileSync(batchFile(FABLE_TO_OPEN), "utf8")).extensions).toHaveLength(1);
  });

  it("스토어 출구가 열리지 않은 묶음의 칸은 여전히 거절이다 — 다른 묶음이 열려 있어도", () => {
    const reports = gate.storeExitSheetReports(packOf(sheetPng([TO_OPEN, WAIVED])));
    expect(reports).toMatchObject([{ uncovered: 1, waived: { [BATCH]: 1 }, unreceipted: 0 }]);
    expect(gate.storeExitProblems(reports)[0]).toContain(`스토어 출구가 열리지 않은 오너 면제 칸 1개(${BATCH} 1)`);
  });

  it("Fable 이 아닌 오너 묶음은 스토어 출구로 넓히지 못한다", () => {
    expect(extend(OWNER_BATCH)).toBe(3);
    expect(JSON.parse(readFileSync(batchFile(OWNER_BATCH), "utf8")).extensions).toBeUndefined();
    expect(cells.passingCellIndex("store").has(cells.cellHash(TILE, OWNER_ONLY)!)).toBe(false);
    expect(gate.storeExitSheetReports(packOf(sheetPng([OWNER_ONLY])))).toMatchObject([{ uncovered: 1, waived: { [OWNER_BATCH]: 1 } }]);
  });

  it("없는 묶음 · 모르는 출구는 거절한다", () => {
    expect(extend("fable-no-such-batch")).toBe(3);
    expect(extend(FABLE_TO_OPEN, OWNER_SAYS, "everywhere")).toBe(3);
  });
});

describe("기준선 만들기 — object-gate baseline 의 순수 부분", () => {
  it("시트들의 비지 않은 칸 해시를 겹치지 않게 모으고, 그 커밋에 없던 시트는 건너뛴다", () => {
    const built = baseline.baselineFromSheets([
      { path: "public/a.png", png: sheetPng([CLEAN, ALSO_CLEAN]) },
      { path: "public/b.png", png: sheetPng([CLEAN, UNKNOWN]) },
      { path: "public/c.png", png: null },
    ]);
    expect(built.hashes).toEqual([cells.cellHash(TILE, CLEAN)!, cells.cellHash(TILE, ALSO_CLEAN)!, cells.cellHash(TILE, UNKNOWN)!].sort());
    expect(built.sheets).toEqual([{ path: "public/a.png", cells: 2, fresh: 2 }, { path: "public/b.png", cells: 2, fresh: 1 }, { path: "public/c.png", missing: true }]);
  });

  it("파일의 설명 줄(#)은 기준선으로 읽히지 않고, 해시 줄만 읽힌다", () => {
    const built = baseline.baselineFromSheets([{ path: "public/a.png", png: sheetPng([CLEAN]) }]);
    const lines = baseline.baselineFileText(built.hashes, built.sheets).split("\n").filter(Boolean);
    expect(lines.filter((line) => /^[0-9a-f]{16}$/.test(line))).toEqual(built.hashes);
    expect(lines.filter((line) => !/^[0-9a-f]{16}$/.test(line)).every((line) => line.startsWith("#"))).toBe(true);
    expect(lines.join("\n")).toContain(baseline.BASELINE_COMMIT);
  });
});
