# Final compiled Emerald player QA — 2026-10-04

Result: completed. Native runtime application/resource errors: 0. Actual compiled player at `http://127.0.0.1:18581/player.html`.

Inspect first:
- `battle/03-real-trainer-portraits.png` — actual new hero back/rival front, native introduction.
- `battle/06-wild-levelup-victory.png` — EXP100%, Lv5→6, full monster images above result.
- `opening/intro-2.png` — actual new professor, atmosphere and creature, readable continuous opening.

## Opening timeout diagnosis

The old probe sends Enter immediately after the `title-screen` node appears, while its authored sequence is still `data-seq-state=playing`; that Enter is consumed before menu activation. At1.6s the node is `seq-state=done`, a second native Enter starts the opening. This explains the old probe's 90s cinematic wait with pages0/errors0. A corrected probe should wait `data-seq-state=done` before its first menu Enter. No product/source change was made.

All8 opening pages completed with native Enter. Held Enter advanced one page. WASD did not advance the first page. The same professor DOM and BGM element persisted across every page; music kept increasing and was not paused. Actual professor64×96 and starter64×64 images decoded. On completion: home map at10,10, cinematic music removed. `opening/native.json` contains per-page evidence.

## Trainer portraits and victory

Lab's original rival trainer introduction displayed the new rival and hero back: both natural64×96, displayed128×192; role=rival; actual first text 「나루가 승부를 걸어왔다!」. Hero occupied logical y48..240 and rival y18..210. Native monster groups hidden only during this beat. 「가라, 숯비늘!」 hid the pair and restored native battlers.

Two native fights used the original troops and commands. Trainer: Coalbit EXP190→220, reward30 exactly once, gauge35.7143%, level5. Wild: explicit near-level seed EXP264→284, reward20 exactly once, level5→6, gauge100%, level-up markertrue. Reserve Spriglet EXP121 unchanged in both. Held Enter and subsequent confirmation returned to field; delayed reread matched the rewarded party, with no duplicate payout.

Compact victory panel height116px for trainer,150px for level-up; stage480×320. Actor back logical bounds7.59..140.07 and enemy6.75..139.23; result top192/158. Both monster images are fully above the result panel. EXP bars4px; KO death badges displaynone. No image/result intersection or outside-stage result geometry.

## Preparation and limits

Shipping player.js, project.json, and CSS were served unchanged. HTML route added ONLY `qaInstrumentation:true` to the existing BOOT namespace, enabling observation hooks; no BOOT project URL replacement, source aliases, project route, style injection, source or canonical store edits. Fresh opening used no session injection. Battles used a private context with the genuine predecessor Continue slot copied byte-for-byte, then replayed the naturally earned Coalbit/Spriglet party, explicit debug teleport and original native scene.playBattle admission. Wild case deliberately seeded Coalbit EXP264 atlevel5 to cover threshold274. Enemy HP/moves/result/rewards were not changed. This validates the shown professor/rival/hero and native result behavior; other NPC roles were not individually battled.

Commands:
```
node /tmp/oprn-emerald-art-v2-20261004/final-agent-qa/opening-final.probe.mjs
node /tmp/oprn-emerald-art-v2-20261004/final-agent-qa/battle-final.probe.mjs
```

No gates, Vitest, source edits, canonical writes, or shared-service restart. Both probes exit0. Project SHA256: `6871c8dd6ec27ede4682c6b89cdce7b35e3ec64c13931ba91f93cc5c6bde4972`.
