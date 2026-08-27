import {
  FONT_ROLE_CSS_VARIABLES,
  FONT_ROLES,
  resolveFontSelection,
  resolveFontStack,
} from "@/project/fontRegistry";
import type { Project } from "@/project/types";

/**
 * `system.fonts` 를 tokens.css 와 같은 이름의 CSS 변수로 루트에 심는다.
 *
 * 인라인 스타일이라 `:root` 토큰보다 우선하므로, 에디터 · 데이터베이스 · 런타임 · 전투가
 * 이미 쓰고 있는 `var(--font-ui|--font-pixel|--font-mono)` 소비지점을 하나도 고치지 않고
 * 저자 선택이 전 영역에 반영된다. 선택을 지우면 다시 tokens.css 기본값과 같은 값이 들어간다.
 */
export function applyProjectFontTheme(project: Project, root: HTMLElement): void {
  const selection = resolveFontSelection(project.system.fonts);
  for (const role of FONT_ROLES) {
    root.style.setProperty(FONT_ROLE_CSS_VARIABLES[role], resolveFontStack(selection[role]));
  }
}

export function syncProjectFontTheme(project: Project): void {
  const root = globalThis.document?.documentElement;
  if (root) applyProjectFontTheme(project, root);
}
