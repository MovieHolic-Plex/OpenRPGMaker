// 아이템 런타임 QA 픽스처 생성기 — 출하 기본 아이템 카탈로그를 데모 픽스처 위에 얹는다.
//
// 왜 필요한가: 런타임 QA 시나리오는 출하 플레이어(player.html)가 프로젝트 JSON 을 그대로
// 로드하는 경로를 쓴다. 그런데 검증된 전투 경로를 가진 test/fixtures/projects/editor-authored-demo-v3.json
// 은 database.items 가 20개짜리 옛 스냅샷이다 — 출하 기본 카탈로그(208개)의 아군 전체 회복,
// 상태 부여, 속성 투척, 유한 충전(consumptionLimit) 같은 실행 경로가 아예 없다.
// 반대로 카탈로그가 든 프로젝트를 새로 만들면 검증된 맵·파티·전투 이벤트를 잃는다.
//
// 그래서 이 스크립트는 **병합만 한다**: 데모 픽스처를 원본으로 두고, 출하 기본 DB 에만 있는
// id 를 뒤에 덧붙인다. 같은 id 는 손대지 않는다 — 데모가 저작한 레코드와 그것을 가리키는
// 모든 참조(이벤트 명령, 적 드롭, 장비 착용 제한 등)가 그대로 살아 있어야 한다.
// startMapId/startPos/session.partyActorIds 도 건드리지 않는다: battle 시나리오의
// 알려진 전투 경로(map_lantern_village (14,18) → map_moonwell_forest (14,3) → action)가
// 그 값에 걸려 있다.
//
// 실행:
//   node scripts/build-item-qa-fixture.mjs
//   node scripts/build-item-qa-fixture.mjs --out /tmp/item-qa.json
//
// 기본 DB 는 TypeScript(src/project/defaults.ts)에만 있다. 이 파일은 빌드 없이 도는 .mjs 라
// vite-node 런너를 프로세스 안에 띄워 실제 소스를 실행한다 — 카탈로그를 여기에 복사하면
// 출하 데이터가 바뀌는 순간 조용히 낡는다.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve } from "node:path";

const DEFAULT_SOURCE = "test/fixtures/projects/editor-authored-demo-v3.json";
const DEFAULT_OUT = "test/fixtures/projects/item-runtime-qa-v3.json";

/**
 * 세션 인벤토리에 심는 출하 기본 아이템. 각 항목은 런타임 시나리오가 눈으로 증명할 수 있는
 * 서로 다른 실행 경로 하나를 대표한다. `expect` 는 **병합 결과** 레코드를 실데이터로 다시
 * 확인하는 계약이다 — 성격이 사라지면 생성이 실패해야 한다(조용히 통과 금지).
 *
 * 상태 치료는 데모에도 있는 item_antidote 가 아니라 출하 전용 item_antidote_plus 를 쓴다.
 * 데모의 item_antidote 는 낡은 스냅샷이라 healStateIds 가 비어 있는데, 병합 규칙상 데모
 * 레코드는 덮지 않으므로(참조 보존이 우선) 치료 경로는 출하 레코드가 그대로 실리는 id 로 잡는다.
 */
const SEEDED_ITEMS = [
  { id: "item_potion", role: "HP 회복약", expect: (item) => item.hpRecovery?.flat > 0 },
  { id: "item_ether", role: "MP 회복약", expect: (item) => item.mpRecovery?.flat > 0 },
  { id: "item_antidote_plus", role: "상태이상 치료", expect: (item) => (item.healStateIds ?? []).length > 0 },
  { id: "item_gen2_party_potion", role: "아군 전체 대상", expect: (item) => item.scope === "allAllies" },
  {
    id: "item_gen2_war_draught",
    role: "상태 부여 강화",
    expect: (item) => (item.stateEffects ?? []).some((effect) => effect.operation === "add"),
  },
  {
    id: "item_gen2_frost_vial",
    role: "속성 공격(아이템 스킬)",
    expect: (item) => item.scope === "enemy" && typeof item.skillId === "string" && item.skillId.length > 0,
  },
  {
    id: "item_gen2_twin_dose_kit",
    role: "유한 충전(consumptionLimit>1)",
    expect: (item) => typeof item.consumptionLimit === "number" && item.consumptionLimit > 1,
  },
];

const SEEDED_COUNT = 5;

/**
 * 병합 대상 테이블. 아이템만 옮기면 그 아이템이 가리키는 스킬·상태·애니메이션이 끊겨
 * `validateProjectReferences` 가 프로젝트를 아예 열지 못한다(io/shape.ts 의 하드 실패).
 * elements 는 오늘 데모와 기본이 같아 실제로는 0건이지만, 기본 속성표가 늘어나도
 * 스킬 참조가 끊기지 않도록 같은 규칙(없는 id 만 덧붙이기)으로 둔다.
 */
