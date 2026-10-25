# Astra Horizon Visual QA Review (Round 2)

Reviewed all 21 full-resolution PNG files in `/tmp/astra-review/shots2/`:
- `/tmp/astra-review/shots2/op_intro-p2-048678.png` (960x640)
- `/tmp/astra-review/shots2/op_intro-p3-052838.png` (960x640)
- `/tmp/astra-review/shots2/op_intro-p3-054637.png` (960x640)
- `/tmp/astra-review/shots2/op_intro-p4-059958.png` (960x640)
- `/tmp/astra-review/shots2/op_title-006500.png` (960x640)
- `/tmp/astra-review/shots2/op_prof-p1-085014.png` (960x640)
- `/tmp/astra-review/shots2/op_prof-p2-089419.png` (960x640)
- `/tmp/astra-review/shots2/op_prof-p2-end-092307.png` (960x640)
- `/tmp/astra-review/shots2/op_prof-p4-099261.png` (960x640)
- `/tmp/astra-review/shots2/op_choice-115063.png` (960x640)
- `/tmp/astra-review/shots2/op_name-showcase-120617.png` (960x640)
- `/tmp/astra-review/shots2/op_name-confirm-121180.png` (960x640)
- `/tmp/astra-review/shots2/op_name-after-123157.png` (960x640)
- `/tmp/astra-review/shots2/first-town-grove_01-arrive.png` (960x540)
- `/tmp/astra-review/shots2/champion_02-talk.png` (960x540)
- `/tmp/astra-review/shots2/champion_03-battle.png` (960x540)
- `/tmp/astra-review/shots2/champion_04-command.png` (960x540)
- `/tmp/astra-review/shots2/ending_02-talk.png` (960x540)
- `/tmp/astra-review/shots2/ending_04-win.png` (960x540)
- `/tmp/astra-review/shots2/ending_05-ending-epilogue.png` (960x540)
- `/tmp/astra-review/shots2/ending_06-ending-final.png` (960x540)

---

## Verification of Previous Review Complaints

1. **Ending epilogue/final text unreadable under a dim layer (ending_05, ending_06): FIXED**
   - Evidence: `/tmp/astra-review/shots2/ending_05-ending-epilogue.png` and `/tmp/astra-review/shots2/ending_06-ending-final.png`.
   - Details: All text is now rendered above the dim overlay with high luminance contrast against the darkened coastal backdrop (`RGB 5,11,19` to `6,12,22`). In `/tmp/astra-review/shots2/ending_05-ending-epilogue.png`, `"우리의 여정"` (`RGB 181,171,153`, 8.54:1 contrast), `"아스트라 호라이즌"` / `"여명의 날개"` (`RGB 223,211,184`, 13.22:1 / 13.29:1), and `"Z / Enter 계속"` (`RGB 147,140,130`, 6.00:1) are crisp and legible. In `/tmp/astra-review/shots2/ending_06-ending-final.png`, `"끝"` (`RGB 223,211,184`, 13.15:1), `"아스트라 호라이즌 - 여명의 날개"` (`RGB 153,146,131`, 6.04:1), `"플레이 시간: 1분"` (`RGB 181,172,150`, 8.67:1), and `"> 타이틀로 돌아가기"` (`RGB 242,229,200`, 15.99:1) are all clearly readable.

2. **Hero sprite missing in the champion talk (champion_02-talk): FIXED**
   - Evidence: `/tmp/astra-review/shots2/champion_02-talk.png` (and `/tmp/astra-review/shots2/ending_02-talk.png`).
   - Details: The male hero sprite (teal cap, yellow backpack, facing north at `x=456..504, y=176..265`) is present at center arena directly below the purple-haired champion NPC (`y=135..200`), with the green starter follower (`토리프`, `y=252..305`) behind him.

