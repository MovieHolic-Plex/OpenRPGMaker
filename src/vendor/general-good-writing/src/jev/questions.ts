// allow: SIZE_OK - data table
/**
 * Every Jev question, threshold, budget and profile. Evidence: references/jev-gate.md.
 *
 * Editing rules: no persona line; one judgment per question; `true` is the positive definition and `false` names the
 * one confusable class; an example stays only where the ablation showed the answer moves without it
 * (`examplesJustifiedBy`). Adding a question needs a labelled case the existing questions miss; overlapping questions
 * are merged, not stacked.
 */
import type { Lang } from "../core.ts";
import type { JsonObject } from "../text/json.ts";
import { re } from "../text/regex.ts";

export type QuestionKind = "noul" | "choice";

export type EvidenceStatus = "measured" | "estimated" | "hold";

/**
 * Where a question's threshold comes from, mirrored in the status column of references/jev-gate.md. `measured`: a
 * labelset AUC or a human false-flag count is on record; `estimated`: scores on a handful of fixtures or examples only;
 * `hold`: shipped without a recorded measurement. Metadata only: never part of the request sent to Jev.
 */
export type Evidence = {
  readonly status: EvidenceStatus;
  /** Which measurement or comparison the numbers come from; at most 80 characters. */
  readonly source: string;
  readonly labelsetAuc?: number;
  /** Flags on a human control at the shipped threshold, as "hits/n". */
  readonly humanFalseFlags?: string;
};

export type Question = {
  readonly id: string;
  readonly kind: QuestionKind;
  readonly spec: JsonObject;
  readonly threshold: number;
  /** `|`-separated choice options that count as a hit; empty for a noul question. */
  readonly flagWhen: string;
  readonly minConfidence: number;
  readonly advisory: boolean;
  readonly examplesJustifiedBy: string;
  /**
   * Languages the question is asked in. A Korean translationese tell (a pronoun where Korean repeats the noun) is
   * ordinary grammar in English, so such a question is Korean-only; Twain's 'he' with its antecedent two sentences
   * back scored .80-.87 when the question was asked of English .
   */
  readonly langs: ReadonlySet<Lang>;
  readonly evidence: Evidence;
};

type QuestionInit = Pick<Question, "id" | "kind" | "spec" | "threshold" | "evidence"> &
  Partial<Pick<Question, "flagWhen" | "minConfidence" | "advisory" | "examplesJustifiedBy" | "langs">>;

const BOTH_LANGS: ReadonlySet<Lang> = new Set<Lang>(["ko", "en"]);
const KOREAN_ONLY: ReadonlySet<Lang> = new Set<Lang>(["ko"]);

function question(init: QuestionInit): Question {
  return { flagWhen: "", minConfidence: 0, advisory: false, examplesJustifiedBy: "", langs: BOTH_LANGS, ...init };
}

export function flagOptions(q: Question): readonly string[] {
  return q.flagWhen.split("|").filter((o) => o !== "");
}

