// Rasak Fantasy 조수 지식 묶음(build_assistant_pack.py 결과)을 로컬 연구 프로젝트(SQLite 정본)에 싣고, 다시 열어 확인하고,
// Pi 시험용 JSON 을 내보낸다. 팩 그림이 든 결과물은 저장소 밖에만 쓴다.
//
// node:sqlite 를 쓰므로 bun 으로 묶어 node 로 돌린다:
//   bun build scripts/content/rasak/apply-assistant-pack.mts --target=node --outfile /tmp/mzai/apply.mjs
//   node /tmp/mzai/apply.mjs dump   --project ~/third-party-assets/rasak/study-project-layers --out /tmp/mzai/pack/original-tilesets.json
//   python3 scripts/content/rasak/build_assistant_pack.py ...                       (pack.json 생성)
//   node /tmp/mzai/apply.mjs verify --project <dir> --pack /tmp/mzai/pack/pack.json   (실제 엔진으로 프리뷰 모양 재현율)
//   node /tmp/mzai/apply.mjs apply  --project <dir> --pack /tmp/mzai/pack/pack.json [--example-maps ~/third-party-assets/rasak/maps]   (저장 → 다시 열어 왕복 확인; 예제 맵 칸도 갈아 끼움)
//        [--atlas-dir ~/third-party-assets/rasak/baked]   (굽기 결과의 칸 수가 프로젝트와 다르면 아틀라스 그림·칸 수를 갈아 끼운다 — 뒤에 시트를 붙인 경우.
//         앞 칸 번호는 그대로여야 한다: bake_atlas.py 는 새 구역을 기존 구역 뒤·그림자 앞에 붙인다)
//   node /tmp/mzai/apply.mjs export --project <dir> --original /tmp/mzai/pack/original-tilesets.json --out-dir /tmp/mzai
// 앞서 프로젝트 폴더를 통째로 백업한다(cp -a). apply 는 저장 직전에 fuser 로 그 DB 를 연 다른 프로세스(호스트·편집기)를
// 찾아 있으면 거부한다 — 실행 중인 호스트의 DB 를 별도 프로세스에서 고치지 않는다(AGENTS.md 프로젝트 정본 규칙).
// apply 는 팩이 소유한 것만 바꾼다: 참고문서는 팩의 용도 id 만 갈아 끼우고, tileGroups·autotileGroups 는 팩 접두어(rasak_)
// id 만 갈아 끼운다. structureKits 는 특수 건물 킷 접두어(sb_) id 만 갈아 끼운다. 저자가 직접 쓴 용도·그룹·킷은 그대로 둔다.
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PROJECT_STORE_FILE } from "../../../electron/local-store/schema";
import { openLocalProjectStore } from "../../../electron/local-store/store";
import { serialize } from "../../../src/project/io";
import { autotileLayerView, shapeAutotileGroupAround } from "../../../src/project/defaults/autotileEngine";
import type { AutotileGroup, GameMap, Project, TilesetDef } from "../../../src/project/types";

// 묶음 목록은 tiledata/rasak-fantasy/bundles.json 이 정본이다(마을·실내가 추가되며 손으로 적은 목록이 어긋났다).
const RASAK = (JSON.parse(readFileSync("tiledata/rasak-fantasy/bundles.json", "utf8")) as { bundles: { id: string }[] }).bundles.map((b) => b.id);
// 이 팩이 소유하는 참고문서 용도(build_assistant_pack.py PURPOSES). 덤프 때 이미 있으면 --force 없이는 멈춘다.
const PURPOSE_IDS = ["field_garden", "field_cliff", "swamp", "cave_ice", "cave_lava", "town_village", "town_city", "interior_house", "interior_tavern", "town_buildings", "interior_smithy", "interior_tailor", "interior_castle"];
// p27b 둘레 암반(A4 kind 7)은 옛 그림이라 표 검증에서 뺀다(names-review.md).
const OLD_ART: Record<string, string> = { rasak_preview_p27b: "rasak_a4_k7" };

