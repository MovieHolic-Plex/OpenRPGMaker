// start/home/builtinGames.ts
// 앱에 든 기본 게임 두 편 — 첫 화면 「기본 게임」 선반과 편집기 「새 게임」 덮는 창이 같은 표를 쓴다.
//
// 그림은 출하 플레이어(player.html)로 실제로 띄워 찍은 타이틀 · 오프닝 · 첫 필드다
// (scripts/qa/runtime/home-builtin.scenario.mjs → scripts/content/bake-home-builtin-art.py, public/assets/start/builtin/).
// 소개 글은 하는 사람 기준 한 줄이다 — 「96px 보스전」「30×24 맵」 같은 만든 사람 수치는 쓰지 않는다.

export type BuiltinGameId = "chrono-bell" | "emerald-crown";

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
    title: "폴른 스타: 추락한 별과 태엽의 성녀",
    genre: "판타지 JRPG · 약 40분",
    description: "추락한 별에서 깨어난 안드로이드 소녀가 별지기 기사와 함께 하늘로 돌아갈 길을 찾는다.",
    cover: ART + "fallen-title.webp",
    frames: [ART + "fallen-title.webp", ART + "fallen-op1.webp", ART + "fallen-op2.webp", ART + "fallen-field.webp"],
  },
  {
    id: "emerald-crown",
    title: "아스트라 호라이즌: 다우닝 시티와 여명의 날개",
    genre: "몬스터 수집 RPG · 약 30분",
    description: "다우닝 시티에서 첫 파트너를 고르고 체육관을 돌아 아스트라 성소까지.",
    cover: ART + "astra-title.webp",
    frames: [ART + "astra-title.webp", ART + "astra-op1.webp", ART + "astra-op2.webp", ART + "astra-field.webp"],
  },
];

export function builtinGamePlayUrl(id: BuiltinGameId): string {
  return `/index.html?demo=${id}&play=1`;
}

export function builtinGameEditUrl(id: BuiltinGameId): string {
  return `/index.html?demo=${id}`;
}
