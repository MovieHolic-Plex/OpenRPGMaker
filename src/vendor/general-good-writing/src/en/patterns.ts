// allow: SIZE_OK - data table
import { FAMILY, type Family, makePattern, type Pattern, type Severity } from "../core.ts";

/**
 * English pattern catalog. Evidence for every pid: references/en/lexical-tells.md (per-million-word rates from a
 * coding-agent prose corpus vs Paul Graham essays; discourse counts over 32 AI samples vs 15 PG essays).
 * Severity rule: lift >= 5 with n >= 30 -> high, lift >= 2 -> mid, else low; public-catalog entries with 0 local hits
 * and 0 in PG ship as low; discourse signals with 0 PG hits ship as mid. Phrases Paul Graham uses as often as the models
 * (not just, not only, ultimately, arguably, imagine, leverage, in other words, on the other hand, three things ...)
 * are deliberately absent.
 */

type Options = { readonly tailOnly?: boolean; readonly raw?: boolean; readonly caseSensitive?: boolean };

function p(pid: string, family: Family, sev: Severity, rx: string, hint: string, opts: Options = {}): Pattern {
  return makePattern(pid, family, sev, rx, hint, {
    tailOnly: opts.tailOnly ?? false,
    raw: opts.raw ?? false,
    flags: opts.caseSensitive === true ? [] : ["i"],
  });
}

const H: Severity = "high";
const M: Severity = "mid";
const L: Severity = "low";
const F = FAMILY;

/**
 * Forced analogy (references/en/lexical-tells.md section 3b). The analogy frame itself (`think of it as`,
 * `X is the compass`, `it's like`) is a Paul Graham move and never ships; what ships is the stock vehicle. This list
 * feeds the metaphor-callback metric; `ana-vehicle-copula` scopes the frame to these nouns and stays low.
 */
export const ANALOGY_VEHICLES =
  "flywheel|safety net|seat ?belts?|rabbit hole|treadmill|hamster wheel|connective tissue|linchpin|lifeblood|secret sauce" +
  "|swiss army knife|training wheels|tip of the iceberg|plumbing|north[- ]star|scaffolding|backbone|glue|compass|lighthouse" +
  "|nervous system|immune system|engine|fuel|muscle|skeleton|spine|thermostat|autopilot|toolbox|gatekeeper|catalyst|rudder" +
  "|torch|beacon|shield|funnel|ladder|mirror|orchestra|conductor|symphony|tapestry";

