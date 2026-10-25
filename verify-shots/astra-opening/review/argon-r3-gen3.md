# Astra Horizon Opening Visual QA Review (Round 3 — Gen 3 Opening Target)

## Scope & Inspected Captures

Reviewed all 15 JPEG captures in `/home/main/claude-viz/astra-opening-2/` and all 37 full-resolution (`960x640`) PNG frames in `/tmp/astra-cap7/frames/`:

- **Stage 1 (Field Intro)**:
  - `/home/main/claude-viz/astra-opening-2/intro-p1-031916.jpg` (`/tmp/astra-cap7/frames/intro-p1-028991.png`, `/tmp/astra-cap7/frames/intro-p1-030432.png`, `/tmp/astra-cap7/frames/intro-p1-031916.png`)
  - `/home/main/claude-viz/astra-opening-2/intro-p2-033476.jpg` (`/tmp/astra-cap7/frames/intro-p2-033476.png`)
  - `/home/main/claude-viz/astra-opening-2/intro-p3-036367.jpg` (`/tmp/astra-cap7/frames/intro-p3-034922.png`, `/tmp/astra-cap7/frames/intro-p3-036367.png`)
- **Stage 2 (Title Screen)**:
  - `/home/main/claude-viz/astra-opening-2/title-004000.jpg` (`/tmp/astra-cap7/frames/title-001500.png`, `/tmp/astra-cap7/frames/title-004000.png`, `/tmp/astra-cap7/frames/title-006500.png`, `/tmp/astra-cap7/frames/title-menu-046238.png`)
- **Stage 3 (Professor Speech)**:
  - `/home/main/claude-viz/astra-opening-2/prof-p1-049372.jpg` (`/tmp/astra-cap7/frames/prof-p1-049372.png`, `/tmp/astra-cap7/frames/prof-p1-end-052239.png`)
  - `/home/main/claude-viz/astra-opening-2/prof-p2-end-056457.jpg` (`/tmp/astra-cap7/frames/prof-p2-054253.png`, `/tmp/astra-cap7/frames/prof-p2-end-056457.png`)
  - `/home/main/claude-viz/astra-opening-2/prof-p3-end-061004.jpg` (`/tmp/astra-cap7/frames/prof-p3-058558.png`, `/tmp/astra-cap7/frames/prof-p3-end-061004.png`)
  - `/home/main/claude-viz/astra-opening-2/prof-p4-end-065766.jpg` (`/tmp/astra-cap7/frames/prof-p4-063065.png`, `/tmp/astra-cap7/frames/prof-p4-end-065766.png`, `/tmp/astra-cap7/frames/after-prof-068379.png`)
- **Stage 4 (Boy/Girl Choice & Name Entry)**:
  - `/home/main/claude-viz/astra-opening-2/choice-069405.jpg` (`/tmp/astra-cap7/frames/choice-069405.png`)
  - `/home/main/claude-viz/astra-opening-2/name-showcase-075701.jpg` (`/tmp/astra-cap7/frames/name-showcase-075701.png`, `/tmp/astra-cap7/frames/name-confirm-076375.png`)
  - `/home/main/claude-viz/astra-opening-2/name-after-078367.jpg` (`/tmp/astra-cap7/frames/name-after-078367.png`)
- **Stage 5 ("Adventure Begins" & Shrink Sequence)**:
  - `/tmp/astra-cap7/frames/stage-0-350-078963.png`, `/tmp/astra-cap7/frames/stage-0-700-079506.png`, `/tmp/astra-cap7/frames/stage-0-1050-080089.png`
  - `/home/main/claude-viz/astra-opening-2/stage-1-350-080656.jpg` (`/tmp/astra-cap7/frames/stage-1-350-080656.png`)
  - `/home/main/claude-viz/astra-opening-2/stage-1-700-081166.jpg` (`/tmp/astra-cap7/frames/stage-1-700-081166.png`, `/tmp/astra-cap7/frames/stage-1-1050-081692.png`)
  - `/home/main/claude-viz/astra-opening-2/stage-2-700-082674.jpg` (`/tmp/astra-cap7/frames/stage-2-350-082175.png`, `/tmp/astra-cap7/frames/stage-2-700-082674.png`, `/tmp/astra-cap7/frames/stage-2-1050-083149.png`)
