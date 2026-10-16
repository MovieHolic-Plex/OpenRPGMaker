/**
 * 생성 프롬프트 틀. 문장 하나하나가 실패 사례에서 나왔다 (2026-10-01, qa-runs/hand-monster):
 * - 「front view facing the viewer」 → 마스코트처럼 정면을 보는 그림. 상대는 왼쪽 3/4 로 내 몬스터를 본다.
 * - 마스코트 금지·볼터치 금지가 없으면 큰 머리·홍조 스티커의 치비가 나온다.
 * - 마젠타 단색 캔버스를 참고 이미지로 주지 않으면 검정 배경·불꽃 후광이 자주 붙는다(배경 제거가 안 된다).
 * - 뒷모습은 원본 생성 그림이 아니라 「깨끗한 도트를 키운 것」을 참고로 넣어야 후광·색 번짐이 덜하다.
 */
import type { ActionContract, ScreenVector, SpeciesSeed, StyleContract } from "../seed";

/**
 * 디자인 계약 (2026-10-16, 외부 시험자 지적 「귀엽지 않다 / 강해 보이지만 특징이 없다 / 어딘가 특출나게 강조된 곳이 있어야 한다」).
 * 이전 프롬프트는 「NOT chibi, NOT kawaii, believable creature anatomy」 라고 적어 실사적 비례의 평평한 동물만 나왔다.
 * 규칙 다섯: ① 시그니처 한 부위 과장 ② 1단계는 chibi 비례(머리 40~50%·큰 눈·짧고 통통한 몸) ③ 진화마다 시그니처가 커지거나 형태가 바뀜,
 * 최종형은 위압감 ④ 실루엣(검정 마스크 64px)으로 종이 구별 ⑤ 몸 색 3~4개 + 포인트 1개. 문서 openwiki/harnesses/monster-collect-species.md 「디자인 규칙」.
 * 귀여움은 비례와 눈에서 나온다 — 홍조·스티커·하트·반짝이는 장식은 여전히 금지(마스코트 스티커처럼 나온 2026-10-01 실패).
 */
export const DESIGN_RULES_VERSION = 3;

/**
 * 눈 규칙 (판본 3, 2026-10-16 — 사용자 지적 「몬스터에 문제가 많다, 눈이라던가」).
 * 판본 2 그림 30장 실측: 눈이 한 점으로 뭉개지거나(rootpig) 하이라이트가 없고(gustchick·aqualing 한쪽) 윤곽에 붙고(kilnclaw) 얼굴 자체가 안 읽히고(frondhare)
 * 줄기눈에 눈동자가 없고(coralpin) 뒷모습에 눈이 비쳤다. 「narrow sharp eyes」(진화형)가 눈 크기를 64px 에서 3화소 아래로 줄이는 주범이었다.
 * 하네스 검사(checks/eyes.ts)가 같은 수치를 쓴다: 주 눈 3×3 화소 이상 + 하이라이트 1화소 + 밝은 얼굴 위(윤곽선과 분리).
 */
export function eyeClause(species: SpeciesSeed): string {
  return [
    species.eyes
      ? `EYES (very important, readable at 64 pixels): ${species.eyes}`
      : "EYES (very important, readable at 64 pixels): draw TWO clearly visible eyes on the face - three-quarter view, the near eye bigger, the far eye a little smaller, both on the same level on the head.",
    "Each eye is a solid dark round or oval pupil (dark brown or black, at least 4 art pixels wide and 4 tall, about a sixth of the head width) with a clearly visible pure-white highlight made of a 2x2 block of art pixels inside the upper-left of the pupil (big enough to survive being scaled down),",
    "sitting on a LIGHT skin area with at least one art pixel of light skin color between the eye and the dark outline - the pupil never touches or merges with the outline, and is never a single dot, a thin slit, a smudge or hidden under hair or leaves.",
    "Lively, alert, sweet expression; eyes are the clearest dark spots on the face.",
  ].join(" ");
}

function proportionClause(stage: 1 | 2 | 3): string {
  if (stage === 1) {
    return [
      "PROPORTIONS (first-stage creature, must be genuinely cute): chibi proportions - the head is 40-50% of the total body height, large round glossy eyes",
      "(each about a fifth of the head width, dark with one white highlight pixel), short plump rounded torso, stubby short limbs, a soft rounded overall silhouette,",
      "gentle sweet expression. The cuteness comes from the proportions and the big eyes, not from decoration: no blush marks, no hearts, no sparkles, no stickers, no wide mascot grin.",
    ].join(" ");
  }
  return [
    "PROPORTIONS (evolved creature, must look imposing): the head is only 25-35% of the body height, determined fierce eyes that are still big and clearly readable (never tiny slits), longer limbs, a heavy powerful build,",
    "a commanding stance (it may rear up on two legs), armor-like or mane-like decoration growing out of the body. It must look clearly more dangerous and more mature than its earlier stage.",
  ].join(" ");
}

