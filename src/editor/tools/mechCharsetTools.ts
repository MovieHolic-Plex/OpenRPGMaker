// author_actor_charset — 맵 위를 걸어 다닐 기계·병기·탈것 같은 «걷는 칩»(24×32 캐릭터셋, 4방향×걷기 3프레임)을 코드 도트로 만든다.
// 컷신 배우로 character:{resourceId, characterIndex} 를 쓰면 맵 도트와 같은 시점·크기로 진짜 걷는다(생성 그림은 걷기 프레임이 없다).
// 그림 생성이 아니라 결정적 도트 규칙이므로 모델 호출·대기가 없고 같은 입력은 같은 그림이다.
import { drawMechSheet, type MechKit, type MechSpec, type Rgb } from "@/editor/cutsceneArt/mechCharset";
import { encodePng } from "@/editor/cutsceneArt/imageProcess";
import { ToolError, type ToolDefinition, type ToolExecResult } from "./types";

export const ACTOR_CHARSET_TOOL = "author_actor_charset";

const STYLE_SPECS = {
  light: { body: "biped", width: 0 },
  standard: { body: "biped", width: 1 },
  heavy: { body: "biped", width: 2 },
  quad: { body: "quad", width: 1 },
} as const;
const KITS: readonly MechKit[] = ["none", "antenna", "cannon", "shield"];

function hex(value: unknown, field: string): Rgb {
  const m = typeof value === "string" ? /^#?([0-9a-f]{6})$/iu.exec(value.trim()) : null;
  if (!m) throw new ToolError(`${field} 는 '#rrggbb' 색이어야 합니다(받은 값: ${String(value)}).`, { code: "invalid-args" });
  const n = parseInt(m[1]!, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

interface Prepared { readonly dataUrl?: string; readonly error?: string }
const prepared = new Map<string, Prepared>();

function parse(args: Record<string, unknown>): { id: string; name: string; specs: MechSpec[]; names: string[] } {
  const list = Array.isArray(args.characters) ? (args.characters as Record<string, unknown>[]) : [];
  if (list.length < 1 || list.length > 8) throw new ToolError("characters 는 1~8명이어야 합니다(캐릭터셋 한 장 = 4×2 인물).", { code: "invalid-args" });
  const names: string[] = [];
  const specs = list.map((entry, i) => {
    const name = typeof entry.name === "string" && entry.name.trim() ? entry.name.trim() : `기체${i + 1}`;
    names.push(name);
    const style = typeof entry.style === "string" && entry.style in STYLE_SPECS ? (entry.style as keyof typeof STYLE_SPECS) : "standard";
    const kit = typeof entry.kit === "string" && (KITS as readonly string[]).includes(entry.kit) ? (entry.kit as MechKit) : "none";
    return { ...STYLE_SPECS[style], kit, base: hex(entry.baseColor, `characters[${i}].baseColor`), glow: hex(entry.glowColor ?? "#78e6ff", `characters[${i}].glowColor`), accent: hex(entry.accentColor ?? "#c8d2e1", `characters[${i}].accentColor`) } satisfies MechSpec;
  });
  const name = typeof args.name === "string" && args.name.trim() ? args.name.trim() : "걷는 기계 캐릭터셋";
  const slug = (typeof args.id === "string" && args.id.trim() ? args.id.trim() : name).toLowerCase().replace(/[^a-z0-9]+/gu, "_").replace(/^_+|_+$/gu, "");
  return { id: `charset_${slug || "walkers"}`, name, specs, names };
}

const authorActorCharset: ToolDefinition = {
  name: ACTOR_CHARSET_TOOL,
  description:
    "맵 위를 걸어 다닐 기계·병기·로봇·4족 탈것을 «걷는 캐릭터셋»(24×32 도트, 위·오른쪽·아래·왼쪽 × 걷기 3프레임)으로 만들어 이 프로젝트에 등록한다. "
    + "컷신에서 행진·순찰·침공처럼 인물이 맵 위를 진짜로 걷는 장면이 필요한데 맞는 캐릭터셋이 없을 때 쓴다(그림 생성 도구는 걷기 프레임이 없어 미끄러진다). "
    + "characters 마다 style(light 경량 · standard 보통 · heavy 중장갑 · quad 4족), kit(none · antenna · cannon 어깨포 · shield 방패), baseColor(#rrggbb 몸색)와 선택 glowColor(눈·광학부)·accentColor 를 준다. "
    + "결과의 resourceId 와 characterIndex(0부터, 준 순서)를 script_cutscene_staged 의 actors[].character:{resourceId, characterIndex} 로 쓰고 scale 250~300 으로 키우면 화면에서 존재감이 난다.",
  mode: "write",
  domains: ["event"],
  parameters: {
    type: "object", additionalProperties: false, required: ["characters"],
    properties: {
      name: { type: "string", description: "캐릭터셋 이름(예: 설원 병기대)" },
      id: { type: "string", description: "영문 id 조각(선택, 같은 id 로 다시 부르면 덮어씀)" },
      characters: {
        type: "array", minItems: 1, maxItems: 8,
        items: {
          type: "object", additionalProperties: false, required: ["baseColor"],
          properties: {
            name: { type: "string" },
            style: { type: "string", enum: ["light", "standard", "heavy", "quad"] },
            kit: { type: "string", enum: ["none", "antenna", "cannon", "shield"] },
            baseColor: { type: "string", description: "#rrggbb 몸 색" },
            glowColor: { type: "string", description: "#rrggbb 눈·광학부 발광색" },
            accentColor: { type: "string", description: "#rrggbb 관절·문양 포인트 색" },
          },
        },
      },
    },
  },
  invalidArgsExample: { name: "설원 병기대", characters: [{ name: "정찰기", style: "light", kit: "antenna", baseColor: "#5c708c" }, { name: "중장기", style: "heavy", kit: "cannon", baseColor: "#3c3e4a", glowColor: "#ff963c" }] },
  async prepare(args): Promise<void> {
    try {
      const { id, specs } = parse(args);
      prepared.set(id, { dataUrl: await encodePng(drawMechSheet(specs)) });
    } catch (error) {
      try { prepared.set(parse(args).id, { error: error instanceof Error ? error.message : String(error) }); } catch { /* run 이 같은 검증으로 낸다 */ }
    }
  },
  run(draft, args): ToolExecResult {
    const { id, name, names } = parse(args);
    const made = prepared.get(id);
    if (!made?.dataUrl) throw new ToolError(`캐릭터셋을 만들지 못했습니다${made?.error ? `: ${made.error}` : ""}.`, { code: "charset-failed" });
    draft.assets.uploaded[id] = { id, name, kind: "charset", dataUrl: made.dataUrl, meta: { width: 288, height: 256 } } as never;
    return {
      summary: `걷는 캐릭터셋 '${name}'(${id}) ${names.length}명 등록: ${names.map((n, i) => `${i}=${n}`).join(", ")}. script_cutscene_staged actors[].character:{resourceId:"${id}", characterIndex:N} 로 쓰세요.`,
      data: { resourceId: id, characters: names.map((n, i) => ({ name: n, characterIndex: i })) },
    };
  },
};

export const MECH_CHARSET_TOOLS: readonly ToolDefinition[] = [authorActorCharset];
