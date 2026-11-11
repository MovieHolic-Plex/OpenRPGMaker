// 요청이 이름 댄 핵심 장치가 게임에 있나 — 낱말 → 프로젝트에서 그 장치를 찾는 표(REQUESTED_FEATURES)와 숨을 곳 없는 추격자.
import { chaserMapsWithoutHiding } from "@/project/chaserHiding";
import type { Project } from "@/project/types";
import { tileAt } from "@/project/collision";
import { Obj, ShipBlocker, allCommands, pages } from "./shipCheckReads";
import { requestedFeatureWord, type RequestedFeatureId } from "../request/readers";

/**
 * 요청이 이름 댄 핵심 장치가 게임에 없다(J71/J73 hf2-mansion: 「쫓아오는 것·어둠」을 요청했는데 추격자 0·조명 0으로 냈다).
 * 장치 → 프로젝트에서 그것을 찾는 표. 요청이 그 장치를 이름 댔나는 request/readers.ts requestedFeatureWord 가 읽는다. 게임을 만드는 요청에서만 막는다.
 */
interface RequestedFeature { readonly id: RequestedFeatureId; readonly label: string; readonly present: (project: Project) => boolean; readonly fix: string }

const DARK_AMBIENT = 0.5;

/** 숨기 이벤트와 그 칸이 눈에 보이는가(이벤트 그림 또는 그 칸의 2층 이상 타일 — 사물함·옷장 가구). */
export function hidingSpots(project: Project): { mapId: string; eventId: string; x: number; y: number; visible: boolean }[] {
  const out: { mapId: string; eventId: string; x: number; y: number; visible: boolean }[] = [];
  for (const map of Object.values(project.maps)) for (const ev of map.events ?? []) {
    const hiding = (ev.pages ?? []).filter((p) => (p.interaction as Obj | undefined)?.kind === "hiding");
    if (!hiding.length) continue;
    const drawn = hiding.some((p) => { const g = (p.graphic ?? {}) as Obj; return !g.transparent && Boolean(g.sprite || g.appearanceId); });
    const cell = tileAt(map, ev.x, ev.y);
    const furniture = cell.upper >= 0 || cell.layers.slice(1).some((t) => t >= 0);
    out.push({ mapId: map.id, eventId: ev.id, x: ev.x, y: ev.y, visible: drawn || furniture });
  }
  return out;
}

export const REQUESTED_FEATURES: readonly RequestedFeature[] = [
  {
    id: "chaser", label: "쫓아오는 추격자",
    present: (project) => pages(project).some((p) => ["chase", "approach"].includes(String((p.movement as Obj | undefined)?.type ?? "")) || !!p.detectionEncounter),
    fix: "make_chase_scene 으로 순찰하다 보면 쫓는 추격자(pursuit·hidingSpots·killOnTouch)를 둔다",
  },
  {
    id: "darkness", label: "어둠(조명)",
    present: (project) => Object.values(project.maps).some((m) => (m.defaultLighting?.ambient ?? 0) >= DARK_AMBIENT)
      || allCommands(project).some(({ cmd }) => cmd.kind === "setLighting" && Number(cmd.ambient) >= DARK_AMBIENT),
    fix: `set_lighting_volume{mapId, ambient:0.8~0.9, sources:[{at:{kind:'player'}, radius:3~4}]} 로 무대 맵을 어둡게 한다(ambient ${DARK_AMBIENT} 미만은 거의 밝다)`,
  },
  {
    id: "hiding", label: "숨을 곳",
    // 보이는 은신처만 센다(J81 hf2-school-claude-j79: 은신처 4곳이 모두 맨바닥의 투명 이벤트라 플레이어가 어디에 숨는지 알 수 없었다).
    present: (project) => hidingSpots(project).some((spot) => spot.visible),
    fix: "사물함·옷장·청소도구함 같은 보이는 물건 칸을 숨을 곳으로 한다 — 그 칸에 가구를 놓고(place_object·draw_object) configure_object_behavior{kind:'hiding'} 또는 make_chase_scene 의 hidingSpots 로 그 칸을 준다. 맨바닥의 투명 은신처는 숨을 곳으로 치지 않는다",
  },
];

/**
 * 추격자가 있는데 그 맵에 숨을 곳(interaction hiding)이 0곳이다(2026-10-29 standin horror 「폐병원」: 순찰·즉사 추격자, 은신처 0).
 * 기획이 «숨기» 를 말하지 않아도 막는다 — 쫓기기만 하고 피할 수단이 없다. 고칠 수 있는 결함: 맵에 있는 옷장·사물함·침대·커튼에 건다.
 */
export function chaserWithoutHiding(project: Project): ShipBlocker[] {
  return chaserMapsWithoutHiding(project).slice(0, 4).map((m): ShipBlocker => ({
    id: "chaser-no-hiding",
    message: `「${m.mapName}」 에 추격자(${m.chaserId})가 있는데 숨을 곳이 0곳이다 — 쫓기면 피할 수단이 없다. 그 맵의 옷장·사물함·침대·커튼 칸을 make_chase_scene 의 hidingSpots 또는 configure_object_behavior{kind:'hiding'} 로 은신처로 한다(순찰 길에서 걸어서 2~14걸음). 그런 가구가 없으면 place_object 로 사물함·옷장을 놓고 그 칸을 준다.`,
    evidence: `${m.mapId} ${m.chaserId}`,
  }));
}

export function requestedFeatureGaps(project: Project, task: string): ShipBlocker[] {
  return REQUESTED_FEATURES.flatMap((f): ShipBlocker[] => {
    const word = requestedFeatureWord(f.id, task);
    return word === undefined || f.present(project) ? [] : [{ id: "requested-feature-missing", message: `요청한 ${f.label}이(가) 게임에 없다 — ${f.fix}.`, evidence: `${f.id}: ${word}` }];
  });
}
