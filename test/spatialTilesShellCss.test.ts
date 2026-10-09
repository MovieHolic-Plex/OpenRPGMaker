// 맵 → 타일 셸(spatial-shell-tiles) 레이아웃 계약 (2026-09-13).
// fakeDom 은 계산 스타일을 모르니 원문을 읽어 잠근다(aiDeckCss.test.ts 와 같은 방식).
//
// 잠그는 회귀:
//  1) @container db-modal (max-width:1199px) 가 .spatial-body 에 두 행을 강제해도
//     타일 셸은 한 행을 유지한다 — 안 그러면 갤러리+스테이지가 32% 행에 눌려
//     작업대가 0px 로 붕괴한다(1024×768 실측).
//  2) 같은 쿼리의 .spatial-card{height:100%}·필름스트립 규칙이 세로 목록을 깨지 않게
//     카드 높이를 auto 로 되돌린다.
//  3) .spatial-inspector 는 타일 셸에서 영구히 숨겨지므로 <1200px 에서 나타나는
//     「속성」토글도 숨긴다 — 아니면 아무것도 못 여는 죽은 버튼이 된다.
//  4) 시트↔사이드바 열 핀은 passage-paint 에만 적용한다 — AI 메타·그룹 모드는
//     DOM 순서가 [사이드바, 시트]라 무차별 핀이 시트를 244px 좁은 열에 가뒀다.
//  5) 「생성 감사」 사이드 레일이 다시 세로 레일로 서려면 .oprn-tileset-main 이
//     그리드여야 한다(flex-column 이면 레일이 본문 아래 가로 띠로 깨진다).
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const CSS_PATH = "src/styles/database/modern/spatial-collections.css";
const PREVIEW_TS = "src/editor/panels/tilesetChipsetPreview.ts";

function rulesOnly(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//gu, "");
}

function tilesBlock(css: string): string {
  // "맵 → 타일셋" 절 이후만 본다 — 다른 도메인의 같은 클래스 규칙과 섞이지 않게.
  const marker = css.indexOf('data-testid="spatial-shell-tiles"');
  if (marker < 0) throw new Error("spatial-shell-tiles section missing");
  return css.slice(marker);
}

const css = rulesOnly(readFileSync(resolve(ROOT, CSS_PATH), "utf8"));
const tiles = tilesBlock(css);

describe("맵 → 타일 셸 레이아웃 계약", () => {
  it("좁은 모달에서도 spatial-body 는 한 행이다", () => {
    const body = /\.spatial-body\s*\{([^}]*)\}/u.exec(tiles);
    expect(body).toBeTruthy();
    expect(body![1]).toMatch(/grid-template-rows:\s*minmax\(0,\s*1fr\)/u);
  });

  it("갤러리 카드 높이는 필름스트립의 height:100% 를 되돌린다", () => {
    const card = /\.spatial-card\s*\{([^}]*)\}/u.exec(tiles);
    expect(card).toBeTruthy();
    expect(card![1]).toMatch(/height:\s*auto/u);
  });

  it("속성 토글은 타일 셸에서 숨긴다(인스펙터가 영구 숨김이므로)", () => {
    const hiddenList = tilesBlock(css).match(/\.spatial-inspector-toggle/u);
    expect(hiddenList).toBeTruthy();
    const hideGroup = /([^{}]*\.spatial-inspector-toggle[^{}]*)\{[^}]*display:\s*none/u.exec(tiles);
    expect(hideGroup).toBeTruthy();
  });

  it("시트·사이드바 열 핀은 passage-paint 안에서만 결정한다", () => {
    expect(tiles).toMatch(/\.tileset-db-edit-area\.passage-paint\s*>\s*\.tileset-db-preview-wrap/u);
    expect(tiles).toMatch(/\.tileset-db-edit-area\.passage-paint\s*>\s*\.tileset-db-edit-sidebar/u);
    // 무차별 핀이 부활하면 knowledge/AI 모드의 시트가 다시 좁은 열에 갇힌다.
    const bare = /data-testid="spatial-shell-tiles"\]\s*\.tileset-db-preview-wrap\s*\{([^}]*)\}/u.exec(tiles);
    expect(bare).toBeTruthy();
    expect(bare![1]).not.toMatch(/grid-column/u);
    // 비페인트 모드는 시트가 왼쪽 넓은 열, 패널이 오른쪽 좁은 열이다.
    expect(tiles).toMatch(
      /\.tileset-db-edit-area:not\(\.passage-paint\):not\(\.autotile-compose\)\s*>\s*\.tileset-db-preview-wrap/u,
    );
  });

  it("워크벤치+레일 열은 그리드다(세로 레일 복원)", () => {
    const main = /\.oprn-tileset-main\s*\{([^}]*)\}/u.exec(tiles);
    expect(main).toBeTruthy();
    expect(main![1]).toMatch(/display:\s*grid/u);
    expect(main![1]).not.toMatch(/flex-direction:\s*column/u);
    // 닫힌 사이드 패널 본문은 어느 뷰포트에서든 숨는다 — 1180px 강제 펼침은 독립 표면 전용.
    expect(tiles).toMatch(/\.tileset-side-pane-body[^{}]*\{[^}]*display:\s*none/u);
  });

  it("프리뷰 확대 단추에 전체 보기용 1x 가 있다", () => {
    const ts = readFileSync(resolve(ROOT, PREVIEW_TS), "utf8");
    const scales = /PREVIEW_SCALES\s*=\s*\[([^\]]*)\]/u.exec(ts);
    expect(scales).toBeTruthy();
    expect(scales![1]).toContain("1");
  });
});
