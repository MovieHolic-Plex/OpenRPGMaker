// 현대 연애 초상 24세트를 매끈한 고해상도 오토메 일러스트(#2870 화풍)로 다시 그린다 — MDC 이미지 API(god-tibo-imagen).
// 도트 전신이 인물의 정답(머리·복장·색)이고, 화풍만 바꾼다. 인물마다 다른 손동작·자세를 주고,
// 모두 화면 오른쪽으로 3/4 돌아선다 — 양쪽 전신 베일은 오른쪽 인물만 좌우 반전하므로 둘이 마주 본다.
//
//   python3 scripts/asset-gen/modern-hires-portraits.py prep .omo/asset-gen-tmp/modern-hires/r1
//   node scripts/asset-gen/gen-modern-hires-portraits.mjs r1 [stem...]     # 기본 → 표정 4종
//   python3 scripts/asset-gen/modern-hires-portraits.py post .omo/asset-gen-tmp/modern-hires/r1
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const [ver = "r1", ...only] = process.argv.slice(2);
const BASE = process.env.MDC_IMAGE_API || "http://100.73.251.77:8091";
const WORK = resolve(`.omo/asset-gen-tmp/modern-hires/${ver}`);
mkdirSync(`${WORK}/raw`, { recursive: true });

// [인물, 자세]. 자세는 24종이 모두 다르다.
const CAST = {
  "modern-uni-boy-navy": ["a high-school boy with short tousled dark-brown hair, navy school blazer, white shirt, red necktie, grey trousers", "one hand rubbing the back of his neck, the other hand in his trouser pocket"],
  "modern-uni-boy-sidetail": ["a high-school boy with long black hair tied in a low side ponytail over one shoulder, royal-blue school blazer, white shirt, dark trousers", "arms loosely crossed, head tilted slightly"],
  "modern-uni-girl-navy": ["a high-school girl with fluffy wavy chestnut-brown shoulder-length hair, blue eyes, navy school blazer with gold buttons, red ribbon bow, navy pleated skirt", "both hands clasped behind her back, leaning forward a little"],
  "modern-uni-girl-sailor": ["a high-school girl with straight brown shoulder-length hair, white sailor-style school uniform with navy collar and red scarf, navy pleated skirt", "one hand raised in a small friendly wave beside her face"],
  "modern-uni-girl-twintail": ["a high-school girl with orange hair in two high twin-tails, navy school blazer, red ribbon bow, navy pleated skirt", "one hand on her hip, the other giving a cheerful peace sign"],
  "modern-casual-boy-hoodie": ["a young man with messy auburn-brown hair and blue eyes, grey pullover hoodie with white drawstrings, black jogger pants", "both hands in the hoodie front pocket, relaxed easy smile"],
  "modern-casual-girl-mint": ["a young woman with wavy auburn shoulder-length hair and blue eyes, mint-green puff-sleeve mini dress", "both hands holding a small handbag in front of her"],
  "modern-suit-boy-navy": ["a young office worker man with short neat black hair, navy business suit, white shirt, blue necktie", "adjusting his necktie knot with one hand"],
  "modern-suit-girl-navy": ["a young office worker woman with short chestnut-brown bob hair, navy pantsuit, white open-collar blouse", "holding a document folder against her chest with both arms"],
  "modern-apron-brown": ["a young cafe barista woman with auburn hair in a low messy bun, white shirt with rolled sleeves, brown cafe apron, long dark skirt", "holding a takeaway coffee cup up in one hand as if offering it"],
  "modern-teacher-tweed": ["a male university professor in his thirties with brown hair tied back in a short ponytail, brown tweed jacket, white shirt, maroon necktie, grey trousers", "holding an open book in one hand, the other hand touching his chin thoughtfully"],
  "modern-teacher-cardigan": ["a female teacher in her late twenties with a chin-length brown bob, burgundy cardigan over a cream blouse, charcoal trousers", "holding a clipboard in one arm, pointing a pen with the other hand"],
  "modern-uni-boy-grey": ["a high-school boy with short neat brown hair, grey school blazer, white shirt, green necktie, black trousers", "carrying a school bag slung over one shoulder, one hand holding the strap"],
  "modern-uni-boy-summer": ["a high-school boy with spiky orange hair, short-sleeved white summer shirt under a beige knit vest, green necktie, grey trousers", "a bright grin, scratching his cheek with one finger"],
  "modern-uni-girl-bun": ["a high-school girl with dark-brown hair in a high bun, beige knit cardigan over a white shirt, red ribbon bow, navy pleated skirt", "both hands holding a stack of books against her chest"],
  "modern-uni-girl-long": ["a high-school girl with very long straight brown hair, grey school blazer, red ribbon bow, grey pleated skirt", "tucking a strand of hair behind her ear with one hand"],
  "modern-casual-boy-mustard": ["a young man with tousled ginger hair, mustard-yellow knit sweater, blue jeans", "giving a thumbs-up with one hand, the other hand in his pocket"],
  "modern-casual-boy-olive": ["a young man with long black hair tied back with a dark headband, olive-green field jacket over a white T-shirt, beige chinos", "jacket slung over one shoulder held by a hooked finger, cool half-smile"],
  "modern-casual-girl-pink": ["a young woman with auburn hair in two buns, pink pullover hoodie, denim mini skirt", "both hands making a small heart shape in front of her chest"],
  "modern-casual-girl-lavender": ["a young woman with long wavy chestnut-brown hair, lavender puff-sleeve blouse, long cream skirt", "both hands gently holding the brim of a straw sun hat in front of her"],
  "modern-casual-girl-stripe": ["a young woman with black hair in a high bun, small pink earrings, navy-and-white striped T-shirt, dark navy skinny jeans", "holding a smartphone up in one hand, glancing up from it"],
  "modern-suit-boy-charcoal": ["an office manager man in his thirties with black hair tied in a low ponytail, charcoal-grey suit, white shirt, black necktie", "checking a wristwatch on his raised left wrist"],
  "modern-apron-navy": ["a cafe barista woman with black hair in a bun, white shirt with rolled sleeves, navy denim apron with a brown pocket, long dark skirt", "holding a small round serving tray at her side, warm welcoming smile"],
  "modern-apron-olive": ["a cafe barista woman with dark-red hair in a bun, white shirt with rolled sleeves, olive-green apron, long dark-grey skirt", "wiping her hands on a small towel, cheerful look"],
};

