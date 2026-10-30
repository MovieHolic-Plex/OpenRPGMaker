// omo 고리(할 일 목록 + 기계 검증 + 미완료면 다시 돌기)의 할 일 항목 타입.
// 판정은 ./checks.ts 의 runTodoCheck 가 한다(순수 함수, 프로젝트만 읽음).
import type { Project } from "@/project/types";

export type { Project };

export type TodoStatus = "pending" | "in_progress" | "completed" | "blocked" | "dropped";

export type TodoPlaceKind = "village" | "interior" | "dungeon" | "cave" | "field" | "street";

/** 「만들어 달라」 요청으로 쓴 항목이면 true — 이번 턴에 새로 생기거나 바뀐 대상(TodoCheckContext.changed)만 통과로 센다. */
export interface TodoCheckCommon { fresh?: boolean }

export type TodoCheckBody =
  | { kind: "place"; name: string; placeKind?: TodoPlaceKind }
  | { kind: "person"; name: string; map?: string }
  | { kind: "talk"; who: string; says?: string }
  | { kind: "battle"; who?: string; map?: string; boss?: boolean }
  | { kind: "link"; from: string; to: string }
  | { kind: "ending"; map?: string }
  | { kind: "item"; name: string; gives?: boolean }
  | { kind: "present_evidence"; item: string; to?: string }
  | { kind: "objective"; text?: string }
  | { kind: "reachable"; target: string; from?: string }
  | { kind: "party_join"; name: string; map?: string }
  | { kind: "none" };

export type TodoCheck = TodoCheckBody & TodoCheckCommon;

/** 항목이 가리키는 실제 대상 id — 고리가 쓰기 동사 전후 프로젝트 차이로 채운다(모델 기억에 기대지 않는다). eventIds 는 「mapId:eventId」 또는 eventId. */
export interface TodoRefs { mapIds?: string[]; eventIds?: string[]; itemIds?: string[]; troopIds?: string[] }

/** 이번 턴 기준선 대비 새로 생기거나 바뀐 것(고리가 넘긴다). eventKeys 는 「mapId:eventId」. */
export interface TodoChanged { mapIds: Set<string>; eventKeys: Set<string>; itemIds: Set<string>; troopIds: Set<string> }

export interface TodoCheckContext { startMapId?: string; changed?: TodoChanged; refs?: TodoRefs }

export type TodoCheckKind = TodoCheckBody["kind"];

export interface TodoItem {
  id: string;
  phase: string;
  content: string;
  status: TodoStatus;
  check?: TodoCheck;
  dependsOn?: string[];
  blockedReason?: string;
  attempts: number;
  /** 고리가 자동으로 묶는 대상 id. 있으면 판정은 이 id 들만 본다. */
  refs?: TodoRefs;
  source: "model" | "gate" | "critic" | "vqa";
}

export interface CheckResult {
  pass: boolean;
  /** 사람이 보는 판정 글(한국어 — 최종 보고·장부). */
  detail: string;
  /** 모델이 받는 같은 판정의 영어 글(runTodoItemCheck 가 채운다). */
  en?: string;
  evidence?: { mapId?: string; eventId?: string; x?: number; y?: number };
}

export const TODO_CHECK_KINDS = [
  "place",
  "person",
  "talk",
  "battle",
  "link",
  "ending",
  "item",
  "present_evidence",
  "objective",
  "reachable",
  "party_join",
  "none",
] as const satisfies readonly TodoCheckKind[];

export const TODO_PLACE_KINDS = ["village", "interior", "dungeon", "cave", "field", "street"] as const satisfies readonly TodoPlaceKind[];

/** kind 별로 반드시 있어야 하는 칸. 모델 인자 검사(parseTodoCheck)가 쓴다. */
export const TODO_CHECK_REQUIRED: Record<TodoCheckKind, readonly string[]> = {
  place: ["name"],
  person: ["name"],
  talk: ["who"],
  battle: [],
  link: ["from", "to"],
  ending: [],
  item: ["name"],
  present_evidence: ["item"],
  objective: [],
  reachable: ["target"],
  party_join: ["name"],
  none: [],
};

/**
 * 모델 도구 인자용 JSON 스키마. Gemini/OpenAI 함수 선언 제약 때문에
 * oneOf·자유 키 객체·빈 enum·빈 문자열 enum 을 쓰지 않는 평평한 객체 하나다.
 * kind 별 필수 칸은 description 에 적고 parseTodoCheck 로 검사한다.
 */
