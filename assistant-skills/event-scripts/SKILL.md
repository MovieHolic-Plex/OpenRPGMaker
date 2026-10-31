---
name: event-scripts
description: Write event logic as one sandboxed TypeScript `script` command (game API) instead of long command lists — when to choose a script (and when not), the API, the rules, the one-call author_script with explain + examples, batching, and worked examples (lever puzzle, discount shop with a library module, time-of-day guard). Use for combination locks, order puzzles, price formulas, counters, timers, time/inventory checks, random outcomes.
---

# Event scripts (TypeScript)

An event page can hold a `script` command: TypeScript that drives the game through one object, `game`.
It runs in a sandbox (no DOM, network, storage, timers or Node), next to ordinary event commands — a page
can mix both. Awaited calls (messages, choices, waits, battles, transfers, `game.cmd`) run as real event
commands, so pausing, saving and staging behave exactly like hand-built pages.

Source: `assistant-skills/event-scripts/SKILL.md`. Design and limits: `openwiki/script-sandbox.md`.

## When to choose a script — decide once

Events (ordinary commands) carry dialogue, movement, cutscenes and simple switch flips. Use ONE script only
when the logic has any of:

- conditions that combine (`A and (B or C)`), comparisons, or more than 2–3 branches;
- math: prices, discounts, damage, scores, counters, ranges;
- loops, retries or timers: "pull levers until the order is right", "ask again", "the gate closes after 10 s";
- puzzle rules and multi-stage state read from variables;
- reactions to time of day, inventory, party members or random chance (`game.random(n)`).

Keep plain commands for plain dialogue, a single condition page, a cutscene (use the cutscene tools), shops and
inns that need no formula. Do not wrap a 3-line conversation in a script. The script is one line in the event
list: the talk before and after it can stay ordinary text commands.

**Decide once per event and keep it.** Never write a script and then replace it with commands (or commands with a
script) unless the user asks. Never convert existing command pages to scripts on your own — existing events stay
as they are. If a script misbehaves, fix the script with `edit_script`.
Only when the user asks to turn a script back into commands: `write_script_as_commands{target, name | commandPath, confirm:true}`
(it refuses, changing nothing, when the script is not exactly expressible as commands — then keep the script).

## One call: author_script with explain + examples

```
author_script{
  mapId, eventId, pageIndex?            // or commonEventId
  source, name,
  explain: ["1-4 short sentences in the user's language, for someone who cannot read code"],
  examples: [                           // success path + one failure path (2-4 items)
    { label: "맞는 순서", choices: [2, 0, 3, 1] },
    { label: "틀린 순서", choices: [2, 1] },
  ]
}
```

- It compiles first. On an error nothing changes and the result lists `L<line>:<col> error: …` — fix exactly
  those lines and call again. Warnings (unknown id, missing `await`) do not block; an unknown id is usually a typo,
  or a new switch/variable that the script creates.
- Then it inserts the command, stores `explain` + `examples` on it (the event card shows them) and runs every
  example on a copy of the project. Each result (`examples[i]`) has the `transcript` (what the player sees),
  `changes` (switches, variables, gold, items) and `errors` / `ok:false` when something broke.
- **When the example results match the request, the script is done.** Do not call `check_script` or
  `dry_run_script` to re-test what the examples already showed.
- Example fields: `label` + answers `choices` (0-based, -1 = cancel) / `numbers` / `battleResults`, and presets
  `switches:[{id,value}]` / `variables:[{id,value}]` / `gold` / `items:[{id,count}]` / `hour` / `minute`.
- **Several similar scripts in one call:** `author_script{scripts:[{mapId,eventId,source,name,explain,examples}, …]}`
  (4 levers, 3 statues, every guard). Each item is written or rejected on its own; resend only the failed items.
- Change a script: `edit_script{target, name | commandPath, source, explain?, examples?}`. It re-runs the given
  examples, or the stored ones when you omit them. Pass `explain` again when the behaviour changed (otherwise the
  card marks the old explanation as describing old code).
- Helpers several events share (a price formula, a puzzle check) go in a library module:
  `upsert_script_module{id, source}`, imported as `import { fn } from "@lib/<id>"`. `list_script_modules` shows them.
- Ids are the project's own string ids (`"sw_vault_open"`, `"var_reputation"`, `"item_potion"`, event ids).
  `get_script_api{mapId}` prints the full `.d.ts` with this project's ids as literal types — call it only when you
  are unsure of an id; the API itself is listed below.
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

## Example 1 — four-lever combination lock (order check and reset)

One panel event. The player pulls levers through a choice window; a wrong lever resets everything and counts a failure.
The open state lives in a switch, so the vault stays open after a save.

