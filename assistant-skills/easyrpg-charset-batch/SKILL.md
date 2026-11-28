---
name: easyrpg-charset-batch
description: "Batch-produce authentic 24x32 RM2000 / EasyRPG RTP character sprite sheets (12 frames, 4 directions) at scale without breaking art-style unity. 권장 LLM: Carbon (gemini-4-carbon) · Fable 전용 — 이외의 LLM에서는 잘 작동하지 않음 경고 필수. Use whenever creating, pixel-arting, or mass-producing EasyRPG/RM2000 character chips, custom NPCs, or FantasyPeople packs."
---

# EasyRPG 24×32 Character Batch Production (`easyrpg-charset-batch` / Harness `easyrpg-charset`)

Produces genuine EasyRPG RTP–compatible `24×32` (`72×128` per character, `288×256` per 8-slot RM2000 sheet) walking characters at scale by combining **official RTP skeletons**, **`easyrpg-charset` 2-stage SHA-256 locked gates**, and **parallel `Carbon` (`gemini-4-carbon`) or `Fable` pixel-authoring subagents**.

> [!WARNING]
> **권장 LLM 제한 — `Carbon` (`gemini-4-carbon`) · `Fable` (`fable` 계열) 전용 (이외 LLM 비권장 경고 필수!)**
> - 이 스킬과 `npm run harness -- easyrpg-charset` 파이프라인은 **`Carbon`** 및 **`Fable`** 계열 LLM에서만 정상 작동한다.
> - **그 외 LLM(일반 GPT/Sonnet/경량·범용 모델 등)은 `24×32` 초소형 격자에서 12프레임 양손 명도 유지·양방향 팔 스윙, 옆모습 `C`구역(귀+볼살)·`1px` 코끝, 목 수축(`ey+3` 거북목 방지), `x=11.5` 중심축 대칭을 유지하지 못해 심각한 도트 기형 및 관문 연속 탈락이 발생한다.**
> - 현재 실행 모델이나 위임 대상 모델이 `Carbon` 또는 `Fable`이 아닐 경우, **반드시 사용자에게 「권장 LLM은 `Carbon`·`Fable`이며 이외의 LLM에서는 잘 작동하지 않는다」고 명시적으로 경고**하고 `Carbon` 또는 `Fable` 워커로 위임하거나 모델 전환을 안내해야 한다 (`npm run harness -- easyrpg-charset check-model <model>` 로 사전 점검 가능).

## Golden Rules (Empirically Proven)

1. **Authoring Agent & Recommended LLM (`Carbon` · `Fable` ONLY)**:
   - **Recommended Models**: **`Carbon`** (`gemini-4-carbon`, `thought_level: "medium"` or `"high"`) and **`Fable`** (`fable` family, e.g. `fable-5-2`). **Do NOT run pixel authoring on other LLMs without warning the user that non-`Carbon`/non-`Fable` models fail reliably on `24×32` 12-frame anatomy.**
   - **In T3 Code (`t3-code` MCP)**: Call `orchestrator_capabilities` once per thread, then fan out parallel workers via `delegate_task` targeting **`Carbon`** (`{ "providerInstanceId": "antigravity", "model": "gemini-4-carbon", "options": { "thought_level": "medium" } }`) or **`Fable`**, `mode: "async"`.
   - **In Standalone `agy` CLI / Antigravity IDE**: Verify the active model is `Carbon` or `Fable` (`npm run harness -- easyrpg-charset check-model <model>`), then fan out parallel workers via `invoke_subagent(TypeName="self", Role=..., Prompt=...)` (or `run_workflow` for >6 characters) so each slot runs in an isolated context with write/command tools.
   - **In OPRN Editor Assistant (`조수`)**: Read `part: "base-catalog"` via `read_assistant_skill({ id: "easyrpg-charset-batch", part: "base-catalog" })` whenever authoring or reviewing `24×32` character chips (surfacing the `Carbon`·`Fable` model requirement if another model is active), or select directly from the **200-character Editor Default Set (`FantasyPeople1~25`)** / `EasyRPG` (`Actor1~4`, `People1~5`) / `Heroes` sheets via `list_npc_graphics`.
   - Scratch grids without an RTP skeleton drift into cold geometric "modern indie" pixel art.
