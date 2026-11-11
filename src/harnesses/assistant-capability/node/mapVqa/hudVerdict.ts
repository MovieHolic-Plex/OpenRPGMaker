// HUD 검수에서 모델 없이 도는 부분: 종류 목록, 검수자 답 읽기(형식이 어긋나면 답이 아니다), 집계. test/mapVqa.test.ts 가 이 파일만 불러 쓴다.
import { extractJson, VISUAL_JUDGE } from '../visualJudge';

export const HUD_VERSION = 'hud-vqa-v1';
export const HUD_CLASSES: Record<string, string> = {
  'unused-gauge': '게임이 쓰지 않는 수치의 게이지(전투·소모가 없는데 뜬 체력·마력·기력 막대)',
  'wrong-genre-hud': '장르가 다른 HUD(턴제 게임의 액션 HUD: 도구 슬롯·스태미나 고리·하트)',
  'unreadable': '밝은 바닥·복잡한 그림 위라 읽기 어려운 글·숫자',
  'covers-play': 'HUD·목표 줄이 주인공이나 봐야 할 것을 가림',
  'objective-text': '목표 글이 어색하게 줄바꿈·잘림 / 이미 와 있는 곳으로 가라고 함',
  'other': '그 밖의 HUD 결함',
};
export type HudDefect = { class: string; severity: 'major' | 'polish'; evidence: string };
export type HudShot = { id: string; group: string; label: string; mapName: string; start: boolean; file: string; pictureSha256?: string; chip: string | null; status: 'reviewed' | 'unreviewed' | 'no-shot'; error?: string; screen: string; defects: HudDefect[] };

export function parseHudReview(reply: string): { screen: string; defects: HudDefect[] } | null {
  const data = extractJson(reply) as any;
  if (!data || typeof data.screen !== 'string' || !Array.isArray(data.defects)) return null;
  const defects: HudDefect[] = [];
  for (const raw of data.defects) {
    if (!raw || !Object.hasOwn(HUD_CLASSES, raw.class) || !['major', 'polish'].includes(raw.severity) || typeof raw.evidence !== 'string' || !/[가-힣]/u.test(raw.evidence)) return null;
    defects.push({ class: raw.class, severity: raw.severity, evidence: raw.evidence.replace(/\s+/gu, ' ').trim().slice(0, 300) });
  }
  return { screen: data.screen.replace(/\s+/gu, ' ').trim().slice(0, 300), defects: defects.sort((a, b) => Number(a.severity === 'polish') - Number(b.severity === 'polish')) };
}

/** 집계: 종류 × 심각도 × 화면 수 · 게임 수 — tally.json 의 `hud` 묶음. */
export function buildHudTally(shots: HudShot[], games: Array<{ group: string; label: string; factsText: string; unused: string[]; skipped?: string }>, meta: Record<string, unknown>) {
  const reviewed = shots.filter(shot => shot.status === 'reviewed');
  const byClass = Object.fromEntries(Object.keys(HUD_CLASSES).map(id => {
    const hits = reviewed.filter(shot => shot.defects.some(defect => defect.class === id));
    return [id, { label: HUD_CLASSES[id]!, major: reviewed.reduce((sum, shot) => sum + shot.defects.filter(defect => defect.class === id && defect.severity === 'major').length, 0), polish: reviewed.reduce((sum, shot) => sum + shot.defects.filter(defect => defect.class === id && defect.severity === 'polish').length, 0), shots: hits.length, games: new Set(hits.map(shot => shot.group)).size }];
  }));
  const perGame = games.map(game => {
    const list = reviewed.filter(shot => shot.group === game.group);
    return { group: game.group, label: game.label, shots: shots.filter(shot => shot.group === game.group).length, reviewed: list.length, major: list.reduce((sum, shot) => sum + shot.defects.filter(defect => defect.severity === 'major').length, 0), polish: list.reduce((sum, shot) => sum + shot.defects.filter(defect => defect.severity === 'polish').length, 0),
      classes: [...new Set(list.flatMap(shot => shot.defects.filter(defect => defect.severity === 'major').map(defect => defect.class)))], modelFreeUnusedGauges: game.unused, ...(game.skipped ? { skipped: game.skipped } : {}) };
  });
  return { schemaVersion: 1, kind: 'assistant-hud-vqa', promptVersion: HUD_VERSION, judge: VISUAL_JUDGE, calibration: { status: 'uncalibrated', note: '이 HUD 검수자는 심은 결함으로 재지 않았다 — 숫자는 보정 전이다.' }, ...meta,
    totals: { games: games.filter(game => !game.skipped).length, shots: shots.length, reviewed: reviewed.length, unreviewed: shots.length - reviewed.length, shotsWithMajor: reviewed.filter(shot => shot.defects.some(defect => defect.severity === 'major')).length, gamesWithMajor: new Set(reviewed.filter(shot => shot.defects.some(defect => defect.severity === 'major')).map(shot => shot.group)).size, major: reviewed.reduce((sum, shot) => sum + shot.defects.filter(defect => defect.severity === 'major').length, 0), polish: reviewed.reduce((sum, shot) => sum + shot.defects.filter(defect => defect.severity === 'polish').length, 0) },
    ranked: Object.entries(byClass).filter(([, n]) => n.major + n.polish > 0).map(([id, n]) => ({ class: id, ...n })).sort((a, b) => b.major - a.major || b.games - a.games || b.polish - a.polish),
    byClass, perGame, shots: shots.map(({ file, ...shot }) => ({ ...shot, file })), games };
}
