/** Small authored CSS dialect shared by the editor preview and shipped player. */
export const BATTLE_COMMAND_CSS_MAX_LENGTH = 8000;
const selectors = new Map([
  [".menu", ".battle-command-menu"],
  [".command", ".battle-command"],
  [".label", ".battle-command-text"],
  [".command:focus-visible", ".battle-command:focus-visible"],
  [".command:disabled", ".battle-command:disabled"],
]);
const properties = new Set([
  "color", "background-color", "border-color", "border-width", "border-style", "border-radius",
  "font-size", "font-weight", "letter-spacing", "line-height", "text-align", "text-shadow",
  "padding", "padding-inline", "padding-block", "gap", "row-gap", "column-gap", "box-shadow",
]);
export type CommandCssResult =
  | { readonly ok: true; readonly rules: readonly { readonly selector: string; readonly declarations: string }[] }
  | { readonly ok: false; readonly error: string };

export function parseBattleCommandCss(source: string): CommandCssResult {
  if (source.length > BATTLE_COMMAND_CSS_MAX_LENGTH) return { ok: false, error: "CSS는 8,000자까지 입력할 수 있습니다." };
  const text = source.replace(/\/\*[\s\S]*?\*\//g, "").trim();
  const rules: { selector: string; declarations: string }[] = [];
  let rest = text;
  while (rest) {
    const block = /^([^{}]+)\{([^{}]*)\}/.exec(rest);
    if (!block) return { ok: false, error: "선택자 { 속성: 값; } 형식과 닫는 중괄호를 확인하세요." };
    const selector = selectors.get((block[1] ?? "").trim());
    if (!selector) return { ok: false, error: "선택자는 .menu, .command, .label, .command:focus-visible, .command:disabled만 사용할 수 있습니다." };
    const declarations: string[] = [];
    for (const declaration of (block[2] ?? "").split(";")) {
      if (!declaration.trim()) continue;
      const pair = /^\s*([a-z-]+)\s*:\s*([^:]+?)\s*$/i.exec(declaration);
      const property = pair?.[1]?.toLowerCase() ?? "";
      const value = pair?.[2] ?? "";
      if (!properties.has(property)) return { ok: false, error: `지원하지 않는 속성: ${property || declaration.trim()}` };
      // A closed value alphabet and function vocabulary prohibit CSS escapes, resource
      // loads, custom-property indirection and rule/style-element breakouts.
      if (!/^[a-z0-9#.,()%+\s-]+$/i.test(value)
        || [...value.matchAll(/([a-z-]+)\s*\(/gi)].some((match) => !["rgb", "rgba", "hsl", "hsla"].includes((match[1] ?? "").toLowerCase()))) {
        return { ok: false, error: `${property}: 색상·숫자·CSS 키워드만 사용하세요. URL, 변수, !important는 지원하지 않습니다.` };
      }
      declarations.push(`${property}: ${value} !important;`);
    }
    rules.push({ selector, declarations: declarations.join(" ") });
    rest = rest.slice(block[0].length).trim();
  }
  return { ok: true, rules };
}

let scopeSequence = 0;
/** The scope is generated internally, never interpolated from project data. */
export function mountBattleCommandCss(host: HTMLElement, source: string): CommandCssResult {
  const parsed = parseBattleCommandCss(source);
  if (!parsed.ok) return parsed;
  host.querySelector("style[data-command-css]")?.remove();
  if (parsed.rules.length === 0) return parsed;
  const scope = `command-css-${++scopeSequence}`;
  host.dataset.commandCssScope = scope;
  const style = document.createElement("style");
  style.dataset.commandCss = "";
  style.textContent = parsed.rules.map((rule) => `[data-command-css-scope="${scope}"] ${rule.selector} { ${rule.declarations} }`).join("\n");
  host.append(style);
  return parsed;
}
