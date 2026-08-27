import { describe, expect, it } from "vitest";
import { M2_COMMAND_CATALOG, isM2CatalogEntrySelectableInMap } from "@/project/eventCommands/m2Catalog";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * 지도·화면 효과 탭 초보자 UX 계약 (2026-08-27 audit-before.md 기반)
 * evidence: .omo/evidence/event-map-items/
 */

describe("지도 탭 초보자 용어 계약", () => {
  it("피커에서 애니메이션 표시 항목들이 서로 다른 라벨을 갖는다", () => {
    const mapVisible = M2_COMMAND_CATALOG.filter(
      (e) => e.title === "Show Animation" && isM2CatalogEntrySelectableInMap(e),
    );
    // 2026-08-27 픽스: m2-055는 맵 피커에서 숨겨지므로(중복 등재 제거) 맵 노출 행은 m2-054 하나
    expect(mapVisible.map((e) => e.index)).toEqual([54]);
  });

  it("배틀 전용 Show Animation(m2-103)은 맵 피커에서 숨겨진다", () => {
    const battleOnly = M2_COMMAND_CATALOG.find((e) => e.index === 103);
    expect(battleOnly).toBeDefined();
    expect(isM2CatalogEntrySelectableInMap(battleOnly!)).toBe(false);
  });

  it("카탈로그 라벨에 내부 API 토큰(panTo 등)이 노출되지 않는다", () => {
    for (const entry of M2_COMMAND_CATALOG) {
      expect(entry.pickerLabel).not.toMatch(/panTo|this-event|parallax/i);
      expect(entry.label).not.toMatch(/panTo|this-event|parallax/i);
    }
  });
});

describe("조명 설정 초보자 표기 계약", () => {
  const source = readFileSync(
    join(__dirname, "../src/editor/panels/eventEditor/commandBodyPage3Native.ts"),
    "utf8",
  );

  it("밝기 입력은 % 스케일로 안내한다 (0.85 원문 노출 금지)", () => {
    // setLighting 입력 안내에 "0~1" 스케일 설명이 남아 있으면 실패
    expect(source).not.toContain('암전 정도(0~1)"');
  });

  it("같은 값을 세 이름으로 부르지 않는다", () => {
    // 미리보기 캡션이 AMB/주변광 대신 밝기로 통일돼야 함
    expect(source).not.toContain("`주변광 ${pct}%`");
    expect(source).not.toContain("`AMB ${pct}%`");
  });
});

describe("changeTile 실맵 미리보기 계약", () => {
  const source = readFileSync(
    join(__dirname, "../src/editor/panels/eventEditor/commandBodyPage3Native.ts"),
    "utf8",
  );

  it("타일 변경 폼이 맵 캔버스 미리보기를 그린다", () => {
    expect(source).toContain("drawTransferMapPreview");
  });
});
