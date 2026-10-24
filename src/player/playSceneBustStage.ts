// player/playSceneBustStage.ts
// 흉상 좌우를 맵 위 자리로 정한다(text.bustSide = "stage").
//
// 왜(2026-10-22 『첫사랑』 VQA r20~r22): 흉상 자리를 인물마다 고정(주인공 왼쪽·나머지 오른쪽)하면, 화면에서 서하 왼쪽에 선 사람의
// 흉상이 오른쪽에 떠 «서 있는 자리와 반대»로 읽혔다. 듣는 흉상도 «앞 화자가 남는다» 규칙이라 대화 첫 줄엔 없고 다음 줄부터
// 생겨 장면마다 달랐다. 규칙: 말하는 인물이 듣는 인물보다 왼쪽에 서 있으면 흉상도 왼쪽, 오른쪽이면 오른쪽(같은 열이면 저작한 자리).
// 듣는 인물이 화면에 있으면 그 흉상(마지막으로 말할 때의 흉상, 없으면 text.listenerBust)을 늘 반대편에 흐리게 세운다.
import { lastDialogueStage } from "@/player/playSceneDialogueFacing";
import type { FaceGraphic } from "@/project/types";

type StageLine = { readonly face?: FaceGraphic; readonly bustSide?: "stage"; readonly listenerBust?: string };

const memory = new WeakMap<object, Map<string, FaceGraphic>>();

export function stageBusts(scene: object, line: StageLine): { face?: FaceGraphic; listenerFace?: FaceGraphic; stageListener: true } | null {
  if (line.bustSide !== "stage") return null;
  const st = lastDialogueStage(scene);
  let face = line.face;
  if (face?.resourceId && st?.from && st.to && st.from.x !== st.to.x) {
    face = { ...face, position: st.from.x < st.to.x ? "left" : "right" };
  }
  let mem = memory.get(scene);
  if (!mem) { mem = new Map(); memory.set(scene, mem); }
  if (face?.resourceId && st) mem.set(st.speakerId, face);
  let listenerFace: FaceGraphic | undefined;
  if (face?.resourceId && st?.addresseeId && st.to) {
    const known = mem.get(st.addresseeId);
    const base: FaceGraphic | undefined = known ?? (line.listenerBust ? { resourceId: line.listenerBust, presentation: "bust", position: "left", flipHorizontally: false } : undefined);
    if (base) listenerFace = { ...base, position: face.position === "right" ? "left" : "right" };
  }
  return { ...(face ? { face } : {}), ...(listenerFace ? { listenerFace } : {}), stageListener: true };
}
