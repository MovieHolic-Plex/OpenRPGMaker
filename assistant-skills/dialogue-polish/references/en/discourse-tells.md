# English discourse (arc-level) AI tells

Source: sample B (discourse reading) of the linter's calibration run (detector pass + verified quotes over 32 long-form AI samples vs 15 Paul Graham essays). Sample list: `evidence/arc-classification.jsonl`. Companion lexical catalog: `lexical-tells.md`.

Mirror of `references/discourse-tells.md` (Korean) for English. Evidence: 32 AI English samples
(51,316 words) read against 15 Paul Graham essays (38,277 words) fetched to a local scratch directory (not shipped)
for reading only. Every move below carries a count over the sample and quoted examples (<= 12 words).
The test is the same as the Korean catalog: **the moment a reader can predict what comes next**.

The single most important finding for the English port: **four of the Korean catalog's strongest
tells invert in English.** Negated redefinition ("it's not X, it's Y"), "not just X but Y",
negative-scene narration, and two-lane framing are all *more frequent in Paul Graham than in AI
prose* (section 4). Porting those Korean rules to English unchanged would flag the human baseline.

---

## 0. Sample manifest

| family | n | words | median words | register |
|---|---|---|---|---|
| claude | 7 | 9,487 | 1,029 | 5 final reports, 2 mid-turn narration |
| kimi | 7 | 10,667 | 1,446 | 7 final messages (mixed report / deliberation) |
| gpt | 6 | 7,980 | 1,438 | 6 final answers (4 enumerated checklists, 2 explanatory) |
| glm | 6 | 7,049 | 1,129 | 6 mid-turn narration (no >= 800-word final answers exist in this corpus) |
| docs | 6 | 16,133 | 2,524 | 6 agent-written documents |
| **AI total** | **32** | **51,316** | 1,187 | |
| pg (human) | 15 | 38,277 | 2,342 | essays, 1993-2025 |

AI session sources: local coding-agent session logs, assistant messages only, code fences and tool
payloads stripped, command-list-heavy messages dropped, >= 800 words each. Model family is read from
the message's `model` field (`claude-fable-5`, `claude-opus-4-8`, `claude-opus-5`, `kimi-k3`,
`gpt-5.6-sol`, `glm-5.3`, `glm-5.2`).
Session ids and document paths are not reproduced.

| id | model | words | source |
|---|---|---|---|
| claude-00 | claude-fable-5 | 1208 | agent session |
| claude-01 | claude-fable-5 | 1114 | agent session |
| claude-02 | claude-fable-5 | 878 | agent session |
| claude-03 | claude-fable-5 | 800 | agent session |
| claude-04 | claude-opus-4-8 | 920 | agent session |
| claude-05 | claude-opus-5 | 3539 | agent session |
| claude-06 | claude-fable-5-1 | 1029 | agent session |
| kimi-07 | kimi-k3 | 1956 | agent session |
| kimi-08 | kimi-k3 | 1860 | agent session |
| kimi-09 | kimi-k3 | 1579 | agent session |
| kimi-10 | kimi-k3 | 1446 | agent session |
| kimi-11 | kimi-k3 | 1408 | agent session |
| kimi-12 | kimi-k3 | 1343 | agent session |
| kimi-13 | kimi-k3 | 1076 | agent session |
| gpt-14 | gpt-5.6-sol | 1689 | agent session |
| gpt-15 | gpt-5.6-sol | 1532 | agent session |
| gpt-16 | gpt-5.6-sol | 1467 | agent session |
| gpt-17 | gpt-5.6-sol | 1050 | agent session |
| gpt-18 | gpt-5.6-sol | 836 | agent session |
| gpt-19 | gpt-5.6-sol | 1408 | agent session |
| glm-20 | glm-5.2 | 1435 | agent session |
| glm-21 | glm-5.2 | 1079 | agent session |
| glm-22 | glm-5.2 | 1176 | agent session |
| glm-23 | glm-5.3 | 1101 | agent session |
| glm-24 | glm-5.2 | 1102 | agent session |
| glm-25 | glm-5.3 | 1156 | agent session |
| docs-26 | agent-written document | 4989 | agent-written document |
| docs-27 | agent-written document | 3396 | agent-written document |
| docs-28 | agent-written document | 2885 | agent-written document |
| docs-29 | agent-written document | 2162 | agent-written document |
| docs-30 | agent-written document | 1620 | agent-written document |
| docs-31 | agent-written document | 1081 | agent-written document |

