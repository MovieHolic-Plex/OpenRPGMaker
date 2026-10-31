// 캐릭터 외형 DB 「설명으로 / 사진으로 걷기 칩 만들기」 실제 화면 증명 (2026-10-31).
//   node scripts/qa/walk-chip-appearance-proof.mjs --url http://127.0.0.1:9977 --photo /path/person.jpg --out /tmp/walkchip-qa
// 이미 떠 있는 dev 서버(동반 서비스 /v1/workshop/gen 포함)를 쓴다 — 호스트가 char-gen(gen-kits lock 커밋)과 사용자 CLI 로 실제로 그린다.
// 두 외형을 만든다: 대장장이(설명 버튼) · 사진 속 사람(사진 버튼, 파일 선택). 각각 칩이 업로드 캐릭터칩으로 바뀌고, 그 외형을 쓰는
// 이벤트·배우가 새 칩으로 풀리는지 확인한다. 한 작업에 수 분~십수 분 걸린다.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { firefox } from "@playwright/test";

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : fallback; };
const base = arg("url", "http://127.0.0.1:9977");
const photo = arg("photo");
const out = arg("out", "/tmp/walkchip-qa");
const timeoutMs = Number(arg("timeout-min", "45")) * 60_000;
assert.ok(photo, "--photo <jpg|png> 가 필요하다");
await mkdir(out, { recursive: true });

