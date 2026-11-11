/**
 * 『강호의 철련』 오프닝 — 480×270 애니매틱 여섯 컷.
 * 새 그림은 없다. 도형·빛·자막과, 이미 있는 기본 캐릭터 칩의 한 칸만 쓴다.
 */
import type { AnimaticLayer, OpeningAnimatic } from "@/project/openingAnimatic";
import { validateOpeningAnimatic } from "@/project/openingAnimatic";
import type { Project } from "@/project/types";

const STAGE = { width: 480, height: 270 };
const INK = "#070b14";
const PAPER = "#f3e6c8";
const GOLD = "#e8c878";

type Layer = AnimaticLayer;

function sky(shade: string): Layer {
  return { id: "sky", kind: "shape", shape: "rect", role: "background", color: shade, x: 0, y: 0, width: STAGE.width, height: STAGE.height };
}

function caption(text: string): Layer {
  return {
    id: "cap", kind: "caption", role: "credit", x: 24, y: 200, width: 432, height: 48, color: PAPER,
    caption: { cues: [{ atMs: 400, text, color: PAPER, typewriterMs: 28 }], safeArea: 0.08, fadeOutMs: 400 },
  };
}

function titleText(text: string, y: number, size: number, color: string): Layer {
  return {
    id: `t-${y}`, kind: "text", role: "credit", text, color, x: 40, y, width: 400, height: size + 16,
    typography: { fontSize: size, weight: 700, align: "center" },
  };
}

/** actor4 #7 — 폴른 스타 이리스와 같은 칸. 은빛 기계 소녀로 이미 쓰인 칩. */
function android(x: number): Layer {
  const index = 7;
  const fw = 24;
  const fh = 32;
  const cellW = fw * 3;
  const cellH = fh * 4;
  return {
    id: "android", kind: "image", role: "actor", characterRole: "hero",
    resourceId: "easyrpg-charset-actor4", sampling: "nearest",
    crop: { x: (index % 4) * cellW + fw, y: Math.floor(index / 4) * cellH, width: fw, height: fh },
    x, y: 150, width: 72, height: 96,
  };
}

function ninja(x: number): Layer {
  const index = 2;
  const fw = 24;
  const fh = 32;
  const cellW = fw * 3;
  const cellH = fh * 4;
  return {
    id: "hunter", kind: "image", role: "actor", characterRole: "knight",
    resourceId: "easyrpg-charset-actor3", sampling: "nearest",
    crop: { x: (index % 4) * cellW + fw, y: Math.floor(index / 4) * cellH, width: fw, height: fh },
    x, y: 148, width: 72, height: 96,
  };
}

