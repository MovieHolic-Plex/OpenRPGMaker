// src/harnesses/_core/workshop/footprint.ts
/**
 * 새 기물의 크기 결정(footprint) — 가로 칸, 발밑 줄(막힘 X), 위로 솟은 줄(캐릭터 위에 그려짐 *). 그리기·참고 그림보다 먼저 정한다.
 * 크기 사전(종류별 흔한 크기·범위·자라는 쪽·윗면 낱말)과 규칙은 object-gen `objectgen/footprint.py`(gen-kits 생성물)에서 읽는다 —
 * 여기는 그 decide() 를 그대로 옮긴 것이다(파이썬 정본과 같은 결과여야 한다). 사전 숫자의 출처는
 * scripts/content/measure-object-footprints.py(손 도트 실내 v5 607개 + 버들항 소품 킷 칸 통행 실측, 2026-10-22).
 *
 * 왜(2026-10-22 사용자): 조수가 칸 수를 잘 정해야 한다 — 3×2 짐마차·4×3 분수·2×3 나무·5×4 노점 같은 큰 물건까지.
 * 사람(캐릭터)은 1칸 폭·2칸 키다. 깊이는 발밑 줄을 늘리고, 키는 위 줄을 늘린다(발밑을 늘려 키를 만들지 않는다).
 */
import { kitConstant, objectGenKit } from "./genKits";

type KitClass = {
  readonly words: string;
  readonly typ: { readonly w: number; readonly foot: number; readonly over: number };
  readonly w: readonly [number, number];
  readonly h: readonly [number, number];
  readonly grow: "foot" | "over";
  readonly top: string;
  readonly note?: string;
  readonly measured: readonly string[];
  readonly rise_px?: number;
  /** false = 참고 그림을 만들지 않는다(가는 기둥 — 윗면이 없어 시점 검사가 늘 front 로 떨어진다) */
  readonly reference?: boolean;
};

const CLASSES = kitConstant<Readonly<Record<string, KitClass>>>(objectGenKit, "footprint", "CLASSES");
const ORDER = kitConstant<readonly string[]>(objectGenKit, "footprint", "ORDER");
const BUILDING = kitConstant<string>(objectGenKit, "footprint", "BUILDING");
/** 지시문 한 단락(object-gen GUIDE) */
export const FOOTPRINT_GUIDE = kitConstant<string>(objectGenKit, "footprint", "GUIDE");
export const SIZE_NOTE = kitConstant<string>(objectGenKit, "reference", "SIZE_NOTE");

/** 파이썬 re(IGNORECASE|MULTILINE) 글 → JS. 같은 문법만 쓴다(룩비하인드·\b·$). */
const compiled = new Map<string, RegExp>();
const pattern = (source: string): RegExp => {
  let re = compiled.get(source);
  if (!re) { re = new RegExp(source, "imu"); compiled.set(source, re); }
  return re;
};

export type FootprintDecision = {
  /** 크기 사전 종류(없으면 null) */
  readonly cls: string | null;
  readonly w: number;
  /** 발밑 줄(막힘) */
  readonly foot: number;
  /** 발밑 위로 솟은 줄(지나감, 캐릭터 위에 그려짐) */
  readonly over: number;
  /** 위로 솟는 px — 보통 over×16, 실내 사전값이 있으면 그것(침대 6px 등) */
  readonly risePx: number;
  /** 위→아래 줄마다 칸: X 막힘 · * 위에 그려짐(지나감) */
  readonly passage: readonly string[];
  /** 참고 그림 지시문의 윗면 낱말(종류마다) */
  readonly top: string | null;
  readonly adjusted: readonly string[];
  readonly reason: string;
  /** 크기 사전의 실측 예(최대 3) */
  readonly measured: readonly string[];
  /** 참고 그림을 만들지(가는 기둥 lamp·banner·signpost 는 false, object-gen bcab2ed) */
  readonly reference: boolean;
};

/** 머리 낱말(이름 끝 낱말)이 먼저 — 「나무 벌통」은 나무가 아니다. 그다음 이름 전체, 그다음 설명. */
export function footprintClass(name: string, brief = ""): string | null {
  const head = (name ?? "").trim().split(/[\s·,/()]+/u).filter(Boolean).at(-1) ?? "";
  for (const text of [head, name, brief]) {
    const low = (text ?? "").trim().toLowerCase();
    if (!low) continue;
    for (const cls of ORDER) if (CLASSES[cls] && pattern(CLASSES[cls]!.words).test(low)) return cls;
  }
  return null;
}

export function isBuildingName(name: string): boolean {
  return pattern(BUILDING).test((name ?? "").trim().toLowerCase());
}

function split(c: KitClass, h: number): [number, number] {
  const base = c.typ.foot + c.typ.over;
  if (h === base) return [c.typ.foot, c.typ.over];
  if (h < base) { const over = Math.max(0, Math.min(c.typ.over, h - 1)); return [h - over, over]; }
  const extra = h - base;
  return c.grow === "foot" ? [c.typ.foot + extra, c.typ.over] : [c.typ.foot, c.typ.over + extra];
}

