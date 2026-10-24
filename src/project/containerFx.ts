// 수납(상자·통·자루·서랍) 뒤지기 연출 — 종류마다 소리·흔들림·파편·「뒤진 뒤 모습」을 데이터로 둔다.
//
// 저작 계약(엔진 명령 추가 없이 기존 명령으로 쓴다):
//  - 연출: `showAnimation` 의 animationId 에 내장 연출 id 를 쓴다 — `fx:container:<종류>`(뚜껑·흔들림·파편·소리),
//    `fx:popup:item:<itemId>` · `fx:popup:gold:<금액>`(찾은 것이 머리 위로 떠오른다), `fx:door-open`(문 여는 연출).
//    런타임은 이 접두사를 전투 애니메이션 DB 대신 절차 연출로 그린다(player/playSceneFieldFx.ts).
//  - 뒤진 뒤 모습: 「이미 뒤짐」 페이지에 `interaction: { kind: "container", style, searched: true }` —
//    그 페이지가 켜져 있는 동안 런타임이 칸 위에 뒤진 흔적(열린 뚜껑·비집은 틈·흘린 짚·빠진 서랍)을 그린다.
//  - 한 번에 짓는 도우미: project/eventPatterns/containerSearch.ts.
// 종류는 저작자가 고르거나, 타일 이름표에서 containerStyleForLabel 로 추정한다.

export const CONTAINER_STYLES = ["chest", "crate", "barrel", "sack", "straw", "drawer", "jar"] as const;
export type ContainerStyle = (typeof CONTAINER_STYLES)[number];

export type ContainerParticleKind = "splinter" | "straw" | "dust" | "sparkle";
export type ContainerSearchedMark = "lid-open" | "pried" | "lid-off" | "spill" | "drawer";

export interface ContainerFxSpec {
  /** 여는 소리(번들 CC0 SE). */
  readonly se: string;
  /** 흔들림 폭(px, 16px 칸 기준)과 왕복 횟수. 0 = 흔들지 않는다. */
  readonly shakePx: number;
  readonly shakes: number;
  /** 뚜껑이 열리는 그림(궤짝). */
  readonly lid: boolean;
  readonly particles: { readonly kind: ContainerParticleKind; readonly count: number; readonly colors: readonly number[] };
  /** 뒤진 뒤 칸에 남는 흔적. */
  readonly mark: ContainerSearchedMark;
  /** 시끄러운가 — 집주인이 벽 너머에서도 들을 수 있는 거리(hearRange 기본값). 0 = 조용하다. */
  readonly noise: number;
  /** 연출 길이(ms). 이 시간 뒤에 다음 명령으로 넘어간다(wait=true 일 때). */
  readonly durationMs: number;
}

export const CONTAINER_FX: Readonly<Record<ContainerStyle, ContainerFxSpec>> = {
  chest: {
    se: "cc0-se-osx-wooded-box-open", shakePx: 0, shakes: 0, lid: true,
    particles: { kind: "sparkle", count: 6, colors: [0xfff3b0, 0xffd860, 0xffffff] }, mark: "lid-open", noise: 0, durationMs: 520,
  },
  crate: {
    se: "cc0-se-ors-wood-03", shakePx: 2, shakes: 4, lid: false,
    particles: { kind: "splinter", count: 10, colors: [0xc8915a, 0x9a6634, 0x6e4422] }, mark: "pried", noise: 4, durationMs: 560,
  },
  barrel: {
    se: "cc0-se-osx-wooden-02", shakePx: 2, shakes: 3, lid: false,
    particles: { kind: "splinter", count: 6, colors: [0xb07a44, 0x7a5028] }, mark: "lid-off", noise: 3, durationMs: 500,
  },
  sack: {
    se: "cc0-se-orp-inventory-cloth-heavy", shakePx: 1, shakes: 3, lid: false,
    particles: { kind: "straw", count: 8, colors: [0xe6d08a, 0xc9a85a, 0xf2e2b0] }, mark: "spill", noise: 0, durationMs: 480,
  },
  straw: {
    se: "cc0-se-orp-inventory-cloth", shakePx: 1, shakes: 4, lid: false,
    particles: { kind: "straw", count: 12, colors: [0xe8c860, 0xc8a040, 0xf4dc84] }, mark: "spill", noise: 0, durationMs: 520,
  },
  drawer: {
    se: "cc0-se-osx-wooden-01", shakePx: 1, shakes: 2, lid: false,
    particles: { kind: "dust", count: 5, colors: [0xd8d0c0, 0xb8b0a0] }, mark: "drawer", noise: 0, durationMs: 420,
  },
  jar: {
    se: "cc0-se-ors-item-stone-02", shakePx: 1, shakes: 2, lid: false,
    particles: { kind: "dust", count: 4, colors: [0xcfc4b0, 0xa89c88] }, mark: "lid-off", noise: 0, durationMs: 420,
  },
};

