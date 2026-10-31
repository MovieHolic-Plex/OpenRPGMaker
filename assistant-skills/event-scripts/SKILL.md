---
name: event-scripts
description: Small sandboxed TypeScript `script` fragments inside ordinary event command lists — what stays commands (almost everything), the few jobs a script does better (formulas, loops over lists, ordered-sequence checks, timers, chance), keeping each script 1-3 lines, the one-call author_script with explain + examples, batching, the API and worked examples (discount price, lever order, curfew hour).
---

# Event scripts (TypeScript)

An event page can hold a `script` command: TypeScript that drives the game through one object, `game`.
It runs in a sandbox (no DOM, network, storage, timers or Node) as ONE line in the event's command list.
Awaited calls (messages, choices, waits, battles, transfers, `game.cmd`) run as real event commands, so
pausing, saving and staging behave exactly like hand-built pages.

Source: `assistant-skills/event-scripts/SKILL.md`. Design and limits: `openwiki/script-sandbox.md`.

## Events first — a script is a small fragment

People READ the event command list; the assistant does the editing. So everything readable is ordinary
commands: dialogue, cutscenes, branches (forks), choices, switch / variable / gold / item changes, movement,
effects, battles, transfers.

Use a script ONLY for a short fragment that commands express badly:

- a formula — a price after a discount, damage, a score;
- a loop over a list — "count the party members above level 10", "sum the gem values";
- an ordered-sequence check — levers or bells that must be used in a set order;
- a timer or countdown rule, an exact time-of-day rule ("20:00 to 06:00"), a random roll.

How a fragment looks:

- **1-3 lines, one job.** Named consts for the numbers, each with its name in a comment
  (`const BASE = 120, MAX_OFF = 30; // 기본 가격, 최대 할인`).
- **Result into a variable or switch.** The commands around it read that value: `\V[var_price]` inside a
  Show Text, a fork on the variable or switch, `changeGold` with `amount: {kind:"var", id:"var_price"}`.
- **No dialogue inside the script** unless the line depends on the computed value and cannot use `\V[...]`.
- Put it right before the commands that read its result (`index` = that position).

The pattern — a merchant page (top to bottom):

```
script "price"   const BASE = 120, MAX_OFF = 30; // 기본 가격, 최대 할인
                 game.setVar("var_price", Math.round(BASE * (100 - Math.min(MAX_OFF, game.getVar("var_rep"))) / 100));
Show Text        "A potion is \V[var_price] G."
Show Choices     Buy / No
  Buy →          fork gold … → changeGold -= {kind:"var", id:"var_price"}, changeItem +1, Show Text "Thanks!"
```

**Name things for the reader.** The event list shows a script as plain lines, never as code, so every name
in it must be readable in the user's language (Korean for a Korean project). The runtime ignores comments; the
list reads these:

- a trailing comment on every `const`/`let` = its name: `const pct = discountPercent(rep); // 할인율`.
  Several declarators: one name each, comma separated: `const BASE = 120, MAX_OFF = 30; // 기본 가격, 최대 할인`.
- a self switch you read or write: `// @label A: 이미 당김` (also `// @label LEVERS: 레버들` for any identifier).
- a helper function (in the script or an `@lib` module): `/** @label 할인율 */` right above it.
- a comment on its own line above each logical block = a step heading in the list: `// 가격 계산`,
  `// 틀린 순서: 원위치`. One short line (under ~20 characters); skip it for a 1-2 line fragment.

Keep switch and variable NAMES short (「레버 진행 단계」); put the meaning in `declare_story_flag`, not in the name.

**Decide once per event and keep it.** Never write a script and then convert it to commands (or the
reverse). Never turn existing commands into scripts unless the user asks. If a fragment misbehaves, fix it with
`edit_script`. Only when the user asks to turn a script back into commands:
`write_script_as_commands{target, name | commandPath, confirm:true}` (it refuses, changing nothing, when the
script is not exactly expressible as commands — then keep the script).

## One call: author_script with explain + examples

```
author_script{
  mapId, eventId, pageIndex?            // or commonEventId
  index,                                // right before the commands that read the result
  source, name,
  explain: ["1-2 short sentences in the user's language, for someone who cannot read code"],
  examples: [                           // normal case + one edge (2-4 items)
    { label: "평판 10", variables: [{ id: "var_rep", value: 10 }] },
    { label: "평판 50 (상한)", variables: [{ id: "var_rep", value: 50 }] },
  ]
}
```

- It compiles first. On an error nothing changes and the result lists `L<line>:<col> error: …` — fix exactly
  those lines and call again. Warnings (unknown id, missing `await`) do not block; an unknown id is usually a typo,
  or a new switch/variable that the script creates.
