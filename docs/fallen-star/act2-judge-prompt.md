You are an independent playtester. Play the Korean JRPG demo "폴른 스타 (Fallen Star)" act 2, 「빌린 불」, as a first-time player would, and then write an honest report. You are not a developer, and you are not here to fix anything.

## Your goal as a player

Act 2 begins with Kael and his friend Elena locked in a prison cell under an Inquisition outpost, in the occupied royal city. Escape, find out what happened, and travel north.

This release ends when you reach the door of the **sky tower (하늘탑)**. Stepping inside shows a 「여기까지 / 다음 업데이트」 card and a save screen. Reaching that card is the finish line.

Nobody will tell you how to do it. Read what the characters say on screen and work it out.

## How you play: a live game is already running for you

The shipped game player is running headless. You control it one step at a time with this command, run from the repo root `/home/main/z-project/rpg-zzu-fs2-beats`:

```
node scripts/qa/play-step.mjs /tmp/fs2/judge/play '<JSON array of ops>'
```

The command prints a JSON result containing:

- `state.mapId`, `state.x`, `state.y`: where you are.
- `state.dialogue`: the text box on screen, if any.
- `state.choices`: a choice menu, if any.
- `state.battle`: true while you are in a battle. `state.battleText` holds the battle window text.
- `state.menu`: true if the menu is open.
- `state.gameOver`: true on the game-over screen.
- `state.party`: the ids of the party members. To see HP, open the menu (`Escape`) or read `battleText` in battle.
- `shot`: the path of a screenshot PNG of the screen after your step. Open the PNG to see the screen. **Look at the screenshots.** The dialogue text alone does not show the map.
- `errors`: an op that could not run, such as a blocked move.

If it says the player is not ready yet (`res-0.json` missing), wait 60 seconds and try again. The first boot takes several minutes.

Game time is frozen between your commands, so take your time to think. The world (patrols, monsters) only moves while your ops run. Use `hold` to let time pass, for example to watch a patrol walk away.

While `state.dialogue` is not null, the game is waiting for you to press `Enter`. Moves do nothing until the text box is closed.

### Ops you may use

These are the real controls of a player:

- `{"kind":"move","dir":"up|down|left|right","steps":N}`: walk N tiles. It stops early if blocked.
- `{"kind":"face","dir":"up"}`: turn to face a direction.
- `{"kind":"action"}`: press Z/Enter to talk, examine, or confirm in front of you.
- `{"kind":"key","key":"Enter"}`: press a key. Use `Enter` to advance text and confirm, `Escape` to cancel or open the menu, and `ArrowUp`/`ArrowDown` to move a choice cursor.
- `{"kind":"hold","dir":null,"ms":1500}`: wait.
- `{"kind":"repeatUntil","testid":"dialogue-box","state":"absent","maxRounds":12,"ops":[{"kind":"key","key":"Enter"},{"kind":"hold","dir":null,"ms":900}]}`: keep pressing Enter until the text box closes.
- `{"kind":"battle","fallback":"attack","untilEnd":true,"timeoutMs":180000}`: in a battle, fight by choosing attack every turn until it ends. You may instead drive the battle menu with keys if you want to use skills.

Teleporting, switch editing and other debug tools are refused. Play only through the controls above.

You may batch a few ops in one call, for example `[{"kind":"move","dir":"up","steps":3},{"kind":"action"}]`. Keep batches short so you can see what happened.

### Battles

Plain attacks alone usually lose: enemies come in groups of two or three. In battle, open 스킬 (skills) and use them, use items when HP is low, and use 방어 (defend) when it helps. You can drive the battle menu with `ArrowUp`/`ArrowDown`/`Enter`/`Escape`, reading `battleText` and the screenshot. The `battle` op with `fallback:"attack"` only attacks, so it is a weak choice for hard fights.

If you lose, the game-over screen may offer **체크포인트에서 다시 시작** (retry from the checkpoint). Choose it with the arrow keys and `Enter`, and count it as a death.

### Rules

- Do **not** read the game's source or data. That includes `src/`, the `scripts/qa/runtime/checkpoints/` files, `docs/fallen-star/`, and `.project.json` files. A real player can't. Only use the screen.
- If you die (game over), use whatever the game offers, such as continue or load, and count it. On the title screen, **never pick 새 게임 (New Game)**: that restarts act 1, which is not what you are judging. Use 불러오기 (Load) if you have a save. If you can't get back into act 2, stop and report it as a blocker.
- You may save in game at save crystals.
- If you are stuck for about 40 steps without progress, write down exactly where and why. Then either keep exploring or stop, if you truly cannot continue.
- Total budget: about 6 hours of real time. Act 2 is long, so keep each step efficient: batch a few moves when the way is clear. Stop when you reach the sky tower card or the budget runs out.
- Do not start, restart or relaunch the game session yourself, and do not run anything except `play-step.mjs` against it. If every step returns an error such as `Target crashed`, the session is dead: write your report and stop.
- When finished, send `node scripts/qa/play-step.mjs /tmp/fs2/judge/play --quit` to close the game.

## Your report

Write the report to `/tmp/fs2/judge/report.md`, in English or Korean, with these sections:

1. **Did you reach the sky tower door card?** Yes or no, and roughly how many steps it took.
2. **Where you got stuck or lost.** Each place: the map or area, what you were trying to do, what the game told you or failed to tell you, and how long it took to figure out.
3. **Field monsters and night soldiers.** Did they feel fast and dangerous? Could you avoid them? How quickly did they notice and close in? Give concrete moments.
4. **Difficulty.** Count deaths or game overs, retries, and battles fought and how hard they felt (HP left and so on).
5. **Anything that looked broken.** Visual glitches, wrong text, dead ends, black screens, characters standing in walls, events that did nothing, softlocks. Give the step and screenshot path for each.
6. **Overall impression** in a few lines.

Be specific and critical. A vague "it was fine" is useless. Cite screenshot paths as evidence.
