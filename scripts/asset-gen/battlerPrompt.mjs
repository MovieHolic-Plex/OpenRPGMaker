// 아군 배틀러 생성의 **화풍 계약**. 여러 생성기(전투 캐릭터셋, 포즈 행 확장, 포켓몬 뒷모습)가
// 같은 문구를 공유해야 나란히 놓았을 때 튀지 않는다. 문구를 고치면 이미 출하된 시트와
// 어긋나므로, 새 포즈·새 시점을 추가할 때는 **여기에 더하고 기존 문단은 건드리지 않는다**.
//
// 전투 화면의 기준은 **이미 출하된 몬스터 배틀러**다(초원 슬라임 등): 굵은 사각 픽셀,
// 납작한 셀 셰이딩, 1px 짙은 외곽선, 높은 채도. 이전 시트가 어색했던 실측 원인 3개를
// 프롬프트로 못 박는다:
//   1. 정면 보행 스프라이트였다 → 측면(좌향) 전투 포즈를 강제한다.
//   2. 48px 셀 안에서 24px 밖에 안 차서 적보다 절반 크기로 보였다 → 전신이 프레임을 채우게 한다.
//   3. 4인의 화풍·명도가 서로 달랐다 → 공통 STYLE 문단을 전원에 붙인다.

export const STYLE = [
  "16-bit SNES era Japanese RPG battle sprite, in the visual style of RPG Maker 2003 battle graphics.",
  "Texture: hand-drawn pixel art with visibly chunky square pixels, a limited palette of roughly 16 flat",
  "saturated colors, a solid near-black outline one pixel thick around the entire silhouette, cel shading in",
  "two or three flat steps with a single light source from the upper left, and small specular highlights as",
  "flat light patches. Bold readable shapes: the head is large, the hands and weapon are oversized,",
  "the costume reads instantly from a distance.",
  "Absolutely no anti-aliasing, no soft gradients, no blur, no glow bloom, no noise, no dithering texture,",
  "no painterly brush strokes, no airbrush, no 3D render, no photorealism.",
].join(" ");

export const COMPOSITION = [
  "Composition: exactly one full-body character seen from the SIDE, a true side-view profile facing to the",
  "LEFT of the frame — the character's nose, chest and weapon all point left, and we see the left side of the",
  "body, not the front. The torso is turned to the left in profile and must not face the viewer.",
  "This is a player-side battler that stands on the right of a battlefield and faces the",
  "enemies on the left. The whole body from the top of the head to the soles of the feet fills about 90 percent",
  "of the frame height, standing centered with a small even margin, feet level near the bottom edge.",
  "Every weapon, shield and prop stays gripped in a hand or strapped to a limb, physically touching the body.",
  "No ground line, no platform, no shadow under the feet.",
].join(" ");

// "투명 배경" 을 요구하면 생성 모델이 투명을 체커보드 픽셀로 그려버린다 — 알파가 없다.
// 그래서 단색 마젠타로 받아 spriteProcess.mjs 에서 크로마키한다.
export const BACKGROUND = [
  "Background: every single pixel that is not the character must be exactly one flat uniform solid pure magenta,",
  "hex #FF00FF. That magenta must be one constant color across the whole background with no gradient,",
  "no shading, no vignette, no texture, no pattern and no lighting variation.",
].join(" ");

export const NEGATIVE = [
  "Do NOT draw any of the following: border, frame, box, panel, rectangle outline, inner margin line,",
  "drop shadow, ground shadow, contact shadow, reflection, checkerboard or transparency grid,",
  "gradient background, scenery, floor, horizon, text, letters, numbers, labels, watermark, signature,",
  "UI elements, health bars, multiple characters, duplicated copies, collage, grid of variations,",
  "sprite sheet, animation strip, or a front-facing walking sprite.",
  "Do NOT draw a detached, floating, thrown or dropped weapon or shield lying separately from the body,",
  "a second copy of the head, face, arm, leg, weapon or shield, or any extra object the character is not holding.",
  "Exactly one character, nothing else.",
].join(" ");

