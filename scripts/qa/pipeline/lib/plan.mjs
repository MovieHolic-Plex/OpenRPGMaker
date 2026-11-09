// Coverage planner + static lint. Pure functions over a shipped project.json: no browser, no model.
// A job boots the shipped player at a qaCheckpoint (startEventId / startTroopId) so late content is reached
// directly instead of replaying from the title.

export const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  laptop: { width: 1280, height: 720 },
  phoneLandscape: { width: 844, height: 390, touch: true },
  phonePortrait: { width: 390, height: 844, touch: true },
};

const CONTENT_KINDS = new Set(["text", "choices", "shop", "inn", "battleProcessing", "transfer", "triggerEnding", "changeFace", "openSaveMenu", "checkpointSave"]);

/** Every command in a list, including nested branches (fork then/else, choice branches, loop bodies, battle result branches). */
export function walkCommands(commands, visit) {
  for (const command of commands ?? []) {
    if (!command || typeof command !== "object") continue;
    visit(command);
    for (const value of Object.values(command)) {
      if (!Array.isArray(value) || value.length === 0 || typeof value[0] !== "object" || value[0] === null) continue;
      if (value[0].kind) walkCommands(value, visit);
      else for (const entry of value) {
        if (Array.isArray(entry?.commands)) walkCommands(entry.commands, visit);
        if (Array.isArray(entry?.branch)) walkCommands(entry.branch, visit);
      }
    }
  }
}

function pageSummary(page) {
  const kinds = new Set();
  let textLines = 0;
  walkCommands(page.commands, (c) => {
    kinds.add(c.kind);
    if (c.kind === "text") textLines += String(c.body ?? "").split("\n").length;
  });
  return { kinds, textLines };
}

/**
 * Conditions on the path from a page's top to the first command of `kind`: fork `then` takes the condition,
 * `else` its negation (switches only). Returns null when the command is not on the page.
 */
function pathConditions(commands, kind) {
  for (const c of commands ?? []) {
    if (c.kind === kind) return [];
    if (c.kind === "fork") {
      const inThen = pathConditions(c.then, kind);
      if (inThen) return [c.condition, ...inThen];
      const inElse = pathConditions(c.else, kind);
      if (inElse) return [c.condition?.kind === "switch" ? { ...c.condition, value: c.condition.value === false } : { kind: "unsolvable" }, ...inElse];
    }
    for (const v of Object.values(c)) {
      if (!Array.isArray(v) || !v.length || typeof v[0] !== "object" || v[0] === null || c.kind === "fork") continue;
      const nested = v[0].kind ? pathConditions(v, kind) : v.map((x) => pathConditions(x?.branch ?? x?.commands, kind)).find(Boolean);
      if (nested) return nested;
    }
  }
  return null;
}

function battlePath(commands, troopId) {
  const marked = (list) => (list ?? []).map((c) => (c.kind === "battleProcessing" && c.troopId === troopId ? { ...c, kind: "__target_battle" } : c));
  const remap = (list) => marked(list).map((c) => (c.kind === "fork" ? { ...c, then: remap(c.then), else: remap(c.else) } : c));
  return pathConditions(remap(commands), "__target_battle");
}

/** Fold conditions into checkpoint state; null when they contradict each other or need something unsupported. */
function solveConditions(conditions) {
  const state = { switches: {}, items: {}, variables: {} };
  const visit = (c) => {
    if (!c) return true;
    if (c.kind === "all") return (c.conditions ?? []).every(visit);
    if (c.kind === "switch") { const v = c.value !== false; if (c.switchId in state.switches && state.switches[c.switchId] !== v) return false; state.switches[c.switchId] = v; return true; }
    if (c.kind === "item") { if (c.present === false) return true; state.items[c.itemId] = Math.max(state.items[c.itemId] ?? 0, c.amount ?? 1); return true; }
    if (c.kind === "variable" && [">=", "==", "="].includes(c.op)) { state.variables[c.variableId] = c.value; return true; }
    return c.kind === "selfSwitch" || c.kind === "actor" || c.kind === "partyKnowsSkill";
  };
  return conditions.every(visit) ? state : null;
}

function pageCheckpointState(page) {
  const switches = {};
  const selfSwitches = {};
  for (const condition of page.conditions ?? []) {
    if (condition.kind === "switch") switches[condition.switchId] = condition.value !== false;
    if (condition.kind === "selfSwitch") selfSwitches[condition.key] = condition.value !== false;
  }
  return { switches, selfSwitches };
}

