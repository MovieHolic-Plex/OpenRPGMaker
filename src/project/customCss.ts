// 안전한 커스텀 게임 UI CSS 정화·스코핑 및 플레이어 마운트 헬퍼.
//
// 제작자가 `project.meta.customThemeCss` 에 작성한 커스텀 UI 스타일을 `.player-layout` 하위로
// 안전하게 스코핑하고, `@import` / `url(javascript:)` / `expression()` / `-moz-binding` /
// 외부 추적 URL / `</style>` 탈출 등 위험 규칙을 차단한 뒤 `<style>` 요소로 적용한다.
// `src/project/types/base.ts` 충돌을 피하기 위해 메타 필드는 전용 헬퍼로 안전하게 읽는다.

export const CUSTOM_CSS_MAX_BYTES = 64 * 1024;
export const CUSTOM_CSS_SCOPE_SELECTOR = ".player-layout";
export const CUSTOM_CSS_STYLE_ATTR = "data-oprn-custom-theme";

export interface CustomThemeCssMeta {
  customThemeCss?: string;
}

export interface SanitizeCustomCssOptions {
  /** Scope prefix applied to all style rules. Defaults to `.player-layout`. */
  readonly scopeSelector?: string;
  /** Maximum UTF-8 byte length accepted before truncating. Defaults to 64 KB. */
  readonly maxBytes?: number;
  /** Allow http(s) remote URLs inside `url(...)`. Defaults to false to block external tracking/exfiltration. */
  readonly allowExternalUrls?: boolean;
}

export interface SanitizeCustomCssResult {
  readonly css: string;
  readonly warnings: readonly string[];
  readonly blockedCount: number;
  readonly truncated: boolean;
}

export interface CustomCssMountHandle {
  readonly applied: boolean;
  readonly css: string;
  readonly element?: HTMLStyleElement;
  readonly warnings: readonly string[];
  readonly blockedCount: number;
  readonly truncated: boolean;
  readonly dispose: () => void;
}

/** Safely reads `project.meta.customThemeCss` without requiring a schema type merge. */
export function getProjectCustomThemeCss(project: { readonly meta?: unknown } | null | undefined): string {
  const meta = project?.meta;
  if (!meta || typeof meta !== "object") return "";
  const raw = (meta as CustomThemeCssMeta).customThemeCss;
  return typeof raw === "string" ? raw : "";
}

/** Safely writes or clears `project.meta.customThemeCss`. */
export function setProjectCustomThemeCss(
  project: { readonly meta: Record<string, unknown> },
  css: string | undefined,
): void {
  if (css === undefined || css.trim() === "") {
    delete project.meta.customThemeCss;
  } else {
    project.meta.customThemeCss = css;
  }
}

function utf8ByteLength(text: string): number {
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(text).length;
  }
  let bytes = 0;
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff) {
      bytes += 4;
      i += 1;
    } else bytes += 3;
  }
  return bytes;
}

function truncateToUtf8Bytes(text: string, maxBytes: number): string {
  if (maxBytes <= 0) return "";
  if (utf8ByteLength(text) <= maxBytes) return text;
  let bytes = 0;
  let end = 0;
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    let charBytes = 1;
    let step = 1;
    if (code < 0x80) {
      charBytes = 1;
    } else if (code < 0x800) {
      charBytes = 2;
    } else if (code >= 0xd800 && code <= 0xdbff && i + 1 < text.length) {
      charBytes = 4;
      step = 2;
    } else {
      charBytes = 3;
    }
    if (bytes + charBytes > maxBytes) break;
    bytes += charBytes;
    end = i + step;
    if (step === 2) i += 1;
  }
  return text.slice(0, end);
}

/** Decodes CSS backslash escapes (e.g. `\6a avascript:` -> `javascript:`) for security inspection. */
function decodeCssEscapes(input: string): string {
  return input
    .replace(/\\([0-9a-fA-F]{1,6})\s?/gu, (_match, hex: string) => {
      const cp = Number.parseInt(hex, 16);
      if (!Number.isFinite(cp) || cp === 0 || cp > 0x10ffff) return "\uFFFD";
      return String.fromCodePoint(cp);
    })
    .replace(/\\([^\n\r\f0-9a-fA-F])/gu, "$1");
}

