// dream-explore 런타임 시나리오용 앵커 추출 — r5 project.json 에서 좌표·통행 가능 인접 칸·
// facing·이동 목적지·반복 맵 여닫이 행·아이템 시작 수량을 뽑아 scenario-anchors.json 으로 남긴다.
// 실행: bun scripts/qa/dream-scenario-anchors.mjs [qa-runs/dream-r5]
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { isPassable } from "../../src/project/collision.ts";

const runDir = process.argv[2] ?? "qa-runs/dream-r5";
const project = JSON.parse(readFileSync(join(runDir, "project.json"), "utf8"));

const DIRS = [
  { dir: "up", dx: 0, dy: -1 },
  { dir: "down", dx: 0, dy: 1 },
  { dir: "left", dx: -1, dy: 0 },
  { dir: "right", dx: 1, dy: 0 },
];

function inBounds(map, x, y) {
  return x >= 0 && y >= 0 && x < map.width && y < map.height;
}

/** 이벤트 칸 바로 옆 통행 가능 칸과 그곳에서 바라볼 방향. 다른 이벤트가 서 있는 칸은 피한다
 * (r5 실측: 눈 문의 '위' 칸이 거울 이벤트 칸이라 조사가 간헐히 갈렸다). */
function adjacentAnchor(mapId, eventId) {
  const map = project.maps[mapId];
  const event = map.events.find((entry) => entry.id === eventId);
  if (!event) throw new Error(`event not found: ${mapId}/${eventId}`);
  const occupied = new Set(map.events.filter((entry) => entry.id !== eventId).map((entry) => `${entry.x},${entry.y}`));
  const candidates = DIRS.map(({ dir, dx, dy }) => ({ dir, x: event.x + dx, y: event.y + dy }))
    .filter((spot) => inBounds(map, spot.x, spot.y) && isPassable(project, map, spot.x, spot.y)
      && !occupied.has(`${spot.x},${spot.y}`));
  if (candidates.length === 0) throw new Error(`no passable neighbor: ${mapId}/${eventId}`);
  // 위쪽(북쪽) 이웃을 우선 — 그림자·소품은 주로 남쪽空간에 깔린다.
  const pick = candidates.find((spot) => spot.dir === "up") ?? candidates[0];
  return { mapId, eventId, eventAt: { x: event.x, y: event.y }, standAt: { x: pick.x, y: pick.y }, face: pick.dir };
}

/** 반복 맵 여닫이: 양 끝 (0,y)/(width-1,y) 가 통행 가능인 행. */
function loopRow(mapId) {
  const map = project.maps[mapId];
  if (!map.loop) return null;
  const rows = [];
  for (let y = 0; y < map.height; y++) {
    const left = isPassable(project, map, 0, y);
    const right = isPassable(project, map, map.width - 1, y);
    const nearLeft = isPassable(project, map, 2, y);
    if (left && right && nearLeft) rows.push(y);
  }
  if (rows.length === 0) return null;
  const mid = rows.sort((a, b) => Math.abs(a - map.height / 2) - Math.abs(b - map.height / 2))[0];
  return { mapId, y: mid, from: { x: 2, y: mid }, wrapped: { x: map.width - 1, y: mid } };
}

function transferDest(mapId, eventId) {
  const map = project.maps[mapId];
  const event = map.events.find((entry) => entry.id === eventId);
  for (const page of event?.pages ?? []) {
    for (const command of page.commands ?? []) {
      if (command.kind === "transfer") return { mapId: command.mapId, x: command.x, y: command.y };
    }
  }
  throw new Error(`transfer not found: ${mapId}/${eventId}`);
}

const items = project.database.items;
const pinch = items.find((entry) => entry.id === "item_pinch_awake");
const startInventory = (project.session?.startState ?? project.session ?? {}).inventory ?? project.session?.inventory ?? {};
const effectItems = ["item_effect_candle", "item_effect_umbrella", "item_effect_catears"];

const wakeCommon = (project.commonEvents ?? []).find((entry) => entry.id === "ce_wake_up");
const wakeCommands = [];
const collectCommands = (list, depth = 0) => {
  if (depth > 6) return;
  for (const command of list ?? []) {
    if (!command || typeof command !== "object") continue;
    wakeCommands.push(command.kind === "transfer" ? `transfer->${command.mapId}(${command.x},${command.y})` : command.kind);
    for (const key of ["commands", "branch"]) collectCommands(command[key], depth + 1);
    for (const option of command.options ?? []) collectCommands(option.branch, depth + 1);
  }
};
collectCommands(wakeCommon?.commands ?? wakeCommon?.pages?.flatMap((page) => page.commands ?? []));

const anchors = {
  generatedFrom: runDir,
  title: project.meta?.title ?? "",
  start: { mapId: project.startMapId, x: project.startPos.x, y: project.startPos.y },
  pinch: pinch
    ? { id: pinch.id, name: pinch.name, switchId: pinch.switchId, startQty: startInventory[pinch.id] ?? 0, rowTestid: `status-menu-item-item-${pinch.id}` }
    : null,
  effectItems: Object.fromEntries(effectItems.map((id) => [id, startInventory[id] ?? 0])),
  sleep: adjacentAnchor("map_blank_start", "ev_bed"),
  sleepDest: transferDest("map_blank_start", "ev_bed"),
  doors: {
    forest: { ...adjacentAnchor("map_nexus", "ev_door_forest"), dest: transferDest("map_nexus", "ev_door_forest") },
    snow: { ...adjacentAnchor("map_nexus", "ev_door_snow"), dest: transferDest("map_nexus", "ev_door_snow") },
    desert: { ...adjacentAnchor("map_nexus", "ev_door_desert"), dest: transferDest("map_nexus", "ev_door_desert") },
    backToRoom: { ...adjacentAnchor("map_nexus", "ev_door_return"), dest: transferDest("map_nexus", "ev_door_return") },
  },
  effects: {
    candle: adjacentAnchor("map_candle_forest", "ev_cf_candle"),
    umbrella: adjacentAnchor("map_snow_stairs", "ev_ss_umbrella"),
    catears: adjacentAnchor("map_clock_desert", "ev_cd_catears"),
  },
  forestExit: { ...adjacentAnchor("map_candle_forest", "ev_cf_door"), dest: transferDest("map_candle_forest", "ev_cf_door") },
  mirror: adjacentAnchor("map_nexus", "ev_mirror"),
  loop: loopRow("map_candle_forest"),
  wakeCommon: wakeCommon ? { id: wakeCommon.id, trigger: wakeCommon.trigger, commands: wakeCommands } : null,
};

writeFileSync(join(runDir, "scenario-anchors.json"), JSON.stringify(anchors, null, 2), "utf8");
console.log(JSON.stringify(anchors, null, 2));