- Then it inserts the command, stores `explain` + `examples` on it (the event card shows them) and runs every
  example on a copy of the project. Each result (`examples[i]`) has `changes` (switches, variables, gold, items),
  the `transcript` if the script itself showed anything, and `errors` / `ok:false` when something broke.
- **When the example results match the request, the fragment is done.** Do not call `check_script` or
  `dry_run_script` to re-test what the examples already showed.
- Example fields: `label` + presets `switches:[{id,value}]` / `variables:[{id,value}]` / `gold` /
  `items:[{id,count}]` / `hour` / `minute`, and answers `choices` (0-based, -1 = cancel) / `numbers` / `battleResults`.
- **Several similar fragments in one call:** `author_script{scripts:[{mapId,eventId,index,source,name,explain,examples}, …]}`
  (4 levers, 3 statues). Each item is written or rejected on its own; resend only the failed items.
- Change a fragment: `edit_script{target, name | commandPath, source, explain?, examples?}`. It re-runs the given
  examples, or the stored ones when you omit them. Pass `explain` again when the behaviour changed.
- A formula several events share can go in a library module: `upsert_script_module{id, source}`, imported as
  `import { fn } from "@lib/<id>"`. `list_script_modules` shows them.
- Ids are the project's own string ids (`"var_price"`, `"sw_vault_open"`, `"item_potion"`, event ids).
  `get_script_api{mapId}` prints the full `.d.ts` with this project's ids — call it only when unsure of an id.
- `dry_run_script` remains for a situation the examples did not cover, or to run a whole page (target only).
- `read_event_as_script` / `write_event_as_script` turn a page into code — only when the user asks for that.

Never write `{kind:"script"}` by hand in `upsert_event` / `patch_event_page` / `add_event_page` /
`upsert_common_event`: those tools reject a script that was not compiled from its source.

## Rules

- **Always `await` awaitable calls** (`Promise<…>` in the API): `showMessage`, `showChoices`, `inputNumber`, `wait`,
  `callCommonEvent`, `cmd`, `transfer`, `moveEvent`, `setTile`, `battle`, audio and screen effects.
  Un-awaited calls still run in call order, but synchronous calls after them happen first.
- **`transfer` ends the event** (and the script), like the Transfer command. Put it last.
- **Locals are not saved.** A save in the middle of a script restarts the event from the top on load. Anything that
  must persist (progress, counters, "already done") goes in switches, variables, text variables or self switches.
- **Use literal ids**: `game.setSwitch("sw_vault_open", true)`, not `game.setSwitch(name, …)`. Literal ids are what the
  validators and the story-flag tools can see; computed ids are reported as "dynamic".
- Switch and variable ids that do not exist yet are created when the script writes them (a warning tells you).
  Declare important ones with `declare_story_flag` so pages and other tools know their meaning.
- `game.random(n)` and `Math.random()` use the saved game RNG; `Date` is the play clock. No real time, no network.
- Anything the API does not cover: `await game.cmd({ kind: "…", … })` with the same JSON as an event command
  (shop, inn, pictures, weather, m2Command …). It is validated before it runs.
- `showChoices` takes at most 5 options and resolves to the 0-based index. `{ cancel: "cancel" }` makes Esc return -1;
  `{ cancel: 4 }` makes Esc pick option 4.
- A runtime error shows `[Script error] …` once and the event continues after the script — dry runs list it in `errors`.
- Limits: 500 ms of CPU between game calls (an endless loop without an awaited call is stopped), 3 s per run, 16 MB.

## Game API