/**
 * 뒷모습(포켓몬식 후면 뷰) 전용 구도. COMPOSITION 을 쓰면 안 된다 — 그건 **좌향 측면**을
 * 강제하는데, 여기서 필요한 건 등을 보이는 후면 3/4 다.
 *
 * 시선 방향은 **자산에 굽는다**. 아군은 화면 좌하단에 서고 적은 우상단에 서므로 머리가
 * **우상단**을 향해야 한다.
 *
 * 미러링은 없다. `18-pokemon-layout-redesign.css:48` 의 레거시 `transform: scaleX(-1)` 은
 * `battle-skins/_battlers.css:32-36` 의 `transform: none !important` 가 덮는다 — 같은 요소를
 * 더 구체적인 선택자(`.battle-skin-actor-image`)로 다시 잡아 취소한다. 그 파일 주석이 근거를
 * 밝힌다: "몬스터 뒷모습 스프라이트는 이미 후면이라 flip 불필요. 시선 방향(우상단 적 응시)은
 * 자산에 구웠다(ally-creature-back.png 재생성, 머리 우측 프로필)."
 *
 * 실측(2026-08-29, 실제 전투 화면 QA): 아군 이미지의 computed `transform` 은 `none` 이다.
 * 초기 구현은 미러링이 걸린다고 보고 머리를 **좌상단**으로 지시했다 — 전제가 틀렸다.
 */
export const COMPOSITION_BACK = [
  "Composition: exactly one full-body character seen from BEHIND. The camera stands behind the character and",
  "looks at their back. We see the back of the skull and the back of the hair, the shoulder blades, the spine",
  "line of the costume, the backs of both arms, the seat and the backs of both legs and heels.",
  "Rotate the body only about 20 degrees off dead-centre-rear, just enough that one shoulder reads as nearer.",
  "THE FACE IS COMPLETELY HIDDEN BY THE BACK OF THE HEAD. Do not draw eyes, eyebrows, nose, mouth, chin or",
  "any facial feature anywhere in the image — not even in profile, not even one eye, not even a turned-around",
  "glance over the shoulder. If any eye is visible the drawing is wrong. The front of the torso, the chest",
  "emblem and the belt buckle are all hidden behind the body and must not appear.",
  "The character is looking away from the camera toward a distant opponent at the UPPER RIGHT of the frame,",
  "so the head is seen from behind and slightly angled right. This is exactly the back sprite of the player's",
  "own party member in a Pokemon battle, drawn from over that party member's shoulder.",
  "The whole body from the top of the head to the soles of the feet fills about 80 percent of the frame height,",
  "standing centered. There MUST be a clear band of empty magenta along all four edges of the image: the",
  "character, the hair, the weapon and every prop must not touch the top, bottom, left or right edge.",
  "Every weapon, shield and prop stays gripped in a hand or strapped to a limb, physically touching the body.",
  "No ground line, no platform, no shadow under the feet.",
].join(" ");

/**
 * 뒷모습 전용 금지 목록. 공통 NEGATIVE 에 **얼굴 금지**를 더한다 — 실측: 공통 목록만 붙였더니
 * hero-01 이 참조 컷을 거의 그대로 베껴 눈·코·입이 다 보이는 정면 3/4 이 나왔다. 공통 목록에는
 * "정면 보행 스프라이트 금지" 만 있어서, 정면 **전투** 포즈는 아무것도 막지 않았다.
 */
export const NEGATIVE_BACK = [
  NEGATIVE,
  "Additionally, because this is a rear view, do NOT draw: a face, eyes, eyebrows, pupils, a nose, a mouth,",
  "lips, teeth, a chin, a facial expression, a head turned back toward the camera, a front view, a",
  "three-quarter front view, a side profile, the front of the chest, a chest emblem, a front belt buckle,",
  "or the palms of the hands facing the camera.",
  "The character must never make eye contact with the viewer, because their face is turned away.",
].join(" ");