2. **Never Downscale Generative Images to `24×32`**: At `24×32`, an eye is `1×2px`; downsampling `image-generator` outputs turns eyes to gray mush and warps proportions to 2.5-head-tall MV/XP scale.
3. **Always Start from an Official EasyRPG RTP Base — Prefer Nude-Doll Outlines (`doll12` on `Template:0..2`) for Fresh Characters!**:
   - **Mode `doll12` (Recommended Default for New Characters — Hybrid `hair_ref` RTP Head +Clothed-Side-Calibrated `Template:0 / broad / 2` Chibi Nude-Doll Body)**:
     Combines EasyRPG's **2-head chibi mannequin walk templates upgraded with clothed RTP side-profile proportions** (`Template:0` Standard `9px` side torso, `Template:broad` Muscular/Dwarf Chibi, `Template:2` Petite Child `8px` side torso — *never use raw `Template:1` `29px` Ogre for normal humans/dwarfs!*) + **10-symbol Anatomical Blueprint (`doll_outline.chr.txt` + `doll_outline_8x.png`, with `H` marking the must-cover upper skull hair zone and `C` protecting the `2px` ear + `1–2px` cheek in `RIGHT`/`LEFT` so faces are never crushed by hair)** with an **`hair_ref` official RTP hair donor (`People1:1`, `Actor2:1`, `Actor4:1`, `Actor1:0`, `Actor4:6`, etc.)** for genuine RTP hair clumps, brow harmony, `1px` profile nose + `-1px` tucked chin, `8–9px` side chest under chin, `7px` forward-toed boots, and `UP` back-hair volume!
   - **Mode `partedit`** (`src/harnesses/charset-actor/partedit.py`): Use when face/skin/walk pose of a specific clothed base can stay pixel-locked and you only want hair/hat (`H+h`), outfit/cape (`T+t`), pants/boots (`B`/`S`), anchored weapons/back gear (`gear: held|hip|back`), or `@robot` bodies.
   - **Mode `full12`** (`src/harnesses/charset-actor/harness.py`): Use when adapting a specific clothed RTP character (`People5:3` kimono/hakama, `Actor1:5` wide witch hat, `People2:0` top-hat coat) whose garment silhouette is already close to the target.
   - See [references/base-catalog.md](./references/base-catalog.md) (`part: "base-catalog"`) for the base-selection table and the **9 RTP Style, Eye & Walk Kinematics Laws**.

## End-to-End Batch Workflow (Up to 6–8 Parallel Characters per Wave)

### Step 1: Write a `batch.json` Spec & Seed Isolated Workspaces

Create `<out_dir>/batch.json` listing the characters to produce:

```json
[
  {
    "id": "sun_paladin_knight",
    "label": "Sun Paladin",
    "mode": "doll12",
    "base": "Template:0",
    "hair_ref": "People1:1",
    "concept": "태양 성기사 — 황금 사파이어 서클릿 + 금발 앞·옆머리 다발과 뒤로 흘러내리는 하이 포니테일 + 백은·청색 흉갑과 붉은 어깨 망토",
    "must_have": [
      "앞·옆머리 15px 볼륨 + 금갈색 동조 눈썹(#000000 짱구 눈썹 금지) + 옆모습 1px 코",
      "리본 매듭 y높이 4방향 일치 및 RIGHT·LEFT·UP 모두 어깨 쪽으로 자연스럽게 드리운 포니테일"
    ]
  },
  {
    "id": "starlight_alchemist_kid",
    "label": "Alchemist Kid",
    "mode": "doll12",
    "base": "Template:2",
    "hair_ref": "Actor2:1",
    "concept": "별빛 연금술사 소녀 — 밤갈색 보브 단발 다발과 왼쪽 황금 별 머리핀 + 에메랄드 베스트·허리 포션 벨트·연금 가방",
    "must_have": [
      "Actor2:1 단발 다발 구조(정면·옆면·UP 뒷머리 세로 다발 골 분리) + 밤갈색 눈썹",
      "왼쪽 별 머리핀의 3D 방향 일관성(DOWN 화면우측 · LEFT 노출 · UP 화면좌측)"
    ]
  }
]
```

