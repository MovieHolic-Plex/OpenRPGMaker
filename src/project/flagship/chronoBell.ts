import { charsetFrameIndex } from "@/assets/easyrpgRtp";
import { canMove, isPassable } from "@/project/collision";
import { createBlankProject } from "@/project/defaults";
import { DEFAULT_ACTOR_ID } from "@/project/defaults/constants";
import { deserialize, serialize } from "@/project/io";
import type { AnimaticLayer } from "@/project/openingAnimatic";
import type { Command, EventPage, GameEvent, GameMap, Project } from "@/project/types";
import { runTool } from "@/editor/tools/toolRunner";
import "@/editor/tools/toolRegistry";
import { FLAGSHIP_BEAT_MANIFESTS } from "./beats";
import type { FlagshipDemoBuildResult } from "./types";

function execTool(project: Project, name: string, args: Record<string, unknown>): void {
  const ctx = { project, assistantRun: false };
  const res = runTool(ctx, name, args, { dryRun: false });
  if (!res.ok) {
    throw new Error(`[chrono-bell] ${name} failed: ${res.summary} ${JSON.stringify(res.issues ?? [])}`);
  }
  Object.assign(project, ctx.project);
}

function findAdjacentWalkable(
  project: Project,
  map: GameMap,
  origin: { readonly x: number; readonly y: number },
  avoid: ReadonlySet<string>,
): { readonly x: number; readonly y: number } {
  const dirs = [
    [0, 0],
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
    [1, -1],
    [-1, -1],
    [1, 1],
    [-1, 1],
    [0, -2],
    [2, 0],
  ] as const;
  for (const [dx, dy] of dirs) {
    const x = origin.x + dx;
    const y = origin.y + dy;
    const k = `${x},${y}`;
    if (x < 1 || y < 1 || x >= map.width - 1 || y >= map.height - 1) continue;
    if (avoid.has(k)) continue;
    if (!isPassable(project, map, x, y)) continue;
    if (map.events.some((e) => e.x === x && e.y === y)) continue;
    return { x, y };
  }
  return { x: origin.x, y: Math.max(1, origin.y - 1) };
}

const FALLEN_STAR_TEXT_REPLACEMENTS: ReadonlyArray<readonly [string, string]> = [
  ["벨하임 마을 · 천년제 광장", "왕도 아스텔 · 별빛 성채 광장"],
  ["벨하임 왕성 알현실", "왕립 천문대 · 성좌 홀"],
  ["중세 벨하임 · 안개 묘지 언덕", "속삭이는 마법숲 · 별빛 안개 언덕"],
  ["대성당 예배당", "왕립 천문대 · 성좌 오르간 관측실"],
  ["마왕성 지하 성채", "심문관의 지하 봉인 성채"],
  ["아리아 돔 크레이터", "속삭이는 마법숲 · 별의 추락지 크레이터"],
  ["지하 로봇 공장", "추락한 별의 방주 · 태엽 코어실"],
  ["화산 협곡 · 용암 폭포", "방주의 성소 · 붉은 마력 협곡"],
  ["고대 용의 소굴 용암 동굴", "방주의 성소 · 심문관의 마도 거신 제단"],
  ["화산석 부락", "성소 외곽 · 별지기 야영지"],
  ["아스트라 왕궁 · 하늘 신전", "고대 성좌 유적 · 태엽의 회랑"],
  ["검은 날개 선착장", "고대 성좌 유적 · 별의 방주 선착장"],
  ["해저신전", "성좌 유적 심층 · 방주 기억 성소"],
  ["설원 광산 마을 벨른", "북방 성좌령 · 별빛 광산 마을"],
  ["벨른 마석 광산", "성좌석 광산 · 푸른 결정 갱도"],
  ["가르디아 성 지하 보물고 비밀 레버", "아스텔 왕립 천문대 지하 서고 비밀 레버"],
  ["피가로 기관실 모래 잠항 밸브", "아스텔 마도 기관실 동력 밸브"],
  ["케프카의 탑 진실의 보물상자 수수께끼", "심문관의 탑 진실의 성좌 상자 수수께끼"],
  ["천년제 텔레포드 시연대", "별의 방주 공명 신호기"],
  ["천년제 기념 메달", "아스텔 성좌 공명장"],
  ["성검 에테르리온", "성좌검 아스트랄리온"],
  ["에너트론 회복 캡슐", "별의 방주 동면 회복 포드"],
  ["에너트론", "방주 동면 코어"],
  ["아리아 돔", "별의 추락지 크레이터"],
  ["텔레포드", "별의 방주 공명기"],
  ["천년제", "별빛 성좌제"],
  ["벨하임", "왕도 아스텔"],
  ["가르디아", "아스텔"],
  ["피가로", "아스텔"],
  ["라보스", "마도 거신 아스칼"],
  ["케프카", "심문관 발렌"],
  ["마구스", "심문관 발렌"],
  ["크로노", "카엘"],
  ["하람", "카엘"],
  ["마르", "이리스"],
  ["세린", "이리스"],
  ["에이라", "이리스"],
  ["티나", "이리스"],
  ["루카", "엘레나"],
  ["토우", "엘레나"],
  ["개굴경 바르도", "아이기스-07"],
  ["기계병 노바", "아이기스-07"],
  ["프로그", "아이기스-07"],
  ["로보", "아이기스-07"],
  ["로크", "카엘"],
  ["매쉬", "로건"],
  ["나크타르", "심문관 발렌"],
];

function replaceFallenStarLoreDeep(value: unknown): void {
  if (Array.isArray(value)) {
    value.forEach(replaceFallenStarLoreDeep);
    return;
  }
  if (!value || typeof value !== "object") return;
  const rec = value as Record<string, unknown>;
  for (const [k, v] of Object.entries(rec)) {
    if (typeof v === "string") {
      let next = v;
      for (const [from, to] of FALLEN_STAR_TEXT_REPLACEMENTS) {
        if (next.includes(from)) next = next.split(from).join(to);
      }
      rec[k] = next;
    } else {
      replaceFallenStarLoreDeep(v);
    }
  }
}