type PackTileset = Pick<TilesetDef, "tileMeta" | "priority" | "passability" | "tileGroups" | "autotileGroups" | "referenceDocuments" | "structureKits">;
interface Pack {
  tilesets: Record<string, PackTileset>;
  /** 2층형 장식이 1층에 있던 칸을 2층으로 옮긴 프리뷰(build_assistant_pack.py normalize_decor). replaced = 1층을 채워 넣은 칸(검증에서 뺌). */
  normalized?: Record<string, { L1: number[]; L2: number[]; replaced: number[] }>;
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
function need(name: string): string {
  const v = arg(name);
  if (!v) throw new Error(`--${name} 가 필요합니다`);
  return v.replace(/^~(?=\/)/, process.env.HOME ?? "~");
}

async function open(dir: string) {
  const store = await openLocalProjectStore({ projectDir: dir });
  const snap = store.loadSnapshot();
  if (!snap) throw new Error("저장된 프로젝트가 없습니다");
  return { store, snap };
}

/** 실제 엔진으로 프리뷰 모든 자동타일 칸을 그 층 배열에서 다시 모양 잡고, 원래 모양과 같은 칸 비율을 센다. */
function engineAgreement(maps: readonly GameMap[], groupsFor: (tilesetId: string) => readonly AutotileGroup[], skip: Record<string, Set<number>> = {}) {
  const out: Record<string, { ok: number; n: number; pct?: number }> = {};
  const add = (key: string, ok: boolean) => { const r = (out[key] ??= { ok: 0, n: 0 }); r.n++; if (ok) r.ok++; };
  for (const map of maps) {
    if (!map.id.startsWith("rasak_preview_")) continue;
    const groups = groupsFor(map.tilesetId);
    if (groups.length === 0) continue;
    const p = map.id.replace("rasak_preview_", "");
    for (const layer of [1, 2] as const) {
      const view = autotileLayerView(map, layer);
      const original = [...view.lowerTiles];
      const copy = { width: view.width, height: view.height, lowerTiles: [...original] };
      const points = [];
      for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) points.push({ x, y });
      for (const group of groups) shapeAutotileGroupAround(copy, group, points);
      const owner = new Map<number, AutotileGroup>();
      for (const g of groups) for (const t of g.memberTileIds) owner.set(t, g);
      for (let y = 1; y < map.height - 1; y++) for (let x = 1; x < map.width - 1; x++) {
        const i = y * map.width + x;
        const g = owner.get(original[i]!);
        if (!g) continue;
        if (OLD_ART[map.id] === g.id) continue;
        if (layer === 1 && skip[map.id]?.has(i)) continue;
        const ok = copy.lowerTiles[i] === original[i];
        const slot = g.id.split("_")[1]!.toUpperCase();
        for (const key of [`L${layer}`, `L${layer}:${slot}`, `${p}:L${layer}`, "all"]) add(key, ok);
      }
    }
  }
  for (const r of Object.values(out)) r.pct = Math.round((1000 * r.ok) / r.n) / 10;
  return Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
}

/** 팩이 만드는 tileGroups·autotileGroups id 접두어(build_assistant_pack.py: rasak_<slot>_k<kind>, rasak_a5_<kind>). */
const PACK_GROUP_PREFIX = "rasak_";
/** 팩이 만드는 특수 건물 킷 id 접두어(build_assistant_pack.py build_structure_kits: sb_<건물>). */
const PACK_KIT_PREFIX = "sb_";

/** 이 DB(와 -wal/-shm)를 연 다른 프로세스가 있으면 던진다. fuser 가 없으면 확인할 수 없으므로 역시 거부한다. */
function assertNoOtherHolder(dir: string): void {
  const files = [PROJECT_STORE_FILE, `${PROJECT_STORE_FILE}-wal`, `${PROJECT_STORE_FILE}-shm`]
    .map((name) => join(dir, name)).filter((file) => existsSync(file));
  const result = spawnSync("fuser", files, { encoding: "utf8" });
  if (result.error) throw new Error(`fuser 를 실행할 수 없어 DB 점유를 확인하지 못했습니다 — 저장하지 않습니다: ${result.error.message}`);
  // fuser 는 PID 를 stdout 에(접근 모드 글자가 붙을 수 있다), 파일 이름을 stderr 에 쓴다. 이 프로세스(열어 둔 store)는 뺀다.
  const holders = [...new Set((result.stdout.match(/\d+/g) ?? []).map(Number))].filter((pid) => pid !== process.pid);
  if (holders.length > 0) {
    throw new Error(`${join(dir, PROJECT_STORE_FILE)} 을 다른 프로세스(PID ${holders.join(", ")})가 열고 있습니다 — 호스트·편집기를 닫고 다시 실행하세요. 저장하지 않았습니다.`);
  }
}

