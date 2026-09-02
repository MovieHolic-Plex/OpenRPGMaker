// 액터별 뒷모습 배틀러 시각 QA — 출하 플레이어(player.html) 경로로 **실제 전투 화면**을 띄워
// 6인의 뒷모습이 필드에 서는 것을 눈으로 확인한다.
//
// 왜 단위 테스트로 안 되나: `test/battleFieldAllySprite.test.ts` 는 `img.src` 문자열까지
// 단정하지만 그건 **어느 파일을 고르는지**의 증명이다. 그 그림이 필드에서 적과 나란히 놓였을 때
// 크기·위치·좌우 방향이 맞는지는 실제 렌더를 봐야 한다(포켓몬 스킨은 `scaleX(-1)` 로 뒤집는다).
//
// 왜 playwright 가 아닌가: 이 워크트리의 공유 node_modules 에 `@playwright/test` 가 없다
// (`scripts/runtime-qa.mjs` 도 같은 이유로 못 돈다). 대신 이미 있는 `puppeteer-core` 와
// 시스템 크롬을 쓴다 — 공유 node_modules 를 건드리지 않는다. 서버는 기존 QA 하네스의
// `startPlayerQaServer()` 를 그대로 재사용한다(브라우저 비의존적이다).
//
// 포켓몬 스킨은 `partyMax: 1` 이라 선두 1명만 필드에 선다. 그래서 6인을 한 화면에 세울 수 없고,
// **파티 선두를 바꿔 6회** 돌린다. 이건 제품 코드를 QA 용으로 고치지 않으려는 선택이다.
//
// 사용:
//   node scripts/qa/back-battler-qa.mjs                  # 6인 + rm2000 대조
//   node scripts/qa/back-battler-qa.mjs --only=hero-03
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";
import { startPlayerQaServer } from "../lib/runtimeQaRun.mjs";

const REPO_ROOT = fileURLToPath(new URL("../../", import.meta.url));
const OUT_DIR = join(REPO_ROOT, "verify-shots/back-battler-qa");
const FIXTURE = join(REPO_ROOT, "test/fixtures/projects/editor-authored-demo-v3.json");
const CHROME = process.env.CHROME_PATH ?? "/usr/bin/google-chrome";

const log = (msg) => console.log(`${new Date().toISOString()} [back-qa] ${msg}`);

/** 액터 ↔ 기대 뒷모습. 픽스처의 성직자·궁수는 hero-02/01 시트를 쓰므로 여기서 바로잡는다. */
const ACTORS = [
  { actorId: "actor_hero", slug: "hero-01", ko: "주인공" },
  { actorId: "actor_guardian", slug: "hero-02", ko: "수호자" },
  { actorId: "actor_mage", slug: "hero-03", ko: "마도사" },
  { actorId: "actor_scout", slug: "hero-04", ko: "정찰병" },
  { actorId: "actor_cleric", slug: "hero-05", ko: "성직자" },
  { actorId: "actor_ranger", slug: "hero-06", ko: "궁수" },
];

/**
 * QA 전용 프로젝트를 만든다. 원본 픽스처는 **건드리지 않는다** — 다른 테스트가 쓴다.
 *
 * @param base 원본 픽스처를 파싱한 객체
 * @param lead 선두로 세울 액터 id (포켓몬 스킨은 선두 1명만 필드에 세운다)
 * @param skin `system.battleUiStyle`
 */
function qaProject(base, lead, skin, opts = {}) {
  const project = structuredClone(base);
  project.system.battleUiStyle = skin;
  // 픽스처의 성직자·궁수는 hero-02 / hero-01 시트를 가리킨다(손으로 저작된 파일이라 기본 DB
  // 재배선이 닿지 않았다). 뒷모습 슬러그는 이 id 에서 유도되므로 바로잡아야 QA 가 성립한다.
  for (const { actorId, slug } of ACTORS) {
    const actor = project.database.actors.find((entry) => entry.id === actorId);
    if (actor) actor.battleCharacterResourceId = `generated-actor-${slug}-battle`;
  }
  if (opts.breakBackSlug) {
    // 대조군: 뒷모습 슬러그를 못 뽑게 만들어 **예전 공용 스프라이트**로 떨어뜨린다.
    // 크기·잘림이 이 폴백과 같다면 그건 내 변경이 만든 게 아니라 원래 그런 것이다.
    // 위 루프 **뒤**에 와야 한다 — 앞에 두면 루프가 되돌려 놓는다(실측: 대조군이 무력화됐다).
    const actor = project.database.actors.find((entry) => entry.id === lead);
    if (actor) actor.battleCharacterResourceId = "hero";
  }
  // 선두를 맨 앞으로. 나머지 순서는 유지해 HUD 가 4인으로 그대로 보이게 한다.
  const order = [lead, ...ACTORS.map((a) => a.actorId).filter((id) => id !== lead)].slice(0, 4);
  project.system.startActorIds = order;
  if (project.session) project.session.partyActorIds = [...order];
  return JSON.stringify(project);
}

