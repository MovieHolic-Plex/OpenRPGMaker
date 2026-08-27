/**
 * 프로젝트 · 에디터 · 런타임이 공유하는 선택 가능한 글꼴 목록.
 *
 * CSS 는 `src/styles/tokens.css` 의 `--font-ui` / `--font-pixel` / `--font-mono` 토큰만 읽지만,
 * Phaser 캔버스 텍스트는 CSS 변수를 해석하지 못하므로 스택 문자열을 JS 에서도 꺼내 쓴다.
 * 그래서 두 소비자의 유일한 공통 출처가 이 파일이다 — `test/systemFontTheme.test.ts` 가
 * 기본 스택과 tokens.css 선언의 일치를 검사한다.
 */
export type FontRole = "ui" | "pixel" | "mono";

export type FontFamilyId =
  | "system-sans"
  | "system-serif"
  | "system-mono"
  | "neodgm"
  | "galmuri11"
  | "galmuri9";

export interface FontDefinition {
  readonly id: FontFamilyId;
  readonly label: string;
  readonly roles: readonly FontRole[];
  readonly stack: string;
  readonly bundled: boolean;
}

const PIXEL_FALLBACKS = `"GulimChe", "DotumChe", "MS Gothic", monospace`;

export const FONT_REGISTRY: readonly FontDefinition[] = [
  {
    id: "system-sans",
    label: "시스템 산세리프",
    roles: ["ui"],
    stack: `system-ui, "Pretendard", "Apple SD Gothic Neo", "Malgun Gothic", -apple-system, "Segoe UI", sans-serif`,
    bundled: false,
  },
  {
    id: "system-serif",
    label: "시스템 세리프",
    roles: ["ui"],
    stack: `Georgia, "Noto Serif KR", serif`,
    bundled: false,
  },
  {
    id: "system-mono",
    label: "시스템 고정폭",
    roles: ["ui", "mono"],
    stack: `"Cascadia Mono", "JetBrains Mono", "SFMono-Regular", Consolas, monospace`,
    bundled: false,
  },
  {
    id: "neodgm",
    label: "Neo둥근모 · 픽셀",
    roles: ["ui", "pixel", "mono"],
    stack: `"NeoDunggeunmo", "Galmuri11", "Galmuri9", ${PIXEL_FALLBACKS}`,
    bundled: true,
  },
  {
    id: "galmuri11",
    label: "갈무리11 · 픽셀",
    roles: ["ui", "pixel", "mono"],
    stack: `"Galmuri11", "NeoDunggeunmo", "Galmuri9", ${PIXEL_FALLBACKS}`,
    bundled: true,
  },
  {
    id: "galmuri9",
    label: "갈무리9 · 픽셀",
    roles: ["ui", "pixel", "mono"],
    stack: `"Galmuri9", "Galmuri11", "NeoDunggeunmo", ${PIXEL_FALLBACKS}`,
    bundled: true,
  },
];

/**
 * 통일 이전에 각 영역이 실제로 쓰고 있던 스택과 동일한 조합.
 * 기본값을 바꾸면 손대지 않은 프로젝트의 렌더가 달라지므로 임의로 옮기지 않는다.
 */
export const DEFAULT_FONT_SELECTION: Readonly<Record<FontRole, FontFamilyId>> = {
  ui: "system-sans",
  pixel: "neodgm",
  mono: "system-mono",
};

export const FONT_ROLES: readonly FontRole[] = ["ui", "pixel", "mono"];

export const FONT_ROLE_LABELS: Readonly<Record<FontRole, string>> = {
  ui: "에디터 UI",
  pixel: "런타임 · 픽셀",
  mono: "코드 · ID 고정폭",
};

const REGISTRY_BY_ID = new Map<string, FontDefinition>(FONT_REGISTRY.map((entry) => [entry.id, entry]));

export function isFontFamilyId(value: unknown): value is FontFamilyId {
  return typeof value === "string" && REGISTRY_BY_ID.has(value);
}

export function fontDefinition(id: FontFamilyId): FontDefinition {
  const entry = REGISTRY_BY_ID.get(id);
  if (!entry) throw new Error(`unknown font id: ${id}`);
  return entry;
}

export function resolveFontStack(id: FontFamilyId): string {
  return fontDefinition(id).stack;
}

export function fontOptionsForRole(role: FontRole): readonly FontDefinition[] {
  return FONT_REGISTRY.filter((entry) => entry.roles.includes(role));
}

export interface SystemFontConfig {
  ui?: FontFamilyId;
  pixel?: FontFamilyId;
  mono?: FontFamilyId;
}

export function resolveFontSelection(
  config: SystemFontConfig | undefined,
): Readonly<Record<FontRole, FontFamilyId>> {
  const resolved = { ...DEFAULT_FONT_SELECTION } as Record<FontRole, FontFamilyId>;
  if (!config || typeof config !== "object") return resolved;
  for (const role of FONT_ROLES) {
    const candidate = (config as Record<string, unknown>)[role];
    if (isFontFamilyId(candidate) && fontDefinition(candidate).roles.includes(role)) {
      resolved[role] = candidate;
    }
  }
  return resolved;
}

/**
 * 저장용 정규화. 기본값과 같은 선택은 저장하지 않는다 — `battleUiStyle` · `battleModel` 과
 * 같은 관례이고, 기본값이 나중에 바뀌어도 명시적으로 고른 값만 살아남게 한다.
 */
export function normalizeSystemFontConfig(value: unknown): SystemFontConfig | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const source = value as Record<string, unknown>;
  const normalized: SystemFontConfig = {};
  for (const role of FONT_ROLES) {
    const candidate = source[role];
    if (!isFontFamilyId(candidate)) continue;
    if (!fontDefinition(candidate).roles.includes(role)) continue;
    if (candidate === DEFAULT_FONT_SELECTION[role]) continue;
    normalized[role] = candidate;
  }
  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

/** 역할별 CSS 커스텀 프로퍼티 이름 — tokens.css 의 토큰과 같은 이름이어야 덮어쓰기가 성립한다. */
export const FONT_ROLE_CSS_VARIABLES: Readonly<Record<FontRole, string>> = {
  ui: "--font-ui",
  pixel: "--font-pixel",
  mono: "--font-mono",
};