function signatureClause(species: SpeciesSeed): string {
  return [
    `SIGNATURE FEATURE (the most important thing in the picture): ${species.signature}.`,
    "Draw this ONE feature boldly exaggerated - much larger than a realistic animal would have, taking a big share of the whole silhouette and being the first thing the eye sees;",
    "keep every other part simple so the signature stands out.",
    "Silhouette test: if the picture is filled solid black, the outline alone must still be unique and recognizable from this feature - not a generic balanced animal outline.",
  ].join(" ");
}

function colorClause(species: SpeciesSeed): string {
  return [
    "COLOR PLAN: only 3-4 body colors (main, secondary, light belly, dark) with 2-3 shading tones each, dark colored outline (a dark version of the local color, not pure black)",
    species.accent ? `plus ONE vivid accent color (${species.accent}) used only on the signature feature, so the eye lands there.` : "plus one vivid accent color used only on the signature feature.",
  ].join(", ");
}

export function frontPrompt(style: StyleContract, species: SpeciesSeed): string {
  return [
    "Draw on this flat magenta canvas.",
    "Original creature design for a monster-collecting RPG, finished pixel art battle sprite in the style of",
    `${style.reference} opponent sprites (cute, bold, instantly readable monsters).`,
    "Designed by a professional monster designer: a strong readable silhouette and ONE exaggerated signature feature - NOT a realistic zoological animal drawing, NOT a flat well-balanced animal.",
    proportionClause(species.stage),
    signatureClause(species),
    eyeClause(species),
    colorClause(species),
    `Total at most ${style.maxColors - 6} colors. Light from the upper left, flat clean shading areas, no dithering noise, no gradients, no anti-aliasing.`,
    "Pose: three-quarter view turned to the LEFT, standing on its feet, head and chest facing left, tail on the right. NOT facing the viewer.",
    species.stage >= 2
      ? "Every art pixel is one chunky clean square block of about 14x14 image pixels (a coarse low-resolution look); the whole creature is only about 80 art pixels wide and 90 tall, so keep shapes big and simple - no tiny details."
      : "Every art pixel is one clean square block of about 12x12 image pixels; the creature is about 80 art pixels wide.",
    "FRAMING: the entire creature including its signature feature (mane, tail, ears, horns, flames) stays inside the middle 70% of the canvas width and height with a wide empty magenta margin on every side - never larger, never touching the edges.",
    "The whole background stays flat solid pure magenta #FF00FF: absolutely NO glow, NO aura, NO halo, NO embers, NO smoke,",
    "NO light bloom around the creature, no ground, no shadow, no text.",
    `Creature (${species.types.join("/")} type, evolution stage ${species.stage}): ${species.design}`,
    species.palette ? `Main colors: ${species.palette}.` : "",
    style.avoid.length > 0 ? `It must NOT resemble any existing official monster, especially: ${style.avoid.join(", ")}.` : "",
  ].filter(Boolean).join(" ");
}

export function backPrompt(species?: SpeciesSeed): string {
  return [
    "EDIT TASK on the reference pixel art creature sprite (Pokemon Black and White style).",
    "Draw the SAME creature (identical design, colors, markings, palette, outline style, proportions and pixel block size)",
    "as the PLAYER's monster BACK sprite in a monster battle: the camera is BEHIND it and slightly to its left and above,",
    "we see its back, the back of its head and its tail closest to us; it faces AWAY from us toward the upper RIGHT where the opponent stands.",
    "The head is turned to the right so only the back of the head and a sliver of the right-side profile are visible; NO eyes are visible from behind - draw no eyes, no pupils, no face features at all on the back view (keep the dark outline, no dark dots on the head);",
    "the snout points to the right. Tail in the foreground on the lower left. Same body posture type as the reference",
    "(a four-legged creature stays on four legs). It is close to the camera and fills the picture.",
    species ? `Keep the exaggerated signature feature (${species.signature}) just as big and just as prominent as in the reference - it must still dominate the silhouette from behind.` : "",
    species && species.stage === 1 ? "Keep the chibi proportions: the head stays big and round, the body short and plump." : "",
    "Flat solid pure magenta #FF00FF background everywhere, NO glow, NO aura, no ground, no shadow, no text, no anti-aliasing.",
    "Absolutely no dark border, halo or vignette around the creature: magenta must touch the outline directly.",
  ].filter(Boolean).join(" ");
}

