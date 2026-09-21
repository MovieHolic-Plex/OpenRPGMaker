// 진단 전용 — Neo둥근모 + 갈색 윈도우스킨 채증. W1(폰트)/W2(따뜻한 크롬)/W3(잘림 0) 증거를 한 번에 만든다.
import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { createBlankProject } from "@/project/defaults";
import type { Project } from "@/project/types";
import { seedProjectForEditor } from "./projectSeed";
import { startNewGameFromTitle } from "./runtimeInput";
import { openTestPlayWindow } from "./oprnPlayerStatusMenuHelpers";

const DIR = ".omo/evidence/runtime-warm-skin";
const LABEL = process.env.WARM_LABEL ?? "green";

function project(): Project {
  const p = createBlankProject();
  p.session.inventory = {
    item_potion: 3, item_ether: 1, item_antidote: 2, item_hi_potion: 1,
    equip_scout_dagger: 1, equip_iron_sword: 1, equip_oak_shield: 1, equip_leather_armor: 1,
  };
  p.session = { ...p.session, partyActorIds: p.database.actors.slice(0, 4).map((a) => a.id) };
  return p;
}

type Node = {
  readonly testid?: string;
  readonly cls: string;
  readonly text: string;
  readonly family: string;
  readonly size: string;
  readonly eff: number;
  readonly clipX: number;
  readonly clipY: number;
  readonly outBottom: number;
  readonly outTop: number;
  readonly outRight: number;
  readonly outLeft: number;
};