PG essays (fetched to a local scratch directory, never copied into this file beyond 12-word quotes):
`progbot` (1993), `desres` (2003), `laundry` (2004), `opensource` (2005), `marginal` (2006),
`microsoft` (2007), `boss` (2008), `ramenprofitable` (2009), `yahoo` (2010), `speak` (2012),
`before` (2014), `ineq` (2016), `ace` (2020), `heresy` (2022), `goodwriting` (2025).
Documents about private business matters were excluded from the AI document family by a
pre-filter; the PG corpus is unfiltered because it is the human control.

---

## 1. At a glance: what AI does and the human does not

Counts are `samples containing the move / samples in group (total hits)`. Rate is hits per 1,000 words.

| move | PG 15 essays | AI 32 samples | reading |
|---|---|---|---|
| Thesis-first label (`## Verdict`, `### Bottom line`, `## Summary` as opener) | 0/15 (0) | 2/32 (2) | AI-only |
| Bolded one-line verdict in the first 70 words | 0/15 (0) | 5/32 (7) | AI-only |
| Scope / method / date declaration block | 0/15 (0) | 7/32 (11) | AI-only |
| Status framing line ("All evidence is in. Report follows.") | 0/15 (0) | 8/32 (8) | AI-only |
| Plan-announcement opener ("Here is my plan: …") | 0/15 (0) | 7/32 (7) | AI-only (prompt-shaped) |
| Anecdote opening | 9/15 (9) | 0/32 (0) | human-only |
| Enumeration announcement ("two things", "There are three") | 11/15 (23, 0.60/1k) | 12/32 (17, 0.33/1k) | **human does it more** |
| Line-initial First / Second / Third | 0/15 (0) | 4/32 (6) | AI-only |
| Symmetric case parade (bold-label bullets) | 0/15 (0) | 9/32 (49, 0.95/1k) | AI-only |
| Repeated section skeleton (headings, same label set) | 0/15 (0) | 14/32 (123, 2.40/1k) | AI-only |
| Negated redefinition ("is not X, but Y") | 11/15 (27, 0.71/1k) | 3/32 (5, 0.10/1k) | **inverted** |
| "not just X but Y" | 13/15 (32, 0.84/1k) | 1/32 (1, 0.02/1k) | **inverted** |
| Negative-scene narration ("there is no …", "never fires") | 10/15 (36, 0.94/1k) | 8/32 (15, 0.29/1k) | **inverted** |
| Two-lane framing ("on the other hand", "two paths") | 6/15 (13, 0.34/1k) | 2/32 (2, 0.04/1k) | **inverted** |
| Rule-of-three triad (`a, b, and c`) | 5/15 (8, 0.21/1k) | 13/32 (107, 2.09/1k; 0.60/1k excl. gpt checklists) | AI 3-10x human |
| Personified data ("the data shows", "the capture says") | 0/15 (0) | 4/32 (10) | AI-only |
| Recap / summary box | 0/15 (0) | 4/32 (4) | AI-only |
| "What I could not verify" / caveats / `[unverified]` label | 0/15 (0) | 4/32 (9) | AI-only |
| Next-steps / required-fixes checklist | 0/15 (0) | 3/32 (4) + 6/32 in the tail | AI-only |
| Uppercase adjudication tags (CONFIRMED, REQUEST-CHANGES, RED/GREEN) | 0/15 (0) | 15/32 (57, 1.11/1k) | AI-only |
| Closing echo of the opening thesis | 0/15 (0) | 5/32 (5) | AI-only |
| Closing offer ("Let me know if", "Happy to") | 1/15 (1) | 0/32 (0) | **absent in this AI corpus** |
| Rhetorical closer / ends on a question | 0/15 (0) | 0/32 (0) | neither |
| One-line landing as the last sentence | 4/15 (4) | 3/32 (3) | shared, but different shape (§3g) |
| Bullets per 1k words (median) | 0.00 (max 1.41) | 11.86 (max 42.6) | AI-only |
| Contractions per 1k words (median) | 28.67 (min 14.35) | 8.50 | human 3.4x |
| Second person "you" per 1k (median) | 18.95 (min 3.38) | 0.00 (max 2.48) | human-only |
| Hedged personal claim ("I think", "probably") per 1k | 2.81 | 0.00 | human-only |
| Self-question answered in the next sentence (median count) | 3 | 0 | human-only |

---

## 2. Move by move

### 1. Openings

**1a. Thesis-first label / bolded verdict.** The first block is a label (`## Verdict`, `### Bottom
line`, `## Summary`) or a bolded one-sentence judgment, and the same judgment reappears verbatim at
the end. AI 2/32 label + 5/32 bolded verdict; PG 0/15 (no PG essay in the sample opens with a label
of any kind).

- claude-00: `## Verdict` then "**PR 1 (…): REQUEST CHANGES.** The core rename is done correctly"
- docs-26: "### Bottom line The migration is safe to ship this week"
- docs-27: "## Summary 1. The repository has two distinct token bases"
- glm-21: "Batch 1 results: **A — …: DONE.**"

