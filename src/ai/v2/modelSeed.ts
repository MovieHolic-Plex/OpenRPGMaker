// 모델이 보낸 씨앗 버리기 — 씨앗·배치 번호는 요청과 게임 열쇠(spec.salt·spec.variety)로 함수가 정한다.
//
// 왜(2026-10-29 맵 같음 감사): 모델에게 보이던 hints.seed 를 gpt-6.1-terra 가 스키마를 다 채우는 버릇으로 0·1 로 보냈고, 빌더는 모델 씨앗이 있으면
// 무작위 씨앗을 끄므로(마을·던전·실내) 다른 게임이 같은 맵이 됐다. 스키마에서 seed 를 뺐고, 그래도 오면(옛 대화·다른 경로) 여기서 버린다.
// 처음 짓는 명세의 variant 0 도 «안 정함»으로 읽는다(같은 버릇 — 0 이 소금 변주를 껐다). 고치기의 variant 는 모델의 «다른 배치» 뜻이라 둔다.
import type { PlaceSpec } from "./types";

export function dropModelSeed<T extends PlaceSpec>(spec: T, fresh: boolean): T {
  const hints = spec.hints as Record<string, unknown> | undefined;
  if (!hints || (!("seed" in hints) && !(fresh && hints.variant === 0))) return spec;
  const { seed: _seed, ...rest } = hints;
  if (fresh && rest.variant === 0) delete rest.variant;
  return { ...spec, hints: rest as T["hints"] };
}