/** Strips CSS block comments while preserving string literals intact. */
function stripCssComments(input: string): string {
  let out = "";
  let quote: '"' | "'" | null = null;
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i]!;
    const next = input[i + 1];
    if (quote) {
      out += ch;
      if (ch === "\\" && next !== undefined) {
        out += next;
        i += 1;
      } else if (ch === quote) {
        quote = null;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      out += ch;
      continue;
    }
    if (ch === "/" && next === "*") {
      const close = input.indexOf("*/", i + 2);
      if (close < 0) break;
      i = close + 1;
      continue;
    }
    out += ch;
  }
  return out;
}

const BLOCKED_AT_RULES = new Set([
  "import",
  "charset",
  "namespace",
  "document",
  "-moz-document",
]);

const NESTED_SCOPING_AT_RULES = new Set([
  "media",
  "supports",
  "container",
  "layer",
]);

const KEYFRAME_AT_RULES = new Set([
  "keyframes",
  "-webkit-keyframes",
  "-moz-keyframes",
]);

const BLOCKED_PROPERTIES = new Set([
  "behavior",
  "-moz-binding",
]);

const SAFE_DATA_IMAGE_URL = /^data:image\/(?:png|jpeg|jpg|webp|gif)(?:;charset=[^;,]+)?;base64,/iu;

function extractUrlTokens(value: string): string[] {
  const urls: string[] = [];
  const pattern = /url\s*\(([^)]*)\)/giu;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(value)) !== null) {
    const raw = (match[1] ?? "").trim();
    const unquoted =
      (raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))
        ? raw.slice(1, -1).trim()
        : raw;
    urls.push(unquoted);
  }
  return urls;
}

function checkDeclarationSafety(
  property: string,
  value: string,
  allowExternalUrls: boolean,
): string | null {
  const propDecoded = decodeCssEscapes(property).trim().toLowerCase();
  if (!propDecoded || !/^(?:--[a-zA-Z0-9_-]+|-?[a-zA-Z][a-zA-Z0-9_-]*)$/u.test(propDecoded)) {
    return `Invalid CSS property name "${property.trim()}"`;
  }
  if (BLOCKED_PROPERTIES.has(propDecoded)) {
    return `Blocked unsafe CSS property "${propDecoded}"`;
  }

  const decodedValue = decodeCssEscapes(value);
  const compact = decodedValue.replace(/[\s\u0000-\u001f]+/gu, "").toLowerCase();

  if (compact.includes("expression(")) {
    return `Blocked unsafe expression() in "${propDecoded}"`;
  }
  if (/(?:javascript|vbscript|livescript):/iu.test(compact)) {
    return `Blocked unsafe script protocol in "${propDecoded}"`;
  }
  if (compact.includes("behavior:") || compact.includes("-moz-binding")) {
    return `Blocked legacy script binding in "${propDecoded}"`;
  }
  if (/data:(?:text\/html|application\/javascript|text\/javascript|image\/svg\+xml)/iu.test(compact)) {
    return `Blocked unsafe data URL in "${propDecoded}"`;
  }

  for (const rawUrl of extractUrlTokens(decodedValue)) {
    const trimmed = rawUrl.trim();
    if (!trimmed) continue;
    const urlCompact = trimmed.replace(/[\s\u0000-\u001f]+/gu, "").toLowerCase();
    if (/^(?:javascript|vbscript|livescript):/iu.test(urlCompact)) {
      return `Blocked unsafe url(${trimmed.slice(0, 32)}) in "${propDecoded}"`;
    }
    if (urlCompact.startsWith("data:")) {
      if (!SAFE_DATA_IMAGE_URL.test(urlCompact)) {
        return `Blocked non-raster data URL in "${propDecoded}"`;
      }
      continue;
    }
    if (/^(?:https?:|\/\/|ftp:|file:)/iu.test(urlCompact)) {
      if (!allowExternalUrls) {
        return `Blocked external URL in "${propDecoded}"`;
      }
      if (!/^https?:/iu.test(urlCompact)) {
        return `Blocked non-HTTP(S) URL in "${propDecoded}"`;
      }
    }
  }

  // Block `@import` smuggled inside declarations or values
  if (/@import\b/iu.test(decodedValue)) {
    return `Blocked @import token in "${propDecoded}"`;
  }
  return null;
}