Fix: delete the first block or move it last. Let the body produce the verdict. PG compresses his
conclusion into the last three to five paragraphs and never announces it up front.

**1b. Scope / method / date declaration.** A preamble of colon-labelled metadata that advertises the
pipeline rather than the finding. AI 7/32 (11 hits, 5 of 6 documents); PG 0/15.

- docs-26: "**Date:** … **Scope:** … **Method:**" (three stacked labels before any claim)
- docs-30: "Mode: read-only review"
- docs-31: "**Date:** … · **Run:** … **Evidence:**"
- claude-03: "Evidence base: PR body + full diff (`origin/dev...HEAD`)"

Fix: delete, or demote to a trailing appendix line. A human editor keeps at most the date.

**1c. Status framing.** The message opens by reporting its own channel state or completion state
before it says anything about the subject. AI 8/32; PG 0/15.

- claude-01: "All evidence gathered; tests run. Report follows."
- claude-02: "All evidence is in. Report follows."
- claude-04: "Confirmed definitively."
- kimi-13: "Done. All 31 open issues audited against current source"

Fix: cut the first sentence. It carries no information the next sentence does not.

**1d. Plan-announcement opener.** "Here is my plan: <classification> - I'll <plan>."
6/6 gpt samples, 1/6 glm, 0 elsewhere, 0/15 PG. This one is induced by the source prompt, so it is
evidence about the prompt as much as the model — but as a surface tell it is perfectly diagnostic.

- gpt-14: "Here is my plan: a constrained enumeration, then 60 items"
- gpt-17: "Here is my plan: explain the system end to end"
- glm-22: "Here is my plan: four fixes, shipped one at a time"

Fix: strip the whole plan sentence when the text is reused as prose.

**1e. Hook-then-narrow.** The Korean catalog's ARC_HOOK_DECLINE (big scene, then "this essay is not
about that") is **rare in this English corpus**: 5/32 weak matches, all of them "The issue is that …"
rather than a staged hook. PG, by contrast, hooks with an anecdote and never narrows explicitly
(9/15 anecdote openings). Do not port this rule as-is.

### 2. Body

**2a. Enumeration announcement.** "There are two things", "three real call sites", "two options".
AI 12/32 (17 hits, 0.33/1k); PG 11/15 (23 hits, **0.60/1k**). This is *not* a discriminator in
English — PG announces counts more often than the models do.

- claude-00: "three real call sites still resolve the tool by the string"
- kimi-11: "Two options: (a) add a dispatch.rs extraction task, or (b)"
- pg-goodwriting: "There are two senses in which writing can be good"
- pg-heresy: "there are two distinctive things about heresy: (1) that it"

Fix: none at the count level. What *is* AI-shaped is the count announcement **plus** a matching
heading skeleton plus equal-length items (2c/2d below). Flag the combination, never the count alone.

**2b. Ordinal march.** Line-initial `First,` / `Second,` / `Third,` as section markers. AI 4/32
(6 hits); PG 0/15 at line-initial position (PG writes "One is that …", inline, and then breaks the
symmetry). Fix: drop the ordinals, start with the item, and deliberately vary item length.

**2c. Symmetric case parade.** A list where every item is `**bold label** — verdict`, all items the
same shape, usually closed by one unifying sentence. AI 9/32 (49 hits, 0.95/1k); PG 0/15.

- kimi-13: "- **#NNN** — **already fixed**:" (same shape four times in one list)
- kimi-12: "1. **alpha-cli**: … 2. **beta-plugin**: … 3. **gamma-core**:" (names replaced)
- claude-05: "- **PR1**: … - **PR2**: … - **PR3**:"
- glm-20: "**D — restart: DONE.**" / "**F — kickoff: DONE.**"

Fix: write one case long, the rest in a sentence each; delete the unifying line. Asymmetry is the
signal of a human who actually cared about one of the cases more.

**2d. Repeated section skeleton.** Every section cycles the same label set, so the third section
lets the reader predict the fourth. AI 14/32 carry headings at all (123 headings, 2.40/1k);
PG 0/15 — not one essay in the sample uses a heading. Two clean instances:

- docs-29 repeats, for each of three proposals: "**Risk.**", "**Mitigation.**",
  "**Severity if wrong: high.**", "**Review verdict: accept.**" — 3 x 3 x 3 x 3, identical wording.
- claude-01/02/03 are three separate reviews that share one skeleton: `# Code Review: PR #NNNN`,
  `## BLOCKERS`, `## CONCERNS (non-blocking)`, `VERDICT: REQUEST-CHANGES` — and all three end with
  the same verdict string.

Measured as "the most-repeated bold label in one sample": AI max 6 (three samples at >= 3), median 0;
PG max 0.

