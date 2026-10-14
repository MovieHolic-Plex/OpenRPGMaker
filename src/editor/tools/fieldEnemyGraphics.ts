// 필드 적의 맵 위 그림 ↔ 전투 적 일치 규칙.
//
// 필드 그림은 charset(걷기 칩)이고 전투 그림은 도트 몬스터 시트(monsterResourceId)라 둘은 다른 자산 계열이다.
// 예전에는 이름으로 charset 을 찾다가 못 찾으면 「monster 첫 칸(슬라임)」으로 말없이 떨어졌다 — 박쥐를 불렀는데
// 필드에는 슬라임이 서 있었다(2026-10-14 신고). 지금은 **전투 그림(선두 적의 monsterResourceId)이 정본**이고,
// 같은 종류의 charset 이 있는 종만 필드 그림을 준다. 없으면 다른 그림으로 대체하지 않고 거절한다.
import { CHARSET_SEMANTICS } from '@/assets/charsetSemantics';

/** 전투 도트 시트 slug(generated-enemy-<slug>) → 같은 종류의 charset 칸(textureKey#characterIndex). 같은 종만 올린다. */
const FIELD_CELL_BY_SLUG: Readonly<Record<string, string>> = (() => {
  const cells: Record<string, string[]> = {
    // 슬라임·점액
    'tex_easyrpg_charset_monster1#0': ['slime-01', 'slime-red', 'slime-blue', 'slime-green', 'slime-metal', 'slime-king', 'slime-cube', 'king-slime-01', 'ooze-black', 'ooze-acid'],
    'tex_easyrpg_charset_monster1#1': ['imp-mischief'],
    'tex_easyrpg_charset_monster1#2': ['orc-warrior', 'orc-01'],
    // 유령·혼령
    'tex_easyrpg_charset_monster1#3': ['ghost-pale', 'ghost-01', 'wraith-dark', 'banshee-wail', 'specter-01', 'revenant-vengeful'],
    // 해골
    'tex_easyrpg_charset_monster1#4': ['skeleton-archer', 'skeleton-knight', 'skeleton-01', 'skeleton-bone', 'bonepile-crawler'],
    'tex_easyrpg_charset_monster1#5': ['zombie-rot', 'zombie-01', 'ghoul-01', 'ghoul-grave', 'mummy-bandage'],
    'tex_easyrpg_charset_monster1#6': ['lich-frost'],
    'tex_easyrpg_charset_monster1#7': ['minotaur-maze'],
    'tex_easyrpg_charset_monster2#0': ['harpy-cliff', 'harpy-01'],
    'tex_easyrpg_charset_monster2#1': ['dragon-blue'],
    'tex_easyrpg_charset_monster2#4': ['golem-01', 'golem-iron', 'golem-stone', 'golem-clay', 'golem-crystal'],
    'tex_easyrpg_charset_monster2#5': ['dragon-whelp', 'wyvern-cliff'],
    'tex_easyrpg_charset_monster2#7': ['demon-lord'],
    'tex_easyrpg_charset_monster3#1': ['dragon-bone'],
    'tex_easyrpg_charset_monster3#5': ['dragon-01', 'dragon-red'],
    'tex_easyrpg_charset_monster4#2': ['kappa-01'],
    'tex_easyrpg_charset_monster5#0': ['mimic-chest'],
    'tex_easyrpg_charset_monster5#1': ['armor-living', 'knight-fallen'],
    'tex_easyrpg_charset_monster5#3': ['puppet-string'],
    'tex_easyrpg_charset_monster5#5': ['scarecrow-field'],
    'tex_easyrpg_charset_animal#0': ['cat-01'],
    'tex_easyrpg_charset_animal#5': ['horse-01'],
    'tex_easyrpg_charset_animal#6': ['tiger-saber'],
  };
  const out: Record<string, string> = {};
  for (const [cell, slugs] of Object.entries(cells)) for (const slug of slugs) out[slug] = cell;
  return out;
})();

export type FieldGraphicCell = { readonly textureKey: string; readonly characterIndex: number; readonly label: string };

function slugOf(resourceId: string | undefined): string | undefined {
  const match = /^generated-enemy-(.+)$/.exec(resourceId ?? '');
  return match?.[1];
}

/** 전투 그림(monsterResourceId)과 같은 종류의 필드 charset 칸. 없으면 undefined(= 필드에 맞는 그림이 없는 종). */
export function fieldGraphicForBattler(monsterResourceId: string | undefined): FieldGraphicCell | undefined {
  const slug = slugOf(monsterResourceId);
  const cell = slug ? FIELD_CELL_BY_SLUG[slug] : undefined;
  if (!cell) return undefined;
  const [textureKey, index] = cell.split('#') as [string, string];
  const characterIndex = Number(index);
  const entry = CHARSET_SEMANTICS.find((candidate) => candidate.textureKey === textureKey && candidate.characterIndex === characterIndex);
  return entry ? { textureKey, characterIndex, label: entry.label } : undefined;
}

/** 필드 그림 칸 하나를 그리는 전투 시트 slug 목록 — 그림에서 적 그룹을 고를 때 쓴다. */
export function battlersForFieldGraphic(textureKey: string, characterIndex: number): string[] {
  const cell = `${textureKey}#${characterIndex}`;
  return Object.entries(FIELD_CELL_BY_SLUG).filter(([, value]) => value === cell).map(([slug]) => `generated-enemy-${slug}`);
}

/** 필드 적을 놓을 수 있는(전투 그림에 대응하는 필드 그림이 있는) 전투 시트 id 전체. 오류 안내용. */
export function fieldReadyBattlerIds(): string[] {
  return Object.keys(FIELD_CELL_BY_SLUG).map((slug) => `generated-enemy-${slug}`);
}
