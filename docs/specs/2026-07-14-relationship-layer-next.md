# Relationship Layer Next (abstract plan)

**Status:** plan draft — not approved for implementation  
**Date:** 2026-07-14  
**Depends on:** `docs/specs/2026-07-14-character-id-relationship-gate.md` (shipped)  
**Product frame:** event-based RPG editor, not a life-sim genre clone.

## 0. What we already have (baseline)

| Slot | Today |
|---|---|
| Identity | opt-in `GameEvent.characterId` + pure `resolveSocialKey` |
| Scalar bond | `session.friendship[key]` 0..1000 |
| Preference table | event-local `giftPrefs` / `giftResponses` |
| Rate limit | `session.dailyGifts[key] → dayKey` |
| Gate | `friendshipAtLeast`, self hard-gate when no characterId |
| Channels | gift interaction (+ explicit `changeFriendship` command) |
| Presentation | almost none (numbers exist only in session / conditions) |
| Activity | **event-scoped** (`npcActivities[eventId]`) — frozen law |

**Non-goals forever-ish (unless a full character-runtime epic):**
- character-scoped schedule/activity merge
- soft `characterId ?? event.id` dual namespace
- marriage / cohabitation / full life-sim sim

---

## 1. Planning principle

Expand **engine abstract slots**, not genre features.

Order by: **play-loop visibility → interaction density → authoring leverage → cross-system edges → optional identity package**.

Each phase must:
1. keep `resolveSocialKey` as the only social map key
2. keep activity event-local
3. hard-gate self social ops without characterId
4. ship tests + openwiki in the same change
5. avoid dual-read migration hacks

---

## 2. Phased plan

### Phase A — Presentation (observe the scalar)

**Why first:** without observation, bond is invisible author state.

**Scope**
- Pure helpers (no new session fields):
  - `friendshipTier(value, max=1000, tiers=10) → 0..tiers`
  - optional label table (empty / acquaintance / friend / …) — data or constants, not DB table yet
- Play feedback:
  - after successful gift (and later talk): short UI line or toast with tier/Δ (reuse dialogue or juice hook)
- Status menu (minimal):
  - optional “관계” list of known social keys with tier bars — **only keys present in `session.friendship`**
  - no full character registry required

**Out of scope**
- new project schema
- forced characterId on all NPCs

**Acceptance**
- `friendshipTier_bounds` (0, mid, max)
- gift success path surfaces non-empty feedback in unit or scene-test hook
- status list empty when no friendship keys; shows key after gift

**Touch (expected)**
- `src/project/friendship.ts` or `socialKey.ts` adjacent pure helpers
- `playSceneGift.ts` / dialogue feedback
- `playerStatusMenu*` (one new command or detail section)
- `openwiki/runtime-and-data.md`

**Risk:** status menu scope creep → keep “list of keys with bars” only.

---

### Phase B — Second interaction channel (talk / generic social act)

**Why:** one channel (gift) is too thin for a relationship loop.

**Abstract model**
```
SocialChannel = {
  id: "gift" | "talk" | ...
  resolveKey: resolveSocialKey
  cooldownBucket: session.dailySocial[key][channel] → dayKey   // or parallel dailyTalks
  delta: number | from table
  gate: giftSystem-like feature flag OR always-on when characterId
}
```

**Minimal concrete pick (recommended)**
- Channel `talk`:
  - action menu already has talk; on first page run or explicit command `socialTalk` / hook after text dismiss
  - small fixed Δ (e.g. +10) once per day per social key
  - session: `dailyTalks?: Record<string, string>` **or** generalize to `dailySocial?: Record<string, Partial<Record<channel, string>>>`
- Prefer **generalized `dailySocial`** if we expect a third channel soon; else `dailyTalks` is smaller.

**Authoring**
- optional event flag `talkFriendship?: boolean | { delta?: number }` default off → opt-in like gifts
- or system flag `relationshipTalk === true` + characterId required

**Acceptance**
- talk once → bond increases; second talk same day → no increase
- no characterId → no talk bond write
- gift and talk cooldowns independent
- save/load preserves cooldown map

**Touch**
- `session` types + saveSlots
- play action path (`playSceneInterpreter` / dialogue)
- tests parallel to gift tests
- openwiki

**Risk:** double-firing talk on every text line → define “one social talk per action interaction” precisely.

---

### Phase C — Temporal modifiers (calendar hooks)

**Why:** `GameTime` already exists; cheap content hooks.

**Scope (pick one first)**
1. **Birthday / calendar tag on identity (event-local first)**  
   - `GameEvent.socialCalendar?: { birthday?: { season; day } }`  
   - gift Δ multiplier on matching day (e.g. ×2 loved)
2. **Decay (optional later)**  
   - on day roll: unused keys lose small amount — easy to hate; keep off by default

**Law**
- calendar data may later move to profile package (Phase E); event-local is OK for C
- multiplier uses same social key as gifts