// 같은 인물을 포즈마다 따로 뽑으면 텍스트 프롬프트만으로는 **다른 사람이 나온다**(실측:
// hero-03 의 hit 만 재생성했더니 후드가 사라지고 체형이 굵어졌다 — 출하된 세 프레임과 나란히
// 놓으면 바로 보인다). 세션이 호출마다 격리돼 프레임끼리 서로를 못 보기 때문이다.
// grok 은 에이전트라 파일 읽기 툴로 로컬 이미지를 실제로 본다(실측: 48px 을 384px 로 확대한
// 파일에서 "pointed purple hood … dark purple robe with gold hem trim" 을 정확히 읽었다).
// 그래서 승인된 프레임을 세션 cwd 에 reference.png 로 깔고 그걸 보게 해서 디자인을 고정한다.
//
// 참조만 물리면 **포즈까지 베낀다**(실측: pose-diff 24.1% — 기준 컷과 거의 동일). 아래
// CRITICAL 문단이 그걸 막는다. 넣은 뒤 58.0% 로 올라가면서 캐릭터 일치는 95.2% 로 유지됐다.
export const REFERENCE_NEW_POSE = [
  "Before generating anything, open the image file reference.png in the current directory with your",
  "file-reading tool and study it. It is the SAME character you must draw, in a different pose.",
  "Reproduce that exact character design: identical hair colour and length, identical headwear including",
  "whether a hood is up or down, identical face, identical body build and height, identical clothing colours,",
  "trim and silhouette, and the identical weapon or item held in the same hand.",
  "Match its pixel-art style, palette and outline weight.",
  "CRITICAL: reference.png shows this character in a DIFFERENT, resting pose. Do NOT copy that pose.",
  "Ignore its posture, its limb positions and its facial expression completely.",
  "Use reference.png ONLY as a guide to who the character is — appearance, costume, palette and style.",
  "The pose you draw is the one described next, and it must read as clearly and dramatically different",
  "from the reference's stance at a glance.",
].join(" ");

/**
 * 뒷모습(포켓몬식 후면 뷰) 전용 참조 문구. REFERENCE_NEW_POSE 를 쓰면 안 된다 —
 * 여기서 바꿀 건 **시점**이고 자세는 기준 컷 그대로 유지하는 게 맞다.
 */
export const REFERENCE_BACK_VIEW = [
  "Before generating anything, open the image file reference.png in the current directory with your",
  "file-reading tool and study it. reference.png shows the SAME character from the FRONT.",
  "It tells you WHO to draw, and nothing about where the camera goes.",
  "Take from it: hair colour and length, headwear, body build and height, clothing colours, trim and",
  "silhouette, and which weapon or item is carried. Match its pixel-art style, palette and outline weight.",
  "Then walk around behind that character and draw what you now see from that new position: their BACK.",
  "Keep the same relaxed standing stance and the same limb arrangement, but everything that faced the camera",
  "in reference.png is now hidden, and everything that was hidden behind the body is now what we see.",
  "So: the back of the skull instead of the face, the back of the costume instead of its front, the hair",
  "falling down the nape, and the back of any cape, quiver, scabbard, sash or strap.",
  "A rear view of a character necessarily has NO visible face. Weapons stay in the same hands, now seen",
  "from behind, so a shield reads as its plain back and straps rather than its decorated face.",
].join(" ");

/**
 * 포즈 표. `col`/`row` 는 144×384 시트(48px 셀 3열×8행) 안의 좌표다.
 * 런타임이 어느 좌표를 읽는지는 src/battle/battlePose.ts 와 src/player/battleFieldDom.ts 가 정한다.
 */