function standTile(map, event) {
  // Stand next to the event (below, above, left, right); the checkpoint runs the event directly, so this only
  // decides what the camera frames — but the hero is drawn there. Prefer a cell without an upper-layer tile (roof, wall
  // top, prop — some upper tiles are walkable grass details, so this is a preference, not passability): standing on one drew the hero on a house roof (폴른 스타 1.39 광역 QA a1, fs_hub 오프닝 컷신 (28,37) 아래 칸이 지붕).
  const n = map.width * map.height;
  const free = (x, y) => {
    if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
    const i = y * map.width + x;
    if (i >= n) return false;
    if ((map.upperTiles?.[i] ?? -1) >= 0 || (map.upperOverlayTiles?.[i] ?? -1) >= 0) return false;
    return !(map.events ?? []).some((other) => other !== event && other.x === x && other.y === y);
  };
  for (const [dx, dy, facing] of [[0, 1, "up"], [0, -1, "down"], [-1, 0, "right"], [1, 0, "left"]]) {
    if (free(event.x + dx, event.y + dy)) return { x: event.x + dx, y: event.y + dy, facing };
  }
  const y = event.y + 1 < map.height ? event.y + 1 : Math.max(0, event.y - 1);
  return { x: event.x, y, facing: y > event.y ? "up" : "down" };
}

/**
 * Party + gear for one checkpoint. `story` is scripts/qa/pipeline/data/story-levels.json — the level, gold and gear tier
 * a normal playthrough has when it reaches that fight (scripts/qa/runtime/fs-story-levels.mts). Without it every
 * checkpoint fell back to one flat level, which made late bosses trivial and early fights unfair.
 */
function checkpointParty(project, entry, partyLevel, gearSets) {
  const actors = project.system?.startActorIds ?? [];
  const lv = Math.max(1, Math.min(99, Math.round(entry?.level ?? partyLevel)));
  const party = actors.map((actorId) => ({ actorId, level: lv }));
  const gearTier = entry?.gearTier ?? 0;
  const gear = gearTier ? gearSets?.[gearTier] : null;
  const extra = {};
  if (gear) {
    const equipment = {};
    for (const [actorId, slots] of Object.entries(gear)) {
      const actor = project.database?.actors?.find((candidate) => candidate.id === actorId);
      equipment[actorId] = { ...(actor?.initialEquipment ?? {}), ...slots };
    }
    if (Object.keys(equipment).length) extra.sessionPatch = { actorEquipment: equipment };
  }
  if (typeof entry?.gold === "number" && entry.gold > 0) extra.gold = entry.gold;
  return { party, extra, level: lv, gearTier };
}

/** Battle states: expected (story level/gear), weak (−3 levels, one gear tier less) and strong (+3 levels). */
export const BATTLE_STATES = [
  { id: "expected", label: "예상", dLevel: 0, dTier: 0 },
  { id: "weak", label: "−3레벨·장비 한 단계 아래", dLevel: -3, dTier: -1 },
  { id: "strong", label: "+3레벨", dLevel: 3, dTier: 0 },
];

/**
 * Build the job list. Each job = { id, kind, label, checkpoint, ops: high-level script name, viewport, input, target }.
 * kinds: title, menu, map, event, battle, shop, ending. Input modes rotate keyboard -> mouse -> touch so every kind
 * is seen with each input; viewports rotate the same way (touch jobs get phone viewports).
 */