const SMITH = "middle-aged village blacksmith, short brown hair, full beard, white shirt with rolled sleeves, brown leather apron, dark trousers";
const browser = await firefox.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (error) => errors.push(String(error)));
try {
  await page.addInitScript(() => {
    localStorage.setItem("oprn:editor-ui-mode", "expert");
    window.__boot = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Editor did not boot")), 180000);
      const observer = new MutationObserver(() => {
        if (document.querySelector("[data-testid='oprn-menu-bar']")) { clearTimeout(timer); observer.disconnect(); resolve(true); }
      });
      observer.observe(document, { childList: true, subtree: true });
    });
  });
  await page.goto(`${base}/?blankProject=1&aiBridge=0`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => window.__boot);
  await page.evaluate(async (smith) => {
    const { createBlankProject } = await import("/src/project/defaults.ts");
    const project = createBlankProject();
    project.database.characterAppearances = [
      { id: "smith", name: "대장장이 브론", description: smith, charset: { resourceId: "easyrpg-charset-actor1", characterIndex: 0 } },
      { id: "photo", name: "사진 속 사람", description: "", charset: { resourceId: "easyrpg-charset-actor1", characterIndex: 1 } },
    ];
    project.database.actors[0].appearanceId = "smith";
    window.__oprnEditorStore.replaceProject(project);
    const { addEvent } = await import("/src/editor/eventActions.ts");
    const { store } = await import("/src/project/store.ts");
    const eventId = addEvent(project.startMapId, 5, 5);
    store.update((draft) => {
      const event = draft.maps[draft.startMapId].events.find((entry) => entry.id === eventId);
      event.pages[0].graphic = { appearanceId: "smith", sprite: { type: "bundled", id: "easyrpg-charset-actor1" }, direction: "down", pattern: 1 };
    }, { scope: "project" });
    window.__qaEventId = eventId;
  }, SMITH);
  await page.evaluate(async () => { const m = await import("/src/editor/panels/databaseModal.ts"); m.openDatabaseModal("characterAppearances"); });
  await page.getByTestId("appearance-walkchip").first().waitFor({ timeout: 60000 });
  await page.screenshot({ path: `${out}/01-appearance-before.png` });

  // 1) 대장장이 — 설명으로
  await page.getByTestId("appearance-walkchip-text").click();
  await page.getByTestId("appearance-walkchip-status").waitFor({ timeout: 60000 });
  await page.screenshot({ path: `${out}/02-smith-generating.png` });

  // 2) 사진 속 사람 — 목록에서 고르고 사진으로
  await page.getByText("사진 속 사람", { exact: true }).first().click();
  await page.getByTestId("appearance-walkchip-photo-file").setInputFiles(photo);
  await page.getByTestId("appearance-walkchip-status").waitFor({ timeout: 60000 });
  await page.screenshot({ path: `${out}/03-photo-generating.png` });
  console.log("WALKCHIP_STARTED");

  const started = Date.now();
  let state;
  for (;;) {
    state = await page.evaluate(async () => {
      const { store } = await import("/src/project/store.ts");
      const { workshopQueue } = await import("/src/editor/workshop/queue/workshopQueue.ts");
      const p = store.getCurrent();
      const jobs = workshopQueue().snapshot().jobs.filter((v) => v.job.remote?.appearanceId).map((v) => ({
        appearanceId: v.job.remote.appearanceId, mode: v.job.remote.mode, state: v.state, progress: Math.round(v.progress * 100), error: v.job.error ?? null,
        stage: v.job.remote.status?.stage ?? null, engine: v.job.remote.status?.engine ?? null,
      }));
      const charsets = Object.fromEntries((p.database.characterAppearances ?? []).map((a) => [a.id, a.charset ?? null]));
      return { jobs, charsets };
    });
    const done = state.jobs.length === 2 && state.jobs.every((j) => j.state === "installed" || j.state === "failed");
    if (done) break;
    if (Date.now() - started > timeoutMs) throw new Error(`timeout: ${JSON.stringify(state)}`);
    console.log("WALKCHIP_WAIT", JSON.stringify(state.jobs));
    await page.waitForTimeout(20000);
  }
  const proof = await page.evaluate(async () => {
    const { store } = await import("/src/project/store.ts");
    const { resolveActorAppearance, resolveEventAppearanceGraphic } = await import("/src/project/characterAppearances.ts");
    const p = store.getCurrent();
    const event = p.maps[p.startMapId].events.find((entry) => entry.id === window.__qaEventId);
    const app = (id) => p.database.characterAppearances.find((a) => a.id === id);
    const asset = (id) => (id && p.assets.uploaded[id] ? { kind: p.assets.uploaded[id].kind, name: p.assets.uploaded[id].name } : null);
    return {
      smith: { charset: app("smith").charset, asset: asset(app("smith").charset?.resourceId) },
      photo: { charset: app("photo").charset, asset: asset(app("photo").charset?.resourceId) },
      actor: resolveActorAppearance(p, p.database.actors[0]).characterResourceId,
      event: resolveEventAppearanceGraphic(p, event.pages[0].graphic).sprite,
    };
  });
  console.log("WALKCHIP_JOBS", JSON.stringify(state.jobs));
  await page.getByText("대장장이 브론", { exact: true }).first().click();
  await page.screenshot({ path: `${out}/04-smith-after.png` });
  await page.getByText("사진 속 사람", { exact: true }).first().click();
  await page.screenshot({ path: `${out}/05-photo-after.png` });
  await page.keyboard.press("Escape");
  await page.screenshot({ path: `${out}/06-map-after.png` });
  await writeFile(`${out}/proof.json`, JSON.stringify({ jobs: state.jobs, proof, errors }, null, 2));
  for (const key of ["smith", "photo"]) {
    assert.equal(proof[key].asset?.kind, "charset", `${key}: 외형 칩이 업로드 캐릭터칩이 아니다`);
  }
  assert.equal(proof.actor, proof.smith.charset.resourceId, "배우가 외형의 새 칩으로 풀리지 않는다");
  assert.equal(proof.event?.id, proof.smith.charset.resourceId, "이벤트가 외형의 새 칩으로 풀리지 않는다");
  console.log("WALKCHIP_APPEARANCE_PASS", JSON.stringify(proof));
} catch (error) {
  console.error("WALKCHIP_FAIL", error instanceof Error ? error.message : String(error), JSON.stringify(errors.slice(0, 5)));
  await page.screenshot({ path: `${out}/failure.png` }).catch(() => undefined);
  process.exitCode = 1;
} finally {
  await browser.close();
  console.log(`cleanup: closed browser; evidence in ${out}`);
}
