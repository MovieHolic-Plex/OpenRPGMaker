import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { assistantIdleHints, directorStartPrompts, formatComposerPlaceholder, idlePresenceLine, nextStepHint, readAgentBrief, layerShortLabel } from "@/editor/panels/aiAgentBrief";
import { editorState } from "@/editor/editorState";
import { createBlankProject } from "@/project/defaults";
import { store } from "@/project/store";
import { uiLabel } from "@/editor/uiCopy";
import { isolateTimers } from "./mergedTeardown";

describe("aiAgentBrief", () => {
  isolateTimers();
  describe("readAgentBrief", () => {
    beforeEach(() => {
      store.replace(createBlankProject());
      const mapId = store.getCurrent().startMapId;
      editorState.set({
        currentMapId: mapId,
        layer: "lower",
        tool: "paint",
        selection: null,
      });
    });

    afterEach(() => {
    });

    it("맵 크기·레이어·도구를 한 줄로 읽는다", () => {
      const brief = readAgentBrief();
      expect(brief.mapName).toBe("빈 맵");
      expect(brief.mapSize).toBe("20×15");
      expect(brief.layerShort).toBe("바닥");
      expect(brief.toolLabel).toBe("칠하기");
      expect(brief.line).toBe("빈 맵 20×15 · 바닥 · 칠하기");
      expect(brief.lookingAt).toBe("지금 빈 맵 20×15");
      expect(brief.eventCount).toBe(0);
    });

    it("이벤트 레이어+도구는 도구를 중복하지 않는다", () => {
      editorState.set({ layer: "event", tool: "event" });
      expect(readAgentBrief().line).toBe("빈 맵 20×15 · 이벤트");
    });

    it("선택 영역이 있으면 줄과 placeholder에 칸 수가 실린다", () => {
      const mapId = store.getCurrent().startMapId;
      editorState.set({
        selection: { mapId, x: 3, y: 4, width: 4, height: 3 },
      });
      const brief = readAgentBrief();
      expect(brief.selectionLabel).toBe("선택 4×3 (3,4)");
      expect(brief.line).toContain("선택 4×3 (3,4)");
      expect(formatComposerPlaceholder()).toBe("한 문장으로 지시");
    });

    it("선택이 있으면 선택 꾸미기 명령을 앞에 둔다", () => {
      const mapId = store.getCurrent().startMapId;
      editorState.set({
        selection: { mapId, x: 0, y: 0, width: 2, height: 2 },
      });
      const prompts = directorStartPrompts(readAgentBrief());
      expect(prompts.map((prompt) => prompt.id)).toEqual(["selection", "place", "character"]);
      expect(prompts).toHaveLength(3);
    });

    it("이벤트 레이어에서는 등장인물 명령을 앞에 둔다", () => {
      editorState.set({ layer: "event", tool: "event" });
      const prompts = directorStartPrompts(readAgentBrief());
      expect(prompts[0]?.id).toBe("character");
      expect(prompts[0]?.instruction).toContain("빈 맵");
    });

    it("대기 한 줄과 골드 힌트 둘을 준다", () => {
      const brief = readAgentBrief();
      expect(idlePresenceLine(brief)).toBe("이 맵에 무엇을 둘까요");
      expect(assistantIdleHints(brief)).toHaveLength(2);
      expect(assistantIdleHints(brief)[0]?.label).toBe("강가를 만들어줘");
      expect(formatComposerPlaceholder()).toBe("한 문장으로 지시");
    });

    it("빈 맵은 버튼을 누르라고 안내한다", () => {
      expect(nextStepHint(readAgentBrief())).toBe("빈 맵이에요. 아래 중 하나를 누르면 바로 시작합니다.");
    });

    it("흙길 오토타일 외곽만 있어도 실제 길로 인식한다", () => {
      const project = store.getCurrent();
      const map = project.maps[project.startMapId];
      if (!map) throw new Error("start map missing");
      map.lowerTiles[7 * map.width + 2] = 390;
      map.lowerTiles[7 * map.width + 3] = 391;
      map.lowerTiles[7 * map.width + 4] = 392;
      store.replace(structuredClone(project));

      const brief = readAgentBrief();
      expect(brief.hasPath).toBe(true);
      expect(nextStepHint(brief)).not.toContain("길이 없어요");
    });

    it("선택이 있으면 그 칸을 고르라고 안내한다", () => {
      const mapId = store.getCurrent().startMapId;
      editorState.set({
        selection: { mapId, x: 1, y: 1, width: 2, height: 2 },
      });
      expect(nextStepHint(readAgentBrief())).toBe("선택한 칸에 무엇을 둘지 골라 보세요.");
    });
  });
});

