import type { AiReportHost } from "../../../scripts/lib/aiJobs/scheduler.mjs";
import type { AiJobResult, BlobRef, JsonObject, JsonValue } from "./contracts";
import type { JobReport, ReportPhase, ReportPreview, ReportSection } from "./reportModel";
import { jsonObject, jsonValue, parseProject } from "./checkpointState";
import { drawRegionSnapshot } from "@/editor/regionSnapshotCore";
import { loadTilesetImageUrl, type TilesetCanvasImage } from "@/editor/mapTileDrawCore";
import { activeTileGrafts, createGraftedTilesetCanvas } from "@/assets/tileGrafts";
import { commandReportFlow, questReportFlow, reportFlowSvg } from "./reportFlow";
import { reportData } from "./reportData.mjs";
import type { Project, TilesetDef } from "@/project/types";

const record = (v: unknown): v is JsonObject => v !== null && typeof v === "object" && !Array.isArray(v);
const values = (v: unknown): JsonValue[] => Array.isArray(v) ? v : [];
function stable(v: unknown): string {
  if (v === undefined) return "undefined";
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  if (v !== null && typeof v === "object") return `{${Object.entries(v).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, x]) => `${JSON.stringify(k)}:${stable(x)}`).join(",")}}`;
  return JSON.stringify(v);
}
function ref(v: unknown): BlobRef | null {
  if (!record(v) || typeof v.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(v.sha256)
    || typeof v.byteLength !== "number" || typeof v.mediaType !== "string") return null;
  return { sha256: v.sha256, byteLength: v.byteLength, mediaType: v.mediaType };
}
class PreviewUnavailable extends Error {
  constructor(readonly status: "missing" | "unsupported", message: string) { super(message); }
}
export interface RenderedReportPreview { readonly artifact: BlobRef; readonly source: BlobRef | null; readonly width: number; readonly height: number }
export interface ReportRenderOptions {
  /** External rendering fault seam. Model/snapshot/repository execution is never replaced. */
  readonly renderPreview?: (section: ReportSection, preview: ReportPreview, render: () => Promise<RenderedReportPreview>) => Promise<RenderedReportPreview>;
}
function rethrowAttemptFailure(error: unknown): void {
  if (record(error) && typeof error.code === "string" && /PERSISTENCE|DURABILITY|CORRUPT|REPOSITORY|STALE|CANCEL/.test(error.code)) throw error;
}
/** A failed/cancelled generation has no AiJobResult. Its checkpoint is deliberately
 * a separate source: retained artifacts/text are private staged output, never success. */
async function renderStagedReport(host: AiReportHost, options: ReportRenderOptions): Promise<{ state: "ready" | "partial"; document: JobReport }> {
  const checkpoint = host.report.checkpoint;
  let document = host.report.document;
  const previous = new Map(document.sections.map(s => [s.id, s]));
  const sections: ReportSection[] = (checkpoint?.artifacts ?? []).map(r => ({
    id: `staged:${r.sha256}`, kind: r.mediaType.startsWith("image/") ? "artwork" : "change", objectId: r.sha256,
    title: `Retained ${checkpoint!.stageKey} artifact`, phase: "staged", snapshot: document.checkpoint!,
    data: { artifact: jsonObject(jsonValue(r)), stageKey: checkpoint!.stageKey, generatedSuccess: false },
    previews: r.mediaType.startsWith("image/") ? [{ id: "artwork", role: "artwork", status: "pending", source: r,
      artifact: null, width: null, height: null, error: null }] : [],
  }));
  const save = async () => { document = { ...document, sections: [...sections], failure: null }; await host.saveReport(document); };
  await save();
  for (let i = 0; i < sections.length; i++) {
    const item = sections[i], p = item.previews[0];
    if (!p) continue;
    const old = previous.get(item.id)?.previews.find(v => v.status === "ready");
    if (old) { sections[i] = { ...item, previews: [old] }; continue; }
    const render = async (): Promise<RenderedReportPreview> => {
      const r = p.source!;
      if (!/^image\/(png|jpeg|webp|gif)$/.test(r.mediaType)) throw new PreviewUnavailable("unsupported", `Unsupported staged image: ${r.mediaType}`);
      const bytes = await host.readBlob(r);
      let binary = ""; for (const byte of bytes) binary += String.fromCharCode(byte);
      const image = new Image();
      const loaded = new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error("Staged image decoding failed")); });
      image.src = `data:${r.mediaType};base64,${btoa(binary)}`; await loaded;
      return { artifact: r, source: r, width: image.naturalWidth, height: image.naturalHeight };
    };
    try {
      const output = await (options.renderPreview ? options.renderPreview(item, p, render) : render());
      sections[i] = { ...item, previews: [{ ...p, ...output, status: "ready", error: null }] };
    } catch (error) {
      rethrowAttemptFailure(error);
      sections[i] = { ...item, previews: [{ ...p, status: error instanceof PreviewUnavailable ? error.status : "failed", error: error instanceof Error ? error.message : String(error) }] };
    }
    await save();
  }
  await save();
  return { state: sections.some(s => s.previews.some(p => p.status !== "ready")) ? "partial" : "ready", document };
}
/** No HTTP fetch and no provider operation. Every image comes from a manifest blob
 * or embedded bytes in an immutable snapshot. Even bundled asset paths are not fetched. */
