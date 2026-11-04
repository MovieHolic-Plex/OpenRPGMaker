/**
 * 『폴른 스타』 월드 정비(2026-11-04 사용자 플레이 메모) — 마을 간판·이정표, 재료 조합 공방, 서브 퀘스트 둘, 2막 보급 상인.
 * 실내 축소는 fallenTownInteriors.ts 가 interiors.ts 의 덮어쓰기로 짓는다(이 단계보다 앞).
 * chronoBell.ts 에서 마을 수납·잔 일(townLife·townQuests) 뒤, 2막 여는 비트(act2Opening) 뒤에 한 번 부른다.
 */
import type { Project } from "@/project/types";
import { type Exec, mustMap } from "./common";
import { placeSnowMerchant } from "./act2Merchant";
import { placeExamines } from "./examine";
import { noticeBoard, odenVenomQuest, sideQuestJournal, tobiKiteQuest } from "./sideQuests";
import { doorOf, hangShopSigns, placeNoticeBoard, plantSignpost } from "./signage";
import { FS_WORKSHOP_ID, buildWorkshop, linkWorkshopDoor, workshopExit } from "./workshop";

export const FS_WORKSHOP_DOOR = { x: 36, y: 42 } as const;

export interface FallenWorldPassIds { readonly hub: string; readonly forestEdge: string; readonly snowRoad: string }

export function applyFallenWorldPassTown(project: Project, exec: Exec): void {
  buildWorkshop(project, exec);
}

/**
 * 공방 문은 2막 여는 비트 뒤에 잇는다 — 통금의 밤 등 걸기(act2Opening Q4)는 「실내로 이어진 잠긴 문」이 꼭 셋이길 바라고,
 * 그 맵은 낮 광장을 복제한 뒤라 밤에는 공방이 그대로 잠긴 집이다.
 */
export function applyFallenWorldPass(project: Project, exec: Exec, ids: FallenWorldPassIds): void {
  const hub = mustMap(project, ids.hub);
  const lockedId = `ev_fs_locked_${FS_WORKSHOP_DOOR.x}_${FS_WORKSHOP_DOOR.y}`;
  if (!hub.events.some((e) => e.id === lockedId)) throw new Error(`[fallen-world] 공방 자리 ${lockedId} 가 잠긴 문이 아니다`);
  hub.events = hub.events.filter((e) => e.id !== lockedId);
  linkWorkshopDoor(project, exec, ids.hub, FS_WORKSHOP_DOOR, workshopExit(project));
  if (!doorOf(mustMap(project, ids.hub), FS_WORKSHOP_ID)) throw new Error("[fallen-world] 공방 문이 이어지지 않았다");
  hangShopSigns(project, ids.hub, [
    { mapId: "fs_smithy", title: "로한의 대장간", line: "검·창·갑옷·방패. 손질도 한다." },
    { mapId: FS_WORKSHOP_ID, title: "니나의 재료 공방", line: "숲에서 주운 재료로 약과 병을 만들어 드립니다." },
    { mapId: "fs_inn", title: "별빛 여관", line: "하룻밤 묵고 가세요. 지친 몸이 다 낫습니다." },
    { mapId: "fs_apothecary", title: "오든 약방", line: "회복약·해독초·약초. 사고팝니다." },
    { mapId: "fs_bakery_home", title: "토마네 빵집", line: "갓 구운 빵. 먹으면 힘이 납니다." },
  ]);
  plantSignpost(project, ids.hub, { x: 24, y: 35 }, [
    "광장 이정표다.",
    "↓ 남쪽 거리: 로한의 대장간 · 니나의 재료 공방\n→ 동쪽: 별빛 여관 · 초소   ← 서쪽: 오든 약방",
    "↖ 북서쪽: 토마네 빵집   ↑ 북쪽 성문: 속삭이는 숲\n천문대는 운하 건너 서쪽 탑.",
  ]);
  placeNoticeBoard(project, ids.hub, { x: 39, y: 32 });
  noticeBoard(project, ids.hub, { x: 39, y: 33 });
  odenVenomQuest(project);
  tobiKiteQuest(project, ids.forestEdge, { x: 11, y: 31 });
  sideQuestJournal(project);
  placeSnowMerchant(project, ids.snowRoad, { x: 20, y: 35 }, { x: 19, y: 38 });
  placeExamines(project);
}