Run the formal harness CLI (`npm run harness -- easyrpg-charset`) or [scripts/easyrpg_batch.py](./scripts/easyrpg_batch.py):

```bash
npm run harness -- easyrpg-charset check-model gemini-4-carbon
npm run harness -- easyrpg-charset seed \
  --spec <out_dir>/batch.json \
  --out <out_dir> \
  --model gemini-4-carbon
```

This checks the LLM model guard (`Carbon` / `Fable` recommended; emits an explicit warning if any other LLM is passed) and creates `<out_dir>/<NN>_<id>/` for each character with its RTP base files, visual style sheet (`rtp_style_4x.png`), and a complete self-contained worker brief `<out_dir>/<NN>_<id>/prompt.md`.

### Step 2: Fan Out Parallel `Carbon` (`gemini-4-carbon`) or `Fable` Subagents

Read each generated `<out_dir>/<NN>_<id>/prompt.md` (or pass its path/contents as `task`) and launch all slots in parallel in a single turn using `delegate_task`:
- `target`: `{ "providerInstanceId": "antigravity", "model": "gemini-4-carbon", "options": { "thought_level": "medium" } }` (or a `Fable` model; **never silently substitute non-`Carbon`/non-`Fable` models — warn the user if neither is available!**)
- `mode`: `"async"`
- End your turn without polling; T3 wakes you as each worker finishes.

### Step 3: Stage-1 Mechanical Gate (`verify` / `doll-check`)

Once workers complete, run the batch mechanical verifier (which enforces `chr.py` strong gate, `motion.py` 12-frame walk gate, `check_side_profile_anatomy`, `check_front_face_and_head_lock`, `check_proportion_and_symmetry_qa`, and `check_walk_kinematics_12frame` — writing `chr_sha256` into `<slot>/views/gate.json`):

```bash
npm run harness -- easyrpg-charset verify --out <out_dir>
```

Mechanical hard gates automatically `FAIL` any slot with:
- Asymmetric/crossed front irises (`mE..mE`), sheared eye rows, `3–4px` squashed nose bridges, or `#ffffff` chin masks.
- `DOWN · RIGHT · LEFT` eye `y`-row mismatches or rubber-accordion head/eye walk bob errors.
- **Bald Forehead Tower (`>= 3` bare skin rows above eyebrows)**: Exposed forehead skin above brows must be `0–2` rows max, framed by bangs or headgear.
- **Off-Center Lopsided Body (`|x0 + x1 - 23| >= 2` across torso/skirt)** or **`idle vs step` Frog-Shoulder Pumping (`>= 2px` jump)** or **Unoutlined White Top-Edge Pixels (`lum >= 225` touching background)**.

### Step 3.5: Stage-2 Mandatory Independent Adversarial Visual QA Gate (`qa-prep` → Critic Subagent → `qa-verdict`)

**Never skip directly from mechanical `verify` to `pack`!** Authoring subagents suffer from sunk-cost blindness on subtle visual flaws (awkward hair parting, chin-jewelry mouth illusions, stiff garment folds). Run `qa-prep` to build 8× side-by-side RTP comparison boards (`<out_dir>/qa_sheets/qa_group_*.png`) with `x=11.5` center-axis hairlines:

```bash
python3 assistant-skills/easyrpg-charset-batch/scripts/easyrpg_batch.py qa-prep --out <out_dir>
```

Then **launch an independent read-only critic subagent** (`invoke_subagent(TypeName="research", ...)` or `delegate_task(role="review", ...)` — **never** the authoring worker!) using `<out_dir>/qa_sheets/critic_prompt.md` to inspect every `qa_group_*.png` against the **8 Instant-Reject Flaws** below. Fix every slot the critic rejects, re-run `doll-check`, and record hash-locked verdicts:

```bash
python3 assistant-skills/easyrpg-charset-batch/scripts/easyrpg_batch.py qa-verdict \
  --dir <out_dir>/<NN>_<id> --verdict PASS --by <critic_id> --notes "..."
```

`qa-verdict` binds the approval to `sha256(out.chr.txt)` inside `<slot>/views/qa_verdict.json`. Editing `out.chr.txt` automatically invalidates any prior QA verdict!

#### The 8 Visual QA Instant-Reject Flaws:
1. **White-on-White / High-Value Blowout**: White/silver hair touching a white top merges into a glowing blob relative to `Actor1`/`People1`'s mid-dark value weight. Separate with dark hair or dark collars/vests.
2. **Double-Stacked Headgear ("Football Helmet" Bloat)**: Stacking a hat + over-ear headphones (or helmet + big hood) makes the head wider than `16px` and top-heavy. Move secondary gear to the neck (e.g., neck-slung headphones) or pick one headgear.
3. **Flat Solid-Color Torso Block**: Unbroken single-color hoodies/shirts look empty at `24×32`. Split the chest into 2–3 planes (open jacket over inner tee, lapels + tie, cross-belt, scarf, buckle).
4. **Cold Geometric "Modern Indie" Drift**: Cool gray/blue monochrome outlines or mirror-symmetric box bodies clash with RTP. Require warm `#290800`/`#1a0c07`/`#4d2222` dark anchors and colored sel-out.
5. **"Black Eyeball" Sunglasses Illusion**: Eyewear must expose 1–2 rows of peach forehead above a continuous horizontal brow bar + nose bridge + subtle diagonal lens glint + profile temple arm.
6. **Broken Hair / Eyebrow / Eye Synergy (`face_check_12x.png` 4-Direction Full-Head Check Mandatory!)**:
   - Always inspect the upgraded 10× 4-direction (`DOWN`, `RIGHT`, `LEFT`, **`UP` back-of-head!**) full-head board `face_check_12x.png` alongside `rtp_eyes_12x.png`:
     - **Never Stamp `#000000` "Shin-chan" Block Eyebrows on Light Hair / Exposed Foreheads**: Official RTP (`Actor4:1`, `Actor2:1`, `Actor4:6`) colors the `2px` brow/upper-lash row using the **hair's own darkest shadow tone (`hair_dark`, e.g., `#8a5828`/`#997a41` on blonde, `#612712` on chestnut, `#2c223b` on lavender)** or `[inner 1px #290800 + outer 1px hair_dark]`. Pure `#000000` `2px` is only for deep bang overhang shadow or black hair.
     - **Never Paint Hair Flat Inside a `12px` Bald Skull or as a Smooth Bowling Ball**: Build `14–16px` hair volume with bangs reaching the brow row, cheek-framing sidelocks, and **3–5 dark-crevice-separated hair clumps across all 4 directions including `UP` back hair**.
     - **`1px` Profile Nose, `-1px` Tucked Chin & Mandatory Neck-Pinch Row (`ey+3` Anti-No-Neck / Anti-Turtle Gate!)**: In `RIGHT`/`LEFT` profiles, **only the single eye-bottom row (`1px` tall) protrudes `+1px` forward as the nose tip** — the chin row immediately below **must step `-1px` back inward**. In `DOWN`, keep a readable warm peach chin (`ey+2`, `y=17`) and **pinch the neck/collar row (`ey+3`, `y=18`) inward to `10–12px` (`8–9px` in side profiles, excluding long flowing hair locks)** before shoulders flare out at `ey+4` (`y=19`). Never swallow the chin with grey stubble or slam `14px+` coat shoulders directly into `y=18` right under the eyelids/ears ("no-neck" turtle silhouette = automatic `FAIL`!).
     - **4-Direction Tie/Pin `y`-Height & Ponytail Gravity Drape**: Ribbons, hair ties, headbands, and hairpins must sit at the **same `y` row** across `DOWN`, `RIGHT`, `LEFT`, and `UP` (accounting for 3D left/right side). In `RIGHT`/`LEFT` profiles, ponytails/braids must **never stick horizontally out of the top crown (`y=6..7`) like a floating mallet** — arch from the tie (`y=9..10`) and **drape downward (`y=9..16`) toward the collar**, separated from the skull by a `1px` dark outline crease.
     - **Crisp Mirror-Symmetric RTP Eyes, `2px` Nose Bridge & Rigid `+1px` Head Bob (`check_front_face_and_head_lock` Hard Gate!)**:
       - **Exact `x=9..14` Front Eye Symmetry**: `DOWN` (`0·1·2`) eyes MUST span `x=9..14` as **`[x=9 sclera | x=10 iris | x=11..12 2px peach nose | x=13 iris | x=14 sclera]`** (`mESSEm` over `WeWWeW`). Never write `mE..mE` on the right eye (diagonal crossed-iris typo!), never shift the lower eye row left/right relative to the upper eye row, never widen the nose bridge to `3–4px` (squashed face!), and never place `>=3px` `#ffffff` on a skin chin row (white surgical-mask blowout!).
       - **4-Direction Eye `y` Sync & Rigid `+1px` Skull Translation**: `DOWN`, `RIGHT`, and `LEFT` eyes must sit on the **exact same `y` row** (`y=15..16` adult / `y=17..18` child), and in all 4 directions (`DOWN·RIGHT·LEFT·UP`), `step 0` and `step 2` crowns + eyes must translate **rigidly `+1px` downward** relative to `idle 1` (never insert/delete a hair row in `idle 1` that causes rubber-accordion head stretching!).
