import { decodeCharsetFrameIndex } from "@/assets/easyrpgRtp";
import { reconcileFaceWithCharset } from "@/assets/reviewedCharsetFaces";
import { nestedCommandLists } from "@/project/authoredCommandIndex";
import { resolveEventAppearanceGraphic } from "@/project/characterAppearances";
import type { Command, EventPage, Project } from "@/project/types";

export interface FaceMatchRepairResult {
  /** 고친 배우 얼굴 수. */
  readonly actors: number;
  /** 고친(바꾸거나 뺀) NPC 대화 얼굴 수. */
  readonly eventFaces: number;
}

/**
 * 저장본의 얼굴을 걷기 그림의 **검토된 짝**(공용 대응표)에 맞춘다. 로드 때 돈다(store·헤드리스 정규화).
 *
 * 배경(2026-09-28 전수 조사, 프로젝트 337곳): 배우 얼굴 3,085건 중 2,602건, NPC 대화 얼굴 1,520건 중 442건이
 * 걷기 그림과 다른 인물이었다. 옛 기본값("이름이 같은 시트가 짝")과 옛 도구 추정("어느 시트든 People1 같은 번호")이
 * 만든 것이다. 사용자 결정: 불러올 때 짝과 다르면 전부 자동 교정.
 *
 * 규칙은 reconcileFaceWithCharset 하나다 — 짝이 있으면 짝으로, 대응표가 "얼굴 없음" 이면 얼굴을 뺀다.
 * 대응표가 모르는 그림(업로드 차셋)이나 번들이 아닌 얼굴(업로드·생성 초상·표정 세트)은 건드리지 않는다.
 *
 * NPC 는 **페이지의 첫 얼굴만** 본다. 그 얼굴이 이 NPC 자신의 얼굴이다. 뒤따르는 얼굴은 컷신이 다른 화자로
 * 바꾼 것일 수 있어 걷기 그림과 비교할 근거가 없다.
 */
export function repairFaceMatches(project: Project): FaceMatchRepairResult {
  let actors = 0;
  for (const actor of project.database.actors) {
    if (!actor.faceResourceId || !actor.characterResourceId || actor.appearanceId) continue;
    const reconciled = reconcileFaceWithCharset(actor.faceResourceId, actor.characterResourceId, actor.characterIndex ?? 0);
    if (reconciled.faceResourceId === actor.faceResourceId) continue;
    if (reconciled.faceResourceId === null) delete actor.faceResourceId;
    else actor.faceResourceId = reconciled.faceResourceId;
    actors += 1;
  }
  let eventFaces = 0;
  for (const map of Object.values(project.maps)) {
    for (const event of map.events) {
      for (const page of event.pages ?? []) {
        if (repairPageFace(project, page)) eventFaces += 1;
      }
    }
  }
  return { actors, eventFaces };
}

function repairPageFace(project: Project, page: EventPage): boolean {
  const graphic = page.graphic ? resolveEventAppearanceGraphic(project, page.graphic) : undefined;
  const sprite = graphic && !graphic.transparent ? graphic.sprite : undefined;
  if (!sprite || sprite.type !== "bundled" || !sprite.id) return false;
  const found = firstFace(page.commands);
  if (!found || !found.command.resourceId || found.command.appearanceId) return false;
  const characterIndex = decodeCharsetFrameIndex(graphic!.pattern ?? 0).characterIndex;
  const reconciled = reconcileFaceWithCharset(found.command.resourceId, sprite.id, characterIndex);
  if (reconciled.faceResourceId === found.command.resourceId) return false;
  if (reconciled.faceResourceId === null) found.list.splice(found.index, 1);
  else found.list[found.index] = { ...found.command, resourceId: reconciled.faceResourceId };
  return true;
}

type FaceCommand = Extract<Command, { kind: "changeFace" }>;

/** 실행 순서상 첫 changeFace. 분기 안도 본다(전투 승리 뒤 대사 등). */
function firstFace(commands: Command[]): { readonly list: Command[]; readonly index: number; readonly command: FaceCommand } | undefined {
  for (let index = 0; index < commands.length; index += 1) {
    const command = commands[index]!;
    if (command.kind === "changeFace") return { list: commands, index, command };
    for (const branch of nestedCommandLists(command)) {
      const nested = firstFace(branch as Command[]);
      if (nested) return nested;
    }
  }
  return undefined;
}

