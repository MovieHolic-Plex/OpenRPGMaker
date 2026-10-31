// project/script/apiSpec.ts — the ONE source of truth for the script `game` API.
//
// Every consumer reads this table:
// - src/project/script/dts.ts builds the `.d.ts` scripts are type-checked against (editor, assistant tools);
// - src/player/script/hostApi.ts implements each name (a compile-time check forces one implementation per entry);
// - src/editor/script/analyze.ts extracts reads/writes from string-literal arguments using `refs`;
// - the assistant skill / openwiki tables list the same rows.
// Model-facing docs are English. Add a row here first, then implement it in hostApi.ts.
import type { ScriptRefKind } from "./types";

export type ScriptApiGroup =
  | "state"
  | "items"
  | "party"
  | "dialogue"
  | "flow"
  | "map"
  | "battle"
  | "audio"
  | "screen"
  | "query"
  | "util";

export interface ScriptApiRef {
  /** Zero-based argument index that names a project id. */
  readonly arg: number;
  readonly kind: ScriptRefKind;
  readonly access: "read" | "write" | "call";
}

export interface ScriptApiEntry {
  readonly name: string;
  readonly group: ScriptApiGroup;
  /** TypeScript parameter list, without parentheses. */
  readonly params: string;
  /** Return type without the Promise wrapper. */
  readonly returns: string;
  /** True: returns a Promise and runs through the event interpreter (must be awaited). */
  readonly awaits: boolean;
  readonly doc: string;
  readonly refs?: readonly ScriptApiRef[];
  /** Korean verb for the one-line summary non-coders see in the event list. */
  readonly ko: string;
}

const r = (arg: number, kind: ScriptRefKind, access: ScriptApiRef["access"]): ScriptApiRef => ({ arg, kind, access });