test("warm: esc menu on Neo둥근모 + brown windowskin, nothing clipped", async ({ page }) => {
  mkdirSync(DIR, { recursive: true });
  const consoleLines: string[] = [];
  const failedRequests: string[] = [];
  const assetStatus: Record<string, number> = {};
  page.on("console", (m) => consoleLines.push(`[${m.type()}] ${m.text()}`));
  page.on("pageerror", (e) => consoleLines.push(`[pageerror] ${e.message}`));
  // ERR_CONNECTION_REFUSED 가끔 뜨는데 console 메시지만으로는 어떤 URL 이 죽었는지 모른다.
  // 실패한 요직의 URL 을 함게 받아야 "내 변경 탓이냐 vs 밖 서버가 없는 것이냐" 를 가른다.
  page.on("requestfailed", (r) => failedRequests.push(`${r.failure()?.errorText ?? "failed"} ${r.url()}`));
  page.on("response", (r) => {
    const u = r.url();
    if (/neodgm\.woff2|windowskin-warm\.png|windowskin-default\.png/.test(u)) assetStatus[u.split("/").pop()!] = r.status();
  });

  await page.setViewportSize({ width: 1280, height: 900 });
  await seedProjectForEditor(page, project(), "/?e2eVitals=1");
  await openTestPlayWindow(page);
  await startNewGameFromTitle(page);
  await expect(page.getByTestId("play-stage")).toBeVisible({ timeout: 15000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${DIR}/${LABEL}-01-play-stage.png` });

  await page.keyboard.press("Escape");
  if ((await page.getByTestId("main-menu").count()) === 0) await page.keyboard.press("x");
  await expect(page.getByTestId("main-menu")).toBeVisible({ timeout: 8000 });
  await page.waitForTimeout(400);

  const scan = async (label: string) => page.evaluate((lbl) => {
    const menu = document.querySelector("[data-testid='main-menu']");
    if (!(menu instanceof HTMLElement)) throw new Error("no menu");
    const menuRect = menu.getBoundingClientRect();
    const stageScale = menu.offsetHeight > 0 ? menuRect.height / menu.offsetHeight : 1;
    const nodes: Record<string, unknown>[] = [];
    for (const n of Array.from(menu.querySelectorAll<HTMLElement>("*"))) {
      const r = n.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const cs = getComputedStyle(n);
      const ownText = Array.from(n.childNodes).some((c) => c.nodeType === 3 && (c.textContent ?? "").trim().length > 0);
      if (!ownText) continue;
      nodes.push({
        testid: n.dataset.testid,
        cls: n.className.toString().slice(0, 60),
        text: (n.textContent ?? "").trim().slice(0, 28),
        family: cs.fontFamily,
        size: cs.fontSize,
        eff: Math.round(parseFloat(cs.fontSize) * stageScale * 100) / 100,
        // 잘림 = 내용이 상자보다 넓거나 높다. 1px 는 반올림 여유.
        clipX: n.scrollWidth - n.clientWidth,
        clipY: n.scrollHeight - n.clientHeight,
        // 자기 상자는 멀쩡한데 **조상 경계**에 잘리는 경우가 따로 있다.
        // 실측: Neo둥근모로 바꾼 뒤 하단 푸터(돈/설명/시간)가 메뉴 아래로 밀려
        // 글자 중간이 가로로 잘렸는데, scrollHeight 비교로는 안 잡혔다.
        outBottom: Math.round((r.bottom - menuRect.bottom) * 100) / 100,
        outTop: Math.round((menuRect.top - r.top) * 100) / 100,
        outRight: Math.round((r.right - menuRect.right) * 100) / 100,
        outLeft: Math.round((menuRect.left - r.left) * 100) / 100,
      });
    }
    // 크롬: 스킨 URL + 실제 배경 픽셀 온도
    const panel = menu.querySelector("[data-testid='status-menu-detail']") ?? menu;
    const pcs = getComputedStyle(panel as Element);
    return {
      label: lbl,
      scale: Math.round(stageScale * 1000) / 1000,
      nodes,
      skin: {
        rootVar: getComputedStyle(menu).getPropertyValue("--runtime-window-skin").trim(),
        panelBorderImage: pcs.borderImageSource.slice(0, 200),
      },
    };
  }, label);

  const dumps = [await scan("main")];
  await page.getByTestId("main-menu").screenshot({ path: `${DIR}/${LABEL}-02-esc-main.png` });
  for (const cmd of ["items", "equipment", "skills"] as const) {
    const btn = page.getByTestId(`status-menu-command-${cmd}`);
    if (await btn.count() === 0) continue;
    await btn.click();
    await page.waitForTimeout(220);
    await page.getByTestId("main-menu").screenshot({ path: `${DIR}/${LABEL}-03-esc-${cmd}.png` });
    dumps.push(await scan(cmd));
  }

  // 파티·기록·시스템은 도트에 적혀 있는 그룹이다. 레일 버튼의 testid 는 그룹 항목 id
  // (`party-menu`)로 만들어진다 — `status-menu-command-party` 로 찾으면 count 0 이 되어
  // 파티·상태 서피스가 조용하게 건너뛰연다(실제로 이 덤프가 4개만 나오는 버그를 겪었다).
  const partyEntry = page.getByTestId("status-menu-command-party-menu");
  await expect(partyEntry, "파티 그룹 레일 버튼을 못 찾았다").toHaveCount(1);
  await partyEntry.click();
  await page.waitForTimeout(280);
  await page.getByTestId("main-menu").screenshot({ path: `${DIR}/${LABEL}-03-esc-party.png` });
  dumps.push(await scan("party"));

  // 파티는 트레이만 열고 실제 작업 패널은 하위 명령에서 열린다 — 상태(status) 서피스까지 재야
  // W3 가 요구하는 여섯 서피스(main/items/equipment/skills/party/status)를 전부 덮는다.
  const statusCmd = page.getByTestId("status-menu-group-command-status");
  await expect(statusCmd, "파티 트레이의 상태 명령을 못 찾았다").toHaveCount(1);
  await statusCmd.click();
  await page.waitForTimeout(300);
  await page.getByTestId("main-menu").screenshot({ path: `${DIR}/${LABEL}-03-esc-status.png` });
  dumps.push(await scan("status"));

  // 여섯 서피스가 전부 재졌는지 봉인한다. 측정된 서피스가 모자라면 "잔림 0" 은 야부다.
  expect(dumps.map((d) => d.label), "여섯 서피스 전수 측정 실패").toEqual([
    "main", "items", "equipment", "skills", "party", "status",
  ]);

  // W2: 패널 배경 픽셀이 정말 따뜻한가 — 스크린샷에서 직접 샘플링한다.
  const shot = await page.getByTestId("main-menu").screenshot();
  const warmth = await page.evaluate(async (b64) => {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = `data:image/png;base64,${b64}`; });
    const c = document.createElement("canvas");
    c.width = img.width; c.height = img.height;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    let warm = 0, cool = 0;
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 200) continue;
      if (d[i] > d[i + 2] + 8) warm++; else if (d[i + 2] > d[i] + 8) cool++;
    }
    return { warm, cool, w: img.width, h: img.height };
  }, shot.toString("base64"));

  writeFileSync(`${DIR}/${LABEL}-warm-dump.json`, JSON.stringify({ dumps, warmth, assetStatus, failedRequests }, null, 2));
  writeFileSync(`${DIR}/${LABEL}-console.txt`, [...consoleLines, ...failedRequests.map((f) => `[requestfailed] ${f}`)].join("\n"));

  const clipped = dumps.flatMap((d) => (d.nodes as Node[])
    .filter((n) => n.clipX > 1 || n.clipY > 1 || n.outBottom > 1 || n.outTop > 1 || n.outRight > 1 || n.outLeft > 1)
    .map((n) => `${d.label} ${n.testid ?? n.cls} "${n.text}" clipX=${n.clipX} clipY=${n.clipY}`
      + ` outBottom=${n.outBottom} outTop=${n.outTop} outRight=${n.outRight} outLeft=${n.outLeft}`));
  writeFileSync(`${DIR}/${LABEL}-clipped.txt`, clipped.join("\n"));

  console.log(`WARM_SCALE=${dumps[0].scale} WARM_PIXELS=${warmth.warm} COOL_PIXELS=${warmth.cool} CLIPPED=${clipped.length}`);
  console.log(`ASSETS=${JSON.stringify(assetStatus)}`);

  // W1: 모든 글자가 Neo둥근모, 화면 렌더 10px 이상
  const wrongFont = dumps.flatMap((d) => (d.nodes as Node[])
    .filter((n) => !/NeoDunggeunmo/.test(n.family))
    .map((n) => `${d.label} ${n.testid ?? n.cls} "${n.text}" -> ${n.family}`));
  expect(wrongFont, `Neo둥근모가 아닌 텍스트 노드:\n${wrongFont.join("\n")}`).toEqual([]);
  expect(assetStatus["neodgm.woff2"], "neodgm.woff2 가 200 이 아니다").toBe(200);
  const tooSmall = dumps.flatMap((d) => (d.nodes as Node[])
    .filter((n) => n.eff < 10)
    .map((n) => `${d.label} ${n.testid ?? n.cls} CSS ${n.size} * ${d.scale} = ${n.eff}px`));
  expect(tooSmall, `화면 렌더 10px 밑:\n${tooSmall.join("\n")}`).toEqual([]);

  // W2: 갈색 스킨이 실제로 칠해지고 화면이 따뜻하다
  expect(dumps[0].skin.rootVar, "저작 스킨이 warm 이 아니다").toContain("windowskin-warm");
  expect(dumps[0].skin.panelBorderImage, "패널이 스킨을 칠하지 않는다").toContain("url");
  expect(assetStatus["windowskin-warm.png"], "windowskin-warm.png 가 200 이 아니다").toBe(200);
  expect(warmth.warm, `따뜻한 픽셀이 차가운 픽셀보다 많아야 한다 (warm=${warmth.warm} cool=${warmth.cool})`).toBeGreaterThan(warmth.cool);

  // W3: 잘린 텍스트 0
  expect(clipped, `잘린 텍스트 노드:\n${clipped.join("\n")}`).toEqual([]);

  // 콘솔 오류 0 — 단, AI 활동 로그 및 보조 보로수는 이 변경과 무관하게 이 환경에서 서버가
  // 없어 누운다(실처: /__oprn/ai-activity, dbserver:8100 ai_activity_logs, :17831 browser/hello).
  // 그 세 개만 별도 기록하고, 폰트·윈도우스킨·런타임 자산이 죽은 경우는 불통과시킨다.
  const UNRELATED = /__oprn\/ai-activity|ai_activity_logs|:17831\/v1\/browser\/hello/;
  const relevantFailures = failedRequests.filter((f) => !UNRELATED.test(f));
  const errors = consoleLines.filter((l) => /^\[(error|pageerror)\]/.test(l));
  const unrelatedOnly = failedRequests.length > 0 && relevantFailures.length === 0
    && errors.every((l) => /Failed to load resource/.test(l));
  expect(relevantFailures, `자산·런타임 요직 실패:\n${relevantFailures.join("\n")}`).toEqual([]);
  expect(unrelatedOnly ? [] : errors, `콘솔 오류:\n${errors.join("\n")}\n실패 요직:\n${failedRequests.join("\n")}`).toEqual([]);
});