/**
 * 크기를 정한다. w/h = 요청(칸, h = 발밑+위 전체 키), foot = 요청한 발밑 줄. 범위 밖이면 사전 범위로 고치고 adjusted 에 적는다.
 * building = 건물 이름(집·가게·탑…) — object-gen 영역이 아니다(손 도트 건물 킷). 그때는 크기를 정하지 않는다.
 */
export function decideFootprint(name: string, brief: string, ask: { readonly w?: number; readonly h?: number; readonly foot?: number; readonly over?: number; readonly maxW?: number; readonly maxH?: number; readonly interior?: boolean } = {}):
  ({ readonly building: true; readonly reason: string }) | ({ readonly building: false } & FootprintDecision) {
  if (isBuildingName(name)) return { building: true, reason: `「${name}」은(는) 건물이다 — 건물은 손 도트 건물 킷으로 짓는다(공방 object-gen 이 아니다)` };
  const cls = footprintClass(name, brief);
  const c = cls ? CLASSES[cls] : undefined;
  const adjusted: string[] = [];
  let h = ask.h ?? (ask.foot !== undefined ? ask.foot + (ask.over ?? 0) : undefined);
  let w: number, foot: number, over: number, why: string;
  if (c) {
    w = ask.w ?? c.typ.w;
    h ??= c.typ.foot + c.typ.over;
    const clamp = (v: number, [lo, hi]: readonly [number, number]) => Math.min(Math.max(v, lo), hi);
    if (w !== clamp(w, c.w)) { adjusted.push(`폭 ${w} → ${clamp(w, c.w)}칸(${cls} 는 ${c.w[0]}~${c.w[1]}칸 폭)`); w = clamp(w, c.w); }
    if (h !== clamp(h, c.h)) { adjusted.push(`키 ${h} → ${clamp(h, c.h)}칸(${cls} 는 전체 ${c.h[0]}~${c.h[1]}칸)`); h = clamp(h, c.h); }
    [foot, over] = split(c, h);
    // 요청한 발밑/위 나눔은 그 종류가 자라는 쪽을 지킬 때만 따른다(object-gen 7ec0660): 깊은 물건(짐마차·노점·분수)은 발밑을,
    // 키 큰 물건(나무·가로등)은 위를 늘린다. 실측: 3×3 건초 짐마차를 1+2 로 받아 한 줄 수레 위에 두 줄 덮개가 됐다(버들항 4×3 짐마차는 2+1).
    if (ask.foot !== undefined && ask.foot >= 1 && ask.foot <= h && !adjusted.length) {
      const keeps = c.grow === "foot" ? h - ask.foot <= over : ask.foot <= foot;
      if (keeps) [foot, over] = [ask.foot, h - ask.foot];
      else if (ask.foot !== foot) adjusted.push(`나눔 ${ask.foot}+${h - ask.foot} → ${foot}+${over}(${cls} 는 ${c.grow === "foot" ? "발밑 줄" : "위 줄"}이 자란다)`);
    }
    why = `${cls}: 흔한 크기 ${c.typ.w}×${c.typ.foot}+${c.typ.over} (${c.measured.slice(0, 2).join("; ")})`;
  } else {
    w = ask.w ?? 1;
    h ??= 1;
    foot = ask.foot !== undefined && ask.foot >= 1 && ask.foot <= h ? ask.foot : ask.over !== undefined ? Math.max(1, h - ask.over) : h <= 2 ? 1 : h - 1;
    over = h - foot;
    why = "크기 사전에 없는 종류 — 요청 크기를 썼다(맨 아래 줄 = 발밑, 나머지 = 위에 그려짐)";
  }
  w = Math.min(w, ask.maxW ?? 6);
  const total = Math.min(foot + over, ask.maxH ?? 6);
  foot = Math.min(foot, total);
  over = total - foot;
  // 실내 사전값(침대 6px·옷장 16px·카운터 8px): 위 줄이 1줄 이하일 때만 px 로 정밀하게.
  const risePx = ask.interior && c?.rise_px !== undefined && over <= 1 ? c.rise_px : over * 16;
  const passage = [...Array.from({ length: over }, () => "*".repeat(w)), ...Array.from({ length: foot }, () => "X".repeat(w))];
  return {
    building: false, cls, w, foot, over, risePx, passage, top: c?.top ?? null, adjusted, measured: c?.measured.slice(0, 3) ?? [], reference: c?.reference ?? true,
    reason: `${why}; ${w}×${foot + over}칸 = 발밑 ${foot}줄(막힘) + 위 ${over}줄(캐릭터 위에 그려짐)`,
  };
}

/** 참고 그림 지시문의 크기 문장(object-gen SIZE_NOTE) — 칸 수와 사람(1×2칸) 기준. */
export function sizeNote(wCells: number, hCells: number): string {
  return SIZE_NOTE.replaceAll("{w}", String(wCells)).replaceAll("{h}", String(hCells));
}