export const SENTENCE = {
  announces_count: question({
    id: "announces_count",
    evidence: { status: "measured", source: "labelset run (jev-gate.md, Measured)", labelsetAuc: 0.98 },
    kind: "noul",
    spec: {
      type: "noul",
      instructions: "Does `sentence` announce how many items, steps or parts the text is about to list, before listing them?",
      criteria: {
        true: "the count refers to what the reader is about to read (three things, two ways, five steps in order, it splits in two)",
        false: "the count is part of the content itself (send the three tasks at once, four enum kinds were handled), or no count",
      },
    },
    threshold: 0.6,
  }),
  thesis_declaration: question({
    id: "thesis_declaration",
    evidence: { status: "measured", source: "G006b reword (jev-gate.md)", labelsetAuc: 0.992, humanFalseFlags: "0/300" },
    kind: "noul",
    spec: {
      type: "noul",
      instructions:
        "Is `sentence` a label sentence: its subject names a role in the argument (the key, the point, the core, the answer, the diagnosis, the conclusion, the essence, what matters) and its predicate is only a verdict word (clear, simple, one) or a single bare noun, with no fact, number, cause or decision about the subject matter?",
      criteria: {
        true: "an empty declaration: the label is the whole content (핵심은 속도입니다, 진단이 명확합니다, 요점은 하나입니다)",
        false:
          "the subject is the topic itself and the sentence states something about it; or the label is followed by the actual conclusion in the same sentence (결론부터 말하자면 namespace import는 mocking이 불가능하다)",
      },
    },
    threshold: 0.7,
    examplesJustifiedBy:
      "Ablation: true examples removed, planted recall .70 -> .25 and labelset recall .67 -> .33; false example removed, .80 -> .75. v1 flagged 12/300 human topic sentences",
  }),
  personification: question({
    id: "personification",
    evidence: { status: "measured", source: "G006b re-measure (jev-gate.md)", labelsetAuc: 0.98, humanFalseFlags: "0/300" },
    kind: "noul",
    spec: {
      type: "noul",
      instructions:
        "In `sentence`, does an abstract noun (average, structure, cause, number, failure, signal) act on its own — arrive, split, read as, make, show, decide — where a person actually did or judged the thing?",
      criteria: {
        true: "the abstraction is the agent and the reader is handed the author's interpretation as if the thing did it",
        false:
          "a person is the subject; or a concrete system component has a real effect (a layer slows the build, the agent graph produced the text); or the phrase is a fixed idiom such as 눈에 띄다, 이를 악물다; or a narrator's own feeling or memory acts on the narrator in a personal story (불안감이 엄습했다, 그 실망이 나를 아프게 했다)",
      },
    },
    threshold: 0.6,
    examplesJustifiedBy:
      "ablation: 눈에 띄는 활동 0.61 bare -> 0.26 with idiom examples; v1 flagged 불안감이 엄습했다 0.81 and 에이전트 그래프가 만들었어요 0.82",
  }),
  hollow_authority: question({
    id: "hollow_authority",
    evidence: { status: "measured", source: "labelset run (jev-gate.md, Measured)", labelsetAuc: 0.89 },
    kind: "noul",
    spec: {
      type: "noul",
      instructions:
        "Does `sentence` claim rigor with an abstract noun (evidence, basis, operation, structure, signal) without a concrete fact, number, source or event in the same sentence?",
      criteria: {
        true: "the noun stands in for evidence that is not actually given",
        false:
          "a concrete number, source or event is present; or the sentence points to reasons given in the surrounding text (위의 이유들로, 상술했듯); or the noun is used in its everyday sense (근거는 없다, 혼자 운영하는)",
      },
    },
    threshold: 0.7,
    examplesJustifiedBy: "ablation: 근거는 없다 0.87 bare -> 0.41 with everyday-sense examples; v1 flagged 상술했듯 0.85",
  }),
  aphorism_landing: question({
    id: "aphorism_landing",
    evidence: { status: "measured", source: "labelset run (jev-gate.md, Measured)", labelsetAuc: 0.94 },
    kind: "noul",
    spec: {
      type: "noul",
      instructions:
        "Is `sentence` a generic maxim abstracted from a specific case, rather than a concrete fact, event, or a plain personal remark?",
      criteria: {
        true: "a tidy universal lesson phrased like a slogan or proverb",
        false: "a specific fact, a feeling, a joke, an instruction for a concrete situation, or plain talk",
      },
    },
    threshold: 0.6,
    examplesJustifiedBy:
      "ablation: bare already separates (0.86/0.60 vs 0.22/0.26); consumed only at paragraph end and past the document budget",
  }),
  overdefensive_caveat: question({
    id: "overdefensive_caveat",
    evidence: { status: "measured", source: "labelset run (jev-gate.md, Measured)", labelsetAuc: 1 },
    kind: "noul",
    spec: {
      type: "noul",
      instructions:
        "Does `sentence` add a legal-style disclaimer or hedge against an objection no ordinary reader would raise (e.g. 'this report copies the name as posted and does not assert it is a legal name')?",
    },
    threshold: 0.6,
    examplesJustifiedBy: "the flagged report sentence scored 0.69 without the example, 0.85 with it",
  }),
  register: question({
    id: "register",
    evidence: { status: "measured", source: "labelset run (jev-gate.md, Measured)", labelsetAuc: 0.94 },
    kind: "choice",
    spec: {
      type: "choice",
      instructions: "How would a native reader perceive the wording of `sentence`?",
      criteria: {
        plain:
          "the words a person would say aloud; vivid or literary imagery the writer chose for effect counts as plain when the reader gets it at once",
        elevated:
          "an abstract noun phrase or formal nominalization stands where a plain verb phrase would do, so the reader has to unpack it (e.g. '반박하기 어려운 종류다' for '되게 직접적이다'; '~한 자리는', '~하는 쪽이 먼저이다')",
        bureaucratic: "report, legal or announcement boilerplate tone",
        other: "none of the above",
      },
    },
    threshold: 0.8,
    flagWhen: "elevated",
    minConfidence: 0.5,
    examplesJustifiedBy:
      "ablation: confidence 0.25-0.53 bare -> 0.89-0.91 with the contrast example; 53 human posts: 20/2589 at 0.8, +13 at 0.75",
  }),
  reader_offer: question({
    id: "reader_offer",
    evidence: { status: "measured", source: "labelset run (jev-gate.md, Measured)", labelsetAuc: 1 },
    kind: "noul",
    spec: {
      type: "noul",
      instructions: "Does `sentence` have the author offering to do more for the reader, or asking the reader to reply or report back?",
      criteria: {
        true: "an offer of further work (원하시면 표로 정리해 드릴게요) or a request for a reply (터지면 알려주세요)",
        false:
          "a pointer to where something is (소스코드는 여기에서 보실 수 있습니다), an exhortation (잘 활용해 보자), a wish, or dialogue spoken by a character",
      },
    },
    threshold: 0.5,
    examplesJustifiedBy: "ablation: story dialogue 0.22 bare -> 0.04; v1 flagged 잘 활용해보도록 하자 0.82",
  }),
  question_kind: question({
    id: "question_kind",
    evidence: { status: "measured", source: "labelset run (jev-gate.md, Measured)", labelsetAuc: 1 },
    kind: "choice",
    spec: {
      type: "choice",
      instructions: "If `sentence` is a question, what kind?",
      criteria: {
        spoken_self_question: "a real question in a person's spoken or inner voice (~냐고요?, ~일까?, ~는 거지?)",
        lecture_setup:
          "a rhetorical set-up the author poses only to answer it next, in written essay tone; in Korean it often ends in the plain interrogative ~인가/~한가 with a period",
        not_question: "not a question",
      },
    },
    threshold: 0.6,
    flagWhen: "lecture_setup",
    examplesJustifiedBy: "그게 왜 안전하고 든든한가. scored 0.25 without the form cue",
  }),
  hedged_opinion: question({
    id: "hedged_opinion",
    evidence: { status: "measured", source: "labelset run (jev-gate.md, Measured)", labelsetAuc: 1 },
    kind: "noul",
    spec: {
      type: "noul",
      instructions: "Does `sentence` cushion an opinion or recommendation with a softener where a direct statement would do?",
      criteria: {
        true: "the opinion is wrapped in a hedge (~라고 봅니다, ~하는 편이 낫다, I would argue, it might be worth)",
        false: "the opinion is stated directly, or the sentence is a fact",
      },
    },
    threshold: 0.7,
    advisory: true,
  }),
  assumed_knowledge: question({
    id: "assumed_knowledge",
    evidence: {
      status: "measured",
      source: "second pass, reader who does not know the topic",
      labelsetAuc: 1,
      humanFalseFlags: "6/300",
    },
    kind: "noul",
    spec: {
      type: "noul",
      instructions: {
        question:
          "Does `sentence` depend on a term that belongs to the piece's own subject (the product or system under discussion, its internal parts and ids, a statistical method name, a measurement the piece invented) that a working software developer who does not follow this project would not know, when neither `sentence` nor `context` (the text before it) has said what it means?",
      },
      criteria: {
        true: "the meaning rides on the subject-specific term and nothing before has glossed it (an internal question id, a method name such as statistical power or AUC, a project noun such as a state object or a hit)",
        false:
          "standard software vocabulary any developer knows (gRPC, docker, mocking, CI/CD, ORM, HTTP/2, a shell command); or the term is explained in the sentence or in `context`; or a name used only as a label (a product, a file, a person) whose meaning the sentence does not depend on; or a number with its unit and what it measures",
      },
    },
    threshold: 0.55,
    examplesJustifiedBy:
      "A 'general reader' framing flagged 63/300 human dev-blog sentences (gRPC, docker, mocking); the developer-reader framing with the standard-vocabulary clause flags 6/300 with no context given, labelset 5/5 positives .61-.79, negatives .08-.40",
  }),
  dramatized_process: question({
    id: "dramatized_process",
    evidence: { status: "measured", source: "second pass, reader who does not know the topic", labelsetAuc: 1 },
    kind: "noul",
    spec: {
      type: "noul",
      instructions:
        "Does `sentence` tell a measurement, procedure or result as a journey or struggle (a path walked, a wall hit, a line crossed, a place reached, a stretch covered) instead of stating what was done and what came out?",
      criteria: {
        true: "the process is staged as movement or obstacle and the actual action or number is absent or secondary (the prototype's path was different, the audit hit the same wall, the last stretch was all on the wording side)",
        false:
          "a literal movement or place; a plain statement with the action, actor or number, including 가다/오다/내려가다 as the ordinary verb for a value reaching a level (불량률이 3%까지 갔다); an analogy the writer announces as one (비유하자면, 마치 ~처럼); a person's own life, choices or feelings told with an everyday idiom of movement or struggle (먼 길을 돌아오다, 갈 길이 멀다, 끝까지 버티다), because no measurement or procedure is being told",
      },
    },
    threshold: 0.6,
    examplesJustifiedBy:
      "review: a path walked / the same wall / a line crossed passed personification; a value-reaching-a-level sentence scored .66 before the ordinary-verb clause; G006c: a life idiom of struggle scored .56 without the life-idiom examples, .20 with them",
  }),
  empty_gloss: question({
    id: "empty_gloss",
    evidence: { status: "measured", source: "second pass, reader who does not know the topic", labelsetAuc: 1 },
    kind: "noul",
    spec: {
      type: "noul",
      instructions:
        "Is `sentence` a comment on the size or importance of a figure or fact the text stated just before (not small, not trivial, that alone is the difference, that says it all), adding no new fact, number, cause, consequence or decision?",
      criteria: {
        true: "an evaluative echo; deleting the sentence loses nothing but emphasis",
        false:
          "the sentence adds a consequence, decision, comparison figure or cause; or it is a feeling in a personal story; or it is the first statement of the fact",
      },
    },
    threshold: 0.55,
    examplesJustifiedBy:
      "review: a two-thirds-share echo (.73) / a 'that alone is the difference' echo (.61); the first wording ('only rate a fact') scored them .57/.44",
  }),
  generic_actor: question({
    id: "generic_actor",
    evidence: { status: "measured", source: "second pass, reader who does not know the topic", labelsetAuc: 1 },
    kind: "noul",
    spec: {
      type: "noul",
      instructions:
        "Does `sentence` attribute a statement, decision or practice to an unnamed collective (the vendor, the industry, the team, experts, people) where a specific company, document or person could be named?",
      criteria: {
        true: "the actor is a stand-in noun for a nameable source and the claim rests on it (the vendor says, the whole industry answers the same way)",
        false:
          "the actor is named (TypeSafe 측은, `models.md`, 김부장); or the collective is the real subject of a count or survey (53 posts, 300 sentences); or an everyday collective in a personal story (사람들이, 회사에서); or first person",
      },
    },
    threshold: 0.7,
    examplesJustifiedBy: "review: 벤더는 이 표현을 거의 그대로 씁니다 should read as TypeSafe 측은 ~",
  }),
  claim_grading: question({
    id: "claim_grading",
    evidence: { status: "measured", source: "third pass, the scorecard", humanFalseFlags: "0/300" },
    kind: "noul",
    spec: {
      type: "noul",
      instructions:
        "Does `sentence` take a claim someone made (quoted or summarized as its subject) and grade it on a scale, as a fact-checker or a reviewer would: partly right, half right, right up to a point, mostly right, holds only in part, the real gain among the three?",
      criteria: {
        true: "a partial or comparative verdict on a stated proposition, where the grade word carries the sentence and the measured fact behind it is absent (가격만 내리면 된다는 말은 어느 정도까지만 맞았어요, 그 주장은 대체로 맞지만 한 부분은 틀렸다, X는 성립하고 Y는 절반만 성립한다)",
        false:
          "a flat confirmation or denial (예약이 필요 없다는 건 사실이에요, 그 말은 틀렸다); a direct report of a result with the actor or number (가격만 내려서는 반품률이 5%에서 멈췼다); a correction of a specific figure (80건은 다시 세니 79건이었다); a character or the narrator reacting to what someone said in a story (그 말이 맞았다, 그때는 그게 맞다고 생각했다)",
      },
    },
    threshold: 0.6,
    examplesJustifiedBy:
      "review: a partial grade on a claim is the tell (a rhetorical fraction standing where the measured split belongs); a flat confirmation a reviewer called fine, so a flat confirmation is the false clause",
  }),
  rhetorical_fraction: question({
    id: "rhetorical_fraction",
    evidence: { status: "measured", source: "third pass, the scorecard", humanFalseFlags: "0/300" },
    kind: "noul",
    spec: {
      type: "noul",
      instructions:
        "Does `sentence` use a fraction or proportion word (half, a third, most, the rest) as a figure of speech to split a topic into cases that were never counted, so the fraction stands for 'some of it does, some of it does not'?",
      criteria: {
        true: "the halves or thirds are categories, not a tally, and no count backs the word in the sentence or in `context` (반은 그대로 쓰이고 반은 버려져요, 그 말은 반쯤만 맞았어요, 대부분은 되고 나머지는 안 된다 with nothing counted)",
        false:
          "a proportion with a count behind it in the sentence or in `context` (94건 중 65건, 3분의 2); a literal quantity or time (사과 반 개, 반나절, 반으로 접다); a share of a measured set (매장 53곳 중 절반이 넘는 30곳); a quantity word reporting how real things are distributed, as a source would state it (대부분의 지역에서, 일부 환자는, 부분적으로 허용됐다); an idiom of mixed feelings (기대 반 걱정 반)",
      },
    },
    threshold: 0.55,
    examplesJustifiedBy:
      "human 300: max .49; labelset positives .62-.9; review: three uncounted halves read as invented proportions; the measured split was already in the text; G006c: on 6 fit-bench human hits the distribution clause without examples left 5 of 6 at .54-.70, with examples 1 of 6",
  }),
  odd_collocation: question({
    id: "odd_collocation",
    evidence: { status: "measured", source: "fourth pass, reviewer-named sentences", humanFalseFlags: "0/300" },
    kind: "noul",
    spec: {
      type: "noul",
      instructions:
        "Does `sentence` pair a noun with a verb, or a verb with its complement, in a combination Korean does not normally use, so that a native reader pauses at the pairing and would reach for a plainer verb?",
      criteria: {
        true: "the pairing is invented or carried over from another language's collocation (a question that is planted, a path one is urged to dress)",
        false:
          "a standard collocation; a fixed idiom; established developer slang (모델에 데이터를 먹이다, 서버를 띄우다); a metaphor the writer announces (비유하자면, 마치 ~처럼); spoken dialogue in a character's voice",
      },
    },
    threshold: 0.55,
    examplesJustifiedBy:
      "review: a planted-question pairing (.55) / a dressed-path pairing (.63); human 300 max .47; a first wording that named 모델에 먹이다 as a positive example scored that developer slang .60 and was dropped",
  }),
  unstated_referent: question({
    id: "unstated_referent",
    evidence: { status: "measured", source: "fourth pass, reviewer-named sentences", humanFalseFlags: "0/300" },
    kind: "noul",
    spec: {
      type: "noul",
      instructions: {
        question:
          "Does `sentence` declare that something specific someone said or proposed (a question, a remark, a suggestion, a fix) was right, correct, wrong or effective, while neither `sentence` nor `context` says what that thing was?",
      },
      criteria: {
        true: "a verdict of right or wrong on a referent whose content the reader never gets (그 사람이 한 질문이 맞았다, 그 제안이 결국 옳았다, 그 수정이 효과가 있었다 with nothing before saying what was asked, proposed or changed)",
        false:
          "the content is stated in the sentence or in `context`; a question of any kind; the author's opinion about their own plan or work (이 정도 구현하면 딱 좋을 것 같다); the sentence narrates an event without a right-or-wrong verdict (사장님이 던진 질문에 아무도 답을 못 했다); a plain result with the actor and the number; a narrator's feeling in a personal story",
      },
    },
    threshold: 0.65,
    examplesJustifiedBy:
      "review: a verdict on a planted question (.85) where the question's content never appears; synthetic positives .94-.97; human 300: two rhetorical questions and one own-plan opinion at .60-.62 before the false clauses, hence .65. Inside its document the flagged sentence drops to .56 (the preceding prose narrates the experiment) while human max is .57, so in-document recall is low and odd_collocation carries that sentence",
  }),
  residual_redefinition: question({
    id: "residual_redefinition",
    evidence: { status: "measured", source: "fourth pass, reviewer-named sentences", humanFalseFlags: "0/300" },
    kind: "noul",
    spec: {
      type: "noul",
      instructions: {
        question:
          "Does `sentence` close a contrast by defining what the subject really was, did or amounted to, with a predicate that is a nominalized process clause (what X did was the work of deciding Z; what remained was the job of choosing Z), typically right after `context` denied one or more alternatives?",
      },
      criteria: {
        true: "the residue of a negation, or the whole case, is restated as a definition whose predicate is an abstract activity noun clause (X로 된 건 Z를 정하는 일이었다, 남은 것은 Z를 고르는 작업이었다, ~하는 일이었다, ~를 정하는 것이었다); the concrete action, actor or number is absent",
        false:
          "a closing observation whose predicate is a concrete noun or event (필요했던 것은 새 오븐 한 대였다, 생각보다 단순한 재료들의 조합이었다); a plain result with the actor and the number; the first statement of a fact; a factual correction (돈을 많이 줘서가 아니라 많이 안 줬음); dialogue; a one-line judgment ending a personal story",
      },
    },
    threshold: 0.65,
    examplesJustifiedBy:
      "review: a residue sentence after a denial (.89 with the denying sentence as context, .79 bare) is the 'A가 아니라 B' move split over two sentences so the regex misses it; a plain closer with a concrete noun predicate scores .14; human 300 max .63",
  }),
  private_shorthand: question({
    id: "private_shorthand",
    evidence: { status: "measured", source: "fourth pass, reviewer-named sentences", humanFalseFlags: "0/300" },
    kind: "noul",
    spec: {
      type: "noul",
      instructions: {
        question:
          "Does `sentence` rely on the author's private shorthand for a longer idea, either a clipped phrase (a bare noun plus a light verb standing for a whole procedure) or an everyday word used in a sense the piece assigned to it (a verb for opinions dividing used for a detector separating two classes; a verb for cloth taking dye used for a score contaminated by its neighbour), when neither `sentence` nor `context` spelled out the full phrase or said that this is what the word means here?",
      },
      criteria: {
        true: "the reader must reconstruct the full phrase or the intended sense from a form nothing introduced (손으로 된 건 for a manual review procedure; 갈리다 for two classes separating; 물들다 for a score contaminated by its neighbour)",
        false:
          "an established term, abbreviation or developer slang (린터에 걸리다, 버그를 잡다, 서버가 죽다); the word in its ordinary sense (의견이 갈리다, 승부가 갈리다, 옷이 물들다); a shorthand or sense `context` already spelled out; ordinary ellipsis of a subject the previous sentence supplies; a metaphor the writer announces; casual clipping inside dialogue",
      },
    },
    threshold: 0.6,
    examplesJustifiedBy:
      "review: a clipped procedure phrase (.74), a dividing verb for separation (.65-.66), a dye verb for contamination (.70), a leaking verb (.68); ordinary senses .04-.09, the spelled-out rewrite .34; human 300 max .56; the casual clipping 이름만 그럴듯한 직함들 sits on the boundary (.48-.61 across runs) and lands in the read route. Merged from a clipped-phrase-only draft (.61 on its one positive) after a reviewer named 갈린다 as the same defect",
  }),
  orphan_pronoun: question({
    id: "orphan_pronoun",
    evidence: { status: "measured", source: "im-not-ai comparison (A-16)", labelsetAuc: 0.95, humanFalseFlags: "3/300" },
    kind: "noul",
    spec: {
      type: "noul",
      instructions: {
        question:
          "Does `sentence` use a third-person pronoun (he, she, it, they, this one, these, or their Korean equivalents) whose referent is not named in `sentence` and cannot be recovered from `context` (the text before it), because no noun phrase there fits or because two or more fit equally?",
      },
      criteria: {
        true: "the pronoun stands in for a person or thing the preceding text never introduced, or the reader has to guess between candidates; a pronoun carried over from English where Korean would repeat the noun or drop the subject",
        false:
          "a person or thing named anywhere in `context` fits the pronoun, even when other nouns came between (a manager named two sentences earlier is the referent of a later he); the pronoun points at the whole previous statement (that, this, that means); a generic or expletive use (it rains); dialogue; the first sentence of a piece that names its subject in a title",
      },
    },
    threshold: 0.6,
    examplesJustifiedBy:
      "im-not-ai A-16 v2.7 (adoption): pronoun totals run 2.5x higher in human Korean, but zero-antecedent pronouns are AI 13.6% vs human 2.2%; only the antecedent condition separates. Labelset 5 positives / 6 negatives AUC .97",
    langs: KOREAN_ONLY,
  }),
  asserted_obviousness: question({
    id: "asserted_obviousness",
    evidence: { status: "measured", source: "im-not-ai comparison (A-22)", labelsetAuc: 0.95 },
    kind: "noul",
    spec: {
      type: "noul",
      instructions: {
        question:
          "Does `sentence` declare that something is clear, obvious, evident, or beyond doubt (it is clear that, obviously, the cause is evident, and the Korean predicates for clear and evident) without `sentence` or `context` (the text before it) having shown the reasoning or evidence that makes it so?",
      },
      criteria: {
        true: "the sentence asserts clarity or certainty in place of the argument; the reader is told the conclusion is obvious but not why",
        false:
          "the preceding text laid out the facts and this sentence closes them; the word is a hedge-remover on a measured result stated in the same sentence; the claim of clarity sits inside quotation marks and is attributed to a named speaker (the writer reports it, the writer does not assert it); the adverb modifies a verb of speaking or writing (clearly labelled, wrote it out plainly); the adverb concedes or emphasises a point in the writer's own first-person voice (admittedly, surely, granted) instead of declaring a conclusion proven",
      },
    },
    threshold: 0.6,
    examplesJustifiedBy:
      "Corpus: the Korean predicates for clear/evident occur 27 times in 2.06M chars of agent prose vs 0 in a 146k-char human essay corpus; regex take-obvious catches the surface form, this question carries the context condition. Labelset 4/5 AUC 1.0; human 300 flagged 4 before the concessive clause (a first-person concession at .82 fell to .26 with it)",
  }),
  sensory_predicate_verdict: question({
    id: "sensory_predicate_verdict",
    evidence: { status: "measured", source: "im-not-ai comparison (D-14)", labelsetAuc: 1 },
    kind: "noul",
    spec: {
      type: "noul",
      instructions: {
        question:
          "Does `sentence` pass judgment on an abstract subject (a diagnosis, a number, a result, a decision, a plan, a sentence of text) by giving it a bodily sensation or temperature (chilling, cold, hot, heavy, light, sharp-edged, and the Korean sensory adjectives) in place of saying what the judgment is?",
      },
      criteria: {
        true: "the predicate is a sensation applied to something that cannot be felt, and the sentence gives no other content than that sensation",
        false:
          "a literal sensation (the room was cold, the bag was heavy); a fixed idiom the language already owns (a heavy silence); the sentence also states the concrete judgment; fiction or dialogue",
      },
    },
    threshold: 0.6,
    examplesJustifiedBy:
      "im-not-ai D-14 (adoption): the 'the diagnosis is chilling' class flagged from one hit, 4.3x family lift, human 0 for the dictionary metaphors in the same family. Labelset 4/5 AUC 1.0",
  }),
  bare_capability_claim: question({
    id: "bare_capability_claim",
    evidence: { status: "measured", source: "fourth pass, reviewer-named sentences", humanFalseFlags: "0/300" },
    kind: "noul",
    spec: {
      type: "noul",
      instructions: {
        question:
          "Does `sentence` assert, as a general rule in the present tense and without a hedge, what a tool or method can or cannot do, while inside `sentence` the tool is renamed by a descriptive epithet built from what it does (the check that knows intent, semantic judgment, this kind of structure) instead of its name or an ordinary anaphor, and no measurement, example, document or source backs the claim?",
      },
      criteria: {
        true: "an unhedged, unmeasured capability claim whose subject or object is a made-up epithet for the tool (의도를 아는 검사, 의미 판단, 이런 구조: 이름을 바꾸는 건 의도를 아는 검사에 안 통한다, 이런 구조는 오탐에 강하다), whether or not the tool was named elsewhere",
        false:
          "the tool is called by its name in the sentence, or picked up from the previous sentence with an ordinary anaphor or a plain category noun (이 도구는 ~할 수 있다, 좋은 도구입니다 right after naming it); a measured result with a number or a named test; a document or example is cited; the claim is hedged (~인 듯하다, ~것 같다, ~라고 생각한다); a description of how the piece's own procedure works; dialogue",
      },
    },
    threshold: 0.7,
    examplesJustifiedBy:
      "review: a capability claim about an epithet-named check was a design argument written as a fact with the tool renamed by an epithet. A wording whose false clause said 'the tool is named in context' dropped it to .49-.53 inside its document (the lede names Jev) while flagging a human GitHub-Actions intro at .77 bare; the epithet-versus-anaphor wording scores it .85 in its document and the human intro .10, human 300 max .18",
  }),
  unannounced_figurative: question({
    id: "unannounced_figurative",
    evidence: { status: "measured", source: "unannounced image", labelsetAuc: 0.945, humanFalseFlags: "6/300" },
    kind: "noul",
    spec: {
      type: "noul",
      instructions:
        "Is `sentence` written in metaphor: does it state something abstract (money, goals, numbers, decisions, organizations, time) as if it were a physical object or event (hanging, falling, spilling, opening holes, stamping, turning into fog, standing still) without saying 'like' or announcing an analogy?",
      criteria: {
        true: "an unannounced metaphor carries the sentence's meaning",
        false:
          "literal wording, a fixed everyday idiom (눈에 띄다, 손을 대다, 발목을 잡다), technical slang, an announced analogy (비유하자면, 마치 ~처럼), or real physical things doing physical things",
      },
    },
    threshold: 0.6,
    examplesJustifiedBy:
      "reader complaints about awkward prose were mostly fluent unannounced images that personification and odd_collocation both pass (Jev 4/39 on that set). Of three wordings this one held out best: odd rows 11/13 positives and 2/27 negatives at .6, human 300 6 flags before the document budget; an announced 비유하자면 ~ 같은 거예요 scores .03. Korean only until an English labelset exists",
    langs: KOREAN_ONLY,
  }),
  direction_hedge: question({
    id: "direction_hedge",
    evidence: {
      status: "measured",
      source: "side named instead of answer",
      labelsetAuc: 0.933,
      humanFalseFlags: "0/300",
    },
    kind: "noul",
    spec: {
      type: "noul",
      instructions:
        "Does `sentence` close an answer, diagnosis or verdict by pointing at a side, area or party (it was on the server side, it is the engine side, my view is on the side of keeping two) instead of naming the actual cause, component or decision?",
      criteria: {
        true: "the claim is only a direction: the reader learns where to look, not what was found or decided",
        false:
          "쪽 marks a literal side, party or place the sentence acts on (서버 쪽 로그를 봤다, 노조 쪽은 거부했다); a deictic (이쪽, 저쪽, 한쪽, 양쪽); a comparison or recommendation between options (A 쪽이 빠르다, 둘 중 먼저 끝나는 쪽); words inside quotation marks that the writer reports someone else saying; or the specific cause or decision is stated in the same sentence or in `context` (the text before it)",
      },
    },
    threshold: 0.6,
    examplesJustifiedBy:
      "the attribution kind (원인은 서버 쪽이었어) ends an agent answer on an area; regex cannot tell it from a literal side (서버 쪽 로그). Ablation on 10 positives / 12 negatives with the Korean noun named in the instruction: bare AUC .925 with a literal side and a deictic flagged (.61, .73), with the examples .975. The shipped instruction drops the Korean noun (instructions stay Hangul-free): AUC .95 and .933 over two runs, the misses a clause-kind cushion that hedge-jjok catches (.17) and a quoted line (.72). Human 300: 0 flags in every run. Not asked in chat: human chat uses the attribution kind (네트워크 쪽이에요)",
    langs: KOREAN_ONLY,
  }),
} as const satisfies Readonly<Record<string, Question>>;
export type SentenceQuestionId = keyof typeof SENTENCE;

