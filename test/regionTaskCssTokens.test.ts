// test/regionTaskCssTokens.test.ts
// region-task.css 를 cool-white 토큰 체계에 고정하는 실패-우선 스타일시트 컨트랙트.
//
// region-task.css 는 cream-era(따뜻한) 색 리터럴에서 벗어나 모든 색을 var(--token) 으로
// 가져와야 한다. 이 테스트는 파일 텍스트를 직접 읽어 그 불변식을 고정한다. 파일 경로는
// databaseLightTheme.test.ts 와 같은 방식으로 저장소 루트에 상대적으로 잡는다.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REGION_CSS = resolve(__dirname, "..", "src", "styles", "editor", "region-task.css");
const css = readFileSync(REGION_CSS, "utf8");

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