function splitTopLevel(input: string, delimiter: string): string[] {
  const parts: string[] = [];
  let current = "";
  let quote: '"' | "'" | null = null;
  let parenDepth = 0;
  let bracketDepth = 0;

  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i]!;
    if (quote) {
      current += ch;
      if (ch === "\\" && i + 1 < input.length) {
        current += input[i + 1]!;
        i += 1;
      } else if (ch === quote) {
        quote = null;
      }
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      current += ch;
      continue;
    }
    if (ch === "(") parenDepth += 1;
    else if (ch === ")" && parenDepth > 0) parenDepth -= 1;
    else if (ch === "[") bracketDepth += 1;
    else if (ch === "]" && bracketDepth > 0) bracketDepth -= 1;

    if (ch === delimiter && parenDepth === 0 && bracketDepth === 0) {
      parts.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.length > 0) parts.push(current);
  return parts;
}

function sanitizeDeclarations(
  body: string,
  allowExternalUrls: boolean,
  warnings: string[],
  counter: { blocked: number },
): string {
  const kept: string[] = [];
  for (const rawDecl of splitTopLevel(body, ";")) {
    const trimmed = rawDecl.trim();
    if (!trimmed) continue;
    const colon = trimmed.indexOf(":");
    if (colon <= 0) continue;
    const property = trimmed.slice(0, colon).trim();
    const value = trimmed.slice(colon + 1).trim();
    if (!value) continue;
    const violation = checkDeclarationSafety(property, value, allowExternalUrls);
    if (violation) {
      counter.blocked += 1;
      warnings.push(violation);
      continue;
    }
    kept.push(`${property}: ${value}`);
  }
  return kept.join("; ");
}

