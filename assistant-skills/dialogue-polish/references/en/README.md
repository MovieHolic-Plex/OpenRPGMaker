# Writing in English

The evidence behind this page is 8.2 million words of coding-agent English against 231 Paul Graham essays, measured for the linter (`lexical-tells.md`, `discourse-tells.md` and `human-baseline.md` in this folder). The moves below are what the human side does and the agent side does not, turned around into instructions. Follow them while drafting and the gate confirms.

## The five families that bounce drafts

No closing offer. "Want me to", "say the word", "if you want, I can", "let me know if" are not endings. End on the last fact.

No label on the conclusion and no echo of it. In a report, state the conclusion once at the top without "TL;DR", "Bottom line" or "Net:", and do not repeat it word for word at the bottom. The echo appears in 5 of 32 agent samples and 0 of 15 essays.

No agent narration. "Let me check", "now I'm", "verified", "confirmed", "as expected", "root cause" become what was run and what came out: the command, the number, the log line.

No em dash. A comma, a period, or two sentences. Agent prose uses em dashes at seven times the human rate, and it is the single most visible tell on the page.

Plain words for the thing. "surface" as a verb becomes "show"; "nuanced" becomes the specific word; "key insight" becomes the insight; "actionable", "robust", "comprehensive", "holistic", "navigate", "unlock", "align with", "delve", "tapestry", "landscape", "journey" become the plain word or nothing. "Worth noting", "note that", "crucially", "notably", "here is a breakdown" are frames: delete the frame and keep the content. "X rather than Y" becomes X unless you are correcting a fact; agent prose uses the construction at 5.6 times the human rate.

## What people do that models do not, so do these

Open on an anecdote or the event, not on a thesis, a scope block, or a status line. Nine of fifteen essays in the sample open on an anecdote.

Use "you". Use contractions. Every Graham essay has fourteen or more contractions per thousand words; twenty-two of thirty-two long agent samples fall below that.

Ask yourself a question and answer it in the next sentence. Do not throw the question at the reader.

Hedge personal claims. "I suspect", "I think", "probably" are human signals at 2.8 per thousand words against zero. Keep them.

Announce an analogy ("think of it as", "it's like a", "by X I mean") and let it go after one callback. The model's version is the unannounced stock vehicle: flywheel, safety net, rabbit hole, treadmill, plumbing, north star, guardrails.

Use freely: "not X but Y", "not just", "not only", "there is no", "on the other hand", "two things", "there are three", "ultimately", "arguably", "imagine", "in other words", "leverage", "in practice", "let's". All sit at or above the human rate. The Korean negation rule does not port to English.

Land short. A flat fact or a joke ("Losing, for example.").

## Structure padding to leave out

One label set repeated in every section (Context, Problem, Fix, Risk, section after section): 14 of 32 agent samples, 0 essays. Open one section with an example, one with a single question, one with a single event.

A symmetric case parade: three cases in one grammatical shape, then a unifying sentence. Tell one long, the rest in a sentence each, and drop the unifying line.

A recap box ("### Two-sentence summary", "In summary") after a body that already concluded.

A "What I could not verify" list collecting caveats that already sit inline. Keep each caveat beside its number, once.

Uppercase stamps (VERDICT, BLOCKER, CONFIRMED), colon labels ("Fix:"), arrow chains (A, then B, then C as arrows): write them as sentences.

Bullets only where the register row allows and only for five or more items. Four or fewer is a comma list.

## Rhythm

Vary sentence length. GPT long-form has a coefficient of variation near 0.20 and reads flat. Put a few-word sentence in most paragraphs and let one sentence run long on "and", "but", "so". Do not open three paragraphs in a row with the same word.

## Modality and register

Keep hedges at the strength you believe. In a report, a legal or medical text, or a message to a counterparty, never flatten "might" to "is". Do not stack them ("may possibly"). "Use", not "utilize".

## Per model, what to watch in your own draft

Claude: em dashes, "rather than", "genuinely", "worth noting", a verdict that opens and closes the piece. GPT: colon labels, bullets, triads, "### Two-sentence summary", "if needed", "one last", "the bottom line". Kimi: arrow chains, "let me check", "per the", closing on the next action. GLM: "the logs show", a preamble in character, closing on the next step.
