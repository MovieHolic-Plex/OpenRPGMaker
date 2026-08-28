// 명령 선택기 버튼의 data-testid 는 항목마다 유일해야 한다.
//
// 왜 이 테스트가 필요한가(실측 회귀, 2026-08-28): 실브라우저에서 명령 선택기의
// "문장 표시"를 클릭하려다 Playwright strict mode 위반이 났다 — 같은
// command-picker-add-text 를 단 버튼이 둘이었다(m2-001-show-text, m2-209-advanced-dialogue).
// testid 를 네이티브 종류(existingKind)로만 만들어서, 같은 종류로 접히는 카탈로그 항목이
// 둘이면 그대로 겹친다. 겹치면 e2e 가 어느 쪽인지 지목할 수 없다.
import { describe, expect, it } from "vitest";
import {
  eventCommandPickerSearchEntries,
  eventCommandPickerTabEntries,
} from "@/editor/panels/eventEditor/commandPicker";
import type { M2CommandPickerPage } from "@/project/eventCommands/m2Catalog";

const PICKER_PAGES: readonly M2CommandPickerPage[] = [1, 2, 3, 4];

function duplicates(ids: readonly string[]): string[] {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) dupes.add(id);
    seen.add(id);
  }
  return [...dupes].sort();
}

describe("명령 선택기 testid", () => {
  it("검색 목록 전체에서 겹치는 testid 가 없다", () => {
    const entries = eventCommandPickerSearchEntries();
    expect(entries.length).toBeGreaterThan(0);
    expect(duplicates(entries.map((entry) => entry.testId))).toEqual([]);
  });

  it("각 탭 안에서도 겹치는 testid 가 없다", () => {
    for (const page of PICKER_PAGES) {
      const ids = eventCommandPickerTabEntries(page).map((entry) => entry.testId);
      expect(duplicates(ids), `${page} 탭`).toEqual([]);
    }
  });

  it("문장 표시는 종전 손잡이 command-picker-add-text 를 유지한다", () => {
    // 기존 e2e 스펙들이 이 이름으로 잡는다. 중복을 없애면서 이 계약은 깨면 안 된다.
    const entries = eventCommandPickerSearchEntries();
    const withTextHandle = entries.filter((entry) => entry.testId === "command-picker-add-text");
    expect(withTextHandle).toHaveLength(1);
    expect(withTextHandle[0]!.commandId).toBe("m2-001-show-text");
  });
});
