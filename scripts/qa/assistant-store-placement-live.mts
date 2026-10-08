// 실제 모델 Pi 조수가 스토어 설치 팩을 읽고 맵에 사용하는지 확인한다.
// 스토어 설치는 같은 STORE_TOOLS 경로를 쓰고, 이후에는 에디터와 같은 runPiAgent를 사용한다.
// 실행 예:
//   bun scripts/qa/assistant-store-placement-live.mts --model opencodex/gpt-6-astra --thinking high

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildModel } from "@oh-my-pi/pi-catalog/build";
import { AssetStoreClient } from "../../electron/main/assetStoreClient";
import { createMemoryRepository } from "../../src/project/persistence/memoryRepository";
import { setProjectRepositoryForTest } from "../../src/project/persistence/repository";
import { createBlankProject } from "../../src/project/defaults";
import { ensureBundledTilesets } from "../../src/project/defaults/defaultAssets";
import type { Project } from "../../src/project/types";
import { STORE_TOOLS } from "../../src/editor/tools/storeTools";
import { runTool } from "../../src/editor/tools/index";
import { buildSessionRegistryTools } from "../../src/ai/sessionToolExposure";
import { runPiAgent } from "../lib/piAgentRuntime";
import { renderMapPng, renderToolRegionPngBase64 } from "../qa-game/render.mts";
import { initLocalProjectStore, openLocalProjectStore } from "../../electron/local-store/store";
import { canonicalJsonString } from "../../src/project/persistence/core/canonicalJson";

const arg = (name: string, fallback?: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] ?? fallback : fallback;
};
const baseUrl = process.env.OPRN_STORE_TEST_URL ?? "http://100.73.251.77:18320";
const slug = process.env.OPRN_STORE_SLUG ?? "beodeulhang-jangso-bunggoe-hu-hwangpye-p-f78ef830";
const providerModel = arg("model", "opencodex/gpt-6-astra")!;
const [provider, modelId] = providerModel.split("/") as [string, string];
const thinkingLevel = arg("thinking", "high")!;
const out = path.resolve(arg("out", `verify-shots/asset-store/live-${Date.now()}`)!);
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "oprn-store-placement-live-"));
const projectDir = path.join(scratch, "project");
fs.mkdirSync(out, { recursive: true });

const cfgYaml = (Bun as unknown as { YAML: { parse(s: string): any } }).YAML.parse(
  fs.readFileSync(path.join(os.homedir(), ".omp/agent/models.yml"), "utf8"),
);
const providers = cfgYaml.providers ?? cfgYaml;
const cfgProvider = providers[provider];
const metadata = cfgProvider?.models?.find((m: { id: string }) => m.id === modelId);
if (!cfgProvider || !metadata || !cfgProvider.apiKey) throw new Error(`Configured model or credential missing: ${providerModel}`);
const model = buildModel({
  id: metadata.id, name: metadata.name, api: cfgProvider.api, provider,
  baseUrl: cfgProvider.baseUrl, reasoning: metadata.reasoning, thinking: metadata.thinking,
  input: metadata.input, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  contextWindow: metadata.contextWindow, maxTokens: metadata.maxTokens,
  compat: { ...cfgProvider.compat, ...metadata.compat },
} as never);

// Headless authoring diagnostic: UI intent classification is not exercised.
const requestedTools = [
  "get_project_summary", "get_map_region", "list_tileset_references", "read_tileset_reference",
  "list_tileset_objects", "fill_region", "stamp_object", "show_map_region", "check_reachability",
  "set_start_position",
];
const intent = {
  mode: "modify", space: "outdoor", facility: null, targetMapId: null, useSelection: false,
  clarify: null, clarifyOptions: [], needsPlan: false, resetsContext: false,
  summary: "스토어 타일셋을 읽고 황폐 필드 한 장을 시공", source: "llm", tools: requestedTools,
};

const log: string[] = [];
const trace: any[] = [];
const events: any[] = [];
const persistEvidence = () => {
  fs.writeFileSync(path.join(out, "trace.json"), JSON.stringify(trace, null, 2));
  fs.writeFileSync(path.join(out, "events.json"), JSON.stringify(events, null, 2));
};

// The production store bridge is used, with a real staging catalog and blob download.
const cache = fs.mkdtempSync(path.join(scratch, "store-cache-"));
const client = new AssetStoreClient(cache, { load: () => null, save: () => {}, persistent: () => false }, baseUrl);
const installed = () => client.installed();
globalThis.window = {
  oprn: { store: {
    catalog: ({ q = "", kind = "", grade = "", lang = "ko" } = {}) => client.catalog({ q, kind, grade, lang }),
    installed,
    install: ({ slug: requested, version } = {}) => client.install(requested, () => {}, version),
    package: ({ slug: requested } = {}) => client.packageFor(requested),
  } },
} as never;
setProjectRepositoryForTest(createMemoryRepository({ target: { kind: "local", projectDir: cache, projectId: "assistant-store-placement-live" } }));

