// src/editor/workshop/workshopBake.ts
/**
 * 공방 2단계 — 고른 후보를 칩셋에 굽는다: 실내 기물은 손 도트 실내(atlas_biome_interior), 맵 기물은 정의할 때 적은 그 맵 칩셋.
 * 격자를 16px 칸으로 잘라(빈 칸은 뺀다) 30칸 폭 시트 PNG 한 장을 만들고, 굽기 자체는 project/workshopTiles.ts 가 한다.
 * 다 구우면 window 에 WORKSHOP_BAKED_EVENT 를 낸다 — 조수의 「없는 타일」 카드(aiStoreCard.ts)가 듣고 후속 요청을 보낸다.
 */
import { editorState } from "@/editor/editorState";
import { paletteStampFromKit } from "@/editor/harnessSuggestion/structureKitModel";
import { recordProjectSnapshot } from "@/editor/mapEditHistory";
import { workshopBakeSheet, workshopGridHash } from "@/harnesses/_core/workshop/bakeSheet";
import type { GateAdvice, Grid, Palette, WorkshopEnv, WorkshopItem } from "@/harnesses/_core/workshop/types";
import { ATLAS_BIOME_INTERIOR_ID, createAtlasBiomeInteriorTileset, ensureAtlasBiomeInteriorCurrent } from "@/project/defaults/atlasBiomeInterior";
import { store } from "@/project/store";
import type { ObjectSpecV1 } from "@/project/objectSpec";
import { bakedWorkshopKit, bakeWorkshopObject, workshopAssetId, workshopObjectId, type WorkshopHandKind } from "@/project/workshopTiles";
import { withInstallOwnership } from "./installOwnership";
import { WORKSHOP_BAKED_EVENT, type WorkshopBakedDetail } from "./workshopEvents";


const TILE = 16;
const KINDS: ReadonlySet<string> = new Set(["floor", "wall", "hang", "flat"]);

export { workshopGridHash };

/** 설명서 review: 사람 선택(알아서 고르기가 아니면) + 3/4 관문 조언(있으면, 미보정 1표). */
function reviewOf(options: { readonly autoPicked?: boolean; readonly gate?: GateAdvice | null }): ObjectSpecV1["review"] | undefined {
  const at = new Date().toISOString();
  const pick = options.autoPicked ? undefined : { by: "human" as const, at };
  const gate = options.gate;
  const vqa = gate && gate.kind ? { verdict: gate.state === "refer" ? "none" as const : gate.state, judge: `workshop-object-gate-advice/${gate.kind}`, calibrated: false, at } : undefined;
  return pick || vqa ? { ...(pick ? { pick } : {}), ...(vqa ? { vqa } : {}) } : undefined;
}

/** 구워 넣을 칩셋: 맵 기물은 정의할 때 적은 칩셋, 실내 기물은 손 도트 실내. */
export function workshopTargetTileset(item: WorkshopItem): string {
  return item.tilesetId ?? ATLAS_BIOME_INTERIOR_ID;
}

/** 이 후보 그림이 지금 프로젝트 칩셋에 이미 들어갔는가. */
export function isWorkshopPickBaked(item: WorkshopItem, grid: Grid): boolean {
  return bakedWorkshopKit(store.getCurrent().tilesets[workshopTargetTileset(item)], workshopObjectId(item.key), workshopGridHash(grid)) !== undefined;
}

/**
 * 칩셋에 들어간 기물을 지금 맵에 놓을 수 있게 붓에 담는다(기물 탭의 「맵에 놓기」와 같은 길: activePaletteStamp + 칠하기 도구).
 * 지금 맵이 그 칩셋을 쓰지 않으면 놓을 수 없다 — 사람이 읽는 이유를 돌려준다. 담았으면 null.
 */
export function armWorkshopStamp(item: WorkshopItem, grid: Grid): string | null {
  const project = store.getCurrent();
  const tilesetId = workshopTargetTileset(item);
  const kit = bakedWorkshopKit(project.tilesets[tilesetId], workshopObjectId(item.key), workshopGridHash(grid));
  if (!kit || kit.kind !== "section") return "아직 칩셋에 들어가지 않았어요.";
  const mapId = editorState.get().currentMapId;
  const map = mapId ? project.maps[mapId] : undefined;
  if (!map || map.tilesetId !== tilesetId) return `지금 맵은 「${project.tilesets[tilesetId]?.name ?? tilesetId}」 칩셋을 쓰지 않아요. 그 칩셋을 쓰는 맵을 열면 놓을 수 있어요.`;
  editorState.set({ activePaletteStamp: paletteStampFromKit(kit), tool: "paint" });
  return null;
}

