// pixelfx 효과 목록(편집기 고르기 창·조수 도구용). 효과 코드를 불러오지 않고 vendor 가 만든 catalog.json 만 읽는다.
// 런타임(내보낸 게임)은 이 파일을 쓰지 않는다 — 효과 모듈의 meta 를 직접 본다.
import catalogJson from "@/vendor/pixelfx/catalog.json";

export interface PixelFxCatalogEntry {
  readonly id: string;
  readonly category: string;
  readonly name: string;
  readonly desc: string;
  readonly tags: readonly string[];
  readonly size: readonly number[];
  readonly origin: readonly number[];
  readonly duration: number;
  readonly loop: boolean;
  readonly fps: number;
  readonly palette: readonly string[];
  /** 캐릭터 실루엣을 쓰는 효과(상태·오라). */
  readonly actor: number;
  /** 캐릭터 뒤 층을 따로 그린다. */
  readonly back: number;
}

export interface PixelFxCategory {
  readonly id: string;
  readonly name: string;
  readonly blurb: string;
}

const catalog = catalogJson as unknown as { categories: PixelFxCategory[]; effects: PixelFxCatalogEntry[] };

export const PIXEL_FX_CATEGORIES: readonly PixelFxCategory[] = catalog.categories;
export const PIXEL_FX_EFFECTS: readonly PixelFxCatalogEntry[] = catalog.effects;
const BY_ID = new Map(PIXEL_FX_EFFECTS.map((entry) => [entry.id, entry]));

/** 분류 id → 한국어 이름(편집기 화면용, 원문). */
export const PIXEL_FX_CATEGORY_LABELS: Readonly<Record<string, string>> = {
  fire: "불", explosions: "폭발", water: "물", ice: "얼음", lightning: "번개", scifi: "SF", melee: "근접 베기",
  impacts: "타격", projectiles: "투사체", spawn: "등장·소멸", arcane: "비전", holy: "신성", shadow: "어둠",
  status: "상태", nature: "자연", weather: "날씨", ui: "UI", pickups: "획득", transitions: "전환", critters: "작은 생물",
};

export function pixelFxEntry(id: string | undefined): PixelFxCatalogEntry | undefined {
  return id ? BY_ID.get(id) : undefined;
}

export function isKnownPixelFxEffect(id: string | undefined): boolean {
  return Boolean(id && BY_ID.has(id));
}

/**
 * 낱말 검색. 이름·id·태그·설명·분류에서 찾고 점수 순으로 돌려준다. 한국어 낱말 몇 개는 영어 태그로 바꿔 찾는다.
 * query 가 비면 분류 안 전부(분류도 없으면 전체).
 */
export function searchPixelFx(query: string, options: { readonly category?: string; readonly loop?: boolean; readonly limit?: number } = {}): PixelFxCatalogEntry[] {
  const words = expandQuery(query);
  const scored: { entry: PixelFxCatalogEntry; score: number }[] = [];
  for (const entry of PIXEL_FX_EFFECTS) {
    if (options.category && entry.category !== options.category) continue;
    if (options.loop !== undefined && entry.loop !== options.loop) continue;
    if (words.length === 0) { scored.push({ entry, score: 0 }); continue; }
    let score = 0;
    const name = entry.name.toLowerCase();
    const id = entry.id.toLowerCase();
    const desc = entry.desc.toLowerCase();
    const tags = entry.tags.map((tag) => tag.toLowerCase());
    for (const word of words) {
      if (id === word || id.endsWith(`/${word}`) || name === word) score += 12;
      else if (name.includes(word) || id.includes(word)) score += 6;
      if (tags.includes(word)) score += 5;
      else if (tags.some((tag) => tag.includes(word))) score += 2;
      if (entry.category === word) score += 4;
      if (desc.includes(word)) score += 1;
    }
    if (score > 0) scored.push({ entry, score });
  }
  scored.sort((a, b) => b.score - a.score || a.entry.id.localeCompare(b.entry.id));
  return scored.slice(0, options.limit ?? 40).map((item) => item.entry);
}

/** 못 찾은 id 에 가장 가까운 효과들(도구 오류 메시지용). */
export function nearestPixelFx(id: string, limit = 5): PixelFxCatalogEntry[] {
  const tail = id.split("/").pop() ?? id;
  const found = searchPixelFx(tail.replace(/-/g, " "), { limit });
  return found.length > 0 ? found : searchPixelFx(id.split("/")[0] ?? "", { limit });
}