**Acceptance**
- gift on birthday day applies multiplier; other days normal
- no gameTime → no birthday bonus (or documented no-time policy)

**Risk:** inventing full festival system — do not.

---

### Phase D — Discrete milestones (threshold edges)

**Why:** continuous scalar needs story beats.

**Two implementation styles**

| Style | How | Cost |
|---|---|---|
| D0 Authoring pattern only | document: page conditions at 100/400/800 + self-switch once | docs/tool templates |
| D1 Engine assist | `onFriendshipCross { thresholds[], setSwitch / runCommonEvent }` or one-shot flags in session | schema + runtime |

**Recommended path**
- **D0 first** (tool/template + openwiki recipe): zero schema risk
- **D1 only if** authors repeatedly reimplement poorly

**D1 sketch (if needed)**
- session `friendshipMilestones?: Record<key, number[]>` crossed thresholds
- after `changeFriendship`, if crossed N and not recorded → fire once

**Acceptance (D0)**
- fixture demo: tier page unlocks at 80 (already farmer demo-like)
- wiki recipe for “once per threshold”

**Acceptance (D1)**
- crossing 100 fires once; reload does not re-fire; lowering then re-crossing policy documented

**Risk:** silent common-event storms → require explicit author list of thresholds.

---

### Phase E — Cross-system bridges (edges, not new social core)

**Why:** bond should unlock gameplay, not only dialogue.

**Bridge menu (choose by product need, not all at once)**

1. **Shop price modifier** — `friendshipAtLeast` already gates pages; optional stock price curve by bond tier  
2. **Quest / story flags** — recipe: threshold → setSwitch (D0)  
3. **Party / follower unlock** — page or command gated by bond  
4. **Inn / service discount** — same as shop  

**Engine work only when repeated**
- e.g. `resolveShopPrice(project, session, item, merchantEvent)` reads social key + tier table

**Acceptance**
- one vertical slice demo (shop discount OR follower unlock) with scene test

**Risk:** hardcoding genre economy — keep tables data-driven on event or system.

---

### Phase F — Identity package (optional data ownership move)

**Only when** multi-map copies + divergent giftPrefs lint noise becomes painful.

**Shape (sketch)**
```
project.characters?: {
  [characterId]: {
    displayName?: string
    birthday?: { season; day }
    defaultGiftPrefs?: GiftPrefs
    defaultGiftResponses?: GiftResponses
  }
}
```
- events keep `characterId` + placement/schedule/pages
- prefs: profile defaults **overridden** by event-local if present (document precedence)
- editor: light picker, not a second RM database monolith on day one

**Migration**
- no forced extraction; tool “extract profile from event” optional

**Kill if**
- becomes character-scoped schedule Trojan horse

---

## 3. Suggested delivery order (milestones)

```
A (presentation)     ~ small PR, pure + UI
    ↓
B (talk channel)     ~ medium, session field + play path
    ↓
D0 (milestone recipe) ~ docs + optional make_villager template
    ↓
C (birthday mult)    ~ small schema on event
    ↓
E (one bridge slice) ~ shop or follower
    ↓
F (profile package)  ~ only if needed
D1                   ~ only if D0 fails authors
```

Do **not** parallel A+B+C in one PR. A alone is shippable value.

---

## 4. Frozen product laws (carry forward)

1. `resolveSocialKey`: explicit npcKey → characterId → null (never event.id)  
2. Activity remains event-scoped  
3. UI gate secondary to runtime hard-gate  
4. Gifts and any new channel share the same social key space  
5. Rate limits are per (socialKey × channel × dayBucket)  
6. No character DB required for A–E  

---

## 5. Open decisions (need user pick before coding)

| ID | Decision | Options | Default if silent |
|---|---|---|---|
| O1 | Talk channel storage | `dailyTalks` vs generalized `dailySocial` | `dailyTalks` (smaller) |
| O2 | Talk opt-in | event flag vs system flag vs always with characterId | event flag / gift-like opt-in |
| O3 | Status menu | new command “관계” vs bury under quest/system | new command only if giftSystem or any friendship keys |
| O4 | Birthday home | event field vs wait for Phase F profile | event field |
| O5 | First bridge | shop discount vs follower unlock vs none yet | none until A+B ship |

---

## 6. Explicit defer list

- Romance meters / jealousy multi-NPC matrix  
- Character-scoped pathfinding schedule merge  
- Mailbox / parcel systems  
- Full relationship graph (NPC↔NPC)  
- Auto-merge giftPrefs across events  

---

## 7. Success metric (editor product)

After A+B+D0, an author can:
1. set `characterId` on an NPC  
2. enable gift + talk  
3. see bond change in UI  
4. unlock a page at a threshold  
without writing custom session hacks or dual keys.

That is the definition of “relationship layer is real” for this editor — not feature parity with any commercial life-sim.