export const POSES = [
  {
    id: "idle",
    col: 0,
    row: 0,
    beat: "Pose: battle-ready idle stance, weight on the back foot, weapon held up and ready, head level and looking left at the enemy, calm alert expression.",
  },
  {
    id: "attack",
    col: 1,
    row: 0,
    beat: "Pose: mid-attack lunge to the left, front leg driven forward and torso leaning left, weapon swung out to the left at full extension past the body, mouth open in a shout, hair and cloth trailing to the right.",
  },
  {
    id: "hit",
    col: 2,
    row: 0,
    beat: "Pose: staggering backwards to the right after taking a hit, feet planted apart with the front knee bent, torso leaning back a little, head tilted back with the eyes squeezed shut and teeth clenched in pain, the free hand clutched against the chest, and the weapon still held firmly in the other hand and lowered across the front of the body. The whole body stays in a clear left-facing side view.",
  },
  // 행 1 (2026-08-29). idle 과 실루엣이 뚜렷이 달라야 하고, dead 는 hit(비틀거림)과도
  // 달라야 한다 — 계약 테스트가 셀 간 마스크 차이를 재고, 그게 이 행의 존재 이유다.
  // 손을 특정하지 않는다: 궁수처럼 양손이 다 찬 캐릭터에서 "빈 손" 을 전제하면 포즈가
  // 무너진다(실측: hit 이 서 있는 궁수와 19.6% 밖에 차이나지 않았다).
  {
    id: "defend",
    col: 0,
    row: 1,
    beat: "Pose: braced defensive crouch facing left, knees deeply bent so the whole figure is visibly lower and more compact than a standing stance, shoulders hunched and turned in toward the enemy, both arms pulled in tight to bring the shield or weapon up across the chest and face as a barrier on the left side, chin tucked down behind that guard, eyes narrowed and watching over the top of it. The stance is low, wide and closed — clearly not an upright ready pose.",
  },
  {
    id: "dead",
    col: 1,
    row: 1,
    beat: "Pose: knocked out of the fight and collapsed on the ground, lying on the side with the torso down near the ground and the head lowest of all, one arm sprawled out limp and the legs folded loosely beneath, eyes closed and face slack with no tension anywhere in the body, the weapon fallen from the hand and lying on the ground beside the figure. The silhouette is wide and low and horizontal — the figure must NOT be standing, kneeling upright or holding itself up. Because this pose is wide, draw the figure SMALLER: the whole body from the top of the head to the feet, and the fallen weapon, must fit well inside the frame with clear empty magenta margin on all four sides. The body must never touch the left or right edge of the image.",
  },
  // 행 1 열 2 (2026-09-26). 런타임 victoryFrameFor 가 셀을 재서 비어 있으면 idle 로
  // 떨어진다 — 그림이 생기면 승리 포즈가 전투 화면에 보인다. idle 과 실루엣이 달라야 한다.
  {
    id: "victory",
    col: 2,
    row: 1,
    beat: "Pose: triumphant victory celebration after winning the battle, still in a left-facing side view. The weapon or main item is thrust straight up high overhead at full arm extension, or planted firmly point-down on the ground beside the body, and the other hand is clenched in a raised fist pump at shoulder height. Chest puffed out, back straight and chin lifted proudly, a big open-mouthed grin with the eyes bright. The raised arm makes the silhouette clearly taller and more vertical than a battle-ready stance — it must not look like the ready idle pose. Keep the whole figure, including the raised weapon, well inside the frame with clear empty magenta margin on all four sides.",
  },
];

