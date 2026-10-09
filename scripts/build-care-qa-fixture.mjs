// 몬스터 돌봄 런타임 QA 픽스처 생성기.
// 검증된 데모 맵/이벤트를 보존하면서 출하 기본 DB의 빠진 레코드만 id 기준으로 덧붙이고,
// 돌봄 아이템 여섯 종과 파티 몬스터 한 마리를 시작 상태에 심는다.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve } from "node:path";

const SOURCE = "test/fixtures/projects/editor-authored-demo-v3.json";
const OUTPUT = "test/fixtures/projects/item-care-qa-v3.json";
const CARE_ITEM_IDS = [
  "item_gen2_monster_kibble",
  "item_gen2_monster_feast",
  "item_gen2_growth_feed",
  "item_gen2_rope_toy",
  "item_gen2_rattle_ball",
  "item_gen2_training_frisbee",
];
const MERGED_TABLES = ["elements", "states", "battleAnimations", "skills", "items", "equipment"];
const INSTANCE_ID = "monster_care_qa";

function parseArgs(argv) {
  const args = { source: SOURCE, out: OUTPUT };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--source") args.source = argv[++index];
    else if (arg === "--out") args.out = argv[++index];
    else throw new Error(`알 수 없는 인자입니다: ${arg}`);
    if (!args.source || !args.out) throw new Error(`${arg} 에 경로가 필요합니다`);
  }
  return args;
}

async function createSourceRunner() {
  const { createServer } = await import("vite");
  const { ViteNodeServer } = await import("vite-node/server");
  const { ViteNodeRunner } = await import("vite-node/client");
  const { installSourcemapsSupport } = await import("vite-node/source-map");
  const root = process.cwd();
  const server = await createServer({
    root,
    configFile: false,
    logLevel: "error",
    optimizeDeps: { noDiscovery: true, include: [] },
    resolve: {
      alias: { "@": fileURLToPath(new URL("src/", pathToFileURL(`${root}/`))) },
      extensions: [".ts", ".js"],
    },
  });
  await server.pluginContainer.buildStart({});
  const nodeServer = new ViteNodeServer(server);
  installSourcemapsSupport({ getSourceMap: (source) => nodeServer.getSourceMap(source) });
  const runner = new ViteNodeRunner({
    root: server.config.root,
    base: server.config.base,
    fetchModule: (id) => nodeServer.fetchModule(id),
    resolveId: (id, importer) => nodeServer.resolveId(id, importer),
  });
  return { runner, close: () => server.close() };
}

function appendMissingById(target, source, label) {
  if (!Array.isArray(target)) target = [];
  const existing = new Set(target.map((record) => record.id));
  let added = 0;
  for (const record of source ?? []) {
    if (existing.has(record.id)) continue;
    target.push(structuredClone(record));
    existing.add(record.id);
    added += 1;
  }
  return { records: target, added, label };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const fixture = JSON.parse(readFileSync(resolve(args.source), "utf8"));
  const originalStart = JSON.stringify({
    mapId: fixture.startMapId,
    pos: fixture.startPos,
    actors: fixture.session.partyActorIds,
  });
  const { runner, close } = await createSourceRunner();
  try {
    const defaults = await runner.executeFile("src/project/defaults.ts");
    const io = await runner.executeFile("src/project/io.ts");
    const references = await runner.executeFile("src/project/io/references.ts");
    const shipped = defaults.createBlankProject();
    const merged = [];
    for (const table of MERGED_TABLES) {
      const result = appendMissingById(fixture.database[table], shipped.database[table], table);
      fixture.database[table] = result.records;
      merged.push(`${table} +${result.added}=${result.records.length}`);
    }

    const itemById = new Map(fixture.database.items.map((item) => [item.id, item]));
    for (const itemId of CARE_ITEM_IDS) {
      const item = itemById.get(itemId);
      if (!item || !["feed", "toy"].includes(item.careProfile?.kind)) {
        throw new Error(`출하 돌봄 아이템이 아닙니다: ${itemId}`);
      }
      fixture.session.inventory[itemId] = 5;
    }

    const shippedSpecies = shipped.database.monsterSpecies.find((record) => record.id === "species_wild_slime")
      ?? shipped.database.monsterSpecies[0];
    if (!shippedSpecies) throw new Error("출하 기본 DB에 몬스터 종족이 없습니다");
    fixture.database.monsterSpecies ??= [];
    const species = fixture.database.monsterSpecies.find((record) => record.id === shippedSpecies.id)
      ?? structuredClone(shippedSpecies);
    if (!fixture.database.monsterSpecies.some((record) => record.id === species.id)) {
      fixture.database.monsterSpecies.push(species);
    }
    // 진화 참조가 댕글링하지 않게 도착 종족도 출하 레코드로 채운다.
    for (const evolution of species.evolutions ?? []) {
      const target = shipped.database.monsterSpecies.find((record) => record.id === evolution.toSpeciesId);
      if (target && !fixture.database.monsterSpecies.some((record) => record.id === target.id)) {
        fixture.database.monsterSpecies.push(structuredClone(target));
      }
    }
    fixture.session.monsterInstances = {
      [INSTANCE_ID]: {
        instanceId: INSTANCE_ID,
        speciesId: species.id,
        nickname: "돌봄 슬라임",
        level: 3,
        exp: 0,
        currentHp: 14,
        ivs: { hp: 4, atk: 4, def: 4, spd: 4 },
        friendship: 70,
        caughtAt: { mapId: fixture.startMapId, x: fixture.startPos.x, y: fixture.startPos.y },
      },
    };
    fixture.session.monsterParty = [INSTANCE_ID];
    fixture.session.monsterBox = [];
    fixture.meta = { ...fixture.meta, title: `${fixture.meta.title} · 돌봄 아이템 QA` };

    const currentStart = JSON.stringify({
      mapId: fixture.startMapId,
      pos: fixture.startPos,
      actors: fixture.session.partyActorIds,
    });
    if (currentStart !== originalStart) throw new Error("검증된 시작 맵/좌표/액터 파티가 바뀌었습니다");

    const serialized = `${JSON.stringify(fixture, null, 2)}\n`;
    const loaded = io.deserialize(serialized);
    references.validateProjectReferences(loaded);
    const sessionModule = await runner.executeFile("src/project/session.ts");
    const started = sessionModule.startSession(loaded);
    if (started.monsterParty[0] !== INSTANCE_ID || started.monsterInstances[INSTANCE_ID]?.friendship !== 70) {
      throw new Error("실제 새 게임 세션이 저작된 파티 몬스터를 복원하지 못했습니다");
    }

    writeFileSync(resolve(args.out), serialized);
    console.log(`[care-qa-fixture] ${args.source} -> ${args.out}`);
    console.log(`[care-qa-fixture] 병합: ${merged.join(", ")}`);
    console.log(`[care-qa-fixture] 돌봄 아이템 6종 x5, ${INSTANCE_ID} 친밀도 70`);
    console.log(`[care-qa-fixture] deserialize + validateProjectReferences 통과`);
  } finally {
    await close();
  }
}

await main();