export function planCoverage(project, { game, maxEvents = 400, partyLevel = 12, story = null } = {}) {
  const jobs = [];
  const push = (job) => jobs.push({ game, ...job, id: `${job.kind}-${String(jobs.length).padStart(4, "0")}` });
  /** Level of the party when the story reaches this map (first story fight on it), else the flat fallback. */
  const gearSets = story?.gearSets ?? null;
  const mapStory = (mapId) => {
    for (const entry of Object.values(story?.byTroop ?? {})) if (entry?.map === mapId) return entry;
    return null;
  };
  const startParty = checkpointParty(project, mapStory(project.startMapId), partyLevel, gearSets);

  push({ kind: "title", label: "타이틀 → 새 게임", checkpoint: null, script: "title" });
  push({ kind: "menu", label: "메뉴 전체 순회", checkpoint: { id: "menu", mapId: project.startMapId, x: project.startPos?.x, y: project.startPos?.y, party: startParty.party, ...startParty.extra }, script: "menu" });

  const transferIn = new Map();
  const battleEvents = new Map();
  for (const map of Object.values(project.maps)) {
    for (const event of map.events ?? []) {
      for (const page of event.pages ?? []) {
        walkCommands(page.commands, (c) => {
          if (c.kind === "transfer" && c.mapId && !transferIn.has(c.mapId)) transferIn.set(c.mapId, { x: c.x, y: c.y, facing: c.direction ?? "down" });
          if (c.kind !== "battleProcessing" || !c.troopId) return;
          // The runtime runs the event's current page, so the checkpoint must make the page holding the battle
          // current and its path to the battle true; story battles gated by switches otherwise run another page.
          const solved = solveConditions([...(page.conditions ?? []), ...(battlePath(page.commands, c.troopId) ?? [])]);
          const prev = battleEvents.get(c.troopId);
          if (!prev || (!prev.state && solved)) battleEvents.set(c.troopId, { mapId: map.id, x: event.x, y: event.y, state: solved });
        });
      }
    }
  }

  for (const map of Object.values(project.maps)) {
    const entry = transferIn.get(map.id) ?? (map.id === project.startMapId ? { ...project.startPos, facing: "down" } : { x: Math.floor(map.width / 2), y: Math.floor(map.height / 2), facing: "down" });
    const party = checkpointParty(project, mapStory(map.id), partyLevel, gearSets);
    push({ kind: "map", label: `${map.name ?? map.id} 둘러보기`, target: { mapId: map.id }, checkpoint: { id: `map-${map.id}`, mapId: map.id, x: entry.x, y: entry.y, facing: entry.facing, party: party.party, ...party.extra }, script: "walk" });
  }

  const eventJobs = [];
  for (const map of Object.values(project.maps)) {
    for (const event of map.events ?? []) {
      const pages = (event.pages ?? []).map((page, index) => ({ page, index, ...pageSummary(page) }))
        .filter((p) => ["action", "auto", "playerTouch"].includes(p.page.trigger?.kind) && [...p.kinds].some((k) => CONTENT_KINDS.has(k)));
      if (pages.length === 0) continue;
      // One job per event: the page with the most player-facing content (dialogue lines, shops, choices).
      // A shop/inn event is planned on a page whose conditions plus the path to the shop are satisfiable together.
      const ranked = pages.sort((a, b) => b.textLines + b.kinds.size - (a.textLines + a.kinds.size));
      let best = ranked[0];
      let extra = { switches: {}, items: {}, variables: {} };
      for (const target of ["shop", "inn"]) {
        const options = ranked.map((p) => ({ p, path: pathConditions(p.page.commands, target) })).filter((x) => x.path);
        const solved = options.map((x) => ({ ...x, state: solveConditions([...(x.p.page.conditions ?? []), ...x.path]) })).find((x) => x.state);
        if (solved) { best = solved.p; extra = solved.state; break; }
      }
      const { switches: pageSwitches, selfSwitches } = pageCheckpointState(best.page);
      const switches = { ...pageSwitches, ...extra.switches };
      const stand = standTile(map, event);
      const kind = best.kinds.has("triggerEnding") ? "ending" : best.kinds.has("shop") || best.kinds.has("inn") ? "shop" : "event";
      const party = checkpointParty(project, mapStory(map.id), partyLevel, gearSets);
      eventJobs.push({
        kind, label: `${map.name ?? map.id} · ${best.page.name ?? event.id}`,
        target: { mapId: map.id, eventId: event.id, page: best.index, kinds: [...best.kinds].filter((k) => CONTENT_KINDS.has(k)) },
        checkpoint: {
          id: `ev-${event.id}`, mapId: map.id, ...stand, party: party.party, switches, ...party.extra,
          ...(Object.keys(extra.items).length ? { items: extra.items } : {}),
          ...(Object.keys(extra.variables).length ? { variables: extra.variables } : {}),
          ...(Object.keys(selfSwitches).length ? { selfSwitches: { [event.id]: selfSwitches } } : {}),
          startEventId: event.id,
        },
        script: "event", weight: best.textLines + (kind === "event" ? 0 : 50),
      });
    }
  }
  eventJobs.sort((a, b) => b.weight - a.weight);
  for (const job of eventJobs.slice(0, maxEvents)) push(job);

  for (const [troopId, at] of battleEvents) {
    const st = at.state ?? { switches: {}, items: {}, variables: {} };
    const storyEntry = story?.byTroop?.[troopId] ?? null;
    const baseLevel = storyEntry?.level ?? partyLevel;
    const baseTier = storyEntry?.gearTier ?? 0;
    const name = project.database.troops.find((t) => t.id === troopId)?.name ?? troopId;
    for (const state of BATTLE_STATES) {
      const level = Math.max(1, Math.min(99, baseLevel + state.dLevel));
      const tier = Math.max(0, baseTier + state.dTier);
      const party = checkpointParty(project, { ...(storyEntry ?? {}), level, gearTier: tier }, partyLevel, gearSets);
      push({ kind: "battle", label: `전투 ${name} · ${state.label} (Lv${level})`, target: { troopId, mapId: at.mapId, state: state.id, level, gearTier: tier }, checkpoint: {
        id: `battle-${troopId}-${state.id}`, mapId: at.mapId, x: at.x, y: Math.min(at.y + 1, (project.maps[at.mapId]?.height ?? 2) - 1), party: party.party, startTroopId: troopId, ...party.extra,
        ...(Object.keys(st.switches).length ? { switches: st.switches } : {}),
        ...(Object.keys(st.items).length ? { items: st.items } : {}),
        ...(Object.keys(st.variables).length ? { variables: st.variables } : {}),
      }, script: "battle" });
    }
  }

  const inputs = ["keyboard", "mouse", "touch"];
  const desktopViews = ["desktop", "laptop"];
  const touchViews = ["phoneLandscape", "phonePortrait"];
  for (const job of adversarialJobs(project, { game, partyLevel, story, gearSets, mapStory })) push(job);
  jobs.forEach((job, index) => {
    if (job.input && job.viewportName) { job.viewport = VIEWPORTS[job.viewportName]; return; }
    job.input = inputs[index % inputs.length];
    job.viewportName = job.input === "touch" ? touchViews[Math.floor(index / 3) % 2] : desktopViews[Math.floor(index / 3) % 2];
    job.viewport = VIEWPORTS[job.viewportName];
  });
  return jobs;
}

