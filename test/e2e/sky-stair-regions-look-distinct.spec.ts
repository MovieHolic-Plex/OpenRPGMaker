// 《천공의 계단》 7개 층이 **화면에서 실제로 다르게 보이는지** 픽셀로 검사한다.
//
// 왜 픽셀까지 보는가: 이 저장소에서 반복해서 나온 결함이 "저작한 것이 화면에 도달하지
// 않음"이었다. 맵마다 bgm·조명·전투배경을 넣었다는 것은 프로젝트 데이터의 사실일 뿐이고,
// 그게 렌더까지 갔는지는 **그려진 픽셀을 봐야** 알 수 있다. 그래서 이 테스트는
//   ① 각 층이 검은 화면이 아님(평균 휘도)  ② 단색 판이 아님(고유색 수)
//   ③ 7개 층이 서로 다른 화면임(쌍별 차이)
// 세 가지를 실제 스크린샷에서 계산한다.
import { PNG } from "pngjs"; // 선언은 test/pngjs.d.ts 에 좁게 두었다.
import { expect, test } from "@playwright/test";
import { createSkyStairProject, SKY_MAP } from "@/editor/content/skyStairGame";
import { startNewGameFromTitle } from "./runtimeInput";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";

test.setTimeout(240_000);
test.use({ serviceWorkers: "block" });

/** 각 층에서 플레이어를 세울 통행 가능한 칸(test/skyStairGame.test.ts 의 좌표 감사로 확인된 값). */
const REGION_START: readonly { readonly mapId: string; readonly label: string; readonly x: number; readonly y: number }[] = [
  { mapId: SKY_MAP.harbor, label: "항구 아셀", x: 15, y: 15 },
  { mapId: SKY_MAP.wheat, label: "황금 밀밭", x: 15, y: 13 },
  { mapId: SKY_MAP.mistwood, label: "안개 숲", x: 15, y: 26 },
  { mapId: SKY_MAP.shrine, label: "호수 신전", x: 15, y: 20 },
  { mapId: SKY_MAP.mine, label: "잊힌 폐광", x: 11, y: 16 },
  { mapId: SKY_MAP.snowgate, label: "설산 관문", x: 15, y: 15 },
  { mapId: SKY_MAP.altar, label: "천공 제단", x: 12, y: 15 },
];

type Stats = {
  readonly meanLuma: number;
  readonly uniqueColors: number;
  readonly blackRatio: number;
  readonly signature: string;
};

function analyze(buffer: Buffer): Stats {
  const png = PNG.sync.read(buffer);
  const colors = new Set<number>();
  let sum = 0;
  let count = 0;
  let black = 0;
  // 8px 격자로 표본 추출 — 전 픽셀을 돌 필요는 없고, 서명을 만들 만큼은 촘촘하다.
  const signatureCells: number[] = [];
  for (let y = 0; y < png.height; y += 4) {
    for (let x = 0; x < png.width; x += 4) {
      const i = ((y * png.width) + x) << 2;
      const r = png.data[i] ?? 0;
      const g = png.data[i + 1] ?? 0;
      const b = png.data[i + 2] ?? 0;
      colors.add((r << 16) | (g << 8) | b);
      sum += 0.2126 * r + 0.7152 * g + 0.0722 * b;
      count += 1;
      if (r < 12 && g < 12 && b < 12) black += 1;
      if (y % 32 === 0 && x % 32 === 0) signatureCells.push(r >> 4, g >> 4, b >> 4);
    }
  }
  return {
    meanLuma: count > 0 ? sum / count : 0,
    uniqueColors: colors.size,
    blackRatio: count > 0 ? black / count : 0,
    signature: signatureCells.join(","),
  };
}

