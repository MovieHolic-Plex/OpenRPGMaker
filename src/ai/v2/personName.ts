// 청사진 단계 이벤트 이름이 사람인가 — 「엘라 교수」「사서」「주모」「포졸」이 그림 없는 반짝이 칸으로 지어졌다(2026-10-28 standin
// joseon·magic). 사람이면 공용 캐릭터 칩에서 결정적으로 하나 골라 붙인다(pickPersonGraphic — place_npc 와 같은 고르기).
// 직함·호칭 낱말로만 판정한다(이름 낱말만으로는 사물과 구별이 안 된다). 석상·초상화처럼 사람 모양 사물은 사람이 아니다.
import { charsetFrameIndex } from "@/assets/easyrpgRtp";
import type { GameMap, Project } from "@/project/types";
import { pickPersonGraphic } from "./people";

const PERSON = /교수|선생|스승|사서|교장|학장|촌장|이장|주모|주인장?$|상인|점원|직원|포졸|포교|종사관|사또|대감|도령|아씨|나리|소녀|소년|노인|할머니|할아버지|아이$|박사|형사|경찰|기사$|병사|경비|문지기|파수꾼|왕$|여왕|공주|왕자|마법사|마녀|사제|신부|수녀|의사|간호|선원|선장|어부|농부|대장장이|여관|학생|친구|엄마|아빠|어머니|아버지|누나|언니|오빠|동생|부인|관장|라이벌|챔피언|트레이너|탐정|집사|하녀|시녀|하인|청년|아가씨|아저씨|아주머니|님$|씨$|professor|librarian|teacher|guard|merchant|priest|doctor|captain|innkeeper|villager|girl|boy|man$|woman$/iu;
const NOT_PERSON = /석상|동상|조각|초상|그림|액자|인형|유령|해골|시체|무덤|비석|흔적|편지|일지|일기|쪽지|책상|상자|궤짝|문$|statue|portrait|ghost/iu;

export const isPersonName = (name: string | undefined): boolean => !!name && PERSON.test(name.trim()) && !NOT_PERSON.test(name);

/** 사람 이름 이벤트에 붙일 칩 그림(아래를 본 서 있는 자세). 못 고르면 undefined. */
export function personGraphicFor(project: Project, map: GameMap, name: string): { graphic: Record<string, unknown>; label: string } | undefined {
  const pick = pickPersonGraphic(project, map, name, undefined);
  if (!pick) return undefined;
  return {
    graphic: { sprite: { type: "bundled", id: pick.textureKey }, direction: "down", pattern: charsetFrameIndex({ characterIndex: pick.characterIndex, direction: "down", pattern: 1 }) },
    label: pick.label,
  };
}