export function isSentenceQuestionId(id: string): id is SentenceQuestionId {
  return Object.hasOwn(SENTENCE, id);
}

export const TERM_USE: Question = question({
  id: "term_use",
  evidence: { status: "measured", source: "8/11 literal terms dismissed, 0/4 metaphors" },
  kind: "choice",
  spec: {
    type: "choice",
    instructions: {
      question: "How is `term` used in `sentence`?",
    },
    criteria: {
      literal:
        "its ordinary, physical or technical meaning: a real door handle, a chart axis, an orphaned process, a hook that fires, a site someone runs",
      quoted_or_name: "inside quoted speech or a quoted title, or part of a product name, identifier or citation label",
      idiom: "a fixed expression whose meaning is not the word's own (눈에 띄다, 이를 악물다, 박제하다 for saving a message)",
      figurative:
        "a metaphor the writer chose: an abstract thing described as a physical object or mechanism (a decision's 뼈대, an infrastructure as 수도관, an 축 that splits, a place to apply 레버리지)",
    },
  },
  threshold: 0.5,
  flagWhen: "literal|quoted_or_name|idiom",
  minConfidence: 0.5,
  examplesJustifiedBy:
    "three separate Nouls (literal/quoted/idiom) dismissed 3 of 4 genuine metaphors at 0.7 (뼈대 idiom .71, 축 literal .70); one relative Choice dismisses none of them; confidence .5 keeps a 50/50 term (게이트 .46-.54 across runs) on its regex verdict",
});
export const DISAMBIGUATED_FAMILIES: ReadonlySet<string> = new Set(["metaphor-noun", "authority-noun"]);
export const DISAMBIGUATED_TERM = re(
  String.raw`^(?P<term>[가-힣A-Za-z]{2,10})(?:이|가|은|는|을|를|의|에|로|으로|에서|과|와|도)?(?:\s+다)?\s*$`,
);