function escapeRegExp(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function scopeSingleSelector(selector: string, scopeSelector: string): string {
  const trimmed = selector.trim();
  if (!trimmed) return "";

  const alreadyScoped = new RegExp(`^${escapeRegExp(scopeSelector)}(?:$|\\s|[.#:\\[>+~])`, "u");
  if (alreadyScoped.test(trimmed)) {
    return trimmed;
  }

  // Rewrite `:root`, `html`, `body` roots onto the player scope container so theme variables and base rules stay isolated.
  const rootMatch = /^(?::root|html(?:\s*>\s*body|\s+body)?|body)(?=$|\s|[.#:\[>+~])/iu.exec(trimmed);
  if (rootMatch) {
    const rest = trimmed.slice(rootMatch[0].length);
    return `${scopeSelector}${rest}`;
  }

  return `${scopeSelector} ${trimmed}`;
}

function scopeSelectorList(selectorText: string, scopeSelector: string): string {
  const scoped: string[] = [];
  for (const part of splitTopLevel(selectorText, ",")) {
    const transformed = scopeSingleSelector(part, scopeSelector);
    if (transformed) scoped.push(transformed);
  }
  return scoped.join(", ");
}

interface CssNode {
  readonly kind: "at-rule" | "style-rule";
  readonly prelude: string;
  readonly body?: string;
}

function parseTopLevelCssNodes(input: string): CssNode[] {
  const nodes: CssNode[] = [];
  let i = 0;
  const len = input.length;

  while (i < len) {
    while (i < len && /[\s;]/u.test(input[i]!)) i += 1;
    if (i >= len) break;

    const start = i;
    let quote: '"' | "'" | null = null;
    let parenDepth = 0;
    let preludeEnd = -1;
    let terminator: ";" | "{" | null = null;

    while (i < len) {
      const ch = input[i]!;
      if (quote) {
        if (ch === "\\" && i + 1 < len) {
          i += 2;
          continue;
        }
        if (ch === quote) quote = null;
        i += 1;
        continue;
      }
      if (ch === '"' || ch === "'") {
        quote = ch;
        i += 1;
        continue;
      }
      if (ch === "(") parenDepth += 1;
      else if (ch === ")" && parenDepth > 0) parenDepth -= 1;
      else if (parenDepth === 0 && (ch === "{" || ch === ";")) {
        preludeEnd = i;
        terminator = ch;
        i += 1;
        break;
      }
      i += 1;
    }

    if (terminator === null || preludeEnd < 0) break;
    const prelude = input.slice(start, preludeEnd).trim();

    if (terminator === ";") {
      if (prelude.startsWith("@")) {
        nodes.push({ kind: "at-rule", prelude });
      }
      continue;
    }

    // Read balanced `{ ... }` block body
    const bodyStart = i;
    let braceDepth = 1;
    quote = null;
    while (i < len && braceDepth > 0) {
      const ch = input[i]!;
      if (quote) {
        if (ch === "\\" && i + 1 < len) {
          i += 2;
          continue;
        }
        if (ch === quote) quote = null;
        i += 1;
        continue;
      }
      if (ch === '"' || ch === "'") {
        quote = ch;
        i += 1;
        continue;
      }
      if (ch === "{") braceDepth += 1;
      else if (ch === "}") braceDepth -= 1;
      i += 1;
    }

    if (braceDepth !== 0) {
      // Unclosed block (e.g. from truncation or malformed input): drop safely.
      break;
    }
    const body = input.slice(bodyStart, i - 1);
    nodes.push({
      kind: prelude.startsWith("@") ? "at-rule" : "style-rule",
      prelude,
      body,
    });
  }

  return nodes;
}

function sanitizeNodeList(
  cssBody: string,
  scopeSelector: string,
  allowExternalUrls: boolean,
  warnings: string[],
  counter: { blocked: number },
  scopeRules: boolean,
  depth = 0,
): string {
  const MAX_CSS_NESTING_DEPTH = 16;
  if (depth > MAX_CSS_NESTING_DEPTH) {
    counter.blocked += 1;
    warnings.push(`Dropped CSS block exceeding maximum nesting depth (${MAX_CSS_NESTING_DEPTH})`);
    return "";
  }
  const out: string[] = [];
  for (const node of parseTopLevelCssNodes(cssBody)) {
    if (node.kind === "at-rule") {
      const nameMatch = /^@([a-zA-Z0-9_-]+)/u.exec(decodeCssEscapes(node.prelude));
      const atName = nameMatch?.[1]?.toLowerCase() ?? "";
      if (!atName || BLOCKED_AT_RULES.has(atName)) {
        counter.blocked += 1;
        warnings.push(`Blocked unsafe at-rule "@${atName || "unknown"}"`);
        continue;
      }
      if (NESTED_SCOPING_AT_RULES.has(atName) && node.body !== undefined) {
        const inner = sanitizeNodeList(node.body, scopeSelector, allowExternalUrls, warnings, counter, scopeRules, depth + 1);
        if (inner) {
          out.push(`${node.prelude} {\n${inner}\n}`);
        }
        continue;
      }
      if (KEYFRAME_AT_RULES.has(atName) && node.body !== undefined) {
        // Keyframe stop selectors (`from`, `to`, `50%`) must not be prefixed with `.player-layout`.
        const inner = sanitizeNodeList(node.body, scopeSelector, allowExternalUrls, warnings, counter, false, depth + 1);
        if (inner) {
          out.push(`${node.prelude} {\n${inner}\n}`);
        }
        continue;
      }
      if (atName === "font-face" && node.body !== undefined) {
        const decls = sanitizeDeclarations(node.body, allowExternalUrls, warnings, counter);
        if (decls) {
          out.push(`@font-face { ${decls}; }`);
        }
        continue;
      }
      counter.blocked += 1;
      warnings.push(`Blocked unsupported at-rule "@${atName}"`);
      continue;
    }

    if (node.body === undefined) continue;
    const decls = sanitizeDeclarations(node.body, allowExternalUrls, warnings, counter);
    if (!decls) continue;

    const selector = scopeRules ? scopeSelectorList(node.prelude, scopeSelector) : node.prelude.trim();
    if (!selector) continue;
    out.push(`${selector} { ${decls}; }`);
  }
  return out.join("\n");
}

/**
 * Sanitizes and scopes author-supplied custom theme CSS under `.player-layout` (or `scopeSelector`).
 * Blocks `@import`, `url(javascript:...)`, `expression()`, `-moz-binding`, `behavior`,
 * HTML tag breakouts (`</style>`), and oversize payloads.
 */
export function sanitizeCustomCss(
  rawCss: string,
  options?: SanitizeCustomCssOptions,
): SanitizeCustomCssResult {
  const scopeSelector = options?.scopeSelector?.trim() || CUSTOM_CSS_SCOPE_SELECTOR;
  const maxBytes = options?.maxBytes ?? CUSTOM_CSS_MAX_BYTES;
  const allowExternalUrls = options?.allowExternalUrls === true;
  const warnings: string[] = [];
  const counter = { blocked: 0 };

  if (typeof rawCss !== "string" || rawCss.trim() === "") {
    return { css: "", warnings, blockedCount: 0, truncated: false };
  }

  let working = rawCss.replace(/\0/gu, "");
  let truncated = false;
  if (utf8ByteLength(working) > maxBytes) {
    working = truncateToUtf8Bytes(working, maxBytes);
    truncated = true;
    warnings.push(`Custom CSS exceeded ${Math.round(maxBytes / 1024)}KB limit and was truncated.`);
  }

  if (/<\/style/iu.test(working)) {
    counter.blocked += 1;
    warnings.push("Blocked </style> breakout sequence in custom CSS.");
    working = working.replace(/<\/style[^>]*>/giu, "");
  }
  working = working.replace(/<!--|-->/gu, "");
  working = stripCssComments(working);

  const sanitized = sanitizeNodeList(working, scopeSelector, allowExternalUrls, warnings, counter, true);
  return {
    css: sanitized,
    warnings,
    blockedCount: counter.blocked,
    truncated,
  };
}

function resolveMountHost(root: ParentNode | Document | HTMLElement | null | undefined): {
  readonly doc: Document;
  readonly container: Element;
} | null {
  if (!root) return null;
  if ("head" in root && "createElement" in root) {
    const doc = root as Document;
    const container = doc.head ?? doc.documentElement;
    return container ? { doc, container } : null;
  }
  const element = root as Element;
  const doc = element.ownerDocument ?? (typeof document !== "undefined" ? document : null);
  if (!doc) return null;
  return { doc, container: element };
}

function findExistingCustomStyle(container: Element): HTMLStyleElement | null {
  if (typeof container.querySelector === "function") {
    return container.querySelector(`style[${CUSTOM_CSS_STYLE_ATTR}="1"]`) as HTMLStyleElement | null;
  }
  const children = (container as unknown as { children?: ArrayLike<Element> }).children;
  if (children) {
    for (let i = 0; i < children.length; i += 1) {
      const child = children[i];
      if (child && child.tagName?.toLowerCase() === "style" && child.getAttribute?.(CUSTOM_CSS_STYLE_ATTR) === "1") {
        return child as HTMLStyleElement;
      }
    }
  }
  return null;
}

/** Removes any previously mounted custom project CSS `<style>` element from `root`. */
export function removeProjectCustomCss(root: ParentNode | Document | HTMLElement | null | undefined): void {
  const host = resolveMountHost(root);
  if (!host) return;
  const existing = findExistingCustomStyle(host.container);
  existing?.remove();
}

/**
 * Sanitizes and mounts a project's custom CSS inside `root` via a dedicated `<style data-oprn-custom-theme="1">`
 * element. Calling again updates the same style tag in place; passing empty CSS removes it.
 */
export function applyProjectCustomCss(
  root: ParentNode | Document | HTMLElement | null | undefined,
  css: string | undefined | null,
  options?: SanitizeCustomCssOptions,
): CustomCssMountHandle {
  const result = sanitizeCustomCss(css ?? "", options);
  const host = resolveMountHost(root);

  if (!host) {
    return {
      applied: false,
      css: result.css,
      warnings: result.warnings,
      blockedCount: result.blockedCount,
      truncated: result.truncated,
      dispose: () => undefined,
    };
  }

  const existing = findExistingCustomStyle(host.container);
  if (!result.css) {
    existing?.remove();
    return {
      applied: false,
      css: "",
      warnings: result.warnings,
      blockedCount: result.blockedCount,
      truncated: result.truncated,
      dispose: () => undefined,
    };
  }

  const styleEl = existing ?? (host.doc.createElement("style") as HTMLStyleElement);
  styleEl.setAttribute(CUSTOM_CSS_STYLE_ATTR, "1");
  styleEl.textContent = result.css;
  if (!existing) {
    host.container.appendChild(styleEl);
  }

  return {
    applied: true,
    css: result.css,
    element: styleEl,
    warnings: result.warnings,
    blockedCount: result.blockedCount,
    truncated: result.truncated,
    dispose: () => {
      styleEl.remove();
    },
  };
}
