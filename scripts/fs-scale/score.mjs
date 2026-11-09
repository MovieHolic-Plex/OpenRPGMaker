#!/usr/bin/env node
/**
 * 「폴른 스타급」 완성도 척도 (field I7) — 읽기 전용 채점기. 모델 호출 0, 네트워크 0.
 *
 *   node scripts/fs-scale/score.mjs [--baseline blank.project.json] [--measure] [--json] <project.json>...
 *
 * 한 줄 요약: 프로젝트 JSON 에서 센 열네 가지 양을 Fallen Star(= 100) 실측값 대비 비율로 바꿔
 * `weights.json` 의 가중치로 합친다. 비율은 1 에서 잘린다(FS 보다 많아도 더 얹히지 않는다).
 *
 * 왜 새로 만들었나: reward 하네스의 content 점수는 맵 2장·이벤트 10개에서 포화해(b1 중앙값 96)
 * 1맵 게임과 FS급을 구분하지 못했다.
 *
 * 부풀리기 방어(anti-gaming) — 센다는 것은 아래를 모두 통과한 것만이다:
 *   - 맵: 시작 맵에서 transfer·엔딩 이어가기로 **닿을 수 있고**, 타일 종류가 충분하고, 배치(타일 배열)가 다른 맵과
 *     같지 않고, 의미 있는 이벤트가 하나라도 있는 맵. 닿지 않는 빈 맵·복제 맵은 0.
 *   - 이벤트: 명령이 있고, id·이름·좌표를 뺀 내용이 같은 이벤트는 하나. 복제는 0.
 *   - 대사: 숫자·구두점을 지운 본문이 같은 줄은 하나. 「좋아 1」「좋아 2」는 한 줄.
 *   - DB(적·스킬·아이템): 닿는 것(이벤트→전투조→적→스킬 …)만 세고, 이름만 바꾼 같은 능력치는 하나, 엔진 기본값(--baseline)과
 *     같은 것은 0. DB 에 쓰지 않는 항목을 채워도 0.
 *   - 막 구조: 의미 있는 이벤트끼리 스위치·변수로 이어진 가장 긴 사슬.
 * 남는 구멍은 점수 페이지에 적는다(사슬 이벤트를 진짜로 만들어 이어붙이면 막 점수는 오른다 — 그만큼 이벤트가 필요하다).
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_WEIGHTS_PATH = join(HERE, "weights.json");

const DB_TABLES = ["troops", "enemies", "actors", "classes", "skills", "items", "equipment", "states"];
const MIN_TILE_KINDS = 6;
const MIN_MAP_CELLS = 100;
const MIN_LINE_CHARS = 3;

// ---------- 작은 도구 ----------
function canon(value, dropKeys) {
  if (Array.isArray(value)) return `[${value.map((item) => canon(item, dropKeys)).join(",")}]`;
  if (value && typeof value === "object") {
    const keys = Object.keys(value)
      .filter((key) => !dropKeys.has(key))
      .sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canon(value[key], dropKeys)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}
const sha = (text) => createHash("sha1").update(text).digest("hex").slice(0, 16);
const DROP_EVENT = new Set(["id", "name", "x", "y", "graphic"]);
const DROP_ID = new Set(["id"]);
const DROP_LOOK = new Set(["id", "name", "nickname", "description", "graphic"]);

function walk(node, visit) {
  if (Array.isArray(node)) {
    for (const item of node) walk(item, visit);
  } else if (node && typeof node === "object") {
    visit(node);
    for (const key of Object.keys(node)) walk(node[key], visit);
  }
}

function collectStrings(node, into) {
  if (typeof node === "string") into.add(node);
  else if (Array.isArray(node)) for (const item of node) collectStrings(item, into);
  else if (node && typeof node === "object") for (const key of Object.keys(node)) collectStrings(node[key], into);
}

const normalizeLine = (text) =>
  String(text)
    .toLowerCase()
    .replace(/[0-9０-９]+/g, "")
    .replace(/[\s.,!?…~·'"“”‘’()\[\]{}:;\-_*]+/g, "");

// ---------- 이벤트·맵 ----------
function pagesOf(event) {
  return Array.isArray(event.pages) ? event.pages : [];
}

function commandCount(event) {
  let count = 0;
  walk([event.commands, ...pagesOf(event).map((page) => page.commands)], (node) => {
    if (typeof node.kind === "string") count += 1;
  });
  return count;
}

function eventHash(event) {
  return sha(
    canon(
      {
        trigger: event.trigger,
        commands: event.commands,
        pages: pagesOf(event).map((page) => ({ conditions: page.conditions, trigger: page.trigger, commands: page.commands })),
      },
      DROP_EVENT,
    ),
  );
}

function tileKinds(map) {
  const kinds = new Set();
  for (const key of ["lowerTiles", "upperTiles", "lowerOverlayTiles", "upperOverlayTiles"]) {
    const layer = map[key];
    if (Array.isArray(layer)) for (const tile of layer) if (tile !== -1 && tile != null) kinds.add(tile);
  }
  return kinds;
}

const layoutHash = (map) =>
  sha(
    [map.width, map.height, map.lowerTiles, map.upperTiles, map.lowerOverlayTiles, map.upperOverlayTiles]
      .map((part) => (Array.isArray(part) ? part.join(",") : String(part ?? "")))
      .join("|"),
  );

function transferTargets(node) {
  const targets = new Set();
  walk(node, (item) => {
    if (item.kind === "transfer" && typeof item.mapId === "string") targets.add(item.mapId);
  });
  return targets;
}

function reachableMaps(doc) {
  const maps = doc.maps ?? {};
  const commonEvents = Array.isArray(doc.commonEvents) ? doc.commonEvents : [];
  const seen = new Set();
  const queue = [];
  const reach = (id) => {
    if (typeof id === "string" && maps[id] && !seen.has(id)) {
      seen.add(id);
      queue.push(id);
    }
  };
  reach(doc.startMapId);
  const endingTargets = (Array.isArray(doc.endings) ? doc.endings : []).map((ending) => ending?.continueTo?.mapId);
  for (const id of endingTargets) reach(id);
  const usedCommon = new Set();
  while (queue.length > 0) {
    const mapId = queue.pop();
    const events = maps[mapId].events ?? [];
    for (const id of transferTargets(events)) reach(id);
    const strings = new Set();
    collectStrings(events, strings);
    for (const common of commonEvents) {
      if (typeof common?.id === "string" && strings.has(common.id) && !usedCommon.has(common.id)) {
        usedCommon.add(common.id);
        for (const id of transferTargets(common)) reach(id);
      }
    }
  }
  return { reached: seen, usedCommon };
}

/** 척도가 센다고 인정하는 맵·이벤트 집합. */
export function countedContent(doc) {
  const maps = doc.maps ?? {};
  const { reached, usedCommon } = reachableMaps(doc);
  const layouts = new Set();
  const countedMaps = [];
  const eventByHash = new Map();
  for (const mapId of reached) {
    const map = maps[mapId];
    if (!(map.width * map.height >= MIN_MAP_CELLS)) continue;
    if (tileKinds(map).size < MIN_TILE_KINDS) continue;
    const mapEvents = (map.events ?? []).filter((event) => commandCount(event) > 0);
    if (mapEvents.length === 0) continue;
    const hash = layoutHash(map);
    if (layouts.has(hash)) continue;
    layouts.add(hash);
    countedMaps.push({ id: mapId, map });
    for (const event of mapEvents) {
      const key = eventHash(event);
      if (!eventByHash.has(key)) eventByHash.set(key, { event, mapId });
    }
  }
  const commonEvents = (Array.isArray(doc.commonEvents) ? doc.commonEvents : []).filter(
    (common) => usedCommon.has(common.id) && commandCount({ commands: common.commands }) > 0,
  );
  return { countedMaps, events: [...eventByHash.values()], commonEvents };
}

