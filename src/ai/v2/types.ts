// 조수 v2 — 짓기 명세(spec)와 빌더 계약.
//
// v2 의 한 줄: 모델은 «무엇을» 정하고(명세), 함수가 «어떻게» 짓고(결정론 빌더), 다른 눈이 1배 그림을 본다(비평가).
// 모델은 칸 번호·평면 문자열·좌표 목록을 쓰지 않는다. 빌더가 명세를 v1 의 결정론 도구 인자로 옮겨 부른다.
// 이 파일은 순수 타입이다 — 워커(scripts/lib/assistantV2Runtime.ts)와 테스트가 같이 읽는다.
import type { ToolContext, ToolResult } from "@/editor/tools/types";

export type PlaceType =
  | "interior" // 건물 안(방 하나 또는 여러 방) — 여관·선술집·천문대·가게·집 안
  | "village" // 바깥 마을(버들항 계열)
  | "dungeon" // 던전·탑·지하 묘지·신전(층 여럿 가능)
  | "cave" // 동굴(작은 던전)
  | "street" // 현대 일본 거리·골목(jp_city)
  | "house"; // 현대 일본 집 실내(jp_city 실내) — 판타지 집 안은 interior

export type PlaceSize = "small" | "medium" | "large";

/** 구역 하나 — 실내면 방, 마을·거리면 쓰임 있는 자리(광장·밭·공원…). */
export interface ZoneSpec {
  /** 구역 종류(낱말). 실내 방 종류(tavern·kitchen·study·library·bedroom…)나 바깥 자리(plaza·fields·well·park…). 카드의 낱말을 쓴다. */
  readonly kind: string;
  /** 이 구역이 무엇을 위한 곳인지 한 줄 — 비평가 보고와 고치기가 이 말로 구역을 찾는다. */
  readonly purpose?: string;
  /** 이 구역의 주인공 물건(낱말): 「망원경」「벽난로」「바 카운터」「계단」. 빌더가 부품 사전에서 찾아 놓는다. */
  readonly anchors?: readonly string[];
  readonly size?: PlaceSize;
  /** 몇 층의 구역인가(실내·집, 기본 1). 2 이면 위층에 짓는다. */
  readonly floor?: number;
  /** 고치기에서 가리킬 이름(생략하면 kind). */
  readonly id?: string;
  /** (빌더 내부) 이미 지어진 방을 고칠 때 원래 크기·재질을 지킨다 — 모델 스키마에는 없다. */
  readonly keep?: { readonly w?: number; readonly h?: number; readonly floor?: string; readonly wall?: string };
}

/** 짓기 명세 — make_place 의 인자 하나. */
export interface PlaceSpec {
  readonly type: PlaceType;
  readonly name: string;
  /** make_place 가 처음 지을 때 넣는 무작위 값 — 같은 요청이 늘 같은 맵이 되지 않게 빌더가 씨앗·배치 변형에 섞는다. 고치기는 같은 값을 물려받는다. 모델은 쓰지 않는다. */
  readonly salt?: number;
  /** 화풍·문화권 낱말: fantasy(기본) · jp-modern · wizarding · sengoku · modern-city … 카드가 고를 수 있는 값을 준다. */
  readonly style?: string;
  /** 던전·동굴 주제: cave · catacomb · castle · temple · volcano · ice · mine … */
  readonly theme?: string;
  readonly size?: PlaceSize;
  readonly zones?: readonly ZoneSpec[];
  /** 장소 전체에 있어야 할 것(낱말): 마을 well·plaza·fields, 거리 vending·park, 던전 boss·chests·enemies … */
  readonly features?: readonly string[];
  /** 층 수(던전·탑·집). */
  readonly floors?: number;
  /** 나가는 쪽. 실내는 기본 south. */
  readonly exits?: readonly ("south" | "north" | "east" | "west")[];
  /** 이미 있는 맵을 그 자리에서 다시 지을 때(고치기·「이 방을」). 생략하면 빌더가 정한다(빈 시작 맵이면 그 맵). */
  readonly mapId?: string;
  /** 카드가 알려 준 빌더 손잡이(물·지붕·형태·씨앗 등). 모르는 키는 빌더가 무시하고 경고한다. */
  readonly hints?: Readonly<Record<string, string | number | boolean>>;
}

