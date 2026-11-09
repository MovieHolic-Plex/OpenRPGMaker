/**
 * 「쌍둥이 게임」 척도 — 타이틀·시작 화면의 지각 특징(pic-v1)과 0점·감점 규칙. 읽기 전용, 모델 호출 0, 네트워크 0.
 *
 * 측정 도구다(엔진·런타임·편집기·조수 동작 변경 없음). 화면 특징만 코퍼스에 저장한다 — 그림은 커밋하지 않는다.
 * 판정 방식은 이름(`pic-v1`)으로 갈아 끼운다: 코퍼스·결과·임계값이 모두 그 이름에 묶이고, 이름이 다르면 비교하지 않고 던진다.
 *
 * pic-v1 (2026-11-10, 레인 Python rdb.py 의 정수 이식):
 *   - 밝기 L = (R*299 + G*587 + B*114) / 1000 (알파 무시, 정수 반올림. PIL 의 정수 계수와 일부 값에서 1 차이가 날 수 있다)
 *   - 축소는 면적 가중 BOX(경계에 걸친 화소는 면적 비율). PIL BOX 와는 경계 화소에서 다를 수 있다 — 이식 확인: 실제 쌍 21개 |Δsim| ≤ 0.0022, 판정 뒤집힘 0
 *   - ahash: 8x8 BOX 축소 → 평균보다 밝은 칸 1
 *   - dhash: 9x8 BOX 축소 → 오른쪽이 왼쪽보다 밝은 칸 1
 *   - hist: 64x64 BOX 축소 → 채널당 4단계(0~3) 64칸 정수 히스토그램(총합 4096)
 *   - sim = 0.75 * (0.6*dhash일치 + 0.4*ahash일치) + 0.25 * 히스토그램 교집합
 *   - sha: 디코딩한 RGBA 바이트의 sha256 — 똑같은 그림(프리셋 복사)은 근사값이 아니라 이 값의 일치로 정한다
 */
import { createHash } from "node:crypto";

export const MEASURE_ID = "pic-v1";

/**
 * 판정 이름별 기준값(RAW pic_sim 척도). 오너 2026-11-10: 0.90 이상 0점, 0.70~0.90 감점 2점(게임당 한 번),
 * 똑같은 프리셋 복사(identical 이상 — 화소 sha 일치 또는 sim ≥ identical)는 양쪽 0점.
 */
export const THRESHOLDS = {
  "pic-v1": { zero: 0.9, penalty: 0.7, penaltyPoints: 2, identical: 0.999 },
};

// ---------- 화면 특징 ----------
function luma(rgba, index) {
  return Math.floor((rgba[index] * 299 + rgba[index + 1] * 587 + rgba[index + 2] * 114 + 500) / 1000);
}

/** PIL Image.BOX 와 같은 면적 평균 축소(그레이). 소수 경계는 가중. */
function boxResize(values, width, height, outW, outH, channels = 1) {
  const out = new Float64Array(outW * outH * channels);
  for (let oy = 0; oy < outH; oy += 1) {
    const y0 = (oy * height) / outH, y1 = ((oy + 1) * height) / outH;
    for (let ox = 0; ox < outW; ox += 1) {
      const x0 = (ox * width) / outW, x1 = ((ox + 1) * width) / outW;
      const sums = new Array(channels).fill(0);
      let weight = 0;
      for (let y = Math.floor(y0); y < Math.min(height, Math.ceil(y1)); y += 1) {
        const wy = Math.min(y + 1, y1) - Math.max(y, y0);
        for (let x = Math.floor(x0); x < Math.min(width, Math.ceil(x1)); x += 1) {
          const wx = Math.min(x + 1, x1) - Math.max(x, x0);
          const w = wx * wy;
          for (let c = 0; c < channels; c += 1) sums[c] += values[(y * width + x) * channels + c] * w;
          weight += w;
        }
      }
      for (let c = 0; c < channels; c += 1) out[(oy * outW + ox) * channels + c] = sums[c] / weight;
    }
  }
  return out;
}

