/**
 * 스토어 출구의 칸 검사 — 공식 번들 게시기(publish-bundle.mts · publish-buildings.mts)가 올리기 전에 부른다.
 *
 * 왜 (2026-11-15): 에이전트 제출 경로(agentStore.mts checkPack)는 맵에 깔리는 시트의 비지 않은 칸이 전부 기준선 또는
 * `passingCellIndex("store")` 에 있어야 통과한다. 번들 게시기는 번들 시트를 통째로 싣는데도 매니페스트 형식과 제3자 이름만 봤다.
 * 오너 면제 그림이 스토어로 나가는지를 이 경로에서는 코드가 아니라 «돌리지 않는 것» 이 지키고 있었다.
 * 그래서 같은 검사를 여기서도 한다: 스토어 출구를 통과하지 못한 칸이 하나라도 있으면 게시를 거절하고,
 * 몇 칸이 어느 면제 묶음(waivers/<id>.json)의 것인지 말한다. `--dry` · `--target plan` 도 같은 거절을 본다.
 * 통과하는 칸(2026-11-15): ① 기준선(baseline-cells.txt — 관문이 생기기 전부터 번들 시트에 있던 칸) ② 관문을 통과한 기록의 칸
 * ③ 스토어 출구를 적은 오너 면제 묶음의 칸(src/harnesses/_core/objectGate/receipt.ts ownerWaiverApplies). 걸리는 것은 그 셋이 아닌 칸뿐이다.
 * 이 게시기에 규칙을 푸는 깃발은 없다 — 올리려면 그 칸을 `object-gate` 로 판정받거나, 그 묶음에 스토어 출구를 연 오너의 말이 기록돼야 한다.
 *
 * 판정은 영수증·면제 기록만 읽는다(모델 호출 없음, 네트워크 없음).
 */
import { PNG } from "pngjs";
import { STORE_TILE_SIZE, type StoreAssetKind, type StorePackManifest } from "../../src/assetStore/format";
import type { ObjectGateOwnerWaiverBatch, ObjectGateReceipt } from "../../src/harnesses/_core/objectGate";
import { passingCellIndex, readBaseline, uncoveredSheetCells } from "../../src/harnesses/object-gate/node/cells";
import { listOwnerWaiverBatches } from "../../src/harnesses/object-gate/node/store";

/** 3/4 관문(AGENTS.md hard rule)을 받아야 하는 에셋 종류: 맵에 깔리는 타일·기물 시트. agentStore.mts 와 같은 집합을 쓴다. */
export const STORE_GATED_KINDS: ReadonlySet<StoreAssetKind> = new Set(["chipset", "tileset"]);

export interface StoreExitGateDeps {
  /** 기준선 칸 해시(baseline-cells.txt). */
  readonly baseline: Set<string>;
  /** 스토어 출구를 통과한 칸 해시 — `passingCellIndex("store")`. 오너 면제 칸은 그 묶음이 스토어 출구를 적었을 때만 든다. */
  readonly passing: Map<string, ObjectGateReceipt>;
  /** 오너 면제 묶음 — 걸린 칸이 어느 묶음의 것인지 말하는 데만 쓴다(통과 여부는 passing 이 정한다). */
  readonly waiverBatches: readonly ObjectGateOwnerWaiverBatch[];
}

export interface StoreExitSheetReport {
  readonly asset: string;
  /** 스토어 출구를 통과하지 못한 칸 수(기준선에도 통과 기록에도 없는 비지 않은 칸). */
  readonly uncovered: number;
  /** 걸린 칸 가운데 오너 면제 묶음(스토어 출구가 열리지 않은 것)의 것: 묶음 id → 칸 수. */
  readonly waived: Readonly<Record<string, number>>;
  /** 걸린 칸 가운데 어느 면제 묶음에도 없는 것(판정 기록이 없거나 store 출구에서 떨어진 칸). */
  readonly unreceipted: number;
  readonly examples: readonly string[];
}

