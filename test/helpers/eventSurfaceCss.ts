// 이벤트 에디터 CSS 표면(src/styles/event/) 을 읽는 테스트 도우미.
// 2026-09-11 Task 13 부터 이벤트 시트는 세대 파일(balanced/mockup/part-*)이 아니라 구성 요소 버킷(shell/pages/command-list/
// inspector/footer/subdialogs/command-forms/previews, 1,000줄 상한으로 -2.css … 분할)이다. 한 옛 파일의 규칙이 여러 버킷에
// 흩어졌으므로, "이벤트 에디터 시트가 X 를 정한다" 는 주장은 index.css 가 가져오는 모든 리프 시트를 이어 붙인 텍스트에 대고 확인한다.
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
export const EVENT_SURFACE_ENTRY = resolve(here, "../../src/styles/event/index.css");

/** index.css 가 `@import "./x.css" layer(event);` 로 등록한 리프 시트의 절대 경로를 등록 순서대로 돌려준다. */
export function eventSurfaceFiles(): string[] {
  const entry = readFileSync(EVENT_SURFACE_ENTRY, "utf8");
  const files: string[] = [];
  for (const m of entry.matchAll(/^@import\s+"(\.\/[^"]+\.css)"\s+layer\(event\);/gmu)) {
    files.push(resolve(dirname(EVENT_SURFACE_ENTRY), m[1]));
  }
  return files;
}

/** 등록 순서대로 이어 붙인 이벤트 표면 CSS 전체(주석 포함). */
export function readEventSurfaceCss(): string {
  return eventSurfaceFiles()
    .map((f) => readFileSync(f, "utf8"))
    .join("\n");
}

/** 정규식 또는 문자열이 처음 나타나는 리프 시트(절대 경로). 없으면 undefined. */
export function eventSurfaceFileContaining(needle: string | RegExp): string | undefined {
  for (const f of eventSurfaceFiles()) {
    const css = readFileSync(f, "utf8");
    if (typeof needle === "string" ? css.includes(needle) : needle.test(css)) return f;
  }
  return undefined;
}
