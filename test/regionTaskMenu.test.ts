import { describe, expect, it, afterEach, beforeEach, vi } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { makeSvgIcon, SVG_ICON_NAMES, type SvgIconName } from "@/editor/panels/tileToolbarIcons";
import { installFakeDom } from "./fakeDom";
import * as fs from "node:fs";
import * as path from "node:path";
import { isCellInsideSelection, regionTaskMenuItems, type RegionSelection } from "@/editor/panels/mapSelectionContextMenu";
import { dispatchRegionTaskStatus, REGION_TASK_STATUS_EVENT, regionTaskStatusDetail, type RegionTaskStatusDetail } from "@/editor/regionTask/regionTaskStatus";
import { isolateTimers } from "./mergedTeardown";

// test/regionTaskCssTokens.test.ts
// region-task.css 를 cool-white 토큰 체계에 고정하는 실패-우선 스타일시트 컨트랙트.
//
// region-task.css 는 cream-era(따뜻한) 색 리터럴에서 벗어나 모든 색을 var(--token) 으로
// 가져와야 한다. 이 테스트는 파일 텍스트를 직접 읽어 그 불변식을 고정한다. 파일 경로는
// databaseLightTheme.test.ts 와 같은 방식으로 저장소 루트에 상대적으로 잡는다.
describe("regionTaskCssTokens", () => {
  isolateTimers();
  // 시트는 9b2ff9a9f1(editor/ 유령 디렉터리 해체)로 styles/map/ 아래로 옮겨졌고 region-task.part-N.css 로 나뉘었다 — 전부 이어 붙여 본다.
  const REGION_DIR = resolve(__dirname, "..", "src", "styles", "map");
  const REGION_FILES = ["region-task.css", ...readdirSync(REGION_DIR).filter((name) => /^region-task\.part-\d+\.css$/.test(name)).sort()];
  const css = REGION_FILES.map((name) => readFileSync(resolve(REGION_DIR, name), "utf8")).join("\n");
  /** 정규식을 1-based 라인 번호 목록으로 매핑해 실패 메시지를 행동 가능하게 만든다. */
  function linesMatching(re: RegExp): number[] {
    const hit: number[] = [];
    css.split("\n").forEach((line, idx) => {
      if (re.test(line)) hit.push(idx + 1);
    });
    return hit;
  }
  /**
   * rgba(42,37,33) 의 "실제 값" 발생 위치만 찾는다. var(--token, rgba(...)) 안의 폴백 값은
   * 제외한다 — 폴백은 어떤 토큰의 기본값이지 cream 실값이 아니기 때문이다. 판정 기준은 해당
   * 매치 직전의 텍스트가 var(--name, 로 끝나는지(폴백) 아닌지(실값)다.
   */
  function realWarmRgbaLines(): number[] {
    const re = /rgba\(\s*42\s*,\s*37\s*,\s*33/g;
    const hit: number[] = [];
    css.split("\n").forEach((line, idx) => {
      let m: RegExpExecArray | null;
      while ((m = re.exec(line)) !== null) {
        const before = line.slice(0, m.index);
        if (/var\(--[\w-]+\s*,\s*$/.test(before)) continue; // var 폴백 값 — 제외
        hit.push(idx + 1);
      }
    });
    return hit;
  }
  const fmt = (lines: number[]): string =>
    lines.length === 0 ? "(none)" : `lines ${lines.join(", ")}`;
  describe("region-task.css cool-white token contract", () => {
    it("cream rgba(42,37,33) 실값이 없다", () => {
      const lines = realWarmRgbaLines();
      expect(
        lines,
        `region-task.css 에 cream rgba(42,37,33) 실값 잔존: ${fmt(lines)} — var(--token) 으로 교체 필요.`,
      ).toEqual([]);
    });

    it("순수 흰색 #fff/#ffffff 리터럴이 없다 (포커스 링)", () => {
      const lines = linesMatching(/#fff\b|#ffffff\b/i);
      expect(
        lines,
        `region-task.css 에 bare-white #fff/#ffffff 잔존: ${fmt(lines)} — 포커스 링을 토큰으로 교체 필요.`,
      ).toEqual([]);
    });

    it("죽은 cream 폴백 hex 가 없다 (#FFFDF8/#FCF9F2/#2A2521/#6B5F52)", () => {
      const lines = linesMatching(/#FFFDF8|#FCF9F2|#2A2521|#6B5F52/i);
      expect(
        lines,
        `region-task.css 에 cream 폴백 hex 잔존: ${fmt(lines)} — cool-white 토큰으로 교체 필요.`,
      ).toEqual([]);
    });

    it("장식용 accent-mixed 배경이 없다 (direct-room / review-metrics)", () => {
      const lines = linesMatching(
        /background:\s*color-mix\([^;]*var\(--editor-panel(?:-bg)?[^;]*var\(--accent/,
      );
      expect(
        lines,
        `region-task.css 에 장식 accent-mixed background 잔존: ${fmt(lines)} — 평면 토큰 배경으로 교체 필요.`,
      ).toEqual([]);
    });

    it("hex 리터럴이 하나도 없다 (모든 색은 var(--token))", () => {
      const lines = linesMatching(/#[0-9a-fA-F]{3,8}/);
      expect(
        lines,
        `region-task.css 에 hex 리터럴 잔존: ${fmt(lines)} — 모두 var(--token) 으로 교체 필요.`,
      ).toEqual([]);
    });
  });
});

describe("regionTaskIcons", () => {
  isolateTimers();
  const REQUIRED_REGION_TASK_ICONS: readonly SvgIconName[] = [
    "terrain",
    "structure",
    "polish",
    "npc",
    "chest",
    "combat",
    "mood",
    "composite",
    "pin",
    "save",
    "warning",
    "door",
    "sign",
    "shop",
  ];
  describe("region task icons", () => {
    let restoreDom: (() => void) | null = null;

    beforeEach(() => {
      restoreDom = installFakeDom();
    });

    afterEach(() => {
      restoreDom?.();
      restoreDom = null;
    });

    it("SVG_ICON_NAMES contains all 14 new region-task icons", () => {
      for (const name of REQUIRED_REGION_TASK_ICONS) {
        expect(SVG_ICON_NAMES).toContain(name);
      }
    });

    it("every icon in SVG_ICON_NAMES produces a valid svg with currentColor stroke, none fill, and child elements", () => {
      for (const name of SVG_ICON_NAMES) {
        const svg = makeSvgIcon(name);
        expect(svg).toBeDefined();
        expect(svg.getAttribute("stroke")).toBe("currentColor");
        expect(svg.getAttribute("fill")).toBe("none");
        expect(svg.childNodes.length).toBeGreaterThan(0);
      }
    });

    it("no icon spec attribute value in tileToolbarIcons matches color literals (hex, rgb, hsl)", () => {
      const filePath = path.resolve(__dirname, "../src/editor/panels/tileToolbarIcons.ts");
      const source = fs.readFileSync(filePath, "utf-8");

      // Match hex colors (#fff, #123456), rgb(...), hsl(...)
      const colorLiteralRegex = /#[0-9a-fA-F]{3,8}\b|rgb\([^)]*\)|hsl\([^)]*\)/g;
      const matches = source.match(colorLiteralRegex);
      expect(matches).toBeNull();
    });
  });
});

describe("regionTaskMenu", () => {
  isolateTimers();
  const SELECTION: RegionSelection = { mapId: "m1", x: 2, y: 3, width: 4, height: 5 };   // x∈[2,6), y∈[3,8)

  describe("isCellInsideSelection", () => {
    it("경계를 반개구간으로 판정한다", () => {
      expect(isCellInsideSelection(SELECTION, 2, 3)).toBe(true);
      expect(isCellInsideSelection(SELECTION, 5, 7)).toBe(true);
      expect(isCellInsideSelection(SELECTION, 6, 7)).toBe(false); // x 상한 제외
      expect(isCellInsideSelection(SELECTION, 2, 8)).toBe(false); // y 상한 제외
      expect(isCellInsideSelection(SELECTION, 1, 3)).toBe(false);
    });
  });
  describe("regionTaskMenuItems", () => {
    it("keeps AI routing alongside the encounter action — it hands the region to the assistant chat", () => {
      const openModal = vi.fn();
      const items = regionTaskMenuItems(SELECTION, openModal);
      expect(items.map((item) => item.testId)).toEqual(["region-walk-encounter-menu-item", "region-ai-task-menu-item"]);
      const item = items.find((candidate) => candidate.id === "region-ai-task");
      if (!item) throw new Error("Missing AI action");

      item.action();
      expect(openModal).toHaveBeenCalledTimes(1);
      expect(openModal).toHaveBeenCalledWith({
        mapId: "m1",
        region: { x: 2, y: 3, width: 4, height: 5 },
      });
    });
  });
});

describe("regionTaskStatus", () => {
  isolateTimers();
  // window 스텁 — 이 파일은 fakeDom 없이 이벤트 버스만 필요하므로 최소 구현.
  function installFakeWindow(): () => void {
    const listeners = new Map<string, EventListener[]>();
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      writable: true,
      value: {
        addEventListener: (type: string, listener: EventListener) => {
          listeners.set(type, [...(listeners.get(type) ?? []), listener]);
        },
        removeEventListener: (type: string, listener: EventListener) => {
          listeners.set(type, (listeners.get(type) ?? []).filter((item) => item !== listener));
        },
        dispatchEvent: (event: Event) => {
          for (const listener of listeners.get(event.type) ?? []) listener(event);
          return true;
        },
      },
    });
    return () => Reflect.deleteProperty(globalThis, "window");
  }
  describe("regionTaskStatusDetail", () => {
    it("유효한 detail을 통과시키고 불량 payload는 null", () => {
      const good = { detail: { mapId: "m1", region: { x: 1, y: 2, width: 3, height: 4 }, running: true } } as unknown as Event;
      expect(regionTaskStatusDetail(good)).toEqual({ mapId: "m1", region: { x: 1, y: 2, width: 3, height: 4 }, running: true });
      const bad = { detail: { mapId: 5 } } as unknown as Event;
      expect(regionTaskStatusDetail(bad)).toBeNull();
      expect(regionTaskStatusDetail({} as Event)).toBeNull();
    });

    it("phase 필드를 그대로 전달하고, 없으면 undefined", () => {
      const restoreWindow = installFakeWindow();
      try {
        const events: (RegionTaskStatusDetail | null)[] = [];
        const listener = (event: Event): void => { events.push(regionTaskStatusDetail(event)); };
        window.addEventListener(REGION_TASK_STATUS_EVENT, listener);
        dispatchRegionTaskStatus({ mapId: "m1", region: { x: 0, y: 0, width: 1, height: 1 }, running: true, phase: "pending" });
        dispatchRegionTaskStatus({ mapId: "m1", region: { x: 0, y: 0, width: 1, height: 1 }, running: true });
        window.removeEventListener(REGION_TASK_STATUS_EVENT, listener);
        expect(events[0]?.phase).toBe("pending");
        expect(events[1]?.phase).toBeUndefined();
      } finally {
        restoreWindow();
      }
    });
  });
});
