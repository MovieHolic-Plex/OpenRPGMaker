# Character ID Relationship Gate (revised)

**Status:** design approved for implementation with nits absorbed (2026-07-14 re-review)  
**Date:** 2026-07-14  
**Supersedes:** informal “gate friendship+activity on characterId” sketch (rejected)

**Adversarial re-review (round 2):**
- Architect: **WATCH** / REQUEST CHANGES on contracts (now absorbed in §3.1–3.2, stamp recursion, gifts)
- Critic: **APPROVE_WITH_NITS** — prior REJECT items closed; residual nits non-blocking

## 1. Product law (frozen)

1. **Placement stays RM-style:** any map may host any number of events. Simultaneous presence on two maps = two events (allowed).
2. **Schedule stays event-owned:** one schedule body moves one event across maps. Activity is **event-scoped** forever in this epic.
3. **Relationship is opt-in identity:** optional `GameEvent.characterId?: string` (trim; empty = unset).
4. **Social features that require `characterId`:**
   - page condition `friendshipAtLeast` (self / empty npcKey path)
   - commands `changeFriendship` / `getFriendship` when `npcKey` is empty (self)
   - gifts (`giftSystem` path, `dailyGifts`, friendship deltas from gifts)
   - editor UI sections for the above
5. **NOT gated on `characterId`:**
   - `npcActivity` conditions (still `session.npcActivities[eventId]`)
   - schedules, self-switches, variables, switches, time/season conditions
6. **Single social key resolver — no dual namespace:**

```ts
// Pure law — no characterId ?? event.id for social maps
function resolveSocialKey(
  event: { id: string; characterId?: string },
  explicitNpcKey?: string,
): string | null {
  const explicit = explicitNpcKey?.trim();
  if (explicit) return explicit; // author override string into friendship map
  const id = event.characterId?.trim();
  return id || null; // NEVER fall back to event.id
}
```

7. **Runtime hard gate:** if `resolveSocialKey(event, empty) === null`:
   - `changeFriendship` / `getFriendship` (self) → no-op / write 0, no `event.id` write
   - `friendshipAtLeast` with empty npcKey → **false**
   - gifts → not giftable / fail closed (no `dailyGifts[event.id]`)
8. **UI gate is secondary:** hide/disable friendship+gift affordances when `!characterId`; runtime still enforces (7).
9. **Shared person:** two events with the **same** `characterId` share one friendship + one daily-gift slot. Gift prefs remain event-local for this epic; if prefs differ, editor **warns** (lint), does not auto-merge.
10. **Dual scheduled bodies** with the same `characterId` are **unsupported authoring** (lint warning). Product does not merge activity.

## 2. Explicit non-goals (this epic)

- Character DB table / registry UI
- Character-scoped schedule or activity maps
- Forcing every NPC to have `characterId`
- Soft fallback `characterId ?? event.id` in social maps
- Gating `npcActivity` UI on `characterId`

## 3. Migration / legacy (pick is frozen: stamp)

**Choice: one-shot project stamp + session remap (not silent dual-read).**

On **project migrate / deserialize** (primary; editor open may call the same helper):

1. For each event, **recursively** scan social surfaces:
   - `giftPrefs` / `giftResponses`
   - page `conditions` and legacy root `event.condition` if present
   - all page/root `commands` trees (fork/choices/loop/shop transaction branches, cancel branches)
   - markers: `friendshipAtLeast`, `changeFriendship`, `getFriendship`
2. If any social surface exists and `characterId` is missing → set `characterId = event.id`.
3. **Idempotent:** never overwrite a non-empty existing `characterId`.
4. Save slots: after stamp, keys that were `event.id` still match `characterId` (no dual-read). Free-text `npcKey` keys that differ from event.id are **not** rewritten.
5. New blank events stay **without** `characterId` until author or `make_villager` sets one.

### 3.1 Self-resolution cutover (required for implementers)

Runtime sites that today only have `eventId: string` must not pass bare id into social maps.

| Site | Contract |
|---|---|
| Map interpreter self friendship | Resolve hosting `GameEvent` via `currentEventId` (map + common-event call stack), then `resolveSocialKey(event, command.npcKey)` |
| `evalCondition` / pageResolution | Pass event (or `{id, characterId}`) into friendship branch; never `friendship[eventId]` as self |
| Gifts | `isGiftableEvent` requires `resolveSocialKey(event) != null`; `giveGiftToNpc` / `playSceneGift` / `dailyGifts` use that key only |
| Battle | **No map event context.** Empty `npcKey` stays fail-closed (0 / no-op / false). Explicit non-empty `npcKey` writes that string. Do not invent a phantom current event |