let project = createBlankProject() as Project;
ensureBundledTilesets(project);
const search = STORE_TOOLS.find((tool) => tool.name === "store_search")!;
const install = STORE_TOOLS.find((tool) => tool.name === "store_install")!;
await search.prepare!({ query: "버들항", kind: "tileset", aiReadyOnly: true });
const searchResult = search.run(project, { query: "버들항", kind: "tileset", aiReadyOnly: true });
const selected = (searchResult.data as any)?.items?.find((item: any) => item.slug === slug) ?? (searchResult.data as any)?.items?.[0];
if (!selected?.slug) throw new Error("스토어 검색 결과에서 팩을 찾지 못했습니다.");
await install.prepare!({ slug: selected.slug }, project);
const applied = install.run(project, { slug: selected.slug });
const installedTilesetId = (applied.data as any)?.tilesets?.[0]?.id as string | undefined;
if (!installedTilesetId || !project.tilesets[installedTilesetId]) throw new Error("스토어 타일셋이 프로젝트에 심기지 않았습니다.");

const map = project.maps[project.startMapId]!;
map.name = "스토어 황폐 필드 실호출";
map.tilesetId = installedTilesetId;
// A larger canvas gives the model room for a readable route and several kits.
if (map.width < 36 || map.height < 24) {
  const resizeContext = { project };
  const resize = runTool(resizeContext, "resize_map", { mapId: map.id, width: 36, height: 24 });
  if (!resize.ok) throw new Error(`resize_map: ${resize.summary}`);
  project = resizeContext.project;
}
const beforeMap = structuredClone(project.maps[project.startMapId]);
const beforeProjectHash = canonicalJsonString(project.maps);

const store = await initLocalProjectStore({ projectDir });
if ((await store.saveProject(project)).kind !== "saved") throw new Error("seed save failed");
store.close();

const exposed = buildSessionRegistryTools({ requestText: "스토어에서 설치한 황폐 필드 타일셋으로 맵을 만들어 줘", intent: intent as never, contextWindow: metadata.contextWindow })
  .map((tool) => tool.function.name);
const task = [
  "현재 맵은 스토어에서 방금 설치한 ‘버들항 · 붕괴 후 황폐 필드’ 타일셋을 이미 사용한다.",
  "이 맵을 실제 플레이 가능한 황폐 필드로 시공하라. 빈 평지를 그대로 두지 말고 다음 순서를 지켜라:",
  "1) get_project_summary/get_map_region으로 현재 맵과 시작 위치를 확인한다.",
  "2) list_tileset_references로 현재 타일셋의 용도를 확인하고, 황폐 필드 조립 문서를 read_tileset_reference로 MD 전체와 그림까지 읽는다. 자료를 읽기 전에는 타일을 고르거나 쓰지 않는다.",
  "3) 문서에서 지정한 바닥·길의 도구와 재료로 지형을 만든다. fill_region은 라벨, paint_tiles는 문서의 번호를 쓴다. 시작점에서 걸을 수 있는 여백을 남긴다. lay_path가 4-이웃 또는 path-needs-autotile 오류를 내면 오류가 제시한 정확한 fill_region(material, path, width, layer) 호출을 그대로 재시도하고, 문서가 상위 레이어 붓을 지정하면 paint_tiles layer upper를 쓴다. 실패한 lay_path를 반복하지 않는다.",
  "4) list_spatial_designs로 이 타일셋의 물체를 확인한 뒤, 실제 목록에 있는 kit:<tilesetId>/<kitId>를 stamp_object로 최소 4개 배치한다. 폐허의 큰 표식·바위·잔해처럼 서로 다른 물체를 고르고 겹치거나 길을 막지 않는다.",
  "5) show_map_region과 check_reachability로 시각과 통행성을 다시 검사하고, 경고나 실패가 있으면 즉시 고친다. 마지막 답에는 호출한 도구와 남은 경고를 구체적으로 적는다.",
].join("\n");