/** 고치기 패치 — edit_place 의 인자. 명세의 그 부분만 바꾼 뒤 같은 빌더로 다시 짓는다. */
export interface PlacePatch {
  readonly mapId: string;
  readonly set?: Partial<Omit<PlaceSpec, "type" | "zones">>;
  readonly addZones?: readonly ZoneSpec[];
  /** 구역 id 또는 kind. */
  readonly removeZones?: readonly string[];
  /** 구역(id·kind)에 주인공 물건을 더한다. near = 비평가가 짚은 칸 근처(선택). */
  readonly addAnchors?: readonly { readonly zone?: string; readonly what: string; readonly near?: { readonly x: number; readonly y: number } }[];
  readonly addFeatures?: readonly string[];
  readonly removeFeatures?: readonly string[];
  /** 같은 명세의 다른 배치 후보·씨앗(「배치가 어색하다」). */
  readonly variant?: number;
  readonly seed?: number;
  /** 더 아늑하게·더 빽빽하게 같은 꾸밈 정도(0 보통 · 1 많이 · 2 가득). 빌더가 아는 만큼만. */
  readonly dressing?: number;
}

/** 빌더가 실제로 부른 v1 결정론 도구 하나. */
export interface BuilderCall {
  readonly tool: string;
  readonly args: Record<string, unknown>;
  readonly ok: boolean;
  readonly summary: string;
}

export interface PlaceBuildResult {
  readonly ok: boolean;
  /** 이번 짓기로 만들거나 바꾼 맵 전부(층 포함). 첫째가 대표 맵. */
  readonly mapIds: readonly string[];
  /** 들어오는 칸(시작·입구). 기계 검사의 도달 출발점. */
  readonly entrance?: { readonly mapId: string; readonly x: number; readonly y: number };
  readonly summary: string;
  readonly warnings: readonly string[];
  /** 요청했지만 그림·부품이 없어 못 놓은 것 — 보고에 그대로 쓴다(지어낸 대체물 금지). */
  readonly missingArt: readonly string[];
  readonly calls: readonly BuilderCall[];
  /** 빌더 전용 상태(다음 고치기에서 같은 빌더가 받는다): 예) 실내 마지막 도구 인자. */
  readonly state?: unknown;
}

/** 이 실행에서 지은 장소 하나의 기록 — 고치기는 이것을 고친다. */
export interface PlaceRecord {
  readonly builder: string;
  readonly spec: PlaceSpec;
  readonly result: PlaceBuildResult;
  readonly rounds: number;
}

/** 빌더가 v1 도구를 부르는 창구. 실행기가 시공 재생 기록·도구 기록을 붙여 준다. */
export interface BuildRun {
  readonly ctx: ToolContext;
  /** v1 레지스트리 도구를 이 실행의 사본(ctx.project) 위에서 부른다. 실패해도 던지지 않는다 — ok 를 본다. */
  call(tool: string, args: Record<string, unknown>): ToolResult;
  /** 부른 기록(보고·디버그). */
  readonly calls: BuilderCall[];
}

export interface PlaceBuilder {
  readonly id: string;
  /** 이 빌더가 맡는 명세인가. */
  accepts(spec: PlaceSpec): boolean;
  /** 명세 → v1 도구 호출. previous 가 있으면 같은 맵을 그 자리에서 다시 짓는다. */
  build(run: BuildRun, spec: PlaceSpec, previous?: PlaceRecord): PlaceBuildResult;
  /** (선택) 짓기 전에 기다릴 지연 재료 — 도구의 async prepare(예: build_monster_game 의 캠페인 모듈). */
  prepare?(spec: PlaceSpec): Promise<void>;
}