const KO_WORDS: Readonly<Record<string, string>> = {
  횃불: "torch", 모닥불: "campfire", 촛불: "candle", 화로: "brazier", 불: "fire", 불꽃: "fire", 화염: "fire", 화염구: "fireball",
  폭발: "explosion", 연기: "smoke", 물: "water", 분수: "fountain", 폭포: "waterfall", 비: "rain", 눈: "snow", 안개: "fog",
  얼음: "ice", 서리: "frost", 번개: "lightning", 전기: "electric", 베기: "slash", 검: "sword", 타격: "hit", 충격: "impact",
  화살: "arrow", 회복: "heal", 치유: "heal", 축복: "blessing", 신성: "holy", 어둠: "shadow", 저주: "curse", 독: "poison",
  마법진: "circle", 마법: "magic", 포털: "portal", 순간이동: "blink", 반딧불: "fireflies", 벚꽃: "cherry", 낙엽: "leaves",
  오로라: "aurora", 나비: "butterfly", 박쥐: "bat", 새: "bird", 유령: "ghost", 보물상자: "chest", 동전: "coin", 보석: "gem",
  레벨업: "level", 별: "star", 반짝임: "sparkle", 상태: "status", 화상: "burning", 빙결: "frozen", 수면: "asleep", 석화: "petrified",
};

function expandQuery(query: string): string[] {
  const raw = query.toLowerCase().split(/[\s,/·]+/).map((word) => word.trim()).filter(Boolean);
  const out = new Set<string>();
  for (const word of raw) {
    out.add(word);
    const ko = KO_WORDS[word];
    if (ko) out.add(ko);
    for (const [k, v] of Object.entries(KO_WORDS)) if (word.length >= 2 && word.includes(k)) out.add(v);
  }
  return [...out];
}

/** 한 색에서 효과용 어두운→밝은 띠(6단)를 만든다 — 편집기 「색 바꾸기」와 조수의 color 인자. */
export function pixelFxRampFromColor(hex: string, steps = 6): string[] | undefined {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return undefined;
  const value = parseInt(match[1]!, 16);
  const base = [(value >> 16) & 255, (value >> 8) & 255, value & 255];
  const out: string[] = [];
  for (let i = 0; i < steps; i += 1) {
    const t = i / (steps - 1);
    // 앞쪽 절반은 검정에서 색으로, 뒤쪽 절반은 색에서 흰색으로 — 가운데가 고른 색이다.
    const mix = t < 0.5 ? base.map((c) => c * (0.18 + 1.64 * t)) : base.map((c) => c + (255 - c) * ((t - 0.5) * 2) ** 1.3);
    out.push(`#${mix.map((c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, "0")).join("")}`);
  }
  return out;
}

/** 편집기 색 바꾸기 견본(이름 → 띠). */
export const PIXEL_FX_PALETTE_PRESETS: readonly { readonly id: string; readonly label: string; readonly palette: readonly string[] }[] = [
  { id: "blue", label: "푸른 불", palette: ["#0b1030", "#14306e", "#2361c8", "#4fa0ff", "#a6dcff", "#ffffff"] },
  { id: "green", label: "초록 독", palette: ["#0c1e0c", "#1b4a1a", "#2f8a2a", "#5cd44a", "#b4ff8a", "#f4ffe0"] },
  { id: "violet", label: "보라 마력", palette: ["#160a2a", "#3a1466", "#6b2bb8", "#a35cff", "#d9b0ff", "#ffffff"] },
  { id: "gold", label: "금빛", palette: ["#2a1a04", "#6b4210", "#b8801c", "#f2c040", "#ffe89a", "#ffffff"] },
  { id: "red", label: "붉은 피", palette: ["#200406", "#5a0a10", "#a0141e", "#e03a3a", "#ff9a8a", "#fff0ea"] },
  { id: "white", label: "하얀 빛", palette: ["#202833", "#4a5666", "#8a98aa", "#c4d0dc", "#eef4fa", "#ffffff"] },
  { id: "shadow", label: "검은 그림자", palette: ["#000000", "#0e0a14", "#241a30", "#3e2e52", "#6a5484", "#a490c0"] },
];