export const POPUP_ITEM_SE = "cc0-se-ors-item-misc-01";
export const POPUP_GOLD_SE = "cc0-se-orp-inventory-coin";

const STYLE_WORDS: readonly [ContainerStyle, RegExp][] = [
  ["chest", /보물|궤|트렁크|가방|chest|trunk|coffer/i],
  ["straw", /짚|건초|볏|straw|hay/i],
  ["sack", /자루|포대|바구니|sack|bag|basket/i],
  ["barrel", /통|술통|barrel|cask|keg/i],
  ["jar", /항아리|단지|물독|장독|jar|pot|urn/i],
  ["drawer", /서랍|협탁|옷장|장롱|화장대|찬장|선반|책상|drawer|wardrobe|cabinet|dresser|cupboard|desk/i],
  ["crate", /상자|짐짝|crate|box/i],
];

/** 타일·이벤트 이름표로 수납 종류를 추정한다. 모르면 crate. */
export function containerStyleForLabel(label: string | undefined): ContainerStyle {
  const text = label ?? "";
  for (const [style, re] of STYLE_WORDS) if (re.test(text)) return style;
  return "crate";
}

export function isContainerStyle(value: unknown): value is ContainerStyle {
  return typeof value === "string" && (CONTAINER_STYLES as readonly string[]).includes(value);
}

// ───────────── 내장 연출 id ─────────────

export const FIELD_FX_PREFIX = "fx:";

export const containerFxId = (style: ContainerStyle): string => `fx:container:${style}`;
export const itemPopupFxId = (itemId: string): string => `fx:popup:item:${itemId}`;
export const goldPopupFxId = (amount: number): string => `fx:popup:gold:${Math.round(amount)}`;
export const DOOR_OPEN_FX_ID = "fx:door-open";

export type FieldFx =
  | { readonly kind: "container"; readonly style: ContainerStyle }
  | { readonly kind: "popupItem"; readonly itemId: string }
  | { readonly kind: "popupGold"; readonly amount: number }
  | { readonly kind: "doorOpen" };

/** showAnimation 의 animationId 가 내장 연출이면 그 뜻을, 아니면 null. */
export function parseFieldFxId(id: string | undefined): FieldFx | null {
  if (!id || !id.startsWith(FIELD_FX_PREFIX)) return null;
  const parts = id.slice(FIELD_FX_PREFIX.length).split(":");
  if (parts[0] === "container" && isContainerStyle(parts[1])) return { kind: "container", style: parts[1] };
  if (parts[0] === "popup" && parts[1] === "item" && parts[2]) return { kind: "popupItem", itemId: parts.slice(2).join(":") };
  if (parts[0] === "popup" && parts[1] === "gold" && Number.isFinite(Number(parts[2]))) return { kind: "popupGold", amount: Number(parts[2]) };
  if (parts[0] === "door-open") return { kind: "doorOpen" };
  return null;
}

/** 검증기용: 전투 애니메이션 DB 에 없어도 되는 id 인가. */
export function isBuiltinFieldFxId(id: string | undefined): boolean {
  return parseFieldFxId(id) !== null;
}

export function fieldFxDurationMs(fx: FieldFx): number {
  switch (fx.kind) {
    case "container": return CONTAINER_FX[fx.style].durationMs;
    case "popupItem":
    case "popupGold": return 700;
    case "doorOpen": return 300;
  }
}
