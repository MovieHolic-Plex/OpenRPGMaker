// src/editor/workshop/generators.ts
/**
 * 공방 첫 화면의 생성기 카드 넷(2026-10-21 사용자 결정: 하네스 목록을 빼고 char-gen·object-gen·tile-gen·item-gen 과 잇는다).
 * 화면 글은 쉬운 말만 — 모델 이름·내부 용어를 쓰지 않는다. 상태는 정직하게:
 * - object-gen: 편집기 안에서 사용자 자기 AI 계정으로 그린다(공방 실행기). object-gen 이 만든 묶음도 가져온다.
 * - char-gen: 파이썬 도구라 브라우저에서 못 돈다 → 사용자 컴퓨터의 AI 에이전트에게 부탁할 글을 만들어 주고, 결과 묶음을 가져온다.
 * - tile-gen·item-gen: 아직 없다(tile-gen 저장소는 이름과 달리 물건 생성기, item-gen 은 저장소가 없다) → 「준비 중」.
 */
import { getLocale } from "@/i18n";

export type GeneratorId = "char-gen" | "object-gen" | "tile-gen" | "item-gen";
/** ready = 편집기 안에서 만든다 · local = 내 컴퓨터에서 만들어 가져온다 · soon = 준비 중 */
export type GeneratorStatus = "ready" | "local" | "soon";

export interface WorkshopGenerator {
  readonly id: GeneratorId;
  readonly title: string;
  /** 무엇을 만드는가 — 한 줄 */
  readonly makes: string;
  readonly status: GeneratorStatus;
}

export const WORKSHOP_GENERATORS: readonly WorkshopGenerator[] = [
  { id: "char-gen", title: "캐릭터", makes: "맵을 걸어 다니는 캐릭터 그림을 옷·머리·색을 바꿔 새로 만들어요.", status: "local" },
  { id: "object-gen", title: "물건·가구", makes: "가구·상자·표지판 같은 물건 그림을 지금 맵의 그림 느낌에 맞춰 그려요.", status: "ready" },
  { id: "tile-gen", title: "타일", makes: "바닥·벽·길 같은 맵 칸 그림을 지금 맵의 그림 느낌으로 그려 줄 거예요.", status: "soon" },
  { id: "item-gen", title: "아이템·아이콘", makes: "물약·열쇠·무기 같은 아이템 아이콘을 그려 줄 거예요.", status: "soon" },
];

export const GENERATOR_STATUS_LABELS: Readonly<Record<GeneratorStatus, string>> = {
  ready: "여기서 만들기",
  local: "내 컴퓨터에서 만들어 가져오기",
  soon: "준비 중",
};

/** char-gen 은 공개 저장소다. object-gen 은 비공개라 설치 안내를 내지 않는다(묶음 가져오기만). */
export const CHAR_GEN_REPO_URL = "https://github.com/MovieHolic-Plex/char-gen";

/**
 * 사용자 컴퓨터의 AI 에이전트(자기 로그인)에게 붙여 넣을 부탁 글. 에이전트에게 가는 글이라 화면 번역 대상이 아니므로
 * 지금 언어로 직접 만든다. char-gen 스킬이 깔려 있으면 에이전트가 단계(만들기·검사·사람 고르기·묶기)를 알아서 한다.
 */
export function charGenRequest(what: string, count: number): string {
  const subject = what.trim() || defaultWhat();
  const n = Math.max(1, Math.min(4, Math.round(count) || 1));
  switch (getLocale()) {
    case "en": return `Use char-gen to make ${n} walking character chip(s): "${subject}". When they pass the check and I have picked, run char-gen pack to make a pack folder I can import into the OPRN editor.`;
    case "ja": return `char-gen で歩行キャラチップを ${n} 体作って:「${subject}」。チェックを通って私が選んだら、char-gen pack で OPRN エディターに取り込めるパックフォルダを作って。`;
    case "zh": return `用 char-gen 做 ${n} 个行走角色小图:「${subject}」。通过检查并由我挑选后,用 char-gen pack 打包成可导入 OPRN 编辑器的文件夹。`;
    default: return `char-gen 으로 걷는 캐릭터 칩을 ${n}개 만들어 줘: 「${subject}」. 검사를 통과하고 내가 고르면 char-gen pack 으로 OPRN 에디터에 가져올 묶음 폴더를 만들어 줘.`;
  }
}

function defaultWhat(): string {
  switch (getLocale()) {
    case "en": return "a harbor sailor in a blue coat";
    case "ja": return "青いコートの港の船乗り";
    case "zh": return "穿蓝色外套的港口水手";
    default: return "파란 외투를 입은 항구 선원";
  }
}
