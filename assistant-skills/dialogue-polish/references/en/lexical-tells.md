# English lexical AI tells (evidence-backed catalog)

Corpus (corpus A, phrase mining, of the linter's calibration run): assistant-authored English prose from local coding-agent sessions, per-message model attribution, code/tool payloads stripped. AI = 8,244,856 words (Claude 1,942,538, GPT 5,429,182, Kimi 595,237, GLM 277,899; 94,904 messages). Human baseline = 231 Paul Graham essays, 561,539 words, fetched to /tmp for statistics only (no essay text is stored here). Rates are per million words; the parenthesis after the AI rate is Claude/GPT/Kimi/GLM; lift = AI/PG (smoothed). Public catalog: [Wikipedia: Signs of AI writing](https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing).

**What the corpus is and is not.** These are coding-agent messages written under strong system prompts (no filler, no summaries, evidence-first). The famous chatbot/blog tells (delve, tapestry, 'in conclusion', 'let's dive in', 'it's important to note') are near zero here, and Paul Graham uses several textbook 'AI phrases' more than the models do. So this catalog is what our agents actually do; the public-catalog entries are kept only where Graham never uses them, at low severity, and everything Graham uses at or above the model rate is excluded (table at the end).

**Severity rule.** lift >= 5 with n >= 30 -> high; lift >= 2 -> mid; else low. Public-catalog entries with 0 local hits and 0 in PG -> low. Demotions from the rule are listed per row with the reason. Shipped regexes that are a sense-scoped subset of the measured regex say so (their true lift is at least as favourable on precision, not measured separately).

**Sample B (discourse) evidence.** Seven patterns marked source B come from sample B's detector pass over 32 long-form AI samples (>= 800 words: claude 7, gpt 6, kimi 7, glm 6, agent-written docs 6; 51,316 words) vs 15 Paul Graham essays (38,277 words). Each had 0 hits in the PG essays; counts are hits / samples-with-hit. Details: `discourse-tells.md`.

## 1. Negated redefinition (`neg-redefine`)

| pid | severity | shipped regex | evidence (AI /1M (C/G/K/GLM) vs PG /1M, lift, n) | source | note |
|---|---|---|---|---|---|
| `neg-rather-than` | mid | `\brather than\b` | `rather than` 1520.5 (2717/1284/385/212) vs PG 268.9, lift 5.64, n=12536 | D | demoted high->mid: grammatical connective, Claude 2717/1M; density is the tell |

## 2. Authority nouns (`authority-noun`)

| pid | severity | shipped regex | evidence (AI /1M (C/G/K/GLM) vs PG /1M, lift, n) | source | note |
|---|---|---|---|---|---|
| `auth-evidence-suggests` | mid | `\bevidence (?:suggests\|shows\|indicates)\b` | `evidence suggests` 33.7 (4/49/8/4) vs PG 8.9, lift 3.44, n=278 | D |  |
| `auth-research-shows` | low | `\b(?:research\|studies) (?:shows?\|suggests?\|indicates?)\b\|\bthe data (?:shows\|tells\|suggests)\b\|\bsources (?:say\|indicate\|suggest)\b` | `research shows` 0.0 (0/0/0/0) vs PG 0.0, lift 0.00, n=0; `studies show` 0.0 (0/0/0/0) vs PG 0.0, lift 0.00, n=0; `the data shows / tells` 0.5 (2/0/0/0) vs PG 0.0, lift 0.54, n=4; `sources indicate/suggest` 0.1 (0/0/2/0) vs PG 0.0, lift 0.14, n=1 | W | 0 hits in both corpora; public catalog, PG 0 |

## 3. Metaphor nouns (`metaphor-noun`)

| pid | severity | shipped regex | evidence (AI /1M (C/G/K/GLM) vs PG /1M, lift, n) | source | note |
|---|---|---|---|---|---|
| `meta-guardrails` | mid | `\bguardrails?\b` | `guardrails` 76.7 (45/97/15/40) vs PG 0.0, lift 86.09, n=632 | D | demoted high->mid: engineering term with a literal use |
| `meta-lens` | mid | `\bthrough the lens of\b\|\blens of\b` | `through the lens / lens of` 20.9 (7/29/5/4) vs PG 1.8, lift 7.81, n=172 | D | shipped regex is a sense-scoped subset of measured \blens\b |
| `meta-catalog` | low | `\btapestry\b\|\bcornerstone\b\|\bat its core\b\|\bin the realm of\b\|\bbeacon\b\|\bnorth star\b\|\bparadigm shift\b` | `tapestry` 0.0 (0/0/0/0) vs PG 0.0, lift 0.00, n=0; `cornerstone` 0.0 (0/0/0/0) vs PG 0.0, lift 0.00, n=0; `at its core` 0.0 (0/0/0/0) vs PG 0.0, lift 0.00, n=0; `north star` 0.1 (0/0/0/0) vs PG 0.0, lift 0.14, n=1; `in the realm of` 0.0 (0/0/0/0) vs PG 0.0, lift 0.00, n=0 | W | public catalog; 0-1 hits locally, PG 0 |

## 3b. Forced analogy (`forced-analogy`)

Measured in English on a fresh corpus (text kept in a local scratch directory, not shipped; stats here): 114,578 assistant messages from two local session stores (10,133,143 words, same filters as section 1) plus 1,240 long-form English .md documents from local research bundles and reports (1,969,761 words), against 220 Paul Graham essays (573,233 words).

The analogy *frame* is a human move in English and does not ship:

| frame | AI /1M (chat / long-form) | PG /1M | verdict |
|---|---|---|---|
| `think of it as` | 1.0 / 1.0 | 48.8 | human |
| `treat/see/imagine it as a` | 29.4 / 2.0 | 24.4 | equal |
| `is essentially/basically a` | 2.1 / 3.6 | 15.7 | human |
| `it's like having a` / `this is like` | 0.0 / 0.0 | 24.4 | human |
| `by X I mean` / `I use the word X to mean` | 0.0 / 0.0 | 14.0 | human |
| `much like a` / `just as a` / `by analogy` | 1.4 / 8.6 | 31.4 | human |
| `is the <vehicle>` with the shipped vehicle list | 6.0 (73) | 3.5 (2: "curiosity is the compass", "equity is the fuel") | lift 1.73, low only |

What separates the model is the vehicle noun. Per-vehicle counts (AI chat+long n / PG n): flywheel 35/0, safety net 59/0, seatbelt 36/0, rabbit hole 13/0, treadmill 17/0, plumbing 582/2 (48.1 vs 3.5 per 1M, lift 13.8; engineering jargon, so low), north star 3/0 (already `meta-catalog`). Excluded as literal in agent prose despite high lift: anchor (HTML), window, key, map, dashboard, heartbeat (protocol), scaffold (code), mirror (repo), lighthouse (the tool), bridge, circuit breaker, bedrock (AWS), torch (PyTorch), greenhouse and catalyst (product names). PG-leaning vehicles, never to ship: compass 1/12, chess 2/5, lego 1/5, immune system 0/3, double-edged sword 0/3, rudder 0/3, thermostat 0/2, duct tape 0/1, iceberg 0/1, glue 75/4 (lift 0.89), backbone 58/4 (0.69), muscle memory 4/1.

| pid | severity | shipped regex | evidence | note |
|---|---|---|---|---|
| `ana-vehicle-stock` | mid | `\b(?:flywheel\|safety net\|seat ?belts?\|rabbit hole\|treadmill)s?\b` | 160 AI hits, PG 0 | PG 0 with n >= 30 would be high; demoted to mid because `safety net` and `treadmill` have literal uses |
| `ana-vehicle-catalog` | low | `hamster wheel\|connective tissue\|linchpin\|lifeblood\|secret sauce\|swiss army knife\|training wheels\|tip of the iceberg` | 0-1 local hits, PG 0 | public catalog (Wikipedia: Signs of AI writing), ships low on catalog authority |
| `ana-plumbing` | low | `\bplumbing\b` | 48.1 vs 3.5 per 1M, lift 13.8, n=582 | jargon for infrastructure code; low because engineers use it literally |
| `ana-vehicle-copula` | low | `is/are/acts as/serves as/think of it as` + article + optional adjective + vehicle from `ANALOGY_VEHICLES` | 6.0 vs 3.5 per 1M, lift 1.73 | PG makes the move; judge by density, never fix a single instance |

Metric `metaphor_callback_max` (threshold 2, **advisory only** in English): the vehicle that recurs most in the piece. PG's per-essay maximum has p50 0, p90 3, p95 5, max 24, because an essay literally about ladders or seed funding repeats the word (ladder.html 9, startupfunding.html 24); AI long-form documents have the same distribution (p90 3, p95 5, max 37). So in English the count prints as a `!?` notice and never scores. The Korean metric scores (human max 1).

## 4. Personification (`personify`)

| pid | severity | shipped regex | evidence (AI /1M (C/G/K/GLM) vs PG /1M, lift, n) | source | note |
|---|---|---|---|---|---|
| `pers-stands-as` | low | `\bstands as\b` | `stands as` 2.9 (10/0/5/0) vs PG 0.0, lift 3.27, n=24 | D | n=24 below the 30 floor; PG 0 |
| `pers-catalog` | low | `\b(?:raises\|begs) the question\b\|\binvites us to\b\|\btells a story\b\|\b(?:marks\|represents) a shift\b\|\bsetting the stage for\b\|\bunderscores the importance\b\|\breflects a broader\b` | `raises the question` 0.4 (2/0/0/0) vs PG 0.0, lift 0.41, n=3; `begs the question` 0.0 (0/0/0/0) vs PG 0.0, lift 0.00, n=0; `invites us to` 0.0 (0/0/0/0) vs PG 0.0, lift 0.00, n=0; `tells a story` 0.2 (0/0/0/0) vs PG 0.0, lift 0.27, n=2; `represents/marks a shift` 0.0 (0/0/0/0) vs PG 0.0, lift 0.00, n=0; `setting the stage for` 0.0 (0/0/0/0) vs PG 0.0, lift 0.00, n=0; `underscores/highlights its importance` 0.0 (0/0/0/0) vs PG 0.0, lift 0.00, n=0; `reflects broader` 0.0 (0/0/0/0) vs PG 0.0, lift 0.00, n=0 | W | public catalog; <=3 hits locally, PG 0 |
| `pers-evidence-says` | mid | `\b(?:the )?(?:logs?\|capture\|results?\|tests?\|metrics?\|profile\|trace\|numbers)\s+(?:shows?\|says?\|tells?\|proves?\|confirms?\|suggests?\|reveals?)\b` | (see note) | B | sample B: 10 hits in 4/32 AI; `evidence`/`data` subjects removed here because auth-evidence-suggests / auth-research-shows already score them (no double count); shipped regex on 231 PG essays: 1 hit(s) in 1 essay(s) |

## 5. Meta guidance (`meta-guide`)

| pid | severity | shipped regex | evidence (AI /1M (C/G/K/GLM) vs PG /1M, lift, n) | source | note |
|---|---|---|---|---|---|
| `guide-breakdown` | mid | `\bdetailed breakdown\b\|\bbreakdown (?:of\|below\|by)\b` | `more detailed breakdown` 11.0 (14/10/17/4) vs PG 3.6, lift 2.48, n=91 | D | sense-scoped subset of measured \bbreakdown\b |
| `guide-catalog` | low | `\blet['’]s (?:dive in\|dive into\|break it down\|break this down\|explore)\b\|\bit['’]s (?:important\|worth) (?:to note\|noting)\b\|\bit is (?:important\|worth) (?:to note\|noting)\b` | `let's dive in` 0.0 (0/0/0/0) vs PG 0.0, lift 0.00, n=0; `let's break it down` 0.0 (0/0/0/0) vs PG 0.0, lift 0.00, n=0; `it's important to note` 0.0 (0/0/0/0) vs PG 0.0, lift 0.00, n=0; `it's worth noting` 0.2 (1/0/2/0) vs PG 0.0, lift 0.27, n=2 | W | public catalog; <=2 hits locally, PG 0 |
| `guide-scope-preamble` | mid (raw, case) | `^(?:#{1,4}\s+\|\*\*)?(?:As-of date\|Date\|Status\|Scope\|Methodology\|Method\|Evidence base\|Evidence\|Sources?\|Verified\|Mode\|Target\|Position\|Reviewed\|Repos inspected)(?:\*\*)?:` | (see note) | B | sample B: 11 hits in 7/32 AI; case-sensitive label with a mandatory trailing colon (the case-insensitive form had hit 19 times, mostly quoted `date:` lines in one essay); shipped regex on 231 PG essays: 1 hit(s) in 1 essay(s) |
| `guide-status-opener` | mid | `\b(?:All evidence (?:is in\|gathered)\|Report follows\|Confirmed definitively)\b` | (see note) | B | sample B: 8/32 AI, 0 in PG; shipped regex on 231 PG essays: 0 hit(s) in 0 essay(s) |
| `guide-plan-announcement` | mid | `\A\s*\W{0,3}(?:Here(?:'s\| is) (?:my\|the) plan\|My plan(?: is)?)\b` | (see note) | B | plan-announcement opener (discourse-tells §1d), 0 in PG |
| `guide-worth-noting` | high | `\bworth (?:noting\|mentioning\|calling out\|flagging)\b` | `worth-noting` 52.8 (188/9/29/7) vs PG 0.0, lift 106.58, n=456 (second measurement pass) | D2 | Claude 188/1M |
| `guide-note-that` | mid | `\bnote that\b` | `note-that` 24.2 (28/22/41/7) vs PG 3.5, lift 6.25, n=209 (second measurement pass) | D2 |  |
| `guide-crucially` | mid | `\bcrucially\b` | `crucially` 5.3 (11/1/25/14) vs PG 0.0, lift 11.65, n=46 (second measurement pass) | D2 | n=46 |
| `guide-notably` | mid | `\bnotably\b` | `notably` 17.9 (57/5/5/24) vs PG 3.5, lift 4.67, n=155 (second measurement pass) | D2 | Claude 57/1M; PG 3.5 |

## 6. Takeaway labels (`takeaway`)

| pid | severity | shipped regex | evidence (AI /1M (C/G/K/GLM) vs PG /1M, lift, n) | source | note |
|---|---|---|---|---|---|
| `take-bottom-line` | high | `\bbottom line\b` | `the bottom line` 25.0 (2/37/5/4) vs PG 1.8, lift 9.35, n=206 | D | GPT 37/1M |
| `take-net` | mid (raw) | `(?mi)^\s*net(?:-net)?:` | `net / net-net (label)` 9.7 (12/10/0/0) vs PG 0.0, lift 10.90, n=80 | D |  |
| `take-tldr` | mid | `\bTL;?DR\b` | `TL;DR` 4.6 (11/2/10/0) vs PG 0.0, lift 5.18, n=38 | D | n=38 |
| `take-catalog` | low | `\bin (?:conclusion\|summary)\b\|\bsimply put\b\|\bat the end of the day\b\|\bkey takeaways?\b` | `in summary` 1.1 (1/1/0/0) vs PG 0.0, lift 1.23, n=9; `in conclusion` 0.0 (0/0/0/0) vs PG 0.0, lift 0.00, n=0; `simply put` 0.0 (0/0/0/0) vs PG 0.0, lift 0.00, n=0; `at the end of the day` 0.0 (0/0/0/0) vs PG 0.0, lift 0.00, n=0; `key takeaway` 0.7 (0/1/2/0) vs PG 0.0, lift 0.82, n=6 | W | public catalog; <=9 hits locally, PG 0 |
| `take-recap-heading` | mid (raw, case) | `^(?:#{1,4}\s+\|\*\*)(?:Two-sentence summary\|In summary\|To summarize\|Summary\|Net-net\|Takeaways?)\b\|^(?:Summary\|Takeaways?\|Net-net):` | (see note) | B | sample B: 4/32 AI, 0 in PG; case-sensitive heading/label shape; 'In short' dropped (PG-heavy, lift 1.09); shipped regex on 231 PG essays: 0 hit(s) in 0 essay(s) |

## 7. Closing offers (`closing-offer`, tail-only)

| pid | severity | shipped regex | evidence (AI /1M (C/G/K/GLM) vs PG /1M, lift, n) | source | note |
|---|---|---|---|---|---|
| `offer-say-the-word` | high (tail_only) | `\bsay the word\b` | `say the word` 19.6 (59/0/69/25) vs PG 0.0, lift 22.07, n=162 | D |  |
| `offer-want-me-to` | high (tail_only) | `\bwant me to\b` | `want me to` 43.9 (77/18/181/22) vs PG 1.8, lift 16.44, n=362 | D |  |
| `offer-if-you-want` | high (tail_only) | `\bif you (?:want\|like\|prefer),? I can\b` | `if you'd like` 0.2 (0/0/0/0) vs PG 1.8, lift 0.09, n=2 | D | n-gram 'if you want i can' 61/1M n=503, PG 0 |
| `offer-catalog` | low (tail_only) | `\blet me know if\b\|\bhope this helps\b\|\bstay tuned\b\|\bdon['’]t hesitate to\b` | `let me know if` 0.7 (1/1/0/4) vs PG 0.0, lift 0.82, n=6; `hope this helps` 0.0 (0/0/0/0) vs PG 0.0, lift 0.00, n=0; `stay tuned` 0.0 (0/0/0/0) vs PG 0.0, lift 0.00, n=0 | W | public catalog; <=6 hits locally, PG 0 (note: 'happy to help' is PG-heavy and excluded) |

## 8. Hedges (`hedge-tail`)

| pid | severity | shipped regex | evidence (AI /1M (C/G/K/GLM) vs PG /1M, lift, n) | source | note |
|---|---|---|---|---|---|
| `hedge-catalog` | low | `\bit could be argued\b\|\bremains to be seen\b\|\bonly time will tell\b` | `it could be argued` 0.1 (0/0/0/0) vs PG 0.0, lift 0.14, n=1; `remains to be seen` 0.0 (0/0/0/0) vs PG 0.0, lift 0.00, n=0; `only time will tell` 0.0 (0/0/0/0) vs PG 0.0, lift 0.00, n=0 | W | public catalog; 'arguably', 'to some extent', 'in many ways' are PG-heavy and excluded |

## 9. Stock phrases (`stock-phrase`)

| pid | severity | shipped regex | evidence (AI /1M (C/G/K/GLM) vs PG /1M, lift, n) | source | note |
|---|---|---|---|---|---|
| `stock-such-as` | low | `\bsuch as\b` | `such as (list tail)` 52.1 (1/79/2/0) vs PG 1.8, lift 19.52, n=430 | D | PG 0 despite being ordinary English; low because it is grammatical |
| `stock-going-forward` | low | `\bgoing forward\b` | `going forward` 2.2 (4/1/5/0) vs PG 0.0, lift 2.45, n=18 | D | n=18 below floor; PG 0 |
| `stock-at-scale` | low | `\bat scale\b` | `at scale` 1.9 (4/0/12/4) vs PG 0.0, lift 2.18, n=16 | D | n=16 below floor; PG 0 |
| `stock-under-the-hood` | low | `\bunder the hood\b` | `under the hood` 0.8 (1/1/0/4) vs PG 0.0, lift 0.95, n=7 | D | n=7; PG 0 |
| `stock-catalog` | low | `\bplays? a (?:crucial\|pivotal\|key\|vital\|critical) role\b\|\bin today['’]s (?:fast-paced\|digital\|modern)\b\|\bever-evolving\b\|\ba wide array of\b` | `plays a crucial/pivotal role` 0.0 (0/0/0/0) vs PG 0.0, lift 0.00, n=0; `in today's fast-paced world` 0.0 (0/0/0/0) vs PG 0.0, lift 0.00, n=0; `ever-evolving / evolving landscape` 0.0 (0/0/0/0) vs PG 0.0, lift 0.00, n=0 | W | public catalog; 0 hits locally |

## 10. AI vocabulary (`banned-word`)

| pid | severity | shipped regex | evidence (AI /1M (C/G/K/GLM) vs PG /1M, lift, n) | source | note |
|---|---|---|---|---|---|
| `ban-surface-verb` | high | `\bsurfac(?:es\|ed\|ing)\b` | `surface (as verb)` 522.9 (346/611/277/565) vs PG 1.8, lift 195.74, n=4311 | D |  |
| `ban-nuanced` | high | `\bnuance[ds]?\b` | `nuanced / nuance` 54.2 (23/69/40/7) vs PG 0.0, lift 60.89, n=447 | D |  |
| `ban-key-adj` | high | `\bkey (?:point\|part\|insight\|difference\|question\|risk\|change\|issue\|finding\|factor\|reason)s?\b` | `key (adjective)` 57.0 (54/48/102/151) vs PG 1.8, lift 21.34, n=470 | D |  |
| `ban-highlight-verb` | mid | `\bhighlight(?:s\|ed\|ing) (?:the\|a\|an\|how\|that\|why\|its\|this\|these)\b` | `highlight (verb)` 17.5 (3/22/29/18) vs PG 0.0, lift 19.62, n=144 | D | demoted high->mid: common verb; sense-scoped subset |
| `ban-unlock` | mid | `\bunlock(?:s\|ed\|ing)?\b` | `unlock` 27.9 (40/10/148/43) vs PG 1.8, lift 10.44, n=230 | D | Kimi 148/1M; demoted high->mid (literal uses exist) |
| `ban-holistic` | mid | `\bholistic(?:ally)?\b` | `holistic` 10.4 (0/16/2/0) vs PG 0.0, lift 11.71, n=86 | D | demoted high->mid: n=86 |
| `ban-navigate` | mid | `\bnavigat(?:e\|es\|ed\|ing)\b` | `navigate` 20.6 (13/22/39/0) vs PG 3.6, lift 4.63, n=170 | D |  |
| `ban-comprehensive` | mid | `\bcomprehensive(?:ly)?\b` | `comprehensive` 12.0 (14/6/59/14) vs PG 1.8, lift 4.50, n=99 | D |  |
| `ban-robust` | mid | `\brobust\b` | `robust` 25.7 (30/18/64/68) vs PG 7.1, lift 3.21, n=212 | D |  |
| `ban-align-with` | mid | `\balign(?:s\|ed\|ing)? with\b` | `align with` 32.0 (6/44/18/7) vs PG 8.9, lift 3.27, n=264 | D |  |
| `ban-underscore` | low | `\bunderscor(?:e\|es\|ed\|ing)\b` | `underscore` 2.8 (5/2/3/0) vs PG 0.0, lift 3.13, n=23 | D | n=23 below floor; PG 0 |
| `ban-deep-dive` | low | `\bdeep[- ]div(?:e\|es\|ing)\b` | `deep dive` 3.4 (4/2/8/11) vs PG 0.0, lift 3.81, n=28 | D | n=28 below floor; PG 0 |
| `ban-showcase` | low | `\bshowcas(?:e\|es\|ed\|ing)\b` | `showcase` 1.0 (1/1/2/0) vs PG 0.0, lift 1.09, n=8 | D | n=8; PG 0 |
| `ban-interplay` | low | `\binterplay\b` | `interplay` 0.8 (1/0/7/0) vs PG 0.0, lift 0.95, n=7 | D | n=7; PG 0 |
| `ban-utilize` | low | `\butiliz(?:e\|es\|ed\|ing\|ation)\b` | `utilize` 0.5 (1/0/2/0) vs PG 0.0, lift 0.54, n=4 | D | n=4; PG 0 |
| `ban-catalog` | low | `\bdelv(?:e\|es\|ed\|ing)\b\|\bmultifaceted\b\|\bgroundbreaking\b\|\bunparalleled\b\|\bgame-?changer\b\|\bempower(?:s\|ed\|ing)?\b\|\bembark(?:s\|ed\|ing)?\b\|\bvibrant\b\|\bplethora\b\|\bmyriad\b\|\bgarner(?:s\|ed\|ing)?\b\|\bbolster(?:s\|ed\|ing)?\b\|\bpivotal\b\|\bseamless(?:ly)?\b\|\bintricate\b\|\bintricacies\b\|\bsynergy\b\|\bharness(?:es\|ed\|ing)? the\b` | `delve` 0.0 (0/0/0/0) vs PG 0.0, lift 0.00, n=0; `multifaceted` 0.0 (0/0/0/0) vs PG 0.0, lift 0.00, n=0; `groundbreaking` 0.0 (0/0/0/0) vs PG 0.0, lift 0.00, n=0; `unparalleled` 0.0 (0/0/0/0) vs PG 0.0, lift 0.00, n=0; `game-changer` 0.0 (0/0/0/0) vs PG 0.0, lift 0.00, n=0; `empower` 0.0 (0/0/0/0) vs PG 0.0, lift 0.00, n=0; `embark` 0.0 (0/0/0/0) vs PG 0.0, lift 0.00, n=0; `vibrant` 0.0 (0/0/0/0) vs PG 0.0, lift 0.00, n=0; `plethora` 0.0 (0/0/0/0) vs PG 0.0, lift 0.00, n=0; `myriad` 0.0 (0/0/0/0) vs PG 0.0, lift 0.00, n=0; `garner` 0.0 (0/0/0/0) vs PG 0.0, lift 0.00, n=0; `bolster` 0.0 (0/0/0/0) vs PG 0.0, lift 0.00, n=0; `pivotal` 0.4 (1/0/2/0) vs PG 0.0, lift 0.41, n=3; `seamless` 0.2 (1/0/0/0) vs PG 0.0, lift 0.27, n=2; `intricate / intricacies` 0.1 (0/0/0/0) vs PG 0.0, lift 0.14, n=1; `synergy` 0.1 (1/0/0/0) vs PG 0.0, lift 0.14, n=1; `harness (verb sense)` 0.4 (0/0/2/0) vs PG 0.0, lift 0.41, n=3 | W | public catalog; <=3 hits locally each, PG 0. Excluded because PG uses them: leverage, valuable, significant, meticulous, transformative, invaluable, encompass, facilitate, foster, streamline, elevate |
| `ban-actionable` | mid | `\bactionable\b` | `actionable` 124.0 (88/147/65/48) vs PG 0.0, lift 248.97, n=1071 (second measurement pass) | D2 | demoted high->mid: n=1071, PG 0 |
| `ban-workflow` | low | `\bworkflows?\b` | `workflow` 1038.9 (327/1400/279/617) vs PG 0.0, lift 2078.79, n=8974 (second measurement pass) | D2 | demoted high->low: literal software noun; PG 0 |
| `ban-framework` | low | `\bframeworks?\b` | `framework` 9.5 (2/11/24/7) vs PG 1.7, lift 4.49, n=82 (second measurement pass) | D2 | literal software noun; lift 4.5 |
| `ban-edge-case` | low | `\bedge cases?\b` | `edge-case` 32.0 (11/43/11/14) vs PG 12.1, lift 2.58, n=276 (second measurement pass) | D2 | technical term; lift 2.6 |

## 11. Model and harness tics (`model-tic`)

| pid | severity | shipped regex | evidence (AI /1M (C/G/K/GLM) vs PG /1M, lift, n) | source | note |
|---|---|---|---|---|---|
| `tic-let-me-check` | high | `\blet me (?:check\|look\|verify\|see)\b` | `let me check / look at` 349.4 (648/1/1762/2055) vs PG 1.8, lift 130.81, n=2881 | D | GPT 1/1M vs Claude 648, Kimi 1762, GLM 2055 |
| `tic-let-me` | mid | `\blet me\b` | `let me <verb>` 1268.7 (2626/5/6161/5984) vs PG 23.1, lift 52.77, n=10460 | D | demoted high->mid: 'let me explain' exists in prose; GPT ~5/1M |
| `tic-ill-verb` | low | `\bI['’]ll\b` | `I'll <verb> (next-step announce)` 4747.7 (5109/5016/2463/1875) vs PG 117.5, lift 40.09, n=39144 | D | demoted high->low: ordinary first-person English (PG 117/1M); density is the tell |
| `tic-so-ill` | mid | `\b(?:so\|and\|then) I['’]ll\b` | `so I'll / and I'll` 777.6 (617/920/292/155) vs PG 12.5, lift 58.22, n=6411 | D | demoted high->mid |
| `tic-now-im` | high | `\bnow I['’]m\b` | `now I'm <verb>ing` 126.8 (324/68/79/4) vs PG 1.8, lift 47.45, n=1045 | D | Claude 324/1M |
| `tic-i-did-not` | low | `\bI did not\b` | `I did not <verb>` 196.4 (55/277/5/14) vs PG 3.6, lift 44.11, n=1619 | D | demoted high->low: ordinary English; GPT 277 vs Claude 55 |
| `tic-if-needed` | mid | `\bif needed\b` | `if needed` 130.5 (12/189/29/43) vs PG 0.0, lift 146.57, n=1076 | D | GPT 189/1M; demoted high->mid |
| `tic-per-the` | mid | `\bper the\b` | `per the <noun>` 125.3 (240/24/420/680) vs PG 0.0, lift 140.71, n=1033 | D | GLM 680, Kimi 420, Claude 240, GPT 24 |
| `tic-before-any` | low | `\bbefore any\b` | `before any <noun>` 98.7 (56/99/64/475) vs PG 1.8, lift 36.96, n=814 | D | GLM 475/1M; demoted: ordinary phrase |
| `tic-one-last` | low | `\bone last\b` | `one last <noun>` 81.3 (4/120/17/4) vs PG 1.8, lift 30.42, n=670 | D | GPT 120/1M; demoted: ordinary phrase |
| `tic-it-does-not` | low | `\bit does not\b` | `it does not` 95.1 (14/137/8/18) vs PG 1.8, lift 35.60, n=784 | D | GPT 137/1M; demoted: ordinary phrase |
| `tic-actually-let-me` | high | `\bactually,? let me\b` | `actually, let me` 17.2 (18/0/138/90) vs PG 0.0, lift 19.34, n=142 | D | Kimi 138, GLM 90, GPT 0 |
| `tic-no-regressions` | mid | `\bno regressions?\b` | `no regressions` 12.6 (25/8/8/22) vs PG 0.0, lift 14.17, n=104 | D | n=104; demoted high->mid |
| `tic-green-tests` | mid | `\b(?:tests?\|ci\|suite\|build\|checks?\|pipeline\|lint\|typecheck) (?:is\|are\|went\|go\|goes\|stays?\|remains?\|came back\|now) (?:all )?green\b\|\b(?:all\|everything\|stays) green\b\|\bgreen (?:locally\|in ci\|across)\b` | `green (tests pass)` 1748.5 (2250/1506/1633/3228) vs PG 3.6, lift 392.74, n=14416 | D | sense-scoped subset of measured \bgreen\b (which also matched the colour, PG 3.6) |
| `tic-verified` | mid | `\b(?:verified\|confirmed)\b` | `verified / confirmed` 1889.5 (2582/1598/1672/3206) vs PG 16.0, lift 111.69, n=15579 | D | demoted high->mid: common verbs; PG 16/1M |
| `tic-root-cause` | mid | `\broot cause\b` | `root cause` 267.4 (336/241/255/324) vs PG 3.6, lift 60.07, n=2205 | D |  |
| `tic-so-i-can` | low | `\bso (?:I\|we) can\b` | `so I can / so we can` 229.7 (103/297/102/76) vs PG 10.7, lift 19.85, n=1894 | D | demoted: ordinary phrase, PG 10.7 |
| `tic-first-then` | mid | `\bfirst,? then\b` | `X first, then Y` 137.9 (67/167/124/90) vs PG 1.8, lift 51.63, n=1137 | D | demoted high->mid |
| `tic-harness-scaffold` | mid | `^[A-Z]{4,}(?: [A-Z]{4,})? MODE (?:ON\|ENABLED\|ACTIVATED)\b\|^(?:WORKING\|BLOCKED\|STATUS):` | (see note) | D | all-caps mode banners and status-prefix lines pasted from an agent harness; PG 0 (harness prompt lineage, not model style) |
| `tic-verdict-stamp` | mid (case) | `\b(?:VERDICT\|REQUEST[ _-]?CHANGES\|CONFIRMED\|REJECTED\|SUSTAINED\|BLOCKER\|UNVERIFIED\|PASS\|FAIL)\b(?=[:\s.,)]\|$)` | (see note) | B | sample B: 57 hits in 15/32 AI samples, 0 in 15 PG essays; case-sensitive; shipped regex on 231 PG essays: 0 hit(s) in 0 essay(s) |
| `tic-honest-limits` | mid (raw, case) | `^(?:#{1,4}\s+\|\*\*)(?:What I (?:could not\|couldn['’]t\|did not\|didn['’]t) verify\|Limitations?\|Caveats?\|Remaining risks?\|Open questions?\|Unverified)\b\|^(?:Limitations?\|Caveats?\|Remaining risks?\|Open questions?\|Unverified):\|\[unverified\]` | (see note) | B | sample B: 9 hits in 4/32 AI, 0 in PG; case-sensitive, heading/bold marker or trailing colon mandatory (KO counterpart: tic-claude-honest); shipped regex on 231 PG essays: 0 hit(s) in 0 essay(s) |
| `tic-as-expected` | mid | `\bas expected\b` | `as-expected` 30.4 (31/31/29/21) vs PG 0.0, lift 61.89, n=263 (second measurement pass) | D2 | n=263, PG 0; demoted high->mid |
| `tic-as-requested` | mid | `\bas requested\b` | `as-requested` 21.9 (1/33/0/3) vs PG 0.0, lift 44.76, n=189 (second measurement pass) | D2 | GPT 33/1M; demoted high->mid |
| `tic-sanity-check` | mid | `\bsanity[- ]check(?:s\|ed\|ing)?\b\|\bdouble[- ]check(?:s\|ed\|ing)?\b` | `sanity-check` 17.7 (3/25/6/7) vs PG 0.0, lift 36.42, n=153 (second measurement pass); `double-check` 7.9 (22/0/27/17) vs PG 0.0, lift 16.74, n=68 (second measurement pass) | D2 | demoted high->mid |
| `tic-clean` | low | `\b(?:is\|are\|stays?\|came back\|comes back\|now\|all\|tree\|diff\|build\|lint\|run) clean\b\|\bclean (?:run\|pass\|diff\|tree\|build\|checkout\|state)\b` | `clean` 1391.8 (1271/1487/1010/1196) vs PG 44.9, lift 30.7, n=12022 (second measurement pass) | D2 | sense-scoped subset of measured \bclean\b (1392 vs 45/1M); low: ordinary adjective |
| `tic-genuinely` | mid | `\bgenuinely\b` | `genuinely` 232.3 (644/75/309/257) vs PG 86.3, lift 2.68, n=2007 (second measurement pass) | D2 | Claude 644/1M vs GPT 75; PG 86 |
| `tic-exactly` | low | `\bexactly\b` | `exactly` 948.4 (1733/678/967/686) vs PG 224.3, lift 4.22, n=8192 (second measurement pass) | D2 | demoted mid->low: ordinary adverb; Claude 1733/1M vs PG 224 |
| `tic-i-want-to-be` | low | `\bI want to be (?:direct\|honest\|clear\|upfront\|precise\|careful)\b` | `i-want-to-be` 3.4 (12/0/5/3) vs PG 0.0, lift 7.71, n=29 (second measurement pass) | D2 | n=29 (one under the floor), PG 0, Claude 12/1M vs GPT 0 |

## 12. Typography (`typography`)

| pid | severity | shipped regex | evidence (AI /1M (C/G/K/GLM) vs PG /1M, lift, n) | source | note |
|---|---|---|---|---|---|
| `typo-bold` | low (raw) | `\*\*[^*\n]+\*\*` | `**bold** span` 7808.4 (11891/6090/8326/11745) vs PG 0.0, lift 8769.42, n=64379 | D | per-span weight low; PG 0 |
| `typo-arrow-chain` | mid (raw) | `(?:→\|->)[^\n]*(?:→\|->)` | `arrow chain (→ / ->)` 2170.2 (4493/615/6618/6801) vs PG 0.0, lift 2437.31, n=17893 | D | Claude 4493, Kimi 6618, GLM 6801, GPT 615; PG 0 |
| `typo-bold-label-bullet` | mid (raw) | `^\s*(?:[-*]\|\d+\.)\s+\*\*[^*\n]{2,70}\*\*\s*[—:–-]\|^\s*(?:[-*]\|\d+\.)\s+\*\*[^*\n]{2,70}:\*\*` | (see note) | B | sample B: 49 hits in 9/32 AI, 0 in PG; shipped regex also accepts '**Label:** text'; shipped regex on 231 PG essays: 0 hit(s) in 0 essay(s) |

## Excluded candidates (Paul Graham uses them as much as or more than the models, or lift < 2)

| phrase | AI /1M | PG /1M | lift | why excluded |
|---|---|---|---|---|
| not just | 198.3 | 448.8 | 0.44 | PG rate >= AI rate |
| not only | 22.2 | 169.2 | 0.13 | PG rate >= AI rate |
| not merely | 17.3 | 138.9 | 0.12 | PG rate >= AI rate |
| not simply | 1.5 | 39.2 | 0.04 | PG rate >= AI rate |
| not about | 2.1 | 12.5 | 0.15 | PG rate >= AI rate |
| but rather | 1.2 | 14.2 | 0.08 | PG rate >= AI rate |
| it's not X, it's Y | 3.8 | 3.6 | 0.84 | lift < 2 |
| isn't just / only / about | 9.7 | 16.0 | 0.57 | PG rate >= AI rate |
| instead of | 627.4 | 534.2 | 1.17 | lift < 2 |
| three/two things | 91.6 | 153.2 | 0.59 | PG rate >= AI rate |
| there are two/three | 18.4 | 140.7 | 0.13 | PG rate >= AI rate |
| First, ... Second, | 8.7 | 19.6 | 0.43 | PG rate >= AI rate |
| on the other hand | 0.1 | 35.6 | 0.00 | PG rate >= AI rate |
| a few options | 1.7 | 8.9 | 0.17 | PG rate >= AI rate |
| falls into N categories | 0.5 | 1.8 | 0.18 | PG rate >= AI rate |
| ultimately | 5.2 | 74.8 | 0.07 | PG rate >= AI rate |
| in other words | 1.6 | 28.5 | 0.05 | PG rate >= AI rate |
| the upshot | 0.5 | 5.3 | 0.08 | PG rate >= AI rate |
| in short | 2.9 | 1.8 | 1.09 | lift < 2 |
| arguably | 3.8 | 60.5 | 0.06 | PG rate >= AI rate |
| to some extent | 0.0 | 37.4 | 0.00 | PG rate >= AI rate |
| in many ways | 0.0 | 5.3 | 0.00 | PG rate >= AI rate |
| imagine / picture this | 0.0 | 53.4 | 0.00 | PG rate >= AI rate |
| think of it as | 0.2 | 10.7 | 0.02 | PG rate >= AI rate |
| here's the thing | 1.2 | 1.8 | 0.45 | PG rate >= AI rate |
| here's why / here's what | 10.7 | 5.3 | 1.71 | lift < 2 |
| here is a / here's a | 4.0 | 33.8 | 0.12 | PG rate >= AI rate |
| that said | 3.0 | 3.6 | 0.68 | PG rate >= AI rate |
| in this post/section | 0.0 | 3.6 | 0.00 | PG rate >= AI rate |
| happy to help / happy to X | 0.4 | 30.3 | 0.01 | PG rate >= AI rate |
| would you like me to | 6.2 | 5.3 | 0.99 | lift < 2 |
| is there anything else | 21.0 | 24.9 | 0.81 | PG rate >= AI rate |
| leverage | 3.5 | 58.8 | 0.06 | PG rate >= AI rate |
| valuable | 12.1 | 324.1 | 0.04 | PG rate >= AI rate |
| significant(ly) | 12.5 | 122.9 | 0.10 | PG rate >= AI rate |
| emphasizing | 6.1 | 32.0 | 0.18 | PG rate >= AI rate |
| meticulous(ly) | 0.0 | 3.6 | 0.00 | PG rate >= AI rate |
| transformative | 0.0 | 1.8 | 0.00 | PG rate >= AI rate |
| invaluable | 0.0 | 1.8 | 0.00 | PG rate >= AI rate |
| encompass | 0.0 | 5.3 | 0.00 | PG rate >= AI rate |
| facilitate | 0.1 | 3.6 | 0.03 | PG rate >= AI rate |
| foster | 0.1 | 5.3 | 0.02 | PG rate >= AI rate |
| streamline | 0.1 | 5.3 | 0.02 | PG rate >= AI rate |
| elevate | 1.7 | 1.8 | 0.64 | PG rate >= AI rate |
| crucial | 9.7 | 5.3 | 1.56 | lift < 2 |
| ensure | 103.1 | 83.7 | 1.22 | lift < 2 |
| enhance | 11.6 | 8.9 | 1.19 | lift < 2 |
| landscape | 3.1 | 8.9 | 0.32 | PG rate >= AI rate |
| backbone | 1.6 | 5.3 | 0.25 | PG rate >= AI rate |
| journey | 0.0 | 3.6 | 0.00 | PG rate >= AI rate |
| the intersection of | 0.0 | 7.1 | 0.00 | PG rate >= AI rate |
| deeply rooted | 0.0 | 7.1 | 0.00 | PG rate >= AI rate |
| a testament to | 0.0 | 7.1 | 0.00 | PG rate >= AI rate |
| serves as | 0.7 | 5.3 | 0.12 | PG rate >= AI rate |
| cutting-edge | 0.0 | 5.3 | 0.00 | PG rate >= AI rate |
| when it comes to | 0.0 | 14.2 | 0.00 | PG rate >= AI rate |
| best practices | 1.0 | 1.8 | 0.36 | PG rate >= AI rate |
| associated with / connected to | 5.7 | 32.0 | 0.17 | PG rate >= AI rate |
| a wide range of | 0.0 | 1.8 | 0.00 | PG rate >= AI rate |
| the issue/problem is | 66.0 | 96.2 | 0.68 | PG rate >= AI rate |

Re-measured and rejected as PG-heavy (AI vs PG per 1M): to be clear 0.2 vs 5.2; great question 0.2 vs 5.2; absolutely 2.8 vs 24; importantly 10.5 vs 33; in practice 9 vs 164; that said 2.9 vs 3.5; I should note 4.1 vs 3.5; push back 2.9 vs 6.9; essentially 7 vs 26; straightforward 13 vs 54; let's 8 vs 83; probably 82 vs 1280; certainly 14 vs 248; I think 6 vs 752; you'll/you're/you can 82 vs 5336; quite 5 vs 264.

Sample B also measured and rejected as signals (PG-heavier): 'is not X, but Y' 0.71/1K PG vs 0.10 AI; 'not just X but Y' 0.84 vs 0.02; negative-scene narration 0.94 vs 0.29; two-lane framing 0.34 vs 0.04; enumeration announcements 0.60 vs 0.33.

Source codes: D = local corpus ratio (corpus A); D2 = second measurement pass on the same corpus (per-family words: Claude 2.04M, GPT 5.68M, Kimi 0.63M, GLM 0.29M; PG 0.58M alphabetic tokens); W = public catalog (Wikipedia) with 0 local hits and 0 in PG; B = sample B discourse detector (0 PG hits). Corpus A's mining tools were not shipped; `scripts/tools/calibrate.ts` reproduces the structural calibration.


## Retrospective register

Mirrors the Korean section 14: four pids and one metric for the retrospective register.

| pid | what it catches | example | fix |
|---|---|---|---|
| hedge-recommend | recommendation hedge | "it is better to move to a package built for it" | "Move to a package built for it." |
| stock-confess | confession tic | "to be honest", "full disclosure", "floor value" | state the fact and how it was counted |
| stock-restate | restatement tic | "the real cost is", "at the end of the day" | the content sentence |
| pov-owner | owner narrator in a report | "my regression", "I recommend" | "the agent's regression", "the option that fits" |

Metric `para_multi_sentence_share` (share of body paragraphs with 3+ sentences, threshold 0.35) covers the same register. "I think" is deliberately not a pattern: Paul Graham uses it about 100x more than the models (see the rejected-signals note above).


### Retrospective register, second pass

Structure rules for this register (Korean guide "블로그·회고 글의 전개"): subtitle + numeric lede; background before the event; failures and the post-review in; dialog as quote components with real names (never "a person"); one infographic per 6-8 paragraphs; ledgers instead of card grids; PRs always as "title (#n)"; final values only (no correction factors in the body); money once, from a priced catalog, plus one line of context; praise public tools freely, never your own; end on an observation, not a maxim.

## Addendum: pids ported from the Korean pack

These four pids were added to `en/patterns.ts` from the Korean blog checklist and are listed here so the catalog test covers them. Evidence: `references/ko/lexical-tells.md` section 14 (same tells, English phrasing).

- `hedge-recommend` (mid): "it is better to use X", "you'd be better off" — recommendation hedge that replaces a decision with advice.
- `stock-confess` (mid): "confession", "to be honest", "floor value" — mock-candor openers.
- `stock-restate` (mid): "the real problem/cost/reason is", "the point is" — restating a claim as if revealing it.
- `pov-owner` (low): "I built/added/broke" in a report that should keep the observer voice.

## Addendum: pids from the im-not-ai / k-skill comparison

Source: a comparison with the public im-not-ai and k-skill catalogs, rows 32, 49, 47, 51, 24. Each candidate was re-measured here before shipping: agent English prose mined from 700 recent sessions (6,095 assistant blocks, 5.85M chars) against 40 Paul Graham essays (98.8k words). Rates are per million words.

| pid | severity | shipped regex | evidence (agent /Mw vs PG /Mw) | note |
|---|---|---|---|---|
| `typo-emoji-label` | mid | line-initial or bold/colon-label emoji (see `EMOJI_LABEL`) | 27.7 vs 0 (25 hits, 0 in PG); any emoji 236 vs 0 | raw pattern; only the label position counts, an emoji inside a sentence is voice. Muted in the chat profile. |
| `take-this-is-why` | mid | `\b(?:this|that) is (?:exactly |precisely |part of )?why\b|\bwhich is why\b` | 104.3 vs 20.2, lift 5.2 (94 hits) | reason-closer; the Korean twin is `take-reason-closer` (~하는 이유다). Editors plant it while rewriting, so the diff mode lists it under planted tells. |
| `take-what-matters` | low | `\bwhat (?:matters|counts|is needed|is important) (?:here )?(?:is|was)\b` | 1.1 vs 0 (1 hit) | cleft; below the n floor, kept low as the twin of Korean `take-decl` 필요한 것은/중요한 것은 (im-not-ai D-8: human 0.09 vs AI 0.92 per 1k words, 10x, every model). |
| `hedge-remain` | low | `\b(?:challenges|limitations|questions|caveats|open questions|gaps) (?:do |still )?(?:remain|persist)\b` | 3.3 vs 0 (3 hits) | empty objection slot; the Korean twin is `hedge-objection-slot` (과제도 남아 있다). |
| `neg-no-longer-but` | low | `\bno longer\b[^.\n]{0,40}\bbut\b` | 2.2 vs 0 (2 hits) | temporal redefinition (im-not-ai A-24 더 이상); Korean 더 이상 measured human 3.4 vs AI 0.7 per 100k chars in a human Korean blog corpus, so no Korean pid. |

Measured and not shipped: `it is clear that` (0 vs PG 20.2: PG uses it, the Korean 명확합니다 does separate and shipped as `take-obvious`); future openers `going forward|looking ahead|in the future` at sentence start (0 vs 0); double hedges `may possibly` (0 vs PG 30.4, PG-heavy).