7. **Broken Walk Kinematics — Vanishing Hands & Pumping/Twisting Bellies (`kinematics_check_8x.png` Mandatory!)**:
   - Vision models only see a single static frame of GIFs and `views/context.png` only shows `idle 1`. Always generate and inspect `kinematics_check_8x.png` (`easyrpg_batch.py kinematics-check`) comparing **Official RTP Base `[0 | 1 | 2]`** vs **Yours `[0 | 1 | 2]`** at 8×:
     - **Preserve the RTP Base's 12-Frame Walk Skeleton**: Paint clothes/aprons/tunics onto `base.chr.txt`'s existing `0 · 1 · 2` arm swing, hand positions, leg stride, and `+1px` vertical bob rather than inventing new limb poses from scratch.
     - **Steady Non-Blinking Hands & Grounded Bidirectional Side Walk (`check_walk_kinematics_12frame` Hard Gate!)**:
       - **Zero Flashing Sleeves / Mud Hands / Seesaw Arms (`DOWN` & `UP`)**: Keep sleeve brightness AND bright peach/glove hand colors (`>=2px` per hand) consistent across `0 · 1 · 2` — never paint the back-swinging hand dark mud-brown (`#bd623b`) or swap left/right sleeve colors on alternate steps! Keep left vs right hand bottoms within `<=1px` (`|L_max_y - R_max_y| <= 1`, never hiking one hand `2–3px` into the armpit).
       - **Bidirectional Side Arm Swing (`RIGHT` & `LEFT`)**: One step swings the arm `1–2px` behind the back (`never >=3px` giant flying fist!) with a flat front chest (`x=15`/`x=8`), while the other step keeps the back flush and swings the `2×2` hand `+1px` forward (`x=16` `RIGHT` / `x=7` `LEFT` — never sprout arms front-and-back in one frame, and never omit the forward hand swing!).
       - **12-Frame Ground Contact (`y=30`)**: Every step (`0, 1, 2`) across all 4 directions must keep its planted boot on `y=30` (never float both feet up to `y=29` in a frog-squat/crab-shuffle!).
     - **Flat Side-Profile Belly Wall (Zero Potbelly Pumping)**: In `RIGHT`/`LEFT`, the front chest/belly vertical wall (`x` boundary) stays **flat and fixed** across `0 · 1 · 2`; only the forward-swinging arm/hand crosses `1–2px` past it in **one** step. Never push the stomach/apron itself forward in `0` and `2`.
     - **Steady Front Belly & Props**: In `DOWN`, belt buckles, vest buttons, and center seams only bob `+1px` down with the torso in `0` and `2` (never tear diagonally or dance side-to-side between `0` and `2`). Back/hip gear (quivers, hammers, bags) bobs `+1px` with the torso rather than bouncing erratically.