/** 얼굴/직업은 기본 DB(defaultDatabasePartyRecords.ts)의 액터들과 짝을 맞춘다. */
export const HEROES = [
  {
    slug: "hero-01",
    ko: "주인공",
    who: [
      "A young human swordsman hero: spiky copper-orange hair, a sleeveless royal-blue tunic over a white shirt,",
      "brown leather belt and boots, red shoulder guard, holding a straight steel short sword in his right hand",
      "and a small round wooden shield with an iron rim on his left arm.",
    ].join(" "),
  },
  {
    slug: "hero-02",
    ko: "수호자",
    who: [
      "A stout human guardian knight: full plate armour in polished steel with crimson trim and a crimson cape,",
      "a closed helmet with a short red crest, a large kite shield strapped flat against his left forearm and held",
      "close in front of his chest, and a heavy broad-bladed war axe gripped in his right hand.",
    ].join(" "),
  },
  {
    slug: "hero-03",
    ko: "마도사",
    who: [
      "A slender human sorceress: long violet hair, a deep indigo hooded robe with gold hem and wide sleeves,",
      "a small silver moon pendant, holding a tall wooden staff topped with a glowing cyan crystal in both hands.",
    ].join(" "),
  },
  {
    slug: "hero-04",
    ko: "정찰병",
    who: [
      "A wiry human scout: short dark-green hair under a leather headband, light tan leather jerkin over a forest",
      "green shirt, cross-body strap and small pouches, cloth wraps on the forearms, holding a curved hunting",
      "dagger in the right hand and a short recurve bow in the left.",
    ].join(" "),
  },
  // hero-05·06 은 실루엣이 기존 인물과 겹치기 쉬워 차별화를 서술에 못 박는다.
  //   성직자 vs 수호자(hero-02): 둘 다 금속 갑옷이 될 수 있다 → 성직자는 **흰 로브 + 후드 없음**,
  //     무기는 도끼가 아니라 **철퇴**, 실루엣은 판금의 각진 어깨가 아니라 흐르는 천이다.
  //   궁수 vs 정찰병(hero-04): 둘 다 가죽 + 활이다 → 정찰병은 단검을 들고 활은 왼손에 **내린**
  //     상태고, 궁수는 **긴 장궁을 두 손으로 당겨** 든다. 색도 초록 대비 적갈색으로 가른다.
  {
    slug: "hero-05",
    ko: "성직자",
    who: [
      "A calm human cleric: shoulder-length pale blonde hair with no hood and no helmet, a flowing white robe",
      "with wide sleeves and a deep teal sash and teal hem trim, a large golden sun emblem on the chest,",
      "simple sandals, holding a short gold-headed mace in the right hand and a closed leather-bound tome",
      "hugged against the chest in the left arm. Silhouette is soft flowing cloth, never angular plate armour.",
    ].join(" "),
  },
  // 실측 두 번의 교정이 들어 있다(2026-08-29):
  //  1) 채움 33.9% (출하 4인 38.1~45.0%) — 활을 몸에서 멀리 뻗어 바운딩 박스만 넓고 픽셀은
  //     얇았다. 48px 로 줄이면 다른 다섯보다 작아 보인다 → 체구를 두껍게, 활은 몸에 겹치게.
  //  2) hit 포즈 구분 13.4% (출하 42.8~54.6%) — **`who` 에 동작을 박은 게 원인이었다.**
  //     "string pulled back to the cheek and an arrow nocked" 가 인물 서술에 있으니 idle·attack·hit
  //     세 프레임 전부 활을 당긴 같은 그림이 나왔다(attack 과 hit 의 content 가 942×961 로 동일).
  //     출하된 정찰병(hero-04)은 "활을 왼손에 들고 있다" 는 **소유**만 적어서 포즈가 자유롭다.
  //     그래서 여기도 소유만 적고, 당기는지 내리는지는 POSES 의 beat 가 정하게 둔다.
  {
    slug: "hero-06",
    ko: "궁수",
    who: [
      "A broad-shouldered, sturdily built human archer: long auburn hair tied in a high ponytail, a thick padded",
      "russet-brown quilted gambeson with heavy overlapping shoulder rolls and warm ochre trim, over dark grey",
      "trousers and tall brown boots, a wide leather bracer on the left forearm, and a full arrow quiver on the",
      "back with green feathered fletching showing over the shoulder.",
      "He carries a tall wooden longbow gripped in his left hand and a single arrow in his right.",
      "The bow is carried CLOSE to the body so its arc crosses in front of the torso and overlaps it, never held",
      "far out at arm's length. The body is thick and heavy enough to fill the frame like a knight; the bow arc is",
      "a silhouette accent, not the widest thing in the picture. Never a dagger.",
    ].join(" "),
    // 공통 hit 문구는 "빈 손을 가슴에 움켜쥔다" 를 전제한다. 궁수는 활+화살로 양손이 차 있어
    // 그 지시를 못 따르고 결국 idle 과 같은 그림이 나왔다(포즈 구분 19.6%). 그래서 팔 배치를
    // 직접 지정한다 — 활을 든 팔은 아래로, 다른 팔은 뒤로 크게 벌려 비대칭 실루엣을 만든다.
    poseOverrides: {
      // 공통 attack 문구의 "weapon swung out to the left at full extension past the body" 를
      // 장궁에 적용하면 활 + 뻗은 두 팔이 프레임을 가로로 꽉 채운다. 그러면 피사체가 변에 닿아
      // flood fill 이 막히고 외곽선에 마젠타가 남는다(실측: content 1024×1024 와 1024×984 로
      // 두 번 연속 마진 게이트에 걸렸다). 그래서 활을 뻗지 않고 **쏘는 순간**으로 바꾼다.
      attack: [
        "Pose: the instant of releasing the arrow. The bow arm is punched forward and down to the left but the",
        "elbow stays bent so the bow does not reach the edge of the picture, the bowstring has snapped straight,",
        "the drawing hand has just flown back past the cheek with the fingers open, the torso is rotated into the",
        "shot and leaning left, the front leg is planted and the back leg braced, and the mouth is open in a shout.",
        "The ponytail and the quiver fletching whip to the right.",
        "IMPORTANT: the entire figure, including the whole bow, must fit well inside the frame with clear empty",
        "magenta margin on all four sides. Nothing may touch or cross any edge of the picture.",
      ].join(" "),
      hit: [
        "Pose: reeling backwards to the right after taking a hit. The torso is twisted away from the enemy and",
        "arched back, the head thrown back with the eyes squeezed shut and teeth clenched in pain, the front knee",
        "buckling inward and the back leg braced wide apart. The bow arm hangs down and back along the right side",
        "of the body with the bow tilted low and slack, still gripped in the hand. The other arm is flung out",
        "backwards and upward away from the body for balance, elbow bent, fingers spread.",
        "The silhouette is wide and asymmetric and must not resemble a standing archer.",
        "The whole body stays in a clear left-facing side view.",
      ].join(" "),
    },
  },
];