// ---------- 닿는 DB ----------
function reachedDb(doc, content, baseline) {
  const reached = new Set();
  collectStrings(
    [content.events.map((item) => item.event), content.commonEvents, doc.quests, doc.endings, doc.system],
    reached,
  );
  const tables = Object.fromEntries(DB_TABLES.map((table) => [table, Array.isArray(doc.database?.[table]) ? doc.database[table] : []]));
  let grew = true;
  const taken = new Set();
  while (grew) {
    grew = false;
    for (const table of DB_TABLES) {
      for (const entry of tables[table]) {
        const key = `${table}:${entry.id}`;
        if (entry && typeof entry.id === "string" && reached.has(entry.id) && !taken.has(key)) {
          taken.add(key);
          collectStrings(entry, reached);
          grew = true;
        }
      }
    }
  }
  const out = {};
  for (const table of DB_TABLES) {
    const base = baseline?.database?.[table];
    const baseHash = new Map((Array.isArray(base) ? base : []).map((entry) => [entry.id, sha(canon(entry, DROP_ID))]));
    const distinct = new Set();
    for (const entry of tables[table]) {
      if (!taken.has(`${table}:${entry.id}`)) continue;
      if (baseHash.get(entry.id) === sha(canon(entry, DROP_ID))) continue;
      distinct.add(sha(canon(entry, DROP_LOOK)));
    }
    out[table] = distinct.size;
  }
  return out;
}