export const TODO_CHECK_SCHEMA = {
  type: "object",
  description:
    "How a machine checks that this todo is finished. Required fields per kind: place=name, person=name, talk=who, link=from+to, item=name, present_evidence=item, reachable=target, party_join=name. battle, ending, objective and none need no field. If a machine cannot see it, kind=none. Names are the in-game names (any language).",
  properties: {
    kind: {
      type: "string",
      enum: [...TODO_CHECK_KINDS],
      description:
        "place=a place (map) with that name exists, person=a person with that name is on a map, talk=that person has dialogue, battle=a battle is triggered (boss=boss battle), link=you can walk from map `from` into map `to`, ending=an ending is reached (map=from that map), item=that item exists (gives=it is actually given), present_evidence=that evidence can be presented, objective=an objective line is set, reachable=target is reachable on foot from the start (or from), party_join=a companion with that name joins the party (a changeParty add in a live event reachable on foot), none=a reviewer checks by eye",
    },
    name: { type: "string", description: "name for place/person/item; the companion (actor) name for party_join" },
    placeKind: { type: "string", enum: [...TODO_PLACE_KINDS], description: "kind of place (optional)" },
    map: { type: "string", description: "narrow person/battle/ending to this map name (optional) — for ending, the event that calls the ending must be on that map" },
    who: { type: "string", description: "person name for talk/battle" },
    says: { type: "string", description: "word that must appear in the talk dialogue (optional)" },
    boss: { type: "boolean", description: "true if the battle must be a boss battle" },
    from: { type: "string", description: "source map for link; start map for reachable (optional)" },
    to: { type: "string", description: "destination map for link; the person receiving present_evidence (optional)" },
    gives: { type: "boolean", description: "true if the item must actually be given" },
    item: { type: "string", description: "evidence item name for present_evidence" },
    text: { type: "string", description: "word that must appear in the objective line (optional)" },
    target: { type: "string", description: "target for reachable (event, person or map name)" },
    fresh: { type: "boolean", description: "true if this request must create or change it (default true) — something that already existed does not pass. false to only confirm something that exists" },
  },
  required: ["kind"],
} as const;

/** 모델이 보낸 인자를 TodoCheck 로. 틀리면 { error } — 모델이 고칠 수 있게 문장으로. */
export function parseTodoCheck(raw: unknown): TodoCheck | { error: string } {
  if (!raw || typeof raw !== "object") return { error: "check must be an object" };
  const r = raw as Record<string, unknown>;
  const kind = r.kind;
  if (typeof kind !== "string" || !(TODO_CHECK_KINDS as readonly string[]).includes(kind)) {
    return { error: `check.kind must be one of ${TODO_CHECK_KINDS.join("|")} (got: ${String(kind)})` };
  }
  const k = kind as TodoCheckKind;
  const str = (key: string): string | undefined => {
    const v = r[key];
    return typeof v === "string" && v.trim() ? v.trim() : undefined;
  };
  const missing = TODO_CHECK_REQUIRED[k].filter((key) => !str(key));
  if (missing.length) return { error: `check.kind=${k} needs the field(s) ${missing.join(", ")}` };
  const bool = (key: string): boolean | undefined => (typeof r[key] === "boolean" ? (r[key] as boolean) : undefined);
  const clean = <T extends object>(o: T): T =>
    Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
  const body = ((): TodoCheckBody => { switch (k) {
    case "place": {
      const pk = str("placeKind");
      const placeKind = pk && (TODO_PLACE_KINDS as readonly string[]).includes(pk) ? (pk as TodoPlaceKind) : undefined;
      return clean({ kind: k, name: str("name")!, placeKind });
    }
    case "person":
      return clean({ kind: k, name: str("name")!, map: str("map") });
    case "talk":
      return clean({ kind: k, who: str("who")!, says: str("says") });
    case "battle":
      return clean({ kind: k, who: str("who") ?? str("name"), map: str("map"), boss: bool("boss") });
    case "link":
      return { kind: k, from: str("from")!, to: str("to")! };
    case "ending":
      return clean({ kind: k, map: str("map") });
    case "item":
      return clean({ kind: k, name: str("name")!, gives: bool("gives") });
    case "present_evidence":
      return clean({ kind: k, item: str("item")!, to: str("to") ?? str("who") });
    case "objective":
      return clean({ kind: k, text: str("text") });
    case "reachable":
      return clean({ kind: k, target: str("target")!, from: str("from") });
    case "party_join":
      return clean({ kind: k, name: str("name")!, map: str("map") });
    case "none":
      return { kind: k };
  } })();
  const fresh = bool("fresh");
  return body.kind === "none" ? body : { ...body, fresh: fresh ?? true };
}