function grayPlane(rgba, width, height) {
  const gray = new Float64Array(width * height);
  for (let i = 0; i < width * height; i += 1) gray[i] = luma(rgba, i * 4);
  return gray;
}

export function hexOf(bits) {
  let out = "";
  for (let i = 0; i < bits.length; i += 4) out += (bits[i] * 8 + bits[i + 1] * 4 + bits[i + 2] * 2 + bits[i + 3]).toString(16);
  return out;
}

/** rgba: Uint8Array/Buffer RGBA, width*height*4 바이트. */
export function features(rgba, width, height) {
  const gray = grayPlane(rgba, width, height);
  // PIL 은 L 이미지를 uint8 로 두므로 축소 결과도 정수로 반올림된다.
  const a = boxResize(gray, width, height, 8, 8).map(Math.round);
  const mean = a.reduce((s, v) => s + v, 0) / a.length;
  const ahash = hexOf(Array.from(a, (v) => (v > mean ? 1 : 0)));
  const d = boxResize(gray, width, height, 9, 8).map(Math.round);
  const dbits = [];
  for (let y = 0; y < 8; y += 1) for (let x = 0; x < 8; x += 1) dbits.push(d[y * 9 + x + 1] > d[y * 9 + x] ? 1 : 0);
  const dhash = hexOf(dbits);
  const rgb = new Float64Array(width * height * 3);
  for (let i = 0; i < width * height; i += 1) { rgb[i * 3] = rgba[i * 4]; rgb[i * 3 + 1] = rgba[i * 4 + 1]; rgb[i * 3 + 2] = rgba[i * 4 + 2]; }
  const small = boxResize(rgb, width, height, 64, 64, 3);
  const hist = new Array(64).fill(0);
  for (let i = 0; i < 64 * 64; i += 1) {
    const r = Math.min(3, Math.floor(Math.round(small[i * 3]) / 64));
    const g = Math.min(3, Math.floor(Math.round(small[i * 3 + 1]) / 64));
    const b = Math.min(3, Math.floor(Math.round(small[i * 3 + 2]) / 64));
    hist[r * 16 + g * 4 + b] += 1;
  }
  const sha = createHash("sha256").update(Buffer.from(rgba.buffer ?? rgba, rgba.byteOffset ?? 0, width * height * 4)).update(`${width}x${height}`).digest("hex").slice(0, 32);
  return { measure: MEASURE_ID, ahash, dhash, hist, sha };
}

const bitsOf = (hex) => Array.from(hex, (ch) => parseInt(ch, 16).toString(2).padStart(4, "0")).join("");
const hamming = (x, y) => { const a = bitsOf(x), b = bitsOf(y); let n = 0; for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) n += 1; return n; };

export function similarity(a, b) {
  if (a.measure !== b.measure) throw new Error(`판정 이름이 다르다: ${a.measure} ≠ ${b.measure} — 같은 판정으로 다시 만든 코퍼스끼리만 비교한다`);
  const d = 1 - hamming(a.dhash, b.dhash) / 64;
  const h = 1 - hamming(a.ahash, b.ahash) / 64;
  const struct = 0.6 * d + 0.4 * h;
  let inter = 0;
  for (let i = 0; i < 64; i += 1) inter += Math.min(a.hist[i], b.hist[i]);
  const col = inter / 4096;
  return { sim: 0.75 * struct + 0.25 * col, struct, col };
}

// ---------- 규칙 ----------
const ROLES = ["title", "start"];

/** 한 쌍의 점수: 같은 역할(title↔title, start↔start) 중 최대. 똑같은 그림(sha 일치 또는 sim ≥ identical)이면 identical. */
export function pairScore(x, y, th = THRESHOLDS[MEASURE_ID]) {
  let best = { sim: 0, screen: null, identical: false };
  for (const role of ROLES) {
    const a = x.shots?.[role], b = y.shots?.[role];
    if (!a || !b) continue;
    const sim = a.sha === b.sha ? 1 : similarity(a, b).sim;
    const identical = a.sha === b.sha || sim >= th.identical;
    if (sim > best.sim || (identical && !best.identical)) best = { sim, screen: role, identical };
  }
  return best;
}

