/**
 * 생성 프롬프트 틀. 문장 하나하나가 실패 사례에서 나왔다 (2026-10-01, qa-runs/hand-monster):
 * - 「front view facing the viewer」 → 마스코트처럼 정면을 보는 그림. 상대는 왼쪽 3/4 로 내 몬스터를 본다.
 * - 마스코트 금지·볼터치 금지가 없으면 큰 머리·홍조 스티커의 치비가 나온다.
 * - 마젠타 단색 캔버스를 참고 이미지로 주지 않으면 검정 배경·불꽃 후광이 자주 붙는다(배경 제거가 안 된다).
 * - 뒷모습은 원본 생성 그림이 아니라 「깨끗한 도트를 키운 것」을 참고로 넣어야 후광·색 번짐이 덜하다.
 */
import type { SpeciesSeed, StyleContract } from "../seed";

export function frontPrompt(style: StyleContract, species: SpeciesSeed): string {
  return [
    "Draw on this flat magenta canvas.",
    "Original creature design for a monster-collecting RPG, finished pixel art battle sprite in the style of",
    `${style.reference} opponent sprites.`,
    "Strong readable silhouette, believable creature anatomy (real limbs, joints, paws or claws, a sense of weight),",
    "designed by a professional creature designer, NOT a cute mascot, NOT chibi, NOT kawaii:",
    "no blush marks, no sparkly anime eyes, eyes small and sharp with one tiny highlight.",
    `About ${style.maxColors - 6} colors: 2-3 main hues with 3 shading tones each, dark colored outline (dark version of the local color, not pure black).`,
    "Light from the upper left, flat clean shading areas, no dithering noise, no gradients, no anti-aliasing.",
    "Pose: three-quarter view turned to the LEFT, standing on its feet, head and chest facing left, tail on the right. NOT facing the viewer.",
    "Every art pixel is one clean square block of about 12x12 image pixels; the creature is about 80 art pixels wide.",
    "The whole background stays flat solid pure magenta #FF00FF: absolutely NO glow, NO aura, NO halo, NO embers, NO smoke,",
    "NO light bloom around the creature, no ground, no shadow, no text.",
    `Creature (${species.types.join("/")} type, evolution stage ${species.stage}): ${species.design}`,
    species.palette ? `Main colors: ${species.palette}.` : "",
    style.avoid.length > 0 ? `It must NOT resemble any existing official monster, especially: ${style.avoid.join(", ")}.` : "",
  ].filter(Boolean).join(" ");
}

export function backPrompt(): string {
  return [
    "EDIT TASK on the reference pixel art creature sprite (Pokemon Black and White style).",
    "Draw the SAME creature (identical design, colors, markings, palette, outline style and pixel block size)",
    "as the PLAYER's monster BACK sprite in a monster battle: the camera is BEHIND it and slightly to its left and above,",
    "we see its back, the back of its head and its tail closest to us; it faces AWAY from us toward the upper RIGHT where the opponent stands.",
    "The head is turned to the right so only the back of the head and a sliver of the right-side profile (one eye at most, partly) are visible;",
    "the snout points to the right. Tail in the foreground on the lower left. Same body posture type as the reference",
    "(a four-legged creature stays on four legs). It is close to the camera and fills the picture.",
    "Flat solid pure magenta #FF00FF background everywhere, NO glow, NO aura, no ground, no shadow, no text, no anti-aliasing.",
    "Absolutely no dark border, halo or vignette around the creature: magenta must touch the outline directly.",
  ].join(" ");
}

/** 진화형: 앞 단계 도트를 참고로 넣고, 같은 계통으로 자란 모습을 그린다. */
export function evolutionPrompt(style: StyleContract, species: SpeciesSeed, previousName: string): string {
  return [
    `The reference is ${previousName}, an earlier evolution stage. Draw its evolved form as a NEW sprite in the same style and pixel block size:`,
    "same color family and signature markings, clearly the same lineage, but bigger, more mature and more powerful, with a stronger silhouette.",
    frontPrompt(style, species).replace("Draw on this flat magenta canvas. ", ""),
  ].join(" ");
}
