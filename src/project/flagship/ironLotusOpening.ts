/**
 * 『강호의 철련』 오프닝 — 청죽림·사원·유하진 배경 위에 설린과 야율검.
 * 배경은 scripts/content/iron-lotus-art.mjs 가 찍은 그림이다.
 */
import type { AnimaticLayer, OpeningAnimatic } from "@/project/openingAnimatic";
import { validateOpeningAnimatic } from "@/project/openingAnimatic";
import type { Project } from "@/project/types";
import { IL_BACKDROP_BAMBOO_ID, IL_BACKDROP_TEMPLE_ID, IL_BACKDROP_TOWN_ID, IL_SEOLRIN_CHARSET_ID } from "./ironLotusArt";

const STAGE = { width: 480, height: 270 };
const PAPER = "#f3e6c8";
const GOLD = "#e8c878";

type Layer = AnimaticLayer;

function plate(id: string, resourceId: string): Layer {
  return {
    id, kind: "image", role: "background", resourceId, sampling: "nearest",
    x: 0, y: 0, width: STAGE.width, height: STAGE.height, anchorX: 0, anchorY: 0,
  };
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

/** 설린 칩 0번, 아래를 보는 가운데 칸. 은발·청록 바이저. */
function seolrin(x: number): Layer {
  return {
    id: "seolrin", kind: "image", role: "actor", characterRole: "hero",
    resourceId: IL_SEOLRIN_CHARSET_ID, sampling: "nearest",
    crop: { x: 24, y: 0, width: 24, height: 32 },
    x, y: 132, width: 96, height: 128,
  };
}

function hunter(x: number): Layer {
  const index = 2;
  const fw = 24;
  const fh = 32;
  return {
    id: "hunter", kind: "image", role: "actor", characterRole: "knight",
    resourceId: "easyrpg-charset-actor3", sampling: "nearest",
    crop: { x: (index % 4) * fw * 3 + fw, y: Math.floor(index / 4) * fh * 4, width: fw, height: fh },
    x, y: 128, width: 96, height: 128,
  };
}

export function buildIronLotusOpening(project: Project): void {
  const shots: readonly { id: string; ms: number; composition: OpeningAnimatic }[] = [
    {
      id: "il_op_fall", ms: 7000,
      composition: {
        width: STAGE.width, height: STAGE.height, background: "#071410", letterbox: 0.1,
        camera: { keys: { x: [{ atMs: 0, value: 200 }, { atMs: 7000, value: 280, ease: "ease-in-out" }], zoom: [{ atMs: 0, value: 1.05 }, { atMs: 7000, value: 1.18, ease: "ease-out" }] } },
        layers: [
          plate("sky", "oprn-pano-night"),
          { id: "bamboo", kind: "image", role: "background", resourceId: IL_BACKDROP_BAMBOO_ID, sampling: "nearest", x: 0, y: 78, width: 480, height: 192, anchorX: 0, anchorY: 0, parallax: 0.35 },
          { id: "dust", kind: "particles", role: "effect", color: "#d8ffe8", opacity: 0.45, x: 0, y: 40, width: 480, height: 180, particles: { preset: "dust", count: 28, seed: 4, speed: 8, size: 1 } },
          { id: "streak", kind: "shape", shape: "rect", role: "effect", color: "#f4fbff", x: 300, y: 36, width: 120, height: 3, rotation: 28, opacity: 0.9 },
          { id: "pod", kind: "shape", shape: "ellipse", role: "prop", color: "#e7eef4", x: 196, y: 78, width: 72, height: 22 },
          { id: "seam", kind: "glow", role: "effect", color: "#9ef0ff", x: 210, y: 78, width: 44, height: 16, glow: { inner: 0.45, pulse: { hz: 1.2, amount: 0.3, pattern: "flicker", seed: 2 } } },
          caption("운무산 위. 별이 아니라, 은빛 고치가 청죽림으로 떨어진다."),
        ],
      },
    },
    {
      id: "il_op_crash", ms: 6000,
      composition: {
        width: STAGE.width, height: STAGE.height, background: "#102418", letterbox: 0.1,
        layers: [
          plate("bamboo", IL_BACKDROP_BAMBOO_ID),
          { id: "pod", kind: "shape", shape: "ellipse", role: "prop", color: "#d5dee8", x: 188, y: 150, width: 88, height: 26 },
          { id: "seam", kind: "glow", role: "effect", color: "#9ef0ff", x: 206, y: 152, width: 52, height: 16, glow: { inner: 0.5, pulse: { hz: 1.1, amount: 0.25, pattern: "flicker" } } },
          caption("대숲이 갈라지고, 고치가 흙길에 반쯤 박힌다."),
        ],
      },
    },
    {
      id: "il_op_boot", ms: 7000,
      composition: {
        width: STAGE.width, height: STAGE.height, background: "#101820", letterbox: 0.1,
        layers: [
          plate("bamboo", IL_BACKDROP_BAMBOO_ID),
          seolrin(192),
          { id: "halo", kind: "glow", role: "effect", color: "#b7fff2", x: 176, y: 108, width: 120, height: 80, opacity: 0.35, glow: { inner: 0.2, pulse: { hz: 0.7, amount: 0.15 } } },
          titleText("수신. 현지 언어, 미확인.", 28, 20, PAPER),
          caption("고치에서 눈을 뜬 기계 소녀. 이름은 설린."),
        ],
      },
    },
    {
      id: "il_op_hunter", ms: 6500,
      composition: {
        width: STAGE.width, height: STAGE.height, background: "#14080c", letterbox: 0.1,
        layers: [
          plate("temple", IL_BACKDROP_TEMPLE_ID),
          hunter(300),
          titleText("흑련사 포고", 36, 22, GOLD),
          titleText("쇳덩이는 우리 몫.", 72, 16, PAPER),
          caption("집사 야율검이 유하진에 포고를 붙인다."),
        ],
      },
    },
    {
      id: "il_op_master", ms: 6000,
      composition: {
        width: STAGE.width, height: STAGE.height, background: "#1a1428", letterbox: 0.1,
        layers: [
          plate("town", IL_BACKDROP_TOWN_ID),
          titleText("저 아이는 물건이 아니다.", 78, 22, PAPER),
          titleText("— 청죽문 장문 소청하", 118, 16, GOLD),
          caption("해 질 녘 유하진. 여관 마루에서 누군가 편을 든다."),
        ],
      },
    },
    {
      id: "il_op_title", ms: 7000,
      composition: {
        width: STAGE.width, height: STAGE.height, background: "#1a1428", letterbox: 0.08,
        layers: [
          plate("town", IL_BACKDROP_TOWN_ID),
          titleText("강호의 철련", 88, 36, GOLD),
          titleText("Iron Lotus of the Jianghu", 138, 16, PAPER),
          titleText("제1막", 172, 14, "#9ef0ff"),
        ],
      },
    },
  ];
  project.system.opening = {
    enabled: true,
    skippable: true,
    musicResourceId: "cc0-bgm-rtp-flt-002",
    scenes: shots.map(({ id, composition, ms }) => {
      validateOpeningAnimatic(composition, ms, `opening.${id}`);
      return { id, kind: "animatic" as const, composition, durationMs: ms, narration: "" };
    }),
  };
}