describe("uiCopy", () => {
  isolateTimers();
  describe("uiCopy", () => {
    it("plain style uses beginner-friendly words without tool jargon", () => {
      expect(uiLabel("database", "plain")).toBe("자료집");
      expect(uiLabel("database", "plain")).not.toMatch(/DB|LegacyDb|chipset|autotile/);
      // 2026-08-30: `자료` 단독은 폐기했다 — `자료 보관함`(소재)과 앞 두 글자가 겹쳐 한 헤더에
      // 다른 뜻의 두 라벨이 같은 말로 보였다. 축약형은 정본의 축약이어야 하고, `자료집`은
      // 4글자로 툴바에 들어간다.
      expect(uiLabel("databaseShort", "plain")).toBe("자료집");
      expect(uiLabel("tilesetMissing", "plain")).toBe("그림이 없습니다");
      expect(uiLabel("tilesetMissing", "plain")).not.toBe("타일셋이 없습니다");
      expect(uiLabel("layerLower", "plain")).toBe("바닥");
      expect(uiLabel("layerUpper", "plain")).toBe("상위");
      expect(uiLabel("layerEvent", "plain")).toBe("이벤트");
    });

    it("technical style keeps domain terms", () => {
      expect(uiLabel("database", "technical")).toBe("데이터베이스");
    });

    // 2026-08-21 용어 정리: technical 쪽 레이어 값이 곧 RM 유래 직역(下層/上層)이었다.
    // 레이어는 전문가라고 다르게 부를 이유가 없으므로 **두 스타일이 같은 말**을 쓴다.
    // 밀도 축(jargonStyle) 자체는 database 등 다른 항목에 남아 있다.
    it("레이어 이름은 밀도 스타일과 무관하게 하나다", () => {
      for (const key of ["layerLower", "layerUpper", "layerEvent"] as const) {
        expect(uiLabel(key, "plain")).toBe(uiLabel(key, "technical"));
      }
    });

    it("레이어 이름에 RM 유래 직역이 없다", () => {
      for (const style of ["plain", "technical"] as const) {
        expect(uiLabel("layerLower", style)).not.toBe("하위");
        expect(uiLabel("layerUpper", style)).not.toBe("덧그림");
      }
    });

    // "장식"은 타일 **분류** 이름(팔레트 필터 칩 · tileMeta role "decoration")과 겹친다.
    // 레이어에 같은 말을 쓰면 한 화면에서 두 뜻이 부딪힌다.
    it("상위 레이어 이름이 타일 분류명 '장식'과 겹치지 않는다", () => {
      expect(uiLabel("layerUpper", "plain")).not.toBe("장식");
    });

    it("defaults to plain when style is omitted", () => {
      expect(uiLabel("database")).toBe("자료집");
    });

    // 2026-08-30 헤더 용어 통일: 헤더의 모든 표면(메뉴 항목 · 클래식 툴바 · 모달 제목)이
    // 같은 개념을 같은 말로 부르게 하려면 그 말이 **한 곳**에 있어야 한다. 아래 키가 그곳이다.
    // 축약형(*Short)은 공간이 없는 툴바 라벨 전용이며 정본의 축약이어야 한다 —
    // title/aria-label 은 언제나 정본을 쓴다.
    describe("헤더 용어 정본", () => {
      it("음악·효과음 표면은 한 이름을 쓴다", () => {
        expect(uiLabel("audio", "plain")).toBe("음악·효과음");
        expect(uiLabel("audio", "technical")).toBe("음악·효과음");
        expect(uiLabel("audioShort", "plain")).toBe("음악");
        // 슬래시 구분자는 폐기 — 메뉴는 `·`, 툴바 title 은 `/` 를 쓰던 분열의 원인이었다.
        for (const style of ["plain", "technical"] as const) {
          expect(uiLabel("audio", style)).not.toContain("/");
        }
      });

      it("맵·이벤트 찾기 표면은 한 이름을 쓰고 검색/찾기를 섞지 않는다", () => {
        expect(uiLabel("mapEventSearch", "plain")).toBe("맵·이벤트 찾기");
        expect(uiLabel("mapEventSearch", "technical")).toBe("맵·이벤트 찾기");
        expect(uiLabel("mapEventSearchShort", "plain")).toBe("찾기");
        for (const style of ["plain", "technical"] as const) {
          expect(uiLabel("mapEventSearch", style)).not.toContain("검색");
        }
      });

      it("테스트 실행은 시연 실행·실행과 섞이지 않는다", () => {
        expect(uiLabel("testPlay", "plain")).toBe("테스트 실행");
        expect(uiLabel("testPlayShort", "plain")).toBe("테스트");
        for (const style of ["plain", "technical"] as const) {
          expect(uiLabel("testPlay", style)).not.toBe("시연 실행");
        }
      });

      it("랜덤 전투 테스트 정본과 축약을 함께 제공한다", () => {
        expect(uiLabel("battleTest", "plain")).toBe("랜덤 전투 테스트");
        expect(uiLabel("battleTestShort", "plain")).toBe("전투");
      });

      it("소재 보관함 정본은 소재(리소스)를 따라간다", () => {
        expect(uiLabel("resourceLibrary", "plain")).toBe("소재 보관함");
        expect(uiLabel("resourceLibrary", "technical")).toBe("리소스 보관함");
        // `자료 보관함`은 폐기 — `자료집`(DB)과 같은 말로 시작해 두 표면이 한 개념처럼 보였다.
        for (const style of ["plain", "technical"] as const) {
          expect(uiLabel("resourceLibrary", style)).not.toContain("자료");
          expect(uiLabel("resourceLibrary", style)).toContain(uiLabel("resources", style));
        }
      });

      it("세계관 패널 이름은 세계·월드로 갈라지지 않는다", () => {
        expect(uiLabel("world", "plain")).toBe("세계관");
        expect(uiLabel("world", "technical")).toBe("세계관");
      });

      it("축약형은 정본의 축약이다(정본이 축약을 포함한다)", () => {
        const pairs = [
          ["audio", "audioShort"],
          ["mapEventSearch", "mapEventSearchShort"],
          ["testPlay", "testPlayShort"],
          ["battleTest", "battleTestShort"],
        ] as const;
        for (const [full, short] of pairs) {
          for (const style of ["plain", "technical"] as const) {
            expect(uiLabel(full, style)).toContain(uiLabel(short, style));
          }
        }
      });
    });

    it("layerShortLabel follows the active mode jargon style (standard = plain)", () => {
      expect(layerShortLabel("lower")).toBe("바닥");
    });
  });
});
