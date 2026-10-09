#!/usr/bin/env node
// 현재 런타임에 등록된 절차 생성 전투 이펙트를 실제 프레임 순서로 재생하는
// 자체 포함 HTML 카탈로그를 만든다. PNG 원본을 data URI로 넣으므로 보고서 한 장만 열면 된다.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const CATALOG_PATH = "src/assets/generatedEffectSheets.json";
const SOUND_MANIFEST_PATH = "public/assets/easyrpg/rtp-manifest.json";
const ASSET_DIR = "public/assets/generated/effects";
const OUTPUT_PATH = "reports/generated-effect-showcase-2026-08-24.html";
const catalog = JSON.parse(readFileSync(CATALOG_PATH, "utf8"));
// 시트 px → 무대 논리 px. 96px 시대엔 2, 384px 고해상도 시트는 0.5 — 어느 쪽이든 화면 192px 로 보인다.
const DISPLAY_SCALE = catalog.sheet.assetScale ?? 2;
const soundManifest = JSON.parse(readFileSync(SOUND_MANIFEST_PATH, "utf8"));
const soundAssetsById = new Map(
  soundManifest.assets.filter((asset) => asset.category === "sound").map((asset) => [asset.id, asset])
);
const { frameWidth, frameHeight, frameDurationMs } = catalog.sheet;

function escapeHtml(value) {
  return String(value).replace(/[&<>\"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
  })[character]);
}