interface OpeningActorSpec {
  readonly id: string;
  readonly charsetResourceId: string;
  readonly characterIndex: number;
  readonly role: "hero" | "mage" | "knight" | "villager" | "monster" | "crowd";
  readonly direction: "down" | "left" | "right" | "up";
  readonly x: number;
  readonly y: number;
  readonly fromX?: number;
  readonly toX?: number;
  readonly durationMs?: number;
}

interface OpeningEmoteSpec {
  readonly id: string;
  readonly targetLayerId: string;
  readonly preset: "exclaim" | "question" | "ellipsis" | "heart" | "sweat";
  readonly startMs: number;
  readonly endMs: number;
}

interface OpeningShotSpec {
  readonly id: string;
  readonly bg: string;
  readonly caption: string;
  readonly transition?: { readonly kind: "fade" | "dither" | "flash"; readonly durationMs: number; readonly color?: string };
  readonly actors: readonly OpeningActorSpec[];
  readonly emotes?: readonly OpeningEmoteSpec[];
  readonly lightKind: "shaft" | "glow";
  readonly lightColor: string;
  readonly lightX: number;
  readonly lightY: number;
  readonly lightW: number;
  readonly lightH: number;
  readonly lightRotation?: number;
  readonly lightOpacity: number;
  readonly particlePreset: "stars" | "sparks" | "dust" | "snow";
  readonly particleColor: string;
  readonly fallingStar?: boolean;
  readonly cameraShake?: boolean;
}

