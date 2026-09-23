/** @vitest-environment happy-dom */
// 실행 마무리 말 — 만든 것이 먼저, 남은 지적은 접은 「더 다듬을 곳 (N)」 칸. 지적은 버리지 않는다.
import { afterEach, describe, expect, it } from "vitest";
import { createBlankProject } from "@/project/defaults";
import { setActivityLevel } from "@/editor/panels/aiActivityPreference";
import {
  COMPLETION_PLAY_HINT,
  completionHeadline,
  createRefineFindings,
  plainMadeSummary,
  refineFindingsText,
} from "@/editor/panels/aiPiCompletionReport";

afterEach(() => setActivityLevel("brief"));

describe("실행 마무리 말", () => {
  it("새로 생긴 맵·이벤트·캐릭터를 사람 말로 센다", () => {
    const before = createBlankProject();
    const after = structuredClone(before);
    const template = Object.values(after.maps)[0]!;
    for (let i = 0; i < 2; i++) after.maps[`map_new_${i}`] = { ...structuredClone(template), id: `map_new_${i}`, name: `새 맵 ${i}`, events: [] };
    const events = after.maps.map_new_0!.events as unknown[];
    const sample = { id: "evt_a", name: "고양이", x: 1, y: 1, pages: [] };
    events.push(sample, { ...sample, id: "evt_b" }, { ...sample, id: "evt_c" });
    const actor = { ...(before.database.actors[0] ?? { name: "주인공" }), id: "actor_new" } as (typeof after.database.actors)[number];
    after.database.actors.push(actor);
    expect(plainMadeSummary(before, after)).toBe("맵 2개 · 이벤트 3개 · 캐릭터 1명을 만들었어요.");
    // 새로 생긴 게 없으면 숫자를 지어내지 않는다.
    expect(plainMadeSummary(before, structuredClone(before))).toBeNull();
  });

  it("머리말은 만든 것과 플레이 안내로 시작하고, 확인을 못 끝냈으면 그 사실을 숨기지 않는다", () => {
    const made = "맵 14개 · 이벤트 151개 · 캐릭터 11명을 만들었어요.";
    expect(completionHeadline(made, { unverified: false })).toBe(`${made}\n${COMPLETION_PLAY_HINT}`);
    expect(completionHeadline(null, { unverified: true }).split("\n")).toEqual([
      "변경 내용을 반영했어요.",
      COMPLETION_PLAY_HINT,
      "끝까지 확인하지는 못했어요. 마음에 들지 않으면 되돌릴 수 있어요.",
    ]);
  });

  it("지적은 간단히 보기에서 접힌 칸에 전부 남고, 자세히 보기에서는 펼쳐진다", () => {
    const findings = ["마을: 맵 좌측 전체가 검은 공백으로 방치되어 있습니다", "마을: 집 입구가 막혔습니다", "숲: 길이 끊겼습니다", "숲: 나무가 겹칩니다"];
    const details = createRefineFindings(findings) as HTMLDetailsElement;
    document.body.append(details);
    expect(details.querySelector("summary")?.textContent).toBe("더 다듬을 곳 (4)");
    expect(details.open).toBe(false);
    // 옛 문구는 셋만 보이고 나머지는 「작업 과정」 으로 밀었다 — 이제는 넷 다 칸 안에 있다.
    expect([...details.querySelectorAll("li")].map(li => li.textContent)).toEqual(findings);
    setActivityLevel("detail");
    expect(details.open).toBe(true);
    expect(refineFindingsText(findings)).toContain("• 숲: 나무가 겹칩니다");
  });
});
