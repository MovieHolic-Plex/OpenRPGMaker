/**
 * 문 열고 닫기 연출 — 「화면 효과」 의 doorOpen / doorClose.
 *
 * 문은 대개 칩셋 타일 그림(엘리베이터 문짝·유리문·철문)이라 이벤트 그림처럼 프레임을 갈아 끼울 수 없다.
 * 그래서 런타임(playSceneDoors)이 그 칸들의 타일을 그대로 복사한 문짝을 문 위에 겹쳐 놓고 움직인다:
 *  - slide(미닫이·엘리베이터): 가운데에서 두 쪽으로 갈라져 벽 속으로 들어간다. 안은 불 켜진 승강기 칸 색.
 *  - swing(여닫이): 경첩 쪽으로 접히며(위에서 본 문이 안쪽으로 열린 모양) 어두운 안쪽이 보인다.
 * 새 그림이 필요 없다 — 어떤 칩셋의 어떤 문 그림에도 같은 연출이 붙는다.
 *
 * 값 문자열: "x,y,w,h[,style[,hinge][,interior][,l4,r3,t7,b1]]" — 칸 좌표(문 그림의 왼쪽 위)·칸 너비·높이, style = slide|swing, hinge = left|right,
 * interior = lit(불 켜진 승강기 칸)|dark(어두운 안)|none(지나다니는 문간 — 안쪽 판 없이 바닥이 보인다).
 * l/r/t/b = 문 그림 사각형 안에서 문틀(움직이지 않는 부분)의 왼·오른·위·아래 두께(픽셀). 승강기 층 표시등·문틀,
 * 유리문 둘레 벽은 제자리에 남고 그 안쪽 문짝만 움직인다. 비우면 0(칸 전체가 문짝).
 *
 *  - shutter(셔터·롤업): 문짝이 위로 말려 올라간다(문틀 윗변 속으로).
 * hinge = left|right(외짝 여닫이의 경첩 쪽) · both(두 짝 여닫이 — 가운데에서 갈라져 양쪽 경첩으로 접힌다).
 * fit:"art" = 문틀 두께를 적지 않고 런타임이 문 그림에서 문짝(유리·나무판)을 재어 정한다 — 조수 도구가 문을 적을 때 쓴다.
 * 문의 종류(자동문·여닫이·미닫이·셔터)·크기를 그림에서 추론하는 규칙은 `@/project/mapDoorKinds`.
 *
 * 맵에 `doors`(MapDoorDef[]) 로 적은 auto 문은 명령 없이 저절로 열고 닫힌다 — 누가(주인공·인물) 문 칸이나 바로 앞뒤 칸에 서면 열리고,
 * 아무도 없으면 잠깐 뒤 닫힌다(소리 포함). 회의실 유리문·편의점 자동문처럼 사람이 지나다니는 문에 쓴다.
 * 열린 상태는 세션에 남고(같은 맵에 있는 동안), 다른 맵으로 가면 닫힌다. 소리는 이 명령이 내지 않는다(효과음 명령을 같이 쓴다).
 */

export const DOOR_STYLES = ["slide", "swing", "shutter"] as const;
export type DoorStyle = (typeof DOOR_STYLES)[number];
export type DoorHinge = "left" | "right" | "both";

export type DoorInterior = "lit" | "dark" | "none";

export type DoorSpec = {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly style: DoorStyle;
  readonly hinge: DoorHinge;
  /** 열린 문 뒤에 깔 판. 미지정 = slide 는 lit, swing 은 dark. */
  readonly interior?: DoorInterior;
  /** 문틀 두께(픽셀) — 문짝은 이 안쪽 사각형만. */
  readonly frame?: DoorFrame;
  /** "art" = frame 이 없을 때 런타임이 문 그림에서 문짝 사각형을 잰다(playSceneDoors.measureDoorLeaves). */
  readonly fit?: "art";
};