const STYLE = "High-resolution Japanese otome visual-novel standing illustration (tachie), modern-day setting, polished anime official art: clean smooth anti-aliased line art, soft cel shading with gentle gradients, glossy detailed eyes, rich hair highlights. Absolutely no pixel art, no visible pixels, no dithering.";
const FRAME = "Medium shot from the top of the head down to mid-thigh; the bottom edge of the image cuts the figure at mid-thigh. Body turned three-quarter toward the RIGHT side of the image, face and eyes also looking toward the right side of the image (as if talking to someone standing to the right).";
const BG = "Background: one flat uniform solid pure magenta #FF00FF everywhere outside the character, no gradient, no floor, no cast shadow, no texture.";
const NO = "No text, no logo, no watermark, no frame, no props other than those described, no fantasy costume, no armour, no cape, no weapon. Exactly one person.";
const EXPRESSION = {
  happy: "a bright happy open-mouthed smile with sparkling eyes",
  surprised: "a surprised face, eyes wide, eyebrows raised, small open mouth",
  sad: "a sad face, downcast eyes, eyebrows drawn up, small frown",
  embarrassed: "an embarrassed flustered face, deep blush across the cheeks, eyes glancing aside, wobbly smile",
};

function basePrompt(stem) {
  const [who, pose] = CAST[stem];
  return `Redraw the character from the reference image as a brand-new illustration. Keep the same person: same hairstyle, hair colour, eye colour and the exact same outfit and colours as the reference, but NOT its pixel-art style. Character: ${who}. Pose: ${pose}. Calm gentle smile. ${STYLE} ${FRAME} ${BG} ${NO}`;
}
function expressionPrompt(stem, expression) {
  return `The reference is a finished character illustration. Produce the same illustration again with the identical character, outfit, hairstyle, pose, hand gesture, body angle, framing, camera, line art and colouring; change ONLY the facial expression to ${EXPRESSION[expression]}. ${BG} ${NO}`;
}

async function generate(name, prompt, refPath) {
  const out = `${WORK}/raw/${name}.png`;
  writeFileSync(`${WORK}/raw/${name}.prompt.txt`, prompt);
  if (existsSync(out)) return out;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const res = await fetch(`${BASE}/v1/generate/json`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, slug: `modern-hires-${ver}-${name}`, size: "1024x1536", reference_b64: readFileSync(refPath).toString("base64"), return_base64: true, fallback: false, priority: 5 }),
      signal: AbortSignal.timeout(20 * 60 * 1000),
    }).catch((error) => ({ ok: false, status: String(error), json: async () => null }));
    const json = await res.json().catch(() => null);
    if (res.ok && json?.ok && json.image_b64) {
      writeFileSync(out, Buffer.from(json.image_b64, "base64"));
      console.log(name, "ok", json.duration_sec);
      return out;
    }
    console.error(name, "attempt", attempt + 1, res.status, JSON.stringify(json)?.slice(0, 200));
  }
  throw new Error(`${name} failed`);
}

const stems = only.length ? only : Object.keys(CAST);
const results = await Promise.allSettled(stems.map(async (stem) => {
  if (!CAST[stem]) throw new Error(`unknown stem ${stem}`);
  const base = await generate(`${stem}__base`, basePrompt(stem), `${WORK}/ref/${stem}.png`);
  await Promise.all(Object.keys(EXPRESSION).map((expression) => generate(`${stem}__${expression}`, expressionPrompt(stem, expression), base)));
}));
const failed = results.flatMap((result, index) => result.status === "rejected" ? [`${stems[index]}: ${result.reason}`] : []);
console.log("done", stems.length - failed.length, "/", stems.length, failed.join("\n"));
process.exitCode = failed.length ? 1 : 0;