- **Stage 6 (Arrival in the Bedroom)**:
  - `/tmp/astra-cap7/frames/stage-3-350-083671.png`, `/tmp/astra-cap7/frames/stage-3-700-084171.png`, `/tmp/astra-cap7/frames/stage-3-1050-084612.png`
  - `/home/main/claude-viz/astra-opening-2/stage-4-700-085511.jpg` (`/tmp/astra-cap7/frames/stage-4-350-085052.png`, `/tmp/astra-cap7/frames/stage-4-700-085511.png`, `/tmp/astra-cap7/frames/stage-4-1050-086069.png`)

---

## Stage-by-Stage Adversarial Evaluation

### 1. Short Intro with Starters in a Field (`intro-p1-031916.jpg`, `intro-p2-033476.jpg`, `intro-p3-036367.jpg`)

- **Does it read as a Gen 3 style opening?**
  **Partially in palette, NO in staging.** Replacing the old dark cosmic intro with a bright daytime meadow moves the palette in the right direction, but the sequence reuses the exact same static meadow background image as the title screen, pops the three starters from small overworld sprites (`~76x76px`) into oversized battle sprites (`~200x195px`), and drops a duplicate full-screen title card in `intro-p3-036367.jpg` immediately before the actual title screen.
- **Concrete visual defects**:
  1. **Static painted fox baked into the background layer (`x=565..685, y=345..458`)**: A large (`120x113px`) orange fox/squirrel creature is painted directly into the static hillside image. It never animates across any intro or title frame. In `intro-p1-031916.jpg`, this static background creature is nearly twice the height of the animated starter sprites (`~76px` tall) walking below it. In `intro-p2-033476.jpg`, the enlarged water starter (`아가핀`, `x=608..826, y=378..536`) overlaps the static fox's body while the fox's head pokes awkwardly out between the middle and right starters.
  2. **Missing third emote, horn overlap, and stretched `"!"` glyph (`intro-p2-033476.jpg`)**: Only the left starter (`토리프`, `♥` box at `x=276..335, y=300..349`) and middle starter (`숯꼬미`, `!` box at `x=516..575, y=300..349`) receive emote bubbles; the right starter (`아가핀`) has none. The middle `!` box overlaps the top of `숯꼬미`'s right horn (`y=346..349`), and the `!` inside the bubble is a stretched `19px`-wide blocky red bar.
  3. **Low-contrast white subtitle over houses and trees (`intro-p3-036367.jpg`)**: The white subtitle `"다우닝 시티와 여명의 날개"` (`x=305..655, y=323..356`) sits directly across the red/cream house roofs (`RGB 245,232,202`), dark tree outlines, and white sky particles, hurting readability.
  4. **Redundant pre-title logo drop (`intro-p3-036367.jpg` vs `title-004000.jpg`)**: `intro-p3-036367.jpg` presents `"아스트라 호라이즌 / 다우닝 시티와 여명의 날개"` centered in yellow/white, and then immediately transitions to the title screen which displays the exact same title and subtitle again in the top-left corner.
  5. **Leftover floating snow/star dots**: White circular particles (`intro-p1-031916.jpg`, `intro-p3-036367.jpg`) drift across the summer sky and green meadow—a leftover particle layer from the old night-sky opening.

---

### 2. Bright Title with Logo, Monsters and Blinking PRESS START (`title-004000.jpg`, `/tmp/astra-cap7/frames/title-001500.png`, `title-006500.png`, `title-menu-046238.png`)