/** 「나중에 만든」 쪽: made_at 이 늦은 쪽, 같으면 id 사전순으로 큰 쪽. */
export function isLater(x, y) {
  if (x.made_at !== y.made_at) return x.made_at > y.made_at;
  return x.id > y.id;
}

/**
 * game: { id, made_at, prompt_sha, shots: {title, start} },  corpus: game[], defaults: { title, start }(특징)
 * 반환: { zero: bool, penalty: number, lines: string[], hits: [...] }
 * 규칙: 다른 프롬프트의 기록 게임과 — 똑같은 그림(identical)이면 0점(상대도 자기를 판정할 때 0점이라 양쪽),
 *       sim ≥ zero 이고 이 게임이 나중에 만든 쪽이면 0점, penalty ≤ sim < zero 이면 감점.
 *       같은 프롬프트 쌍(쌍둥이)은 감점만. 기본 화면(default)과 sim ≥ zero 이면 0점.
 *       감점은 게임당 한 번(가장 닮은 상대 하나를 줄에 남기고 나머지는 hits 에만 둔다) — 코퍼스가 커져도 감점이 불어나지 않게.
 *       「나중」은 시각으로 정한다: 먼저 만든 게임이 다른 이유로 이미 0점이어도 이 게임은 그대로 0점(누가 먼저 그 모습을 냈나를 본다).
 */
export function judgeGame(game, corpus, defaults, measure = MEASURE_ID, thresholds = THRESHOLDS[measure]) {
  const th = thresholds;
  if (!th) throw new Error(`기준값이 없는 판정: ${measure}`);
  for (const role of ROLES) if (game.shots?.[role] && game.shots[role].measure !== measure) throw new Error(`판정 이름이 다르다: ${game.shots[role].measure} ≠ ${measure}`);
  const hits = [];
  let zero = false;
  let penaltyHit;
  for (const other of corpus) {
    if (other.id === game.id) continue;
    const { sim, screen, identical } = pairScore(game, other, th);
    if (!screen) continue;
    const samePrompt = game.prompt_sha && game.prompt_sha === other.prompt_sha;
    if (samePrompt) {
      if (sim >= th.penalty) { const hit = { kind: "twin-penalty", other: other.id, sim, screen }; hits.push(hit); if (!penaltyHit || sim > penaltyHit.sim) penaltyHit = hit; }
      continue;
    }
    if (identical) { zero = true; hits.push({ kind: "zero", reason: "identical-preset", other: other.id, sim, screen }); }
    else if (sim >= th.zero && isLater(game, other)) { zero = true; hits.push({ kind: "zero", reason: "look-similar", other: other.id, sim, screen }); }
    else if (sim >= th.penalty && sim < th.zero) { const hit = { kind: "penalty", other: other.id, sim, screen }; hits.push(hit); if (!penaltyHit || sim > penaltyHit.sim) penaltyHit = hit; }
  }
  for (const role of ROLES) {
    const shot = game.shots?.[role], base = defaults?.[role];
    if (!shot || !base) continue;
    if (base.measure !== measure) throw new Error(`판정 이름이 다르다: ${base.measure} ≠ ${measure}`);
    const sim = shot.sha === base.sha ? 1 : similarity(shot, base).sim;
    if (sim >= th.zero) { zero = true; hits.push({ kind: "zero", reason: "default-screen", other: `default-${role}`, sim, screen: role }); }
  }
  const lines = hits.filter((h) => h.kind === "zero").map((h) => `zero: ${h.reason} similar game ${h.other} ${h.sim.toFixed(3)} ${h.screen}`);
  if (penaltyHit && !zero) lines.push(`penalty: -${th.penaltyPoints} ${penaltyHit.kind === "twin-penalty" ? "same-prompt twin" : "look-alike"} ${penaltyHit.other} ${penaltyHit.sim.toFixed(3)} ${penaltyHit.screen}`);
  return { zero, penalty: penaltyHit && !zero ? th.penaltyPoints : 0, lines, hits };
}