// ---------- 양 세기 ----------
function progressionDepth(events) {
  const tokenOf = (kind, node) => (kind === "switch" ? `s:${node.switchId}` : `v:${node.variableId}`);
  const nodes = events.map(({ event }) => {
    const needs = new Set();
    const sets = new Set();
    walk(event, (node) => {
      if ((node.kind === "switch" || node.kind === "variable") && (node.switchId || node.variableId)) needs.add(tokenOf(node.kind, node));
      if (node.kind === "setSwitch" && node.value && node.switchId) sets.add(`s:${node.switchId}`);
      if (node.kind === "setVariable" && node.variableId) sets.add(`v:${node.variableId}`);
    });
    return { needs, sets };
  });
  const setters = new Map();
  nodes.forEach((node, index) => {
    for (const token of node.sets) {
      if (!setters.has(token)) setters.set(token, []);
      setters.get(token).push(index);
    }
  });
  const depth = new Array(nodes.length).fill(-1);
  const state = new Array(nodes.length).fill(0);
  const visit = (index) => {
    if (state[index] === 2) return depth[index];
    if (state[index] === 1) return 0;
    state[index] = 1;
    let best = 0;
    for (const token of nodes[index].needs) {
      for (const setter of setters.get(token) ?? []) {
        if (setter !== index) best = Math.max(best, 1 + visit(setter));
      }
    }
    state[index] = 2;
    depth[index] = best;
    return best;
  };
  let max = 0;
  for (let index = 0; index < nodes.length; index += 1) max = Math.max(max, visit(index));
  return max;
}

function questFacts(doc) {
  const quests = Array.isArray(doc.quests) ? doc.quests : [];
  const titles = new Set();
  const stepKeys = new Set();
  for (const quest of quests) {
    const steps = quest.steps ?? quest.nodes ?? [];
    const own = new Set();
    for (const step of Array.isArray(steps) ? steps : []) {
      const text = normalizeLine(step.label ?? step.description ?? step.title ?? "");
      if (text) own.add(text);
    }
    if (own.size < 2) continue;
    const title = normalizeLine(quest.title ?? quest.key ?? quest.id ?? "");
    if (!title || titles.has(title)) continue;
    titles.add(title);
    for (const text of own) stepKeys.add(`${title}|${text}`);
  }
  return { quests: titles.size, questSteps: stepKeys.size };
}

function musicIds(doc, content, baseline) {
  const ids = new Set();
  const take = (id) => {
    if (typeof id === "string" && id) ids.add(id);
  };
  for (const { map } of content.countedMaps) take(map.bgm?.resourceId);
  const scan = (node) =>
    walk(node, (item) => {
      if (item.kind === "playAudio" && item.channel === "bgm") take(item.resourceId);
      if (item.commandId === "m2-027-change-system-bgm" && item.fields?.operation === "set") take(item.fields.resourceId);
    });
  scan(content.events.map((entry) => entry.event));
  scan(content.commonEvents);
  for (const ending of Array.isArray(doc.endings) ? doc.endings : []) take(ending?.presentation?.musicResourceId);
  take(doc.system?.defaultBgmResourceId);
  take(doc.system?.battleBgmResourceId);
  const opening = (doc.meta?.oprnCinematicTimelines?.entries ?? []).find((entry) => entry.target === "opening" && entry.authored?.enabled);
  take(opening?.authored?.musicResourceId);
  for (const id of [baseline?.system?.defaultBgmResourceId, baseline?.system?.battleBgmResourceId]) if (id) ids.delete(id);
  return ids.size;
}

function openingAuthored(doc, baseline) {
  const timelines = doc.meta?.oprnCinematicTimelines?.entries ?? [];
  if (timelines.some((entry) => entry.target === "opening" && entry.authored?.enabled)) return true;
  const opening = doc.system?.opening;
  if (!opening?.enabled) return false;
  const factory = new Set((baseline?.system?.opening?.scenes ?? []).map((scene) => scene.resourceId).filter(Boolean));
  const own = (opening.scenes ?? []).map((scene) => scene.resourceId).filter(Boolean);
  return own.some((id) => !factory.has(id));
}

