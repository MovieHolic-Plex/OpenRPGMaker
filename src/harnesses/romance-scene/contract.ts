import type { GameDesignBrief } from '../../project/gameDesignBrief';
import type { Project } from '../../project/types';

export const ROMANCE_SCENE_ID = 'romance-scene';
export const ROMANCE_IDS = {
  npc: 'ev_romance_partner', choice: 'var_romance_choice',
  relation: 'var_romance_relation', complete: 'sw_romance_met', ending: 'ending_romance_first_meeting',
} as const;
export interface RomanceSceneContract {
  version: 1;
  source: string;
  mapId: string;
  protagonist: string;
  partner: string;
  place: string;
  choices: [string, string];
  temporary: string[];
}

/** Deliberately bounded: a single first conversation, no mixed genres or longer stories. */
export function supportsRomanceScene(project: Project): boolean {
  const b = project.gameDesignBrief;
  return b?.interview?.genre === 'romance' && !b.interview.secondary
    && b.interview.choiceIds.scope === 'scene' && b.interview.choiceIds.activity === 'talk'
    && b.interview.choiceIds.progression === 'single';
}
export function romanceSource(brief: GameDesignBrief): string {
  return JSON.stringify({ summary: brief.summary, answers: brief.answers, interview: brief.interview });
}

/** Only explicit name/place forms are extracted; everything else remains a labelled draft. */
export function compileRomanceContract(project: Project): RomanceSceneContract {
  const brief = project.gameDesignBrief!;
  const summary = brief.summary;
  const notes = brief.interview!.notes;
  const authored = summary + '\n' + notes;
  const temporary: string[] = [];
  const value = (key: string, text: string | undefined, fallback: string): string => {
    if (text?.trim()) return text.trim(); temporary.push(key); return fallback;
  };
  const protagonist = brief.interview!.protagonist.trim().match(/^(?:이름\s*[:：]\s*)?([가-힣A-Za-z][가-힣A-Za-z0-9_-]{0,19})(?=[.。,:：\s]|$)/)?.[1];
  const latestHero = summary.match(/주인공(?:의)?\s*이름(?:은|는|\s*[:：])\s*([가-힣A-Za-z]{2,20})/)?.[1]
    ?? summary.match(/^([가-힣A-Za-z]{2,20}?)(?:가|이)\s+(?:이웃|친구|상대|연인)/)?.[1];
  const validHero = latestHero ?? (protagonist && !/^(아직|미정|정하지|외형|주인공)$/.test(protagonist) ? protagonist : undefined);
  const partner = summary.match(/(?:상대|이웃)(?:의)?\s*이름(?:은|는|\s*[:：])\s*([가-힣A-Za-z]{2,20})/)?.[1]
    ?? summary.match(/이웃\s+([가-힣A-Za-z]{2,20}?)(?:와|과|를|을|에게|[\s,.])/u)?.[1]
    ?? notes.match(/(?:상대|이웃)(?:의)?\s*이름(?:은|는|\s*[:：])\s*([가-힣A-Za-z]{2,20})/)?.[1];
  const place = summary.match(/(?:만나는\s*)?장소(?:는|\s*[:：])\s*([^.!?\n,]{2,60})/)?.[1]
    ?? summary.match(/(?:와|과)\s+([^.!?\n,]{2,60}?)(?:에서\s*(?:만나|만나는|첫|시작))/)?.[1]
    ?? notes.match(/(?:만나는\s*)?장소(?:는|\s*[:：])\s*([^.!?\n,]{2,60})/)?.[1];
  const labels = authored.match(/(?:두\s*)?선택지(?:는|\s*[:：])\s*([^/.。\n]{2,80})\s*\/\s*([^/.。\n]{2,80})/);
  return { version: 1, source: romanceSource(brief), mapId: project.startMapId,
    protagonist: value('protagonist', validHero, project.database.actors.find(a => a.id === 'actor_hero')?.name ?? '주인공'),
    partner: value('partner', partner, '이웃'), place: value('place', place, '첫 만남 장소'),
    choices: labels ? [labels[1]!.trim(), labels[2]!.trim()] : ['반갑게 인사한다', '이야기를 물어본다'],
    temporary: labels ? temporary : [...temporary, 'choices'],
  };
}

export function normalizeRomanceContract(raw: unknown): RomanceSceneContract {
  if (!raw || typeof raw !== 'object') throw Error('연애 장면 계약이 없습니다.');
  const r = raw as RomanceSceneContract;
  if (r.version !== 1 || !Array.isArray(r.choices) || r.choices.length !== 2 || !Array.isArray(r.temporary)
    || ![r.source, r.mapId, r.protagonist, r.partner, r.place, ...r.choices].every(v => typeof v === 'string' && v.trim().length > 0)
    || r.source.length > 30000 || r.mapId.length > 100 || [r.protagonist, r.partner, r.place, ...r.choices].some(v => v.length > 100)
    || !r.temporary.every(v => ['protagonist', 'partner', 'place', 'choices'].includes(v)) || r.choices[0] === r.choices[1]) throw Error('연애 장면 계약 형식이 올바르지 않습니다.');
  return { version: 1, source: r.source, mapId: r.mapId, protagonist: r.protagonist, partner: r.partner,
    place: r.place, choices: [r.choices[0], r.choices[1]], temporary: [...r.temporary] };
}