3. **The region flyover showing a blank blue frame, or an interior map with room walls (op_prof-p1/p2 frames): NOT FIXED**
   - Evidence: `/tmp/astra-review/shots2/op_prof-p1-085014.png`, `/tmp/astra-review/shots2/op_prof-p2-089419.png`, and `/tmp/astra-review/shots2/op_prof-p2-end-092307.png`.
   - Details: While there is no longer a 100% blank blue frame and `p2` / `p2-end` now pan across outdoor maps (`"1번 도로 - 새싹 들길"` and `"다우닝 시티"`), both underlying problems remain visible:
     - `/tmp/astra-review/shots2/op_prof-p1-085014.png` still shows an indoor room map (the Professor's lab) with white side walls (`x=40..63`, `x=896..920`) and dark pillarbox bars (`x=0..39`, `x=921..959`).
     - `/tmp/astra-review/shots2/op_prof-p2-089419.png` exposes an `83px`-wide unmapped blank blue-white sky gradient band on the left (`x=9..91, y=0..639`, plus a `9px` adjacent-map water sliver at `x=0..8`) and a `60px`-wide blank sky gradient band on the right (`x=900..959, y=0..639`), with two flying bird sprites and their ground shadows (`x=11..90, y=230..335`) floating over empty sky void.
     - `/tmp/astra-review/shots2/op_prof-p2-end-092307.png` exposes an `81px`-wide vertical blank blue-white sky gradient gap (`x=562..642, y=0..639`) splitting the left town map from the right map, again with bird ground shadows (`y=310..325`) rendered over the empty gradient gap.

4. **Name entry: no visible name bar/buttons; the confirm burst covering the hero's face and rays only on one side (op_name-showcase, op_name-confirm): FIXED**
   - Evidence: `/tmp/astra-review/shots2/op_name-showcase-120617.png` and `/tmp/astra-review/shots2/op_name-confirm-121180.png`.
   - Details: All three reported defects are fixed:
     - Name header (`"이름 입력"`), 6-character name bar (`"루 나 _ _ _ _"` at `y=85..170`), `"가나다"` / `"ABC"` toggle buttons (`y=192..242`), and `"지우기"` / `"확정"` action buttons (`y=552..615`) are clearly visible.
     - In `/tmp/astra-review/shots2/op_name-confirm-121180.png`, the golden glow and burst rays render behind the hero sprite; the hero's face (`RGB 254,221,177`), hair, and cap (`cap_top_y=266`) remain unoccluded.
     - Twelve golden rays now radiate around all 360 degrees (`25, 58, 92, 126, 159, 190, 219, 247, 273, 299, 325, 355` degrees) rather than one side.
     - Note: Shrinking the keyboard box to fit the name bar and buttons introduced a new clipping bug on the 5th Hangul key row (listed under Blocker #2 below).

5. **Intro "!" emotes floating away from heads or missing on one starter; starters' feet cut by the bottom letterbox (op_intro-p3-*): FIXED**
   - Evidence: `/tmp/astra-review/shots2/op_intro-p3-052838.png` and `/tmp/astra-review/shots2/op_intro-p3-054637.png`.
   - Details: All three starters are present with `"!"` emote boxes (`x=236..288`, `x=478..530`, `x=719..771` at `y=314..361` in `/tmp/astra-review/shots2/op_intro-p3-054637.png`), none are floating far away in the sky, and all three starters' feet/fins clear the `y=576` bottom letterbox by `67px-77px` (bottoms at `y=506`, `y=509`, and `y=499..503`). However, placing all three emotes at a uniform `y=314..361` causes minor overlap onto the taller horns/crest of the middle and right starters (listed under Major #8 below).

---

## New and Remaining Problems (Ranked by Severity)

### Blocker

1. **[Rendering / Capture State] Completely blank near-black battle screen**
   - Evidence file: `/tmp/astra-review/shots2/champion_03-battle.png`
   - Screen region: Full active viewport (`x=120..839, y=30..509`)
   - Description: The entire `720x480` game viewport is a solid near-black fill (`RGB 5,7,12`) inside black borders (`RGB 0,0,0`) with zero sprites, trainer intro, or battle UI; intended battle-start visuals are not visible in screenshots.

2. **[UI Layout / Input Clipping] Hangul keyboard container cuts off the 5th row and hides `마` through `하`**
   - Evidence file: `/tmp/astra-review/shots2/op_name-showcase-120617.png`, `/tmp/astra-review/shots2/op_name-confirm-121180.png`
   - Screen region: Hangul key grid bottom edge (`x=324..932, y=508..527`)
   - Description: Only four syllable rows (`가` through `리`) fit inside the keyboard box while the 5th row is sliced horizontally after its top `12px` (`y=514..526`) with no visible scrollbar; whether `마` through `하` can be reached by scrolling is not visible in screenshots.

### Major

3. **[Map Bounds / Flyover Camera] Region flyover exposes wide blank sky-gradient bands and adjacent-map slivers**
   - Evidence file: `/tmp/astra-review/shots2/op_prof-p2-089419.png`, `/tmp/astra-review/shots2/op_prof-p2-end-092307.png`
   - Screen region: Left/right bands (`x=0..91`, `x=900..959` in `op_prof-p2-089419.png`) and central vertical band (`x=562..642, y=0..639` in `op_prof-p2-end-092307.png`)
   - Description: Camera framing extends past outdoor map edges and between disconnected maps, exposing `60px-83px` vertical strips of raw blue-white backdrop gradient (plus a `9px` water tile sliver at `x=0..8`) with flying bird shadows rendered over empty sky.

4. **[Scene Staging / Tile Artifact] Professor intro `p1` still uses a pillarboxed indoor room map and has a stray floor pixel artifact**
   - Evidence file: `/tmp/astra-review/shots2/op_prof-p1-085014.png`
   - Screen region: Outer side walls/bars (`x=0..63`, `x=896..959`) and center-top white floor (`x=482..487, y=152..167`)
   - Description: `op_prof-p1` renders the top-down indoor lab room with walls and dark side bars instead of an intro stage/flyover, and a stray `6x16px` red-pink/gray pixel fragment sits on the empty floor tiles directly above the Professor's head.

5. **[Sprite Framing / Clipping] Green starter sprite is cut off by the right screen edge on the title screen**
   - Evidence file: `/tmp/astra-review/shots2/op_title-006500.png`
   - Screen region: Bottom-right corner (`x=898..959, y=525..605`)
   - Description: The grass starter (`토리프`) on the bottom-right is positioned too far right, slicing its body and coiled tail cleanly off at column `x=959`.

6. **[Dialogue / Checkpoint State] `ending_02-talk.png` duplicates pre-battle `champion_02-talk.png`, and both capture incomplete mid-fade text**
   - Evidence file: `/tmp/astra-review/shots2/champion_02-talk.png`, `/tmp/astra-review/shots2/ending_02-talk.png`
   - Screen region: Bottom dialogue box (`x=120..839, y=390..509`)
   - Description: `ending_02-talk.png` is pixel-identical to `champion_02-talk.png` except for `867` text pixels (`"같은 마을에서"` vs `"같은 마을에"`), showing an unfinished typewriter fade of the pre-battle line rather than a completed or post-victory dialogue line.

7. **[Background Art / Scale Consistency] Static painted creature on the intro/title hillside clashes in scale and motion with animated starters**
   - Evidence file: `/tmp/astra-review/shots2/op_intro-p3-052838.png`, `/tmp/astra-review/shots2/op_intro-p4-059958.png`, `/tmp/astra-review/shots2/op_title-006500.png`
   - Screen region: Center-right hillside (`x=565..715, y=340..460`)
   - Description: A large brown squirrel/fox painted into the static hill layer stays frozen across every intro and title shot, crowding between the starters in `p3` and appearing larger than both distant houses and the shrunken overworld starters in `p4` and `op_title`.

8. **[VFX / Emote Alignment & Pixel Quality] Intro `"!"` boxes overlap starter horns/crest and display a stretched blocky red bar**
   - Evidence file: `/tmp/astra-review/shots2/op_intro-p3-054637.png`
   - Screen region: Middle and right starter tops (`x=478..530, y=314..361` and `x=719..771, y=314..361`)
   - Description: Using a uniform `y=314..361` height causes the middle and right emote bubbles to overlap `숯꼬미`'s horns (`y=350..361`) and `아가핀`'s wave crest (`y=345..361`), and the `"!"` glyph inside all three bubbles is an overly wide `20px` pink-fringed red rectangle.

### Minor

9. **[Sprite Layering / Silhouette] Follower starter pokes out behind hero's cap like leafy horns in Silvana Town**
   - Evidence file: `/tmp/astra-review/shots2/first-town-grove_01-arrive.png`
   - Screen region: Center road (`x=458..511, y=273..355`)
   - Description: The follower starter (`토리프`) directly behind the hero protrudes symmetrically past both sides of the hero's cap (`y=273..308`), muddying the player silhouette.

10. **[Map Framing / HUD Overlap] Silvana Town arrival clips left shop and right NPC and covers shop roof sign with location banner**
    - Evidence file: `/tmp/astra-review/shots2/first-town-grove_01-arrive.png`
    - Screen region: Top-left (`x=120..320, y=30..218`) and middle-right edge (`x=796..839, y=225..315`)
    - Description: The `"| 실바나 마을"` banner covers the roof sign of a shop already cut in half at `x=120`, while the purple-haired NPC on the right is clipped at the `x=839` viewport edge.

11. **[Tilemap Authoring] Abrupt horizontal cut on upper-right tree column during Route 1 flyover**
    - Evidence file: `/tmp/astra-review/shots2/op_prof-p2-089419.png`
    - Screen region: Upper-right trees above flower patch (`x=698..766, y=90..163`)
    - Description: One tree column terminates in a flat horizontal tile seam at `y=162` exposing trunk/foliage cut-off instead of a rounded lower canopy tile.

12. **[Cutscene Layering] Jagged dark silhouette blob at bottom-left edge of `op_intro-p3-052838.png`**
    - Evidence file: `/tmp/astra-review/shots2/op_intro-p3-052838.png`
    - Screen region: Bottom-left grass (`x=0..92, y=415..555`)
    - Description: A blocky stair-stepped dark silhouette remnant intrudes over the lower-left grass in `052838` and disappears abruptly in `054637`.

13. **[Battle Cohesion / UI Palette] Champion battle switches from cyan arena to beige room and mixes clashing prompt/HUD border colors**
    - Evidence file: `/tmp/astra-review/shots2/champion_02-talk.png`, `/tmp/astra-review/shots2/champion_04-command.png`
    - Screen region: Battle background (`x=120..839, y=30..390`) and bottom-left prompt box (`x=120..522, y=392..509`)
    - Description: The cyan glass champion arena in `champion_02-talk.png` cuts to a plain beige paneled room in `champion_04-command.png`, and the coral-red/dark-teal prompt box clashes with the sage-green/cream HUD and command boxes.

14. **[Overworld Staging] Hero cap overlaps champion's legs and lower-arena NPC cap is sliced at dialogue box top**
    - Evidence file: `/tmp/astra-review/shots2/champion_02-talk.png`, `/tmp/astra-review/shots2/ending_02-talk.png`
    - Screen region: Center (`x=456..504, y=175..205`) and lower-left arena (`x=365..406, y=371..390`)
    - Description: Hero, champion, and follower sprites crowd tightly along the vertical axis while a lower NPC's blue cap peeks `19px` above the dialogue border.

15. **[Viewport / Portrait Chrome] Two-tone outer side bars in bedroom scenes and stepped top-corner bar on bust portrait frames**
    - Evidence file: `/tmp/astra-review/shots2/op_choice-115063.png`, `/tmp/astra-review/shots2/op_name-after-123157.png`, `/tmp/astra-review/shots2/champion_02-talk.png`
    - Screen region: Left/right outer margins (`x=0..104`, `x=855..959`) and portrait top border (`x=24..312, y=214..224` in `op_name-after-123157.png`)
    - Description: Bedroom scenes display nested black (`#000000`) plus dark-navy (`#181820`) side bands above an edge-to-edge `960px` dialogue box, and bust portrait frames have a stepped inner top bar protruding past the outer corner bevels.

16. **[Art Direction / Pixel Grid Consistency] Smooth vector/painterly assets clash with coarse upscaled pixel art and off-center Hall of Fame card**
    - Evidence file: `/tmp/astra-review/shots2/op_intro-p2-048678.png`, `/tmp/astra-review/shots2/ending_04-win.png`, `/tmp/astra-review/shots2/ending_05-ending-epilogue.png`
    - Screen region: Center moon (`x=400..648, y=170..418` in `op_intro-p2-048678.png`) and Hall of Fame / ending canvas (`x=120..839, y=30..509` in `ending_04-win.png`, `ending_05-ending-epilogue.png`)
    - Description: Anti-aliased vector moon circles in `op_intro-p2` and `1px`-detail painterly twilight art in `ending_04/05/06` clash with `4x-5x` blocky upscaled pixel sprites/fonts and an uncentered left-heavy Hall of Fame card (`x=180..473`).

17. **[VFX Framing] Confirm burst left rays clip hard against `x=0` canvas boundary**
    - Evidence file: `/tmp/astra-review/shots2/op_name-confirm-121180.png`
    - Screen region: Far-left edge (`x=0, y=210..425`)
    - Description: Because the hero stands near `x=162`, two left-pointing golden burst rays terminate abruptly at the `x=0` screen edge instead of fading out inside the viewport.

18. **[HUD / Map Composition] Skip button, town banner, and background signboard collide with sprites/buildings in Professor intro**
    - Evidence file: `/tmp/astra-review/shots2/op_prof-p1-085014.png`, `/tmp/astra-review/shots2/op_prof-p2-end-092307.png`, `/tmp/astra-review/shots2/op_prof-p4-099261.png`
    - Screen region: Top-right skip button (`x=790..940, y=16..48` in `p1`), `"다우닝 시티"` banner (`x=69..343, y=202..258` in `p2-end`), and behind `숯꼬미` (`x=370..415, y=214..272` in `p4`)
    - Description: `"Esc - 탭 건너뛰기"` overlaps lab bookshelf/plant in `p1`, `"다우닝 시티"` banner covers a house front door/window in `p2-end`, and a map signboard peeks directly behind `숯꼬미`'s horn in `p4`.