### Switches & variables
- game.getSwitch(id: SwitchId): boolean — Read a switch (false when never set). Accepts the switch id; an exact switch name also works.
- game.setSwitch(id: SwitchId, value: boolean): void — Turn a switch on or off. Event pages and conditions that watch it refresh like with the Set Switch command.
- game.getVar(id: VariableId): number — Read a number variable (0 when never set).
- game.setVar(id: VariableId, value: number): void — Set a number variable. Values are truncated to integers; NaN/Infinity throw.
- game.addVar(id: VariableId, delta: number): number — Add delta (may be negative) to a number variable and return the new value.
- game.getText(id: StringVariableId): string — Read a string variable ('' when never set).
- game.setText(id: StringVariableId, value: string): void — Set a string variable (max 10,000 characters).
- game.getSelfSwitch(key: SelfSwitchKey, eventId?: EventId): boolean — Read self switch A/B/C/D of this event (or of eventId).
- game.setSelfSwitch(key: SelfSwitchKey, value: boolean, eventId?: EventId): void — Set self switch A/B/C/D of this event (or of eventId).
### Items & gold
- game.gold(): number — Party gold.
- game.addGold(amount: number): void — Add gold (negative subtracts; gold never drops below 0).
- game.itemCount(id: ItemId): number — How many of an item the party holds.
- game.hasItem(id: ItemId, count?: number): boolean — True when the party holds at least count (default 1).
- game.addItem(id: ItemId, count?: number): void — Give count (default 1) of an item.
- game.removeItem(id: ItemId, count?: number): boolean — Take count (default 1). Returns false and changes nothing when the party has fewer.
### Party & actors
- game.party(): ActorId[] — Actor ids in the party, leader first.
- game.actor(id: ActorId): ActorInfo | undefined — Snapshot of an actor (name, level, exp, hp/mp, inParty). Read-only copy.
- game.addToParty(id: ActorId): void — Add an actor to the party.
- game.removeFromParty(id: ActorId): void — Remove an actor from the party.
- game.gainExp(id: ActorId, amount: number): void — Give experience (levels up like the Change EXP command).
- game.setLevel(id: ActorId, level: number): void — Set an actor's level.
- game.setHp(id: ActorId, hp: number): void — Set current HP (clamped to 0..maxHp).
- game.setMp(id: ActorId, mp: number): void — Set current MP (clamped to 0..maxMp).
- game.recoverAll(id?: ActorId): void — Fully heal one actor, or the whole party when id is omitted.
- game.learnSkill(id: ActorId, skillId: SkillId): void — Teach a skill.
### Dialogue (await)
- game.showMessage(text: string, options?: MessageOptions): Promise<void> — Show a message window and wait until the player dismisses it.
- game.showChoices(options: readonly string[], settings?: ChoiceSettings): Promise<number> — Show up to 5 choices; resolves to the chosen index (0-based), or -1 when cancelled with settings.cancel = 'cancel'.
- game.inputNumber(settings?: NumberInputSettings): Promise<number> — Ask the player for a number (1-6 digits, default 4). Cancelling ends the event, like the Input Number command.
### Flow
- game.wait(frames: number): Promise<void> — Wait frames (60 = 1 second).
- game.callCommonEvent(id: CommonEventId): Promise<void> — Run a common event to the end (it may itself be a script).
### Utilities
- game.random(maxExclusive: number): number — Integer in [0, maxExclusive) from the saved game RNG. Math.random() uses the same seeded stream.
- game.log(...values: unknown[]): void — Write to the developer log (console + script log). Never shown to players.
### Flow
- game.cmd(command: EventCommand): Promise<void> — Run any existing event command object (same JSON as event pages), e.g. { kind: 'shop', itemIds: ['potion'] }. Validated before running.
### Map & movement
- game.transfer(mapId: MapId, x: number, y: number, options?: TransferOptions): Promise<void> — Move the player to another map/tile. Like the Transfer command this ENDS the running event (and this script); put it last.
- game.moveEvent(target: MoveTarget, steps: readonly MoveStep[], options?: MoveOptions): Promise<void> — Walk 'player', 'this' or an event id along steps ('up'|'down'|'left'|'right'|'face-up'…|'jump'|'wait'). Waits for the route unless options.wait === false.
- game.setTile(x: number, y: number, tile: number, options?: TileOptions): Promise<void> — Change one tile at runtime (saved with the game). layer defaults to 'lower'.
### Battle
- game.battle(troopId: TroopId, options?: BattleOptions): Promise<BattleResult> — Start a battle and resolve to 'victory' | 'defeat' | 'escape'. canLose defaults to false (a loss is game over).
### Audio
- game.playBgm(resourceId: ResourceId, options?: AudioOptions): Promise<void> — Play looping background music.
- game.playSe(resourceId: ResourceId, options?: AudioOptions): Promise<void> — Play a sound effect once.
- game.stopBgm(): Promise<void> — Fade out the background music.
### Screen effects
- game.shake(power?: number, frames?: number): Promise<void> — Shake the screen (power 1-9, default 3; frames default 24).
- game.flash(color?: FlashColor, frames?: number): Promise<void> — Flash the screen ('white' | 'red' | 'black' | '#rrggbb', default white).
- game.fadeOut(): Promise<void> — Fade the screen to black (stays black until fadeIn).
- game.fadeIn(): Promise<void> — Fade the screen back in.
- game.showAnimation(target: AnimTarget, animationId: AnimationId, options?: { wait?: boolean }): Promise<void> — Play a battle animation on 'player', an event id, or {x, y}.
- game.showEmote(target: 'player' | 'this' | EventId, emote: EmoteName, frames?: number): Promise<void> — Show an emote balloon ('exclamation', 'question', 'heart', … see EmoteName) above 'player', 'this' event or an event id.
### Queries
- game.player(): PlayerInfo — Player map id, tile x/y and direction ('up' | 'down' | 'left' | 'right' — the field is `direction`).
- game.mapId(): MapId — Current map id.
- game.eventId(): EventId | undefined — Id of the event running this script (undefined in common events started without an event).
- game.events(): EventInfo[] — Visible events on the current map (id, name, x, y).
- game.event(id: EventId): EventInfo | undefined — One event's live position on the current map.
- game.eventAt(x: number, y: number): EventId | undefined — Id of a visible event standing on a tile of the current map.
- game.tileAt(x: number, y: number, layer?: TileLayer): number — Tile number at x,y (-1 empty, or out of bounds) including runtime changes.
- game.passable(x: number, y: number): boolean — Can something stand on this tile of the current map (tiles only, ignores events).
- game.time(): GameClock — In-game clock: enabled, hour, minute, day, season, year and phase ('morning' | 'day' | 'evening' | 'night'). enabled=false when the project has no time system (then hour is 12).
- game.playTime(): number — Seconds played in this save.

