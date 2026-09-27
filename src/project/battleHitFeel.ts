// project/battleHitFeel.ts — 전투 타격감 프리셋의 단일 진실 공급원.
//
// 스킨(battleUiStyle)은 화면 뼈대를, 타격감은 "때리고 맞는 순간" 의 연출 세기를 정한다. 둘은 별개 축이다.
//   impact(묵직하게, 기본) — 조사한 참고작 문법을 모두 켠다(~/claude-viz/hit-feel-lab.html §5 우선순위 1~5):
//                            아군 피격은 피해량과 무관하게 화면을 크게 흔들고(드래곤 퀘스트), 히트스톱 동안
//                            맞은 쪽이 떨고(사쿠라이), 착탄 직전 베기 궤적·휘두름 소리(예비동작),
//                            넉백 반동·방향 있는 카메라 킥(Vlambeer), 저음을 겹친 타격음.
//   light(가볍게)          — 2026-09-27 이전의 연출 그대로. 흔들림은 피해 비율로만 정한다.
//   calm(차분하게)         — 화면 흔들림·필드 번쩍임·펀치·파편을 끈다. 숫자·HP·점멸은 남는다.
//                            멀미·광과민에 민감한 플레이어를 위한 선택지다.
// DOM 을 만지지 않는다. 런타임은 battle-scene 의 data-battle-hit-feel 로 갈라진다(battleDom.ts, 22-hit-feel.css).

export const BATTLE_HIT_FEEL_IDS = ["impact", "light", "calm"] as const;
export type BattleHitFeel = (typeof BATTLE_HIT_FEEL_IDS)[number];

export const DEFAULT_BATTLE_HIT_FEEL: BattleHitFeel = "impact";

export const BATTLE_HIT_FEEL_LABELS: Readonly<Record<BattleHitFeel, string>> = {
  impact: "묵직하게 (기본)",
  light: "가볍게",
  calm: "차분하게 (흔들림 없음)",
};

export const BATTLE_HIT_FEEL_DESCRIPTIONS: Readonly<Record<BattleHitFeel, string>> = {
  impact: "맞으면 화면이 크게 흔들리고 파티 창이 반응합니다. 때릴 때는 휘두름 궤적과 떨림, 반동이 붙습니다.",
  light: "피해가 클 때만 흔들리는 가벼운 연출입니다.",
  calm: "화면 흔들림과 번쩍임을 끕니다. 피해 숫자와 HP 변화는 그대로 보입니다.",
};

export function isBattleHitFeel(value: unknown): value is BattleHitFeel {
  return typeof value === "string" && (BATTLE_HIT_FEEL_IDS as readonly string[]).includes(value);
}

export function resolveBattleHitFeel(value: unknown): BattleHitFeel {
  return isBattleHitFeel(value) ? value : DEFAULT_BATTLE_HIT_FEEL;
}