/** 저장소의 관문 기록에서 읽는다(harness-data/object-gate — OBJECT_GATE_DATA 로 바꿀 수 있다). */
export function storeExitGateDeps(): StoreExitGateDeps {
  return { baseline: readBaseline(), passing: passingCellIndex("store"), waiverBatches: listOwnerWaiverBatches() };
}

type Pack = { readonly manifest: StorePackManifest; readonly blobs: ReadonlyMap<string, Uint8Array> };

/** 팩의 맵용 시트마다 스토어 출구를 통과하지 못한 칸을 센다. 걸린 칸이 없는 시트는 내지 않는다. */
export function storeExitSheetReports(pack: Pack, deps: StoreExitGateDeps = storeExitGateDeps()): StoreExitSheetReport[] {
  const batchOf = new Map<string, string>();
  for (const batch of deps.waiverBatches) for (const item of batch.items) {
    for (const hash of item.cells?.[String(STORE_TILE_SIZE)] ?? []) if (!batchOf.has(hash)) batchOf.set(hash, batch.id);
  }
  const reports: StoreExitSheetReport[] = [];
  for (const asset of Object.values(pack.manifest.content.assets)) {
    if (asset.mime !== "image/png" || !STORE_GATED_KINDS.has(asset.kind)) continue;
    const bytes = pack.blobs.get(asset.blob);
    if (!bytes) { reports.push({ asset: asset.name, uncovered: 0, waived: {}, unreceipted: 0, examples: ["시트 그림(blob)이 팩에 없다"] }); continue; }
    const image = PNG.sync.read(Buffer.from(bytes));
    const data = new Uint8Array(image.data.buffer, image.data.byteOffset, image.data.length);
    const uncovered = uncoveredSheetCells({ width: image.width, height: image.height, data, tileSize: STORE_TILE_SIZE }, deps.baseline, deps.passing);
    if (uncovered.length === 0) continue;
    const waived: Record<string, number> = {};
    let unreceipted = 0;
    for (const cell of uncovered) {
      const batch = batchOf.get(cell.hash);
      if (batch) waived[batch] = (waived[batch] ?? 0) + 1; else unreceipted += 1;
    }
    reports.push({ asset: asset.name, uncovered: uncovered.length, waived, unreceipted, examples: uncovered.slice(0, 5).map((cell) => `#${cell.index}(${cell.col},${cell.row})`) });
  }
  return reports;
}

/** 올리기 전 검사 문장(빈 배열 = 통과). 게시기는 이 문장이 하나라도 있으면 아무것도 보내지 않고 끝난다. */
export function storeExitProblems(reports: readonly StoreExitSheetReport[]): string[] {
  return reports.map((report) => {
    if (report.uncovered === 0) return `${report.asset}: ${report.examples.join(" ")}`;
    const batches = Object.entries(report.waived).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    const waivedTotal = batches.reduce((sum, [, count]) => sum + count, 0);
    const parts: string[] = [];
    if (waivedTotal > 0) parts.push(`스토어 출구가 열리지 않은 오너 면제 칸 ${waivedTotal}개(${batches.map(([id, count]) => `${id} ${count}`).join(" · ")})`);
    if (report.unreceipted > 0) parts.push(`면제 묶음에도 없는 칸 ${report.unreceipted}개(판정 기록이 없거나 store 출구에서 떨어졌다)`);
    return `${report.asset}: 스토어 출구(3/4 관문)를 통과하지 못한 칸 ${report.uncovered}개 — ${parts.join(", ")}. 예: ${report.examples.join(" ")}. `
      + "오너 면제는 그 묶음에 스토어 출구를 연 오너의 말이 기록돼 있을 때만 스토어로 나간다(`object-gate owner-waive-extend` — Fable 묶음만). "
      + "그 밖의 칸은 `npm run harness -- object-gate final-review` 로 판정받아 store 출구를 통과시킨다(이 검사를 끄는 깃발은 없다).";
  });
}