const started = Date.now();
const done = await runPiAgent({
  mode: "single", provider, model: modelId, task, mapIds: [project.startMapId], currentMapId: project.startMapId,
  project, maxTurns: Number(arg("max-turns", "42")), thinkingLevel: thinkingLevel as never,
  initialToolNames: [...new Set(exposed.concat(requestedTools))], scopeStrict: true,
}, {
  model: model as never, apiKey: cfgProvider.apiKey, timeoutMs: Number(arg("timeout-ms", "900000")),
  renderToolImage: async (draft, _name, data) => renderToolRegionPngBase64(draft, data),
  onToolCall: (record) => {
    trace.push({ i: trace.length + 1, name: record.name, args: record.args, ok: record.result.ok,
      summary: String(record.result.summary ?? "").slice(0, 1200), warnings: record.result.warnings,
      data: ["read_tileset_reference", "show_map_region", "check_reachability", "list_tileset_objects"].includes(record.name) ? record.result.data : undefined });
    persistEvidence();
  },
  onEvent: (event) => {
    if (["assistant", "tool_end", "error", "execution_status", "done"].includes(event.type)) {
      const e = Object.fromEntries(Object.entries(event).filter(([key]) => ["type", "at", "id", "name", "ok", "summary", "text", "message", "durationMs", "visualCompletion"].includes(key)));
      events.push(e); persistEvidence();
      if (event.type === "assistant") log.push(`assistant: ${event.text.replace(/\n/g, " ").slice(0, 1000)}`);
      if (event.type === "tool_end") log.push(`${event.ok ? "OK" : "FAIL"} ${event.name}: ${String(event.summary).slice(0, 600)}`);
      if (event.type === "error") log.push(`ERROR: ${event.message.slice(0, 600)}`);
      fs.writeFileSync(path.join(out, "log.txt"), log.join("\n") + "\n");
    }
  },
});

project = done.project as Project;
const afterMap = project.maps[project.startMapId]!;
fs.writeFileSync(path.join(out, "draft-project.json"), JSON.stringify(project));
const image = renderMapPng(project, afterMap);
if (image.note) throw new Error(image.note);
fs.writeFileSync(path.join(out, "render.png"), image.png);

const savedStore = await openLocalProjectStore({ projectDir });
const saved = await savedStore.saveSerialized(JSON.stringify(project), savedStore.loadSnapshot()?.sha256 ?? null);
savedStore.close();
if (saved.kind !== "saved") throw new Error(`final save: ${saved.kind}`);
const reopenedStore = await openLocalProjectStore({ projectDir });
const reopened = reopenedStore.loadSnapshot()!.project as Project;
reopenedStore.close();

const changedLower = afterMap.lowerTiles.reduce((n, tile, i) => n + (tile !== beforeMap.lowerTiles[i] ? 1 : 0), 0);
const changedUpper = afterMap.upperTiles.reduce((n, tile, i) => n + (tile !== beforeMap.upperTiles[i] ? 1 : 0), 0);
const successful = (name: string) => trace.filter((row) => row.name === name && row.ok).length;
const failed = trace.filter((row) => !row.ok);
const summary = {
  realModel: true, provider, modelId, thinkingLevel, storeUrl: baseUrl, storeSlug: selected.slug,
  storeInstall: { ok: true, title: selected.title, tilesetId: installedTilesetId, installed: installed().map((item) => ({ slug: item.slug, version: item.version })) },
  projectDir, mapId: afterMap.id, mapTilesetId: afterMap.tilesetId, elapsedSeconds: +((Date.now() - started) / 1000).toFixed(1),
  calls: trace.length, failedCalls: failed, byTool: Object.fromEntries([...new Set(trace.map((row) => row.name))].map((name) => [name, trace.filter((row) => row.name === name).length])),
  requiredProofs: { referenceRead: successful("read_tileset_reference"), terrainWrites: successful("fill_region"), objectWrites: successful("stamp_object"), visualReview: successful("show_map_region"), reachability: successful("check_reachability") },
  changedCells: { lower: changedLower, upper: changedUpper },
  mapChanged: beforeProjectHash !== canonicalJsonString(project.maps),
  uiInputExercised: false,
  visualQuality: 'requires independent image review',
  savedAndReopened: canonicalJsonString(reopened.maps) === canonicalJsonString(project.maps),
  passed: failed.length === 0 && successful("read_tileset_reference") > 0 && (successful("fill_region") + successful("stamp_object")) > 0 && successful("show_map_region") > 0 && successful("check_reachability") > 0 && changedLower + changedUpper > 30 && canonicalJsonString(reopened.maps) === canonicalJsonString(project.maps),
  finalText: log.filter((line) => line.startsWith("assistant:")).slice(-1)[0] ?? "",
};
fs.writeFileSync(path.join(out, "summary.json"), JSON.stringify(summary, null, 2) + "\n");
fs.writeFileSync(path.join(out, "manifest.json"), JSON.stringify({ out, task, exposedTools: exposed, selected, applied: applied.data }, null, 2) + "\n");
console.log(JSON.stringify(summary, null, 2));
if (!summary.passed) process.exitCode = 1;