function buildFallenStarOpening(project: Project): void {
  project.system.opening = { enabled: true, skippable: true, scenes: [] };

  const shots: readonly OpeningShotSpec[] = [
    {
      id: "cb_shot_1",
      bg: "oprn-still-kingdom-day",
      caption: "마법 왕국 아스텔 — 별지기 기사 카엘과 마도학자 엘레나가 천문대를 지키던 밤.",
      actors: [
        {
          id: "kael",
          charsetResourceId: "easyrpg-charset-actor1",
          characterIndex: 0,
          role: "hero",
          direction: "right",
          x: 72,
          y: 118,
          fromX: 64,
          toX: 144,
          durationMs: 4200,
        },
        {
          id: "elena",
          charsetResourceId: "oprn-charset-heroes1",
          characterIndex: 2,
          role: "mage",
          direction: "left",
          x: 248,
          y: 118,
          fromX: 256,
          toX: 208,
          durationMs: 4200,
        },
        {
          id: "astel_guard",
          charsetResourceId: "easyrpg-charset-actor4",
          characterIndex: 1,
          role: "knight",
          direction: "left",
          x: 308,
          y: 116,
        },
      ],
      emotes: [
        { id: "elena_emote", targetLayerId: "elena", preset: "ellipsis", startMs: 400, endMs: 8000 },
      ],
      lightKind: "shaft",
      lightColor: "#ffe9b0",
      lightX: 168,
      lightY: 28,
      lightW: 88,
      lightH: 152,
      lightRotation: 18,
      lightOpacity: 0.38,
      particlePreset: "stars",
      particleColor: "#fff3b0",
    },
    {
      id: "cb_shot_2",
      bg: "oprn-still-manor-night",
      caption: "왕립 천문대 관측실 — 밤하늘을 가르며 청록빛 『별의 방주』가 추락했다!",
      transition: { kind: "fade", durationMs: 220, color: "#080c18" },
      actors: [
        {
          id: "falling_star_ark",
          charsetResourceId: "easyrpg-charset-vehicles",
          characterIndex: 7,
          role: "mage",
          direction: "left",
          x: 240,
          y: 44,
          fromX: 292,
          toX: 172,
          durationMs: 5500,
        },
        {
          id: "kael",
          charsetResourceId: "easyrpg-charset-actor1",
          characterIndex: 0,
          role: "hero",
          direction: "up",
          x: 132,
          y: 118,
          fromX: 120,
          toX: 148,
          durationMs: 5500,
        },
        {
          id: "elena",
          charsetResourceId: "oprn-charset-heroes1",
          characterIndex: 2,
          role: "mage",
          direction: "up",
          x: 208,
          y: 118,
          fromX: 224,
          toX: 196,
          durationMs: 5500,
        },
      ],
      emotes: [
        { id: "kael_alert", targetLayerId: "kael", preset: "exclaim", startMs: 300, endMs: 8000 },
        { id: "elena_alert", targetLayerId: "elena", preset: "exclaim", startMs: 450, endMs: 8000 },
      ],
      lightKind: "shaft",
      lightColor: "#64f0ff",
      lightX: 184,
      lightY: 24,
      lightW: 84,
      lightH: 156,
      lightRotation: -28,
      lightOpacity: 0.52,
      particlePreset: "sparks",
      particleColor: "#72f2ff",
      fallingStar: true,
      cameraShake: true,
    },
    {
      id: "cb_shot_3",
      bg: "oprn-still-snow-village",
      caption: "속삭이는 마법숲 깊은 곳 — 푸른 마력 크레이터 한가운데서 고대 방주가 열렸다.",
      transition: { kind: "flash", durationMs: 200, color: "#d8f8ff" },
      actors: [
        {
          id: "ark_core_pod",
          charsetResourceId: "easyrpg-charset-vehicles",
          characterIndex: 7,
          role: "mage",
          direction: "down",
          x: 184,
          y: 112,
        },
        {
          id: "aegis_guard",
          charsetResourceId: "oprn-charset-heroes1",
          characterIndex: 3,
          role: "knight",
          direction: "left",
          x: 244,
          y: 116,
        },
        {
          id: "kael",
          charsetResourceId: "easyrpg-charset-actor1",
          characterIndex: 0,
          role: "hero",
          direction: "right",
          x: 64,
          y: 118,
          fromX: 52,
          toX: 124,
          durationMs: 5500,
        },
        {
          id: "elena",
          charsetResourceId: "oprn-charset-heroes1",
          characterIndex: 2,
          role: "mage",
          direction: "right",
          x: 16,
          y: 119,
          fromX: 12,
          toX: 76,
          durationMs: 5500,
        },
      ],
      emotes: [
        { id: "aegis_signal", targetLayerId: "aegis_guard", preset: "ellipsis", startMs: 350, endMs: 8000 },
      ],
      lightKind: "glow",
      lightColor: "#4ce4ff",
      lightX: 156,
      lightY: 82,
      lightW: 116,
      lightH: 98,
      lightOpacity: 0.48,
      particlePreset: "sparks",
      particleColor: "#80f0ff",
    },
    {
      id: "cb_shot_4",
      bg: "oprn-still-desert-ruin",
      caption: "『내 이름은 이리스… 추락한 별의 안드로이드. 천상의 귀환 좌표를 찾고 있어.』",
      transition: { kind: "fade", durationMs: 220, color: "#0b1320" },
      actors: [
        {
          id: "iris",
          charsetResourceId: "oprn-charset-heroes1",
          characterIndex: 5,
          role: "mage",
          direction: "left",
          x: 224,
          y: 116,
          fromX: 236,
          toX: 196,
          durationMs: 5500,
        },
        {
          id: "aegis",
          charsetResourceId: "oprn-charset-heroes1",
          characterIndex: 3,
          role: "knight",
          direction: "left",
          x: 264,
          y: 118,
        },
        {
          id: "kael",
          charsetResourceId: "easyrpg-charset-actor1",
          characterIndex: 0,
          role: "hero",
          direction: "right",
          x: 96,
          y: 118,
          fromX: 88,
          toX: 144,
          durationMs: 5500,
        },
        {
          id: "elena",
          charsetResourceId: "oprn-charset-heroes1",
          characterIndex: 2,
          role: "mage",
          direction: "right",
          x: 44,
          y: 119,
        },
      ],
      emotes: [
        { id: "iris_awaken", targetLayerId: "iris", preset: "ellipsis", startMs: 300, endMs: 8000 },
        { id: "kael_vow", targetLayerId: "kael", preset: "exclaim", startMs: 500, endMs: 8000 },
      ],
      lightKind: "glow",
      lightColor: "#88ecff",
      lightX: 168,
      lightY: 78,
      lightW: 112,
      lightH: 108,
      lightOpacity: 0.46,
      particlePreset: "stars",
      particleColor: "#b8f4ff",
    },
    {
      id: "cb_shot_5",
      bg: "oprn-still-dark-citadel",
      caption: "그러나 별의 동력원을 노리는 성좌 심문관 발렌과 마도 거신이 숲을 포위했다!",
      transition: { kind: "flash", durationMs: 240, color: "#ffd6e0" },
      actors: [
        {
          id: "valen",
          charsetResourceId: "oprn-charset-heroes1",
          characterIndex: 6,
          role: "knight",
          direction: "left",
          x: 264,
          y: 116,
          fromX: 276,
          toX: 220,
          durationMs: 4100,
        },
        {
          id: "inquisitor_knight",
          charsetResourceId: "easyrpg-charset-actor3",
          characterIndex: 0,
          role: "knight",
          direction: "left",
          x: 316,
          y: 118,
          fromX: 324,
          toX: 276,
          durationMs: 4100,
        },
        {
          id: "kael",
          charsetResourceId: "easyrpg-charset-actor1",
          characterIndex: 0,
          role: "hero",
          direction: "right",
          x: 112,
          y: 118,
        },
        {
          id: "iris",
          charsetResourceId: "oprn-charset-heroes1",
          characterIndex: 5,
          role: "mage",
          direction: "right",
          x: 60,
          y: 118,
        },
      ],
      emotes: [
        { id: "valen_order", targetLayerId: "valen", preset: "exclaim", startMs: 350, endMs: 8000 },
      ],
      lightKind: "shaft",
      lightColor: "#ff5c8a",
      lightX: 212,
      lightY: 28,
      lightW: 84,
      lightH: 152,
      lightRotation: -18,
      lightOpacity: 0.42,
      particlePreset: "sparks",
      particleColor: "#ff7597",
    },
    {
      id: "cb_shot_6",
      bg: "oprn-still-farm-golden",
      caption: "추락한 별의 성녀 이리스를 고향 하늘로 돌려보내기 위한 약속 — 『폴른 스타』 제1막!",
      transition: { kind: "fade", durationMs: 220, color: "#0b0e14" },
      actors: [
        {
          id: "kael",
          charsetResourceId: "easyrpg-charset-actor1",
          characterIndex: 0,
          role: "hero",
          direction: "right",
          x: 136,
          y: 118,
          fromX: 120,
          toX: 192,
          durationMs: 4200,
        },
        {
          id: "iris",
          charsetResourceId: "oprn-charset-heroes1",
          characterIndex: 5,
          role: "mage",
          direction: "right",
          x: 184,
          y: 116,
          fromX: 168,
          toX: 240,
          durationMs: 4200,
        },
        {
          id: "elena",
          charsetResourceId: "oprn-charset-heroes1",
          characterIndex: 2,
          role: "mage",
          direction: "right",
          x: 84,
          y: 119,
          fromX: 72,
          toX: 144,
          durationMs: 4200,
        },
        {
          id: "aegis",
          charsetResourceId: "oprn-charset-heroes1",
          characterIndex: 3,
          role: "knight",
          direction: "right",
          x: 32,
          y: 118,
          fromX: 24,
          toX: 96,
          durationMs: 4200,
        },
      ],
      emotes: [
        { id: "iris_promise", targetLayerId: "iris", preset: "heart", startMs: 350, endMs: 8000 },
      ],
      lightKind: "glow",
      lightColor: "#ffd166",
      lightX: 156,
      lightY: 62,
      lightW: 132,
      lightH: 112,
      lightOpacity: 0.44,
      particlePreset: "stars",
      particleColor: "#fff3b0",
    },
  ];

  for (const [idx, s] of shots.entries()) {
    execTool(project, "create_opening_animatic_shot", {
      shotId: s.id,
      durationMs: 8500,
      width: 384,
      height: 216,
      background: s.bg,
      narration: "",
      replace: true,
      clearLayers: true,
    });
    // Clear pixelGrid so the renderer does not posterize the backdrop into 44 colors or freeze camera pans
    execTool(project, "set_opening_pixel_grid", {
      shotId: s.id,
    });
    if (idx === 0) {
      const sc = project.system.opening?.scenes[0];
      if (sc?.kind === "animatic") delete sc.composition.transition;
    } else if (s.transition) {
      execTool(project, "set_opening_transition", {
        shotId: s.id,
        transition: s.transition,
        letterbox: 0.14,
      });
    }
    execTool(project, "place_opening_background", {
      shotId: s.id,
      layerId: "bg",
      resourceId: s.bg,
    });

    // Atmospheric light FX (never opaque — we tune layer opacity right after)
    execTool(project, "upsert_opening_light_fx", {
      shotId: s.id,
      layerId: "light_fx",
      kind: s.lightKind,
      x: s.lightX,
      y: s.lightY,
      width: s.lightW,
      height: s.lightH,
      ...(s.lightRotation !== undefined ? { rotation: s.lightRotation } : {}),
      color: s.lightColor,
      blend: "lighter",
      ...(s.lightKind === "shaft"
        ? {
            spread: 0.68,
            softness: 0.82,
            dust: { count: 22, seed: idx + 5, speed: 18, size: 1.5 },
            pulse: { hz: 0.65, amount: 0.22, pattern: "pulse", seed: idx + 1 },
          }
        : { inner: 0.28, pulse: { hz: 0.6, amount: 0.25, pattern: "pulse", seed: idx + 1 } }),
    });

    if (s.fallingStar) {
      execTool(project, "upsert_opening_light_fx", {
        shotId: s.id,
        layerId: "falling_star_orb",
        kind: "glow",
        x: 280,
        y: 28,
        width: 52,
        height: 52,
        color: "#a8f8ff",
        blend: "lighter",
        inner: 0.38,
        pulse: { hz: 1.4, amount: 0.3, pattern: "pulse", seed: 9 },
      });
      execTool(project, "animate_opening_layer", {
        shotId: s.id,
        layerId: "falling_star_orb",
        keys: {
          x: [
            { atMs: 0, value: 284, ease: "linear" },
            { atMs: 3800, value: 152, ease: "ease-out" },
          ],
          y: [
            { atMs: 0, value: 26, ease: "linear" },
            { atMs: 3800, value: 94, ease: "ease-in" },
          ],
        },
      });
    }

    // Place 2x scale (48x64) foreground CharSet actors at proper ground plane
    for (const actor of s.actors) {
      execTool(project, "place_opening_charset_actor", {
        shotId: s.id,
        layerId: actor.id,
        charsetResourceId: actor.charsetResourceId,
        characterIndex: actor.characterIndex,
        characterRole: actor.role,
        direction: actor.direction,
        scale: 2,
        x: actor.x,
        y: actor.y,
        ...(actor.fromX !== undefined ? { fromX: actor.fromX } : {}),
        ...(actor.toX !== undefined ? { toX: actor.toX } : {}),
        ...(actor.durationMs !== undefined ? { durationMs: actor.durationMs } : {}),
        stride: 16,
      });
    }

    // Floating starlight / mana particles
    const particleLayer: AnimaticLayer = {
      id: "starlight_particles",
      kind: "particles",
      role: "effect",
      x: 0,
      y: 24,
      width: 384,
      height: 160,
      color: s.particleColor,
      opacity: 0.8,
      blend: "lighter",
      particles: {
        preset: s.particlePreset,
        count: 28,
        seed: idx * 7 + 11,
        speed: s.particlePreset === "sparks" ? 34 : 14,
        size: 1.5,
      },
    };
    execTool(project, "upsert_opening_layer", {
      shotId: s.id,
      layer: particleLayer,
    });

    // Emote bubbles above key actors
    for (const em of s.emotes ?? []) {
      execTool(project, "upsert_opening_emote", {
        shotId: s.id,
        layerId: em.id,
        preset: em.preset,
        targetLayerId: em.targetLayerId,
        width: 20,
        height: 22,
        startMs: em.startMs,
        endMs: em.endMs,
        popMs: 160,
        outMs: 160,
      });
    }

    // Camera pan & zoom
    execTool(project, "animate_opening_camera", {
      shotId: s.id,
      camera: {
        x: 192,
        y: 108,
        zoom: 1.03,
        keys: {
          x: [
            { atMs: 0, value: 188, ease: "ease-out" },
            { atMs: 4500, value: 196, ease: "ease-in-out" },
          ],
          y: [
            { atMs: 0, value: 112, ease: "ease-out" },
            { atMs: 4500, value: 104, ease: "ease-in-out" },
          ],
          zoom: [
            { atMs: 0, value: 1.02, ease: "linear" },
            { atMs: 4500, value: 1.08, ease: "ease-out" },
          ],
        },
        ...(s.cameraShake
          ? { shake: { atMs: 1100, durationMs: 850, amplitude: 3, frequency: 12, seed: 2 } }
          : {}),
      },
    });

    // Single clean caption track inside the bottom letterbox bar
    execTool(project, "set_opening_caption", {
      shotId: s.id,
      layerId: "caption",
      letterbox: 0.14,
      fontSize: 12,
      color: "#fff0dc",
      cues: [{ atMs: 120, text: s.caption, typewriterMs: 420 }],
    });

    // Tune light_fx opacity so it blends atmospherically over the backdrop
    const shotScene = project.system.opening?.scenes.find((sc) => sc.id === s.id);
    if (shotScene?.kind === "animatic") {
      const lfx = shotScene.composition.layers.find((l) => l.id === "light_fx");
      if (lfx) lfx.opacity = s.lightOpacity;
      const orb = shotScene.composition.layers.find((l) => l.id === "falling_star_orb");
      if (orb) orb.opacity = 0.72;
    }
  }
}