const MERGED_TABLES = ["elements", "states", "battleAnimations", "skills", "items", "equipment"];

function parseArgs(argv) {
  const args = { source: DEFAULT_SOURCE, out: DEFAULT_OUT };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--out") args.out = argv[++index];
    else if (arg === "--source") args.source = argv[++index];
    else throw new Error(`알 수 없는 인자입니다: ${arg} (사용법: --source <json> --out <json>)`);
    if (args.out === undefined || args.source === undefined) throw new Error(`${arg} 에 값이 필요합니다`);
  }
  return args;
}

/** src/**.ts 를 실제 별칭(@/)과 함께 실행하는 vite-node 런너. */
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
    // 이 프로세스는 브라우저에 아무것도 서브하지 않는다 — 의존성 사전 번들은 순수 낭비다.
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

/** 없는 id 만 뒤에 덧붙인다. 이미 있는 레코드는 저자(데모)가 손댔을 수 있어 그대로 둔다. */
function appendMissingById(target, source, label) {
  if (!Array.isArray(target)) throw new Error(`원본 픽스처에 database.${label} 배열이 없습니다`);
  const existing = new Set(target.map((record) => record.id));
  const added = [];
  for (const record of source) {
    if (existing.has(record.id)) continue;
    target.push(structuredClone(record));
    existing.add(record.id);
    added.push(record.id);
  }
  return added;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const sourcePath = resolve(process.cwd(), args.source);
  const outPath = resolve(process.cwd(), args.out);

  const rawSource = readFileSync(sourcePath, "utf8");
  const fixture = JSON.parse(rawSource);
  const sourceStart = {
    startMapId: fixture.startMapId,
    startPos: { ...fixture.startPos },
    partyActorIds: [...fixture.session.partyActorIds],
  };

  const { runner, close } = await createSourceRunner();
  try {
    const defaults = await runner.executeFile("src/project/defaults.ts");
    const io = await runner.executeFile("src/project/io.ts");
    const references = await runner.executeFile("src/project/io/references.ts");
    const shipped = defaults.createBlankProject();

    const addedByTable = {};
    for (const table of MERGED_TABLES) {
      addedByTable[table] = appendMissingById(fixture.database[table], shipped.database[table], table);
    }

    const itemById = new Map(fixture.database.items.map((item) => [item.id, item]));
    const inventory = { ...fixture.session.inventory };
    for (const seeded of SEEDED_ITEMS) {
      const item = itemById.get(seeded.id);
      if (!item) throw new Error(`출하 기본 카탈로그에 ${seeded.id} 가 없습니다 (${seeded.role})`);
      if (!seeded.expect(item)) {
        throw new Error(`${seeded.id} 가 더 이상 '${seeded.role}' 성격이 아닙니다 — 시드 목록을 실데이터에 맞춰 고치세요`);
      }
      inventory[seeded.id] = SEEDED_COUNT;
    }
    fixture.session.inventory = inventory;
    fixture.meta = {
      ...fixture.meta,
      title: `${fixture.meta.title} · 아이템 런타임 QA`,
    };

    // 시작 상태는 검증된 전투 경로의 전제다 — 병합이 이걸 흔들면 시나리오가 통째로 무의미해진다.
    if (fixture.startMapId !== sourceStart.startMapId) throw new Error("startMapId 가 바뀌었습니다");
    if (fixture.startPos.x !== sourceStart.startPos.x || fixture.startPos.y !== sourceStart.startPos.y) {
      throw new Error("startPos 가 바뀌었습니다");
    }
    if (fixture.session.partyActorIds.join(",") !== sourceStart.partyActorIds.join(",")) {
      throw new Error("session.partyActorIds 가 바뀌었습니다");
    }

    const serialized = `${JSON.stringify(fixture, null, 2)}\n`;

    // 실제 로드 경로로 스스로 검증한다. 여기서 통과하지 못하는 파일은 커밋할 가치가 없다.
    const loaded = io.deserialize(serialized);
    references.validateProjectReferences(loaded);

    writeFileSync(outPath, serialized);

    const summary = MERGED_TABLES.map((table) => `${table} +${addedByTable[table].length}=${fixture.database[table].length}`).join(", ");
    console.log(`[item-qa-fixture] ${args.source} → ${args.out}`);
    console.log(`[item-qa-fixture] 병합: ${summary}`);
    console.log(`[item-qa-fixture] 인벤토리 시드(${SEEDED_COUNT}개씩): ${SEEDED_ITEMS.map((seeded) => seeded.id).join(", ")}`);
    console.log(`[item-qa-fixture] 실제 로드 경로 검증 통과 — 아이템 ${loaded.database.items.length}종, 시작 ${loaded.startMapId} (${loaded.startPos.x},${loaded.startPos.y})`);
  } finally {
    await close();
  }
}

await main();