- **Does it read as a Gen 3 style opening?**
  **Partially.** The top-left pixel logo (`"아스트라 호라이즌"`) over a sunny sky reads closer to GBA title screens, but starter pathing collisions, edge clipping, and `PRESS START` placement break the presentation.
- **Concrete visual defects**:
  1. **`PRESS START` is absent in `title-004000.jpg` and collides with the background fox when visible (`title-001500.png`)**: In the primary capture `/home/main/claude-viz/astra-opening-2/title-004000.jpg` (and `/tmp/astra-cap7/frames/title-006500.png`), `PRESS START` is invisible on the off-phase of its blink cycle. When visible in `/tmp/astra-cap7/frames/title-001500.png` (`x=391..570, y=389..410`), the right end of `"START"` (`x=565..570`) collides directly with the snout of the static background fox (`x=565..685`).
  2. **Starters pile up on top of each other and clip off both screen edges**:
     - In `/tmp/astra-cap7/frames/title-001500.png`, `아가핀` is cut off by the left screen border (`x=0..24, y=514..590`), leaving only `25px` of its tail visible.
     - In `/home/main/claude-viz/astra-opening-2/title-004000.jpg`, all three starters (`x=360..625, y=476..608`) bunch into a single overlapping pile in the center-bottom (`숯꼬미` covers `아가핀`'s face; `토리프` covers `숯꼬미`'s legs and lower face).
     - In `/tmp/astra-cap7/frames/title-006500.png`, the tangled group walks off the right border (`x=799..959, y=489..600`), slicing `토리프` (`x=942..959`) and `숯꼬미`'s face cleanly off at `x=959`.
  3. **Title menu overlaps the static background fox (`title-menu-046238.png`)**: When the command window (`"모험 시작 / 불러오기 / 크레딧 / 그만두기"`, `x=353..607, y=418..612`) opens, its upper-right corner clips across the face and body of the static painted fox.

---

### 3. Professor Speech: Welcome, Monster Popping from Capsule, World Explanation (`prof-p1-049372.jpg`, `prof-p2-end-056457.jpg`, `prof-p3-end-061004.jpg`, `prof-p4-end-065766.jpg`, `/tmp/astra-cap7/frames/prof-p4-063065.png`)

- **Does it read as a Gen 3 style opening?**
  **NO.** In Pokemon Ruby/Sapphire/Emerald, Professor Birch stands as a large full-body sprite on a dedicated studio spotlight backdrop, tosses a Poke Ball to release a monster onto the stage platform, and speaks through standard GBA dialogue frames. Here, the speech is a top-down tilemap cutscene using dark translucent cinema subtitle bars (`RGB ~18,22,20`, `y=484..607`) across three different tilemaps (indoor lab, outdoor town crossroads, outdoor flower garden) before abruptly switching to GBA dialogue boxes in Stage 4.