Fix: vary the entry point per section (one starts with an example, one with a question, one with a
number), and convert the labels into sentences. If a label is empty in one section, the skeleton was
imposed before the content existed.

**2e. Negated redefinition as thesis — INVERTED IN ENGLISH.** PG 11/15 (27 hits, 0.71/1k);
AI 3/32 (5 hits, 0.10/1k). "not just X but Y" is even more lopsided: PG 13/15 (32 hits) vs AI 1/32.

- pg-ineq: "It's not economic inequality per se that's blocking social mobility"
- pg-goodwriting: "not just a matter of saying true things, but saying"
- pg-desres: "are not primarily a form for finished programs, but something"
- docs-26 (the AI side): "is not a guarantee: the cache may still serve stale entries"

Fix: **do not flag the construction.** Flag only the two variants that stay AI-shaped: (i) the
negation sits in a heading or a verdict line, and (ii) X is a strawman nobody asserted. Both are
sub-cases the linter should detect positionally (heading / final paragraph), not lexically.

**2f. Negative-scene narration — INVERTED.** "there is no …", "never fires", "nothing about".
PG 10/15 (36 hits, 0.94/1k); AI 8/32 (15 hits, 0.29/1k). In AI prose it is almost always a literal
verification result, not rhetoric.

- claude-04: "There is no `tracing`/`log` emission anywhere."
- docs-28: "There is no stale-recovery steal window."
- pg-before: "There is no boss to trick, only users, and all"
- pg-ace: "There is no one who can give you accurate advice"

Fix: leave alone in English. The Korean tell ("없었습니다" used to dramatize) has no frequency
equivalent here.

**2g. Two-lane framing — INVERTED.** PG 6/15 (13 hits); AI 2/32. PG uses "on the other hand",
"two paths", "good news / bad news" freely; the models mostly don't.

- pg-desres: "two paths converge at the top: the best design surpasses"
- pg-before: "On the other hand, history is even fuller of examples"
- kimi-11 (AI side): "Two options: (a) … or (b) …"

Fix: no rule.

**2h. Rule-of-three triads.** `a, b, and c` noun triads. AI 13/32 (107 hits, **2.09/1k**);
PG 5/15 (8 hits, 0.21/1k). The gap is prompt-sensitive: 79 of the 107 AI triads come from the four
gpt enumerated-checklist samples (18-22 each), while the two explanatory gpt samples have 1 each.
Excluding the gpt family the AI rate is 0.60/1k — still ~3x PG, and the docs family alone is
1.49/1k. Treat the triad as a threshold signal, not a binary one.

- gpt-14: "buffering, scaling, and cost" / "initialization, wraparound, and comparison behavior"
- gpt-16: "loss, duplication, and reordering"
- docs-28: "tests, typecheck, and the real compiled-host QA entry point"
- docs-29: "disk, network, and memory limits on the shared build host"

Fix: cut one term from every second triad. Two items, or four, break the cadence; the tell is the
*uniformity of three*, not any single triad.

**2i. Personified data.** The evidence is given the verb, so the sentence can assert without an
author. AI 4/32 (10 hits); PG 0/15 — not one instance in 38k words of PG.

- docs-29: "data show steady queue growth after the second worker pool came online"
- docs-27: "evidence proves a plausible source of divergence"
- kimi-08: "Capture shows 429 → **the fallback passed the 429 through unchanged**"
- glm-21: "logs show "upstream socket timeout" / "socket hang up""

Fix: give the sentence a human subject ("I measured", "the run recorded") or state the state
directly ("429 responses passed through unchanged").

**2j. Uppercase adjudication tags.** CONFIRMED / REQUEST-CHANGES / REJECT / BLOCKER / RED / GREEN /
PASS / FAIL / UNVERIFIED used as verdict stamps. AI 15/32 (57 hits, 1.11/1k); PG 0/15. This is the
English equivalent of the Korean catalog's `SUPPORTED/REFUTED/수용` judgment labels.

- claude-01: "VERDICT: REQUEST-CHANGES"
- docs-27: "CONFIRMED." (11 occurrences in one document)
- docs-26: "**UNVERIFIED claim:**"
- glm-23: "RED tests for A: delay formula, shouldDrawEdge transitions"

Fix: keep in review/report register, delete everywhere else. Uppercase stamps are the fastest
register giveaway when the text is reused as prose.

### 3. Closings

