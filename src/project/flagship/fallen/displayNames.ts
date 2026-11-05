// 폴른 스타 · 표시 이름 정비(2026-11-04, 대사 윤문 2차 「명칭」).
//
// 공용 직업 기술·공용 물건을 가져다 쓰면서 영어 외래어 이름(파이어볼·블리자드·엘릭서…)이 중세 판타지 대사 사이에 그대로 떴다.
// 이 게임 안에서만 보이는 이름(name)과 그 이름을 인용한 설명만 바꾼다. id·연출·효과·수치는 그대로다 —
// 전투 연출은 기술 id 로 찾고(resolveSkillChoreography), 세이브는 id 를 들고 있다.
// 빌드 맨 끝(자료집·색인 앞)에서 한 번 부른다. 다른 단계가 같은 레코드를 다시 써도 이 표가 마지막에 이긴다.
import type { Project } from "@/project/types";

/** id → 새 이름. 옛 이름은 설명 글 안의 인용을 함께 고치려고 들고 있다. */
export const FS_DISPLAY_RENAMES: readonly { readonly id: string; readonly from: string; readonly to: string; readonly why: string }[] = [
  { id: "skill_mage_fireball", from: "파이어볼", to: "불덩이", why: "영어 음차. 설명이 이미 「불덩이를 날려」라 한다" },
  { id: "skill_mage_magic_missile", from: "매직 미사일", to: "마력 화살", why: "영어 음차. 「미사일」은 중세 세계에 없는 말" },
  { id: "skill_mage_blizzard", from: "블리자드", to: "얼음 폭풍", why: "영어 음차. 2막 설원의 「눈보라」(지명·대사)와 겹치지 않게" },
  { id: "skill_mage_gravity", from: "그라비티", to: "중력구", why: "영어 음차. 설명의 「검은 중력구」를 이름으로" },
  { id: "skill_mage_mana_shield", from: "마나 실드", to: "마력 방패", why: "영어 음차. 게임 안에서는 늘 「마력」이라 한다(마력약)" },
  { id: "skill_mage_meteor", from: "메테오", to: "별똥비", why: "영어 음차. 별이 떨어지는 이야기라 「별똥」이 맞다" },
  { id: "skill_hero_brave_blade", from: "브레이브 블레이드", to: "빛의 대검", why: "영어 음차. 설명 「빛의 거대한 검」을 줄였다" },
  { id: "skill_dragoon_jump", from: "점프", to: "도약", why: "영어 음차. 새라는 군인 말투" },
  { id: "skill_dragoon_high_jump", from: "하이 점프", to: "큰 도약", why: "영어 음차. 「도약」과 짝" },
  { id: "item_elixir", from: "엘릭서", to: "영약", why: "영어 음차. 「회복약·마력약·만능약」과 같은 결" },
  { id: "equip_gen_halberd_guard", from: "경비 할버드", to: "경비 미늘창", why: "외래 무기명. 다른 창은 「철 창」「별꿰기 창」" },
];

const BY_LENGTH = [...FS_DISPLAY_RENAMES].sort((a, b) => b.from.length - a.from.length);

function swapQuoted(text: string | undefined): string | undefined {
  if (!text) return text;
  let out = text;
  for (const { from, to } of BY_LENGTH) {
    out = out.split(`「${from}」`).join(`「${to}」`);
    if (from.length >= 4) out = out.split(from).join(to);
  }
  return out;
}

export function applyFallenDisplayNames(project: Project): string[] {
  const db = project.database;
  const renamed: string[] = [];
  const pools = [db.skills, db.items, db.equipment] as readonly { id: string; name: string; description?: string }[][];
  for (const { id, to } of FS_DISPLAY_RENAMES) {
    for (const pool of pools) {
      const record = pool.find((r) => r.id === id);
      if (record) { record.name = to; renamed.push(id); }
    }
  }
  for (const pool of pools) for (const record of pool) {
    const next = swapQuoted(record.description);
    if (next !== record.description) record.description = next;
  }
  return renamed;
}