- **Concrete visual defects**:
  1. **Monster (`토리프`) overlaps the dark subtitle box, text, and lab bookshelves instead of popping from a capsule on a stage (`prof-p2-end-056457.jpg`, `/tmp/astra-cap7/frames/prof-p2-054253.png`)**: All three blue capsules remain untouched on the table (`x=602..736, y=255..305`) while an oversized `230x195px` battle sprite of `토리프` (`x=551..780, y=344..538`) spawns on top of the lower-right bookshelves (`y=385..518`) and collides with the dark subtitle box (`x=268..692, y=484..607`). The white line `"나는 오르비스 연구소의 천문박사."` (`y=508..538`) renders directly across `토리프`'s front paws and lower body.
  2. **Stray red heart fragment stuck to the capsule table (`prof-p2-end-056457.jpg`)**: A clipped red heart remnant (`x=746..759, y=288..298`) from the shrinking `♥` emote remains visible on the bottom-right corner of the capsule table.
  3. **Near-black transition frame at the end of the Professor's cutscene (`prof-p4-end-065766.jpg` / `/tmp/astra-cap7/frames/prof-p4-end-065766.png`)**: At `t=65.77s`, the entire `960x640` frame drops to near-black (`meanRGB=[17.7, 17.7, 13.6]`, max pixel value `42/255`), leaving a dark, murky screen between the garden showcase and the return to the lab (`after-prof-068379.png`). Earlier in `/tmp/astra-cap7/frames/prof-p1-end-052239.png`, the lab also dims to 50% brightness (`meanRGB=[86.3, 92.7, 102.3]`) while text is still displayed.
  4. **Illegible third starter name label `"아가핀"` (`prof-p4-063065.png`)**: In `/tmp/astra-cap7/frames/prof-p4-063065.png`, `"토리프"` (`x=135..217, y=408..435`) and `"숯꼬미"` (`x=438..520, y=408..435`) are bright white (`RGB 251,252,250`), but `"아가핀"` (`x=742..822, y=408..435`) is mid-fade or stuck at low opacity (`max RGB 151,174,138` over `RGB 90,136,88` green hedge/grass, luminance contrast `< 1.6:1`), making it nearly invisible and overlapping the hedge top border.
  5. **Overlapping walking starters in outdoor town pan (`prof-p3-end-061004.jpg`)**: In `prof-p3-end-061004.jpg`, the blue water starter (`x=552..626, y=252..314`) and fire sheep starter (`x=586..661, y=296..381`) overlap (`x=586..626, y=296..314`), while another monster (`x=221..281, y=406..498`) stands on the stone rim of a tiny water pool.
  6. **Leftover floating white snow/star particles inside the indoor laboratory (`prof-p1-049372.jpg`, `/tmp/astra-cap7/frames/prof-p2-054253.png`)**: White circular particles float across the indoor laboratory floor and equipment.

---

### 4. Boy/Girl Choice, Then Name Entry (`choice-069405.jpg`, `name-showcase-075701.jpg`, `name-after-078367.jpg`, `/tmp/astra-cap7/frames/after-prof-068379.png`, `name-confirm-076375.png`)

- **Does it read as a Gen 3 style opening?**
  **NO.** The UI abruptly switches from dark translucent cinema subtitles to a full-width GBA cream dialogue box while still rendering the top-down lab map behind oversized floating bust/character sprites. Then, Name Entry (`name-showcase-075701.jpg`) switches to a dark midnight-blue starry night-sky screen (`meanRGB=[24.7, 31.2, 62.1]`) that retains the old cosmic/night-sky aesthetic instead of a bright Gen 3 naming screen.
- **Concrete visual defects**:
  1. **Professor portrait bust is cut in half by the Boy/Girl choice box (`choice-069405.jpg`) and floats with a `44px` gap above the dialogue box (`after-prof-068379.png`, `name-after-078367.jpg`)**:
     - In `after-prof-068379.png` and `name-after-078367.jpg`, the huge `378x376px` Professor bust (`x=528..905, y=60..435`) is pasted over the right side of the top-down lab tilemap, and its bottom cut-off edge (`y=435`) stops `44px` above the top of the dialogue box (`y=479`), exposing the bottom of three lab bookshelves (`y=436..478`) underneath his severed torso.
     - In `choice-069405.jpg`, the `"남자아이 / 여자아이"` choice box (`x=512..959, y=320..479`) covers the lower half of the Professor's bust (`y=320..435`), leaving only his severed head (`y=60..319`) protruding above the choice box.
  2. **No boy/girl character sprite preview during gender selection (`choice-069405.jpg`)**: Selecting `"남자아이"` or `"여자아이"` shows only text in a box over the lab map with no preview of the male or female trainer design.
  3. **Hangul keyboard container clips the 5th syllable row and hides `마` through `하` (`name-showcase-075701.jpg`, `name-confirm-076375.png`)**: Inside the keyboard grid (`x=324..932, y=264..528`), only four rows (`가..기`, `나..니`, `다..디`, `라..리`) fit cleanly. The 5th row (`마..미`, `y=514..526`) is horizontally sliced off after its top `12px`, and rows `마` through `하` are completely cut off with no scrollbar.
  4. **Leftover night-sky / cosmic styling on the Name Entry screen (`name-showcase-075701.jpg`, `name-confirm-076375.png`)**: The naming screen uses a dark navy starfield (`RGB 12,18,45` to `26,34,68` with star dots) and dark indigo buttons, clashing with the bright, playful Gen 3 target.
  5. **Large hero sprite pasted directly over lab furniture (`name-after-078367.jpg`)**: In `name-after-078367.jpg`, the `136x216px` hero sprite (`x=192..327, y=220..435`) floats on top of the lab's left bookshelves and blue incubator machine while the giant Professor bust floats on the right.

