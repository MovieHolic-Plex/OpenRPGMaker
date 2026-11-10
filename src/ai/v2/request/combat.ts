// 전투 요청 낱말 — 전투가 있는 게임인가, 무작위 조우·싸울 적·약한 적·보스전·상태 이상을 바랐나.

/** 전투를 말하는 낱말(전투가 있으면 체력 HUD 를 둔다). */
export const BATTLE_WORDS = /전투|싸우|싸움|싸워|보스|적\b|적이|적을|적의|적과|적들|몬스터|마물|좀비|스킬|기술|마법|레벨|능력치|공격|체력|\bHP\b|마나|약점|인카운터|조우|무기|칼|검을|검이|갑옷|방패|장비|battle|enemy|skill|boss|monster|weapon|zombie/iu;

/** 요청이 무작위 조우를 말하는가 — 말하지 않으면 조수가 켜지 않는다(보이는 적·이벤트 전투로 충분하다). */
const ENCOUNTER_ASK = /랜덤|무작위|인카운터|조우|마주치|튀어나|풀숲에서|사냥|레벨(을|이)?\s*(조금\s*)?(올|업)|경험치|몇 번 싸우|싸우면서|encounter|random battle|grind/iu;

/**
 * 「무작위 조우는 없어」「랜덤 인카운터 없이」처럼 조우를 끄라는 말은 조우 요청이 아니다.
 * 실측(2026-10-31 asst-parity 숲 추격 opus): 「숲길에서는 무작위 조우는 없어」에 끝맺음 검사가
 * 「요청에 무작위 조우가 있는데 조우표가 안 바뀌었다」를 띄웠다. 같은 절 안에서 부정이 뒤따르는 조우 낱말은 지우고 본다.
 */
const ENCOUNTER_NEGATED = /(?:랜덤|무작위|인카운터|조우|마주치|encounter|random battle)[^.,!?\n。]{0,12}?(?:없[어이게고음는다]|없도록|빼|말고|끄|꺼|금지|안\s*(?:나|생기|되)|않)|(?:no|without|disable|turn off)\s+(?:random\s+)?(?:encounters?|battles?)/giu;

export function withoutNegatedEncounters(task: string): string {
  return task.replace(ENCOUNTER_NEGATED, " ");
}

export function asksForEncounters(task: string): boolean {
  return ENCOUNTER_ASK.test(withoutNegatedEncounters(task));
}

/** 싸울 몬스터·적을 바라는 요청(「약한 몬스터가 있게」「고블린과 싸우는」). 「기적이 있」 같은 낱말 속 「적」은 빼려고 앞 글자를 본다. */
export const FOE_ASK = /(몬스터|마물|(?<![가-힣])적|고블린|슬라임|늑대|멧돼지|도적)(들)?(이|가|와|과|랑|하고)?\s*(있|나오|나타나|출몰|싸우|싸울|싸워|덤비|잡)|필드 적|(?<![가-힣])적을\s*(두|놓|배치)|monsters?|enemies|enemy/iu;

export const STATE_WORDS = /독초|독에|독이|독을|독\s*상태|중독|맹독|마비|수면\s*상태|잠\s*상태|상태\s*이상|혼란|침묵|poison|paraly|stun/iu;

/** 「약한·쉬운 몬스터」 요청 낱말. */
export const WEAK_FOE_ASK = /약한|약해|쉬운|쉽게|초반|잡몹|weak|easy/iu;

/** 이 요청에 동사를 싣나 — 싣지 않으면 도구 목록이 늘지 않는다. */
export const wantsBossEncounter = (task: string): boolean => /보스|관장전|마왕|결투|싸우|덤벼|boss/iu.test(task);
