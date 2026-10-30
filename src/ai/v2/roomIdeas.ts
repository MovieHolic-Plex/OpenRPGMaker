// 방 구성 아이디어 그림 — 사용자가 실내 기준으로 고른 assistant-rooms-2 그림(조수 스위트 mapvqa 기준 그림 anchors.json 의 room-*).
//
// 왜(2026-10-30 사용자 지시): 옛 room_parts 는 사람 견본(authored-study 등)을 예시 그림으로 보여 줬고, 모델이 그 서재를 그대로 옮겨 방탈출 방이
// 다 같은 나무 서재가 됐다(map-sameness-1029). 예시는 «구성 아이디어»(동선·초점·가구 묶음)로만 보여 주고 베끼지 말라고 함께 적는다.
// 그림은 public/assets/room-ideas/ 의 96색 축소 사본(1배, 원본은 suite/mapvqa/refs/anchors/). 실행기가 env.readPublicAsset 으로 읽는다 —
// 못 읽으면 글 설명만 간다.

export type RoomIdeaKind = "hall" | "bed" | "study" | "other";

export interface RoomIdea {
  readonly id: string;
  readonly kind: RoomIdeaKind;
  readonly file: string;
  /** 무엇을 보면 되는가 — 구성(동선·초점·묶음)만. 크기·자리·기물을 그대로 옮기라는 뜻이 아니다. */
  readonly idea: string;
}

export const ROOM_IDEAS: readonly RoomIdea[] = [
  { id: "rooms2-28", kind: "hall", file: "assets/room-ideas/rooms2-28.png", idea: "여관 1층: 북쪽 벽난로가 초점, 탁자 묶음이 깔개 위에 섬처럼, 카운터와 부엌·창고가 곁방으로 갈라진다. 문에서 카운터까지 길이 비어 있다." },
  { id: "rooms2-29", kind: "hall", file: "assets/room-ideas/rooms2-29.png", idea: "여관 1층(다른 안): 계단·카운터·식탁 구역이 깔개 색으로 나뉘고 부엌·술통 방이 옆으로 붙는다." },
  { id: "rooms2-26", kind: "bed", file: "assets/room-ideas/rooms2-26.png", idea: "여관 2층: 작은 침실 셋이 복도 위에 나란히, 방마다 침대 둘+깔개 하나, 복도 끝에 계단." },
  { id: "rooms2-31", kind: "study", file: "assets/room-ideas/rooms2-31.png", idea: "마법 도서관: 북벽을 책장 줄이 채우고, 아래쪽은 깔개 둘레 열람 탁자 넷, 왼쪽 철창 서고가 따로 갈라진다." },
  { id: "rooms2-30", kind: "study", file: "assets/room-ideas/rooms2-30.png", idea: "큰 도서관: 서가가 가로 줄로 통로를 만들고, 아래 열람석·마법진 구역·철창 금서고로 나뉜다." },
  { id: "rooms2-33", kind: "study", file: "assets/room-ideas/rooms2-33.png", idea: "금서고: 철책 한 줄이 방을 위(잠긴 서가)·아래(열람석)로 가르고, 가운데 문 하나로만 지난다." },
  { id: "rooms2-00", kind: "other", file: "assets/room-ideas/rooms2-00.png", idea: "천문대: 가운데 의식 공간이 초점, 양옆 곁방이 대칭, 남쪽 문에서 깔개 길이 초점까지 곧게 간다." },
  { id: "rooms2-13", kind: "other", file: "assets/room-ideas/rooms2-13.png", idea: "화로 석실: 기둥 넷이 가운데 화로 구역을 둘러싸고, 곁방들이 작업·진열 용도로 나뉜다." },
  { id: "rooms2-19", kind: "other", file: "assets/room-ideas/rooms2-19.png", idea: "별지기 석실: 위는 상징물 홀, 가운데 긴 복도, 아래 작업방 둘 — 층층이 용도가 바뀐다." },
  { id: "rooms2-37", kind: "other", file: "assets/room-ideas/rooms2-37.png", idea: "대장간: 진열실과 작업실 두 칸, 화덕이 작업실 북벽 초점." },
];

/** 방 용도 낱말 → 아이디어 그림 둘(같은 갈래 먼저, 모자라면 다른 갈래). */
export function roomIdeasFor(purpose: string, n = 2): RoomIdea[] {
  const p = purpose.toLowerCase();
  const kind: RoomIdeaKind = /침실|객실|숙소|위층 방|inn_room|guest|bed|dorm/u.test(p) && !/서재|study/u.test(p) ? "bed"
    : /여관|선술|주점|홀|식당|inn|tavern|hall|bar|pub/u.test(p) ? "hall"
    : /서재|도서|서고|책|연구|study|library|archive/u.test(p) ? "study"
    : "other";
  const same = ROOM_IDEAS.filter((r) => r.kind === kind);
  const rest = ROOM_IDEAS.filter((r) => r.kind !== kind && r.kind === "other");
  return [...same, ...rest].slice(0, n);
}

export const ROOM_IDEA_RULE = "구성 아이디어 그림 — 동선(문에서 어디로 걷나)·초점(눈이 먼저 가는 물건)·가구 묶음(무엇끼리 모이나)만 본다. 크기·모양·기물 자리를 그대로 베끼지 않는다: 네 방의 용도·이야기로 새로 짠다. 같은 그림을 닮은 방이 둘 이상 나오면 반복으로 친다.";
