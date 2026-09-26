/**
 * 타이틀 영역 효과 셰이더(WebGL2). 효과 목록을 uniform 배열로 받아 한 패스에 그린다.
 *
 * - 좌표계: `q` 는 배경 그림 기준 0..1, `P` 는 그림 높이를 1 로 둔 종횡비 공간(q * (aspect,1)).
 *   효과 기하(점·선·다각형)는 저장값 그대로 0..1 그림 좌표로 들어오고, 거리 계산은 P 공간에서 한다.
 * - 순서: 카메라 호흡(uv) → 깊이 시차(uv) → 물결 굴절(uv) → 그림 샘플 → 목록 순서대로 색 효과.
 *   깊이 시차는 q 자체를 옮기므로 뒤따르는 색 효과(칼날 반사·물결 등)도 그림 내용을 따라 움직인다.
 * - 시간 t 에 대해 결정적이다(난수 없음, 해시 노이즈만). 같은 t 면 같은 그림.
 */
export const TITLE_EFFECT_SHADER_MAX_EFFECTS = 12;
export const TITLE_EFFECT_SHADER_MAX_POINTS = 8;
export const TITLE_EFFECT_SHADER_MAX_MOTES = 96;

/** 셰이더 안 종류 번호 — renderer 의 인코딩과 짝이다. */
export const TITLE_EFFECT_SHADER_KIND = {
  none: -1,
  godRays: 0,
  motes: 1,
  motesRegion: 2,
  glint: 3,
  water: 4,
  mist: 5,
  dapple: 6,
  glow: 7,
  camera: 8,
  parallax: 9,
} as const;

export const TITLE_EFFECT_VERTEX_SHADER = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = vec2(aPos.x * 0.5 + 0.5, 0.5 - aPos.y * 0.5);
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