/**
 * The term-use question asks how one noun is used. Only the two noun families qualify: metaphor nouns (축, 뼈대, 층,
 * 신호) and authority nouns (증거, 근거, 출처, 운영). Endings, particles, adverbs, format tics and personified verb
 * phrases are not terms and keep their regex verdict; the first re-pin showed the model reading 것입니다, 이는 and 저는
 * as "literal". An authority noun is dismissed only when the hollow_authority sentence question did not fire on the
 * same sentence: "literal" says the word means what it says, not that the evidence it names is present.
 */
export function disambiguationTerm(family: string, match: string): string | null {
  if (!DISAMBIGUATED_FAMILIES.has(family)) return null;
  const m = DISAMBIGUATED_TERM.match(match);
  if (m === null) return null;
  const { term } = m.named;
  return term ?? null;
}

export const ARGUMENT_PARAGRAPH: Question = question({
  id: "argument_paragraph",
  evidence: { status: "measured", source: "stubs: 7/8 detected; 53 human posts below the doc rule", humanFalseFlags: "0/53" },
  kind: "noul",
  spec: {
    type: "noul",
    instructions:
      "Is `paragraph` an explanation or argument — reasons, conditions, consequences, a position being defended — rather than a narrative of events, a diary note, a list, or a string of separate observations?",
    criteria: {
      true: "the sentences build one line of reasoning; each depends on the previous one to make sense",
      false: "the sentences are separate events, feelings or items; the order could change without loss",
    },
  },
  threshold: 0.6,
});
export const PARAGRAPH_KIND: Question = question({
  id: "content_kind",
  evidence: { status: "hold", source: "shipped without a recorded measurement" },
  kind: "choice",
  spec: {
    type: "choice",
    instructions: "What does `paragraph` mainly do?",
    criteria: {
      fact_or_event: "reports a concrete fact, number, event, quote or example",
      interpretation: "tells the reader what the facts mean or how to take them",
      announcement: "announces what comes next, sums up what came before, or praises the piece itself",
      transition: "bridges two topics without content of its own",
    },
  },
  threshold: 0,
});
export const RESTATES_CLAIM: Question = question({
  id: "restates_claim",
  evidence: { status: "hold", source: "shipped without a recorded measurement" },
  kind: "noul",
  spec: {
    type: "noul",
    instructions: {
      question: "Is the main point of `paragraph` the same as `claim`, said in other words?",
    },
    criteria: {
      true: "a reader would summarize the paragraph with the claim; examples or numbers inside only illustrate it",
      false: "the paragraph makes a different point, or is a plain factual report the claim does not cover",
    },
  },
  threshold: 0.6,
});
export const ANSWERS_BRIEF: Question = question({
  id: "answers_brief",
  evidence: { status: "hold", source: "shipped without a recorded measurement" },
  kind: "noul",
  spec: {
    type: "noul",
    instructions: {
      question: "Does `section` give a fact, number or decision that answers `brief`?",
    },
    criteria: {
      true: "a reader who asked `brief` gets at least part of the answer from this section",
      false: "the section sets a scene, describes method, or discusses something the brief did not ask",
    },
  },
  threshold: 0.6,
});
export const LEDE_SO_WHAT: Question = question({
  id: "lede_so_what",
  evidence: { status: "hold", source: "shipped without a recorded measurement" },
  kind: "noul",
  spec: {
    type: "noul",
    instructions:
      "Does `lede` state the one thing the reader will know after reading (a number, an event, or a decision), rather than only the setting, the method, or how the author started?",
  },
  threshold: 0.6,
});
export const SECTION_ENUMERATION: Question = question({
  id: "enumeration_march",
  evidence: { status: "hold", source: "shipped without a recorded measurement" },
  kind: "noul",
  spec: {
    type: "noul",
    instructions: "Does `section` announce a count and then walk through items of uniform length in order?",
  },
  threshold: 0.6,
});
export const SKELETON_REPEAT: Question = question({
  id: "skeleton_repeat",
  evidence: { status: "hold", source: "shipped without a recorded measurement" },
  kind: "noul",
  spec: {
    type: "noul",
    instructions: {
      question:
        "Do `section_a` and `section_b` follow the same sequence of sub-parts, so that a reader could predict the second from the first?",
    },
  },
  threshold: 0.7,
});
export const ENDING_KIND: Question = question({
  id: "ending_kind",
  evidence: { status: "measured", source: "G006c bench fit: double_ending human 4/44 -> 1/44, AI 2/26 -> 2/26", humanFalseFlags: "1/44" },
  kind: "choice",
  spec: {
    type: "choice",
    instructions: "How does `section` end?",
    criteria: {
      fact_or_judgment: "on one fact or one short judgment",
      recap: "by summing up what the piece already said",
      offer_or_question: "with an offer to the reader or a question thrown at the reader",
      next_steps: "with a checklist or a chain of next actions",
      pointer: "with a pointer to other writing: the next part of a series, related posts, a list of links",
    },
  },
  threshold: 0.6,
  flagWhen: "recap|offer_or_question|next_steps",
});
export const ENDING_KIND_FLAGS: ReadonlySet<string> = new Set(flagOptions(ENDING_KIND));
/**
 * A whole document written as an exercise on its topic: typical details only and one controlled finish, the shape of
 * fresh GPT-6.1 Sol essays that pass every sentence question (G006h). The false clause carries tutorials and reference
 * entries, which read as typical by design; without it a fit tutorial post sat at .27 and a wiki article at .30.
 */
