// 조수 v2 깎아지른 지형 종류의 모델이 읽는 줄 — sheerTerrainKinds.json 에서 만든다(손으로 쓴 낱말 목록이 아니다).
// 모델이 바깥 장소가 무엇인지 고르는 곳(마을 카드 · 땅 그림 답의 종류 줄)과 «숲» 이 싣는 숲길 줄이 같은 표를 읽는다(2026-11-17 감독:
// 실제 조수 네 번에서 hints.kind 스키마 설명만으로는 한 번도 고르지 않았다). 가벼운 모듈이라 지시문 쪽이 relief 코드를 끌어오지 않는다.
import sheerKinds from "@/assets/sheerTerrainKinds.json";

const KINDS = sheerKinds.kinds as readonly { id: string; hint: string }[];

/** 종류 id 들(« · » 로 이음). */
export const SHEER_KIND_IDS = KINDS.map((k) => k.id).join(" · ");

/** 마을 카드 · 땅 그림 답의 한 줄 — `id (hint)` 전부. */
export const SHEER_KINDS_CARD_LINE =
  `Sheer cliff maps (no houses, built in one call) — hints:{kind:id}: ${KINDS.map((k) => `${k.id} (${k.hint})`).join(" · ")}.`;

/** 숲길 줄에 붙는 한 문장 — 절벽·계단 밭·정상·하늘·빈터 맵은 숲길 도구가 아니라 make_place 종류다. */
export const SHEER_KINDS_FOREST_NOTE = `Cliff, terrace, summit, sky or glade maps are make_place kinds instead: type:'village', hints kind ${SHEER_KIND_IDS}.`;