/**
 * 하네스 페이지에 전투를 세운다. 맵 주행·이벤트 트리거는 태우지 않는다 —
 * 그 경로가 이 환경에서 심하게 플레이키했다(실측: action() 반복 7/3, z 키 반복 8/1).
 * 전투 화면은 DOM + CSS 이므로 `mountBattleScene()` 직접 호출로 같은 화면이 나온다.
 */
async function mountBattle(page, projectJson, troopId) {
  await page.waitForFunction(() => window.__qaBattle?.ready === true, { timeout: 120_000 });
  const result = await page.evaluate(
    async ([json, troop]) => window.__qaBattle.mount({ projectJson: json, troopId: troop }),
    [projectJson, troopId],
  );
  if (!result.ok) throw new Error(`mount 실패: ${result.error}`);
  await page.waitForFunction(() => document.querySelector("[data-testid='battle-field']") !== null, { timeout: 30_000 });
  // 인트로 전환·스프라이트 디코드가 끝나야 박스가 제자리 값이다.
  await page.evaluate(async () => {
    await Promise.all([...document.images].filter((i) => !i.complete).map((i) => i.decode().catch(() => {})));
  });
  await new Promise((r) => setTimeout(r, 1200));
}

/** 필드에 실제로 붙은 아군 이미지를 읽는다 — 이게 QA 의 판정 근거다. */
async function readAllySprite(page) {
  return await page.evaluate(() => {
    const node = document.querySelector(".battle-actor-group .battle-actor");
    if (!node) return { found: false };
    const img = node.querySelector(".battle-actor-image");
    const sprite = node.querySelector(".battle-actor-sprite");
    const el = img ?? sprite;
    const rect = el?.getBoundingClientRect();
    const style = el ? getComputedStyle(el) : null;
    // 어느 CSS 규칙이 이 이미지 크기를 정했는지 같이 캔다 — 박스가 기대와 다를 때
    // "CSS 가 안 걸렸나 / 다른 규칙이 이겼나" 를 스크린샷만 보고는 가를 수 없다.
    const matchedRules = [];
    if (el) {
      for (const sheet of document.styleSheets) {
        let rules;
        try {
          rules = sheet.cssRules;
        } catch {
          continue; // 크로스 오리진 시트는 못 읽는다
        }
        for (const rule of rules) {
          if (!rule.selectorText) continue;
          if (!/battle-actor-image|battle-actor-sprite|battle-actor\b/.test(rule.selectorText)) continue;
          let hit = false;
          try {
            hit = el.matches(rule.selectorText);
          } catch {
            hit = false;
          }
          if (hit && (rule.style.width || rule.style.height || rule.style.transform)) {
            matchedRules.push({ selector: rule.selectorText, width: rule.style.width || null, height: rule.style.height || null, transform: rule.style.transform || null });
          }
        }
      }
    }
    const scene = document.querySelector(".battle-scene") ?? document.querySelector("[data-testid='battle-scene']");
    const fieldRect = document.querySelector("[data-testid='battle-field']")?.getBoundingClientRect();
    return {
      found: true,
      sceneUiStyle: scene?.getAttribute("data-battle-ui-style") ?? null,
      matchedRules,
      computedSize: style ? { width: style.width, height: style.height, objectFit: style.objectFit } : null,
      fieldBox: fieldRect ? { w: Math.round(fieldRect.width), h: Math.round(fieldRect.height), y: Math.round(fieldRect.y), bottom: Math.round(fieldRect.bottom) } : null,
      partyFacing: node.dataset.partyFacing ?? null,
      actorBackBattler: node.dataset.actorBackBattler ?? null,
      monsterBattler: node.dataset.monsterBattler ?? null,
      authoredBattler: node.dataset.authoredBattler ?? null,
      kind: img ? "img" : sprite ? "sprite" : "none",
      src: img?.getAttribute("src") ?? null,
      backgroundImage: sprite ? style?.backgroundImage ?? null : null,
      transform: style?.transform ?? null,
      box: rect ? { w: Math.round(rect.width), h: Math.round(rect.height), x: Math.round(rect.x), y: Math.round(rect.y) } : null,
      naturalSize: img ? { w: img.naturalWidth, h: img.naturalHeight } : null,
      complete: img ? img.complete : null,
    };
  });
}