export type DoorFrame = { readonly l: number; readonly r: number; readonly t: number; readonly b: number };

/** 맵에 적어 두는 문(저작). auto = 사람이 다가오면 저절로 열고 닫힌다. */
export type MapDoorDef = DoorSpec & {
  readonly auto?: boolean;
  /** 열림·닫힘 효과음 리소스 id. 비우면 소리 없음. */
  readonly openSe?: string;
  readonly closeSe?: string;
  /** 주인공이 열 때만 열림 소리와 함께 울리는 소리(편의점 입점 차임). 인물이 지나갈 때는 울리지 않는다. */
  readonly chimeSe?: string;
};

export function doorInteriorOf(spec: DoorSpec): DoorInterior {
  return spec.interior ?? (spec.style === "slide" ? "lit" : "dark");
}

/** 문의 종류 이름(조수·보고용) — auto 미닫이 = 자동문, 두 짝 여닫이 = double. */
export function doorKindName(def: Pick<MapDoorDef, "style" | "hinge" | "auto">): "auto" | "slide" | "swing" | "double" | "shutter" {
  if (def.style === "shutter") return "shutter";
  if (def.style === "slide") return def.auto ? "auto" : "slide";
  return def.hinge === "both" ? "double" : "swing";
}

/** 세션에 남는 문 상태(키 = doorKey). */
export type RuntimeDoorState = DoorSpec & {
  readonly mapId: string;
  readonly open: boolean;
  readonly durationMs: number;
};

export const DOOR_DEFAULT_MS = 450;

export function doorKey(mapId: string, x: number, y: number): string {
  return `${mapId}:${x},${y}`;
}

/** 값 문자열 → 문 칸. 좌표가 없거나 이상하면 null(명령은 조용히 삼키지 않고 unsupported 로 기록된다). */
export function parseDoorValue(value: string): DoorSpec | null {
  const parts = value.split(/[\s,]+/u).map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  const nums = parts.slice(0, 4).map(Number);
  const [x, y] = nums;
  if (!Number.isInteger(x) || !Number.isInteger(y) || x! < 0 || y! < 0) return null;
  const w = Number.isInteger(nums[2]) && nums[2]! > 0 ? nums[2]! : 1;
  const h = Number.isInteger(nums[3]) && nums[3]! > 0 ? nums[3]! : 1;
  const words = parts.slice(2).filter((p) => !/^\d+$/u.test(p));
  const style: DoorStyle = words.includes("swing") ? "swing" : words.includes("shutter") ? "shutter" : "slide";
  const hinge: DoorHinge = words.includes("both") ? "both" : words.includes("right") ? "right" : "left";
  const interior = (["lit", "dark", "none"] as const).find((v) => words.includes(v));
  const frame: Record<"l" | "r" | "t" | "b", number> = { l: 0, r: 0, t: 0, b: 0 };
  let framed = false;
  for (const word of words) {
    const m = /^([lrtb])(\d{1,3})$/u.exec(word);
    if (m) { frame[m[1] as "l"] = Number(m[2]); framed = true; }
  }
  return { x: x!, y: y!, w: Math.min(w, 8), h: Math.min(h, 8), style, hinge, ...(interior ? { interior } : {}), ...(framed ? { frame } : words.includes("fit") ? { fit: "art" as const } : {}) };
}

export function doorValue(spec: { x: number; y: number; w?: number; h?: number; style?: DoorStyle; hinge?: DoorHinge; interior?: DoorInterior; frame?: DoorFrame; fit?: "art" }): string {
  const f = spec.frame;
  return [spec.x, spec.y, spec.w ?? 1, spec.h ?? 1, spec.style ?? "slide", spec.hinge ?? "left", ...(spec.interior ? [spec.interior] : []),
    ...(f ? [`l${f.l}`, `r${f.r}`, `t${f.t}`, `b${f.b}`] : spec.fit === "art" ? ["fit"] : [])].join(",");
}
