// 프리셋 HUD 칸이 저장본에 실려도 다시 열린다 — 저장 모양 검사(shapeFieldHud)의 하한이 프리셋 칸보다 크면 게임이 열리지 않는다.
// 왜(2026-11-13 명세 은행 r1s-fun): 안 쓰는 게이지를 뺄 때 프리셋 칸이 widgets 로 저장되는데(시계 56×12), 검사는 높이 14 미만을 거절했다 — «project-reload-failed».
import { describe, expect, it } from "vitest";
import { FIELD_HUD_THEMES, hudPreset, normalizeFieldHud, resolvedHudWidgets } from "@/project/fieldHud";
import { validateFieldHud } from "@/project/io/shapeFieldHud";

describe("필드 HUD 프리셋 칸은 저장 모양 검사를 지난다", () => {
  for (const theme of Object.keys(FIELD_HUD_THEMES) as (keyof typeof FIELD_HUD_THEMES)[]) {
    it(`${theme}: 프리셋 칸을 widgets 로 실어도 거절되지 않는다`, () => {
      const hud = normalizeFieldHud({ theme, vitals: true, clock: true, tools: true, objective: true, hideEmpty: true });
      expect(() => validateFieldHud({ ...hud, widgets: resolvedHudWidgets(hud) })).not.toThrow();
      expect(() => validateFieldHud({ ...hud, widgets: hudPreset(theme) })).not.toThrow();
    });
  }
});