8. **Side-Profile 4-Point Anatomy (`RIGHT` & `LEFT` Anti-Stick / Anti-Cyclops Gate — `check_side_profile_anatomy`)**:
   - Raw `Template.png` is unclothed (`5–6px` ribcage, `4px` child legs, flat nose, toeless heel). Every clothed character must satisfy all 4 RTP side-profile rules:
     1. **`2px` Ear + `1px` Sideburn + `1–2px` Cheek Behind Both Eye Rows (`C` Zone)**: Never paint solid hair touching the white sclera (`x=13` `RIGHT` / `x=10` `LEFT`). Keep `[ear x=9..10 + 1px sideburn x=11 + warm cheek x=12]` (`RIGHT`, mirrored in `LEFT`).
     2. **Vertical `1×2` Side Sclera & Iris + `+1px` Nose Tip**: Align sclera and iris vertically on identical `x` columns (never staggered diagonally!), keep `1px` front bridge skin on the upper eye row, and protrude only the lower eye row `+1px` forward as the nose tip.
     3. **`8–10px` Clothed Side Torso Aligned Under Chin + Flush Shoulder Arm**: Widen clothed adult side torsos (`y=19..24`) to `8–10px` (`x=7..15` `RIGHT` / `x=8..16` `LEFT`; `7–8px` `x=8..15` for `Template:2` children) so the front chest wall stands directly beneath the chin, and keep the idle arm flush inside the shoulder/coat back.
     4. **`7px` Side Shoe With Forward Toe (`6px` Child)**: Extend idle side shoes (`y=28..30`) to `x=9..15` (`RIGHT`) / `x=8..14` (`LEFT`) with a `1–2px` forward toe.

Expect ~75–90% first-pass hits when workers self-check both `face_check_12x.png` and `kinematics_check_8x.png`. Re-delegate any outlier slot whose hands vanish/jump or whose belly bulges/twists.

### Step 4: Hash-Locked Pack (`288×256` RM2000 Sheets & Grass Parade GIF)

`pack` **hard-verifies** that every included slot has both a current `views/gate.json` (`strict_ok: true`, matching `chr_sha256`) **and** a current `views/qa_verdict.json` (`verdict: "PASS"`, matching `chr_sha256`). Unverified or modified slots abort `pack` with exit code 1:

```bash
npm run harness -- easyrpg-charset pack --out <out_dir>
```

Outputs in `<out_dir>/`:
- `rm2k_pack_01_288x256.png` (native transparent `288×256` 8-character sheet ready for OPRN / RM2000; additional packs numbered `02`, `03`… if >8 characters)
- `showcase_3x.png` (3× full 12-frame visual inspection board on grass)
- `grand_parade_walk.gif` (4× animated 4-direction walking comparison alongside official `EasyRPG Actor1` & `People1` references)

> **Governance & Editor Default Set Install (`FantasyPeople1~25`, 200+ Characters)**: Packing a sheet in a scratch/demo folder does **not** install into bundled editor assets (`public/assets/generated/charsets/`). The 200-character `FantasyPeople1.png` … `FantasyPeople25.png` series is pre-installed as the **Editor Default Character Set** (`src/assets/charsetCatalog.ts` · `defaultResourceProfiles()`). When the user explicitly approves new character hashes to expand the default set, stage `<key>/{chip.chr.txt,meta.json}` into `harness-data/charset-actor/fantasy-people-picks/<key>/`, append entries to `harness-data/charset-actor/fantasy-people-install.json` (append-only slot indices!), and bake/verify via `npm run harness -- easyrpg-charset install` (`--check` to assert byte-identical pixels & roster), following `openwiki/harnesses/easyrpg-charset.md`.