---

### 5. "Adventure Begins", Then the Player Shrinks into the World (`stage-1-350-080656.jpg`, `stage-1-700-081166.jpg`, `stage-2-700-082674.jpg`, `/tmp/astra-cap7/frames/stage-0-*`, `stage-1-1050-081692.png`, `stage-2-350-082175.png`)

- **Does it read as a Gen 3 style opening?**
  **NO.** In Gen 3, the full-body trainer sprite shrinks at the center of the dedicated intro stage down to overworld size before transitioning into the bedroom/truck. Here, the shrink animation plays on the left side of the **Professor's Lab tilemap** while the bedroom location banner (`"| 다우닝 시티 · 내 방"`) is already displayed at the top-left of the lab, followed by a muddy crossfade between the two rooms.
- **Concrete visual defects**:
  1. **Premature bedroom location banner `"| 다우닝 시티 · 내 방"` appearing over the Professor's Lab during the shrink (`stage-1-350-080656.jpg`, `stage-1-700-081166.jpg`, `stage-1-1050-081692.png`)**: The location banner (`x=20..395, y=20..79`) pops in at the start of Stage 1 while the background map is still the Professor's laboratory.
  2. **Hero shrinks on the wrong map (Professor's Lab) and off-center (`stage-1-350-080656.jpg`, `stage-1-700-081166.jpg`)**:
     - In `stage-1-350-080656.jpg`, the `136x216px` hero (`x=192..327, y=220..435`) stands on top of the lab's left bookshelves.
     - In `stage-1-700-081166.jpg`, the hero shrinks to `109x172px` (`x=271..379, y=255..426`), still floating over the lab's left-center bookshelves (`x=205..455, y=385..518`).
  3. **Ghostly double-exposure crossfade between Lab and Bedroom (`stage-1-1050-081692.png`, `stage-2-350-082175.png`)**: In `/tmp/astra-cap7/frames/stage-1-1050-081692.png`, the bedroom tilemap (wooden floor, bed, green carpet, stairs) is superimposed at ~50% opacity directly over the Professor's lab tiles (bookshelves, blue capsule table, incubator) while the hero snaps from `x=271..379` to center `x=384..483`. In `/tmp/astra-cap7/frames/stage-2-350-082175.png`, ghosted lab bookshelves still bleed through the green bedroom rug.
  4. **Bare, stretched yellow `"!"` bar on the bedroom floor (`stage-2-700-082674.jpg`)**: Upon arrival in the bedroom (`stage-2-700-082674.jpg`), a tall, unframed yellow `!` (`x=408..423, y=232..271`, `16x40px`) sits directly on the wooden floorboards above the hero's cap without a speech bubble, looking like a yellow post stuck in the floor.

---

### 6. Arrival in the Bedroom (`stage-2-700-082674.jpg`, `stage-4-700-085511.jpg`, `/tmp/astra-cap7/frames/stage-3-*`, `stage-4-*`)

- **Does it read as a Gen 3 style opening?**
  **Mostly yes, with framing issues.** The bedroom interior (bed, PC desk, TV/console, stairs, central green rug) and the GBA-styled dialogue frame (`"드디어 오늘! 박사님께 첫 동료를 받는 날이다."` -> `"[방향키] 걷기 · [Z] 말 걸기 · [X] 메뉴"`) read clearly as a Gen 3 bedroom start, though viewport letterboxing and bottom furniture clipping detract from polish.
- **Concrete visual defects**:
  1. **Black letterbox/pillarbox borders around the bedroom viewport (`stage-2-700-082674.jpg`, `stage-4-700-085511.jpg`)**: The bedroom map does not fill the `960x479` area above the dialogue box, leaving a `32px` black top bar (`y=0..31`) and `64px` black side bars (`x=0..63`, `x=896..959`) while the dialogue box spans the full `960px` width (`x=0..959, y=479..639`).
  2. **Bottom corner potted plants clipped by the dialogue box (`stage-2-700-082674.jpg`, `stage-4-700-085511.jpg`)**: The potted plants in the bottom-left (`x=134..185`) and bottom-right (`x=774..825`) corners of the bedroom are cut off at `y=479` by the dialogue frame, leaving only `14px` of green leaves (`y=465..478`) visible.
  3. **Mid-typewriter capture in `stage-2-700-082674.jpg`**: The primary capture `/home/main/claude-viz/astra-opening-2/stage-2-700-082674.jpg` captures `"드디어 오늘!"` before the rest of the sentence (`"박사님께 첫 동료를 받는 날이다."`, seen in `/tmp/astra-cap7/frames/stage-3-700-084171.png`) finishes printing.

---

## Top 5 Problems Ranked by Severity

1. **[Blocker] Stage 5 Shrink Sequence Plays Over the Professor's Lab with a Premature `"| 다우닝 시티 · 내 방"` Banner and Double-Exposure Map Crossfade**
   - **Evidence**: `/home/main/claude-viz/astra-opening-2/stage-1-350-080656.jpg`, `/home/main/claude-viz/astra-opening-2/stage-1-700-081166.jpg`, `/tmp/astra-cap7/frames/stage-1-1050-081692.png`, `/tmp/astra-cap7/frames/stage-2-350-082175.png`
   - **Impact**: Instead of shrinking on a dedicated Gen 3 intro backdrop and then entering the bedroom, the player sprite shrinks at an off-center position (`x=192..327` -> `x=271..379`) on top of the Professor's Lab bookshelves while the bedroom location banner (`"| 다우닝 시티 · 내 방"`, `x=20..395, y=20..79`) is already visible in the top-left corner, followed by a ghosted double-exposure blend of the lab and bedroom maps (`stage-1-1050-081692.png`).

2. **[Blocker] Professor Speech & Choice Screen Paste Oversized Sprites Directly Over the Top-Down Lab Tilemap and Dialogue/Choice UI**
   - **Evidence**: `/home/main/claude-viz/astra-opening-2/prof-p2-end-056457.jpg`, `/home/main/claude-viz/astra-opening-2/choice-069405.jpg`, `/home/main/claude-viz/astra-opening-2/name-after-078367.jpg`, `/tmp/astra-cap7/frames/after-prof-068379.png`
   - **Impact**: Rather than using a clean Gen 3 spotlight backdrop, the Professor's scene stays on top-down tilemaps and mixes two incompatible UI styles (dark cinema subtitle overlays in `prof-p1..p4` vs GBA dialogue frames in `choice` / `name-after`). In `prof-p2-end-056457.jpg`, the giant `230x195px` `토리프` sprite spawns over the lab bookshelves and collides with the dark subtitle box and white text (`y=484..538`). In `after-prof-068379.png`, `choice-069405.jpg`, and `name-after-078367.jpg`, the `378x376px` Professor bust (`x=528..905, y=60..435`) floats over the lab furniture with a `44px` gap above the dialogue box (`y=436..478`) and is sliced across the chest by the Boy/Girl choice box (`y=320..479`), while the `136x216px` hero sprite (`x=192..327, y=220..435`) stands on top of the left bookshelves.

3. **[Blocker] Name Entry Screen Still Uses a Dark Night-Sky / Starfield Aesthetic and Clips the Hangul Keyboard at the 5th Row (`마`–`하` Hidden)**
   - **Evidence**: `/home/main/claude-viz/astra-opening-2/name-showcase-075701.jpg`, `/tmp/astra-cap7/frames/name-confirm-076375.png`
   - **Impact**: The keyboard container (`x=324..932, y=264..528`) slices horizontally through the 5th Hangul row (`마..미` at `y=514..526`) and hides `마` through `하` with no scrollbar. Visually, the entire screen is still a dark midnight-blue starfield (`meanRGB=[24.7, 31.2, 62.1]`), preserving the old night-sky tone instead of a bright Gen 3 naming screen.

4. **[Major] Title Screen & Field Intro Share a Static Painted Fox Background That Collides with Starters, `PRESS START`, and the Title Menu, While Starters Pile Up and Clip Off-Screen**
   - **Evidence**: `/home/main/claude-viz/astra-opening-2/intro-p1-031916.jpg`, `/home/main/claude-viz/astra-opening-2/intro-p2-033476.jpg`, `/home/main/claude-viz/astra-opening-2/intro-p3-036367.jpg`, `/home/main/claude-viz/astra-opening-2/title-004000.jpg`, `/tmp/astra-cap7/frames/title-001500.png`, `/tmp/astra-cap7/frames/title-006500.png`, `/tmp/astra-cap7/frames/title-menu-046238.png`
   - **Impact**: A static `120x113px` orange fox painted into the hill layer (`x=565..685, y=345..458`) remains frozen across all intro and title shots, colliding with `아가핀` in `intro-p2`, with the right end of `PRESS START` (`x=391..570, y=389..410`) in `title-001500.png`, and with the title menu in `title-menu-046238.png`. Meanwhile, the walking starters on the title screen bunch into a single overlapping tangle in `title-004000.jpg` (`x=360..625, y=476..608`) and clip off the left edge in `title-001500.png` (`x=0..24`) and right edge in `title-006500.png` (`x=942..959`).

5. **[Major] Professor Cutscene Ends on a Near-Black Frame (`prof-p4-end`) and Renders `"아가핀"` Nearly Invisible Against the Hedge (`prof-p4`)**
   - **Evidence**: `/home/main/claude-viz/astra-opening-2/prof-p4-end-065766.jpg` (`/tmp/astra-cap7/frames/prof-p4-end-065766.png`), `/tmp/astra-cap7/frames/prof-p4-063065.png`, `/tmp/astra-cap7/frames/prof-p1-end-052239.png`
   - **Impact**: In `/tmp/astra-cap7/frames/prof-p4-063065.png`, the third starter label `"아가핀"` (`x=742..822, y=408..435`) is barely visible (`max RGB 151,174,138` over `RGB 90,136,88` foliage, contrast `< 1.6:1`) compared to the bright white `"토리프"` and `"숯꼬미"` labels. Immediately afterward, `prof-p4-end-065766.jpg` drops the entire screen to a near-black frame (`meanRGB=[17.7, 17.7, 13.6]`, max pixel value `42/255`).

---

## Overall Verdict

**FAIL**

While the field intro and title sky are now bright and the bedroom arrival dialogue uses a clean GBA-style frame, the opening as a whole still fails to read as a cohesive Gen 3 opening due to three blocker-level visual defects: (1) the player shrink sequence (`stage-1-*`) happens over the Professor's Lab tilemap while displaying the `"| 다우닝 시티 · 내 방"` banner and crossfading both rooms on top of each other; (2) the Professor speech and gender/name confirmation paste giant sprites (`토리프`, the `378x376px` Professor bust, and the `136x216px` hero) directly over top-down lab furniture, bookshelves, choice boxes, and subtitle text; and (3) the Name Entry screen remains a dark night-sky starfield that clips the 5th Hangul keyboard row (`마`–`하`).
