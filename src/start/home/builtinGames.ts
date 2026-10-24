// start/home/builtinGames.ts
// 앱에 든 기본 게임 세 편 — 첫 화면 「기본 게임」 선반과 편집기 「새 게임」 덮는 창이 같은 표를 쓴다.
//
// 그림은 출하 플레이어(player.html)로 실제로 띄워 찍은 타이틀 · 오프닝 · 첫 필드다
// (scripts/qa/runtime/home-builtin.scenario.mjs → scripts/content/bake-home-builtin-art.py, public/assets/start/builtin/).
// 2026-10-21 다시 찍음: 폴른 스타 새 타이틀 키아트(감독 선택)·아스트라 오프닝 재연출 판(데모를 다듬는 브랜치의 스냅숏에서 찍었다).
// 소개 글은 하는 사람 기준 한 줄이다 — 「96px 보스전」「30×24 맵」 같은 만든 사람 수치는 쓰지 않는다.

export type BuiltinGameId = "chrono-bell" | "emerald-crown" | "first-love";

export type BuiltinGame = {
  readonly id: BuiltinGameId;
  /** 게임 제목 — 게임 안 글자라 번역하지 않는다(translate="no"). */
  readonly title: string;
  /** 장르 · 분량 한 줄. */
  readonly genre: string;
  /** 한두 문장 소개. */
  readonly description: string;
  /** 표지(타이틀 화면). */
  readonly cover: string;
  /** 마우스를 올리면 넘겨 보이는 장면(오프닝·첫 필드). 첫 장은 표지와 같다. */
  readonly frames: readonly string[];
};

const ART = "/assets/start/builtin/";

export const BUILTIN_GAMES: readonly BuiltinGame[] = [
  {
    id: "chrono-bell",
    title: "폴른 스타: 떨어진 별",
    genre: "판타지 JRPG · 제1막 약 20분",
    description: "북쪽 숲에 떨어진 별 속에서 기계 소녀가 깨어난다. 심문관보다 먼저, 그 아이를 집에 보낼 신호를 찾아라.",
    cover: ART + "fallen-title.webp",
    frames: [ART + "fallen-title.webp", ART + "fallen-op1.webp", ART + "fallen-op2.webp", ART + "fallen-field.webp"],
  },
  {
    id: "emerald-crown",
    title: "아스트라 호라이즌: 다우닝 시티와 여명의 날개",
    genre: "몬스터 수집 RPG · 약 30분",
    description: "다우닝 시티에서 첫 파트너를 고르고 체육관을 돌아 아스트라 성소까지.",
    cover: ART + "astra-title.webp",
    frames: [ART + "astra-title.webp", ART + "astra-op1.webp", ART + "astra-op2.webp", ART + "astra-lab.webp"],
  },
  {
    id: "first-love",
    title: "첫사랑",
    genre: "오피스 로맨스 · 약 20분 · 엔딩 3개",
    description: "첫 출근 날, 사수로 배정된 사람은 10년 전 그 선배였다. 그런데 그는 「처음 뵙겠습니다」라고 했다.",
    cover: ART + "firstlove-title.webp",
    frames: [ART + "firstlove-title.webp", ART + "firstlove-op1.webp", ART + "firstlove-konbini.webp", ART + "firstlove-flashback.webp"],
  },
];

export function builtinGamePlayUrl(id: BuiltinGameId): string {
  return `/index.html?demo=${id}&play=1`;
}

export function builtinGameEditUrl(id: BuiltinGameId): string {
  return `/index.html?demo=${id}`;
}