test("7개 층이 각각 그려지고 서로 다르게 보인다", async ({ browser }) => {
  const stats = new Map<string, Stats>();

  for (const region of REGION_START) {
    // 층마다 **새 페이지**를 연다. 처음엔 한 페이지에서 7번 재시드했는데,
    // page.addInitScript 가 호출할 때마다 쌓이고 앱 상태도 완전히 초기화되지 않아
    // 두 번째 실행부터 runtime-state-json 을 못 찾는 플레이크가 났다(2026-07-27).
    const page = await browser.newPage();
    try {
      // 층마다 시작 지점을 바꾼 프로젝트를 심는다 — 층 사이를 실제로 걸어가는 것은
      // 완주 시나리오(test/skyStairWalkthrough.test.ts)가 이미 검증하므로 여기서는 렌더만 본다.
      const project = createSkyStairProject();
      project.startMapId = region.mapId;
      project.startPos = { x: region.x, y: region.y };

      await page.addInitScript(() => {
        window.localStorage.setItem("rpg-zzu:editor-ui-mode", "expert");
      });
      await page.setViewportSize({ width: 1280, height: 900 });
      await seedProjectFromSupabaseCanonical(page, project);
      await expect(page.getByTestId("edit-canvas")).toBeVisible({ timeout: 30_000 });
      await page.getByTestId("mode-play").click({ force: true });
      await expect(page.getByTestId("test-play-window")).toBeVisible({ timeout: 30_000 });
      await startNewGameFromTitle(page);
      await expect(page.getByTestId("runtime-state-json")).toBeVisible({ timeout: 30_000 });
      // 조명·날씨는 진입 자동 이벤트와 페이드로 붙으므로 안정될 시간을 준다.
      await page.waitForTimeout(2200);

      const runtimeMapId = await page.evaluate(() => {
        const node = document.querySelector("[data-testid='runtime-state-json']");
        if (!node?.textContent) return null;
        try {
          return (JSON.parse(node.textContent) as { mapId?: string }).mapId ?? null;
        } catch {
          return null;
        }
      });
      expect(runtimeMapId, `${region.label}: 런타임이 다른 맵에 있다`).toBe(region.mapId);

      const shot = await page.getByTestId("play-stage").screenshot();
      const analyzed = analyze(shot);
      stats.set(region.label, analyzed);

      // ① 검은 화면이 아니다. 폐광은 의도적으로 어두우니 문턱을 낮게 두되 0 은 아니어야 한다.
      const floor = region.mapId === SKY_MAP.mine ? 6 : 24;
      expect(
        analyzed.meanLuma,
        `${region.label}: 화면이 너무 어둡다(평균 휘도 ${analyzed.meanLuma.toFixed(1)}) — 렌더 실패 의심`
      ).toBeGreaterThan(floor);

      // ①′ **흰 화면도 아니다.** 처음엔 아래쪽 문턱만 두었더니, 제단이 불투명한 흰 오버레이로
      // 덮여 완전한 백색 화면이었는데도 테스트가 통과했다(평균 휘도 254.6 / 고유색 53).
      // 검은 화면만 막고 흰 화면을 놓치는 건 같은 결함의 반쪽만 막는 것이다.
      expect(
        analyzed.meanLuma,
        `${region.label}: 화면이 하얗게 날아갔다(평균 휘도 ${analyzed.meanLuma.toFixed(1)}) — 조명 덮개가 너무 두껍다`
      ).toBeLessThan(240);

      // ①″ **순수 검정 구멍이 없다.** ①·①′ 는 평균이라 국소 결함을 못 잡는다.
      // 실제로 놓쳤다: 안개 숲의 나무·덤불 165칸을 하위 레이어에 심어 잔디를 지웠고,
      // 그 타일은 투명 픽셀이 절반 이상(290=129/256)이라 플레이 캔버스 배경 #000 이 드러났다.
      // 화면의 6.5% 가 순수 검정이었는데 평균 휘도는 129 로 멀쩡했고 고유색도 355종이었다.
      // 즉 초록 바탕에 검은 점이 흩어져도 ①·①′·② 모두 통과한다. 이 항목이 그 형태를 잡는다.
      // 문턱은 실측(2026-07-27)으로 정했다. 항구·밀밭·안개 숲·신전·설산은 모두 0.0%,
      // 폐광은 1.7%(용암 틈과 심연 테두리), 천공 제단은 65.5%(부유 통로를 둘러싼 심연 397 —
      // 설계된 공허다). 제단만 넉넉히 열어 주고, 폐광은 3.5배 여유만 준다.
      // 처음엔 폐광에도 0.80 을 줬는데 실측 1.7% 라 그 예외는 결함을 통째로 가려 줄 뿐이었다.
      const blackCeiling = region.mapId === SKY_MAP.altar ? 0.80
        : region.mapId === SKY_MAP.mine ? 0.06
        : 0.02;
      expect(
        analyzed.blackRatio,
        `${region.label}: 순수 검정이 ${(100 * analyzed.blackRatio).toFixed(1)}% — `
        + "투명 배경 타일(나무·덤불·울타리)을 하위 레이어에 심어 구멍이 났는지 확인하라. "
        + "수관 260/262/263 은 통행 가능·priority=upper 이므로 상위 레이어에 올리고 지면은 하위에 남긴다."
      ).toBeLessThan(blackCeiling);

      // ② 단색 판이 아니다 — 타일이 실제로 그려졌다면 색이 여러 가지다.
      expect(
        analyzed.uniqueColors,
        `${region.label}: 고유색 ${analyzed.uniqueColors}종 — 타일이 안 그려졌을 수 있다`
      ).toBeGreaterThan(80);
    } finally {
      await page.close();
    }
  }

  // ③ 7개 층이 서로 다른 화면이다. 같은 서명이 나오면 층의 정체성이 겹친 것이다.
  const signatures = [...stats.entries()];
  for (let a = 0; a < signatures.length; a += 1) {
    for (let b = a + 1; b < signatures.length; b += 1) {
      const [labelA, statA] = signatures[a]!;
      const [labelB, statB] = signatures[b]!;
      expect(statA.signature, `${labelA} 와 ${labelB} 의 화면이 동일하다`).not.toBe(statB.signature);
    }
  }

  // 사람이 눈으로 확인할 수 있게 측정값을 남긴다.
  for (const [label, stat] of stats) {
    console.log(
      `${label}: 평균휘도 ${stat.meanLuma.toFixed(1)} / 고유색 ${stat.uniqueColors}`
      + ` / 검정 ${(100 * stat.blackRatio).toFixed(1)}%`
    );
  }
});
