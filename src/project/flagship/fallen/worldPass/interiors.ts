/**
 * 실내 정리 — 「실내가 지저분한 곳들도 많은데 정리좀 하고 … 쓸데없이 넓은 곳도 많네」(사용자 2026-11-04).
 * 맵 넓이 대비 바닥 비율·소품 밀도를 재서(scripts/qa/zz-fs2ov-measure) 가장 넓고 어수선한 집 넷을 고른다:
 *   약방 29×16(방 여섯) · 늙은 별지기의 집 29×16(방 다섯) · 리사네 집 29×17(방 여섯) · 빵집 뒤채 29×15(방 여섯).
 * 이야기가 쓰는 방만 남기고 손 도트 실내 v5 원형 크기로 다시 짓는다. 원형 가구 한 벌이 방을 채우므로 손으로 박은 덧가구(dress)는 뺀다 —
 * 방 배치가 바뀌면 고정 좌표 덧가구가 벽에 걸리거나 길을 막았다(fallenTownInteriors.ts 의 r12 기록과 같은 이유).
 * 사람은 fallenTownInteriors 가 원래 쓰던 방(roam)·자리(at)만 새 방에 맞춘다. 수납·꾸지람·은수저 흔적은 그 뒤 단계가 새 가구에 다시 단다.
 */
export type InteriorOverride = {
  readonly layout: Record<string, unknown>;
  readonly dress: readonly (readonly [string, number, number])[];
  readonly people?: Readonly<Record<string, { readonly at?: { x: number; y: number }; readonly roam?: readonly string[] }>>;
};

export const FS_INTERIOR_OVERRIDES: Readonly<Record<string, InteriorOverride>> = {
  // 가게 앞방 + 조제실 + 약재 광 — 15×15(서재·부부 침실·쉼터를 뺀다).
  fs_apothecary: {
    layout: { rooms: [{ kind: "pharmacy_shop", w: 13, h: 6 }, { kind: "alchemy", w: 7, h: 6 }, { kind: "storeroom", w: 5, h: 5 }], seed: 13, variant: 0, styleVariant: "A" },
    dress: [],
  },
  // 거실 + 별 지도 서고 + 침실 — 20×16. 진열실·서재를 빼고 오스본은 서고의 별 렌즈 곁.
  fs_stargazer_home: {
    layout: { rooms: [{ kind: "living", w: 10, h: 5 }, { kind: "library", w: 12, h: 6 }, { kind: "bedroom", w: 5, h: 5 }], seed: 7, variant: 0, styleVariant: "D" },
    dress: [],
    people: { ev_fs_old_stargazer: { at: { x: 8, y: 4 }, roam: ["library", "living"] } },
  },
  // 거실 + 부엌 + 아이 방 + 바느질 방 — 20×17(옷 맞추는 방·부부 침실을 뺀다).
  fs_lisa_home: {
    layout: { rooms: [{ kind: "living", w: 8, h: 7 }, { kind: "kitchen", w: 8, h: 7 }, { kind: "bedroom", w: 8, h: 7 }, { kind: "tailor_work", w: 9, h: 7 }], seed: 29, variant: 0, styleVariant: "A" },
    dress: [],
    people: { ev_fs_lisa: { at: { x: 4, y: 12 }, roam: ["living", "kitchen"] } },
  },
  // 빵 진열 가게 + 빵 굽는 방 + 식료품 광 + 제빵사 방 — 22×14(지하 저장고·식당을 뺀다).
  fs_bakery_home: {
    layout: { rooms: [{ kind: "bakery_shop", w: 14, h: 6 }, { kind: "bakery_oven", w: 8, h: 5 }, { kind: "pantry" }, { kind: "bedroom", w: 4, h: 4 }], seed: 21, variant: 0, styleVariant: "C" },
    dress: [],
  },
};
