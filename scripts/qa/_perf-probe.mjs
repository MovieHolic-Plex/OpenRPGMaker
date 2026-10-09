
// 진단 전용(커밋하지 않는다): 실제 프로젝트에서 편집기 저장/부팅 비용을 경로별로 분리한다.
// 원본 DB/프로젝트는 건드리지 않는다. 실행: node scripts/qa/_perf-probe.mjs <project.json> <label>
import { chromium } from "playwright";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";

const fixturePath = process.argv[2];
const label = process.argv[3] ?? "run";
if (!fixturePath) throw new Error("usage: node scripts/qa/_perf-probe.mjs <project.json> <label>");
const port = process.env.DEV_SERVER_PORT ?? "9820";
const base = `http://127.0.0.1:${port}`;
const outDir = "verify-shots/editor-perf-fix";
mkdirSync(outDir, { recursive: true });

const project = JSON.parse(readFileSync(fixturePath, "utf8"));
const browser = await chromium.launch({ args: ["--no-sandbox", "--use-gl=swiftshader", "--disable-gpu"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(String(e)));
await page.addInitScript((seed) => { window.__OPRN_E2E_PROJECT__ = seed; window.localStorage.clear(); }, project);

const bootStart = Date.now();
await page.goto(base, { waitUntil: "domcontentloaded" });
await page.waitForSelector("[data-testid='edit-canvas']", { timeout: 180000 });
const bootMs = Date.now() - bootStart;
await page.waitForTimeout(4000);

const result = await page.evaluate(async () => {
  const [actions, storeMod, stateMod, historyMod, draftsMod, canonMod, digestMod, mirrorMod, ioMod, serMod, patchMod, vaultMod] = await Promise.all([
    import(/* @vite-ignore */ "/src/editor/actions.ts"),
    import(/* @vite-ignore */ "/src/project/store.ts"),
    import(/* @vite-ignore */ "/src/editor/editorState.ts"),
    import(/* @vite-ignore */ "/src/editor/mapEditHistory.ts"),
    import(/* @vite-ignore */ "/src/project/eventDrafts.ts"),
    import(/* @vite-ignore */ "/src/project/persistence/core/canonicalJson.ts"),
    import(/* @vite-ignore */ "/src/project/persistence/core/contentDigest.ts"),
    import(/* @vite-ignore */ "/src/editor/projectExportMirror.ts"),
    import(/* @vite-ignore */ "/src/project/io.ts"),
    import(/* @vite-ignore */ "/src/project/io/serialize.ts"),
    import(/* @vite-ignore */ "/src/project/persistence/core/projectPatch.ts"),
    import(/* @vite-ignore */ "/src/project/eventDraftVault.ts"),
  ]);
  const store = storeMod.store;
  const current = store.getCurrent();
  const mapId = Object.keys(current.maps).sort((a, b) => (current.maps[b].width * current.maps[b].height) - (current.maps[a].width * current.maps[a].height))[0];
  stateMod.editorState.set({ currentMapId: mapId, tool: "paint", layer: "lower", selectedTile: 1, brushSize: 1, paintShape: "pen", activePaletteStamp: null });
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

  const timeIt = (name, fn, iterations) => {
    const samples = [];
    for (let i = 0; i < iterations; i += 1) {
      const t = performance.now();
      try { fn(i); } catch (e) { return { name, error: String(e).slice(0, 300) }; }
      samples.push(performance.now() - t);
    }
    samples.sort((a, b) => a - b);
    return { name, iterations, medianMs: Math.round(samples[Math.floor(samples.length / 2)] * 100) / 100, maxMs: Math.round(samples[samples.length - 1] * 100) / 100 };
  };

  const rows = [];
  rows.push(timeIt("paint 1 cell", (i) => actions.paintTilesBulk(mapId, [{ layer: "lower", x: 3 + (i % 15), y: 3, tile: 1 }], { autoConnect: true }), 15));
  rows.push(timeIt("projectWithoutEventDrafts", () => draftsMod.projectWithoutEventDrafts(store.getCurrent()), 3));
  rows.push(timeIt("serialize(project)", () => ioMod.serialize(store.getCurrent()), 3));
  rows.push(timeIt("serializeForComparison", () => ioMod.serializeForComparison(store.getCurrent()), 2));
  rows.push(timeIt("canonicalJsonString", () => canonMod.canonicalJsonString(store.getCurrent()), 2));
  if (digestMod.jsonContentDigest) rows.push(timeIt("jsonContentDigest (cold)", () => digestMod.jsonContentDigest(serMod.projectWireView(store.getCurrent())), 1));
  if (digestMod.jsonContentDigest) rows.push(timeIt("jsonContentDigest (warm)", () => digestMod.jsonContentDigest(serMod.projectWireView(store.getCurrent())), 3));
  rows.push(timeIt("structuredClone(project)", () => structuredClone(store.getCurrent()), 2));
  const base = draftsMod.projectWithoutEventDrafts(store.getCurrent());
  const parsed = JSON.parse(ioMod.serialize(base));
  rows.push(timeIt("diffProjectDocuments (parsed inputs)", () => patchMod.diffProjectDocuments(parsed, JSON.parse(JSON.stringify(parsed))), 2));
  rows.push(timeIt("diffProjectDocuments (in-memory identity)", () => patchMod.diffProjectDocuments(base, base), 3));
  // **새 경로**: electronRepository.saveMapPatch 가 지금 실제로 하는 일.
  // 재투영 없음 + wireView 비교 + 변경 항목만 왕복. 성공 기준 1 의 판정 대상이다.
  rows.push(timeIt("NEW saveMapPatch body (wireView diff, no reprojection)", () => {
    const base = store._getPersistedBaselineForTest?.() ?? draftsMod.projectWithoutEventDrafts(store.getCurrent());
    const local = draftsMod.projectWithoutEventDrafts(store.getCurrent());
    const patch = patchMod.diffProjectDocuments(serMod.projectWireView(base), serMod.projectWireView(local));
    if (patchMod.withWirePatchValues) patchMod.withWirePatchValues(patch);
  }, 3));

  // **실제 저장 조건**: store 가 baseline 을 들고 있게 만든 뒤 잰다.
  // baseline 이 없으면 서로 다른 트리 두 개를 비교하게 되어(문서 배열 비공유) 최악 케이스가 된다 —
  // 실제 저장은 persistedBaseline(공유 클론)을 base 로 쓴다.
  if (store._setPersistedBaselineForTest) {
    store._setPersistedBaselineForTest(draftsMod.projectWithoutEventDrafts(store.getCurrent()));
    const realBase = store._getPersistedBaselineForTest();
    rows.push(timeIt("REAL saveMapPatch body (shared baseline, no edit)", () => {
      const local = draftsMod.projectWithoutEventDrafts(store.getCurrent());
      const patch = patchMod.diffProjectDocuments(serMod.projectWireView(realBase), serMod.projectWireView(local));
      patchMod.withWirePatchValues(patch);
    }, 3));
    // 한 칸 칠한 뒤(= 실제 자동저장 상황) 같은 경로
    actions.paintTilesBulk(mapId, [{ layer: "lower", x: 9, y: 9, tile: 3 }], { autoConnect: true });
    rows.push(timeIt("REAL saveMapPatch body (shared baseline, after 1 paint)", () => {
      const local = draftsMod.projectWithoutEventDrafts(store.getCurrent());
      const patch = patchMod.diffProjectDocuments(serMod.projectWireView(realBase), serMod.projectWireView(local));
      patchMod.withWirePatchValues(patch);
    }, 3));
    const localNow = draftsMod.projectWithoutEventDrafts(store.getCurrent());
    const realPatch = patchMod.diffProjectDocuments(serMod.projectWireView(realBase), serMod.projectWireView(localNow));
    rows.push({ name: "  info: REAL patch shape", patchKeys: Object.keys(realPatch), tilesetSetCount: Object.keys(realPatch.tilesets?.set ?? {}).length, mapsSetCount: Object.keys(realPatch.maps?.set ?? {}).length, baseIsPersisted: true });
    rows.push(timeIt("  step: diff only (shared baseline)", () => patchMod.diffProjectDocuments(serMod.projectWireView(realBase), serMod.projectWireView(localNow)), 3));
    rows.push(timeIt("  step: projectWithoutEventDrafts(local) only", () => draftsMod.projectWithoutEventDrafts(store.getCurrent()), 3));
  }

  // 참고: baseline 이 없을 때(서로 다른 트리) 구성 분해
  {
    const base0 = store._getPersistedBaselineForTest?.() ?? draftsMod.projectWithoutEventDrafts(store.getCurrent());
    const local0 = draftsMod.projectWithoutEventDrafts(store.getCurrent());
    rows.push(timeIt("  step: projectWithoutEventDrafts(local)", () => draftsMod.projectWithoutEventDrafts(store.getCurrent()), 3));
    rows.push(timeIt("  step: projectWireView x2", () => { serMod.projectWireView(base0); serMod.projectWireView(local0); }, 3));
    rows.push(timeIt("  step: diff(wireView base, wireView local)", () => patchMod.diffProjectDocuments(serMod.projectWireView(base0), serMod.projectWireView(local0)), 3));
    const patch0 = patchMod.diffProjectDocuments(serMod.projectWireView(base0), serMod.projectWireView(local0));
    rows.push(timeIt("  step: withWirePatchValues(patch)", () => patchMod.withWirePatchValues(patch0), 3));
    rows.push({ name: "  info: patch top keys", patchKeys: Object.keys(patch0), tilesetSetCount: Object.keys(patch0.tilesets?.set ?? {}).length, mapsSetCount: Object.keys(patch0.maps?.set ?? {}).length, baseIsPersisted: store._getPersistedBaselineForTest?.() !== null && store._getPersistedBaselineForTest?.() !== undefined });
  }

  rows.push(timeIt("FULL saveMapPatch body (legacy shape)", () => {
    const b = draftsMod.projectWithoutEventDrafts(store.getCurrent());
    const l = draftsMod.projectWithoutEventDrafts(store.getCurrent());
    patchMod.diffProjectDocuments(JSON.parse(ioMod.serialize(b)), JSON.parse(ioMod.serialize(l)));
  }, 1));
  rows.push(timeIt("syncEventDraftVaultFromProject", () => vaultMod.syncEventDraftVaultFromProject(store.getCurrent()), 5));
  rows.push(timeIt("store.update (whole-project clone)", (i) => store.update((p) => { p.meta = { ...(p.meta ?? {}), title: `t${i}` }; }), 3));
  if (store.updateDatabase) {
    rows.push(timeIt("store.updateDatabase (scoped clone)", (i) => {
      const items = store.getCurrent().database.items;
      const firstId = Array.isArray(items) ? undefined : Object.keys(items ?? {})[0];
      store.updateDatabase("items", (coll) => { if (firstId && coll[firstId]) coll[firstId].name = `n${i}`; });
    }, 5));
  }
  // update() 가 매번 돌리는 4개 정규화기 — 각자 프로젝트 전체를 지나간다
  try {
    const [assetsMod, connMod, treeMod, slotMod] = await Promise.all([
      import(/* @vite-ignore */ "/src/project/defaults/defaultAssets.ts"),
      import(/* @vite-ignore */ "/src/project/mapConnections.ts").catch(() => ({})),
      import(/* @vite-ignore */ "/src/project/mapTree.ts").catch(() => ({})),
      import(/* @vite-ignore */ "/src/project/switchVariableSlots.ts").catch(() => ({})),
    ]);
    const snapshot = structuredClone(store.getCurrent());
    if (assetsMod.removeLegacySpriteReferences) rows.push(timeIt("removeLegacySpriteReferences (whole project walk)", () => assetsMod.removeLegacySpriteReferences(snapshot), 3));
    if (assetsMod.ensureBundledTilesets) rows.push(timeIt("ensureBundledTilesets", () => assetsMod.ensureBundledTilesets(snapshot), 2));
    if (connMod.ensureProjectMapConnections) rows.push(timeIt("ensureProjectMapConnections", () => connMod.ensureProjectMapConnections(snapshot), 3));
    if (treeMod.ensureMapTreeCoversAllMaps) rows.push(timeIt("ensureMapTreeCoversAllMaps", () => treeMod.ensureMapTreeCoversAllMaps(snapshot), 3));
    if (slotMod.ensureSwitchVariableSlots) rows.push(timeIt("ensureSwitchVariableSlots", () => slotMod.ensureSwitchVariableSlots(snapshot), 3));
  } catch (e) { rows.push({ name: "normalizer probe", error: String(e).slice(0, 200) }); }

  const mirror = new mirrorMod.ProjectExportMirror();
  rows.push(timeIt("ProjectExportMirror.serialize (cold)", () => { mirror.clear(); mirror.serialize(store.getCurrent(), store.getVersionToken(), stateMod.editorState.get(), historyMod.getMapEditHistoryState()); }, 2));

  // 부팅 단계 분해 (승인된 Item 5 측정 전제): 정규화기 13종 개별 + fingerprint
  try {
    const [fpMod, sharedRefMod] = await Promise.all([
      import(/* @vite-ignore */ "/src/util/structuralJson.ts"),
      import(/* @vite-ignore */ "/src/project/defaults/sharedTileReferences.ts").catch(() => ({})),
    ]);
    const snap = store.getCurrent();
    if (fpMod.normalizationFingerprint) rows.push(timeIt("normalizationFingerprint", () => fpMod.normalizationFingerprint(snap), 2));
    if (sharedRefMod.ensureSharedTileReferences) rows.push(timeIt("ensureSharedTileReferences", () => sharedRefMod.ensureSharedTileReferences(structuredClone(snap)), 1));
  } catch (e) { rows.push({ name: "boot phase probe", error: String(e).slice(0, 200) }); }

  const proj = store.getCurrent();
  const refDocBytes = Object.values(proj.tilesets).reduce((s, ts) => s + (ts.referenceDocuments ? JSON.stringify(ts.referenceDocuments).length : 0), 0);
  return { mapId, maps: Object.keys(proj.maps).length, tilesets: Object.keys(proj.tilesets).length, referenceDocumentsMB: Math.round(refDocBytes / 1e5) / 10, rows };
});

const payload = { label, bootMs, pageErrors: pageErrors.slice(0, 5), ...result };
writeFileSync(`${outDir}/${label}.json`, JSON.stringify(payload, null, 2));
await page.screenshot({ path: `${outDir}/${label}.png` });
console.log(JSON.stringify(payload, null, 2));
await browser.close();