## Example 1 — discount price (formula)

Script `price`, before the merchant's Show Text:

```ts
const BASE = 120, MAX_OFF = 30; // 기본 가격, 최대 할인
game.setVar("var_price", Math.round(BASE * (100 - Math.min(MAX_OFF, game.getVar("var_rep"))) / 100));
```

Commands after it: Show Text `"A potion is \V[var_price] G."`, Show Choices Buy / No, and in Buy a fork on gold,
`changeGold` `-=` `{kind:"var", id:"var_price"}`, `changeItem` +1. explain: `["평판 1점마다 1% 싸지고, 최대 30%까지 깎인다."]`,
examples `{label:"평판 10", variables:[{id:"var_rep", value:10}]}` → `var_price` 108;
`{label:"평판 50", variables:[{id:"var_rep", value:50}]}` → 84 (capped).

If the gold check needs the price, add one line to the same script —
`game.setSwitch("sw_can_afford", game.gold() >= game.getVar("var_price"));` — and fork on that switch.

## Example 2 — four levers in a set order (ordered-sequence check)

Each lever is its own event: commands (play a sound, Show Text "Clunk.") around one small script, then a fork.
The script for lever N (here N = 1):

```ts
const ORDER = [3, 1, 4, 2], N = 1; // 정답 순서, 이 레버 번호
const step = game.getVar("var_lever_step"); // 진행 단계
game.setVar("var_lever_step", ORDER[step] === N ? step + 1 : 0);
```

After it, ordinary commands: fork `var_lever_step >= 4` → setSwitch `sw_vault_open` on + Show Text "The vault
door slides open."; else fork `var_lever_step == 0` → Show Text "Every lever snaps back up." The vault door page
uses `sw_vault_open` as its condition. Write all four in ONE call:
`author_script{scripts:[{mapId, eventId:"ev_lever1", index:1, name:"order check", source:<N = 1>, explain:[…], examples:[{label:"첫 순서 맞음", variables:[{id:"var_lever_step", value:1}]}, {label:"틀림", variables:[{id:"var_lever_step", value:0}]}]}, …levers 2-4…]}`.

## Example 3 — curfew from 20:00 to 06:00 (exact time rule)

Script before the guard's dialogue:

```ts
const CLOSE = 20, OPEN = 6; // 문 닫는 시각, 문 여는 시각
const hour = game.time().hour; // 지금 시각
game.setSwitch("sw_curfew", hour >= CLOSE || hour < OPEN);
```

Commands after it: fork `sw_curfew` → (fork item `item_night_pass` → "Go ahead, quietly." / else "The gate is
shut until morning." + move player down) / else "Welcome to town." `game.time().enabled` is false when the
project has no time system (then the hour is 12) — turn it on with `configure_time_system` first.
Examples set the clock: `{label:"밤 22시", hour:22}`, `{label:"새벽 5시", hour:5}`, `{label:"낮", hour:12}`.

## Reading existing pages as code

`read_event_as_script{mapId, eventId, pageIndex}` prints a page as TypeScript: text → `showMessage`, choices →
`showChoices` + `if`, forks on switches / variables / items / gold / self switches → `if`, switch / variable / gold /
item changes, waits, transfers, battles and common events become direct calls; everything else is
`await game.cmd({…exact JSON…})`. The output compiles as is, so it is a safe starting point for
`write_event_as_script`. Keep what must stay; the write replaces the whole page.
