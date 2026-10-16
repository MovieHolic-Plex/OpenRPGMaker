// 몬스터 수집 오프닝 박사 후보 생성 — MDC 이미지 API(god-tibo-imagen, gpt-image-2.5-sunburst).
// 박사는 원작 박사와 닮지 않은 오리지널 디자인: 별 모양 머리핀·둥근 안경·흰 가운·클립보드.
// 배경은 균일 마젠타(후처리에서 키잉으로 제거한다). 기본 서버 http://100.73.251.77:8091 (MDC_IMAGE_API 로 변경).
//
//   node scripts/asset-gen/gen-opening-professor.mjs r1            # 후보 전부
//   node scripts/asset-gen/gen-opening-professor.mjs r1 A1 A3      # 일부만
// 결과: .omo/asset-gen-tmp/professor/<판>/<후보>.png (원본, 후처리 없음) + <후보>.prompt.txt
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const [ver = "r1", ...only] = process.argv.slice(2);
const BASE = process.env.MDC_IMAGE_API || "http://100.73.251.77:8091";
const OUT = resolve(`.omo/asset-gen-tmp/professor/${ver}`);
mkdirSync(OUT, { recursive: true });

const WOMAN = [
  "Original character design: a warm, kind astronomy-and-creature researcher, a woman in her early forties with a gentle welcoming smile,",
  "short wavy chestnut-brown hair with a small gold star-shaped hairpin, round tortoiseshell glasses, a clean white lab coat worn open",
  "over a deep teal knit sweater with a tiny star embroidered at the collar, a lanyard, and a wooden clipboard held against her hip",
  "with a hand-drawn sketch of a crescent moon on the paper. Cheerful, approachable, a little scholarly.",
].join(" ");
const MAN = [
  "Original character design: a warm, kind astronomy-and-creature researcher, a gentle man in his fifties with a friendly crinkled-eye smile,",
  "tousled silver-brown hair, round tortoiseshell glasses, neat trimmed salt-and-pepper moustache, a clean white lab coat worn open",
  "over a deep teal knit vest and cream shirt with a tiny star pin on the collar, a lanyard, and a wooden clipboard under one arm.",
  "Cheerful, approachable, a little scholarly.",
].join(" ");
// 2판: 연구소 필드 NPC 칩(대머리·흰 염소수염·올리브 야전 재킷 노인)과 같은 인물로 맞춘다 — 오프닝 박사와 연구소 박사가 다른 사람이면 어색하다.
const ELDER = [
  "Original character design: a warm, kind astronomy-and-creature researcher, an elderly man in his sixties, bald on top with a thin fringe of white hair at the sides,",
  "a short neat white-grey goatee and moustache, kind crinkled eyes behind small round wire-rim glasses, wearing an olive-green field jacket with a dark collar",
  "over a cream shirt, a small gold star pin on the lapel and a leather satchel strap across the chest.",
  "Cheerful, approachable, a little scholarly.",
].join(" ");
const NO = "No text, no logos, no watermark, no frame, no existing game or anime character, no Poke-ball or ball of any kind. Exactly one person.";
const BG = "Background: one flat uniform solid pure magenta #FF00FF everywhere outside the character, no gradient, no floor, no cast shadow, no texture.";