| closing move | AI | PG | example | fix |
|---|---|---|---|---|
| Thesis echo (opening verdict repeated last) | 5/32 | 0/15 | claude-02 opens with the verdict and ends "VERDICT: REQUEST-CHANGES" | keep one of the two |
| Recap box | 4/32 | 0/15 | gpt-17 and gpt-18: "### Two-sentence summary" | delete |
| Next-steps / required-fixes checklist | 6/32 in the tail (9 hits) | 0/15 | claude-00: "## Smallest next step"; glm-21: "Let me update todos and start the next batch." | separate document |
| "Honest limits" self-label | 4/32 (9 hits) | 0/15 | claude-00: "## What I could not verify"; docs-27: "## Open questions for the reporter" | delete the label, keep the limits as sentences |
| Sentinel / handoff token | 2/32 | 0/15 | claude-00 ends with an uppercase completion token | strip |
| Closing offer | 0/32 | 1/15 | pg-ace: "happy to tell you the most important ones" | n/a (see note) |
| Ends on a question | 0/32 | 0/15 | — | n/a |
| One-line landing | 3/32 | 4/15 | pg-yahoo: "Losing, for example."; pg-ace: "That's how they became billionaires." | see §3g |

**3g. One-line landings are shared but not the same move.** Both groups end short sometimes (AI 3/32,
PG 4/15), and the median last sentence is 20 words for AI vs 18 for PG. The difference is kind:
PG's landings are jokes or flat facts ("Losing, for example.", "And they, incidentally, are busted."),
while the AI short endings are next-action declarations ("Firing the plan + next batch.",
"That's read-only and decisive."). An aphorism-shaped landing is the AI-shaped one.

**3h. The closing offer is absent here, and that is a corpus artifact.** The Korean catalog lists
"원하면 ~해 줄게" as a frequent Claude/Kimi closer; in this English corpus the count is 0/32, because
the source system prompt forbids permission-begging and announcement language. Expect the move to
reappear in English chat prose written under a different prompt, so keep the rule but weight it low.

### 4. Rhythm and surface

Medians over samples; range in parentheses where it matters.

| metric | claude | kimi | gpt | glm | docs | PG |
|---|---|---|---|---|---|---|
| sentence mean words | 23.2 | 16.4 | 13.3 | 13.7 | 20.8 | 17.0 |
| sentence length CV | 0.55 | 0.64 | **0.20** | 0.54 | 0.47 | 0.54 |
| one-line paragraph ratio | 0.46 | 0.24 | 0.51 | 0.33 | 0.41 | **0.13** |
| bullets /1k | 8.3 | 5.0 | 38.1 | 11.4 | 14.3 | **0.0** |
| em dash /1k | 18.0 | 20.8 | **0.0** | 21.6 | 6.3 | 1.0 |
| arrow (`->`, `→`) /1k | 3.4 | 11.2 | 0.0 | 5.3 | 0.1 | **0.0** |
| bold label-colon /1k | 2.5 | 0.0 | 0.0 | 0.4 | 2.4 | **0.0** |
| contractions /1k | 7.5 | 16.7 | **1.3** | 16.3 | 6.4 | **28.7** |
| "I" /1k | 2.2 | 5.5 | 2.1 | 11.3 | 0.0 | 13.0 |
| "you" /1k | 0.0 | 0.0 | 0.0 | 0.0 | 0.0 | **19.0** |
| questions /1k | 0.0 | 3.5 | 0.0 | 1.8 | 0.0 | 2.5 |
| hedges /1k | 0.0 | 0.7 | 0.0 | 1.7 | 0.0 | **2.8** |

Notes that matter for thresholds:

- **Sentence-length uniformity is not a global AI tell in English.** AI median CV 0.54 = PG median
  CV 0.54 (PG range 0.44-0.62). Only gpt is flat (median 0.20, family range 0.19-0.44);
  claude/kimi/glm are as varied as PG. Use CV only as a per-model signal.
- **Paragraph-initial connectives are weak here.** However/Moreover/That said/Ultimately at
  paragraph start: AI median 0.00/1k (max 2.39), PG median 0.00/1k (max 0.61). Real but rare; keep
  as a low-weight signal, not a headline one.
- **One-line paragraphs** separate cleanly: AI median 0.38 of paragraphs (max 0.87) vs PG 0.13
  (max 0.27). PG's one-liners carry a reversal; the AI ones carry a bolded proposition plus a dash.
- **Contraction deficit** is the single most robust surface difference: every PG essay is >= 14.35/1k;
  22 of 32 AI samples are below that floor.
- **Second person** is effectively absent from AI prose (median 0.00, max 2.48) and pervasive in PG
  (median 18.95, min 3.38). Essay-register English that never says "you" is suspicious.

---

## 3. Per-model tendencies