/**
 * Adversarial input track (owner: QA:VQA 5:5, „게임 플레이 위주로 적대적으로"). Ten scripted players that do what a
 * real player does on purpose: mash through dialogue, open menus mid-battle, try to buy with no money, shove into map
 * edges, save/load in a loop, and mix keyboard + mouse + touch in one session. All four viewports appear.
 */
function adversarialJobs(project, { game, partyLevel, story, gearSets, mapStory }) {
  const mapIds = Object.keys(project.maps);
  const withEvents = mapIds.filter((id) => (project.maps[id].events ?? []).length >= 3);
  const battleTroops = [];
  const shopMaps = [];
  const savepointMaps = [];
  const walk = (commands, visit) => {
    for (const command of commands ?? []) {
      if (!command || typeof command !== "object") continue;
      visit(command);
      for (const value of Object.values(command)) {
        if (!Array.isArray(value) || !value.length || typeof value[0] !== "object" || !value[0]) continue;
        if (value[0].kind) walk(value, visit);
        else for (const entry of value) {
          if (Array.isArray(entry?.commands)) walk(entry.commands, visit);
          if (Array.isArray(entry?.branch)) walk(entry.branch, visit);
        }
      }
    }
  };
  for (const mapId of mapIds) {
    for (const event of project.maps[mapId].events ?? []) {
      for (const page of event.pages ?? []) {
        walk(page.commands, (command) => {
          if (command.kind === "battleProcessing" && command.troopId && !battleTroops.includes(command.troopId)) battleTroops.push({ troopId: command.troopId, mapId, event });
          if (command.kind === "shop" && !shopMaps.includes(mapId)) shopMaps.push(mapId);
          if (command.kind === "openSaveMenu" && !savepointMaps.includes(mapId)) savepointMaps.push({ mapId, event, page });
        });
      }
    }
  }
  const pick = (list, index) => (list.length ? list[index % list.length] : null);
  const jobs = [];
  const add = (spec) => {
    const party = checkpointParty(project, mapStory(spec.mapId), partyLevel, gearSets);
    jobs.push({ game, ...spec, viewport: VIEWPORTS[spec.viewportName], checkpoint: { ...(spec.checkpoint ?? {}), id: `adv-${spec.adversarial}`, mapId: spec.mapId, party: party.party, ...party.extra }, kind: "adversarial", script: "adversarial" });
  };
  const textMap = pick(withEvents, 0) ?? project.startMapId;
  const textMap2 = pick(withEvents, 3) ?? textMap;
  const battle1 = pick(battleTroops, 0);
  const battle2 = pick(battleTroops, 5);
  const shop1 = pick(shopMaps, 0);
  const shop2 = pick(shopMaps, 1);
  const save1 = pick(savepointMaps, 0);

  add({ adversarial: "mash-dialogue", label: "대사 몰아치기(Enter·방향키·클릭 동시)", mapId: textMap, input: "keyboard", viewportName: "desktop" });
  add({ adversarial: "mash-dialogue-touch", label: "대사 몰아치기(터치 연타)", mapId: textMap2, input: "touch", viewportName: "phonePortrait" });
  if (battle1) add({ adversarial: "menu-mid-battle", label: "전투 중 메뉴·취소 연타", mapId: battle1.mapId, input: "keyboard", viewportName: "laptop", target: { troopId: battle1.troopId }, checkpoint: { startTroopId: battle1.troopId, x: battle1.event.x, y: Math.min(battle1.event.y + 1, (project.maps[battle1.mapId]?.height ?? 2) - 1) } });
  if (battle2) add({ adversarial: "menu-mid-battle-mouse", label: "전투 중 마우스로 명령·메뉴 뒤섞기", mapId: battle2.mapId, input: "mouse", viewportName: "phoneLandscape", target: { troopId: battle2.troopId }, checkpoint: { startTroopId: battle2.troopId, x: battle2.event.x, y: Math.min(battle2.event.y + 1, (project.maps[battle2.mapId]?.height ?? 2) - 1) } });
  if (shop1) add({ adversarial: "broke-shopper", label: "돈 없이 상점에서 사기 시도", mapId: shop1, input: "keyboard", viewportName: "desktop", checkpoint: { gold: 0 } });
  if (shop2) add({ adversarial: "broke-shopper-touch", label: "돈 없이 상점(터치)", mapId: shop2, input: "touch", viewportName: "phonePortrait", checkpoint: { gold: 0 } });
  add({ adversarial: "map-edges", label: "맵 네 가장자리로 밀어 넣기", mapId: textMap, input: "keyboard", viewportName: "laptop" });
  add({ adversarial: "map-edges-mouse", label: "맵 가장자리(마우스 이동)", mapId: textMap2, input: "mouse", viewportName: "desktop" });
  if (save1) add({ adversarial: "save-load", label: "세이브 포인트에서 저장·불러오기 반복", mapId: save1.mapId, input: "keyboard", viewportName: "laptop", checkpoint: { startEventId: save1.event.id, x: save1.event.x, y: save1.event.y } });
  add({ adversarial: "mixed-input", label: "키보드·마우스·터치 동시 사용", mapId: project.startMapId, input: "mouse", viewportName: "phoneLandscape" });
  return jobs.slice(0, 10);
}

