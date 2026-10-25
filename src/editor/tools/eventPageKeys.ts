// 이벤트 페이지 입력의 키 검증. 모르는 키는 저장돼도 실행기가 읽지 않아 조용히 무시된다 — 실측(2026-10-15 CT 감사):
// `condition`(단수)을 쓰면 조건이 사라져 문이 잠기지 않았다. 도구 경계에서 거절하고 맞는 이름을 알려 준다.

/** EventPage(types/events.ts) 의 모든 키. 필드를 더하면 여기도 더한다. */
export const EVENT_PAGE_KEYS: ReadonlySet<string> = new Set([
  "id", "name", "conditions", "graphic", "trigger", "priority", "overlapForbidden", "animationType",
  "footprint", "passRows", "interaction", "detectionEncounter", "nearSparkle", "movement", "commands",
]);

/** EventPageMovement(types/events.ts) 의 키 — 필드를 더하면 여기도 더한다. */
export const MOVEMENT_KEYS: ReadonlySet<string> = new Set([
  "type", "speed", "frequency", "route", "living", "pursuit", "sight", "sightRange", "giveUpRange", "pathfind",
  "moveIntervalMs", "sightAlert", "chaseLunge",
]);
/** ChaseAcrossMaps(movement.pursuit) 의 키. */
export const PURSUIT_KEYS: ReadonlySet<string> = new Set([
  "tracking", "scope", "doorDelayMs", "searchMs", "onLost", "lostSwitchId", "followSwitchId",
]);
const SIGHT_KEYS: ReadonlySet<string> = new Set(["range", "lineOfSight", "facing"]);
const ROUTE_KEYS: ReadonlySet<string> = new Set(["moves", "repeat", "wait", "skippable"]);

const MOVEMENT_KEY_HINTS: Readonly<Record<string, string>> = {
  patrol: "movement.route(순찰 경로 {repeat:true, moves:[{kind:'move',dir}...]} — 추격자 순찰은 make_chase_scene 의 patrol)",
  waypoints: "movement.route", path: "movement.route", moves: "movement.route.moves", moveRoute: "movement.route",
  vision: "movement.sight", sightCone: "movement.sight({range,lineOfSight,facing:'cone'})", fov: "movement.sight", viewRange: "movement.sightRange",
  alert: "movement.sightAlert({emote:'exclamation',holdMs})", emote: "movement.sightAlert", lunge: "movement.chaseLunge",
  chase: "movement.type 'chase'", interval: "movement.moveIntervalMs",
};

/**
 * movement 안의 모르는 키(movement.patrol·movement.pursuit.patrol 등). 실행기는 정해진 칸만 읽으므로 나머지는
 * 저장돼도 조용히 무시된다 — 실측(J54, 2026-10-25): movement.pursuit.patrol 을 넣고 「순찰한다」고 보고했지만
 * 추격자는 제자리였다. 거절하고 허용 키를 알려 준다.
 */
export function movementKeyProblems(movement: unknown, path: string): string[] {
  if (!movement || typeof movement !== "object" || Array.isArray(movement)) return [];
  const problems: string[] = [];
  const check = (value: unknown, allowed: ReadonlySet<string>, at: string, hints: Readonly<Record<string, string>> = {}) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return;
    for (const key of Object.keys(value)) {
      if (allowed.has(key)) continue;
      const hint = hints[key] ?? (at.endsWith(".pursuit") ? MOVEMENT_KEY_HINTS[key] : undefined);
      problems.push(`${at}.${key}${hint ? ` → ${hint}` : ""} (허용: ${[...allowed].join(", ")})`);
    }
  };
  const record = movement as Record<string, unknown>;
  check(record, MOVEMENT_KEYS, path, MOVEMENT_KEY_HINTS);
  check(record.pursuit, PURSUIT_KEYS, `${path}.pursuit`);
  check(record.sight, SIGHT_KEYS, `${path}.sight`);
  check(record.route, ROUTE_KEYS, `${path}.route`);
  return problems;
}

export function movementKeyRejectMessage(problems: readonly string[]): string {
  return `movement 에 실행기가 읽지 않는 키가 있어 거절한다(저장돼도 아무 일도 안 일어난다): ${problems.join("; ")}.`;
}

const PAGE_KEY_HINTS: Readonly<Record<string, string>> = {
  condition: "conditions(배열 — 조건 하나여도 [ ] 로 감싼다)",
  cond: "conditions", requires: "conditions", when: "conditions", unlockWhen: "conditions",
  command: "commands(배열)", list: "commands", actions: "commands", steps: "commands", body: "commands", script: "commands",
  graphics: "graphic", sprite: "graphic", image: "graphic",
  triggers: "trigger", triggerKind: "trigger",
  moveRoute: "movement", moves: "movement",
  anim: "animationType", animation: "animationType",
  lines: "commands 의 text 명령(대사는 SimplePage 전용 — place_npc/make_villager)", text: "commands 의 text 명령",
};

export interface PageKeyFindings {
  /** 흔한 오타·별칭 — 의도가 분명하니 거절하고 맞는 이름을 알려 준다. */
  readonly reject: string[];
  /** 그 밖의 모르는 키 — 옛 저장본이 들고 있을 수 있어 거절하지 않고 경고한다. */
  readonly warn: string[];
}

export function pageKeyFindings(page: unknown, path: string): PageKeyFindings {
  const findings: PageKeyFindings = { reject: [], warn: [] };
  if (!page || typeof page !== "object" || Array.isArray(page)) return findings;
  for (const key of Object.keys(page)) {
    if (EVENT_PAGE_KEYS.has(key)) continue;
    const hint = PAGE_KEY_HINTS[key];
    if (hint) findings.reject.push(`${path}.${key} → '${hint}' 를 쓴다`);
    else findings.warn.push(`${path}.${key}`);
  }
  return findings;
}

export function pageKeyRejectMessage(problems: readonly string[]): string {
  return `페이지에 잘못된 키가 있어 거절한다(저장돼도 실행기가 읽지 않아 조용히 사라진다): ${problems.join("; ")}. 허용 키: ${[...EVENT_PAGE_KEYS].join(", ")}.`;
}

export function pageKeyWarning(keys: readonly string[]): string {
  return `알 수 없는 페이지 키는 실행기가 읽지 않는다: ${keys.join(", ")} — 허용 키: ${[...EVENT_PAGE_KEYS].join(", ")}.`;
}