**claude (7 samples).** Report register with a verdict skeleton. Opens with a label or a status
line (4/7 status frame, 3/7 bolded verdict), runs `## BLOCKERS` / `## CONCERNS (non-blocking)` /
`## Verification of author claims`, closes by repeating the verdict (3/7). Uses `**Fix:**` label
colons (2.5/1k, highest with docs) and uppercase tags (6/7 samples, 19 hits). Owns its limits
explicitly — the only family with "## What I could not verify" and inline `[unverified]` (4 hits in
one sample). Longest sentences of any family (23.2 median). One sample ends with an uppercase completion
token.

**kimi (7).** Deliberation register: the message thinks aloud and ends mid-plan. Highest arrow
chains (11.2/1k) and questions (3.5/1k) — but these are self-questions inside reasoning
("Two options: (a) … or (b) …"), not rhetorical. Highest case-parade density (4/7 samples, 38 hits)
and the most numbered "1. **label**:" lists. Closes on next actions ("Let me check quickly, then
make the three edits") or on a one-liner. One sample ends with a leaked thinking-channel marker.

**gpt (6).** The most machine-legible family. 6/6 open with "Here is my plan: …",
6/6 build the body from rule-of-three triads (81 hits — 76% of all AI triads, though 79 of those sit
in the four checklist samples), 2/6 close with a literal "### Two-sentence summary" box. Zero em
dashes, near-zero contractions (1.3/1k), zero questions, zero arrows, flattest sentence CV (0.20),
highest bullet density (38.1/1k). If a text has no dashes but perfect triads and a summary box, it
is this family.

**glm (6).** Narration register with an in-character preamble, then bolded batch results
("Batch 1 results: **A — …: DONE.**"). Highest "I" density (11.3/1k) and em dashes (21.6/1k),
frequent language switching mid-paragraph, personified logs ("logs show …", 4 hits in one
sample). Closes on the next step, never on a conclusion.

**docs (6 agent-written documents).** The heaviest skeletons: 83 headings across 6 files, 5/6 open
with a scope/date/status block, and one file repeats a four-label template across every section.
First person is absent from 5 of 6, lowest contraction rate after gpt, uppercase tags in 4/6. All 6 end in
trailing analysis — no summary, no landing — because they are sections of a larger artifact.

---

## 4. PG-baseline moves the linter must not flag

These are frequent in the human control. Flagging them would punish good English prose.

1. **Anecdote opening** — 9/15. "A couple years ago my friend Trevor and I went"; "When I went to
   work for Yahoo after they bought our startup"; "I'm not a very good speaker. I say "um" a lot."
2. **Enumeration announcement** — 11/15, 0.60/1k, *more* than AI. "There are two senses in which
   writing can be good"; "There are only two things you need initially".
3. **Negated redefinition and "not just X but Y"** — 11/15 and 13/15. This is a PG signature move,
   not an AI tell, in English.
4. **Negative-scene narration** — 10/15. "There is no boss to trick, only users".
5. **Two-lane framing** — 6/15. "On the other hand, history is even fuller of examples".
6. **Self-question answered immediately** — median 3 per essay, max 16; AI median 0. "How bad could
   it be? Well, food shows that pretty clearly."; "Figure out what? You don't know yet."
7. **Hedged but personal claims** — 2.81/1k vs AI 0.00. "My guess is that it doesn't matter".
8. **Direct address** — "you" 18.95/1k. An essay that never addresses the reader is the anomaly.
9. **Humor / deflating remark as a landing** — "Losing, for example."; "And they, incidentally, are
   busted."; "That's how they became billionaires."
10. **Digression with a self-aware cut** — pg-laundry ends mid-thought: "[That was as far as I'd
    gotten at the time.]" No AI sample abandons its own structure.
11. **Provenance line and stated aim** — "This essay is derived from a talk at …", "my hope is that
    this essay will …": 9/15 PG essays, 0/61 agent samples (§7). In English the sentence that talks
    about the essay itself is a human move. Do not cut it as a meta sentence.

---

## 5. Regex-able signals for a lexical linter

Ordered by discriminating power in this corpus (AI hits / PG hits).