/** 사람(NPC) 명세 — add_people 의 인자 하나. */
export interface PersonSpec {
  readonly role: string; // 문지기·촌장·상인…
  readonly name?: string;
  /** 어디에: 「입구」「광장」「카운터 뒤」 같은 자리 낱말, 또는 칸. */
  readonly where?: string;
  readonly at?: { readonly x: number; readonly y: number };
  readonly mapId?: string;
  /** 외형 낱말(경비병·노인·소녀…). 빌더가 캐릭터 목록에서 고른다. */
  readonly looks?: string;
  /** 대사: 처음 말 걸 때 / 두 번째부터(선택). 줄 여럿이면 배열. */
  readonly firstTalk?: readonly string[];
  readonly laterTalk?: readonly string[];
  readonly movement?: "still" | "wander" | "patrol";
}

/** 사건·컷신 명세 — add_event 의 인자. */
export interface EventSpec {
  readonly kind: "cutscene" | "talk" | "trigger";
  readonly mapId?: string;
  /** 언제: 게임 시작 자동 재생 / 칸을 밟으면 / 말을 걸면. */
  readonly when?: "game-start" | "touch" | "talk";
  readonly where?: string;
  readonly at?: { readonly x: number; readonly y: number };
  /** 비트 목록 — 사람 낱말(주인공·촌장)·움직임·대사. 빌더가 컷신 도구의 장면 명령으로 옮긴다. */
  readonly beats: readonly EventBeat[];
}
export type EventBeat =
  | { readonly do: "walk"; readonly who: string; readonly to: string | { readonly x: number; readonly y: number } }
  | { readonly do: "say"; readonly who: string; readonly text: string }
  | { readonly do: "appear"; readonly who: string; readonly where: string | { readonly x: number; readonly y: number }; readonly looks?: string }
  | { readonly do: "face"; readonly who: string; readonly toward: string }
  | { readonly do: "wait"; readonly ms: number }
  | { readonly do: "fade"; readonly dir: "in" | "out" }
  /** 화면 색 — 밤·저녁·새벽·회상(세피아)·clear(원래대로). 컷신 뒤에도 남는다(밤이 되면 밤으로 남음). */
  | { readonly do: "tint"; readonly tone: "night" | "dusk" | "dawn" | "sepia" | "clear" }
  /** 카메라 — to=자리 낱말·사람 이름·'x,y' 로 옮겨 보여 주고, 'back' 이면 주인공에게 돌아온다(안 돌려도 끝에 돌아온다). */
  | { readonly do: "camera"; readonly to: string | { readonly x: number; readonly y: number } }
  /** 인물 모습 — shadow=검은 실루엣, ghost=반투명으로 뜸, normal=되돌림. */
  | { readonly do: "look"; readonly who: string; readonly as: "shadow" | "ghost" | "normal" }
  /** 인물이 연기처럼 사라진다(그 뒤 맵에서 안 보임). */
  | { readonly do: "vanish"; readonly who: string };

/** 없는 기물 — draw_object 의 인자. */
export interface ObjectSpec {
  readonly what: string; // 「놋쇠 태엽 지구본」
  readonly description?: string;
  readonly mapId?: string;
  /** 놓을 자리 낱말 또는 칸. */
  readonly where?: string;
  readonly at?: { readonly x: number; readonly y: number };
  /** 칩셋에 이름이 비슷한 기물이 있다고 거부됐지만 봤더니 다른 물건일 때 — 그 id 들(거부 메시지에 나온 id). */
  readonly notThese?: readonly string[];
}

/** 사람·사건 빌더 결과(장소와 같은 모양으로 보고·검사에 쓴다). */
export interface ContentBuildResult {
  readonly ok: boolean;
  readonly mapIds: readonly string[];
  readonly summary: string;
  readonly warnings: readonly string[];
  readonly missingArt: readonly string[];
  readonly calls: readonly BuilderCall[];
  /** 만든 이벤트 id(맵별). */
  readonly eventIds?: readonly { readonly mapId: string; readonly eventId: string }[];
  /** 편집기에 띄울 카드 요청(그리기 카드 등) — 동사 결과 data 로 실려 편집기가 카드를 연다. */
  readonly card?: unknown;
}
