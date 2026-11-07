// src/headless/objectGen.ts
/**
 * 화면 없이 공방으로 기물을 그려 그 칩셋에 굽는다 — 코딩 에이전트(./oprn·oprn-agent-host)의 generate_missing_object 가 쓴다.
 * 편집기 카드(aiObjectGenCard → workshopQueue)와 같은 실행기(map-objects·interior-props)·같은 엔진·같은 검수·같은 알아서 고르기·같은 굽기다.
 * 바뀐 것은 그릇뿐이다: 판 기록은 메모리, 그림 읽기·쓰기는 pngjs, 모델·그림 경로는 부르는 쪽이 넣는다(chat·referenceImage·objectGate).
 * 검수를 통과한 후보가 없으면 굽지 않고 실패로 돌려준다(관문을 낮추지 않는다).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { chooseAutoPickFrom, workshopObjectInput } from "@/harnesses/_core/workshop/autoInstall";
import { createWorkshopEngine } from "@/harnesses/_core/workshop/engine";
import { renderGrid } from "@/harnesses/_core/workshop/grid";
import { createMemoryWorkshopStore } from "@/harnesses/_core/workshop/store";
import type { ChatFn, RgbaImage, WorkshopEnv, WorkshopRound, WorkshopRunner, WorkshopTilesetSource } from "@/harnesses/_core/workshop/types";
import { createInteriorRunner } from "@/harnesses/interior-props/editor/runner";
import { createMapObjectRunner } from "@/harnesses/map-objects/editor/runner";
import { mapObjectPaletteFrom } from "@/harnesses/map-objects/editor/sheet";
import { resolveTransparentColorKeys } from "@/assets/chipsetTransparency";
import { applyTransparentColorKeys } from "@/assets/transparentColorKey";
import { BUNDLED_EASYRPG_CHIPSET_ASSETS } from "@/assets/bundled";
import { objectGenDefinition, type ObjectGenRequest } from "@/editor/workshop/objectRequest";
import { ATLAS_BIOME_INTERIOR_ID, createAtlasBiomeInteriorTileset, ensureAtlasBiomeInteriorCurrent } from "@/project/defaults/atlasBiomeInterior";
import { bakeWorkshopObject } from "@/project/workshopTiles";
import type { Project, TilesetDef } from "@/project/types";

export type HeadlessObjectGenDeps = {
  readonly publicDir: string;
  /** PNG 풀기·쓰기 — 노드 호스트가 pngjs 로 넣는다(헤드리스 ESM 번들은 CJS pngjs 를 못 묶는다). */
  readonly png: { readonly decode: (bytes: Uint8Array) => RgbaImage; readonly encode: (image: RgbaImage) => Uint8Array };
  readonly chat: ChatFn;
  readonly referenceImage?: WorkshopEnv["referenceImage"];
  /** 3/4 관문 영수증(object-gate 판정기). 있으면 검수 통과 후보도 영수증을 받아야 통과다. */
  readonly objectGate?: WorkshopEnv["objectGate"];
  readonly concurrency?: number;
  readonly log?: (line: string) => void;
};

/** 후보 하나(검수 결과와 1배 PNG) — 통과·불통과 모두 돌려준다(에이전트·보고서가 무엇이 그려졌는지 본다). */
export type HeadlessObjectGenCandidate = { readonly letter: string; readonly verdict: string; readonly codes: readonly string[]; readonly reasons: string; readonly png: string | null };

export type HeadlessObjectGenResult =
  | { readonly ok: true; readonly objectId: string; readonly tilesetId: string; readonly columns: number; readonly rows: number; readonly letter: string; readonly reason: string;
      readonly seconds: number; readonly calls: number; readonly reference: string; readonly candidates: readonly HeadlessObjectGenCandidate[]; readonly round: WorkshopRound }
  | { readonly ok: false; readonly error: string; readonly seconds: number; readonly calls: number; readonly candidates: readonly HeadlessObjectGenCandidate[]; readonly round: WorkshopRound | null };

function loaderFor(publicDir: string, decode: (bytes: Uint8Array) => RgbaImage): (url: string) => Promise<RgbaImage> {
  return async (url) => {
    const data = /^data:image\/png;base64,(.+)$/su.exec(url);
    if (data) return decode(Buffer.from(data[1]!, "base64"));
    if (/^data:/u.test(url)) throw new Error(`PNG 가 아닌 그림은 읽지 않는다: ${url.slice(0, 40)}`);
    return decode(readFileSync(join(publicDir, url.replace(/^\.?\/+/u, ""))));
  };
}

function tilesetImageUrl(project: Project, tileset: TilesetDef): string | null {
  if (tileset.image.type === "uploaded") return project.assets.uploaded[tileset.image.id]?.dataUrl ?? null;
  return BUNDLED_EASYRPG_CHIPSET_ASSETS.find((asset) => asset.textureKey === tileset.image.id)?.path ?? null;
}

/** 편집기 pixels.ts readTilesetSource 와 같은 것: 이식 없는 바탕 시트(투명색 키를 뺀 것)와 학습된 물체. */
async function tilesetSourceOf(project: Project, tilesetId: string, load: (url: string) => Promise<RgbaImage>): Promise<WorkshopTilesetSource | null> {
  const tileset = project.tilesets[tilesetId];
  const url = tileset ? tilesetImageUrl(project, tileset) : null;
  if (!tileset || !url) return null;
  const image = await load(url);
  const keys = resolveTransparentColorKeys(tileset);
  if (keys) applyTransparentColorKeys(image.data, keys);
  const objects = (tileset.structureKits ?? []).map((kit) => ({
    name: kit.name ?? kit.id,
    description: kit.ai?.description ?? "",
    layers: [kit.rows.map((row) => row.tiles), kit.rows.map((row) => row.upperTiles ?? [])],
  }));
  return { id: tileset.id, name: tileset.name, tileSize: tileset.tileSize, tilesPerRow: tileset.tilesPerRow, image, objects };
}