export const SCRIPT_API = [
  // ── state ──────────────────────────────────────────────────────────────
  { name: "getSwitch", group: "state", params: "id: SwitchId", returns: "boolean", awaits: false, ko: "스위치 확인", refs: [r(0, "switch", "read")],
    doc: "Read a switch (false when never set). Accepts the switch id; an exact switch name also works." },
  { name: "setSwitch", group: "state", params: "id: SwitchId, value: boolean", returns: "void", awaits: false, ko: "스위치", refs: [r(0, "switch", "write")],
    doc: "Turn a switch on or off. Event pages and conditions that watch it refresh like with the Set Switch command." },
  { name: "getVar", group: "state", params: "id: VariableId", returns: "number", awaits: false, ko: "변수 확인", refs: [r(0, "variable", "read")],
    doc: "Read a number variable (0 when never set)." },
  { name: "setVar", group: "state", params: "id: VariableId, value: number", returns: "void", awaits: false, ko: "변수", refs: [r(0, "variable", "write")],
    doc: "Set a number variable. Values are truncated to integers; NaN/Infinity throw." },
  { name: "addVar", group: "state", params: "id: VariableId, delta: number", returns: "number", awaits: false, ko: "변수 더하기", refs: [r(0, "variable", "write")],
    doc: "Add delta (may be negative) to a number variable and return the new value." },
  { name: "getText", group: "state", params: "id: StringVariableId", returns: "string", awaits: false, ko: "글 변수 확인", refs: [r(0, "string", "read")],
    doc: "Read a string variable ('' when never set)." },
  { name: "setText", group: "state", params: "id: StringVariableId, value: string", returns: "void", awaits: false, ko: "글 변수", refs: [r(0, "string", "write")],
    doc: "Set a string variable (max 10,000 characters)." },
  { name: "getSelfSwitch", group: "state", params: "key: SelfSwitchKey, eventId?: EventId", returns: "boolean", awaits: false, ko: "셀프 스위치 확인",
    doc: "Read self switch A/B/C/D of this event (or of eventId)." },
  { name: "setSelfSwitch", group: "state", params: "key: SelfSwitchKey, value: boolean, eventId?: EventId", returns: "void", awaits: false, ko: "셀프 스위치",
    doc: "Set self switch A/B/C/D of this event (or of eventId)." },
  // ── items / economy ───────────────────────────────────────────────────
  { name: "gold", group: "items", params: "", returns: "number", awaits: false, ko: "돈 확인",
    doc: "Party gold." },
  { name: "addGold", group: "items", params: "amount: number", returns: "void", awaits: false, ko: "돈",
    doc: "Add gold (negative subtracts; gold never drops below 0)." },
  { name: "itemCount", group: "items", params: "id: ItemId", returns: "number", awaits: false, ko: "아이템 수 확인", refs: [r(0, "item", "read")],
    doc: "How many of an item the party holds." },
  { name: "hasItem", group: "items", params: "id: ItemId, count?: number", returns: "boolean", awaits: false, ko: "아이템 확인", refs: [r(0, "item", "read")],
    doc: "True when the party holds at least count (default 1)." },
  { name: "addItem", group: "items", params: "id: ItemId, count?: number", returns: "void", awaits: false, ko: "아이템 +", refs: [r(0, "item", "write")],
    doc: "Give count (default 1) of an item." },
  { name: "removeItem", group: "items", params: "id: ItemId, count?: number", returns: "boolean", awaits: false, ko: "아이템 -", refs: [r(0, "item", "write")],
    doc: "Take count (default 1). Returns false and changes nothing when the party has fewer." },
  // ── party / actors ────────────────────────────────────────────────────
  { name: "party", group: "party", params: "", returns: "ActorId[]", awaits: false, ko: "파티 확인",
    doc: "Actor ids in the party, leader first." },
  { name: "actor", group: "party", params: "id: ActorId", returns: "ActorInfo | undefined", awaits: false, ko: "인물 확인", refs: [r(0, "actor", "read")],
    doc: "Snapshot of an actor (name, level, exp, hp/mp, inParty). Read-only copy." },
  { name: "addToParty", group: "party", params: "id: ActorId", returns: "void", awaits: false, ko: "파티 합류", refs: [r(0, "actor", "write")],
    doc: "Add an actor to the party." },
  { name: "removeFromParty", group: "party", params: "id: ActorId", returns: "void", awaits: false, ko: "파티 이탈", refs: [r(0, "actor", "write")],
    doc: "Remove an actor from the party." },
  { name: "gainExp", group: "party", params: "id: ActorId, amount: number", returns: "void", awaits: false, ko: "경험치", refs: [r(0, "actor", "write")],
    doc: "Give experience (levels up like the Change EXP command)." },
  { name: "setLevel", group: "party", params: "id: ActorId, level: number", returns: "void", awaits: false, ko: "레벨", refs: [r(0, "actor", "write")],
    doc: "Set an actor's level." },
  { name: "setHp", group: "party", params: "id: ActorId, hp: number", returns: "void", awaits: false, ko: "HP", refs: [r(0, "actor", "write")],
    doc: "Set current HP (clamped to 0..maxHp)." },
  { name: "setMp", group: "party", params: "id: ActorId, mp: number", returns: "void", awaits: false, ko: "MP", refs: [r(0, "actor", "write")],
    doc: "Set current MP (clamped to 0..maxMp)." },
  { name: "recoverAll", group: "party", params: "id?: ActorId", returns: "void", awaits: false, ko: "전부 회복",
    doc: "Fully heal one actor, or the whole party when id is omitted." },
  { name: "learnSkill", group: "party", params: "id: ActorId, skillId: SkillId", returns: "void", awaits: false, ko: "스킬 배우기", refs: [r(0, "actor", "write"), r(1, "skill", "read")],
    doc: "Teach a skill." },
  // ── dialogue (awaitable) ──────────────────────────────────────────────
  { name: "showMessage", group: "dialogue", params: "text: string, options?: MessageOptions", returns: "void", awaits: true, ko: "대사",
    doc: "Show a message window and wait until the player dismisses it." },
  { name: "showChoices", group: "dialogue", params: "options: readonly string[], settings?: ChoiceSettings", returns: "number", awaits: true, ko: "선택지",
    doc: "Show up to 5 choices; resolves to the chosen index (0-based), or -1 when cancelled with settings.cancel = 'cancel'." },
  { name: "inputNumber", group: "dialogue", params: "settings?: NumberInputSettings", returns: "number", awaits: true, ko: "숫자 입력",
    doc: "Ask the player for a number (1-6 digits, default 4). Cancelling ends the event, like the Input Number command." },
  // ── flow ──────────────────────────────────────────────────────────────
  { name: "wait", group: "flow", params: "frames: number", returns: "void", awaits: true, ko: "기다리기",
    doc: "Wait frames (60 = 1 second)." },
  { name: "callCommonEvent", group: "flow", params: "id: CommonEventId", returns: "void", awaits: true, ko: "공통 이벤트", refs: [r(0, "commonEvent", "call")],
    doc: "Run a common event to the end (it may itself be a script)." },
  { name: "random", group: "util", params: "maxExclusive: number", returns: "number", awaits: false, ko: "난수",
    doc: "Integer in [0, maxExclusive) from the saved game RNG. Math.random() uses the same seeded stream." },
  { name: "log", group: "util", params: "...values: unknown[]", returns: "void", awaits: false, ko: "기록",
    doc: "Write to the developer log (console + script log). Never shown to players." },
  { name: "cmd", group: "flow", params: "command: EventCommand", returns: "void", awaits: true, ko: "명령",
    doc: "Run any existing event command object (same JSON as event pages), e.g. { kind: 'shop', itemIds: ['potion'] }. Validated before running." },
  // ── map / movement ────────────────────────────────────────────────────
  { name: "transfer", group: "map", params: "mapId: MapId, x: number, y: number, options?: TransferOptions", returns: "void", awaits: true, ko: "이동", refs: [r(0, "map", "call")],
    doc: "Move the player to another map/tile. Like the Transfer command this ENDS the running event (and this script); put it last." },
  { name: "moveEvent", group: "map", params: "target: MoveTarget, steps: readonly MoveStep[], options?: MoveOptions", returns: "void", awaits: true, ko: "움직이기",
    doc: "Walk 'player', 'this' or an event id along steps ('up'|'down'|'left'|'right'|'face-up'…|'jump'|'wait'). Waits for the route unless options.wait === false." },
  { name: "setTile", group: "map", params: "x: number, y: number, tile: number, options?: TileOptions", returns: "void", awaits: true, ko: "지형 바꾸기",
    doc: "Change one tile at runtime (saved with the game). layer defaults to 'lower'." },
  // ── battle ────────────────────────────────────────────────────────────
  { name: "battle", group: "battle", params: "troopId: TroopId, options?: BattleOptions", returns: "BattleResult", awaits: true, ko: "전투", refs: [r(0, "troop", "call")],
    doc: "Start a battle and resolve to 'victory' | 'defeat' | 'escape'. canLose defaults to false (a loss is game over)." },
  // ── audio / screen ────────────────────────────────────────────────────
  { name: "playBgm", group: "audio", params: "resourceId: ResourceId, options?: AudioOptions", returns: "void", awaits: true, ko: "배경음", refs: [r(0, "resource", "read")],
    doc: "Play looping background music." },
  { name: "playSe", group: "audio", params: "resourceId: ResourceId, options?: AudioOptions", returns: "void", awaits: true, ko: "효과음", refs: [r(0, "resource", "read")],
    doc: "Play a sound effect once." },
  { name: "stopBgm", group: "audio", params: "", returns: "void", awaits: true, ko: "배경음 끄기",
    doc: "Fade out the background music." },
  { name: "shake", group: "screen", params: "power?: number, frames?: number", returns: "void", awaits: true, ko: "화면 흔들기",
    doc: "Shake the screen (power 1-9, default 3; frames default 24)." },
  { name: "flash", group: "screen", params: "color?: FlashColor, frames?: number", returns: "void", awaits: true, ko: "화면 번쩍",
    doc: "Flash the screen ('white' | 'red' | 'black' | '#rrggbb', default white)." },
  { name: "fadeOut", group: "screen", params: "", returns: "void", awaits: true, ko: "화면 어둡게",
    doc: "Fade the screen to black (stays black until fadeIn)." },
  { name: "fadeIn", group: "screen", params: "", returns: "void", awaits: true, ko: "화면 밝게",
    doc: "Fade the screen back in." },
  { name: "showAnimation", group: "screen", params: "target: AnimTarget, animationId: AnimationId, options?: { wait?: boolean }", returns: "void", awaits: true, ko: "애니메이션", refs: [r(1, "animation", "read")],
    doc: "Play a battle animation on 'player', an event id, or {x, y}." },
  { name: "showEmote", group: "screen", params: "target: 'player' | 'this' | EventId, emote: EmoteName, frames?: number", returns: "void", awaits: true, ko: "감정 표시",
    doc: "Show an emote balloon ('exclamation', 'question', 'heart', … see EmoteName) above 'player', 'this' event or an event id." },
  // ── queries (read-only, instant) ──────────────────────────────────────
  { name: "player", group: "query", params: "", returns: "PlayerInfo", awaits: false, ko: "주인공 위치",
    doc: "Player map id, tile x/y and direction ('up' | 'down' | 'left' | 'right' — the field is `direction`)." },
  { name: "mapId", group: "query", params: "", returns: "MapId", awaits: false, ko: "지금 맵",
    doc: "Current map id." },
  { name: "eventId", group: "query", params: "", returns: "EventId | undefined", awaits: false, ko: "이 이벤트",
    doc: "Id of the event running this script (undefined in common events started without an event)." },
  { name: "events", group: "query", params: "", returns: "EventInfo[]", awaits: false, ko: "이벤트 목록",
    doc: "Visible events on the current map (id, name, x, y)." },
  { name: "event", group: "query", params: "id: EventId", returns: "EventInfo | undefined", awaits: false, ko: "이벤트 확인", refs: [r(0, "event", "read")],
    doc: "One event's live position on the current map." },
  { name: "eventAt", group: "query", params: "x: number, y: number", returns: "EventId | undefined", awaits: false, ko: "그 칸 이벤트",
    doc: "Id of a visible event standing on a tile of the current map." },
  { name: "tileAt", group: "query", params: "x: number, y: number, layer?: TileLayer", returns: "number", awaits: false, ko: "타일 확인",
    doc: "Tile number at x,y (-1 empty, or out of bounds) including runtime changes." },
  { name: "passable", group: "query", params: "x: number, y: number", returns: "boolean", awaits: false, ko: "지나갈 수 있나",
    doc: "Can something stand on this tile of the current map (tiles only, ignores events)." },
  { name: "time", group: "query", params: "", returns: "GameClock", awaits: false, ko: "게임 시각",
    doc: "In-game clock: enabled, hour, minute, day, season, year and phase ('morning' | 'day' | 'evening' | 'night'). enabled=false when the project has no time system (then hour is 12)." },
  { name: "playTime", group: "query", params: "", returns: "number", awaits: false, ko: "플레이 시간",
    doc: "Seconds played in this save." },
] as const satisfies readonly ScriptApiEntry[];

export type ScriptApiName = (typeof SCRIPT_API)[number]["name"];

export const SCRIPT_API_BY_NAME: ReadonlyMap<string, ScriptApiEntry> = new Map(SCRIPT_API.map((entry) => [entry.name, entry as ScriptApiEntry]));

export const SCRIPT_API_GROUP_LABELS: Readonly<Record<ScriptApiGroup, string>> = {
  state: "Switches & variables",
  items: "Items & gold",
  party: "Party & actors",
  dialogue: "Dialogue (await)",
  flow: "Flow",
  map: "Map & movement",
  battle: "Battle",
  audio: "Audio",
  screen: "Screen effects",
  query: "Queries",
  util: "Utilities",
};

/** Reserved session variable the interpreter bridge writes awaitable results into. Never a user variable. */
export const SCRIPT_RESULT_VARIABLE = "__script_result";