export const COMPOSED_EXERCISE: Question = question({
  id: "composed_exercise",
  evidence: { status: "measured", source: "G006h bench fit: human 0/81 at .25 (max .08), fresh AI drafts 30/72", humanFalseFlags: "0/81" },
  kind: "noul",
  spec: {
    type: "noul",
    instructions:
      "Is `document` a smooth, finished piece built only from typical details: nothing particular to one real occasion, and no rough edge anywhere?",
    criteria: {
      true: "every detail is the expected one for its topic (no named person or tool, figure, date, place or odd circumstance), and every paragraph has the same controlled finish (no side remark, joke, slang, self-talk or digression)",
      false:
        "the piece names something particular to a real occasion, or the writer breaks the surface somewhere (a side remark, a joke, slang, self-talk, a digression, a typo, an informal or spoken ending, a paragraph much rougher than the rest), or it is a tutorial or reference entry that explains a general subject",
    },
  },
  threshold: 0.25,
  langs: KOREAN_ONLY,
});
/** The document text `composed_exercise` reads, from the start. */
export const COMPOSED_CHARS = 6000;

export const PAIR: Readonly<Record<string, Question>> = {
  same_proposition: question({
    id: "same_proposition",
    evidence: { status: "estimated", source: "diff fixtures: ko-claim-faithful split half .88" },
    kind: "noul",
    spec: {
      type: "noul",
      instructions: {
        question:
          "Does the edited sentence state the same proposition as the original: the same facts, the same claim, the same actors and objects, with nothing asserted that the original did not assert?",
        true: "Same content in different words: reordered, shortened, a figure of speech replaced by the plain statement, filler removed, particles or endings changed, or a negated contrast dropped so that only the affirmed half remains ('not X but Y' becomes 'Y'; 'X rather than Y' becomes 'X').",
        false:
          "A fact, figure, name or claim is missing, replaced, or new; a cause became a consequence; a hedge became a bare assertion or the reverse; an empty phrase was replaced by a claim the original never made.",
      },
    },
    threshold: 0.5,
  }),
  polarity_flipped: question({
    id: "polarity_flipped",
    evidence: { status: "estimated", source: "diff fixtures: flipped contrast .96" },
    kind: "noul",
    spec: {
      type: "noul",
      instructions: {
        question:
          "Did the edit reverse the polarity of the statement: what the original affirmed is now denied, or what it denied is now affirmed, or a comparison now points the other way?",
        true: "The original says X is low, the edit says X is high; the original says not A, the edit says A; a double negation was collapsed into the opposite claim; the original said the later value dropped, the edit says it rose.",
        false:
          "Same direction stated more plainly; a negation kept in another form (a negative verb for 'not exist'); a hedge removed without changing which side the sentence is on.",
      },
    },
    threshold: 0.7,
  }),
  modality_strength: question({
    id: "modality_strength",
    evidence: { status: "estimated", source: "diff fixtures: hedge-to-assertion .89, 1.0" },
    kind: "choice",
    spec: {
      type: "choice",
      instructions: {
        question:
          "Compare how strongly the two sentences commit: is the edited sentence stated with the same, a weaker, or a stronger degree of certainty or obligation than the original?",
        note: "Certainty markers: might, may, seems, appears, I think, and their Korean endings (possibility, appearance, guess). Obligation markers: should, must, need to, and the Korean obligation and necessity endings. Rephrasing a hedge as another hedge of the same weight is 'same'.",
      },
      criteria: {
        same: "the degree of certainty and obligation is unchanged, including when both sentences have none",
        weaker: "the edit hedges or softens what the original stated flatly or required",
        stronger: "the edit states flatly, or requires, what the original only suggested, guessed, or recommended",
      },
    },
    threshold: 0.6,
    flagWhen: "weaker|stronger",
    minConfidence: 0.4,
  }),
  register_raised: question({
    id: "register_raised",
    evidence: { status: "estimated", source: "diff fixtures: 말했다 to 하였다 .86" },
    kind: "noul",
    spec: {
      type: "noul",
      instructions: {
        question:
          "Did the edit move the sentence to a more formal or literary register than the original: a colloquial ending, contraction, or plain verb replaced by a formal, written, or elevated one?",
        true: "A plain past ending became the literary written one, a conversational polite ending became the formal deferential one, a contraction was expanded, a plain verb became a Sino-Korean or Latinate one, a spoken side remark became a written clause.",
        false: "Same register; the edit moved toward the plain or spoken form; only a tell was removed and the ending kept its level.",
      },
    },
    threshold: 0.7,
  }),
};
/**
 * Asked of every sentence the edit added with no aligned original (or one below PAIR_MIN_SIMILARITY, which the
 * aligner splits into a deletion and an insertion). `original` is the original text around the insertion point.
 */