/** 팩이 소유한 항목만 갈아 끼운다: owns(항목) 인 기존 항목을 빼고 팩 항목을 뒤에 붙인다. 나머지 순서는 그대로. */
function mergeOwned<T extends { id: string }>(existing: readonly T[] | undefined, incoming: readonly T[] | undefined, owns: (item: T) => boolean): T[] {
  return [...(existing ?? []).filter((item) => !owns(item)), ...(incoming ?? [])];
}

function assertPackGroupIds(tilesetId: string, groups: readonly { id: string }[] | undefined): void {
  const stray = (groups ?? []).filter((g) => !g.id.startsWith(PACK_GROUP_PREFIX)).map((g) => g.id);
  if (stray.length > 0) throw new Error(`${tilesetId}: 팩 그룹 id 가 ${PACK_GROUP_PREFIX} 로 시작하지 않습니다 — ${stray.slice(0, 5).join(", ")}`);
}

function sameKind(groups: readonly AutotileGroup[]): AutotileGroup[] {
  return groups.map(({ connectTileIds: _c, ...g }) => g);
}

function inlineAssets(project: Project, dir: string): Project {
  const copy = JSON.parse(serialize(project)) as Project;
  for (const asset of Object.values(copy.assets.uploaded ?? {})) {
    const ref = (asset as { ref?: { sha256: string; mime: string; extension: string } }).ref;
    if (!ref) continue;
    const bytes = readFileSync(join(dir, "assets", `${ref.sha256}.${ref.extension}`));
    (asset as { dataUrl?: string }).dataUrl = `data:${ref.mime};base64,${bytes.toString("base64")}`;
    delete (asset as { ref?: unknown }).ref;
  }
  return copy;
}

function blankTrialMap(id: string, name: string, tilesetId: string, ground: number): GameMap {
  const width = 30, height = 20;
  return {
    id, name, width, height, tileSize: 48, tilesetId,
    lowerTiles: new Array<number>(width * height).fill(ground),
    upperTiles: new Array<number>(width * height).fill(-1),
    events: [],
  } as unknown as GameMap;
}