const SHOTS: readonly { id: string; ms: number; build: () => OpeningAnimatic }[] = [
  {
    id: "il_op_fall", ms: 7000,
    build: () => ({
      width: STAGE.width, height: STAGE.height, background: INK, letterbox: 0.1,
      layers: [
        sky("#061018"),
        { id: "ridge", kind: "shape", shape: "rect", role: "background", color: "#102018", x: 0, y: 150, width: 480, height: 120 },
        { id: "bamboo-l", kind: "shape", shape: "rect", role: "foreground", color: "#0c2418", x: 28, y: 70, width: 18, height: 170 },
        { id: "bamboo-l2", kind: "shape", shape: "rect", role: "foreground", color: "#143222", x: 58, y: 90, width: 12, height: 150 },
        { id: "bamboo-r", kind: "shape", shape: "rect", role: "foreground", color: "#0c2418", x: 430, y: 60, width: 16, height: 180 },
        { id: "moon", kind: "glow", role: "effect", color: "#d8e8ff", x: 300, y: 16, width: 100, height: 100, opacity: 0.9, glow: { inner: 0.4, pulse: { hz: 0.4, amount: 0.15 } } },
        { id: "streak", kind: "shape", shape: "rect", role: "effect", color: "#f4fbff", x: 340, y: 40, width: 110, height: 4, rotation: 32, opacity: 0.95 },
        { id: "pod", kind: "shape", shape: "ellipse", role: "prop", color: "#e7eef4", x: 188, y: 118, width: 96, height: 36 },
        { id: "seam", kind: "glow", role: "effect", color: "#9ef0ff", x: 206, y: 124, width: 60, height: 22, glow: { inner: 0.45, pulse: { hz: 1.4, amount: 0.35, pattern: "flicker", seed: 2 } } },
        caption("운무산 위. 별이 아니라, 은빛 고치가 떨어진다."),
      ],
    }),
  },
  {
    id: "il_op_crash", ms: 6000,
    build: () => ({
      width: STAGE.width, height: STAGE.height, background: "#102418", letterbox: 0.1,
      layers: [
        sky("#163222"),
        { id: "bamboo-l", kind: "shape", shape: "rect", role: "foreground", color: "#0c2418", x: 36, y: 40, width: 14, height: 190 },
        { id: "bamboo-r", kind: "shape", shape: "rect", role: "foreground", color: "#0c2418", x: 420, y: 28, width: 16, height: 210 },
        { id: "crater", kind: "shape", shape: "ellipse", role: "prop", color: "#3a2a18", x: 150, y: 150, width: 180, height: 48 },
        { id: "pod", kind: "shape", shape: "ellipse", role: "prop", color: "#e7eef4", x: 196, y: 132, width: 88, height: 36 },
        { id: "seam", kind: "glow", role: "effect", color: "#9ef0ff", x: 214, y: 140, width: 52, height: 18, glow: { inner: 0.5, pulse: { hz: 1.2, amount: 0.3, pattern: "flicker" } } },
        caption("청죽림이 갈라지고, 고치가 흙에 반쯤 박힌다."),
      ],
    }),
  },
  {
    id: "il_op_boot", ms: 7000,
    build: () => ({
      width: STAGE.width, height: STAGE.height, background: INK, letterbox: 0.1,
      layers: [
        sky("#101820"),
        android(204),
        { id: "halo", kind: "glow", role: "effect", color: "#b7fff2", x: 196, y: 120, width: 88, height: 88, opacity: 0.45, glow: { inner: 0.2, pulse: { hz: 0.8, amount: 0.2 } } },
        titleText("수신. 현지 언어, 미확인.", 36, 22, PAPER),
        titleText("에너지, 미확인.", 68, 18, "#9ef0ff"),
        caption("고치 안에서 누군가 눈을 뜬다. 이름은 설린."),
      ],
    }),
  },
  {
    id: "il_op_hunter", ms: 6500,
    build: () => ({
      width: STAGE.width, height: STAGE.height, background: "#14080c", letterbox: 0.1,
      layers: [
        sky("#1a0c10"),
        ninja(300),
        { id: "mark", kind: "shape", shape: "rect", role: "prop", color: "#6a1020", x: 40, y: 48, width: 220, height: 120 },
        titleText("흑련사 포고", 64, 22, GOLD),
        titleText("쇳덩이는 우리 몫.", 100, 16, PAPER),
        caption("집사 야율검이 유하진에 포고를 붙인다."),
      ],
    }),
  },
  {
    id: "il_op_master", ms: 6000,
    build: () => ({
      width: STAGE.width, height: STAGE.height, background: "#10160e", letterbox: 0.1,
      layers: [
        sky("#182016"),
        { id: "lantern", kind: "glow", role: "effect", color: "#ffc878", x: 40, y: 36, width: 70, height: 70, glow: { inner: 0.35, pulse: { hz: 0.6, amount: 0.2, pattern: "flicker", seed: 3 } } },
        titleText("저 아이는 물건이 아니다.", 90, 22, PAPER),
        titleText("— 청죽문 장문 소청하", 132, 16, GOLD),
        caption("여관 마루의 등불 아래에서, 누군가는 이미 편을 들었다."),
      ],
    }),
  },
  {
    id: "il_op_title", ms: 7000,
    build: () => ({
      width: STAGE.width, height: STAGE.height, background: INK, letterbox: 0.08,
      layers: [
        sky(INK),
        { id: "moon", kind: "glow", role: "effect", color: "#d0e4ff", x: 176, y: 18, width: 128, height: 128, opacity: 0.35, glow: { inner: 0.45 } },
        titleText("강호의 철련", 96, 36, GOLD),
        titleText("Iron Lotus of the Jianghu", 146, 16, PAPER),
        titleText("제1막", 182, 14, "#9ef0ff"),
      ],
    }),
  },
];

export function buildIronLotusOpening(project: Project): void {
  const scenes = SHOTS.map(({ id, build, ms }) => {
    const composition = build();
    validateOpeningAnimatic(composition, ms, `opening.${id}`);
    return { id, kind: "animatic" as const, composition, durationMs: ms, narration: "" };
  });
  project.system.opening = { enabled: true, skippable: true, scenes, musicResourceId: "cc0-bgm-rtp-flt-002" };
  const timelines = (project.meta as { oprnCinematicTimelines?: { entries?: { target?: string }[] } }).oprnCinematicTimelines;
  if (timelines?.entries) timelines.entries = timelines.entries.filter((entry) => entry.target !== "opening");
}