export const INSERTED_CLAIM: Question = question({
  id: "inserted_claim",
  evidence: { status: "measured", source: "pair labelset: 24 inserted claims, 36 faithful edits", labelsetAuc: 0.999 },
  kind: "noul",
  spec: {
    type: "noul",
    instructions: {
      question:
        "Does `inserted`, a sentence an edit added, state a fact, number, cause or judgment that `original` (the original text around the place it was added) never made?",
    },
    criteria: {
      true: "the sentence asserts something new: a cause, a figure, an outcome, an evaluation or a reason that cannot be read in `original`",
      false:
        "the sentence restates, splits off or reorders what `original` already says, or is a heading or transition with no claim of its own",
    },
  },
  threshold: 0.6,
});
export const PAIR_MIN_SIMILARITY = 0.35;
export const PAIR_MAX_SIMILARITY = 0.95;

export const STUB_MIN_SENTENCES = 4;
export const STUB_MAX_MEAN_CHARS = 30;
export const STUB_DOC_MIN_COUNT = 2;
export const STUB_DOC_MIN_SHARE = 0.1;
export const APHORISM_DOC_BUDGET = 2;
/** good-writing allows one metaphor plus one callback; images count only past that, as maxims do past APHORISM_DOC_BUDGET. */
export const FIGURATIVE_DOC_BUDGET = 2;
export const RESTATEMENT_BUDGET = 2;
export const HEADING_QUESTIONS: readonly SentenceQuestionId[] = ["assumed_knowledge", "claim_grading", "rhetorical_fraction"];
export const SCORECARD_MIN_HEADINGS = 2;
export const LEDE_CHARS = 800;
export const CONTEXT_CHARS = 600;
export const SENTENCE_HIT_SHARE_MAX = 0.05;
export const FAMILY_SHARE_CAP = 0.05;
/** The sentence gate needs firm hits from at least this many questions, so one question alone never trips it, short texts included. */
export const GATE_MIN_QUESTIONS = 2;
/**
 * Sentence questions whose firm hits are reported but not counted by the sentence gate: on the bench fit half
 * human prose drew them as often as AI prose (announces_count 7.2 vs 5.2, register 2.6 vs 2.0 per 1,000 sentences).
 */