/** 가중치 없이 센 원시 양. */
export function measure(doc, baseline) {
  const content = countedContent(doc);
  const db = reachedDb(doc, content, baseline);
  const lines = new Set();
  const speakers = new Set();
  const cutsceneEvents = new Set();
  const scanTexts = (node) =>
    walk(node, (item) => {
      if (item.kind === "text") {
        const line = normalizeLine(item.body ?? item.text ?? "");
        if (line.length >= MIN_LINE_CHARS) lines.add(line);
        const speaker = normalizeLine(item.speaker ?? "");
        if (speaker) speakers.add(speaker);
      }
    });
  content.events.forEach(({ event }, index) => {
    scanTexts(event);
    let cut = false;
    walk(event, (item) => {
      if (item.kind === "cutsceneControl" && item.mode === "begin") cut = true;
    });
    if (cut) cutsceneEvents.add(index);
  });
  scanTexts(content.commonEvents);
  const quests = questFacts(doc);
  const endings = new Set();
  for (const ending of Array.isArray(doc.endings) ? doc.endings : []) {
    const key = normalizeLine(ending?.name ?? ending?.id ?? "");
    if (key && (ending.presentation || (ending.conditions ?? []).length > 0)) endings.add(key);
  }
  const tilesets = new Set(content.countedMaps.map(({ map }) => map.tilesetId).filter(Boolean));
  const roles = new Set(content.countedMaps.map(({ map }) => map.mapRole).filter(Boolean));
  return {
    maps: content.countedMaps.length,
    events: content.events.length,
    dialogue: lines.size,
    enemies: db.enemies,
    skills: db.skills,
    items: db.items + db.equipment,
    quests: quests.quests,
    quest_steps: quests.questSteps,
    endings: endings.size,
    music: musicIds(doc, content, baseline),
    cutscenes: cutsceneEvents.size + (openingAuthored(doc, baseline) ? 1 : 0),
    cast: speakers.size,
    area_variety: tilesets.size + roles.size,
    act_structure: progressionDepth(content.events),
  };
}

export function loadWeights(path = DEFAULT_WEIGHTS_PATH) {
  return JSON.parse(readFileSync(path, "utf8"));
}

/** 0~100. FS 실측과 같거나 많으면 그 칸은 만점. */
export function scoreProject(doc, options = {}) {
  const weights = options.weights ?? loadWeights();
  const raw = measure(doc, options.baseline);
  const components = weights.components.map((component) => {
    const value = raw[component.id] ?? 0;
    const ratio = Math.min(1, value / component.reference);
    return { id: component.id, value, reference: component.reference, ratio, weight: component.weight, points: component.weight * ratio };
  });
  const score = components.reduce((sum, item) => sum + item.points, 0);
  return { score: Math.round(score * 10) / 10, components, raw };
}

// ---------- CLI ----------
function parseArgs(argv) {
  const args = { files: [], baseline: undefined, measure: false, json: false, weights: undefined };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--baseline") args.baseline = argv[(index += 1)];
    else if (arg === "--weights") args.weights = argv[(index += 1)];
    else if (arg === "--measure") args.measure = true;
    else if (arg === "--json") args.json = true;
    else args.files.push(arg);
  }
  return args;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = parseArgs(process.argv.slice(2));
  if (args.files.length === 0) {
    console.error("usage: node scripts/fs-scale/score.mjs [--baseline blank.project.json] [--measure] [--json] <project.json>...");
    process.exit(2);
  }
  const baseline = args.baseline ? JSON.parse(readFileSync(args.baseline, "utf8")) : undefined;
  const weights = args.weights || !args.measure ? loadWeights(args.weights) : undefined;
  const rows = [];
  for (const file of args.files) {
    const doc = JSON.parse(readFileSync(file, "utf8"));
    rows.push({ file, ...(args.measure ? { raw: measure(doc, baseline) } : scoreProject(doc, { weights, baseline })) });
  }
  if (args.json) console.log(JSON.stringify(rows, null, 2));
  else for (const row of rows) console.log(args.measure ? `${row.file}\n${JSON.stringify(row.raw)}` : `${String(row.score).padStart(5)}  ${row.file}`);
}