export function createChronoBellFlagshipDemo(): FlagshipDemoBuildResult {
  const project = createBlankProject();
  const initialBlankMapIds = Object.keys(project.maps);

  project.meta.title = "폴른 스타: 추락한 별과 태엽의 성녀";
  project.meta.author = "OPRN Flagship Studio";
  project.system.playResolution = { width: 480, height: 270 };
  project.system.cameraZoom = 2;
  project.system.dialogueStyle = "pixel-cinematic";

  const hero = project.database.actors.find((a) => a.id === DEFAULT_ACTOR_ID) ?? project.database.actors[0];
  if (hero) {
    hero.name = "카엘";
    hero.nickname = "왕립 천문대의 별지기 기사";
    hero.initialLevel = 15;
    hero.characterResourceId = "easyrpg-charset-actor1";
    hero.characterIndex = 0;
  }

  execTool(project, "set_title_screen", {
    title: "폴른 스타: 추락한 별과 태엽의 성녀",
    backgroundResourceId: "oprn-still-kingdom-day",
    logoStyle: "gold",
  });
  if (project.system.titleScreen) {
    project.system.titleScreen.logoSubtitle = "Fallen Star — 추락한 별과 태엽의 마도 인형 · 제1막";
  }

  buildFallenStarOpening(project);

  // Build the canonical chapters across the Kingdom of Astel, Royal Observatory, Starfall Crater, Astral Ruins, and Sanctuary
  execTool(project, "author_jrpg_chapter", { chapter: "ct_truce_fair", seed: 7 });
  const hubMapId = "ct_truce_fair_hub";
  execTool(project, "author_jrpg_chapter", { chapter: "ct_middle_ages", seed: 7, timeGateFrom: hubMapId });
  execTool(project, "author_jrpg_chapter", { chapter: "ff6_narshe", seed: 7, timeGateFrom: hubMapId });
  execTool(project, "author_jrpg_chapter", { chapter: "ff6_zozo_kefka", seed: 7, timeGateFrom: hubMapId });
  execTool(project, "author_jrpg_chapter", { chapter: "ct_future", seed: 7, timeGateFrom: hubMapId });
  execTool(project, "author_jrpg_chapter", { chapter: "ct_prehistory", seed: 7, timeGateFrom: hubMapId });
  execTool(project, "author_jrpg_chapter", { chapter: "ct_zeal", seed: 7, timeGateFrom: hubMapId });

  // Remap all chapter lore, map names, NPC names, and quest text to Fallen Star (폴른 스타) Act 1
  replaceFallenStarLoreDeep(project.maps);
  replaceFallenStarLoreDeep(project.quests);
  replaceFallenStarLoreDeep(project.database.items);

  // Update companion actors to Fallen Star cast (Iris, Elena, Aegis-07, Logan)
  const actorCustomizations: Readonly<
    Record<
      string,
      {
        readonly name: string;
        readonly nickname: string;
        readonly charsetId: string;
        readonly index: number;
        readonly battleCharacterResourceId: string;
      }
    >
  > = {
    actor_ct_truce_fair_marle: {
      name: "이리스",
      nickname: "추락한 별의 태엽 안드로이드 성녀",
      charsetId: "oprn-charset-heroes1",
      index: 5,
      battleCharacterResourceId: "charset-battler-actor4-6",
    },
    actor_ct_truce_fair_lucca: {
      name: "엘레나",
      nickname: "왕도 아스텔의 성좌 마도학자",
      charsetId: "oprn-charset-heroes1",
      index: 2,
      battleCharacterResourceId: "charset-battler-actor1-5",
    },
    actor_ct_middle_ages_frog: {
      name: "아이기스-07",
      nickname: "별의 방주 수호 오토마톤",
      charsetId: "oprn-charset-heroes1",
      index: 3,
      battleCharacterResourceId: "party-pixel-monster5-6",
    },
    actor_ff6_zozo_kefka_sabin: {
      name: "로건",
      nickname: "아스텔 성채 수호단장",
      charsetId: "easyrpg-charset-actor4",
      index: 1,
      battleCharacterResourceId: "charset-battler-actor4-5",
    },
  };
  for (const actor of project.database.actors) {
    const spec = actorCustomizations[actor.id];
    if (spec) {
      actor.name = spec.name;
      actor.nickname = spec.nickname;
      actor.characterResourceId = spec.charsetId;
      actor.characterIndex = spec.index;
      actor.battleCharacterResourceId = spec.battleCharacterResourceId;
    }
    actor.initialLevel = Math.max(actor.initialLevel ?? 1, 15);
  }

  // Define the two canonical Act 1 endings of Fallen Star
  execTool(project, "define_ending", {
    id: "end_chrono_bell_true",
    name: "폴른 스타 제1막 완결 — 부서진 별에서 피어난 태엽의 약속",
    conditions: [],
    epilogue: [
      {
        kind: "say",
        speaker: "이리스",
        text: "심문관 발렌의 마도 거신이 멈추고, 내 태엽 코어에 천상 방주의 첫 번째 귀환 좌표가 복원됐어… 고마워, 카엘!",
      },
      {
        kind: "say",
        speaker: "엘레나",
        text: "이 성좌 좌표는 왕국 북방의 천공 첨탑을 가리키고 있어. 이리스가 고향 별로 돌아갈 여정은 이제부터가 진짜 시작이야!",
      },
      {
        kind: "say",
        speaker: "아이기스-07",
        text: "삐빅— 방주 코어 동력 42% 회복 완료. 수호 프로토콜에 따라 이리스 님과 카엘 님의 제2막 귀환 여정을 끝까지 호위합니다.",
      },
    ],
  });
  execTool(project, "define_ending", {
    id: "end_chrono_bell_epoch",
    name: "별빛 성좌의 날개 — 제2막 천공의 첨탑을 향하여",
    conditions: [],
    epilogue: [
      {
        kind: "say",
        speaker: "엘레나",
        text: "추락한 별의 방주 날개가 다시 마력을 되찾고 있어! 저 구름 너머 성좌의 바다로 나아가자!",
      },
      {
        kind: "say",
        speaker: "이리스",
        text: "내 태엽 심장이 뛰는 한, 카엘과 함께한 이 별의 기억을 절대 잊지 않을게!",
      },
    ],
  });

  const hub = project.maps[hubMapId];
  if (!hub) throw new Error("[chrono-bell] Missing ct_truce_fair_hub");

  // Place player in the Royal Capital Astel Plaza on a passable cell with open neighbors
  const hubSpawn = { x: Math.floor(hub.width / 2), y: Math.floor(hub.height / 2) };
  let startPos = hubSpawn;
  for (let r = 0; r < 16; r++) {
    let found: { x: number; y: number } | undefined;
    for (let dy = -r; dy <= r && !found; dy++) {
      for (let dx = -r; dx <= r && !found; dx++) {
        const cx = hubSpawn.x + dx;
        const cy = hubSpawn.y + dy;
        if (cx < 2 || cy < 2 || cx >= hub.width - 2 || cy >= hub.height - 2) continue;
        if (!isPassable(project, hub, cx, cy)) continue;
        if (hub.events.some((e) => Math.abs(e.x - cx) + Math.abs(e.y - cy) <= 1)) continue;
        if (canMove(project, hub, cx, cy, cx, cy - 1) && canMove(project, hub, cx, cy, cx + 1, cy)) {
          found = { x: cx, y: cy };
        }
      }
    }
    if (found) {
      startPos = found;
      break;
    }
  }
  project.startMapId = hubMapId;
  project.startPos = startPos;

  // Remove untouched initial blank seed map so every map in the project is a real authored flagship map
  for (const blankId of initialBlankMapIds) {
    if (blankId !== hubMapId && project.maps[blankId]) {
      delete project.maps[blankId];
    }
  }
  for (const map of Object.values(project.maps)) {
    for (const ev of map.events) {
      if (ev.trigger.kind === "auto") {
        ev.trigger = { kind: "action" };
      }
      for (const page of ev.pages ?? []) {
        if (page.trigger.kind === "auto") {
          page.trigger = { kind: "action" };
        }
      }
    }
  }
  project.mapTree = {
    mapId: hubMapId,
    children: Object.keys(project.maps)
      .filter((id) => id !== hubMapId)
      .map((mapId) => ({ mapId, children: [] })),
  };

  // Ensure switches for our flagship interactive showcase events
  const ensureSw = (id: string, name: string): void => {
    if (!project.switches.some((s) => s.id === id)) project.switches.push({ id, name });
  };
  ensureSw("sw_chrono_bell_rung", "별의 방주 신호기 공명 완료");
  ensureSw("sw_chrono_party_joined", "이리스·엘레나·아이기스-07 합류 완료");
  ensureSw("sw_chrono_sword_restored", "천상 귀환 좌표 제1장 복원");
  ensureSw("sw_chrono_final_won", "성좌 심문관 발렌 & 마도 거신 격파");

  // Rename and tune boss enemies so 9-cell animations and skills play out briskly
  for (const enemy of project.database.enemies) {
    if (enemy.id.includes("zozo_kefka_boss") || enemy.id.includes("middle_ages_boss")) {
      enemy.name = "성좌 심문관 발렌 & 마도 거신";
    } else if (enemy.id.includes("prehistory_boss")) {
      enemy.name = "방주의 수호 거신 아스칼";
    }
    if (enemy.id.includes("boss")) {
      enemy.stats = {
        ...enemy.stats,
        maxHp: 35,
        attack: 6,
        defense: 2,
        mind: 5,
        agility: 5,
      };
    }
  }
  for (const troop of project.database.troops) {
    if (troop.id.includes("zozo_kefka_boss") || troop.id.includes("middle_ages_boss")) {
      troop.name = "성좌 심문관 발렌 & 마도 거신";
    } else if (troop.id.includes("prehistory_boss")) {
      troop.name = "방주의 수호 거신 아스칼";
    }
  }

  const avoid = new Set<string>([`${startPos.x},${startPos.y}`]);

  // 1) North of spawn: Android Saintess Iris & Star Ark Resonance Tablet (2-step choice puzzle + changeTile + party joins 이리스·엘레나·아이기스-07·로건)
  const bellPos = { x: startPos.x, y: startPos.y - 1 };
  avoid.add(`${bellPos.x},${bellPos.y}`);
  const curTile = hub.lowerTiles[bellPos.y * hub.width + bellPos.x] ?? 0;
  const altFloorTile =
    hub.lowerTiles.find((t, idx) => t >= 0 && t !== curTile && isPassable(project, hub, idx % hub.width, Math.floor(idx / hub.width))) ?? curTile;

  const joinActorIds = ["actor_ct_truce_fair_marle", "actor_ct_truce_fair_lucca", "actor_ct_middle_ages_frog"].filter(
    (aid) => project.database.actors.some((a) => a.id === aid),
  );
  const joinCommands: Command[] = joinActorIds.map((actorId) => ({
    kind: "changeParty",
    actorId,
    action: "add",
  }));

  const bellEvent: GameEvent = {
    id: "ev_chrono_bell_seal",
    name: "태엽의 성녀 이리스 & 별의 방주 공명 석판",
    x: bellPos.x,
    y: bellPos.y,
    trigger: { kind: "action" },
    commands: [],
    pages: [
      {
        id: "ev_chrono_bell_seal_p1",
        name: "귀환 좌표 복원 전",
        conditions: [],
        graphic: {
          sprite: { type: "bundled", id: "tex_oprn_charset_heroes1" },
          direction: "down",
          pattern: charsetFrameIndex({ characterIndex: 5, direction: "down", pattern: 1 }),
          transparent: false,
        },
        movement: { type: "fixed", speed: 3, frequency: 3 },
        priority: "same",
        overlapForbidden: true,
        trigger: { kind: "action" },
        commands: [
          {
            kind: "text",
            speaker: "이리스",
            body: "카엘… 내 태엽 코어가 왕도 아스텔의 『성좌 공명 석판』과 반응해! 추락한 별의 귀환 좌표를 깨워 보자!",
          },
          {
            kind: "text",
            speaker: "엘레나",
            body: "먼저 방주 신호기를 울려 성좌 마력을 모은 뒤, 이리스의 태엽 코어 주파수를 천상 파장에 동기화하면 바닥의 비밀 문양이 열릴 거야!",
          },
          {
            kind: "choices",
            prompt: "1단계 — 추락한 별의 방주 신호기를 어떻게 울릴까?",
            options: [
              {
                text: "별지기 기사의 성좌 마력을 담아 힘껏 울린다",
                branch: [
                  { kind: "playAudio", resourceId: "easyrpg-sound-bell", loop: false, channel: "se" },
                  {
                    kind: "text",
                    speaker: "엘레나",
                    body: "청아한 성좌의 종소리가 아스텔 광장 전체에 울려 퍼졌어! 이제 이리스의 태엽 코어 공명 파장을 맞춰 봐!",
                  },
                  {
                    kind: "choices",
                    prompt: "2단계 — 안드로이드 이리스의 태엽 코어 파장을 어디에 맞출까?",
                    options: [
                      {
                        text: "천상 방주의 청록빛 귀환 파장 (정밀 동기화)",
                        branch: [
                          { kind: "changeTile", mapId: hubMapId, layer: "lower", x: bellPos.x, y: bellPos.y, tile: altFloorTile },
                          ...joinCommands,
                          { kind: "changeItem", itemId: "item_lava_flint", op: "+=", amount: 1 },
                          { kind: "changeItem", itemId: "item_zozo_clock_key", op: "+=", amount: 1 },
                          { kind: "setSwitch", switchId: "sw_chrono_bell_rung", value: true },
                          { kind: "setSwitch", switchId: "sw_chrono_party_joined", value: true },
                          { kind: "setSwitch", switchId: "sw_chrono_sword_restored", value: true },
                          {
                            kind: "text",
                            speaker: "이리스",
                            body: "바닥 석판이 청록빛으로 열리며 귀환 좌표가 기록됐어! 태엽 성녀 『이리스』·마도학자 『엘레나』·수호 로봇 『아이기스-07』이 파티에 합류했다!",
                          },
                        ],
                      },
                      {
                        text: "과부하 최대 출력",
                        branch: [{ kind: "text", speaker: "엘레나", body: "마력 파장이 너무 거세서 태엽 코어가 흔들려! 다시 정밀하게 맞춰 보자." }],
                      },
                    ],
                  },
                ],
              },
              {
                text: "살살 건드린다",
                branch: [{ kind: "text", speaker: "이리스", body: "신호기 파장이 약해서 방주 코어에 닿지 않아. 성좌 마력을 담아 울려 보자!" }],
              },
            ],
          },
        ],
      },
      {
        id: "ev_chrono_bell_seal_p2",
        name: "귀환 좌표 복원 완료",
        conditions: [{ kind: "switch", switchId: "sw_chrono_bell_rung", value: true }],
        graphic: {
          sprite: { type: "bundled", id: "tex_oprn_charset_heroes1" },
          direction: "down",
          pattern: charsetFrameIndex({ characterIndex: 5, direction: "down", pattern: 1 }),
          transparent: false,
        },
        movement: { type: "fixed", speed: 3, frequency: 3 },
        priority: "same",
        overlapForbidden: true,
        trigger: { kind: "action" },
        commands: [
          {
            kind: "text",
            speaker: "이리스",
            body: "카엘, 엘레나, 아이기스-07… 모두 고마워! 바로 오른쪽의 『성좌의 회랑 관문』을 조사하면 제1막의 핵심 지역과 심문관 발렌 결전으로 이동할 수 있어!",
          },
        ],
      },
    ],
  };
  hub.events.push(bellEvent);

  // 2) East of spawn: Astral Gate Nexus & Act 1 Climax Boss Battle (`성좌 심문관 발렌 & 마도 거신` -> `방주의 수호 거신 아스칼`) + Ending
  const nexusPos = findAdjacentWalkable(project, hub, { x: startPos.x + 1, y: startPos.y }, avoid);
  avoid.add(`${nexusPos.x},${nexusPos.y}`);

  // 2b) Northwest of spawn: Clockwork Automaton Aegis-07 (`oprn-charset-heroes1` index 3) standing visibly in the plaza
  const aegisPos = findAdjacentWalkable(project, hub, { x: startPos.x - 1, y: startPos.y - 1 }, avoid);
  avoid.add(`${aegisPos.x},${aegisPos.y}`);
  hub.events.push({
    id: "ev_fallen_star_aegis",
    name: "방주 수호 오토마톤 아이기스-07",
    x: aegisPos.x,
    y: aegisPos.y,
    trigger: { kind: "action" },
    commands: [],
    pages: [
      {
        id: "ev_fallen_star_aegis_p1",
        name: "아이기스-07 대기",
        conditions: [],
        graphic: {
          sprite: { type: "bundled", id: "tex_oprn_charset_heroes1" },
          direction: "down",
          pattern: charsetFrameIndex({ characterIndex: 3, direction: "down", pattern: 1 }),
          transparent: false,
        },
        movement: { type: "fixed", speed: 3, frequency: 3 },
        priority: "same",
        overlapForbidden: true,
        trigger: { kind: "action" },
        commands: [
          {
            kind: "text",
            speaker: "아이기스-07",
            body: "삐빅— 천상 방주 호위기 『아이기스-07』 가동 중. 추락 충격으로 손상된 이리스 님의 귀환 좌표를 복구하기 위해 별지기 기사 카엘 님을 보좌합니다.",
          },
        ],
      },
    ],
  });
  const demonLordTroopId =
    project.database.troops.find((t) => t.id === "troop_ff6_zozo_kefka_boss")?.id ??
    project.database.troops.find((t) => t.id === "troop_ct_middle_ages_boss")?.id ??
    project.database.troops[0]!.id;
  const dragonRedTroopId =
    project.database.troops.find((t) => t.id === "troop_ct_prehistory_boss")?.id ??
    demonLordTroopId;

  const chapelMap = project.maps["ct_middle_ages_chapel"];
  const futureMap = project.maps["ct_future_hub"];
  const volcanoMap = project.maps["ct_prehistory_canyon"];

  // Also place Android Iris & Automaton Aegis-07 right beside the Star Ark Pod in the Starfall Crater (`ct_future_hub`) for visual richness
  if (futureMap) {
    const craterCenter = { x: Math.floor(futureMap.width / 2), y: Math.floor(futureMap.height / 2) };
    const craterAvoid = new Set<string>([`${craterCenter.x},${craterCenter.y}`]);
    for (const ev of futureMap.events) craterAvoid.add(`${ev.x},${ev.y}`);
    const irisCraterPos = findAdjacentWalkable(project, futureMap, { x: craterCenter.x - 1, y: craterCenter.y }, craterAvoid);
    craterAvoid.add(`${irisCraterPos.x},${irisCraterPos.y}`);
    futureMap.events.push({
      id: "ev_crater_iris_memory",
      name: "추락한 별의 방주 · 이리스의 기억 잔향",
      x: irisCraterPos.x,
      y: irisCraterPos.y,
      trigger: { kind: "action" },
      commands: [],
      pages: [
        {
          id: "ev_crater_iris_memory_p1",
          name: "방주 크레이터 조사",
          conditions: [],
          graphic: {
            sprite: { type: "bundled", id: "tex_oprn_charset_heroes1" },
            direction: "down",
            pattern: charsetFrameIndex({ characterIndex: 5, direction: "down", pattern: 1 }),
            transparent: false,
          },
          movement: { type: "fixed", speed: 3, frequency: 3 },
          priority: "same",
          overlapForbidden: true,
          trigger: { kind: "action" },
          commands: [
            {
              kind: "text",
              speaker: "이리스",
              body: "여기가 내가 타고 온 『별의 방주』가 추락한 크레이터야… 옆의 동면 포드를 조사하면 마력을 완전히 회복할 수 있어.",
            },
          ],
        },
      ],
    });
  }

  const nexusPage: EventPage = {
    id: "ev_chrono_era_gate_p1",
    name: "성좌의 회랑 관문",
    conditions: [],
    graphic: {
      sprite: { type: "bundled", id: "tex_oprn_charset_heroes1" },
      direction: "left",
      pattern: charsetFrameIndex({ characterIndex: 2, direction: "left", pattern: 1 }),
      transparent: false,
    },
    movement: { type: "fixed", speed: 3, frequency: 3 },
    priority: "same",
    overlapForbidden: true,
    trigger: { kind: "action" },
    commands: [
      {
        kind: "text",
        speaker: "엘레나",
        body: "별의 방주와 연결된 『성좌의 회랑』이 열렸어! 제1막의 어느 지역이나 심문관 발렌 결전지로 이동할까?",
      },
      {
        kind: "choices",
        prompt: "폴른 스타 제1막 — 이동할 지역과 결전을 선택하세요",
        options: [
          {
            text: "방주의 성소 · 성좌 심문관 발렌 & 마도 거신 결전 (제1막 보스전 → 엔딩)",
            branch: [
              {
                kind: "text",
                speaker: "성좌 심문관 발렌",
                body: "추락한 별의 태엽 인형 이리스여! 네 심장의 성좌 코어를 왕국 심문회에 바쳐라! 마도 거신이여, 저들을 짓밟아라!",
              },
              {
                kind: "battleProcessing",
                troopId: demonLordTroopId,
                canEscape: true,
                canLose: true,
                branchOnResult: true,
                victoryBranch: [
                  { kind: "setSwitch", switchId: "sw_chrono_final_won", value: true },
                  {
                    kind: "text",
                    speaker: "이리스",
                    body: "해냈어, 카엘! 심문관 발렌의 마도 거신이 무너지고, 내 코어에 천상으로 돌아갈 첫 번째 귀환 좌표가 빛나고 있어!",
                  },
                  {
                    kind: "fork",
                    condition: { kind: "switch", switchId: "sw_chrono_sword_restored", value: true },
                    then: [{ kind: "triggerEnding", endingId: "end_chrono_bell_true" }],
                    else: [{ kind: "triggerEnding", endingId: "end_chrono_bell_epoch" }],
                  },
                ],
                defeatBranch: [
                  { kind: "recoverAll" },
                  {
                    kind: "text",
                    speaker: "이리스",
                    body: "별의 방주 코어가 우리를 다시 일으켜 세웠어! 천상의 귀환 좌표를 향해 날아오르자!",
                  },
                  { kind: "triggerEnding", endingId: "end_chrono_bell_epoch" },
                ],
                escapeBranch: [
                  { kind: "text", speaker: "엘레나", body: "전열을 가다듬고 다시 심문관 발렌에게 맞서자!" },
                ],
              },
            ],
          },
          ...(chapelMap
            ? [
                {
                  text: "왕립 천문대 · 성좌 오르간 관측실 (천구의 파이프 오르간 퍼즐)",
                  branch: [{ kind: "transfer" as const, mapId: chapelMap.id, x: Math.floor(chapelMap.width / 2), y: Math.floor(chapelMap.height / 2) }],
                },
              ]
            : []),
          ...(futureMap
            ? [
                {
                  text: "속삭이는 마법숲 · 별의 추락지 크레이터 (방주 동면 포드 & 이리스 각성지)",
                  branch: [{ kind: "transfer" as const, mapId: futureMap.id, x: Math.floor(futureMap.width / 2), y: Math.floor(futureMap.height / 2) }],
                },
              ]
            : []),
          ...(volcanoMap
            ? [
                {
                  text: "방주의 성소 · 붉은 마력 협곡 (마력 부싯돌 봉인 & 수호 거신 아스칼)",
                  branch: [
                    {
                      kind: "text" as const,
                      speaker: "방주의 수호 거신 아스칼",
                      body: "크르르릉!! 추락한 별의 성소를 넘는 자들이여, 고대 성좌의 불꽃 시험을 받아라!",
                    },
                    {
                      kind: "battleProcessing" as const,
                      troopId: dragonRedTroopId,
                      canEscape: true,
                      canLose: true,
                      branchOnResult: true,
                      victoryBranch: [
                        { kind: "text" as const, speaker: "이리스", body: "수호 거신 아스칼이 우리의 의지를 인정했어! 방주의 성소 심층 길이 열렸어!" },
                        { kind: "transfer" as const, mapId: volcanoMap.id, x: Math.floor(volcanoMap.width / 2), y: Math.floor(volcanoMap.height / 2) },
                      ],
                      defeatBranch: [{ kind: "recoverAll" as const }],
                      escapeBranch: [],
                    },
                  ] satisfies Command[],
                },
              ]
            : []),
          {
            text: "폴른 스타 제1막 완결 — 부서진 별에서 피어난 태엽의 약속 (에필로그)",
            branch: [{ kind: "triggerEnding", endingId: "end_chrono_bell_true" }],
          },
        ],
      },
    ],
  };

  hub.events.push({
    id: "ev_chrono_era_gate",
    name: "엘레나 · 성좌의 회랑 관문 & 심문관 결전",
    x: nexusPos.x,
    y: nexusPos.y,
    trigger: { kind: "action" },
    commands: [],
    pages: [nexusPage],
  });

  const serialized = serialize(project);
  const reloaded = deserialize(serialized);
  const manifest = {
    ...FLAGSHIP_BEAT_MANIFESTS["chrono-bell"],
    mapCount: Object.keys(reloaded.maps).length,
    endingCount: reloaded.endings?.length ?? 0,
  };
  return {
    id: "chrono-bell",
    manifest,
    project: reloaded,
    serialized,
  };
}