export async function renderJobReport(result: AiJobResult | null, host: AiReportHost, options: ReportRenderOptions = {}): Promise<{ state: "ready" | "partial"; document: JobReport }> {
  if (!result) return renderStagedReport(host, options);
  const { input } = host.report;
  let document = host.report.document;
  const base = parseProject(await host.readJson(result.baseSnapshot));
  const generated = result.generatedSnapshot ? parseProject(await host.readJson(result.generatedSnapshot)) : null;
  const applied = document.applied.status === "available" && document.applied.artifact
    ? await host.readJson(document.applied.artifact) : null;
  const appliedProject = applied && document.applied.scope === "project" ? parseProject(applied) : null;
  const snapshots: Array<{ project: Project; phase: ReportPhase; snapshot: BlobRef }> = [
    { project: base, phase: "before", snapshot: result.baseSnapshot },
    ...(generated && result.generatedSnapshot ? [{ project: generated, phase: "generated" as const, snapshot: result.generatedSnapshot }] : []),
    ...(appliedProject && document.applied.artifact ? [{ project: appliedProject, phase: "applied" as const, snapshot: document.applied.artifact }] : []),
  ];
  const sections: ReportSection[] = [];
  const tasks: Array<{ section: string; preview: string; run: () => Promise<RenderedReportPreview> }> = [];
  const retained = new Map(document.sections.map(section => [section.id, section]));
  const artifacts = new Map(document.artifacts.map(r => [r.sha256, r]));
  const keep = (r: BlobRef) => { artifacts.set(r.sha256, r); return r; };
  async function imageBytes(r: BlobRef): Promise<string> {
    if (!/^image\/(png|jpeg|webp|gif)$/.test(r.mediaType)) throw new PreviewUnavailable("unsupported", `Unsupported image media type: ${r.mediaType}`);
    const bytes = await host.readBlob(r);
    let binary = ""; for (const byte of bytes) binary += String.fromCharCode(byte);
    return `data:${r.mediaType};base64,${btoa(binary)}`;
  }
  async function embedded(dataUrl: string): Promise<BlobRef> {
    const match = /^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/]*={0,2})$/.exec(dataUrl);
    if (!match) throw new PreviewUnavailable("unsupported", "Image is not embedded captured raster bytes; mutable URLs are not loaded");
    const binary = atob(match[2]);
    return keep(await host.putBlob(Uint8Array.from(binary, c => c.charCodeAt(0)), match[1]));
  }
  async function asset(project: Project, id: string): Promise<BlobRef> {
    const uploaded = project.assets.uploaded[id];
    if (uploaded) return embedded(uploaded.dataUrl);
    const bindings = record(input.payload.reportAssets) ? input.payload.reportAssets : {};
    const pinned = ref(bindings[id]);
    if (pinned) { await host.readBlob(pinned); return keep(pinned); }
    throw new PreviewUnavailable("missing", `Artwork was not captured: ${id}`);
  }
  const imageCache = new Map<string, Promise<{ image: TilesetCanvasImage; source: BlobRef }>>();
  async function tilesetImage(project: Project, tileset: TilesetDef): Promise<{ image: TilesetCanvasImage; source: BlobRef }> {
    const source = await asset(project, tileset.image.id);
    const key = stable([source, tileset]);
    let pending = imageCache.get(key);
    if (!pending) {
      pending = (async () => {
        let image = await loadTilesetImageUrl(tileset, await imageBytes(source));
        const grafts = activeTileGrafts(tileset);
        if (grafts.length) {
          const sources = new Map<string, TilesetCanvasImage>();
          for (const id of new Set(grafts.map(g => g.sourceChipset))) {
            const r = await asset(project, id);
            sources.set(id, await loadTilesetImageUrl({ ...tileset, transparentColor: undefined, image: { type: "bundled", id } }, await imageBytes(r)));
          }
          const grafted = createGraftedTilesetCanvas(tileset, image, id => sources.get(id)!);
          if (!grafted) throw new Error("Tileset graft canvas unavailable");
          image = grafted;
        }
        return { image, source };
      })();
      imageCache.set(key, pending);
    }
    return pending;
  }
  async function canvasArtifact(canvas: HTMLCanvasElement, source: BlobRef | null): Promise<RenderedReportPreview> {
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error("Preview PNG encoding failed")), "image/png"));
    return { artifact: keep(await host.putBlob(new Uint8Array(await blob.arrayBuffer()), "image/png")), source, width: canvas.width, height: canvas.height };
  }
  async function artwork(r: BlobRef): Promise<RenderedReportPreview> {
    const url = await imageBytes(r);
    const image = new Image();
    const decoded = new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error("Captured image decoding failed")); });
    image.src = url; await decoded;
    return { artifact: keep(r), source: r, width: image.naturalWidth, height: image.naturalHeight };
  }
  function section(kind: ReportSection["kind"], objectId: string, title: string, phase: ReportPhase, snapshot: BlobRef, data: unknown): ReportSection {
    const item: ReportSection = { id: `${kind}:${objectId}:${phase}`, kind, objectId, title, phase, snapshot, data: reportData(jsonObject(jsonValue(data))), previews: [] };
    sections.push(item); return item;
  }
  function preview(item: ReportSection, id: string, role: ReportPreview["role"], run: () => Promise<RenderedReportPreview>) {
    const old = retained.get(item.id);
    const cached = old && old.snapshot.sha256 === item.snapshot.sha256 && stable(old.data) === stable(item.data)
      ? old.previews.find(p => p.id === id && p.status === "ready") : undefined;
    const p: ReportPreview = cached ?? { id, role, status: "pending", source: null, artifact: null, width: null, height: null, error: null };
    const index = sections.findIndex(s => s.id === item.id);
    sections[index] = { ...sections[index], previews: [...sections[index].previews, p] };
    if (!cached) tasks.push({ section: item.id, preview: id, run });
  }
  function flow(item: ReportSection, model: ReturnType<typeof commandReportFlow>) {
    preview(item, "flow", "flow", async () => {
      const rendered = reportFlowSvg(model);
      return { artifact: keep(await host.putBlob(new TextEncoder().encode(rendered.svg), "image/svg+xml")), source: item.snapshot, width: rendered.width, height: rendered.height };
    });
  }
  const allMaps = [...new Set(snapshots.flatMap(s => Object.keys(s.project.maps)))].sort();
  function mapIdentity(project: Project, id: string) {
    const map = project.maps[id], tileset = map && project.tilesets[map.tilesetId];
    return [map, tileset, tileset && project.assets.uploaded[tileset.image.id],
      ...(tileset?.tileGrafts ?? []).map(g => project.assets.uploaded[g.sourceChipset])];
  }
  for (const id of allMaps) {
    if (!snapshots.slice(1).some(s => stable(mapIdentity(base, id)) !== stable(mapIdentity(s.project, id)))) continue;
    const maps = snapshots.flatMap(s => s.project.maps[id] ? [s.project.maps[id]] : []);
    const requested = result.family === "region" && result.payload.mapId === id && record(result.payload.region) ? result.payload.region : null;
    // Common pixel-space crop/scale across before/generated/applied, even resized maps.
    const crop = requested ? { x: Number(requested.x) * maps[0].tileSize, y: Number(requested.y) * maps[0].tileSize,
      width: Number(requested.width) * maps[0].tileSize, height: Number(requested.height) * maps[0].tileSize }
      : { x: 0, y: 0, width: Math.max(...maps.map(m => m.width * m.tileSize)), height: Math.max(...maps.map(m => m.height * m.tileSize)) };
    const scale = Math.min(2, 960 / Math.max(crop.width, crop.height));
    for (const s of snapshots) {
      const map = s.project.maps[id];
      const item = section("map", id, map?.name ?? id, s.phase, s.snapshot, { map: map ? { id: map.id, name: map.name, width: map.width, height: map.height, tileSize: map.tileSize, tilesetId: map.tilesetId, eventCount: map.events.length } : null,
        crop, scale, eventMarkers: "schematic", gameplayQA: "not-performed" });
      preview(item, "map", "map", async () => {
        if (!map) throw new PreviewUnavailable("missing", `${s.phase === "before" ? "Created" : "Deleted"} map: no ${s.phase} image`);
        const tileset = s.project.tilesets[map.tilesetId];
        if (!tileset) throw new PreviewUnavailable("missing", `Missing tileset: ${map.tilesetId}`);
        const { image, source } = await tilesetImage(s.project, tileset);
        return canvasArtifact(drawRegionSnapshot(map, tileset, image, { x: crop.x / map.tileSize, y: crop.y / map.tileSize,
          width: crop.width / map.tileSize, height: crop.height / map.tileSize }, { scale }), source);
      });
    }
  }
  // Every affected uploaded resource gets a gallery entry, including deleted/missing
  // and unsupported (e.g. audio) entries. DB fields retain their exact record alongside it.
  for (const s of snapshots.filter(s => s.phase !== "before")) {
    const ids = [...new Set([...Object.keys(base.assets.uploaded), ...Object.keys(s.project.assets.uploaded)])].sort();
    for (const id of ids) if (stable(base.assets.uploaded[id]) !== stable(s.project.assets.uploaded[id])) {
      const resource = s.project.assets.uploaded[id];
      const item = section("artwork", id, resource?.name ?? id, s.phase, s.snapshot, { resource: resource ? { id: resource.id, name: resource.name, kind: resource.kind, meta: resource.meta } : null });
      preview(item, "artwork", "artwork", async () => {
        if (!resource) throw new PreviewUnavailable("missing", "Resource deleted in captured snapshot");
        return artwork(await asset(s.project, id));
      });
    }
    for (const [table, entries] of Object.entries(s.project.database)) {
      if (!Array.isArray(entries)) {
        const before = (base.database as unknown as JsonObject)[table];
        if (stable(before) !== stable(entries)) section("change", `database/${table}`, table, s.phase, s.snapshot, { before: before ?? null, after: entries });
        continue;
      }
      const before = values((base.database as unknown as JsonObject)[table]);
      for (const entry of entries) {
        if (!record(entry) || !entry.id || stable(before.find(v => record(v) && v.id === entry.id)) === stable(entry)) continue;
        const id = `${table}/${entry.id}`;
        const item = section("change", id, String(entry.name ?? entry.id), s.phase, s.snapshot, { table, record: entry });
        for (const field of Object.keys(entry).sort()) if (/ResourceId$/.test(field) && typeof entry[field] === "string" && entry[field]) {
          const resourceId = String(entry[field]);
          preview(item, field, "artwork", () => asset(s.project, resourceId).then(artwork));
        }
      }
      for (const entry of before) if (record(entry) && !entries.some(v => record(v) && v.id === entry.id)) {
        section("change", `${table}/${entry.id}`, String(entry.name ?? entry.id), s.phase, s.snapshot, { table, deleted: entry });
      }
    }
    const events = (p: Project) => new Map([
      ...Object.values(p.maps).flatMap(m => m.events.flatMap(e => [
        [`map/${m.id}/${e.id}/legacy`, { title: e.name, commands: e.commands }] as const,
        ...(e.pages ?? []).map(page => [`map/${m.id}/${e.id}/page/${page.id}`, { title: `${e.name} / ${page.name}`, commands: page.commands }] as const),
      ])),
      ...p.commonEvents.map(e => [`common/${e.id}`, { title: e.name, commands: e.commands }] as const),
      ...p.database.troops.flatMap(t => (t.battleEventPages ?? []).map(e => [`troop/${t.id}/${e.id}`, { title: `${t.name} / ${e.name}`, commands: e.commands }] as const)),
    ]);
    const oldEvents = events(base), currentEvents = events(s.project);
    for (const [id, e] of oldEvents) if (!currentEvents.has(id)) {
      section("commands", id, e.title ?? id, s.phase, s.snapshot, { deleted: true, commands: [], beforeCommands: e.commands });
    }
    for (const [id, e] of currentEvents) if (stable(oldEvents.get(id)) !== stable(e)) {
      const commands = jsonValue(e.commands) as readonly JsonValue[];
      const graph = commandReportFlow(commands);
      flow(section("commands", id, e.title ?? id, s.phase, s.snapshot, { commands, beforeCommands: oldEvents.get(id)?.commands ?? [], graph, semantics: "authored-structure-not-gameplay" }), graph);
    }
    for (const quest of s.project.quests ?? []) {
      const q = jsonObject(jsonValue(quest));
      const id = String(q.id ?? q.key);
      if (stable((base.quests ?? []).find(b => String("id" in b ? b.id : b.key) === id)) === stable(quest)) continue;
      const graph = questReportFlow(q);
      flow(section("quest", id, String(q.title), s.phase, s.snapshot, { quest: q, graph, gameplayQA: "not-performed" }), graph);
    }
    for (const quest of base.quests ?? []) {
      const q = jsonObject(jsonValue(quest)), id = String(q.id ?? q.key);
      if (!(s.project.quests ?? []).some(v => String("id" in v ? v.id : v.key) === id)) section("quest", id, String(q.title), s.phase, s.snapshot, { deleted: true, beforeQuest: q });
    }
    // Non-gallery changes remain useful drilldown data rather than disappearing.
    for (const key of Object.keys(s.project).sort()) if (!["maps", "tilesets", "assets", "database", "quests", "commonEvents"].includes(key)) {
      const after = (s.project as unknown as JsonObject)[key], before = (base as unknown as JsonObject)[key];
      if (stable(before) !== stable(after)) section("change", `project/${key}`, key, s.phase, s.snapshot, { before: before ?? null, after: after ?? null });
    }
  }
  const tilesetIds = new Set(snapshots.flatMap(s => [...new Set([...Object.keys(base.tilesets), ...Object.keys(s.project.tilesets)])]
    .filter(id => stable(base.tilesets[id]) !== stable(s.project.tilesets[id]))));
  if (result.family === "tileset" && typeof input.payload.tilesetId === "string") tilesetIds.add(input.payload.tilesetId);
  for (const id of [...tilesetIds].sort()) for (const s of snapshots) {
    const tileset = s.project.tilesets[id];
    if (!tileset) {
      const item = section("tileset", id, id, s.phase, s.snapshot, { tileset: null, deleted: true });
      preview(item, "atlas", "atlas", async () => { throw new PreviewUnavailable("missing", "Tileset deleted in captured snapshot"); });
      continue;
    }
    const tileIds = new Set<number>();
    for (let tile = 0; tile < tileset.count; tile++) {
      const old = base.tilesets[id];
      if (!old || ["tileMeta", "priority", "passability", "terrain"].some(key => stable(values((old as unknown as JsonObject)[key])[tile]) !== stable(values((tileset as unknown as JsonObject)[key])[tile]))) tileIds.add(tile);
    }
    for (const key of ["tileIds", "selectedTiles", "sampleTiles"]) for (const tile of values(input.payload[key])) if (typeof tile === "number") tileIds.add(tile);
    const collect = (v: JsonValue) => {
      if (Array.isArray(v)) { for (const x of v) collect(x); }
      else if (record(v)) for (const [key, x] of Object.entries(v)) {
        if (key === "tileIds") for (const tile of values(x)) { if (typeof tile === "number") tileIds.add(tile); }
        else if (key === "tile" && typeof x === "number") tileIds.add(x);
        else collect(x);
      }
    };
    collect(result.payload);
    if (result.family === "tileset" && typeof input.payload.groupId === "string") for (const tile of tileset.tileGroups?.find(g => g.id === input.payload.groupId)?.tileIds ?? []) tileIds.add(tile);
    const changed = [...tileIds].filter(t => Number.isInteger(t) && t >= 0 && t < tileset.count).sort((a, b) => a - b);
    const item = section("tileset", id, tileset.name, s.phase, s.snapshot, { tileset, changedTileIds: changed, proposal: result.family === "tileset" ? result.payload : null });
    const loadAtlas = async () => {
      // An explicitly captured full atlas is valid for proposal-only tileset jobs.
      const captured = result.family === "tileset" && ref(input.payload.atlas);
      if (captured && !s.project.assets.uploaded[tileset.image.id]) return { image: await loadTilesetImageUrl(tileset, await imageBytes(captured)), source: keep(captured) };
      return tilesetImage(s.project, tileset);
    };
    preview(item, "atlas", "atlas", async () => {
      const { image, source } = await loadAtlas();
      const canvas = globalThis.document.createElement("canvas"); canvas.width = image.width; canvas.height = image.height;
      const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("Atlas canvas unavailable");
      ctx.drawImage(image, 0, 0); ctx.strokeStyle = "#f43f5e"; ctx.lineWidth = 1;
      for (const tile of changed) ctx.strokeRect((tile % tileset.tilesPerRow) * tileset.tileSize + 0.5, Math.floor(tile / tileset.tilesPerRow) * tileset.tileSize + 0.5, tileset.tileSize - 1, tileset.tileSize - 1);
      return canvasArtifact(canvas, source);
    });
    for (const tile of changed) preview(item, `tile/${tile}`, "crop", async () => {
      const { image, source } = await loadAtlas();
      const canvas = globalThis.document.createElement("canvas"); canvas.width = tileset.tileSize; canvas.height = tileset.tileSize;
      const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("Tile crop canvas unavailable");
      ctx.drawImage(image, (tile % tileset.tilesPerRow) * tileset.tileSize, Math.floor(tile / tileset.tilesPerRow) * tileset.tileSize,
        tileset.tileSize, tileset.tileSize, 0, 0, tileset.tileSize, tileset.tileSize);
      return canvasArtifact(canvas, source);
    });
  }
  if (result.family === "event-commands") {
    const proposalRef = ref(result.payload.proposalRef);
    if (!proposalRef) throw new Error("Event result lacks its proposal reference");
    const proposal = await host.readJson(proposalRef);
    if (!record(proposal)) throw new Error("Invalid event proposal");
    const commands = values(proposal.finalCommands), graph = commandReportFlow(commands);
    flow(section("commands", "proposal", "Event command proposal", "generated", proposalRef, { ...proposal, graph, semantics: "authored-structure-not-gameplay" }), graph);
  }
  if (applied && record(applied) && document.applied.scope === "draft" && document.applied.artifact) {
    const graph = commandReportFlow(values(applied.commands));
    flow(section("commands", "receipt-draft", "Applied draft (not confirmed project data)", "applied-draft", document.applied.artifact,
      { owner: applied.owner ?? null, commands: applied.commands ?? [], resources: applied.resources ?? {}, graph, confirmedProject: false }), graph);
  }
  if (result.family === "image" && record(result.payload.proposal)) {
    const proposal = result.payload.proposal, resource = record(proposal.resource) ? proposal.resource : {};
    const image = ref(resource.artifact);
    const item = section("artwork", "image-output", String(resource.name ?? "Generated image"), "generated", document.result!, { proposal, model: result.payload.model ?? null, provider: result.payload.provider ?? null });
    preview(item, "image", "artwork", async () => {
      if (!image) throw new PreviewUnavailable("missing", "Image result has no captured image artifact");
      return artwork(image);
    });
  }
  // Report inventory is durable before the first preview. Successful artifacts are
  // committed one by one; a later browser crash cannot discard earlier output.
  const checkpoint = async () => {
    document = { ...document, sections: [...sections], artifacts: [...artifacts.values()], failure: null };
    await host.saveReport(document);
  };
  await checkpoint();
  for (const task of tasks) {
    const i = sections.findIndex(s => s.id === task.section), item = sections[i];
    const p = item.previews.find(p => p.id === task.preview)!;
    let completed: ReportPreview;
    try {
      const output = await (options.renderPreview ? options.renderPreview(item, p, task.run) : task.run());
      keep(output.artifact); if (output.source) keep(output.source);
      completed = { ...p, ...output, status: "ready", error: null };
    } catch (error) {
      // Persistence/cancellation errors belong to the attempt and must never become
      // a swallowed per-preview failure. Only rendering errors are recoverable here.
      rethrowAttemptFailure(error);
      completed = { ...p, status: error instanceof PreviewUnavailable ? error.status : "failed", error: error instanceof Error ? error.message : String(error) };
    }
    sections[i] = { ...item, previews: item.previews.map(v => v.id === p.id ? completed : v) };
    await checkpoint();
  }
  return { state: sections.some(s => s.previews.some(p => p.status !== "ready")) || document.applied.status === "unavailable" ? "partial" : "ready", document };
}