async function main() {
  const cmd = process.argv[2];
  const dir = need("project");
  if (cmd === "dump") {
    const { store, snap } = await open(dir);
    const out: Record<string, unknown> = {};
    for (const id of RASAK) {
      const ts = snap.project.tilesets[id]!;
      if (ts.referenceDocuments?.some((c) => PURPOSE_IDS.includes(c.id)) && !process.argv.includes("--force")) {
        throw new Error(`${id} 에 이미 조수 지식이 실려 있습니다 — 원본이 아니므로 dump 하지 않습니다(--force 로 무시)`);
      }
      out[id] = { tileMeta: ts.tileMeta, priority: ts.priority, passability: ts.passability };
    }
    writeFileSync(need("out"), JSON.stringify(out));
    console.log(JSON.stringify({ projectId: store.projectId, revision: snap.revision, sha256: snap.sha256, dumped: RASAK }));
    store.close();
    return;
  }
  if (cmd === "add") {
    // bundles.json 에 있는데 프로젝트에 없는 묶음을 굽기 결과로 새 타일셋·자산으로 더한다(던전·성곽 묶음, 2026-09-26).
    // 있는 타일셋은 건드리지 않는다. 저장 뒤 다시 열어 새 타일셋이 그대로인지 확인한다.
    const baked = need("baked");
    const { tilesetFor, atlasCoverage } = await import("./study-tileset.mjs");
    const { store, snap } = await open(dir);
    const project = snap.project;
    const added: string[] = [];
    for (const id of RASAK) {
      if (project.tilesets[id]) continue;
      const variant = existsSync(join(baked, id, "manifest.layers.json")) ? "layers." : "";
      const manifest = JSON.parse(readFileSync(join(baked, id, `manifest.${variant}json`), "utf8"));
      const bytes = readFileSync(join(baked, id, `atlas.${variant}png`));
      const { asset, tileset } = tilesetFor(manifest, bytes, atlasCoverage(manifest, bytes));
      project.assets.uploaded[asset.id] = asset as Project["assets"]["uploaded"][string];
      project.tilesets[id] = tileset as TilesetDef;
      added.push(id);
    }
    if (!added.length) {
      console.log(JSON.stringify({ projectId: store.projectId, revision: snap.revision, added }));
      store.close();
      return;
    }
    assertNoOtherHolder(dir);
    const saved = await store.saveProject(project);
    store.close();
    const reopened = await openLocalProjectStore({ projectDir: dir });
    const reload = reopened.loadSnapshot()!;
    const same = Object.fromEntries(added.map((id) => {
      const a = project.tilesets[id]!, b = reload.project.tilesets[id]!;
      return [id, { count: b.count, tileMeta: JSON.stringify(a.tileMeta) === JSON.stringify(b.tileMeta), passability: JSON.stringify(a.passability) === JSON.stringify(b.passability) }];
    }));
    console.log(JSON.stringify({ projectId: reopened.projectId, saved: saved.kind, revisionBefore: snap.revision, revisionAfter: reload.revision, added, reloaded: same }));
    reopened.close();
    return;
  }
  if (cmd === "verify") {
    const pack = JSON.parse(readFileSync(need("pack"), "utf8")) as Pack;
    const { store, snap } = await open(dir);
    const groupsFor = (id: string) => pack.tilesets[id]?.autotileGroups ?? [];
    const baseFor = (id: string) => sameKind(groupsFor(id));
    const raw = Object.values(snap.project.maps);
    // 규칙대로(장식 = 2층) 옮긴 프리뷰: 저장소 맵을 복사해 1·2층만 바꾼다.
    const norm = raw.map((m) => {
      const n = pack.normalized?.[m.id];
      return n ? ({ ...m, lowerTiles: [...n.L1], lowerOverlayTiles: [...n.L2] } as GameMap) : m;
    });
    const skip = Object.fromEntries(Object.entries(pack.normalized ?? {}).map(([id, n]) => [id, new Set(n.replaced)]));
    console.log(JSON.stringify({
      projectId: store.projectId, engine: "src/project/defaults/autotileEngine.ts autotileLayerView + shapeAutotileGroupAround",
      decorOnLayer2: { chosen: engineAgreement(norm, groupsFor, skip), sameKindBaseline: engineAgreement(norm, baseFor, skip) },
      rawPreview: { chosen: engineAgreement(raw, groupsFor), sameKindBaseline: engineAgreement(raw, baseFor) },
    }, null, 1));
    store.close();
    return;
  }
  if (cmd === "apply") {
    const pack = JSON.parse(readFileSync(need("pack"), "utf8")) as Pack;
    const { store, snap } = await open(dir);
    const project = snap.project;
    const atlasDir = arg("atlas-dir");
    const atlasUpgraded: Record<string, { from: number; to: number }> = {};
    if (atlasDir) {
      for (const id of RASAK) {
        const ts = project.tilesets[id]!;
        const variant = existsSync(join(atlasDir, id, "manifest.layers.json")) ? "layers." : "";
        const manifest = JSON.parse(readFileSync(join(atlasDir, id, `manifest.${variant}json`), "utf8")) as { count: number; tilesPerRow: number; tileSize: number };
        if (manifest.count === ts.count) continue;
        if (manifest.count < ts.count) throw new Error(`${id}: 굽기 칸 수 ${manifest.count} 가 프로젝트 ${ts.count} 보다 적습니다 — 뒤에 붙인 경우만 갈아 끼운다`);
        const asset = project.assets.uploaded[ts.image.id];
        if (!asset) throw new Error(`${id}: 아틀라스 자산 ${ts.image.id} 이 없습니다`);
        asset.dataUrl = "data:image/png;base64," + readFileSync(join(atlasDir, id, `atlas.${variant}png`)).toString("base64");
        asset.meta = { ...asset.meta, width: manifest.tilesPerRow * manifest.tileSize, height: Math.ceil(manifest.count / manifest.tilesPerRow) * manifest.tileSize };
        atlasUpgraded[id] = { from: ts.count, to: manifest.count };
        ts.count = manifest.count;
        if (ts.terrain) ts.terrain = [...ts.terrain, ...new Array(Math.max(0, manifest.count - ts.terrain.length)).fill(0)];
      }
    }
    for (const id of RASAK) {
      const ts = project.tilesets[id]!;
      const p = pack.tilesets[id]!;
      if (p.tileMeta!.length !== ts.count || p.priority.length !== ts.count || p.passability.length !== ts.count) throw new Error(`${id}: 칸 수가 다릅니다`);
      ts.tileMeta = p.tileMeta;
      ts.priority = p.priority;
      ts.passability = p.passability;
      assertPackGroupIds(id, p.tileGroups);
      assertPackGroupIds(id, p.autotileGroups);
      const packPurposes = new Set((p.referenceDocuments ?? []).map((c) => c.id));
      const ownsGroup = (g: { id: string }) => g.id.startsWith(PACK_GROUP_PREFIX);
      ts.tileGroups = mergeOwned(ts.tileGroups, p.tileGroups, ownsGroup);
      ts.autotileGroups = mergeOwned(ts.autotileGroups, p.autotileGroups, ownsGroup);
      ts.referenceDocuments = mergeOwned(ts.referenceDocuments, p.referenceDocuments, (c) => packPurposes.has(c.id));
      if (p.structureKits?.some((k) => !k.id.startsWith(PACK_KIT_PREFIX))) throw new Error(`${id}: 팩 킷 id 는 ${PACK_KIT_PREFIX} 로 시작해야 합니다`);
      if (p.structureKits) ts.structureKits = mergeOwned(ts.structureKits, p.structureKits, (k) => k.id.startsWith(PACK_KIT_PREFIX));
    }
    // --example-maps <dir>: 조립 예제(compose_examples.py 출력 rasak_preview_ex_*.layers.map.json)로 프로젝트의 같은 id 맵 칸을 갈아 끼운다.
    // 이미 있는 맵만(맵 트리·이벤트·BGM 은 그대로), 크기·네 층·그림자만 바꾼다. 없으면 건너뛰고 알린다.
    const exampleDir = arg("example-maps");
    const examplesReplaced: string[] = [], examplesMissing: string[] = [], examplesAdded: string[] = [];
    if (exampleDir) {
      for (const file of readdirSync(exampleDir).filter((f) => /^rasak_preview_ex_.*\.layers\.map\.json$/.test(f))) {
        const m = JSON.parse(readFileSync(join(exampleDir, file), "utf8")) as GameMap;
        const cur = project.maps[m.id];
        if (!cur) {
          // 새 예제(새 묶음)는 맵으로 더하고 맵 트리 뿌리의 자식으로 단다. 타일셋이 없으면 건너뛴다(add 먼저).
          if (!project.tilesets[m.tilesetId]) { examplesMissing.push(m.id); continue; }
          project.maps[m.id] = { ...m, events: m.events ?? [] } as GameMap;
          const root = project.mapTree as unknown as { children?: { mapId: string; children: unknown[] }[] };
          if (root?.children && !root.children.some((n) => n.mapId === m.id)) root.children.push({ mapId: m.id, children: [] });
          examplesAdded.push(m.id);
          continue;
        }
        project.maps[m.id] = { ...cur, width: m.width, height: m.height, tilesetId: m.tilesetId, lowerTiles: m.lowerTiles, upperTiles: m.upperTiles,
          lowerOverlayTiles: m.lowerOverlayTiles, upperOverlayTiles: m.upperOverlayTiles, shadowBits: m.shadowBits };
        examplesReplaced.push(m.id);
      }
    }
    assertNoOtherHolder(dir);
    const saved = await store.saveProject(project);
    store.close();
    const reopened = await openLocalProjectStore({ projectDir: dir });
    const reload = reopened.loadSnapshot()!;
    const fields = ["tileMeta", "priority", "passability", "tileGroups", "autotileGroups", "referenceDocuments", "structureKits", "count"] as const;
    const roundTrip: Record<string, Record<string, boolean>> = {};
    const counts: Record<string, unknown> = {};
    for (const id of RASAK) {
      const a = project.tilesets[id]!, b = reload.project.tilesets[id]!;
      roundTrip[id] = Object.fromEntries(fields.map((f) => [f, JSON.stringify(a[f]) === JSON.stringify(b[f])]));
      counts[id] = {
        tileMeta: b.tileMeta?.length, labelled: b.tileMeta?.filter((m) => !/^A[1-5] kind|^[B-E] \d|^X\d \d/.test(m.label)).length,
        tileGroups: b.tileGroups?.length, autotileGroups: b.autotileGroups?.length, structureKits: b.structureKits?.length, count: b.count,
        purposes: b.referenceDocuments?.map((c) => ({ id: c.id, documents: c.documents.length, chars: c.documents.reduce((s, d) => s + d.markdown.length, 0), images: c.images.length })),
      };
    }
    const mapsEqual = Object.keys(project.maps).every((m) => JSON.stringify(project.maps[m]) === JSON.stringify(reload.project.maps[m]));
    console.log(JSON.stringify({
      projectId: reopened.projectId, saved: saved.kind, sha256Saved: saved.kind === "saved" ? saved.sha256 : null,
      sha256Reloaded: reload.sha256, revisionBefore: snap.revision, revisionAfter: reload.revision, roundTrip, mapsEqual, atlasUpgraded, examplesReplaced, examplesAdded, examplesMissing, counts,
    }, null, 1));
    reopened.close();
    return;
  }
  if (cmd === "export") {
    const original = JSON.parse(readFileSync(need("original"), "utf8")) as Record<string, Pick<TilesetDef, "tileMeta" | "priority" | "passability">>;
    const outDir = need("out-dir");
    const { store, snap } = await open(dir);
    const project = inlineAssets(snap.project, dir);
    const trials: [string, string, string, number][] = [
      ["swamp_trial", "시험 · 늪지", "rasak_swamp", 3456],
      ["garden_trial", "시험 · 일본 정원", "rasak_field", 3072],
      ["cave_trial", "시험 · 얼음 동굴", "rasak_cave", 6184],
      // 마을·실내(2026-09-25): 풀밭(A2 kind 0) / 천장(A4 kind 0)으로 채운 빈 맵 — 실내는 천장 바탕에 방을 판다.
      ["village_trial", "시험 · 작은 마을", "rasak_town", 3072],
      ["city_trial", "시험 · 도시 광장", "rasak_town", 3072],
      ["house_trial", "시험 · 민가 실내", "rasak_interior", 1536],
      ["tavern_trial", "시험 · 여관 실내", "rasak_interior", 1536],
      ["smithy_trial", "시험 · 대장간 실내", "rasak_interior", 1536],
      ["tailor_trial", "시험 · 재봉점 실내", "rasak_interior", 1536],
      ["castle_trial", "시험 · 성 실내", "rasak_interior", 1536],
      ["dungeon_trial", "시험 · 지하 묘지", "rasak_dungeon", 4608],
      ["castle_court_trial", "시험 · 성곽과 폐허", "rasak_castle", 3072],
    ];
    for (const [id, name, ts, ground] of trials) {
      if (!project.tilesets[ts]) continue;
      project.maps[id] = blankTrialMap(id, name, ts, ground);
      // mapTree = 뿌리 한 개 {mapId, children}. 시험 맵은 뿌리의 자식으로 단다.
      const root = project.mapTree as unknown as { mapId: string; children: { mapId: string; children: unknown[] }[] };
      if (root?.children && !root.children.some((n) => n.mapId === id)) root.children.push({ mapId: id, children: [] });
    }
    writeFileSync(join(outDir, "trial.json"), JSON.stringify(project));
    const bare = JSON.parse(JSON.stringify(project)) as Project;
    for (const id of RASAK) {
      const ts = bare.tilesets[id];
      if (!ts || !original[id]) continue;
      delete ts.referenceDocuments;
      delete ts.autotileGroups;
      ts.tileGroups = [];
      ts.tileMeta = original[id]!.tileMeta;
      ts.priority = original[id]!.priority;
      ts.passability = original[id]!.passability;
    }
    writeFileSync(join(outDir, "trial-nodocs.json"), JSON.stringify(bare));
    console.log(JSON.stringify({ projectId: store.projectId, revision: snap.revision, maps: Object.keys(project.maps), trials: trials.map((t) => t[0]) }));
    store.close();
    return;
  }
  throw new Error("명령: add | dump | verify | apply | export");
}

await main();