function pngDimensions(bytes) {
  const signature = bytes.subarray(0, 8).toString("hex");
  if (signature !== "89504e470d0a1a0a") throw new Error("PNG 시그니처가 아니다");
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

function colorHex(flash) {
  if (!flash) return null;
  return `#${[flash.red, flash.green, flash.blue]
    .map((channel) => channel.toString(16).padStart(2, "0"))
    .join("")}`;
}

const legacyAnimationIds = {
  "arcane-nova": "anim_magic",
  "heal-bloom": "anim_heal",
  "poison-mist": "anim_poison",
};

const effects = catalog.effects.map((effect) => {
  const columns = effect.frameCount;
  const assetPath = path.join(ASSET_DIR, `effect-${effect.slug}.png`);
  const bytes = readFileSync(assetPath);
  const dimensions = pngDimensions(bytes);
  const expected = { width: frameWidth * columns, height: frameHeight };
  if (dimensions.width !== expected.width || dimensions.height !== expected.height) {
    throw new Error(`${effect.slug}: ${dimensions.width}x${dimensions.height}, expected ${expected.width}x${expected.height}`);
  }
  if (!effect.sound || effect.sound.frameIndex < 0 || effect.sound.frameIndex >= columns) {
    throw new Error(`${effect.slug}: 유효한 sound 프레임이 없다`);
  }
  const soundAsset = soundAssetsById.get(effect.sound.resourceId);
  if (!soundAsset) throw new Error(`${effect.slug}: 효과음 리소스가 없다 (${effect.sound.resourceId})`);
  const soundBytes = readFileSync(path.join("public", soundAsset.path));
  return {
    ...effect,
    animationId: legacyAnimationIds[effect.slug] ?? `anim_gen_${effect.slug.replaceAll("-", "_")}`,
    resourceId: `generated-battle-anim-${effect.slug}`,
    dataUri: `data:image/png;base64,${bytes.toString("base64")}`,
    soundFileName: soundAsset.fileName,
    soundDataUri: `data:audio/wav;base64,${soundBytes.toString("base64")}`,
  };
});

if (effects.length === 0) throw new Error("생성 이펙트가 없다");

function effectCard(effect) {
  const columns = effect.frameCount;
  const filmWidth = frameWidth * columns * DISPLAY_SCALE;
  const flash = effect.flash;
  const shake = effect.shake;
  const sound = effect.sound;
  const flashColor = colorHex(flash);
  const detail = [
    `<span>${effect.scope === "allTargets" ? "전체 대상" : "단일 대상"}</span>`,
    `<span>위치 ${escapeHtml(effect.position)}</span>`,
    `<span>♪ ${escapeHtml(effect.soundFileName)} · ${sound.frameIndex + 1}번 프레임</span>`,
    flash
      ? `<span><i class="color-dot" style="background:${flashColor}"></i>${escapeHtml(flash.target)} 플래시 · ${flash.durationFrames}f</span>`
      : "<span>플래시 없음</span>",
    shake
      ? `<span>흔들림 ${shake.power} · ${shake.durationFrames}f</span>`
      : "<span>흔들림 없음</span>",
  ].join("");
  const tags = effect.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("");
  return `
    <article class="effect-card" data-effect="${escapeHtml(effect.slug)}">
      <header>
        <div>
          <h2>${escapeHtml(effect.name)}</h2>
          <code>${escapeHtml(effect.animationId)}</code>
        </div>
        <b>${columns} FRAME</b>
      </header>
      <div class="stage" aria-label="${escapeHtml(effect.name)} ${columns}프레임 반복 재생">
        <div class="sprite" style="--film-width:${filmWidth}px;--film-duration:${columns * frameDurationMs}ms;background-image:url('${effect.dataUri}');background-size:${filmWidth}px ${frameHeight * DISPLAY_SCALE}px;animation-timing-function:steps(${columns},end)"></div>
      </div>
      <div class="timeline" aria-label="${escapeHtml(effect.name)} 원본 프레임 스트립">
        <img src="${effect.dataUri}" alt="${escapeHtml(effect.name)} 원본 ${columns}프레임" width="${frameWidth * columns}" height="${frameHeight}">
        <div style="grid-template-columns:repeat(${columns},1fr)">${Array.from({ length: columns }, (_unused, index) => `<span class="${index === sound.frameIndex ? "sound-frame" : ""}">${index + 1}${index === sound.frameIndex ? " ♪" : ""}</span>`).join("")}</div>
      </div>
      <div class="details">${detail}</div>
      <div class="tags">${tags}</div>
      <footer>
        <button type="button" class="paired-preview" data-paired-preview data-name="${escapeHtml(effect.name)}" data-sound-frame="${sound.frameIndex}">▶ 이펙트 + 효과음</button>
        <code>${escapeHtml(effect.resourceId)}</code>
        <audio preload="auto" data-effect-audio src="${effect.soundDataUri}"></audio>
      </footer>
    </article>`;
}

const html = `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>전투 스킬 이펙트 실제 재생 카탈로그</title>
  <style>
    :root { color-scheme: dark; --speed:1; --ink:#f5f7ff; --muted:#9da7bd; --line:#2a3246; --panel:#141a28; --accent:#7ce6d5; }
    * { box-sizing:border-box; }
    body { margin:0; background:#090d16; color:var(--ink); font-family:Inter,"Pretendard",system-ui,sans-serif; }
    main { width:min(1240px,calc(100% - 32px)); margin:0 auto; padding:42px 0 72px; }
    .hero { display:grid; grid-template-columns:1fr auto; align-items:end; gap:24px; margin-bottom:22px; }
    h1 { margin:0 0 8px; font-size:clamp(28px,4vw,48px); letter-spacing:-.04em; }
    .hero p { margin:0; color:var(--muted); line-height:1.65; }
    .facts { display:flex; gap:8px; flex-wrap:wrap; justify-content:flex-end; }
    .facts span,.details span,.tags span { border:1px solid var(--line); border-radius:999px; padding:6px 9px; color:#cbd3e5; font-size:12px; }
    .controls { position:sticky; top:0; z-index:5; display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin:0 0 22px; padding:11px 0; background:rgba(9,13,22,.92); backdrop-filter:blur(10px); }
    button { appearance:none; border:1px solid var(--line); border-radius:8px; background:#151d2d; color:var(--ink); padding:8px 12px; cursor:pointer; }
    button:hover,button[aria-pressed="true"] { border-color:var(--accent); color:var(--accent); }
    #status { margin-left:auto; color:var(--muted); font-size:13px; }
    .grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:18px; }
    .effect-card { overflow:hidden; border:1px solid var(--line); border-radius:16px; background:linear-gradient(160deg,#171e2e,#101522); box-shadow:0 16px 50px rgba(0,0,0,.2); }
    .effect-card header { display:flex; justify-content:space-between; align-items:start; gap:18px; padding:18px 18px 12px; }
    h2 { margin:0 0 4px; font-size:20px; }
    code { color:#92a6d3; font-family:"Cascadia Code",monospace; font-size:12px; overflow-wrap:anywhere; }
    .effect-card header b { color:var(--accent); font:700 11px/1 "Cascadia Code",monospace; letter-spacing:.12em; }
    .stage { display:grid; place-items:center; min-height:232px; border-block:1px solid var(--line); background-color:#0b101b; background-image:linear-gradient(45deg,#111827 25%,transparent 25%),linear-gradient(-45deg,#111827 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#111827 75%),linear-gradient(-45deg,transparent 75%,#111827 75%); background-size:24px 24px; background-position:0 0,0 12px,12px -12px,-12px 0; }
    .sprite { width:${frameWidth * DISPLAY_SCALE}px; height:${frameHeight * DISPLAY_SCALE}px; background-repeat:no-repeat; image-rendering:${DISPLAY_SCALE >= 1 ? "pixelated" : "auto"}; animation-name:effect-film; animation-duration:calc(var(--film-duration) * var(--speed)); animation-iteration-count:infinite; }
    @keyframes effect-film { to { background-position-x:calc(-1 * var(--film-width)); } }
    .timeline { padding:14px 18px 8px; }
    .timeline img { display:block; width:100%; height:auto; image-rendering:pixelated; border-radius:6px; background:#0b101b; }
    .timeline div { display:grid; color:#68748d; font:11px/1.4 "Cascadia Code",monospace; text-align:center; }
    .timeline .sound-frame { color:#ffe99a; background:#3a3218; border-radius:0 0 5px 5px; }
    .details,.tags { display:flex; gap:6px; flex-wrap:wrap; padding:4px 18px; }
    .details span { background:#0d1320; }
    .tags span { border-color:transparent; background:#1d2940; color:#aebbd4; }
    .color-dot { display:inline-block; width:8px; height:8px; margin-right:6px; border-radius:50%; box-shadow:0 0 9px currentColor; }
    .effect-card footer { display:flex; align-items:center; gap:10px; padding:12px 18px 18px; }
    .effect-card footer code { margin-left:auto; text-align:right; }
    .paired-preview { border-color:#5f5531; background:#292515; color:#ffe99a; font-weight:700; }
    .effect-card.is-sounding { border-color:#d8bf5b; box-shadow:0 0 0 1px #d8bf5b,0 18px 60px rgba(216,191,91,.18); }
    .note { margin-top:22px; padding:14px 16px; border-left:3px solid var(--accent); background:#111827; color:#c6cede; line-height:1.6; }
    @media (max-width:780px) { .hero { grid-template-columns:1fr; } .facts { justify-content:flex-start; } .grid { grid-template-columns:1fr; } #status { width:100%; margin-left:0; } }
    @media (prefers-reduced-motion:reduce) { .sprite { animation-play-state:paused; } }
  </style>
</head>
<body>
<main>
  <section class="hero">
    <div>
      <h1>전투 스킬 이펙트 · 실제 재생</h1>
      <p>GIF 파일이 아니라 런타임이 쓰는 PNG 스프라이트 시트를 처음부터 끝까지 순서대로 재생한다.<br>카드의 버튼을 누르면 실제 기본 효과음이 충격 프레임에 맞춰 함께 재생된다.</p>
    </div>
    <div class="facts"><span>${effects.length}종</span><span>효과음 ${effects.length}종</span><span>8~12프레임</span><span>600~900ms</span></div>
  </section>
  <nav class="controls" aria-label="재생 제어">
    <button type="button" id="toggle">일시정지</button>
    <button type="button" id="replay">처음부터</button>
    <button type="button" data-speed="1" aria-pressed="true">1×</button>
    <button type="button" data-speed="2" aria-pressed="false">½×</button>
    <button type="button" data-speed="4" aria-pressed="false">¼×</button>
    <span id="status" aria-live="polite">${effects.length}종 재생 중 · 75ms/프레임</span>
  </nav>
  <section class="grid">${effects.map(effectCard).join("")}</section>
  <p class="note">위 애니메이션과 효과음은 기본 DB의 동일 전투 애니메이션 레코드에 한 세트로 저장된다. 노란 ♪ 숫자가 실제 효과음 발음 프레임이며, 전투와 맵 애니메이션 모두 이 타이밍을 사용한다.</p>
</main>
<script>
  const sprites = [...document.querySelectorAll('.sprite')];
  const toggle = document.getElementById('toggle');
  const status = document.getElementById('status');
  let paused = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let speed = 1;
  const soundTimers = new Set();
  function stopAllSounds() {
    soundTimers.forEach((timer) => clearTimeout(timer));
    soundTimers.clear();
    document.querySelectorAll('[data-effect-audio]').forEach((audio) => { audio.pause(); audio.currentTime = 0; });
    document.querySelectorAll('.effect-card').forEach((card) => card.classList.remove('is-sounding'));
  }
  function restartSprite(sprite) {
    sprite.style.animation = 'none';
    void sprite.offsetWidth;
    sprite.style.animation = '';
  }
  function renderState() {
    sprites.forEach((sprite) => { sprite.style.animationPlayState = paused ? 'paused' : 'running'; });
    toggle.textContent = paused ? '재생' : '일시정지';
    status.textContent = paused ? '정지됨' : '${effects.length}종 재생 중 · ' + (${frameDurationMs} * speed) + 'ms/프레임';
  }
  toggle.addEventListener('click', () => { paused = !paused; if (paused) stopAllSounds(); renderState(); });
  document.getElementById('replay').addEventListener('click', () => {
    stopAllSounds();
    sprites.forEach(restartSprite);
    paused = false;
    renderState();
  });
  document.querySelectorAll('[data-speed]').forEach((button) => button.addEventListener('click', () => {
    speed = Number(button.dataset.speed);
    document.documentElement.style.setProperty('--speed', String(speed));
    document.querySelectorAll('[data-speed]').forEach((entry) => entry.setAttribute('aria-pressed', String(entry === button)));
    renderState();
  }));
  document.querySelectorAll('[data-paired-preview]').forEach((button) => button.addEventListener('click', () => {
    const card = button.closest('.effect-card');
    const sprite = card.querySelector('.sprite');
    const audio = card.querySelector('[data-effect-audio]');
    stopAllSounds();
    paused = false;
    restartSprite(sprite);
    renderState();
    const delay = Number(button.dataset.soundFrame) * ${frameDurationMs} * speed;
    status.textContent = button.dataset.name + ' 세트 재생 · 효과음까지 ' + delay + 'ms';
    const timer = setTimeout(() => {
      soundTimers.delete(timer);
      card.classList.add('is-sounding');
      audio.currentTime = 0;
      audio.volume = 0.4;
      audio.play().catch(() => { status.textContent = '브라우저가 오디오 재생을 차단했습니다. 버튼을 다시 눌러주세요.'; });
      audio.addEventListener('ended', () => card.classList.remove('is-sounding'), { once:true });
    }, delay);
    soundTimers.add(timer);
  }));
  renderState();
</script>
</body>
</html>`;

mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
writeFileSync(OUTPUT_PATH, html, "utf8");
console.log(`보고서: ${OUTPUT_PATH}`);
console.log(`  ${effects.length}종 · 8~12프레임 · ${frameDurationMs}ms/프레임 · ${(Buffer.byteLength(html) / 1024).toFixed(1)}KB`);
