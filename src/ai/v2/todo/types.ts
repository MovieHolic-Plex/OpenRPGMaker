// omo 고리(할 일 목록 + 기계 검증 + 미완료면 다시 돌기)의 할 일 항목 타입.
// 판정은 ./checks.ts 의 runTodoCheck 가 한다(순수 함수, 프로젝트만 읽음).
import type { Project } from "@/project/types";

export type { Project };

export type TodoStatus = "pending" | "in_progress" | "completed" | "blocked" | "dropped";

export type TodoPlaceKind = "village" | "interior" | "dungeon" | "cave" | "field" | "street";

export type TodoCheck =
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
  | { kind: "none" };

export type TodoCheckKind = TodoCheck["kind"];

export interface TodoItem {
  id: string;
  phase: string;
  content: string;
  status: TodoStatus;
  check?: TodoCheck;
  dependsOn?: string[];
  blockedReason?: string;
  attempts: number;
  source: "model" | "gate" | "critic" | "vqa";
}

export interface CheckResult {
  pass: boolean;
  detail: string;
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
    "이 할 일이 끝났는지 기계로 확인하는 방법. kind 별 필수 칸: place=name, person=name, talk=who, link=from+to, item=name, present_evidence=item, reachable=target. battle·ending·objective·none 은 필수 칸 없음. 기계로 볼 수 없으면 kind=none.",
  properties: {
    kind: {
      type: "string",
      enum: [...TODO_CHECK_KINDS],
      description:
        "place=그 이름의 장소(맵)가 있다, person=그 이름의 인물이 맵에 있다, talk=그 인물이 대사를 한다, battle=전투가 걸린다(boss=보스전), link=from 맵에서 to 맵으로 걸어가 이동한다, ending=엔딩에 닿는다(map=그 맵에서), item=그 아이템이 있다(gives=지급된다), present_evidence=그 증거를 내밀 수 있다, objective=목표 줄이 설정된다, reachable=시작(또는 from)에서 target 까지 걸어 닿는다, none=판정자가 눈으로 확인",
    },
    name: { type: "string", description: "place·person·item 의 이름" },
    placeKind: { type: "string", enum: [...TODO_PLACE_KINDS], description: "place 의 종류(선택)" },
    map: { type: "string", description: "person·battle·ending 을 이 맵 이름으로 좁힘(선택) — ending 은 엔딩을 부르는 이벤트가 그 맵에 있어야 한다" },
    who: { type: "string", description: "talk·battle 의 인물 이름" },
    says: { type: "string", description: "talk 대사에 들어 있어야 할 낱말(선택)" },
    boss: { type: "boolean", description: "battle 이 보스전이어야 하면 true" },
    from: { type: "string", description: "link 의 출발 맵, reachable 의 출발 맵(선택)" },
    to: { type: "string", description: "link 의 도착 맵, present_evidence 를 받을 인물(선택)" },
    gives: { type: "boolean", description: "item 이 실제로 지급돼야 하면 true" },
    item: { type: "string", description: "present_evidence 의 증거 아이템 이름" },
    text: { type: "string", description: "objective 목표 줄에 들어 있어야 할 낱말(선택)" },
    target: { type: "string", description: "reachable 의 목표(이벤트·인물·맵 이름)" },
  },
  required: ["kind"],
} as const;

/** 모델이 보낸 인자를 TodoCheck 로. 틀리면 { error } — 모델이 고칠 수 있게 문장으로. */
export function parseTodoCheck(raw: unknown): TodoCheck | { error: string } {
  if (!raw || typeof raw !== "object") return { error: "check 는 객체여야 한다" };
  const r = raw as Record<string, unknown>;
  const kind = r.kind;
  if (typeof kind !== "string" || !(TODO_CHECK_KINDS as readonly string[]).includes(kind)) {
    return { error: `check.kind 는 ${TODO_CHECK_KINDS.join("|")} 중 하나여야 한다 (받음: ${String(kind)})` };
  }
  const k = kind as TodoCheckKind;
  const str = (key: string): string | undefined => {
    const v = r[key];
    return typeof v === "string" && v.trim() ? v.trim() : undefined;
  };
  const missing = TODO_CHECK_REQUIRED[k].filter((key) => !str(key));
  if (missing.length) return { error: `check.kind=${k} 에는 ${missing.join(", ")} 칸이 필요하다` };
  const bool = (key: string): boolean | undefined => (typeof r[key] === "boolean" ? (r[key] as boolean) : undefined);
  const clean = <T extends object>(o: T): T =>
    Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
  switch (k) {
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
    case "none":
      return { kind: k };
  }
}