### 3.2 Battle path

Empty npcKey in battle = fail-closed (matches today’s no-op). Test `battle_parity_empty_npcKey` means **parity of fail-closed / no event.id write**, not inventing map-event self-key in battle.

## 4. make_villager / tools

- `make_villager`: **always** set `characterId` (`args.characterId?.trim() || slug(name) || genId("char_")`).
- Collision: if slug exists on another event, append suffix or genId; **warn** in tool result.
- `place_npc`: today has no giftPrefs schema — **do not invent giftPrefs on place_npc** in this epic. If giftPrefs is added later, require/auto `characterId` then.
- Tool catalog + openwiki update in same change when tool signatures change.

## 5. Editor UX

- Event props: `characterId` text field (optional).
- Page conditions: **호감도** row only if `characterId` set; **활동** row always (unchanged availability).
- Gift-related chrome only if `characterId` set (and giftSystem).
- Friendship command palette entries still insertable; form shows “requires characterId” if missing (runtime no-op).
- Lint (warn-only): same `characterId` on multiple events with divergent `giftPrefs`/`giftResponses`, or more than one scheduled body.

## 6. Acceptance tests (required names)

1. `resolveSocialKey_null_without_characterId`
2. `resolveSocialKey_uses_characterId_not_eventId`
3. `shared_characterId_shared_friendship`
4. `gift_daily_and_friendship_same_key`
5. `gift_without_characterId_not_giftable`
6. `friendshipAtLeast_false_without_characterId` (even if `session.friendship[event.id]` is high)
7. `explicit_npcKey_override`
8. `activity_remains_event_scoped` (same characterId, two events, independent activities)
9. `make_villager_writes_characterId`
10. `legacy_stamp_characterId_equals_event_id_for_social_events`
11. `battle_parity_empty_npcKey` (fail-closed; no event.id write; explicit npcKey still works)
12. `ui_gate_hides_friendship_without_characterId`
13. `save_load_character_keys`
14. `npcActivity_still_works_without_characterId`

## 7. Kill criteria (abandon or redesign)

- Any PR that reintroduces `characterId ?? event.id` for friendship/gifts
- Gifts and friendship on different key spaces
- UI-only gate without runtime null-key enforcement
- Pulling activity into character-scoped maps without a full character-body epic
- Migration that cannot disambiguate intentional free-text npcKey from event.id (then: manual re-key only, or kill auto-stamp for that class)
- Adapter-layer dual-key at string-only call sites (bare eventId into social maps)

## 8. Ordered implementation (after approval only)

1. Freeze `resolveSocialKey` + pure unit tests (replace `friendshipKey` event.id fallback)
2. `GameEvent.characterId` shape/persist
3. Runtime cutover per §3.1 (session, friendship gifts, playSceneGift, isGiftableEvent, pageResolution, interpreter; battle fail-closed)
4. Legacy stamp migrator (recursive social surface, idempotent) + fixture updates
5. Editor UI gate + characterId field + warn lint (shared characterId + divergent prefs / dual schedules)
6. make_villager always writes characterId
7. openwiki runtime-and-data + editor-workflows (+ tool catalog if generated)
8. Named acceptance tests only (rewrite event.id self-fallback expectations)

## 9. File touch list (expected)

- `src/project/types/events.ts`
- `src/project/session.ts` (`friendshipKey` → resolver)
- `src/project/friendship.ts`, `src/player/playSceneGift.ts`
- `src/project/io/pageResolution.ts`, shape/validate
- `src/player/interpreter/...`, `src/battle/battleEvents.ts`
- `src/editor/panels/eventEditor/pageConditions.ts`, event props
- `src/editor/tools/eventTools.ts` (make_villager)
- `openwiki/runtime-and-data.md`, `openwiki/editor-workflows.md`
- `test/*` named cases above; update `friendshipGiftsShop` / schedule demo fixtures via stamp rules

## 10. What this is not

Not a full character system. It is **opt-in relationship identity** on events so multi-map copies can share friendship/gifts without treating every prop event as a social NPC, without lying about activity, and without dual key namespaces.