| # | signal | regex sketch | AI | PG |
|---|---|---|---|---|
| 1 | thesis-first label at the top of the text | `(?im)\A(?:.{0,80}\n)?\s*(?:#{1,4}\s*\|\*\*)?(TL;?DR\|Bottom line\|Short answer\|Verdict\|Executive summary\|One-line summary\|The short version)\b` | 2/32 | 0/15 |
| 2 | uppercase verdict stamp | `\b(?:VERDICT\|REQUEST[ _-]?CHANGES\|CONFIRMED\|REJECTED?\|SUSTAINED\|BLOCKER\|UNVERIFIED\|PASS\|FAIL)\b` | 57 hits, 15/32 | 0 |
| 3 | bold-label bullet parade | `(?m)^\s*(?:[-*]\|\d+\.)\s+\*\*[^*\n]{2,70}\*\*\s*[—:–-]` | 49 hits, 9/32 | 0 |
| 4 | repeated bold label >= 3x in one text | count identical `^\*\*([A-Z][^*]{1,48})\*\*` | max 6 | max 0 |
| 5 | scope/method preamble | `(?im)^\s*(?:\*\*)?(As-of date\|Date\|Status\|Scope\|Method(?:ology)?\|Evidence(?: base)?\|Sources?\|Verified\|Mode\|Target\|Position\|Reviewed\|Repos inspected)\s*(?:\*\*)?\s*:` | 11 hits, 7/32 | 0 |
| 6 | plan-announcement opener | `\A\s*\W{0,3}Here is my plan\b` | 7/32 | 0 |
| 7 | status framing opener | `(?i)\A\s*\W{0,3}(All evidence (?:is in\|gathered)\|Report follows\|Confirmed definitively\|Done\.)` | 8/32 | 0 |
| 8 | recap box heading | `(?im)^\s*(?:#{1,4}\s*\|\*\*)?(Two-sentence summary\|In summary\|To summarize\|Summary\|Net-net\|In short\|Takeaways?)\b` | 4/32 | 0 |
| 9 | honest-limits self-label | `(?im)^\s*(?:#{1,4}\s*\|\*\*)?(What I (?:could not\|couldn't\|did not\|didn't) verify\|Limitations?\|Caveats?\|Remaining risks?\|Open questions?\|Unverified)\b\|\[unverified\]` | 9 hits, 4/32 | 0 |
| 10 | personified evidence | `(?i)\b(?:the )?(?:data\|evidence\|logs?\|capture\|results?\|tests?\|metrics?\|profile\|trace\|numbers)\s+(?:shows?\|says?\|tells?\|proves?\|confirms?\|suggests?\|reveals?)\b` | 10 hits, 4/32 | 0 |
| 11 | triad density | `\b([a-z]{3,}),\s+([a-z]{3,}),\s+and\s+([a-z]{3,})\b` per 1k | 2.09 (0.60 excl. gpt) | 0.21 |
| 12 | arrow chain | `(?:->\|→\|=>)` per 1k | 2.37 median, max 19.1 | 0.00 |
| 13 | em dash rate | `—` per 1k | 12.2 median | 1.03 |
| 14 | contraction floor (inverse signal) | `\b\w+'(?:s\|t\|re\|ve\|ll\|d\|m)\b` per 1k | 8.5 median | 28.7 (min 14.35) |
| 15 | second-person floor (inverse signal) | `\byou\b` per 1k | 0.00 median | 18.95 (min 3.38) |
| 16 | line-initial ordinal march | `(?im)^\s*(?:\*\*)?(First\|Second\|Third\|Fourth\|Fifth)(?:ly)?\b[,:.\s]` | 6 hits, 4/32 | 0 |
| 17 | heading density (register-gated) | `(?m)^#{1,4}\s` per 1k | 2.40 | 0.00 |

Signals 1-10 are near-zero-false-positive against the PG control. 11-17 need thresholds, and 13/17
need a register gate (see limitations). Deliberately **not** on this list: "not X but Y",
"there is no …", "on the other hand", "There are N …" — all inverted (§4).

---

## 6. Limitations

1. **Register mismatch is the main confound.** The AI corpus is technical reports, review verdicts
   and agent narration; PG is the personal essay. Bullets, headings, code citations, arrow chains
   and uppercase stamps partly reflect *document type*, not authorship. Signals 3, 5, 12, 17 must be
   gated on markdown/report register or they will fire on any human-written engineering doc. The
   register-independent signals are 1, 2, 6, 7, 8, 9, 10, 11, 14, 15.
2. **No human English control in the report register.** A human-written PR review would settle how
   much of §2j and §2c is authorship rather than genre. This is the largest missing piece.
3. **Prompt contamination.** Plan-announcement openers and the trailing sentinel token are
   imposed by the source prompt; another deployment of the same models would not produce
   them. They are listed because the linter's inputs come from that prompt, not because they
   generalize.
4. **Family imbalance and prompt clustering.** glm contributed no >= 800-word final answers, so its
   six samples are mid-turn narration; four of six gpt samples answer near-identical
   "60 numbered considerations" streaming-protocol prompts, which inflates the gpt triad and bullet
   counts (79 of 81 gpt triads come from those four). Two glm samples share one session, and
   claude-01/02/03 are sibling reviewer subagents dispatched in the same batch — which is exactly
   why their skeletons match, so §2d's cross-document evidence should be read as "one prompt, three
   runs" rather than three independent confirmations. Per-model numbers are directional, not
   calibrated.
5. **PG is one author.** "Human baseline" here means one essayist with a strong, idiosyncratic
   style (heavy contractions, heavy "you", heavy negated redefinition). A second human control
   (technical bloggers) would likely lower the contraction and "you" floors.