/**
 * 공방 요청(generate_missing_object 의 data) 하나를 그려 project 의 그 칩셋에 굽는다(project 를 고친다).
 * 실패(검수 통과 후보 없음·모델 오류·칩셋 그림 못 읽음)는 ok:false 와 이유로 돌려준다 — 대신 그린 것처럼 꾸미지 않는다.
 */
export async function runHeadlessObjectGen(project: Project, request: ObjectGenRequest, deps: HeadlessObjectGenDeps): Promise<HeadlessObjectGenResult> {
  const started = Date.now();
  const seconds = () => Math.round((Date.now() - started) / 100) / 10;
  const load = loaderFor(deps.publicDir, deps.png.decode);
  const encodePng = (image: RgbaImage): string => `data:image/png;base64,${Buffer.from(deps.png.encode(image)).toString("base64")}`;
  const sources = new Map<string, Promise<WorkshopTilesetSource | null>>();
  const env: WorkshopEnv = {
    loadImage: load,
    encodePng,
    assetUrl: (path) => path,
    tilesetSource: (id) => {
      let pending = sources.get(id);
      if (!pending) { pending = tilesetSourceOf(project, id, load); sources.set(id, pending); }
      return pending;
    },
    ...(deps.referenceImage ? { referenceImage: deps.referenceImage } : {}),
    ...(deps.objectGate ? { objectGate: deps.objectGate } : {}),
  };
  const runner: WorkshopRunner = request.harnessId === "interior-props" ? createInteriorRunner() : createMapObjectRunner();
  const store = createMemoryWorkshopStore();
  const projectKey = "headless";
  let paletteHexes: string[] = [];
  if (request.harnessId === "map-objects") {
    const source = await env.tilesetSource!(request.tilesetId);
    if (!source) return { ok: false, error: `칩셋 ${request.tilesetId} 의 그림을 읽지 못했다 — 기물을 그리지 않았다.`, seconds: seconds(), calls: 0, candidates: [], round: null };
    paletteHexes = mapObjectPaletteFrom(source, request.title, request.description);
  }
  await runner.prepare(env);
  const def = objectGenDefinition(request, new Set(runner.items([]).map((item) => item.key)), paletteHexes);
  await store.putItemDef(projectKey, def);
  const item = runner.items(await store.listItemDefs(projectKey)).find((candidate) => candidate.key === def.key);
  if (!item) return { ok: false, error: "기물 정의를 만들지 못했다.", seconds: seconds(), calls: 0, candidates: [], round: null };
  const engine = createWorkshopEngine({ runner, env, chat: deps.chat, store, projectKey, concurrency: deps.concurrency ?? 2 });
  const opened = await engine.startRound(item, deps.objectGate ? { gate: "receipt" } : {});
  deps.log?.(`objectgen: 「${request.title}」 ${opened.runs.length}장 그리는 중`);
  await engine.idle();
  engine.dispose();
  const round = (await store.getRound(opened.id)) ?? opened;
  const calls = round.runs.reduce((sum, run) => sum + run.calls, 0);
  const palette = runner.palette(item);
  const candidates: HeadlessObjectGenCandidate[] = round.runs.map((run) => ({
    letter: run.letter, verdict: run.verdict?.verdict ?? run.status, codes: run.verdict?.codes ?? [], reasons: (run.verdict?.reasons ?? run.error ?? "").slice(0, 300),
    png: run.grid ? encodePng(renderGrid(run.grid, palette)) : null,
  }));
  const choice = await chooseAutoPickFrom({ runs: round.runs, item, palette: runner.palette(item), env, chat: deps.chat, objectGenFlow: Boolean(runner.review) });
  if (!choice) {
    const why = round.runs.map((run) => `${run.letter}: ${run.status === "failed" ? run.error ?? "못 그림" : run.verdict ? `${run.verdict.verdict} ${run.verdict.codes.join(",")} ${run.verdict.reasons}`.trim() : run.status}`).join(" / ");
    return { ok: false, error: `「${request.title}」 검수를 통과한 후보가 없어 칩셋에 넣지 않았다 — ${why}`.slice(0, 600), seconds: seconds(), calls, candidates, round };
  }
  const picked = round.runs.find((run) => run.letter === choice.letter)!;
  const input = workshopObjectInput(item, picked.grid!, runner.palette(item), env, { autoPicked: true, gate: picked.gate ?? null, base: picked.base ?? null, tool: `oprn-workshop/${request.harnessId}/headless-auto-pick` });
  const tilesetId = request.harnessId === "interior-props" ? ATLAS_BIOME_INTERIOR_ID : request.tilesetId;
  if (tilesetId === ATLAS_BIOME_INTERIOR_ID) {
    if (!project.tilesets[ATLAS_BIOME_INTERIOR_ID]) project.tilesets[ATLAS_BIOME_INTERIOR_ID] = createAtlasBiomeInteriorTileset();
    else ensureAtlasBiomeInteriorCurrent(project, ATLAS_BIOME_INTERIOR_ID);
  }
  bakeWorkshopObject(project, tilesetId, input);
  return {
    ok: true, objectId: input.objectId, tilesetId, columns: input.columns, rows: input.rows, letter: choice.letter, reason: choice.reason,
    seconds: seconds(), calls, reference: round.reference?.note ?? "참고 단계 없음", candidates, round,
  };
}