/** 적 배틀러 박스 — 아군과 겹치는지 보려면 둘 다 필요하다. */
async function readEnemyBoxes(page) {
  return await page.evaluate(() =>
    [...document.querySelectorAll(".battle-enemy-group .battle-enemy")].map((node) => {
      const r = node.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x), y: Math.round(r.y) };
    }),
  );
}

async function runCase(browser, baseProject, { id, lead, skin, note, breakBackSlug }) {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e?.message ?? e)));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console: ${m.text()}`);
  });
  await page.setViewport({ width: 1280, height: 800 });
  // 하네스는 프로젝트를 evaluate 인자로 직접 받는다 — 부팅 훅·fetch 가로채기가 필요 없다.
  const body = qaProject(baseProject, lead, skin, { breakBackSlug });

  await page.goto(`${globalThis.__qaServerUrl}/qa-back-battler.html`, { waitUntil: "domcontentloaded" });
  await mountBattle(page, body, "troop_slime_pair");

  const ally = await readAllySprite(page);
  const enemies = await readEnemyBoxes(page);
  await page.screenshot({ path: join(OUT_DIR, `${id}.png`) });
  // 아군 스프라이트만 잘라 확대해 둔다 — 전체 샷에서는 205px 라 디테일이 안 보인다.
  if (ally.box && ally.box.w > 0) {
    const pad = 16;
    await page.screenshot({
      path: join(OUT_DIR, `${id}-ally.png`),
      clip: {
        x: Math.max(0, ally.box.x - pad),
        y: Math.max(0, ally.box.y - pad),
        width: ally.box.w + pad * 2,
        height: ally.box.h + pad * 2,
      },
    });
  }
  await page.close();
  return { id, lead, skin, note, ally, enemies, errors };
}

const only = String(process.argv.find((a) => a.startsWith("--only="))?.slice(7) ?? "").trim();

const cases = ACTORS.filter((a) => !only || a.slug === only).map((a) => ({
  id: `pokemon-${a.slug}`,
  lead: a.actorId,
  skin: "pokemon",
  note: `포켓몬 스킨 · 선두 ${a.ko}(${a.slug}) — 뒷모습이 서야 한다`,
}));
// 대조군: 같은 액터를 정면 스킨으로. 뒷모습이 정면 경로에 끼어들지 않는지 눈으로 본다.
if (!only || only === "hero-01") {
  cases.push({ id: "rm2000-hero-01", lead: "actor_hero", skin: "rm2000", note: "대조 · 정면 전투 — 저작 시트가 그대로 서야 한다" });
  // 뒷모습이 없는 액터 — 예전 공용 스프라이트로 떨어진다. 크기·잘림 비교의 기준선이다.
  cases.push({ id: "pokemon-fallback-shared", lead: "actor_hero", skin: "pokemon", breakBackSlug: true, note: "대조 · 뒷모습 없음 → 예전 공용 ally-creature-back" });
}

const baseProject = JSON.parse(await readFile(FIXTURE, "utf8"));
await rm(OUT_DIR, { recursive: true, force: true });
await mkdir(OUT_DIR, { recursive: true });

log(`서버 기동 중 (vite.player-qa.config.ts)`);
const server = await startPlayerQaServer();
globalThis.__qaServerUrl = server.url;
log(`서버 ${server.url}`);
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: "shell",
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--force-device-scale-factor=1"],
});

const results = [];
try {
  for (const testCase of cases) {
    log(`실행 ${testCase.id} — ${testCase.note}`);
    try {
      const result = await runCase(browser, baseProject, testCase);
      results.push(result);
      const a = result.ally;
      log(
        `  → facing=${a.partyFacing} back=${a.actorBackBattler ?? "-"} kind=${a.kind} ` +
          `src=${(a.src ?? a.backgroundImage ?? "-").replace(/^.*\/(?=[^/]+$)/, "")} ` +
          `box=${a.box ? `${a.box.w}×${a.box.h}` : "-"} natural=${a.naturalSize ? `${a.naturalSize.w}×${a.naturalSize.h}` : "-"} ` +
          `transform=${a.transform ?? "-"} errors=${result.errors.length}`,
      );
    } catch (error) {
      log(`  FAIL ${testCase.id}: ${String(error?.message ?? error).split("\n")[0]}`);
      results.push({ ...testCase, error: String(error?.message ?? error) });
    }
  }
} finally {
  await browser.close();
  await server.close();
}

await writeFile(join(OUT_DIR, "results.json"), `${JSON.stringify(results, null, 2)}\n`, "utf8");
log(`끝 — ${results.length}건. ${OUT_DIR}`);