6. **Counts are regex approximations.** Every count in this file comes from the detectors listed in
   §5 run over the local scratch corpus; per-sample results are in
   `arc-classification.jsonl`. Spot-checked by reading, but precision was not measured formally —
   the triad and negative-scene detectors in particular include literal technical uses.
7. **Excluded material.** Documents about private business matters were filtered out of the
   AI document family, as were documents containing personal data; this removes the most
   argumentative long-form AI prose available locally and biases the docs family toward engineering
   findings.

---

## 7. Redundancy: saying it again

The Korean catalog has the matching section (`references/ko/discourse-tells.md` §8): a long post can
pass the linter with zero high hits and no metric over threshold and still read as padded, because
one claim is restated in every section, one metaphor recurs throughout, several lists carry the same
items, and the piece ends twice. The sentence layer is clean; the length is not. SKILL.md §1 (skeleton before writing:
one-sentence claim, section ledger, one ending, repetition budget) and §5 (subtraction pass against
the ledger) are the language-neutral fix. This section records what the English corpus says about
where redundancy lives in English, so §5 counts the right things.

**Corpus.** 61 assistant messages of >= 800 English words (Latin >= 90%, code fences / inline code /
URLs stripped) from the 958 most recently modified local session files (claude 23, kimi 36, glm 2;
no gpt long-form in that window), 85,938 words, against the same 15 PG essays as sample B (43,813 words
as fetched, page notes included). Stats only; no source text kept.

| signal | AI /1k (docs) | PG /1k (docs) | reading |
|---|---|---|---|
| back-reference: "as noted/mentioned/discussed above", "as I said" | 0.00 (0/61) | 0.00 (0/15) | absent on both sides |
| forward-reference: "see below", "more on this below", "we'll come back to this" | 0.00 (0/61) | 0.00 (0/15) | absent on both sides |
| "returning to", "back to" | 0.01 (1/61) | 0.02 (1/15) | noise |
| "recall that", "as a reminder" | 0.00 | 0.00 | absent |
| sentence-initial "Again,", "once again/more" | 0.03 (3/61, all kimi deliberation: "let me reconsider … once more") | 0.05 (2/15) | not a tell |
| "to recap / reiterate / sum up", "put differently", "in summary" (inline) | 0.00 (0/61) | 0.02 (1/15) | absent in AI |
| "the same point/pattern again", "this is the same thing" | 0.00 | 0.00 | absent |
| "in other words" | 0.00 (0/61) | 0.05 (2/15) | human-leaning (already excluded from the lexical catalog) |
| "this essay/article/report is/will/covers" | 0.00 (0/61) | 0.21 (9/15) | **human move** (provenance line, stated aim) |
| "to be clear/fair/precise", "for completeness/the record" | 0.01 (1/61) | 0.07 (3/15) | human-leaning |
| "before we/I dive/start", "here's what I found", "I'll skip the" | 0.01-0.02 | 0.00-0.02 | noise |
| near-duplicate sentence share (token Jaccard >= 0.5 over 8+-word sentences) | median 0.000, p75 0.026 | median 0.005, p75 0.018 | no separation |
| sentences carrying >= 2 hedge tokens | median 0.000 | median 0.004 | human-leaning (PG hedges more, sample B: 2.81/1k vs 0) |

Three consequences for the English subtraction pass:

1. **Explicit signposts are not where English redundancy shows.** Agent English under the source system
   prompts almost never writes "as noted above" or "to recap", and neither does PG. When one appears
   in a draft it still marks a restatement worth cutting one side of, but its absence proves nothing.
2. **English restatement is paraphrase, not near-duplication.** The Jaccard detector finds no
   difference between the groups; a padded post's restatements would also score ~0
   on it. Count restatements by hand against the §1 ledger, or with `rg -c` on the claim's two nouns.
3. **Redundancy in English lives in structure, already measured by sample B (§1 table):** thesis echo
   (verdict repeated at top and bottom) 5/32 vs 0/15; recap box 4/32 vs 0; repeated section skeleton
   14/32 vs 0 (the same label set per section means the same content shape per section); symmetric
   case parade 9/32 vs 0 (items that say one thing in one form); "What I could not verify" label
   4/32 vs 0 (caveats already inline, collected again); next-steps checklist 6/32 in the tail
   (the findings restated as actions). These are the five things SKILL.md §5 counts first in an
   English draft. Keep one verdict (top for reports, bottom for essays), one list per set of items,
   caveats inline once, and no action list inside an analysis.

**Do not cut in English:** the essay's provenance line and stated aim ("this essay …", 9/15 PG),
"in other words", "on the other hand", single hedges, self-questions. These are the human side of
the corpus.
