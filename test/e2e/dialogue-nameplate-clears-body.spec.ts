/**
 * 화자 이름표가 본문 첫 줄을 가리지 않는지 본다.
 *
 * 이름표는 `position: absolute; top: -9px` 로 창 위 변에 걸쳐 있고, 본문이 비켜 주는
 * 자리는 `.dialogue-box.has-speaker` 의 `padding-top` 뿐이다. 두 값이 서로 모르면
 * 이름표 아래쪽이 본문 첫 줄을 덮는다 — 글자가 위에서 잘려 보인다.
 * (`src/styles/TOKENS.md` 가 "본문과 겹치지 않도록 함께 조정한다"고 적어 둔 짝이다.)
 *
 * 이건 계산된 스타일로는 안 잡힌다. `padding-top` 이 8px 이고 이름표 높이가 22px 여도
 * 두 선언은 각각 유효하다 — 겹침은 **기하**이므로 실제 상자를 재야 한다. 단위 테스트도
 * 못 잡는다(jsdom 은 레이아웃이 없어 높이가 전부 0 이다).
 *
 * 측정은 `offsetTop`/`offsetHeight` 로 한다. 무대가 `--play-scale` 로 확대되므로
 * `getBoundingClientRect()` 는 배율이 섞인 화면 px 를 준다 — 논리 px 로 비교해야
 * "몇 px 겹쳤나"가 소스의 값과 같은 단위가 된다.
 *
 * 트리거를 `auto` 로 쓰는 이유는 `dialogue-presentation-motion.spec.ts` 머리말과 같다.
 */
import { expect, test } from "@playwright/test";
import { createBlankProject } from "@/project/defaults";
import type { Command, EventPage, GameEvent, Project } from "@/project/types";
import { startNewGameFromTitle } from "./runtimeInput";
import { seedProjectFromSupabaseCanonical } from "./supabaseProjectSeed";

test.setTimeout(180_000);
test.use({ serviceWorkers: "block" });

// 두 줄로 감기지 않는 짧은 대사. 첫 줄이 이름표 아래에 있는지만 보면 된다.
const BODY = "여기가 우리 광장이야.";
// 이름표가 길수록 넓어질 뿐 높이는 같다. 높이를 키우는 것은 글꼴 크기라, 기본 화자명으로 충분하다.
const SPEAKER = "마을 사람";

test("화자 이름표가 본문 첫 줄을 덮지 않는다", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("oprn:editor-ui-mode", "expert");
  });
  await seedProjectFromSupabaseCanonical(page, nameplateProject());

  await page.getByTestId("mode-play").click({ force: true });
  await expect(page.getByTestId("test-play-window")).toBeVisible({ timeout: 60_000 });
  await startNewGameFromTitle(page, { timeoutMs: 90_000 });

  await expect(page.getByTestId("dialogue-box")).toContainText("우리 광장", { timeout: 30_000 });

  const geometry = await page.evaluate(() => {
    const box = document.querySelector<HTMLElement>(".dialogue-box");
    const plate = box?.querySelector<HTMLElement>(".speaker.speaker-nameplate");
    const body = box?.querySelector<HTMLElement>(".body");
    if (!box || !plate || !body) return null;
    // offsetTop 은 offsetParent(= position: relative 인 상자) 의 padding 위 변 기준이다.
    // 이름표의 top 이 음수라 이 값도 음수로 나온다.
    const plateBottom = plate.offsetTop + plate.offsetHeight;
    // 본문은 상자 → .dialogue-content → .dialogue-text-column 안이라 offsetTop 이
    // 조상마다 쪼개진다. 상자까지 거슬러 올라가며 더한다.
    let bodyTop = 0;
    for (let node: HTMLElement | null = body; node && node !== box; node = node.offsetParent as HTMLElement | null) {
      bodyTop += node.offsetTop;
    }
    return {
      plateTop: plate.offsetTop,
      plateHeight: plate.offsetHeight,
      plateBottom,
      bodyTop,
      overlap: Number((plateBottom - bodyTop).toFixed(2)),
      speakerInset: getComputedStyle(box).paddingTop,
      fontSize: getComputedStyle(plate).fontSize,
    };
  });

  expect(geometry, "대화창·이름표·본문 중 하나가 없다").toBeTruthy();
  // 실패했을 때 숫자를 보고 원인을 바로 알 수 있게 남긴다.
  test.info().annotations.push({ type: "이름표 기하", description: JSON.stringify(geometry) });
  expect(
    geometry!.overlap,
    `이름표 아래 변이 본문 첫 줄을 ${geometry!.overlap}px 덮는다 (이름표 높이 ${geometry!.plateHeight}px, ` +
      `상자 padding-top ${geometry!.speakerInset})`,
  ).toBeLessThanOrEqual(0);
});

function nameplateProject(): Project {
  const project = createBlankProject();
  const map = project.maps[project.startMapId];
  if (!map) throw new Error("blank project start map is missing");
  map.events.push(
    autoEvent("ev_nameplate", 2, 2, [
      { kind: "text", speaker: SPEAKER, body: BODY },
      // 대사를 띄운 채 세워 둔다. 자동으로 넘어가면 측정할 창이 사라진다.
      { kind: "wait", ms: 120_000 },
    ]),
  );
  return project;
}

function autoEvent(id: string, x: number, y: number, commands: Command[]): GameEvent {
  const page: EventPage = {
    id: `${id}_page`,
    name: id,
    conditions: [],
    graphic: {},
    trigger: { kind: "auto" },
    priority: "below",
    movement: { type: "fixed", speed: 3, frequency: 3 },
    commands,
  };
  return { id, x, y, trigger: { kind: "auto" }, commands: [], pages: [page] };
}