/** Emoji labels: 25 line-initial / label emoji per million words in agent prose, 0 in 40 PG essays. */
const EMOJI = "[\u{1F300}-\u{1FAFF}\u2600-\u27BF\u2B50]";
export const EMOJI_LABEL = `${String.raw`(?m)^\s*(?:[-*•]\s*|#{1,6}\s*|\d+[.)]\s*)?`}${EMOJI}|${EMOJI}${String.raw`\uFE0F?\s*(?:\*\*|:)`}`;

const VEHICLE_COPULA = String.raw`\b(?:is|are|was|were|becomes?|acts? as|serves? as|functions? as|works? as|think of (?:it|this|them|that) as) (?:the|a|an|like the|like a|essentially the|basically the|a kind of|a sort of|our|your|its|their|my) (?:(?:[a-z]+-)?[a-z]+ )?(?:${ANALOGY_VEHICLES})s?\b`;

export const PATTERNS: readonly Pattern[] = [
  p("neg-rather-than", F.NEG_REDEFINE, M, String.raw`\brather than\b`, "'X rather than Y' -> say X; cut the contrast"),
  p(
    "auth-evidence-suggests",
    F.AUTHORITY_NOUN,
    M,
    String.raw`\bevidence (?:suggests|shows|indicates)\b`,
    "'evidence suggests' -> name the evidence (log, number, quote)",
  ),
  p(
    "auth-research-shows",
    F.AUTHORITY_NOUN,
    L,
    String.raw`\b(?:research|studies) (?:shows?|suggests?|indicates?)\b|\bthe data (?:shows|tells|suggests)\b|\bsources (?:say|indicate|suggest)\b`,
    "'research shows' -> which study, which number",
  ),
  p("meta-guardrails", F.METAPHOR_NOUN, M, String.raw`\bguardrails?\b`, "'guardrails' -> the actual check or rule"),
  p(
    "meta-lens",
    F.METAPHOR_NOUN,
    M,
    String.raw`\bthrough the lens of\b|\blens of\b`,
    "'through the lens of' -> 'from the point of view of' or just say the view",
  ),
  p(
    "meta-catalog",
    F.METAPHOR_NOUN,
    L,
    String.raw`\btapestry\b|\bcornerstone\b|\bat its core\b|\bin the realm of\b|\bbeacon\b|\bnorth star\b|\bparadigm shift\b`,
    "structure/landscape metaphor -> the concrete thing",
  ),
  p("pers-stands-as", F.PERSONIFY, L, String.raw`\bstands as\b`, "'stands as' -> 'is'"),
  p(
    "pers-catalog",
    F.PERSONIFY,
    L,
    String.raw`\b(?:raises|begs) the question\b|\binvites us to\b|\btells a story\b|\b(?:marks|represents) a shift\b|\bsetting the stage for\b|\bunderscores the importance\b|\breflects a broader\b`,
    "abstraction acting as a person -> who did what",
  ),
  p(
    "guide-breakdown",
    F.META_GUIDE,
    M,
    String.raw`\bdetailed breakdown\b|\bbreakdown (?:of|below|by)\b`,
    "'here is a breakdown' -> start with the first item",
  ),
  p(
    "guide-catalog",
    F.META_GUIDE,
    L,
    String.raw`\blet['’]s (?:dive in|dive into|break it down|break this down|explore)\b|\bit['’]s (?:important|worth) (?:to note|noting)\b|\bit is (?:important|worth) (?:to note|noting)\b`,
    "reader guidance -> delete; say the content",
  ),
  p("take-bottom-line", F.TAKEAWAY, H, String.raw`\bbottom line\b`, "'the bottom line' -> the sentence itself"),
  p("take-net", F.TAKEAWAY, M, String.raw`(?mi)^\s*net(?:-net)?:`, "'Net:' label -> a sentence", { raw: true }),
  p("take-tldr", F.TAKEAWAY, M, String.raw`\bTL;?DR\b`, "TL;DR -> let the text carry the conclusion"),
  p(
    "take-this-is-why",
    F.TAKEAWAY,
    M,
    String.raw`\b(?:this|that) is (?:exactly |precisely |part of )?why\b|\bwhich is why\b`,
    "'this is why X' reason-closer -> state the consequence forward ('so X'); never plant one while editing",
  ),
  p(
    "take-what-matters",
    F.TAKEAWAY,
    L,
    String.raw`\bwhat (?:matters|counts|is needed|is important) (?:here )?(?:is|was)\b`,
    "'what matters is X' cleft -> 'X matters' / the sentence itself",
  ),
  p(
    "take-catalog",
    F.TAKEAWAY,
    L,
    String.raw`\bin (?:conclusion|summary)\b|\bsimply put\b|\bat the end of the day\b|\bkey takeaways?\b`,
    "summary label -> delete",
  ),
  p("offer-say-the-word", F.CLOSING_OFFER, H, String.raw`\bsay the word\b`, "closing offer -> delete", { tailOnly: true }),
  p("offer-want-me-to", F.CLOSING_OFFER, H, String.raw`\bwant me to\b`, "'want me to ...?' -> delete", { tailOnly: true }),
  p("offer-if-you-want", F.CLOSING_OFFER, H, String.raw`\bif you (?:want|like|prefer),? I can\b`, "'if you want, I can' -> delete", {
    tailOnly: true,
  }),
  p(
    "offer-catalog",
    F.CLOSING_OFFER,
    L,
    String.raw`\blet me know if\b|\bhope this helps\b|\bstay tuned\b|\bdon['’]t hesitate to\b`,
    "closing offer -> delete",
    { tailOnly: true },
  ),
  p(
    "hedge-remain",
    F.HEDGE_TAIL,
    L,
    String.raw`\b(?:challenges|limitations|questions|caveats|open questions|gaps) (?:do |still )?(?:remain|persist)\b`,
    "empty objection slot 'questions remain' -> name the question or delete",
  ),
  p(
    "neg-no-longer-but",
    F.NEG_REDEFINE,
    L,
    String.raw`\bno longer\b[^.\n]{0,40}\bbut\b`,
    "'no longer X, but Y' redefinition -> say Y; never plant one while editing",
  ),
  p(
    "hedge-catalog",
    F.HEDGE_TAIL,
    L,
    String.raw`\bit could be argued\b|\bremains to be seen\b|\bonly time will tell\b`,
    "hedge -> commit or delete",
  ),
  p("stock-such-as", F.STOCK_PHRASE, L, String.raw`\bsuch as\b`, "'such as' list tail -> name the one example that matters"),
  p("stock-going-forward", F.STOCK_PHRASE, L, String.raw`\bgoing forward\b`, "'going forward' -> 'from now on' or delete"),
  p("stock-at-scale", F.STOCK_PHRASE, L, String.raw`\bat scale\b`, "'at scale' -> the number"),
  p("stock-under-the-hood", F.STOCK_PHRASE, L, String.raw`\bunder the hood\b`, "'under the hood' -> 'inside' / name the component"),
  p(
    "stock-catalog",
    F.STOCK_PHRASE,
    L,
    String.raw`\bplays? a (?:crucial|pivotal|key|vital|critical) role\b|\bin today['’]s (?:fast-paced|digital|modern)\b|\bever-evolving\b|\ba wide array of\b`,
    "stock phrase -> the specific claim",
  ),
  p("ban-surface-verb", F.BANNED_WORD, H, String.raw`\bsurfac(?:es|ed|ing)\b`, "'surface' as a verb -> show / report / found"),
  p("ban-nuanced", F.BANNED_WORD, H, String.raw`\bnuance[ds]?\b`, "'nuanced' -> say what the difference is"),
  p(
    "ban-key-adj",
    F.BANNED_WORD,
    H,
    String.raw`\bkey (?:point|part|insight|difference|question|risk|change|issue|finding|factor|reason)s?\b`,
    "'key insight' -> the insight",
  ),
  p(
    "ban-highlight-verb",
    F.BANNED_WORD,
    M,
    String.raw`\bhighlight(?:s|ed|ing) (?:the|a|an|how|that|why|its|this|these)\b`,
    "'highlights the' -> shows / is",
  ),
  p("ban-unlock", F.BANNED_WORD, M, String.raw`\bunlock(?:s|ed|ing)?\b`, "'unlock' -> enable / allow"),
  p("ban-holistic", F.BANNED_WORD, M, String.raw`\bholistic(?:ally)?\b`, "'holistic' -> whole / all of"),
  p("ban-navigate", F.BANNED_WORD, M, String.raw`\bnavigat(?:e|es|ed|ing)\b`, "'navigate the complexity' -> deal with / handle"),
  p("ban-comprehensive", F.BANNED_WORD, M, String.raw`\bcomprehensive(?:ly)?\b`, "'comprehensive' -> complete / full, or the count"),
  p("ban-robust", F.BANNED_WORD, M, String.raw`\brobust\b`, "'robust' -> what it survives"),
  p("ban-align-with", F.BANNED_WORD, M, String.raw`\balign(?:s|ed|ing)? with\b`, "'aligns with' -> matches / agrees with"),
  p("ban-underscore", F.BANNED_WORD, L, String.raw`\bunderscor(?:e|es|ed|ing)\b`, "'underscores' -> shows"),
  p("ban-deep-dive", F.BANNED_WORD, L, String.raw`\bdeep[- ]div(?:e|es|ing)\b`, "'deep dive' -> look at / read"),
  p("ban-showcase", F.BANNED_WORD, L, String.raw`\bshowcas(?:e|es|ed|ing)\b`, "'showcase' -> show"),
  p("ban-interplay", F.BANNED_WORD, L, String.raw`\binterplay\b`, "'interplay' -> how X affects Y"),
  p("ban-utilize", F.BANNED_WORD, L, String.raw`\butiliz(?:e|es|ed|ing|ation)\b`, "'utilize' -> use"),
  p(
    "ban-catalog",
    F.BANNED_WORD,
    L,
    String.raw`\bdelv(?:e|es|ed|ing)\b|\bmultifaceted\b|\bgroundbreaking\b|\bunparalleled\b|\bgame-?changer\b|\bempower(?:s|ed|ing)?\b|\bembark(?:s|ed|ing)?\b|\bvibrant\b|\bplethora\b|\bmyriad\b|\bgarner(?:s|ed|ing)?\b|\bbolster(?:s|ed|ing)?\b|\bpivotal\b|\bseamless(?:ly)?\b|\bintricate\b|\bintricacies\b|\bsynergy\b|\bharness(?:es|ed|ing)? the\b`,
    "AI vocabulary -> the plain word",
  ),
  p(
    "tic-let-me-check",
    F.MODEL_TIC,
    H,
    String.raw`\blet me (?:check|look|verify|see)\b`,
    "agent narration 'let me check' -> delete; report the result",
  ),
  p("tic-let-me", F.MODEL_TIC, M, String.raw`\blet me\b`, "'let me <verb>' -> delete the announce"),
  p(
    "tic-ill-verb",
    F.MODEL_TIC,
    L,
    String.raw`\bI['’]ll\b`,
    "'I'll <verb>' next-step announce -> delete in reports; fine in personal prose",
  ),
  p("tic-so-ill", F.MODEL_TIC, M, String.raw`\b(?:so|and|then) I['’]ll\b`, "'so I'll' step chaining -> delete"),
  p("tic-now-im", F.MODEL_TIC, H, String.raw`\bnow I['’]m\b`, "'now I'm <verb>ing' progress narration -> delete"),
  p("tic-i-did-not", F.MODEL_TIC, L, String.raw`\bI did not\b`, "'I did not <verb>' (GPT) -> 'I didn't' or state what happened"),
  p("tic-if-needed", F.MODEL_TIC, M, String.raw`\bif needed\b`, "'if needed' tail -> delete or say when"),
  p("tic-per-the", F.MODEL_TIC, M, String.raw`\bper the\b`, "'per the <doc>' -> 'as the <doc> says' or cite"),
  p("tic-before-any", F.MODEL_TIC, L, String.raw`\bbefore any\b`, "'before any <noun>' -> name the step"),
  p("tic-one-last", F.MODEL_TIC, L, String.raw`\bone last\b`, "'one last thing' -> just say it"),
  p("tic-it-does-not", F.MODEL_TIC, L, String.raw`\bit does not\b`, "'it does not' -> 'it doesn't' or the positive fact"),
  p("tic-actually-let-me", F.MODEL_TIC, H, String.raw`\bactually,? let me\b`, "'actually, let me' self-correction -> delete"),
  p("tic-no-regressions", F.MODEL_TIC, M, String.raw`\bno regressions?\b`, "'no regressions' -> what was run and what passed"),
  p(
    "tic-green-tests",
    F.MODEL_TIC,
    M,
    String.raw`\b(?:tests?|ci|suite|build|checks?|pipeline|lint|typecheck) (?:is|are|went|go|goes|stays?|remains?|came back|now) (?:all )?green\b|\b(?:all|everything|stays) green\b|\bgreen (?:locally|in ci|across)\b`,
    "'tests are green' -> the command and its result",
  ),
  p("tic-verified", F.MODEL_TIC, M, String.raw`\b(?:verified|confirmed)\b`, "'verified/confirmed' -> what was run and what it printed"),
  p("tic-root-cause", F.MODEL_TIC, M, String.raw`\broot cause\b`, "'root cause' -> the cause"),
  p("tic-so-i-can", F.MODEL_TIC, L, String.raw`\bso (?:I|we) can\b`, "'so I can' purpose tail -> delete"),
  p("tic-first-then", F.MODEL_TIC, M, String.raw`\bfirst,? then\b`, "'X first, then Y' -> two sentences"),
  p(
    "tic-harness-scaffold",
    F.MODEL_TIC,
    M,
    String.raw`^[A-Z]{4,}(?: [A-Z]{4,})? MODE (?:ON|ENABLED|ACTIVATED)\b|^(?:WORKING|BLOCKED|STATUS):`,
    "leaked agent scaffolding -> delete",
  ),
  p("typo-bold", F.TYPOGRAPHY, L, String.raw`\*\*[^*\n]+\*\*`, "bold span -> plain text", { raw: true }),
  p(
    "typo-emoji-label",
    F.TYPOGRAPHY,
    M,
    EMOJI_LABEL,
    "emoji before a line, bullet or bold label (✅ **Done:**) -> delete (agent prose 25 per million words, PG 0)",
    { raw: true },
  ),
  p("typo-arrow-chain", F.TYPOGRAPHY, M, String.raw`(?:→|->)[^\n]*(?:→|->)`, "arrow chain -> a sentence", { raw: true }),
  p(
    "tic-verdict-stamp",
    F.MODEL_TIC,
    M,
    String.raw`\b(?:VERDICT|REQUEST[ _-]?CHANGES|CONFIRMED|REJECTED|SUSTAINED|BLOCKER|UNVERIFIED|PASS|FAIL)\b(?=[:\s.,)]|$)`,
    "uppercase verdict stamp -> a sentence",
    { caseSensitive: true },
  ),
  p(
    "typo-bold-label-bullet",
    F.TYPOGRAPHY,
    M,
    String.raw`^\s*(?:[-*]|\d+\.)\s+\*\*[^*\n]{2,70}\*\*\s*[—:–-]|^\s*(?:[-*]|\d+\.)\s+\*\*[^*\n]{2,70}:\*\*`,
    "bold-label bullet parade -> prose, one case in full and the rest in a sentence",
    { raw: true },
  ),
  p(
    "guide-scope-preamble",
    F.META_GUIDE,
    M,
    String.raw`^(?:#{1,4}\s+|\*\*)?(?:As-of date|Date|Status|Scope|Methodology|Method|Evidence base|Evidence|Sources?|Verified|Mode|Target|Position|Reviewed|Repos inspected)(?:\*\*)?:`,
    "scope/method preamble label -> start with the finding",
    { raw: true, caseSensitive: true },
  ),
  p(
    "guide-status-opener",
    F.META_GUIDE,
    M,
    String.raw`\b(?:All evidence (?:is in|gathered)|Report follows|Confirmed definitively)\b`,
    "status-framing opener -> delete",
  ),
  p(
    "guide-plan-announcement",
    F.META_GUIDE,
    M,
    String.raw`\A\s*\W{0,3}(?:Here(?:'s| is) (?:my|the) plan|My plan(?: is)?)\b`,
    "plan-announcement opener -> start with the content",
  ),
  p(
    "tic-honest-limits",
    F.MODEL_TIC,
    M,
    String.raw`^(?:#{1,4}\s+|\*\*)(?:What I (?:could not|couldn['’]t|did not|didn['’]t) verify|Limitations?|Caveats?|Remaining risks?|Open questions?|Unverified)\b|^(?:Limitations?|Caveats?|Remaining risks?|Open questions?|Unverified):|\[unverified\]`,
    "honest-limits self-label -> state the specific unknown in the text",
    { raw: true, caseSensitive: true },
  ),
  p(
    "pers-evidence-says",
    F.PERSONIFY,
    M,
    String.raw`\b(?:the )?(?:logs?|capture|results?|tests?|metrics?|profile|trace|numbers)\s+(?:shows?|says?|tells?|proves?|confirms?|suggests?|reveals?)\b`,
    "'the logs show' -> what the log line was",
  ),
  p(
    "take-recap-heading",
    F.TAKEAWAY,
    M,
    String.raw`^(?:#{1,4}\s+|\*\*)(?:Two-sentence summary|In summary|To summarize|Summary|Net-net|Takeaways?)\b|^(?:Summary|Takeaways?|Net-net):`,
    "recap heading -> delete; the text carries the conclusion",
    { raw: true, caseSensitive: true },
  ),
  p(
    "guide-worth-noting",
    F.META_GUIDE,
    H,
    String.raw`\bworth (?:noting|mentioning|calling out|flagging)\b`,
    "'worth noting' -> delete; state the thing",
  ),
  p("guide-note-that", F.META_GUIDE, M, String.raw`\bnote that\b`, "'note that' -> delete the frame"),
  p("guide-crucially", F.META_GUIDE, M, String.raw`\bcrucially\b`, "'crucially' -> delete; say why it matters"),
  p("guide-notably", F.META_GUIDE, M, String.raw`\bnotably\b`, "'notably' -> delete or name the exception"),
  p("ban-actionable", F.BANNED_WORD, M, String.raw`\bactionable\b`, "'actionable' -> what to do"),
  p("ban-workflow", F.BANNED_WORD, L, String.raw`\bworkflows?\b`, "'workflow' -> the steps, or the tool's name"),
  p("ban-framework", F.BANNED_WORD, L, String.raw`\bframeworks?\b`, "'framework' -> name it, or 'approach'"),
  p("ban-edge-case", F.BANNED_WORD, L, String.raw`\bedge cases?\b`, "'edge case' -> the case"),
  p("tic-as-expected", F.MODEL_TIC, M, String.raw`\bas expected\b`, "'as expected' -> what was expected and what happened"),
  p("tic-as-requested", F.MODEL_TIC, M, String.raw`\bas requested\b`, "'as requested' -> delete"),
  p(
    "tic-sanity-check",
    F.MODEL_TIC,
    M,
    String.raw`\bsanity[- ]check(?:s|ed|ing)?\b|\bdouble[- ]check(?:s|ed|ing)?\b`,
    "'sanity/double check' -> what was checked",
  ),
  p(
    "tic-clean",
    F.MODEL_TIC,
    L,
    String.raw`\b(?:is|are|stays?|came back|comes back|now|all|tree|diff|build|lint|run) clean\b|\bclean (?:run|pass|diff|tree|build|checkout|state)\b`,
    "'lint is clean' -> the command and its output",
  ),
  p("tic-genuinely", F.MODEL_TIC, M, String.raw`\bgenuinely\b`, "'genuinely' -> delete"),
  p("tic-exactly", F.MODEL_TIC, L, String.raw`\bexactly\b`, "'exactly' intensifier -> delete"),
  p(
    "tic-i-want-to-be",
    F.MODEL_TIC,
    L,
    String.raw`\bI want to be (?:direct|honest|clear|upfront|precise|careful)\b`,
    "'I want to be direct' -> just be it",
  ),
  // Blog/retrospective tells: recommendation hedges, confession tics, restatement tics, owner POV in
  // reports. "I think" stays out on purpose: PG uses it 100x more than models.
  p(
    "hedge-recommend",
    F.HEDGE_TAIL,
    M,
    String.raw`\bit(?:'s| is) (?:better|best|wiser|safer|cleaner) to\b|\bthe (?:better|safer|cleaner|smarter) (?:option|path|bet|move) is\b|\bwould be (?:better|wiser) to\b`,
    "recommendation hedge -> say what to do",
  ),
  p(
    "stock-confess",
    F.STOCK_PHRASE,
    M,
    String.raw`\bto be (?:honest|frank|candid)\b|\bfull disclosure\b|\b(?:a|my) confession\b|\bfloor value\b`,
    "confession tic -> state the fact and the method",
  ),
  p(
    "stock-restate",
    F.STOCK_PHRASE,
    L,
    String.raw`\bthe real (?:cost|problem|question|issue|work) (?:is|was)\b|\bat the end of the day\b|\bthe point is\b|\bthe truth is\b`,
    "restatement tic -> content sentence",
  ),
  p(
    "pov-owner",
    F.MODEL_TIC,
    L,
    String.raw`\bmy (?:regression|bug|mistake|fix|PR|change)\b|\bI recommend\b`,
    "report/retrospective narrator is an observer -> 'the agent's', 'the session's'",
  ),
  p(
    "ana-vehicle-stock",
    F.FORCED_ANALOGY,
    M,
    String.raw`\b(?:flywheel|safety net|seat ?belts?|rabbit hole|treadmill)s?\b`,
    "stock metaphor vehicle -> the concrete mechanism (what turns, what catches, what repeats)",
  ),
  p(
    "ana-vehicle-catalog",
    F.FORCED_ANALOGY,
    L,
    String.raw`\b(?:hamster wheel|connective tissue|linchpin|lifeblood|secret sauce|swiss army knife|training wheels|tip of the iceberg)\b`,
    "catalog metaphor vehicle -> the concrete thing",
  ),
  p("ana-plumbing", F.FORCED_ANALOGY, L, String.raw`\bplumbing\b`, "'plumbing' for infrastructure -> name the component"),
  p(
    "ana-vehicle-copula",
    F.FORCED_ANALOGY,
    L,
    VEHICLE_COPULA,
    "'X is the compass' object equation -> what X does; people make this move too, so judge by density",
  ),
];