const CANDIDATES = {
  C1: `${ELDER} 16-bit GBA-era pixel art portrait, chunky hand-placed pixels, limited 24-colour palette, dark one-pixel outline, no anti-aliasing, no gradients, no blur. Waist-up view, one hand raised in a welcome, the other holding a small brass pocket telescope. ${BG} ${NO}`,
  C2: `${ELDER} 16-bit GBA-era pixel art portrait with very chunky hand-placed pixels, as if the whole image were only about 100 pixels wide, limited 20-colour palette, dark one-pixel outline, no anti-aliasing, no dithering noise, no gradients. Waist-up view, one hand raised in a welcome. ${BG} ${NO}`,
  C3: `${ELDER} 16-bit GBA-era pixel art portrait, chunky hand-placed pixels, limited 24-colour palette, dark one-pixel outline, no anti-aliasing, no gradients. Waist-up three-quarter view, one hand holding a brass pocket telescope up beside his head, the other hand open in a welcome gesture. ${BG} ${NO}`,
  C4: `${ELDER} Pixel art bust portrait in the style of a late-GBA creature-collection game professor intro sprite: large clean pixel clusters, flat shaded with 3 tones per material, thick dark-brown outline, about 96 pixels wide logical resolution, no anti-aliasing. Waist-up, front-facing, hands clasped in front, friendly smile. ${BG} ${NO}`,
  C5: `${ELDER} Clean cel-shaded game character illustration, official-art style, smooth dark-brown outlines, flat colors with one shade tone, JRPG creature-collection game portrait. Waist-up three-quarter view, one hand raised in a welcome. ${BG} ${NO}`,
  C6: `${ELDER} Soft gouache storybook illustration, painterly shading, warm earthy palette, crisp silhouette, early-2000s creature-collection game official artwork feel. Waist-up view, holding a brass pocket telescope, looking at the viewer. ${BG} ${NO}`,
  // 큰 반신 초상 — 대화창 옆 초상 위치용
  A1: `${WOMAN} Clean cel-shaded game character illustration, official-art style, confident smooth dark-brown outlines, flat colors with one soft shade tone, JRPG creature-collection game portrait. Waist-up three-quarter view, one hand raised in a welcoming wave. ${BG} ${NO}`,
  A2: `${WOMAN} Soft gouache storybook illustration, painterly shading, warm earthy palette, gentle hand-painted brush texture with a crisp silhouette, early-2000s creature-collection game official artwork feel. Waist-up view, hands holding the clipboard, looking at the viewer. ${BG} ${NO}`,
  A3: `${WOMAN} 16-bit GBA-era pixel art portrait, chunky hand-placed pixels, limited 24-colour palette, dark one-pixel outline, no anti-aliasing, no gradients, no blur. Waist-up view, one hand raised in a welcome. ${BG} ${NO}`,
  // 전신 — 받침 위에 세우는 구도 대체용
  A4: `${WOMAN} Clean cel-shaded game character illustration, official-art style, smooth dark-brown outlines, flat colors with one shade tone. Full-body standing pose, slightly turned to three-quarter, open welcoming gesture with one arm out, clipboard in the other hand, feet fully visible. ${BG} ${NO}`,
  A5: `${WOMAN} 16-bit pixel art in the style of late GBA / early DS creature-collection trainer artwork: crisp hand-placed pixels with a dark outline, 32-colour palette, no anti-aliasing. Full-body standing pose, open welcoming gesture, clipboard in the other hand, feet fully visible. ${BG} ${NO}`,
  // 2판 — 도트화 경로용: 훨씬 굵은 도트(논리 해상도 약 100×120 반신)로 요청해 격자 복원(grid.py) 뒤 화면에 1~2배로 쓴다.
  B1: `${WOMAN} 16-bit GBA-era pixel art portrait with very chunky hand-placed pixels, as if the whole image were only about 100 pixels wide, limited 20-colour palette, dark one-pixel outline, no anti-aliasing, no dithering noise, no gradients. Waist-up view, one hand raised in a welcome, clipboard against the hip. ${BG} ${NO}`,
  B2: `${WOMAN} Pixel art bust portrait in the style of a late-GBA creature-collection game professor intro sprite: large clean pixel clusters, flat shaded with 3 tones per material, thick dark-brown outline, about 96 pixels wide logical resolution, no anti-aliasing. Waist-up, front-facing, both hands holding the clipboard, friendly smile. ${BG} ${NO}`,
  B3: `${MAN} 16-bit GBA-era pixel art portrait with very chunky hand-placed pixels, as if the whole image were only about 100 pixels wide, limited 20-colour palette, dark one-pixel outline, no anti-aliasing, no gradients. Waist-up view, one hand raised in a welcome. ${BG} ${NO}`,
  A6: `${MAN} Clean cel-shaded game character illustration, official-art style, smooth dark-brown outlines, flat colors with one shade tone, JRPG creature-collection game portrait. Waist-up three-quarter view, one hand raised in a welcome. ${BG} ${NO}`,
};

const names = only.length ? only : Object.keys(CANDIDATES);
async function one(name) {
  const prompt = CANDIDATES[name];
  if (!prompt) throw new Error(`unknown candidate ${name}`);
  writeFileSync(`${OUT}/${name}.prompt.txt`, prompt);
  if (existsSync(`${OUT}/${name}.png`)) return console.log(name, "exists");
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const res = await fetch(`${BASE}/v1/generate/json`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, slug: `prof-${ver}-${name}`, size: process.env.SIZE || "1024x1536", return_base64: true, fallback: false, priority: 10 }),
      signal: AbortSignal.timeout(20 * 60 * 1000),
    });
    const json = await res.json().catch(() => null);
    if (res.ok && json?.ok && json.image_b64) {
      writeFileSync(`${OUT}/${name}.png`, Buffer.from(json.image_b64, "base64"));
      return console.log(name, "ok", json.engine, json.duration_sec);
    }
    console.error(name, "attempt", attempt + 1, res.status, JSON.stringify(json)?.slice(0, 200));
  }
}
await Promise.all(names.map(one));