/**
 * 고른 후보를 칩셋에 굽는다. 되돌리기 한 번으로 뺄 수 있다.
 * autoPicked = 사람이 아니라 사용자가 켠 「알아서 고르기」(조수 요청 카드)가 골랐다 — 설명서에 사람 선택(review.pick)을 적지 않는다.
 */
export function bakeWorkshopPick(item: WorkshopItem, grid: Grid, palette: Palette, env: WorkshopEnv, options: { readonly autoPicked?: boolean; readonly gate?: GateAdvice | null } = {}): WorkshopBakedDetail {
  if (!KINDS.has(item.kind)) throw new Error(`이 기물 종류(${item.kind})는 칩셋에 넣을 수 없습니다.`);
  const { sheet, cells, columns, rows } = workshopBakeSheet(grid, palette);
  const dataUrl = env.encodePng(sheet);
  const objectId = workshopObjectId(item.key);
  const tilesetId = workshopTargetTileset(item);
  if (tilesetId !== ATLAS_BIOME_INTERIOR_ID) {
    const target = store.getCurrent().tilesets[tilesetId];
    if (!target) throw new Error(`이 기물을 넣을 칩셋이 프로젝트에 없습니다: ${tilesetId}`);
    if (target.tileSize !== TILE) throw new Error(`공방 그림은 16px 칸이라 ${target.tileSize}px 칩셋에는 넣을 수 없습니다.`);
  }
  // 그 칩셋을 쓰는 맵을 조수가 쥐고 있으면 넣지 않는다(WorkshopInstallBusy) — 되돌리기 기록도 남기지 않는다.
  withInstallOwnership([tilesetId], `공방 넣기: ${item.title}`, () => {
    recordProjectSnapshot("공방 기물 칩셋에 넣기");
    store.update((draft) => {
      if (tilesetId === ATLAS_BIOME_INTERIOR_ID) {
        if (!draft.tilesets[ATLAS_BIOME_INTERIOR_ID]) draft.tilesets[ATLAS_BIOME_INTERIOR_ID] = createAtlasBiomeInteriorTileset();
        else ensureAtlasBiomeInteriorCurrent(draft, ATLAS_BIOME_INTERIOR_ID);
      }
      bakeWorkshopObject(draft, tilesetId, {
        objectId,
        title: item.title,
        description: item.description,
        kind: item.kind as WorkshopHandKind,
        columns,
        rows,
        footRows: item.footRows ?? 1,
        risePx: item.risePx ?? Math.max(0, (rows - (item.footRows ?? 1)) * TILE - item.padTop),
        use: item.use,
        gridHash: workshopGridHash(grid),
        asset: { id: workshopAssetId(dataUrl), dataUrl, width: sheet.width, height: sheet.height },
        cells,
        // 설명서(ObjectSpec): 공방 판에서 사람이 고른 후보다. 3/4 영수증은 아직 공방 굽기에 배선되지 않았다(object-gate 문서).
        provenance: { aiGenerated: true, tool: `oprn-workshop/${item.tilesetId ? "map-objects" : "interior-props"}${options.autoPicked ? "/auto-pick" : ""}` },
        // 3/4 관문 조언(1표, 미보정)은 review.vqa 에 calibrated:false 로만 남긴다 — 출구 효력 없음(관문 영수증이 아니다).
        ...(reviewOf(options) ? { review: reviewOf(options) } : {}),
      });
    }, { scope: "project", origin: "human", label: `공방 기물 칩셋에 넣기: ${item.title}` });
  });
  const detail: WorkshopBakedDetail = { objectId, title: item.title, tilesetId, kind: item.kind, columns, rows };
  window.dispatchEvent(new CustomEvent<WorkshopBakedDetail>(WORKSHOP_BAKED_EVENT, { detail }));
  return detail;
}
