// allow: SIZE_OK - data table
/** Korean pattern catalog. Evidence for every pid: references/ko/lexical-tells.md. */
import { FAMILY, type Family, makePattern, type Pattern, type Severity } from "../core.ts";

type Opts = { readonly tailOnly?: boolean; readonly raw?: boolean };

function p(pid: string, family: Family, severity: Severity, rx: string, hint: string, opts: Opts = {}): Pattern {
  return makePattern(pid, family, severity, rx, hint, opts);
}

const H: Severity = "high";
const M: Severity = "mid";
const L: Severity = "low";

// Long-sentence noun stacking (references/ko/lexical-tells.md section 13): an 80자+ sentence holding three
// consecutive particle-less Hangul words ("판매대금 별도 관리를"). Adverbs and determiners that also end without a
// particle are excluded so "당장 지금 진행하는" does not count; the lookbehind chain rejects a final particle or ending.
const NOUN_STACK_STOP =
  "당장|지금|나름|조금|아주|그저|다시|아직|이미|매우|가장|정말|너무|계속|먼저|바로|그냥|아마|거의|특히|주로|더욱|오늘|내일|어제|올해|이번" +
  "|모든|여러|어떤|그런|이런|저런|같은|많은|물론|사실|역시|과연|비교적|훨씬|대부분|한번|처음|마침내|드디어|혼자|함께|서로|각각|따로|미리" +
  "|항상|자주|가끔|또한|즉|등|약|총|각|매|사실상|결국|오히려|보통|대체로|점점|점차|갑자기|문득|어느|무슨|어느새|여전히|아마도|어째면" +
  "|만약|비록|설령|그대로|그만큼|이만큼|얼마나|어떻게|언제|어디|누가|무엇|일단|우선|다만|단지|겨우|얼른|진짜|훨씬";
const NOUN_STACK_TAIL = Array.from("은는이가을를의에로와과도만다요고며서데면니지게죠네까라던한된할될")
  .map((c) => `(?<!${c})`)
  .join("");
const NOUN_STACK_WORD = String.raw`(?<![가-힣])(?!(?:${NOUN_STACK_STOP})(?=\s))[가-힣]{2,}${NOUN_STACK_TAIL}`;
export const NOUN_STACK_LONG = String.raw`^(?=.{80,})(?:.*?\s|^)?(?:${NOUN_STACK_WORD}\s+){2}${NOUN_STACK_WORD}(?=[\s,.!?]|$)`;

const ABSTRACT_SUBJECT =
  "(?:평균|숫자|수치|값|지표|데이터|결과|모델|시스템|구조|설계|문제|고장|시간|시계|시장|규칙|벤치|프로파일|로그|대시보드|그래프|공식|곳선|분포|통계|측정값|산술|수학|코드|파이프라인|아키텍처|전략|계획|역사|시대|물리|하드웨어|압력|비용|장부|보고서|문서|검사|실험|질문)";

// Forced analogy (references/ko/lexical-tells.md section 16): a common word privately redefined as one
// object, a vehicle noun equated or likened to the subject, and the same vehicle called back across the piece. The
// vehicle list keeps only figurative nouns; 마구 is listed only with a following particle so the adverb does not count.
export const ANALOGY_VEHICLES =
  "수도관|배관|파이프|톱니바퀴|톱니|나침반|등대|근육|심장|혈관|신경계|면역계|윤활유|씨앗|뿌리|열쇠|그물|거울|방파제|안전망|안전벨트|레고" +
  "|오케스트라|지휘자|악보|각본|망치|기둥|지붕|접착제|조종석|계기판|횃불|등불|토양|비료|온실|정원사|닻|돛|등뼈|척추|숨통|버팀목|디딤돌" +
  "|주춧돌|초석|촉매|모래주머니|방패|갑옷|칼날|양날|저울|시소|고삐|기수|경주마|사다리|문턱|관문|용광로|이정표|나비효과|수도꼭지|안전판" +
  "|완충재|가속기|계단|마구(?=[를는가다에의와과도])";
const VEHICLE_COPULA_TAIL = `(?:이다|입니다|이에요|예요|이죠|였다|이었다|였어요|이었어요|이었습니다|였습니다|인 셈|에 가깝|(?:이|으)?라고 (?:불|부르|생각|보|봐|여기)|로 치면|으로 치면|에 비유)`;
const VEHICLE_SIMILE_TAIL = `(?:처럼|같은|같이|마냥|이 그렇듯|가 그렇듯|와 (?:같|다르지 않|비슷)|과 (?:같|다르지 않|비슷)| 역할|노릇)`;

// Emoji before a line head or a bold label: 21 in agent prose vs 0 in a 146k-char human essay corpus. Emoji
// inside a sentence stay legal (references/ko/lexical-tells.md section 17).
const EMOJI = `\u{1F300}-\u{1FAFF}${String.raw`\u2600-\u27BF\u2B50`}`;
const EMOJI_LABEL = String.raw`(?m)^\s*(?:[-*•]\s*|#{1,6}\s*|\d+[.)]\s*)?[${EMOJI}]|[${EMOJI}]\uFE0F?\s*(?:\*\*|:)`;

const F = FAMILY;