export const TITLE_EFFECT_FRAGMENT_SHADER = `#version 300 es
precision highp float;
precision highp int;
#define MAX_FX ${TITLE_EFFECT_SHADER_MAX_EFFECTS}
#define MAX_PTS ${TITLE_EFFECT_SHADER_MAX_POINTS}
#define MAX_MOTES ${TITLE_EFFECT_SHADER_MAX_MOTES}
#define PI 3.14159265
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uImage;
uniform float uTime;
uniform vec2 uCanvas;
uniform vec2 uImageSize;
uniform int uFit;            // 0 cover, 1 contain, 2 stretch
uniform int uCount;
uniform int uKind[MAX_FX];
uniform vec4 uA[MAX_FX];     // 점 둘(source,toward) · 선 양 끝 · 상자
uniform vec4 uB[MAX_FX];     // intensity, speed, spread/period, count/feather
uniform vec3 uColor[MAX_FX];
uniform int uPtsN[MAX_FX];
uniform vec2 uPts[MAX_FX * MAX_PTS];
uniform sampler2D uDepth;    // 깊이 지도(흰색 = 가까움). uHasDepth 가 0 이면 쓰지 않는다.
uniform int uHasDepth;

float h1(float n) { return fract(sin(n) * 43758.5453); }
float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n2(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(h2(i), h2(i + vec2(1.0, 0.0)), u.x), mix(h2(i + vec2(0.0, 1.0)), h2(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * n2(p); p *= 2.03; a *= 0.5; }
  return v;
}
mat2 rot(float a) { float c = cos(a); float s = sin(a); return mat2(c, s, -s, c); }

float AR;
vec2 toP(vec2 q) { return q * vec2(AR, 1.0); }

// 다각형 부호 거리(안쪽 음수) — P 공간.
float polySd(int fx, vec2 p) {
  int n = uPtsN[fx];
  int base = fx * MAX_PTS;
  vec2 v0 = toP(uPts[base]);
  float d = dot(p - v0, p - v0);
  float s = 1.0;
  for (int i = 0; i < MAX_PTS; i++) {
    if (i >= n) break;
    int j = i == 0 ? n - 1 : i - 1;
    vec2 vi = toP(uPts[base + i]);
    vec2 vj = toP(uPts[base + j]);
    vec2 e = vj - vi;
    vec2 w = p - vi;
    vec2 b = w - e * clamp(dot(w, e) / dot(e, e), 0.0, 1.0);
    d = min(d, dot(b, b));
    bvec3 c = bvec3(p.y >= vi.y, p.y < vj.y, e.x * w.y > e.y * w.x);
    if (all(c) || all(not(c))) s *= -1.0;
  }
  return s * sqrt(d);
}
float regionMask(int fx, vec2 p, float feather) {
  return smoothstep(feather, -feather, polySd(fx, p));
}
// 깊이(0 멂 .. 1 가까움). 깊이 지도가 없으면 「아래가 가깝다」는 풍경 기본값.
float depthAt(vec2 q) {
  if (uHasDepth == 1) return texture(uDepth, clamp(q, 0.0, 1.0)).r;
  return smoothstep(0.25, 1.05, q.y);
}
float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
vec3 screenAdd(vec3 c, vec3 add) { return 1.0 - (1.0 - c) * (1.0 - clamp(add, 0.0, 1.0)); }

void main() {
  AR = uImageSize.x / max(uImageSize.y, 1.0);
  float canvasAR = uCanvas.x / max(uCanvas.y, 1.0);
  vec2 q = vUv;
  if (uFit == 0) {
    if (canvasAR > AR) q.y = (q.y - 0.5) * (AR / canvasAR) + 0.5;
    else q.x = (q.x - 0.5) * (canvasAR / AR) + 0.5;
  } else if (uFit == 1) {
    if (canvasAR > AR) q.x = (q.x - 0.5) * (canvasAR / AR) + 0.5;
    else q.y = (q.y - 0.5) * (AR / canvasAR) + 0.5;
    if (q.x < 0.0 || q.x > 1.0 || q.y < 0.0 || q.y > 1.0) { outColor = vec4(0.0); return; }
  }

  // 1) 카메라 호흡 — 아주 느린 확대·흔들림.
  for (int i = 0; i < MAX_FX; i++) {
    if (i >= uCount) break;
    if (uKind[i] != 8) continue;
    float k = uB[i].x;
    float t = uTime * uB[i].y;
    float z = 1.0 - 0.012 * k * (0.5 + 0.5 * sin(t * 0.35));
    q = (q - 0.5) * z + 0.5 + k * vec2(0.003 * sin(t * 0.21), 0.002 * cos(t * 0.17));
  }

  // 1.5) 깊이 시차 — 가까운 것은 크게, 먼 것은 반대로 조금 움직여 2.5D 카메라처럼 보이게 한다.
  //      화면 q 에 보일 원본 좌표 u 는 u = q - off * (depth(u) - 0.5) 의 고정점이라 몇 번 되풀어 푼다.
  for (int i = 0; i < MAX_FX; i++) {
    if (i >= uCount) break;
    if (uKind[i] != 9) continue;
    float k = uB[i].x;
    float t = uTime * uB[i].y;
    // 가장자리가 드러나지 않게 폭만큼 살짝 당겨 본다.
    q = (q - 0.5) * (1.0 - 0.03 * k) + 0.5;
    vec2 off = k * vec2(0.022 * sin(t * 0.23), 0.009 * sin(t * 0.17 + 1.3));
    float dolly = k * 0.018 * (0.5 + 0.5 * sin(t * 0.13 - 1.57));
    vec2 u = q;
    for (int j = 0; j < 5; j++) {
      float d = depthAt(u) - 0.5;
      u = q - off * d - (q - 0.5) * dolly * d;
    }
    q = u;
  }

  // 2) 물결 굴절 — 영역 안 샘플 좌표만 흔든다.
  vec2 s = q;
  for (int i = 0; i < MAX_FX; i++) {
    if (i >= uCount) break;
    if (uKind[i] != 4) continue;
    float wm = regionMask(i, toP(q), 0.012) * uB[i].x;
    float t = uTime * uB[i].y;
    s.x += wm * (sin(q.y * 900.0 - t * 2.2) * 0.0009 + sin(q.y * 380.0 + t * 1.3) * 0.0006);
    s.y += wm * sin(q.x * 260.0 + t * 1.7) * 0.0007;
  }
  vec3 c = texture(uImage, clamp(s, 0.0, 1.0)).rgb;
  vec2 P = toP(q);

  // 3) 색 효과 — 목록 순서.
  for (int i = 0; i < MAX_FX; i++) {
    if (i >= uCount) break;
    int kind = uKind[i];
    float k = uB[i].x;
    float t = uTime * uB[i].y;
    vec3 col = uColor[i];
    if (kind == 4) {
      float wm = regionMask(i, P, 0.012);
      float sp = pow(smoothstep(0.72, 1.0, n2(vec2(q.x * 420.0, q.y * 900.0 - t * 1.5))), 3.0);
      c += col * sp * 0.55 * smoothstep(0.35, 0.7, luma(c)) * wm * k;
    } else if (kind == 5) {
      float m = regionMask(i, P, 0.08);
      float f = fbm(vec2(q.x * 4.0 - t * 0.025, q.y * 9.0 + sin(t * 0.05)));
      float band = smoothstep(0.42, 0.75, f) * m;
      c = mix(c, col, clamp(band * 0.55 * k, 0.0, 1.0));
    } else if (kind == 6) {
      float m = regionMask(i, P, 0.1) * k;
      float d = fbm(vec2(q.x * 7.0 + sin(t * 0.6) * 0.25, q.y * 7.0 + cos(t * 0.45) * 0.2));
      c *= 1.0 + m * (smoothstep(0.45, 0.7, d) * 0.22 - 0.06);
    } else if (kind == 0) {
      vec2 S = toP(uA[i].xy);
      vec2 dir = normalize(toP(uA[i].zw) - S);
      vec2 v = P - S;
      float along = dot(v, dir);
      float ang = atan(v.y, v.x) - atan(dir.y, dir.x);
      ang = mod(ang + PI, 2.0 * PI) - PI;
      float sp = max(uB[i].z, 0.02);
      float cone = exp(-ang * ang / (sp * sp)) * smoothstep(0.0, 0.25, along) * exp(-along * 0.9);
      float stripes = smoothstep(0.08, 0.55, n2(vec2(ang * 38.0, t * 0.18)) * n2(vec2(ang * 91.0 + 3.0, t * 0.11 + 7.0)));
      float breath = 0.75 + 0.25 * sin(t * 0.5 + ang * 6.0);
      c = screenAdd(c, col * cone * stripes * breath * 0.55 * k);
    } else if (kind == 1 || kind == 2) {
      int count = int(uB[i].w);
      float m = 0.0;
      vec2 S = toP(uA[i].xy);
      vec2 dir = kind == 1 ? normalize(toP(uA[i].zw) - S) : vec2(0.0, 1.0);
      vec2 lo = toP(uA[i].xy);
      vec2 hi = toP(uA[i].zw);
      for (int j = 0; j < MAX_MOTES; j++) {
        if (j >= count) break;
        float fi = float(j) + float(i) * 101.0;
        float life = fract(t * 0.03 * (0.5 + h1(fi * 5.3)) + h1(fi * 7.7));
        vec2 base;
        if (kind == 1) {
          float a = (h1(fi * 1.7) - 0.5) * 2.0 * uB[i].z;
          float dist = 0.25 + h1(fi * 3.1);
          base = S + rot(a) * dir * dist + vec2(sin(t * 0.4 + fi) * 0.02, life * 0.12 - 0.06);
        } else {
          vec2 r0 = vec2(h1(fi * 1.7), fract(h1(fi * 3.1) + life * 0.35));
          base = mix(lo, hi, r0) + vec2(sin(t * 0.4 + fi) * 0.02, 0.0);
        }
        float r = 0.0016 + h1(fi * 9.9) * 0.0022;
        float dd = length(P - base);
        float tw = 0.5 + 0.5 * sin(t * (2.0 + h1(fi) * 3.0) + fi);
        m += smoothstep(r, 0.0, dd) * sin(life * PI) * (0.4 + 0.6 * tw);
      }
      float boost = 1.0;
      if (kind == 1) {
        vec2 v = P - S;
        float ang = atan(v.y, v.x) - atan(dir.y, dir.x);
        ang = mod(ang + PI, 2.0 * PI) - PI;
        float along = dot(v, dir);
        float cone = exp(-ang * ang / 0.035) * smoothstep(0.0, 0.25, along) * exp(-along * 0.9);
        boost = 0.35 + cone * 2.0;
      }
      c += col * m * boost * k;
    } else if (kind == 3) {
      vec2 a = toP(uA[i].xy);
      vec2 ab = toP(uA[i].zw) - a;
      float hh = clamp(dot(P - a, ab) / dot(ab, ab), 0.0, 1.0);
      float d = length(P - (a + ab * hh));
      float blade = smoothstep(0.009, 0.002, d);
      float cyc = mod(uTime * uB[i].y, max(uB[i].z, 1.0)) / 1.6;
      float head = cyc * 1.4 - 0.2;
      float g = exp(-pow((hh - head) / 0.045, 2.0)) * step(cyc, 1.0);
      c += col * blade * g * 1.1 * smoothstep(0.25, 0.6, luma(c) + 0.2) * k;
      vec2 hp = a + ab * clamp(head, 0.0, 1.0);
      vec2 fp = P - hp;
      float star = exp(-abs(fp.x) * 420.0) * exp(-abs(fp.y) * 55.0) + exp(-abs(fp.y) * 420.0) * exp(-abs(fp.x) * 55.0);
      float gh = exp(-pow((clamp(head, 0.0, 1.0) - head) / 0.045, 2.0)) * step(cyc, 1.0);
      c += col * star * gh * 0.8 * k;
    } else if (kind == 7) {
      vec2 S = toP(uA[i].xy);
      float r = max(uB[i].z, 0.01);
      float d = length(P - S);
      float flicker = 0.82 + 0.12 * sin(t * 7.3 + float(i) * 1.7) + 0.06 * sin(t * 13.1 + float(i));
      c = screenAdd(c, col * exp(-d * d / (r * r)) * flicker * 0.6 * k);
    }
  }
  outColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}`;
