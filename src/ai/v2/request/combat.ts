// 전투 요청 낱말과 규칙 — 전투가 있는 게임인가, 무작위 조우·싸울 적·약한 적·보스전·상태 이상을 바랐나.
import { kw } from "./text";

/** 전투를 말하는 낱말 — 한 표. core 는 «전투가 있는 게임»(체력 HUD 를 둔다), related 는 전투 도구를 같이 실을 낱말(동료·장비·상태…)이다. */
const COMBAT = {
  core: String.raw`전투|싸우|싸움|싸워|보스|${kw("적", "들")}|몬스터|마물|좀비|스킬|기술|마법|레벨|능력치|공격|체력|\bHP\b|마나|약점|인카운터|조우|무기|${kw("칼")}|검을|검이|갑옷|방패|장비|battle|enemy|skill|boss|monster|weapon|zombie`,
  related: String.raw`무리|주문|직업|방어|피해|데미지|\bMP\b|에테르|약하게|속성|치명타|상태|${kw("독")}|중독|마비|수면|화상|기절|마주치|늑대|멧돼지|슬라임|고블린|드래곤|도마뱀|박쥐|검과|검 |${kw("활")}|창을|장신구|반지|목걸이|연계|합체|협동|콤보|부하|소환|페이즈|레벨 ?업|팡파레|습득|달려들|돌진|동료|파티|합류|armor|class|level|party`,
} as const;
/** 전투를 말하는 낱말(전투가 있으면 체력 HUD 를 둔다). */
export const BATTLE_WORDS = new RegExp(COMBAT.core, "iu");
/** 전투 도구(직업·기술·적·부대·조우…)를 실을 낱말 — 전투 낱말에 동료·장비·상태 낱말까지. */
export const BATTLE_TOOL_WORDS = new RegExp(`${COMBAT.core}|${COMBAT.related}`, "iu");

/** 무작위 조우 낱말 — 한 표. random 은 조우를 이름 댄 말, grind 는 조우가 있어야 되는 말(사냥·경험치). */
const ENCOUNTER = {
  random: String.raw`랜덤|무작위|인카운터|조우|마주치|튀어나|풀숲에서|encounter|random battle`,
  grind: String.raw`사냥|레벨(?:을|이)?\s*(?:조금\s*)?(?:올|업)|경험치|몇 번 싸우|싸우면서|grind`,
} as const;
const RANDOM_ENCOUNTER = new RegExp(ENCOUNTER.random, "iu");
const GRIND = new RegExp(ENCOUNTER.grind, "iu");

/**
 * 「무작위 조우는 없어」「랜덤 인카운터 없이」처럼 조우를 끄라는 말은 조우 요청이 아니다.
 * 실측(2026-10-31 asst-parity 숲 추격 opus): 「숲길에서는 무작위 조우는 없어」에 끝맺음 검사가
 * 「요청에 무작위 조우가 있는데 조우표가 안 바뀌었다」를 띄웠다. 같은 절 안에서 부정이 뒤따르는 조우 낱말은 지우고 본다.
 */
const ENCOUNTER_NEGATED = /(?:랜덤|무작위|인카운터|조우|마주치|encounter|random battle)[^.,!?\n。]{0,12}?(?:없[어이게고음는다]|없도록|빼|말고|끄|꺼|금지|안\s*(?:나|생기|되)|않)|(?:no|without|disable|turn off)\s+(?:random\s+)?(?:encounters?|battles?)/giu;

export function withoutNegatedEncounters(task: string): string {
  return task.replace(ENCOUNTER_NEGATED, " ");
}


/** 싸울 몬스터·적을 바라는 요청(「약한 몬스터가 있게」「고블린과 싸우는」). 「기적이 있」 같은 낱말 속 「적」은 빼려고 앞 글자를 본다. */
export const FOE_ASK = /(몬스터|마물|(?<![가-힣])적|고블린|슬라임|늑대|멧돼지|도적)(들)?(이|가|와|과|랑|하고)?\s*(있|나오|나타나|출몰|싸우|싸울|싸워|덤비|잡)|필드 적|(?<![가-힣])적을\s*(두|놓|배치)|monsters?|enemies|enemy/iu;

export const STATE_WORDS = /독초|독에|독이|독을|독\s*상태|중독|맹독|마비|수면\s*상태|잠\s*상태|상태\s*이상|혼란|침묵|poison|paraly|stun/iu;

/** 「약한·쉬운 몬스터」 요청 낱말. */
export const WEAK_FOE_ASK = /약한|약해|쉬운|쉽게|초반|잡몹|weak|easy/iu;

const BOSS_ASK = /보스|관장전|마왕|결투|싸우|덤벼|boss/iu;

export interface CombatAsk {
  /** 전투가 있는 게임·요청이다. */ readonly mentioned: boolean;
  /** 무작위 조우를 이름 댔다(「랜덤 인카운터」「풀숲에서 마주치는」) — 조우표가 바뀌어야 한다. */ readonly randomEncounters: boolean;
  /** 조우가 있어야 되는 일을 바랐다(사냥·경험치·레벨 올리기). */ readonly grinding: boolean;
  /** 조우를 켜도 된다(randomEncounters 또는 grinding). */ readonly encounters: boolean;
  /** 싸울 적·몬스터를 바랐다. */ readonly foes: boolean;
  /** 보스전을 바랐다. */ readonly boss: boolean;
}
/** 한 요청의 전투 판정 — 이름·대사를 가린 글을 받는다. 「무작위 조우는 없어」처럼 끄라는 말은 조우 요청이 아니다. */
export function combatAsk(task: string): CombatAsk {
  const heard = withoutNegatedEncounters(task);
  const randomEncounters = RANDOM_ENCOUNTER.test(heard), grinding = GRIND.test(heard);
  return { mentioned: BATTLE_WORDS.test(task), randomEncounters, grinding, encounters: randomEncounters || grinding, foes: FOE_ASK.test(task), boss: BOSS_ASK.test(task) };
}