/**
 * 인물의 포즈 문구를 고른다. 공통 `POSES[].beat` 는 **한 손에 무기, 다른 손은 비어 있다**를
 * 전제한다("the free hand clutched against the chest"). 양손이 다 찬 인물에게 그대로 쓰면
 * 자세가 안 바뀐다(실측: 궁수 hit 의 포즈 구분 19.6%, 출하 밴드는 42.8~54.6%).
 * 그런 인물만 `poseOverrides` 로 덮어쓴다 — 나머지는 공통 문구를 그대로 쓰므로 이미 출하된
 * 프롬프트가 한 글자도 바뀌지 않는다.
 */
export function beatFor(hero, pose) {
  return hero.poseOverrides?.[pose.id] ?? pose.beat;
}

/** 생성 프롬프트 조립. `reference` 는 REFERENCE_* 중 하나이거나 null. */
export function battlerPrompt({ who, beat, savePath, reference = null }) {
  return [
    "Use your image generation tool exactly once to draw ONE JRPG battle sprite, then stop.",
    "Do not ask questions. Do not critique your own output. Do not regenerate or iterate.",
    ...(reference ? [reference] : []),
    `Subject: ${who}`,
    beat,
    STYLE,
    COMPOSITION,
    BACKGROUND,
    NEGATIVE,
    "When the image exists, copy the generated image file itself, unmodified and without any resizing,",
    `re-encoding, cropping or background edit, to exactly this path: ${savePath}`,
    "Then print the single word DONE and finish.",
  ].join(" ");
}

/**
 * 뒷모습 프롬프트 조립. `battlerPrompt` 와 갈라 두는 이유는 구도 문단이 다르고(좌향 측면 ↔
 * 후면 3/4) 포즈 비트가 없기 때문이다 — 자세는 참조 컷 그대로 유지한다.
 */
export function backViewPrompt({ who, savePath }) {
  return [
    "Use your image generation tool exactly once to draw ONE JRPG battle sprite, then stop.",
    "Do not ask questions. Do not critique your own output. Do not regenerate or iterate.",
    // 시점을 맨 앞에 한 번 못 박는다 — 참조 문단보다 먼저 와야 참조가 "베껴라" 로 읽히지 않는다.
    "TASK: draw the BACK of one character. This is a rear-view sprite: the camera is behind the character,",
    "we see their back, and their face is not visible at all. That single requirement outranks everything else",
    "below — if you must choose between matching the reference picture and showing the back, show the back.",
    REFERENCE_BACK_VIEW,
    // `who` 는 정면 기준 서술이다(예: "얼굴", "가슴의 문장"). 그대로 두면 카메라를 앞으로 끌어당긴다.
    "The following description tells you who the character is. It was written describing them from the front,",
    "so treat any front-only detail in it as hidden: it identifies the character, it does not place the camera.",
    `Subject: ${who}`,
    STYLE,
    COMPOSITION_BACK,
    BACKGROUND,
    NEGATIVE_BACK,
    // 저장 지시 바로 앞에 한 번 더 — 마지막 문장이 가장 잘 지켜진다(실측: 정면이 나온 시도에는 없었다).
    "Check the image before you save it: you must be looking at the back of the character's head and body,",
    "with no eyes and no face anywhere in the picture. If a face is visible, the image is wrong.",
    "When the image exists, copy the generated image file itself, unmodified and without any resizing,",
    `re-encoding, cropping or background edit, to exactly this path: ${savePath}`,
    "Then print the single word DONE and finish.",
  ].join(" ");
}