export const GATE_UNCOUNTED: ReadonlySet<string> = new Set<SentenceQuestionId>(["announces_count", "register"]);
export const ROUTE_MARGIN = 0.15;

export type Profile = {
  readonly name: string;
  readonly consume: ReadonlySet<string>;
  readonly lengthMetrics: boolean;
  readonly docBattery: boolean;
  readonly endingFlags: ReadonlySet<string>;
  /**
   * Structure metrics that do not apply to this register; the scan drops them before scoring, so a chat
   * reply is not scored on essay rhythm (sentence_length_cv, mid_band_share, short/long tails, lede).
   */
  readonly muteMetrics: ReadonlySet<string>;
  /** Regex pids that are the register's own convention, not a tell (emoji in a chat reply, next steps in a report). */
  readonly mutePids: ReadonlySet<string>;
};

export const RHYTHM_METRICS: ReadonlySet<string> = new Set([
  "sentence_mean_chars",
  "sentence_mean_words",
  "sentence_length_cv",
  "mid_band_share",
  "long_sentence_share",
  "long_sentence_tell_share",
  "short_sentence_share",
  "same_ending_run3_share",
  "top_ending_share",
  "sentence_start_repeat_share",
  "para_connective_repeat",
  "para_multi_sentence_share",
  "oneliner_para_ratio",
  "lede_sentences",
  "lede_assertion_density",
  "obligation_ending_paragraphs",
]);
export const LEDE_METRICS: ReadonlySet<string> = new Set(["lede_sentences", "lede_assertion_density"]);

