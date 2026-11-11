/**
 * 『강호의 철련』 오프닝 — 약 40초.
 * 배경은 구운 맵을 1배로 그린 판(scripts/content/iron-lotus-plates.mts)이다. 폴른 스타의 town-street 와 같은 길.
 * 밤하늘 파노라마·카메라·입자는 폴른 스타 오프닝과 같은 애니메틱 기능이다.
 */
import type { AnimaticKey, AnimaticLayer, OpeningAnimatic } from "@/project/openingAnimatic";
import { validateOpeningAnimatic } from "@/project/openingAnimatic";
import type { Project } from "@/project/types";
import { IL_SEOLRIN_CHARSET_ID } from "./ironLotusArt";
import { IL_PLATE_GROVE_ID, IL_PLATE_TEMPLE_ID, IL_PLATE_TOWN_ID } from "./ironLotusPlates";

const STAGE = { width: 480, height: 270 };
const PAPER = "#fff0dc";
const GOLD = "#e8c878";
const key = (atMs: number, value: number, ease?: AnimaticKey["ease"]): AnimaticKey => (ease ? { atMs, value, ease } : { atMs, value });

type Layer = AnimaticLayer;

function plate(id: string, resourceId: string, y = 0): Layer {
  return {
    id, kind: "image", role: "background", resourceId, sampling: "nearest",
    x: -24, y, width: 528, height: 297, anchorX: 0, anchorY: 0,
  };
}

function caption(text: string, atMs = 500): Layer {
  return {
    id: "cap", kind: "caption", role: "credit", x: 24, y: 200, width: 432, height: 48, color: PAPER,
    caption: { cues: [{ atMs, text, color: PAPER, typewriterMs: 26 }], safeArea: 0.08, fadeOutMs: 500 },
  };
}

function titleText(text: string, y: number, size: number, color: string): Layer {
  return {
    id: `t-${y}`, kind: "text", role: "credit", text, color, x: 40, y, width: 400, height: size + 16,
    typography: { fontSize: size, weight: 700, align: "center" },
  };
}

function seolrin(x: number): Layer {
  return {
    id: "seolrin", kind: "image", role: "actor", characterRole: "hero",
    resourceId: IL_SEOLRIN_CHARSET_ID, sampling: "nearest",
    crop: { x: 24, y: 0, width: 24, height: 32 },
    x, y: 150, width: 72, height: 96,
  };
}

export function buildIronLotusOpening(project: Project): void {
  const shots: readonly { id: string; ms: number; composition: OpeningAnimatic }[] = [
    {
      id: "il_op_fall", ms: 9000,
      composition: {
        width: STAGE.width, height: STAGE.height, background: "#070b18", letterbox: 0.1,
        camera: { keys: { x: [key(0, 210), key(9000, 270, "ease-in-out")], zoom: [key(0, 1.02), key(9000, 1.12, "ease-out")] }, shake: { atMs: 7200, durationMs: 700, amplitude: 4, frequency: 18, seed: 3 } },
        layers: [
          plate("sky", "oprn-pano-night", -20),
          plate("grove", IL_PLATE_GROVE_ID, 40),
          { id: "stars", kind: "particles", role: "effect", color: "#e8f0ff", opacity: 0.7, blend: "lighter", x: 0, y: 0, width: 480, height: 120, particles: { preset: "stars", count: 40, seed: 4, speed: 6, size: 1 } },
          { id: "streak", kind: "shape", shape: "rect", role: "effect", color: "#f4fbff", x: 280, y: 28, width: 140, height: 3, rotation: 24, opacity: 0.95 },
          caption("운무산 위. 별이 아니라, 은빛 고치가 청죽림으로 떨어진다.", 800),
        ],
      },
    },
    {
      id: "il_op_crash", ms: 7500,
      composition: {
        width: STAGE.width, height: STAGE.height, background: "#102418", letterbox: 0.1,
        camera: { keys: { y: [key(0, 150), key(7500, 120, "ease-out")] } },
        layers: [
          plate("grove", IL_PLATE_GROVE_ID),
          { id: "dust", kind: "particles", role: "effect", color: "#d8ffe8", opacity: 0.4, x: 80, y: 80, width: 320, height: 140, particles: { preset: "dust", count: 24, seed: 9, speed: 12, size: 2 } },
          caption("대숲이 갈라지고, 고치가 흙길에 박힌다."),
        ],
      },
    },
    {
      id: "il_op_boot", ms: 8000,
      composition: {
        width: STAGE.width, height: STAGE.height, background: "#101820", letterbox: 0.1,
        camera: { keys: { zoom: [key(0, 1.08), key(8000, 1, "ease-out")] } },
        layers: [
          plate("grove", IL_PLATE_GROVE_ID),
          seolrin(200),
          { id: "halo", kind: "glow", role: "effect", color: "#9ef0ff", x: 188, y: 130, width: 96, height: 80, opacity: 0.45, glow: { inner: 0.3, pulse: { hz: 0.8, amount: 0.2 } } },
          titleText("수신. 현지 언어, 미확인.", 28, 20, PAPER),
          caption("고치에서 눈을 뜬 기계 소녀. 이름은 설린.", 900),
        ],
      },
    },
    {
      id: "il_op_hunter", ms: 7500,
      composition: {
        width: STAGE.width, height: STAGE.height, background: "#140c10", letterbox: 0.1,
        camera: { keys: { x: [key(0, 260), key(7500, 220, "ease-in-out")] } },
        layers: [
          plate("temple", IL_PLATE_TEMPLE_ID),
          titleText("흑련사 포고", 36, 22, GOLD),
          titleText("쇳덩이는 우리 몫.", 72, 16, PAPER),
          caption("집사 야율검이 사원에서 포고를 붙인다."),
        ],
      },
    },
    {
      id: "il_op_master", ms: 7000,
      composition: {
        width: STAGE.width, height: STAGE.height, background: "#1a1428", letterbox: 0.1,
        layers: [
          plate("town", IL_PLATE_TOWN_ID),
          titleText("저 아이는 물건이 아니다.", 78, 22, PAPER),
          titleText("— 청죽문 장문 소청하", 118, 16, GOLD),
          caption("해 질 녘 유하진. 여관 마루에서 누군가 편을 든다."),
        ],
      },
    },
    {
      id: "il_op_title", ms: 8000,
      composition: {
        width: STAGE.width, height: STAGE.height, background: "#1a1428", letterbox: 0.08,
        camera: { keys: { zoom: [key(0, 1.06), key(8000, 1, "ease-out")] } },
        layers: [
          plate("town", IL_PLATE_TOWN_ID),
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