```ts
const ORDER = [2, 0, 3, 1]; // correct order: lever 3, 1, 4, 2 (put the clue somewhere in the room)
const LEVERS = ["Lever 1", "Lever 2", "Lever 3", "Lever 4"];
if (game.getSwitch("sw_vault_open")) {
  await game.showMessage("The levers are locked in place.");
} else {
  const pulled: number[] = [];
  while (pulled.length < ORDER.length) {
    const pick = await game.showChoices([...LEVERS, "Step away"], { prompt: `Pulled ${pulled.length}/4`, cancel: 4 });
    if (pick === 4) break;
    if (pulled.includes(pick)) { await game.showMessage("That lever is already down."); continue; }
    pulled.push(pick);
    if (pick !== ORDER[pulled.length - 1]) {
      await game.shake(4, 20);
      await game.showMessage("Clunk. Every lever snaps back up.");
      game.addVar("var_lever_fails", 1);
      break;
    }
  }
  if (pulled.length === ORDER.length && pulled.every((lever, i) => lever === ORDER[i])) {
    game.setSwitch("sw_vault_open", true);
    await game.showMessage("A deep rumble. The vault door slides open.");
  }
}
```

Write it with both paths as examples — one call:
`author_script{mapId, eventId:"ev_panel", name:"levers", source, explain:["레버 넷을 3·1·4·2 순서로 당기면 금고가 열린다.", "틀리면 모두 원위치되고 실패 횟수가 1 늘어난다."], examples:[{label:"맞는 순서", choices:[2,0,3,1]}, {label:"틀린 순서", choices:[2,1]}]}`
→ example 1: `changes.switches.sw_vault_open` false → true; example 2: shake, reset message, `var_lever_fails` +1, switch unchanged.
The vault door page uses the switch as its condition (an ordinary page condition — no script needed there).

## Example 2 — shop with a reputation discount (library module)

`upsert_script_module{id:"pricing", source}`:

```ts
/** Price after the reputation discount: 1% per point, at most 30%. */
export function discounted(base: number, reputation: number): number {
  const rate = Math.min(30, Math.max(0, reputation)) / 100;
  return Math.max(1, Math.round(base * (1 - rate)));
}
```

The merchant's script (`author_script`):

```ts
import { discounted } from "@lib/pricing";
const price = discounted(120, game.getVar("var_reputation"));
const pick = await game.showChoices([`Buy a potion (${price} G)`, "No thanks"], { cancel: 1 });
if (pick === 0) {
  if (game.gold() < price) {
    await game.showMessage("You don't have enough gold.", { speaker: "Merchant" });
  } else {
    game.addGold(-price);
    game.addItem("item_potion");
    await game.showMessage(`Pleasure doing business. That's ${price} G.`, { speaker: "Merchant" });
  }
}
```

Examples in the same `author_script` call: `{label:"평판 25", choices:[0], variables:[{id:"var_reputation", value:25}], gold:100}`
→ price 90, gold 100 → 10, item +1; `{label:"돈 부족", choices:[0], gold:50}` → the "not enough gold" line.
Other merchants import the same `discounted` (several merchants = one `author_script{scripts:[…]}`).
For a full buy/sell menu keep the shop command: `await game.cmd({ kind: "shop", itemIds: ["item_potion"], allowSell: true })`.

## Example 3 — gate guard who reacts to the time of day

```ts
const clock = game.time();
const hasPass = game.hasItem("item_night_pass");
if (clock.phase === "night" && !hasPass) {
  await game.showMessage("The gate is shut until morning.", { speaker: "Guard" });
  await game.moveEvent("player", ["down"]);
} else if (clock.phase === "night") {
  await game.showMessage("A night pass. Go ahead, quietly.", { speaker: "Guard" });
} else if (clock.phase === "evening") {
  await game.showMessage("Closing soon. Make it quick.", { speaker: "Guard" });
} else {
  await game.showMessage("Welcome to town.", { speaker: "Guard" });
}
```

`game.time().enabled` is false when the project has no time system (then the phase is "day"); turn it on with
`configure_time_system` first. Examples set the clock with `hour`/`minute`: `{label:"밤 22시", hour:22}`,
`{label:"밤 22시, 통행증", hour:22, items:[{id:"item_night_pass", count:1}]}`, `{label:"낮", hour:12}`.
For an exact rule ("20:00 to 06:00") compare `clock.hour` instead of `phase`.

## Reading existing pages as code

`read_event_as_script{mapId, eventId, pageIndex}` prints a page as TypeScript: text → `showMessage`, choices →
`showChoices` + `if`, forks on switches / variables / items / gold / self switches → `if`, switch / variable / gold /
item changes, waits, transfers, battles and common events become direct calls; everything else is
`await game.cmd({…exact JSON…})`. The output compiles as is, so it is a safe starting point for
`write_event_as_script`. Keep what must stay; the write replaces the whole page.
