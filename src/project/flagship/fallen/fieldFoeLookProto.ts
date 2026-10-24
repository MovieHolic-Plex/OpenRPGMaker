// 필드 적 모습 비교 프로토타입(개발 서버 전용) — `player.html?demo=fallen-star&fieldFoeLook=<base|a|b|c|d>`.
// 숲 어귀(fs_forest_edge) 필드 적의 그림을 변형 시트로 바꾸고, 같은 화면에 거미·도깨비불·멧돼지를 제자리로 세운다.
// 출하 빌드에는 실리지 않는다(exportEntry 의 import.meta.env.DEV 분기에서만 import). 시트 원본: scripts/content/field-foes/.
import type { EventPageGraphic, GameEvent, Project } from "@/project/types";
import { charsetFrameIndex } from "@/assets/easyrpgRtp";
import { FIELD_FOE_LOOK_SHEETS } from "./fieldFoeLookProtoSheets";

const MAP = "fs_forest_edge";
const SPECIES = ["wolf-grey", "spider-cave", "wisp-blue", "boar-tusk"] as const;
const STAGED: readonly (readonly [string, number, number, number, "left" | "right"])[] = [
  ["spider", 1, 13, 20, "right"], ["wisp", 2, 22, 17, "left"], ["boar", 3, 14, 16, "right"],
];

export function applyFieldFoeLook(project: Project, variant: string): void {
  const map = project.maps[MAP];
  if (!map) return;
  const sheet = FIELD_FOE_LOOK_SHEETS[variant];
  const charsetId = `oprn-proto-field-foes-${variant}`;
  if (sheet) {
    project.assets.uploaded[charsetId] = {
      id: charsetId, name: `field foe prototype ${variant}`, kind: "charset", dataUrl: sheet,
      meta: { width: 288, height: 256, frameWidth: 24, frameHeight: 32 },
    } as Project["assets"]["uploaded"][string];
  }
  const graphic = (slot: number, direction: "left" | "right" | "down"): EventPageGraphic => sheet
    ? { sprite: { type: "uploaded", id: charsetId }, direction, pattern: charsetFrameIndex({ characterIndex: variant === "c" ? 0 : slot, direction, pattern: 1 }) }
    : { sprite: { type: "bundled", id: `generated-enemy-${SPECIES[slot]}` }, direction: "down", pattern: 0 };
  const foes = map.events.filter((event) => event.id.includes("_foe"));
  for (const event of foes) {
    const slot = JSON.stringify(event.pages[0]?.graphic ?? {}).includes("spider") ? 1 : 0;
    for (const page of event.pages) {
      if (!page.graphic?.sprite) continue;
      page.graphic = graphic(slot, "down");
      if (sheet) page.animationType = "step";
    }
  }
  const template = foes[0];
  if (!template?.pages[0]) return;
  for (const [name, slot, x, y, facing] of STAGED) {
    const page = { ...structuredClone(template.pages[0]), id: `ev_${MAP}_stage_${name}_p`, trigger: { kind: "action" as const }, commands: [], graphic: graphic(slot, facing) };
    delete (page as { movement?: unknown }).movement;
    if (sheet) page.animationType = "step";
    const staged: GameEvent = { ...structuredClone(template), id: `ev_${MAP}_stage_${name}`, x, y, trigger: { kind: "action" }, pages: [page] };
    map.events.push(staged);
  }
}