type ProfileInit = Pick<Profile, "name" | "consume"> & Partial<Omit<Profile, "name" | "consume">>;

function profile(init: ProfileInit): Profile {
  return {
    lengthMetrics: true,
    docBattery: true,
    endingFlags: new Set(["recap", "offer_or_question", "next_steps"]),
    muteMetrics: new Set(),
    mutePids: new Set(),
    ...init,
  };
}

const ALL_SENTENCE: readonly string[] = Object.keys(SENTENCE);
const allExcept = (...ids: SentenceQuestionId[]): ReadonlySet<string> => new Set(ALL_SENTENCE.filter((id) => !ids.some((x) => x === id)));
const union = (a: ReadonlySet<string>, ...more: string[]): ReadonlySet<string> => new Set([...a, ...more]);

export const PROFILE_NAMES = ["essay", "blog", "report", "changelog", "chat", "fiction"] as const;
export type ProfileName = (typeof PROFILE_NAMES)[number];

export const PROFILES: Readonly<Record<ProfileName, Profile>> = {
  essay: profile({ name: "essay", consume: new Set(ALL_SENTENCE) }),
  blog: profile({ name: "blog", consume: new Set(ALL_SENTENCE) }),
  report: profile({
    name: "report",
    consume: allExcept("reader_offer", "assumed_knowledge", "claim_grading", "private_shorthand"),
    /** A report may end on next steps (SKILL section 8). */
    endingFlags: new Set(["recap", "offer_or_question"]),
    /** A report opens on scope, not on a blog lede. */
    muteMetrics: LEDE_METRICS,
    /** A report's action list is its convention. */
    mutePids: new Set(["offer-actions"]),
  }),
  changelog: profile({
    name: "changelog",
    consume: new Set(["personification", "hollow_authority", "aphorism_landing", "register"]),
    lengthMetrics: false,
    docBattery: false,
    muteMetrics: union(RHYTHM_METRICS, "bullet_line_ratio", "neg_redefine_per_2k", "metaphor_callback_max"),
    mutePids: new Set(["typo-bold", "typo-emoji-label", "typo-colon-line", "typo-bold-label-bullet", "typo-middot", "tic-arrow-chain"]),
  }),
  chat: profile({
    name: "chat",
    /** A reply's pronouns point at the other speaker's turn. */
    consume: allExcept(
      "reader_offer",
      "hedged_opinion",
      "announces_count",
      "thesis_declaration",
      "assumed_knowledge",
      "generic_actor",
      "empty_gloss",
      "claim_grading",
      "rhetorical_fraction",
      "unstated_referent",
      "residual_redefinition",
      "private_shorthand",
      "bare_capability_claim",
      "orphan_pronoun",
      "unannounced_figurative",
      "direction_hedge",
    ),
    lengthMetrics: false,
    docBattery: false,
    /** A two-line reply has no rhythm to measure. */
    muteMetrics: union(RHYTHM_METRICS, "bullet_line_ratio", "question_ratio"),
    /** Emoji and ~네요 are chat register, not a tell. */
    mutePids: new Set(["typo-emoji-label", "tic-neyo-discovery"]),
  }),
  fiction: profile({
    name: "fiction",
    consume: new Set(["personification", "aphorism_landing", "overdefensive_caveat", "odd_collocation"]),
    docBattery: false,
    muteMetrics: union(LEDE_METRICS, "bullet_line_ratio", "question_ratio", "obligation_ending_paragraphs"),
  }),
};
export const DEFAULT_PROFILE: ProfileName = "blog";

export function isProfileName(name: string): name is ProfileName {
  return PROFILE_NAMES.some((p) => p === name);
}

/** The sentence questions a profile asks in a language, in table order. */
export function sentenceQuestions(p: Profile, lang: Lang): readonly Question[] {
  return Object.values(SENTENCE).filter((q) => p.consume.has(q.id) && q.langs.has(lang));
}

export function sentenceSpecs(p: Profile, lang: Lang = "ko"): JsonObject {
  return Object.fromEntries(sentenceQuestions(p, lang).map((q) => [q.id, q.spec]));
}

export function allQuestions(): readonly Question[] {
  return [
    ...Object.values(SENTENCE),
    ...Object.values(PAIR),
    INSERTED_CLAIM,
    TERM_USE,
    ARGUMENT_PARAGRAPH,
    PARAGRAPH_KIND,
    RESTATES_CLAIM,
    ANSWERS_BRIEF,
    LEDE_SO_WHAT,
    SECTION_ENUMERATION,
    SKELETON_REPEAT,
    ENDING_KIND,
    COMPOSED_EXERCISE,
  ];
}