export const PATTERNS: readonly Pattern[] = [
  p("neg-anira", F.NEG_REDEFINE, H, String.raw`(?:이|가|은|는|게|것이|건|도) 아니라\b`, "부정 빼고 B만 쓴다"),
  p("neg-anin", F.NEG_REDEFINE, M, "(?:이|가) 아닌 (?!가)", "A가 아닌 B → B"),
  p("neg-ragiboda", F.NEG_REDEFINE, H, "라기보다", "~라기보다 ~에 가깝다 → 단정문"),
  p("neg-gakkapda", F.NEG_REDEFINE, H, "에 가깝(?:다|습니다|고|게|다는)", "~에 가깝다 → ~이다"),
  p("neg-semida", F.NEG_REDEFINE, M, "인 셈(?:이다|입니다|이죠|이에요)", "~인 셈이다 → 삭제"),
  p("neg-ppun", F.NEG_REDEFINE, M, "[ㄹ을일] 뿐(?:이다|입니다|이죠)", "~일 뿐이다 → 단정문"),
  p("neg-bulgwa", F.NEG_REDEFINE, M, "에 불과", "~에 불과하다 → 단정문"),
  p(
    "neg-dansun",
    F.NEG_REDEFINE,
    H,
    String.raw`단순(?:히|한)[^.\n]{0,25}(?:아니|않|넘어)`,
    "단순히 X가 아니라 / 단순한 X를 넘어 → 삭제, Y만 쓴다",
  ),
  p("neg-scene", F.NEG_REDEFINE, H, "(?:장면|순간|경우|일)(?:은|이) (?:없었|아니었)", "'~한 장면은 없었다' 부정서술 → 있었던 일만"),
  p("neg-absent", F.NEG_REDEFINE, M, String.raw`(?:은|는|도) (?:없었|아니었)(?:다|습니다)\.`, "부정으로 대비 만들기 → 긍정 서술"),
  p("auth-jeunggeo", F.AUTHORITY_NOUN, M, "증거", "증거 → 실제 로그/수치/사례 이름"),
  p("auth-geungeo", F.AUTHORITY_NOUN, M, "근거(?:가|를|는|로|다)", "근거 → 구체 사실"),
  p("auth-chulcheo", F.AUTHORITY_NOUN, M, "출처", "출처 → 누가/어디서"),
  p("auth-unyeong", F.AUTHORITY_NOUN, M, "운영(?!체제)", "운영 → 실제 동사(돌리다/관리하다)"),
  p("auth-geomjeung", F.AUTHORITY_NOUN, L, "검증(?:이|을|된|한|하)", "검증 → 무엇을 어떻게 확인했는지"),
  p("auth-jaehyeon", F.AUTHORITY_NOUN, L, "재현(?:이|을|된|한|하)", "재현 → 다시 돌려 봤다"),
  p("auth-gijun", F.AUTHORITY_NOUN, L, "기준(?:이|으로|은|을) ", "기준 남용"),
  p("meta-chuk", F.METAPHOR_NOUN, H, "(?<![가-힣])축(?:이|은|으로|을|에서|과|도) ", "축 → 그냥 두 가지/두 문제"),
  p("meta-gallida", F.METAPHOR_NOUN, H, "(?:둘|셋|넷|다섯)(?:으)?로 (?:갈|나뉘|나눠)", "N으로 갈린다 → 열거 없이 서술"),
  p(
    "meta-gujo",
    F.METAPHOR_NOUN,
    M,
    "구조(?:다|입니다|였|이다|이고|이며|적으로|입니다)|(?:이|그|같은|다른) 구조(?:는|가|를|로)",
    "'~하는 구조다' → 무엇이 어떻게 되는지 직접",
  ),
  p("meta-heureum", F.METAPHOR_NOUN, M, "흐름(?:이|을|은|으로|에서|이다|입니다)", "흐름 → 순서/과정을 구체로 (AI 9.5배)"),
  p("meta-bangsik", F.METAPHOR_NOUN, L, "방식(?:이다|입니다|으로|이고)", "방식 남용 → 동사로"),
  p("meta-jijeom", F.METAPHOR_NOUN, M, "지점(?:이|에서|은|을|이다|입니다)", "지점 → 부분/때"),
  p("meta-cheung", F.METAPHOR_NOUN, M, "층이 (?:다|달)", "층이 다르다 → 종류가 다르다"),
  p("meta-gyeol", F.METAPHOR_NOUN, M, "결이 (?:다|달|같)", "결이 다르다 → 성격이 다르다"),
  p("meta-gyeonggye", F.METAPHOR_NOUN, M, "경계(?:가|를|에|선|는)", "경계 → 구체 대상"),
  p("meta-pyomyeon", F.METAPHOR_NOUN, M, "표면(?:적|에|을|이)", "표면 → 겉으로/실제로"),
  p("meta-sinho", F.METAPHOR_NOUN, M, "신호(?:가|를|는|다|입니다|로)", "신호 → 무엇이 보였는지"),
  p("meta-jangmyeon", F.METAPHOR_NOUN, M, "장면(?:이|을|은|에서|도)", "장면 → 사건 자체"),
  p("meta-jari", F.METAPHOR_NOUN, L, "자리(?:에|를|가|는|다|입니다) ", "자리 은유"),
  p("meta-body", F.METAPHOR_NOUN, M, "뼈대|골격|받침|레버|지렛대|손잡이|설계도|청사진", "구조물 은유 → 직접 서술"),
  p("meta-sense", F.METAPHOR_NOUN, M, "무게(?:가|를|는|감)|온도(?:가|를|는)|질감|감각(?:이|을|은|으로)|풍경|지형", "감각 은유 → 구체 사실"),
  p(
    "meta-shape",
    F.METAPHOR_NOUN,
    L,
    "(?:같은|한 가지|이) 모양|되는 그림|같은 칸|이 칸|두 시계|다른 시계|같은 눈으로",
    "모양/그림/칸/시계 은유 회귀 → 직접 서술",
  ),
  p(
    "meta-picture",
    F.METAPHOR_NOUN,
    M,
    "(?:는|은|인|한|던|될) (?:모양|그림)(?:이야|이다|입니다|이에요|이었|였|이라|보다|으로|에 가깝|이 (?:더 )?(?:맞|가깝|정확))",
    "'~는 그림이 더 맞아/~는 모양이야' 그림·모양 은유 → 사실을 그대로 말한다",
  ),
  p(
    "meta-direction",
    F.METAPHOR_NOUN,
    M,
    String.raw`방향(?:을|이) (?:바꿨|바꿀|생겼|정해|정했|갖)|방향은 [^.\n]{0,15}에서 왔`,
    "'방향을 바꿨다/방향은 옆 팀에서 왔다' 논지 은유 → 누가 무엇을 했는지",
  ),
  p("meta-texture", F.METAPHOR_NOUN, L, "촘촘|단단(?:하|히)|느슨|묵직|담백|선명|또렷", "질감 형용사 남용"),
  p("meta-quiet", F.METAPHOR_NOUN, L, "조용히|묵묵히|차분히|담담히", "정서 부사 남용"),
  p(
    "meta-stock-figurative",
    F.METAPHOR_NOUN,
    M,
    "잠식|적신호|경고등|신호탄|움켜쥐|뿌리(?:를 )?내리|짓누르",
    "사전 은유(잠식/적신호/신호탄/짓누르다: 사람 0) → 명제로('점유율을 뻗는다')",
  ),
  p("pers-eye", F.PERSONIFY, H, "눈에 (?:들어|띄|띈)", "눈에 들어온다 → 봤다/있었다"),
  p(
    "pers-abstract-agent",
    F.PERSONIFY,
    H,
    ABSTRACT_SUBJECT +
      String.raw`(?:은|는|이|가) [^.\n]{0,24}?(?:만듭니다|만든다|만들었|숨깁니다|숨긴다|가립니다|가린다|지웁니다|지운다|삼킵니다|삼킨다|잡아먹|뭉개|밀어내|끌어올리|떨어뜨리|정해 주|정합니다|정한다|결정합니다|결정한다|고릅니다|고른다|알려 ?줍니다|알려 ?준다|속입니다|속인다|배신|기다립니다|기다린다|강제합니다|강제한다|허락하지|용서하지|반응합니다|대답합니다|읽어 ?줍니다)`,
    "추상명사 주어가 동사를 부린다('평균은 멈춤을 평평하게 만듭니다') → 사람 주어 또는 상태 서술('평균 TPS로는 멈춤을 볼 수 없다')",
  ),
  p(
    "pers-make",
    F.PERSONIFY,
    M,
    String.raw`(?:은|는|이|가) [^.\n]{1,20}(?:을|를) [가-힣]+(?:하게|게) (?:만듭니다|만든다|만들었|만드는)`,
    "'X가 Y를 ~게 만든다' make 구문 → Y가 ~다 / 사람이 ~했다",
  ),
  p(
    "pers-arrive",
    F.PERSONIFY,
    H,
    "(?:고장|문제|질문|순간|시대|차례|위기|변화|시험|기회|시기|국면|다음|결과|답|신호|반전|병목|한계|적|이별|실패|성공)(?:이|가) (?:왔|찾아왔|다가왔|닥쳤|도착|옵니다|온다|찾아옵니다|찾아온다|다가옵니다|다가온다)",
    "사건 도착 은유('더 어려운 고장이 왔습니다') → 무엇이 언제 어떻게 고장 났는지",
  ),
  p(
    "pers-escalation",
    F.PERSONIFY,
    M,
    "(?:^|[.!?] )(?:그러다 |그 다음(?:에|엔)? |이번엔 )?더 (?:어려운|큰|무서운|나쁜|심각한|깊은|이상한|근본적인) [가-힣]+(?:이|가|은|는) ",
    "긴장 고조 비트('더 어려운 고장이') → 사건 문장으로",
  ),
  p(
    "pers-speak",
    F.PERSONIFY,
    H,
    ABSTRACT_SUBJECT +
      String.raw`(?:가|이|는|은) [^.\n]{0,20}?(?:고 )?(?:말하|말해|말합|말한다|보여 ?주|가리키|증언|드러내|알려 ?주|외치|속삭|경고하|인정하)`,
    "숫자가 말한다 → 숫자는 X였다",
  ),
  p("pers-value", F.PERSONIFY, H, "값이 (?:붙|매겨)|값이 됐", "값이 붙다 → 비쌌다/중요했다"),
  p("pers-sit", F.PERSONIFY, H, "앉아 있|머물(?:러 있|렀)|머문다", "사물이 앉다/머물다 → 있다"),
  p("pers-remain", F.PERSONIFY, M, String.raw`(?:이|가) 남(?:는다|습니다|았다|았습니다)\.`, "~가 남는다 → 아직 ~다"),
  p(
    "pers-read",
    F.PERSONIFY,
    H,
    "(?<!잘 )(?<!술술 )(?<!쉽게 )(?<!편하게 )(?<!안 )읽(?:힌(?:다|습니다)|힙니다|혀요?|혔(?:다|어요?|습니다|죠|네)|히(?:는|죠|네요?|지|긴|기도|더라|더군)|힐|힘)",
    "'X로 읽혀/읽힌다' 해석 전가 → 'X다'라고 단정하고 근거를 댄다",
  ),
  p(
    "pers-reveal",
    F.PERSONIFY,
    M,
    String.raw`드러(?:난다|납니다|나요|났(?:다|어요?|습니다|죠|네)?|나(?:는|죠|네요?|지|긴|기도)|나(?=[\s.!?,]|$)|날(?= ))`,
    "'~가 드러난다/드러났어' → 무엇이 어땠는지 직접 서술",
  ),
  p(
    "pers-move",
    F.PERSONIFY,
    M,
    String.raw`(?:숫자|값|수치|측정값|결과|지표|곡선|그래프)(?:가|이) [^.\n]{0,8}?움직`,
    "수치가 움직인다 → 바뀐다",
  ),
  p(
    "guide-thesis-first",
    F.META_GUIDE,
    H,
    "결론부터 말하면|짧은 답변:|한 줄 답|한 줄 평|한 줄 정리|전략 한 줄|컸셉 한 줄|TL;DR|Bottom line|한 문장으로 정리|한 문장 정리",
    "결론 선두 라벨 → 본문이 결론을 드러내게",
  ),
  p(
    "guide-recap",
    F.META_GUIDE,
    H,
    String.raw`(?:이야기|사례|장|절)(?:는|은) [^.\n]{0,25}(?:였습니다|이었습니다|였다|이었다|입니다|이다)\.`,
    "앞 장 요약 메타 문장('그 이야기는 한 팀의 2주였습니다') → 삭제",
  ),
  p(
    "guide-antithesis",
    F.META_GUIDE,
    M,
    String.raw`[가-힣]+(?:은|는) [^,\n]{1,15}(?:는데|지만), [가-힣]+(?:은|는) [^.\n]{1,20}(?:에서 왔|에서 나왔|이었|였)`,
    "대구 전환문('도구는 샀는데, 방향은 옆 팀에서 왔다') → 사건만",
  ),
  p(
    "guide-story-reason",
    F.META_GUIDE,
    M,
    String.raw`이 이야기를 [^.\n]{0,10}(?:옮긴|꺼낸|한) 이유는|먼저 확인했습니다\.|궁금했습니다\.`,
    "글쓴이 행위 설명 → 삭제",
  ),
  p("guide-bogessseubnida", F.META_GUIDE, L, "(?:살펴|알아|짚어|따져|들여다|파헤쳐)보(?:겠습니다|자|겠다|죠)", "진행 안내 → 삭제"),
  p("guide-this-text", F.META_GUIDE, M, "이 글(?:은|에서|의|이)|이 문단|이 섹션|이 장(?:은|에서)", "글 자기언급 → 삭제"),
  p(
    "guide-here-important",
    F.META_GUIDE,
    M,
    "여기서 중요한|중요한 (?:것|점)은|주목할|눈여겨|흥미로운 (?:점|건|것|부분)",
    "중요 표시 → 내용으로",
  ),
  p("guide-concretely", F.META_GUIDE, M, "조금 더 구체적으로|좀 더 자세히|구체적으로 말하면", "처음부터 구체적으로"),
  p("guide-usually", F.META_GUIDE, L, String.raw`보통 [^.\n]{0,10}(?:에는|이런)|일반적으로 다음|통상적으로`, "설명서 어투"),
  p("guide-imagine", F.META_GUIDE, M, "떠올(?:릴 수|려 보|리면)|상상해 (?:볼|보면)|그려볼 수", "떠올릴 수 있다 → 단정"),
  p("take-haeksim", F.TAKEAWAY, H, "핵심은|이게 핵심|그게 핵심", "핵심은 ~ → 내용 문장"),
  p("take-jeongri", F.TAKEAWAY, H, "(?:정리|요약)하(?:면|자면)|한마디로|한 마디로|말하자면|다시 말해|바꿔 말하", "요약 선언 → 삭제"),
  p("take-gyeolguk", F.TAKEAWAY, L, "(?<![가-힣])결국", "결국 남용 (2회+면 손본다)"),
  p(
    "take-whole",
    F.TAKEAWAY,
    M,
    "그게 (?:전부|다|끝)|그뿐|그 뿐|(?:의|이) 전부(?:다|입니다)|딱 하나|유일한 (?:레버|경로|방법|프레이밍)",
    "'전부다/딱 하나/유일한' 단일화 → 서술",
  ),
  p("take-equation", F.TAKEAWAY, M, "(?:가|이) 곧 [가-힣]", "'X가 곧 Y다' 등식틀 → 풀어쓰기"),
  p("take-origin", F.TAKEAWAY, M, String.raw`(?:에게서|에서) 나(?:옵니다|온다|왔습니다|왔다)\.`, "'~에게서 나온다' 출처회귀 결구"),
  p("take-goyo", F.TAKEAWAY, L, String.raw`고요\.`, "'~고요' 완충 어미 (3회+면 손본다)"),
  p(
    "take-decl",
    F.TAKEAWAY,
    M,
    "(?:^|[.!?] )(?:문제는|답은|이유는|차이는|결론은|관건은|필요한 것은|중요한 것은) ",
    "문두 선언형·분열문('필요한 것은 방향이다') → 서술('방향이 필요하다')",
  ),
  p(
    "take-obvious",
    F.TAKEAWAY,
    M,
    "(?:은|는|이|가) (?:명확|분명)(?:하다|합니다|해졌|하다고|해요)",
    "'~은 명확합니다' 평가 술어(It is clear that) → 무엇이 그러한지를 단언으로; 앞에서 논증한 결론이믴 유지",
  ),
  p(
    "take-reason-closer",
    F.TAKEAWAY,
    M,
    "(?:는|은|한|인|된|될|던) 이유(?:다|입니다|이다|였다|이었다|예요)[.!]",
    "'~하는 이유다' 도치 결산(This is why) → 순방향 단언('그래서 ~다'); 고칠 때 새로 만들지 않는다",
  ),
  p("take-sasil", F.TAKEAWAY, L, "사실상|실질적으로|엄밀히|정확히는|정확히 말하면", "정밀 부사 남용"),
  p(
    "offer-wonhamyeon",
    F.CLOSING_OFFER,
    H,
    String.raw`원하(?:면|시면|신다면)|필요하(?:시면|다면)[^.\n]{0,30}(?:드릴|줄게|드리|해 줄)`,
    "말미 제안 → 삭제",
  ),
  p("offer-verb", F.CLOSING_OFFER, H, String.raw`(?:줄게요?|드릴게요?|드리겠습니다|도와 ?드릴)\.?$`, "제안형 마무리 → 삭제", {
    tailOnly: true,
  }),
  p("offer-ask", F.CLOSING_OFFER, M, "말씀(?:해 ?주|주시)|알려 ?주(?:세요|시면)", "요청 유도 → 삭제", { tailOnly: true }),
  p(
    "offer-actions",
    F.CLOSING_OFFER,
    M,
    "액션 체크리스트|즉시 액션|다음 단계로는|잔여 리스크|무엇이 바뀌었나|하지 말 것",
    "액션 목록/잔여 리스크 마무리 → 삭제",
    { tailOnly: true },
  ),
  p(
    "offer-service-honorific",
    F.CLOSING_OFFER,
    M,
    "[가-힣]+ ?드리겠(?:습니다|어요)|드리도록 하겠|드리려고 합니다",
    "서비스 경어('알려드리겠습니다') 본문 → '~합니다/~예정/확인 후 보고'",
  ),
  p("hedge-maybe", F.HEDGE_TAIL, M, String.raw`지도 모(?:른다|릅니다|르겠)|지 않을까\??$`, "여운 헤지 → 단정 또는 삭제"),
  p("hedge-maybe2", F.HEDGE_TAIL, L, "어쩌면|아마도", "헤지 부사"),
  p("hedge-q", F.HEDGE_TAIL, L, String.raw`(?:일까|을까|ㄹ까)\?`, "수사 의문 (사람도 씀, 밀도만)"),
  p("hedge-remain-q", F.HEDGE_TAIL, H, "질문(?:이|은|만) 남|(?:숙제|과제)(?:로|가) 남|묻게 (?:된다|됩니다)", "여운 마무리 → 삭제"),
  p(
    "hedge-objection-slot",
    F.HEDGE_TAIL,
    M,
    "(?:과제|한계|숙제|아쉬운 점|개선점)(?:도|는|은) (?:남아 ?있|분명하|여전하|있)(?:다|습니다|고|지만)",
    "내용 없는 반론 슬롯('과제도 남아 있다') → 어떤 과제인지 쓰거나 삭제",
  ),
  p("trans-geosipnida", F.TRANSLATIONESE, M, String.raw`것입니다|것이다\.`, "~것입니다 → ~입니다"),
  p("trans-su-issda", F.TRANSLATIONESE, L, String.raw`수 있습니다|수 있다\.`, "~할 수 있다 남용"),
  p("trans-e-isseo", F.TRANSLATIONESE, L, "에 있어서?", "~에 있어서 → ~에서"),
  p("trans-tonghae", F.TRANSLATIONESE, L, "을 통해|를 통해", "~을 통해 → ~으로"),
  p("trans-gibaneuro", F.TRANSLATIONESE, L, "을 기반으로|를 기반으로", "~을 기반으로 → ~을 바탕으로"),
  p("trans-raneun-jeom", F.TRANSLATIONESE, L, "라는 점", "~라는 점 → ~라는 것"),
  p("trans-doel-geot", F.TRANSLATIONESE, M, "이 될 것입니다|라고 할 수 있습니다", "→ ~입니다"),
  p("trans-hayeogeum", F.TRANSLATIONESE, M, "으로 하여금", "→ ~이 ~하게"),
  p("trans-maeklak", F.TRANSLATIONESE, M, "이러한 맥락에서|접근 방식|면모|본격적으로", "번역투 명사"),
  p("trans-ie", F.TRANSLATIONESE, L, "(?<![가-힣])이는 |(?<![가-힣])이를 ", "이는/이를 → 이것은/이것을 또는 재구성"),
  p(
    "trans-double-passive",
    F.TRANSLATIONESE,
    L,
    "되어(?:지다|진다|진|졌|지고|지며|지는|질|지면|지게|집니다|졌습니다)",
    "이중 피동('되어진다') → '된다' (잊혀지다·쓰여지다는 사람도 쓰므로 제외)",
  ),
  p(
    "trans-noun-stack-long",
    F.TRANSLATIONESE,
    M,
    NOUN_STACK_LONG,
    "장문 속 조사 없는 명사 3연속('판매대금 별도 관리를') → 조사·동사로 풀거나 문장을 나눈다 (사람 장문 7% vs AI 25-31%)",
  ),
  p(
    "trans-tech-literal",
    F.TRANSLATIONESE,
    M,
    String.raw`오염|배선|승격|강등|완주|침묵|무음|착륙|고아(?=[\s가는를로화이.,])|발화(?!점)`,
    "영어 기술 용어 한자어 직역(contaminated/wiring/promote/complete/silent/land/orphan/fire) → 원어 또는 풀어쓰기(값이 틀어진, 연결, promote, 완료, 에러 없이 누락, orphan row, alert가 뜬다)",
  ),
  p(
    "ban-verb",
    F.BANNED_WORD,
    L,
    "활용하|부각하|제고하|구축하|도래하|함양하|영위하|결부되|연계되|간과하|명시하|야기하|수반하|투영하|상정하|개진하|조명하|견지하|초래하|기여하|표명하|전개하|모색하|재고하",
    "한자어 동사 → 고유어",
  ),
  p(
    "ban-policy-verb",
    F.BANNED_WORD,
    L,
    "(?<![가-힣])(?:확대|강화|확보)(?:해야|하|합|한다|했|된|되|됐|됩)",
    "범용 정책 동사(확대·강화·확보하다) → 무엇을 어떻게 했는지 구체 동사(녹헌다/따냈다/마련했다)",
  ),
  p(
    "ban-adj",
    F.BANNED_WORD,
    L,
    "중추적|핵심적|변혁적|획기적|독보적|비할 데 없|포괄적|전반적|견고한|결정적|다면적|궁극적으로|본질적|유의미|고도화|첨단화|압도적|혁신적|폭발적|각광",
    "한자어 형용사 → 풀어쓰기",
  ),
  p(
    "ban-en",
    F.BANNED_WORD,
    M,
    String.raw`\b(?:delve|elucidate|underscore|harness|leverage|bolster|foster|showcase|streamline|revolutionize|unveil|orchestrate|transcend|pivotal|meticulous|intricate|transformative|groundbreaking|unparalleled|robust|crucial|nuanced|multifaceted|paramount|seamless|holistic|realm|tapestry|landscape|beacon|testament|game-changer|journey|synergy)\b`,
    "영어 AI 단어",
  ),
  p("tic-gpt-ije", F.MODEL_TIC, L, "(?<![가-힣])이제 ", "GPT: 문두 '이제' 남용"),
  p("tic-gpt-kkwae", F.MODEL_TIC, L, "(?<![가-힣])꽤 |충분히", "GPT: 꽤/충분히"),
  p(
    "tic-gpt-boinda",
    F.MODEL_TIC,
    L,
    "로 보(?:인다|입니다)|로 남(?:는다|습니다)|로 이어(?:진다|집니다)",
    "GPT: ~로 보인다/남는다/이어진다",
  ),
  p("tic-claude-jeongjak", F.MODEL_TIC, L, "정작|오히려|정반대로", "Claude: 정작/오히려 반전 부사"),
  p("tic-claude-gujojeok", F.MODEL_TIC, M, "구조적으로|애초에", "Claude: '구조적으로 막았다/불가능' + '애초에'"),
  p(
    "tic-claude-honest",
    F.MODEL_TIC,
    M,
    "정직하게|정직한 (?:잔여|해석|평가|열거)|솔직히 말하면|솔직하게 (?:답|말)|변명 없이",
    "Claude 계열: 정직 자기표시 라벨",
  ),
  p("tic-dan-reversal", F.MODEL_TIC, L, String.raw`(?:^|— |\(|\. )단[, ]`, "에이전트 문서: '단,' 반전 반사"),
  p("tic-eng-jargon", F.MODEL_TIC, M, "헌법|트립와이어|카나리아|방화선|절연|게이트|로드베어링|트리거", "엔지니어 은어 은유 → 일상어"),
  p(
    "tic-verdict-label",
    F.MODEL_TIC,
    L,
    String.raw`\b(?:SUPPORTED|REFUTED|FATAL|SURVIVABLE|SUSTAINED|MEASURED|DERIVED|UNVERIFIED)\b|\*\*수용\.\*\*|판정:|평결:`,
    "판정 라벨 → 문장",
  ),
  p("tic-glm-wait", F.MODEL_TIC, L, "잠깐(?:만요)? ?—|아, 잠깐", "GLM: '잠깐 —' 자기 중단"),
  p(
    "tic-glm-means",
    F.TRANSLATIONESE,
    M,
    String.raw`이는 [^.\n]{0,30}(?:을|를) 의미(?:합니다|한다)|라는 뜻이에요`,
    "'이는 X를 의미합니다' (This means) → 그러니까 X다",
  ),
  p("tic-gpt-checked", F.MODEL_TIC, L, String.raw`제가 [^.\n]{0,15}확인했을 때도|가능성이 (?:높|큽)습니다`, "GPT: 검증 증언 틀/확률 완충"),
  p("tic-claude-hangaji", F.MODEL_TIC, M, "한 가지 (?:더|분명히|인정할|짚)", "Claude: '한 가지 더 짚습니다' 자백 문단"),
  p("tic-claude-process", F.MODEL_TIC, L, "그 과정에서", "Claude: '그 과정에서 하나를 잡았다' 부수성과"),
  p(
    "tic-claude-tteut",
    F.MODEL_TIC,
    M,
    "라는 뜻(?:이다|입니다|이었|이에요)|셔입니다|셔이다",
    "Claude: '즉 ~라는 뜻이다/~셔이다' 추론 종결",
  ),
  p("tic-claude-remaining", F.MODEL_TIC, M, "남은 (?:순서|절차|것)(?:는|은)?:|남은 건 ", "Claude/GPT: '남은 순서: A → B' 마무리"),
  p("tic-arrow-chain", F.MODEL_TIC, M, String.raw`→[^\n]*→`, "화살표 체인 → 문장으로"),
  p(
    "tic-narrative-geobnida",
    F.MODEL_TIC,
    H,
    "(?:던|는|은) (?:겁니다|거죠|거예요)",
    "서사체 종결('너무 낙관적이었던 겁니다') → 사실 서술('너무 낙관적이었습니다')",
  ),
  p(
    "tic-agree-marker",
    F.MODEL_TIC,
    M,
    "정확히 맞(?:습니다|아요|다)|정확합니다|맞습니다!|맞아요!",
    "동조 마커('정확히 맞습니다') → 삭제하고 내용만",
  ),
  p(
    "tic-hortative",
    F.MODEL_TIC,
    L,
    "(?<!살펴|알아|짚어|따져)(?<!들여다|파헤쳐)보죠|봅시다|합시다",
    "청유형('기다려 보죠/봅시다') → 평서문 또는 상태('결과 대기 중')",
  ),
  p("tic-neyo-discovery", F.MODEL_TIC, L, "[가-힣]네요", "발견 감탄조('정리됐네요') → '정리됐습니다' (사람도 씀, 3회+면 손본다)"),
  p("tic-kimi-polite", F.MODEL_TIC, L, String.raw`까요\?|이에요\.|예요\.`, "Kimi: 해요체 질문/설명"),
  p("tic-glm-jeuk", F.MODEL_TIC, L, "(?<![가-힣])즉,", "GLM/GPT: 즉,"),
  p("typo-emdash", F.TYPOGRAPHY, M, "—|–", "em dash → 쉼표/마침표/괄호 해제"),
  p("typo-middot", F.TYPOGRAPHY, M, "[가-힣A-Za-z0-9]·[가-힣A-Za-z0-9]", "가운뎃점 나열 → 쉼표/와"),
  p("typo-colon-line", F.TYPOGRAPHY, L, String.raw`(?m)^[^\n:]{1,40}: \S`, "콜론 라벨 문장 → 줄글"),
  p("typo-bold", F.TYPOGRAPHY, L, String.raw`\*\*[^*\n]+\*\*`, "굵게 강조 → 삭제", { raw: true }),
  p(
    "typo-emoji-label",
    F.TYPOGRAPHY,
    M,
    EMOJI_LABEL,
    "줄 마리·굵은 라벨 앞 이모지 장식(✅ **확인:**) → 삭제(산문 안 이모지는 문장 안에 둔다)",
    { raw: true },
  ),
  // Blog/report tells (references/ko/lexical-tells.md section 14): opinion hedges, confession tics,
  // report jargon, comparative '보다', observer point of view.
  p(
    "hedge-opinion",
    F.HEDGE_TAIL,
    L,
    "라고 봅니다|라고 생각(?:합니다|해요|했습니다|한다)|다고 봅니다",
    "의견 완충('~라고 봅니다/생각해요') → 단정문",
  ),
  p(
    "hedge-recommend",
    F.HEDGE_TAIL,
    M,
    "(?:는|하는|쓰는|가는|두는|보는|옮기는) 편이 (?:낫|좋|맞|빠)|쪽이 (?:낫|맞|빠)|낫다고 봅",
    "권고 완충('~하는 편이 낫다') → 명령문/단정문",
  ),
  // lexical-tells.md section 18: an opinion or a verdict ended on a side instead of the claim. Only an
  // adnominal clause before 쪽 counts; '둘 중 ~ 쪽' and '같은 쪽' pick a literal side, and 권한/기한/제한 are nouns.
  p(
    "hedge-jjok",
    F.HEDGE_TAIL,
    M,
    String.raw`(?<!중 [^.\n]{0,20})(?<![가-힣])(?!같은 )[가-힣]*(?:는|은|던|(?<![권기제무])한|된|운|낸|쁜|할|될) 쪽(?:이다|입니다|이에요|이었|이야|이죠|일 ?(?:겁니다|거예요|거야))`,
    "방향 완충('두 개로 두는 쪽입니다', '반대하는 쪽이에요') → 단정문('두 개로 둡니다', '반대합니다')",
  ),
  p(
    "stock-confess",
    F.STOCK_PHRASE,
    M,
    "고백(?:하|이|을|입|도)|바닥값|솔직(?:히|하게) (?:말|적|답)",
    "자백 틱(고백/바닥값/솔직히) → 사실만 적는다",
  ),
  p("stock-pakje", F.STOCK_PHRASE, M, "박제", "박제 → 적어 두다/남기다"),
  p(
    "stock-restate",
    F.STOCK_PHRASE,
    L,
    "핵심(?:이에요|입니다|이다|이죠)|진짜 (?:비용|문제|이유)|(?<![가-힣])사실은 ",
    "재진술 틱(핵심이에요/진짜 비용/사실은) → 내용 문장",
  ),
  p(
    "jargon-report",
    F.BANNED_WORD,
    M,
    "실측|갈음|하베스트|월권|상수화|정합화|산출물|계측",
    "리포트 용어 → 쉬운 말(직접 확인/대신/걷어 가기/선 넘기/결과물/기록)",
  ),
  // Retrospective tells: anonymised actors, scene-transition filler.
  p(
    "anon-actor",
    F.MODEL_TIC,
    L,
    String.raw`(?<![가-힣])사람이 (?:세션에|스레드에|적었|허가|결정)|\(사람\)|\[\[SLACK:사람\|`,
    "실명을 아는 행위자를 '사람'으로 익명화 → 이름으로(민수가, 지현님이)",
  ),
  p(
    "scene-filler",
    F.STOCK_PHRASE,
    L,
    "(?:그|이) (?:도식|그림|글|링크|메시지)이 (?:이날|그날|그) (?:밤|아침|오후|저녁) [^.]{0,20}(?:올라왔|등장했|나타났)습니다",
    "장면 전환 필러 → 사실 한 문장(누가, 몇 시에, 무엇을 붙였다)",
  ),
  p(
    "compare-boda",
    F.TRANSLATIONESE,
    L,
    "(?<=[가-힣])보다 (?!먼저)",
    "비교 '~보다' → 비교 없이 서술 (일반 독자용 글에서는 0을 목표로, 밀도만 본다)",
  ),
  p(
    "pov-owner",
    F.MODEL_TIC,
    L,
    "제가 (?:낸|만든|넣은|고친|시킨)|(?<![가-힣])저는 ",
    "리포트/회고 화자는 관찰자 → 에이전트가/세션이/사람이",
  ),
  // Forced analogy (lexical-tells.md section 16): private redefinition, vehicle copula, vehicle simile, equation closer.
  p(
    "ana-define-as",
    F.FORCED_ANALOGY,
    H,
    String.raw`(?:라는|이라는|란) (?:말|단어|표현|용어)(?:을|은|는)? [^.\n]{0,14}?정도로 (?:씁니다|쓴다|써요|쓰고|쓰겠|생각|이해|받아들)|(?:을|를|은|는) [가-힣]{1,8} 정도로 (?:생각하면|이해하면|보면|여기면|받아들이면) (?:됩니다|된다|돼요|쉽)`,
    "흔한 말을 사물 하나로 사적 재정의('기록이라는 말을 닻 정도로 씁니다') → 그 말이 가리키는 사실을 직접 쓴다",
  ),
  p(
    "ana-vehicle-copula",
    F.FORCED_ANALOGY,
    M,
    `(?<![가-힣])(?:${ANALOGY_VEHICLES})${VEHICLE_COPULA_TAIL}`,
    "'X는 닻이다' 사물 등식 → X가 실제로 무엇을 하는지",
  ),
  p(
    "ana-vehicle-simile",
    F.FORCED_ANALOGY,
    M,
    `(?<![가-힣])(?:${ANALOGY_VEHICLES})${VEHICLE_SIMILE_TAIL}`,
    "'등대가 그렇듯' 직유 → 비유 없이 사실 한 문장",
  ),
  p(
    "ana-equals",
    F.FORCED_ANALOGY,
    L,
    "(?:이|가|은|는) 곧 [가-힣]{1,8}(?:이다|입니다|이에요|예요|이죠|인 셈)",
    "'X는 곧 Y다' 등식 결구 → 관계를 동사로",
  ),
];
