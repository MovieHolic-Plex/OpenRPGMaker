// 스타팅 몬스터 고르기 흐름(이벤트 명령). 이름만 보고 덜컥 정하지 않도록 한 마리씩 확인한다:
//   고른다 → 앞모습 그림 + 이름·속성·설명 → 「이 몬스터로 하시겠습니까?」 예/아니오 → 예면 받고, 아니오면 처음 고르기로 돌아간다.
// 새 명령 종류는 없다 — 기존 choices·showPicture·gotoLabel 의 조합이라 이벤트 편집기에서 그대로 보이고 고칠 수 있다.
import { monsterDexNote } from "@/project/monsterJournal";
import { withJosa } from "@/util/josa";
import type { Command, Project } from "@/project/types";

export const STARTER_PREVIEW_PICTURE_ID = "starter_preview";
/** 미리보기 카드(테두리 상자 + 풀 받침). 몬스터 그림보다 먼저 띄워 밑에 깔린다. */
export const STARTER_PREVIEW_CARD_PICTURE_ID = "starter_preview_card";
const STARTER_PREVIEW_CARD_RESOURCE_ID = "starter-preview-card";
// 화면(480×320) 오른쪽 위 모서리. 카드 72px·몬스터 64px 둘 다 정수 배율 200% 라 도트가 고르게 커진다(150% 는 줄마다 굵기가 달라 깨져 보였다).
// 가운데에 두면 박사·주인공·탁자를 가렸고(VQA R2-3), 오른쪽 위는 대화 흉상(왼쪽)·선택창(오른쪽 아래)·박사·주인공을 가리지 않는다(왼쪽 위로 두면 흉상이 몬스터 발을 덮었다).
const CARD = { x: 332, y: 2, scale: 200 } as const;
const MONSTER = { x: CARD.x + 8, y: CARD.y + 4, scale: 200 } as const;
const PICK_LABEL = "starter_pick";

export type StarterChoiceInput = {
  readonly speciesIds: readonly string[];
  readonly level?: number;
  readonly prompt?: string;
  /** 받은 뒤 그 종마다 이어 붙일 명령(스위치·아이템·안내 대사). */
  readonly afterGive: (speciesId: string, speciesName: string) => Command[];
  readonly speaker?: string;
  /** 종 설명(없으면 도감 설명). 원정 정의가 아직 없을 때 지을 때 쓴다. */
  readonly notes?: Readonly<Record<string, string | undefined>>;
};

/** 이름·속성 한 장 + 설명 한 장(대화창이 두 줄이라 한 장에 몰지 않는다). */
function speciesInfoPages(project: Project, speciesId: string, override?: string): string[] {
  const species = project.database.monsterSpecies?.find((entry) => entry.id === speciesId);
  const types = (species?.types ?? []).map((id) => project.database.elements?.find((element) => element.id === id)?.name ?? id).join(" / ");
  const note = override ?? monsterDexNote(project, speciesId);
  return [`${species?.name ?? speciesId}${types ? `\n${types} 타입` : ""}`, ...(note ? [note] : [])];
}

export function starterChoiceCommands(project: Project, input: StarterChoiceInput): Command[] {
  const level = input.level ?? 5;
  const options = input.speciesIds.map((speciesId) => {
    const species = project.database.monsterSpecies?.find((entry) => entry.id === speciesId);
    const name = species?.name ?? speciesId;
    const art = species?.graphic.monsterResourceId;
    const erase: Command[] = art
      ? [{ kind: "erasePicture", pictureId: STARTER_PREVIEW_PICTURE_ID }, { kind: "erasePicture", pictureId: STARTER_PREVIEW_CARD_PICTURE_ID }]
      : [];
    const preview: Command[] = art
      ? [
        { kind: "showPicture", pictureId: STARTER_PREVIEW_CARD_PICTURE_ID, resourceId: STARTER_PREVIEW_CARD_RESOURCE_ID, ...CARD, opacity: 255, waitForPicture: false },
        { kind: "showPicture", pictureId: STARTER_PREVIEW_PICTURE_ID, resourceId: art, ...MONSTER, opacity: 255, waitForPicture: false },
      ]
      : [];
    const typeNames = (species?.types ?? []).map((id) => project.database.elements?.find((element) => element.id === id)?.name ?? id).join("/");
    return {
      text: typeNames ? `${name}  ${typeNames}` : name,
      branch: [
        ...preview,
        ...speciesInfoPages(project, speciesId, input.notes?.[speciesId]).map((body): Command => ({ kind: "text", ...(input.speaker ? { speaker: input.speaker } : {}), body })),
        {
          kind: "choices" as const,
          prompt: `${withJosa(name, "을/를")} 첫 동료로 정할까요?`,
          options: [
            { text: "예", branch: [...erase, { kind: "giveMonster", speciesId, level, nickname: name }, ...input.afterGive(speciesId, name)] },
            { text: "아니오", branch: [...erase, { kind: "gotoLabel", name: PICK_LABEL }] },
          ],
          cancelBehavior: "disallow" as const,
        },
      ] satisfies Command[],
    };
  });
  return [
    { kind: "label", name: PICK_LABEL },
    { kind: "choices", prompt: input.prompt ?? "첫 동료를 선택하자", options, cancelBehavior: "disallow" },
  ];
}