/** 진화형: 앞 단계 도트를 참고로 넣고, 같은 계통으로 자란 모습을 그린다. */
export function evolutionPrompt(style: StyleContract, species: SpeciesSeed, previousName: string): string {
  return [
    `The reference is ${previousName}, an earlier evolution stage. Draw its evolved form as a NEW sprite in the same style and pixel block size:`,
    "same color family and markings, clearly the same lineage, but the SIGNATURE FEATURE has grown much bigger or changed into a more dramatic form, and the whole body changed shape",
    "(new posture, new proportions: it must be told apart from the earlier stage by silhouette alone - NOT the same silhouette with a recolor).",
    "Do not copy the reference outline; redraw the creature with imposing evolved proportions.",
    frontPrompt(style, species).replace("Draw on this flat magenta canvas. ", ""),
  ].join(" ");
}

/**
 * 큰 동작 한 줄(sprite-gen component-row 방식). 참고 이미지 = 첫 칸에 기준 스프라이트를 넣은 N 칸 안내(anim/row.ts rowReference).
 * sprite-gen 프롬프트 계약에서 가져온 것: 칸마다 전신 하나, 칸 넘침·겹침 금지, 떨어진 효과·잔상·그림자 금지, 안내 상자 재현 금지.
 * 뺀 것: sprite-gen 기본 화풍 문구(치비·마스코트 친화) — 이 하네스의 화풍 계약과 반대다.
 * 방향은 시드 animation.direction 에서 문장을 만든다 (「상대 쪽으로」만 쓰면 어느 쪽이 상대인지 그림마다 달랐다).
 * 속성 효과(불·물·잎)는 그리지 않는다 — 스킬의 전투 효과 애니메이션(animationId)이 따로 그린다.
 */
export function actionPrompt(style: StyleContract, species: SpeciesSeed, side: "front" | "back", action: ActionContract, direction: ScreenVector): string {
  const facing = side === "front"
    ? "opponent view: three-quarter view turned to the LEFT"
    : "the player's monster seen from BEHIND, facing away toward the upper RIGHT";
  const toward = `${direction.y < 0 ? "UPPER" : "LOWER"} ${direction.x < 0 ? "LEFT" : "RIGHT"}`;
  const away = `${direction.y < 0 ? "LOWER" : "UPPER"} ${direction.x < 0 ? "RIGHT" : "LEFT"}`;
  const motion = action.kind === "attack"
    ? `The target stands toward the ${toward} of the picture: every attack motion leans and reaches toward the ${toward}, never the other way.`
    : action.kind === "hurt"
      ? `The attacker stands toward the ${toward} of the picture: the recoil pushes the body toward the ${away}.`
      : "It stays in place and keeps facing the same way.";
  return [
    `Create ONE horizontal sprite strip of exactly ${action.frames} animation frames, left to right, for a monster battle in ${style.reference} pixel art style.`,
    "The reference image has the frame boxes; its FIRST box already holds the canonical sprite of this creature — that is frame 1's identity, size and pixel block size.",
    `Animation: ${action.action}.`,
    `Camera: ${facing}. Keep this camera angle in every frame. ${motion}`,
    "Same creature in every frame: identical design, markings, colors, palette, outline and pixel block size as the reference sprite. Change only pose and body motion.",
    "Exactly one complete full-body pose centered in each box; no pose may cross into a neighboring box or overlap another pose; nothing cropped.",
    "NO effects of any kind (the game draws fire, water, leaves and impacts itself): no sparks, beams, particles, motion lines, speed lines, afterimages, smears, blur, glow, aura, shadow, dust or impact bursts.",
    "Do NOT draw the boxes, guide lines, frame numbers, labels or any text. The whole background is flat solid pure magenta #FF00FF, magenta touching the outline directly.",
    `Creature (${species.types.join("/")} type): ${species.design} Signature feature, keep it exactly as in the reference sprite: ${species.signature}.`,
    "Pixel art: chunky clean square pixel blocks, dark colored outline, flat shading, no anti-aliasing, no gradients.",
  ].join(" ");
}
