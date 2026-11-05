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
  // Stand below the event when inside the map, else above; the checkpoint runs the event directly, so this only
  // decides what the camera frames.
  const y = event.y + 1 < map.height ? event.y + 1 : Math.max(0, event.y - 1);
  return { x: event.x, y, facing: y > event.y ? "up" : "down" };
}

/**
 * Build the job list. Each job = { id, kind, label, checkpoint, ops: high-level script name, viewport, input, target }.
 * kinds: title, menu, map, event, battle, shop, ending. Input modes rotate keyboard -> mouse -> touch so every kind
 * is seen with each input; viewports rotate the same way (touch jobs get phone viewports).
 */
export function planCoverage(project, { game, maxEvents = 400, partyLevel = 12 } = {}) {
  const party = (project.system?.startActorIds ?? []).map((actorId) => ({ actorId, level: partyLevel }));
  const jobs = [];
  const push = (job) => jobs.push({ game, ...job, id: `${job.kind}-${String(jobs.length).padStart(4, "0")}` });

  push({ kind: "title", label: "타이틀 → 새 게임", checkpoint: null, script: "title" });
  push({ kind: "menu", label: "메뉴 전체 순회", checkpoint: { id: "menu", mapId: project.startMapId, x: project.startPos?.x, y: project.startPos?.y, party }, script: "menu" });

  const transferIn = new Map();
  const battleEvents = new Map();
  for (const map of Object.values(project.maps)) {
    for (const event of map.events ?? []) {
      for (const page of event.pages ?? []) {
        walkCommands(page.commands, (c) => {
          if (c.kind === "transfer" && c.mapId && !transferIn.has(c.mapId)) transferIn.set(c.mapId, { x: c.x, y: c.y, facing: c.direction ?? "down" });
          if (c.kind === "battleProcessing" && c.troopId && !battleEvents.has(c.troopId)) battleEvents.set(c.troopId, { mapId: map.id, x: event.x, y: event.y });
        });
      }
    }
  }

  for (const map of Object.values(project.maps)) {
    const entry = transferIn.get(map.id) ?? (map.id === project.startMapId ? { ...project.startPos, facing: "down" } : { x: Math.floor(map.width / 2), y: Math.floor(map.height / 2), facing: "down" });
    push({ kind: "map", label: `${map.name ?? map.id} 둘러보기`, target: { mapId: map.id }, checkpoint: { id: `map-${map.id}`, mapId: map.id, x: entry.x, y: entry.y, facing: entry.facing, party }, script: "walk" });
  }

  const eventJobs = [];
  for (const map of Object.values(project.maps)) {
    for (const event of map.events ?? []) {
      const pages = (event.pages ?? []).map((page, index) => ({ page, index, ...pageSummary(page) }))
        .filter((p) => ["action", "auto", "playerTouch"].includes(p.page.trigger?.kind) && [...p.kinds].some((k) => CONTENT_KINDS.has(k)));
      if (pages.length === 0) continue;
      // One job per event: the page with the most player-facing content (dialogue lines, shops, choices).
      const best = pages.sort((a, b) => b.textLines + b.kinds.size - (a.textLines + a.kinds.size))[0];
      const { switches, selfSwitches } = pageCheckpointState(best.page);
      const stand = standTile(map, event);
      const kind = best.kinds.has("triggerEnding") ? "ending" : best.kinds.has("shop") || best.kinds.has("inn") ? "shop" : "event";
      eventJobs.push({
        kind, label: `${map.name ?? map.id} · ${best.page.name ?? event.id}`,
        target: { mapId: map.id, eventId: event.id, page: best.index, kinds: [...best.kinds].filter((k) => CONTENT_KINDS.has(k)) },
        checkpoint: {
          id: `ev-${event.id}`, mapId: map.id, ...stand, party, switches,
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
    push({ kind: "battle", label: `전투 ${project.database.troops.find((t) => t.id === troopId)?.name ?? troopId}`, target: { troopId, mapId: at.mapId }, checkpoint: { id: `battle-${troopId}`, mapId: at.mapId, x: at.x, y: Math.min(at.y + 1, (project.maps[at.mapId]?.height ?? 2) - 1), party, startTroopId: troopId }, script: "battle" });
  }

  const inputs = ["keyboard", "mouse", "touch"];
  const desktopViews = ["desktop", "laptop"];
  const touchViews = ["phoneLandscape", "phonePortrait"];
  jobs.forEach((job, index) => {
    job.input = inputs[index % inputs.length];
    job.viewportName = job.input === "touch" ? touchViews[Math.floor(index / 3) % 2] : desktopViews[Math.floor(index / 3) % 2];
    job.viewport = VIEWPORTS[job.viewportName];
  });
  return jobs;
}

/** Static checks that need no browser: dangling resource ids, unreachable maps, out-of-bounds transfers, overlong lines. */
export function staticLint(project, { game, maxLineChars = 34 } = {}) {
  const findings = [];
  const resourceIds = new Set([
    ...(project.resourceProfiles ?? []).map((r) => r.assetId),
    ...Object.keys(project.assets?.uploaded ?? {}),
  ]);
  const add = (f) => findings.push({ game, source: "static", id: `S${String(findings.length + 1).padStart(3, "0")}`, ...f });
  const reachable = new Set([project.startMapId]);
  for (const map of Object.values(project.maps)) {
    for (const event of map.events ?? []) {
      for (const page of event.pages ?? []) {
        const sprite = page.graphic?.sprite;
        if (sprite?.type === "uploaded" && sprite.id && !resourceIds.has(sprite.id)) add({ check: "missing-resource", severity: "visual", where: `${map.id} ${event.id}`, claim: `이벤트 그림 자원 ${sprite.id} 이 프로젝트에 없다`, target: { mapId: map.id, eventId: event.id } });
        walkCommands(page.commands, (c) => {
          if (c.kind === "transfer" && c.mapId) {
            reachable.add(c.mapId);
            const dest = project.maps[c.mapId];
            if (!dest) add({ check: "bad-transfer", severity: "blocker", where: `${map.id} ${event.id}`, claim: `없는 맵 ${c.mapId} 로 이동`, target: { mapId: map.id, eventId: event.id } });
            else if (c.x < 0 || c.y < 0 || c.x >= dest.width || c.y >= dest.height) add({ check: "bad-transfer", severity: "blocker", where: `${map.id} ${event.id}`, claim: `${c.mapId} 밖 좌표 (${c.x},${c.y}) 로 이동 (맵 ${dest.width}x${dest.height})`, target: { mapId: map.id, eventId: event.id } });
          }
          if (c.kind === "changeFace" && c.resourceId && !resourceIds.has(c.resourceId) && !/^shared-|^oprn_|^cc0-|^generated-/.test(c.resourceId)) add({ check: "missing-resource", severity: "visual", where: `${map.id} ${event.id}`, claim: `초상 자원 ${c.resourceId} 이 프로젝트에 없다`, target: { mapId: map.id, eventId: event.id } });
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