/** Static checks that need no browser: dangling resource ids, unreachable maps, out-of-bounds transfers, overlong lines. */
export function staticLint(project, { game, maxLineChars = 34 } = {}) {
  const findings = [];
  const resourceIds = new Set([
    ...(project.resourceProfiles ?? []).map((r) => r.assetId),
    ...Object.keys(project.assets?.uploaded ?? {}),
  ]);
  const seen = new Set();
  const add = (f) => {
    const key = `${f.check}|${f.where}|${f.claim}`;
    if (seen.has(key)) return;
    seen.add(key);
    findings.push({ game, source: "static", id: `S${String(findings.length + 1).padStart(3, "0")}`, ...f });
  };
  const profileKind = new Map((project.resourceProfiles ?? []).map((r) => [r.assetId, r]));
  const uploaded = project.assets?.uploaded ?? {};
  /** Cells in a charset sheet, or null when the sheet size is unknown. */
  const charsetCells = (sprite) => {
    const meta = sprite.type === "uploaded" ? uploaded[sprite.id]?.meta : profileKind.get(sprite.id);
    const w = meta?.width ?? meta?.imageWidth, h = meta?.height ?? meta?.imageHeight;
    const fw = meta?.frameWidth ?? meta?.tileWidth, fh = meta?.frameHeight ?? meta?.tileHeight;
    return w && h && fw && fh ? Math.floor(w / fw) * Math.floor(h / fh) : null;
  };
  const reachable = new Set([project.startMapId]);
  for (const map of Object.values(project.maps)) {
    for (const event of map.events ?? []) {
      for (const page of event.pages ?? []) {
        const sprite = page.graphic?.sprite;
        if (sprite?.type === "uploaded" && sprite.id && !resourceIds.has(sprite.id)) add({ check: "missing-resource", severity: "visual", where: `${map.id} ${event.id}`, claim: `이벤트 그림 자원 ${sprite.id} 이 프로젝트에 없다`, target: { mapId: map.id, eventId: event.id } });
        const cells = sprite && Number.isInteger(page.graphic?.pattern) ? charsetCells(sprite) : null;
        if (cells && (page.graphic.pattern < 0 || page.graphic.pattern >= cells)) add({ check: "sprite-cell-range", severity: "visual", where: `${map.id} ${event.id}`, claim: `NPC 그림 ${sprite.id} 의 칸 번호 ${page.graphic.pattern} 이 시트 칸 수 ${cells} 밖이다 — 엉뚱한 칸이나 빈 그림이 그려진다`, target: { mapId: map.id, eventId: event.id } });
        walkCommands(page.commands, (c) => {
          if (c.kind === "transfer" && c.mapId) {
            reachable.add(c.mapId);
            const dest = project.maps[c.mapId];
            if (!dest) add({ check: "bad-transfer", severity: "blocker", where: `${map.id} ${event.id}`, claim: `없는 맵 ${c.mapId} 로 이동`, target: { mapId: map.id, eventId: event.id } });
            else if (c.x < 0 || c.y < 0 || c.x >= dest.width || c.y >= dest.height) add({ check: "bad-transfer", severity: "blocker", where: `${map.id} ${event.id}`, claim: `${c.mapId} 밖 좌표 (${c.x},${c.y}) 로 이동 (맵 ${dest.width}x${dest.height})`, target: { mapId: map.id, eventId: event.id } });
          }
          if (c.kind === "changeFace" && c.resourceId && !resourceIds.has(c.resourceId) && !/^shared-|^oprn_|^cc0-|^generated-/.test(c.resourceId)) add({ check: "missing-resource", severity: "visual", where: `${map.id} ${event.id}`, claim: `초상 자원 ${c.resourceId} 이 프로젝트에 없다`, target: { mapId: map.id, eventId: event.id } });
          const faceKind = c.kind === "changeFace" && c.resourceId ? (profileKind.get(c.resourceId)?.kind ?? uploaded[c.resourceId]?.kind) : null;
          if (faceKind && !["faceset", "portrait", "bust"].includes(faceKind)) add({ check: "portrait-kind", severity: "visual", where: `${map.id} ${event.id}`, claim: `대사 초상에 얼굴이 아닌 자원(${faceKind}: ${c.resourceId})을 썼다`, target: { mapId: map.id, eventId: event.id } });
          if (c.kind === "text") {
            const longest = Math.max(...String(c.body ?? "").split("\n").map((l) => [...l].length));
            if (longest > maxLineChars * 2) add({ check: "long-line", severity: "text", where: `${map.id} ${event.id}`, claim: `대사 한 줄이 ${longest}자(기준 ${maxLineChars * 2}자 초과): ${String(c.body).slice(0, 60)}…`, target: { mapId: map.id, eventId: event.id } });
          }
          if (c.kind === "shop") {
            const known = new Set([...(project.database.items ?? []), ...(project.database.equipment ?? [])].map((i) => i.id));
            const missing = (c.itemIds ?? []).filter((id) => !known.has(id));
            if (missing.length) add({ check: "bad-shop", severity: "function", where: `${map.id} ${event.id}`, claim: `상점 품목 ${missing.join(", ")} 이 DB 에 없다`, target: { mapId: map.id, eventId: event.id } });
          }
          if (c.kind === "loop") {
            let breaks = false;
            walkCommands(c.body, (inner) => { if (inner.kind === "breakLoop" || inner.kind === "transfer" || inner.kind === "triggerEnding") breaks = true; });
            if (!breaks) add({ check: "endless-loop", severity: "blocker", where: `${map.id} ${event.id}`, claim: "반복(loop)에 빠져나가는 명령이 없다 — 이벤트가 끝나지 않는다", target: { mapId: map.id, eventId: event.id } });
          }
        });
      }
    }
  }
  for (const map of Object.values(project.maps)) {
    if (!reachable.has(map.id) && (map.events ?? []).length > 0) add({ check: "unreachable-map", severity: "function", where: map.id, claim: `어느 이동 명령도 ${map.name ?? map.id} 로 가지 않는다`, target: { mapId: map.id } });
  }
  return findings;
}
