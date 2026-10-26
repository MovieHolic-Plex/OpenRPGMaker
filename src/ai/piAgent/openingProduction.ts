import type { Project } from '../../project/types';
import { resolveAssetResourceUrl } from '../../assets/generatedAssetResourceResolver';
import { animaticResourceIds, animaticCaptionText, sampleAnimaticTrack } from '../../project/openingAnimatic';
import { measureOpeningAnimatic } from '../../project/openingAnimaticMeasure';
import { openingMapViewMapId } from '../../project/openingMapView';

/**
 * Image transport only, never a saveable proposal. Avoid resending every draft PNG per preview.
 * 「게임 속 맵 그대로」 배경(map-view:<mapId>)은 그 맵과 칩셋이 있어야 그려진다 — 둘만 남긴다. 예전에는 맵을 다 비워서
 * 조수의 preview_opening_animatic 과 화면 검수가 이 배경을 매번 「애니메틱 맵 배경 없음」으로 못 찍었다(2026-10-26 hf2-school-claude-j80 2턴).
 */
export function openingImageProject(project: Project, resourceIds: readonly string[]): Project {
  const maps: Project['maps'] = {}, tilesets: Project['tilesets'] = {};
  for (const id of resourceIds) {
    const mapId = openingMapViewMapId(id), map = mapId ? project.maps[mapId] : undefined;
    if (!mapId || !map) continue;
    maps[mapId] = map;
    const tileset = project.tilesets[map.tilesetId];
    // 참고문서(MD·그림)는 그리기에 안 쓰인다 — 전송 사본을 무겁게 하지 않게 뺀다.
    if (tileset) { const { referenceDocuments: _docs, ...drawable } = tileset; tilesets[map.tilesetId] = drawable; }
  }
  return structuredClone({ ...project, maps, tilesets, database: {} as Project['database'], assets: { ...project.assets, sprites: {},
    uploaded: Object.fromEntries(resourceIds.flatMap(id => project.assets.uploaded[id] ? [[id, project.assets.uploaded[id]]] : [])),
  } });
}

/**
 * 장르 프리셋 지시문에는 제작 매뉴얼 전문(AUTHORING_PRESET_BEGIN … END)이 실린다. 매뉴얼의 「제목과 오프닝은 … 제작한다」는
 * 저작 규칙이지 사용자의 오프닝 요청이 아니다 — 판정에서 뺀다.
 * 왜(2026-10-07 실측): 매뉴얼 문장 때문에 첫 제작의 모든 팀원이 오프닝 제작 요청으로 판정됐다. 단계마다 도구가 고정이라
 * plan_opening·review_opening 을 부를 수 없는데도 끝마다 오프닝 재촉을 두 번씩 받았고, 팀 마지막 관문은 기록을 남길 수 없는
 * 오프닝 검토 영수증을 요구해 다 지은 게임을 「오프닝 제작 미완료」로 실패시켰다.
 */
export const OPENING_ANIMATIC_AUTHORING_TOOLS = [
  'plan_opening', 'get_opening', 'get_opening_direction', 'get_animatic_capabilities',
  'list_opening_media', 'generate_opening_image', 'show_opening_image', 'generate_title_art',
  'get_title_screen', 'set_title_screen', 'create_opening_animatic_shot', 'set_opening_pixel_grid',
  'place_opening_background', 'place_opening_charset_actor', 'apply_opening_walk',
  'set_opening_region_loop', 'upsert_opening_light_fx', 'upsert_opening_emote', 'set_opening_caption',
  'upsert_opening_layer', 'remove_opening_layer', 'animate_opening_layer', 'animate_opening_camera',
  'set_opening_transition', 'set_opening', 'edit_opening', 'preview_opening_animatic',
  'inspect_opening_timeline', 'review_opening', 'show_title_opening',
] as const;

export function withoutAuthoringPresetManual(task: string): string {
  const memoIndex = task.indexOf('\n\n[의도 메모');
  const userOnly = memoIndex >= 0 ? task.slice(0, memoIndex) : task;
  return userOnly.replace(/AUTHORING_PRESET_BEGIN [\s\S]*?AUTHORING_PRESET_END[^\n]*/gu, '')
    // 몬스터 자유 경로 지시문(호스트가 붙인 글)도 사용자 요청이 아니다 — 「오프닝을 새로 만들지 않는다」 문장이 오프닝 제작 요청으로 읽혀
    // 대회·탐험 게임이 끝난 뒤 컷신 검증·타이틀 키아트 재촉으로 180여 호출이 더 들었다(2026-10-14 실측).
    .replace(/\[(?:포획 없는 대회형 몬스터 게임 제작|체육관 없는 도감 탐험형 몬스터 게임 제작|몬스터 수집 의도 — 몬스터 키트)\][^\n]*(?:\n(?!\n)[^\n]*)*/gu, '');
}

/**
 * 한 줄 JRPG·연애 게임 제작 요청(「크로노 트리거처럼… 만들어 줘」「파이널판타지6 같은 게임 만들어 줘」「캠퍼스 연애물 만들어 줘」).
 * 사용자가 「오프닝」이라는 낱말을 직접 쓰지 않아도 새 게임 첫 제작에는 #2852 레이어드 도트 애니메틱 오프닝을 기본 포함해야 한다.
 */
export function requestsFullGameOpeningProduction(rawTask: string): boolean {
  const task = withoutAuthoringPresetManual(rawTask).trim();
  if (!task) return false;
  if (/오프닝(?:\s*기능)?(?:을|은|만)?\s*(?:끄|꺼|비활성|삭제)|(?:disable|remove)\s+(?:the\s+)?opening/iu.test(task)) return false;
  if (/포켓몬|pokemon|몬스터\s*(?:수집|도감|포획|키트|토너먼트|대회)/iu.test(task)) return false;
  if (/(?:맵|마을|던전|방|실내|집|전투|스킬|아이템|이벤트|대화창|폰트)(?:만|하나만)\s*(?:만들|추가|수정|고쳐)/iu.test(task)) return false;
  // 「연애」「로맨스」 낱말 하나는 게임 제작 요청이 아니다 — 「연애 이야기의 첫 만남 장면에 쓸 골목 맵을 만들어 줘」가 새 게임 오프닝 6샷·타이틀·
  // 연애 엔딩 3개 완료 검사까지 끌고 왔다(2026-10-22 장면 교훈 r2 quiet-modern-street, Sonnet 5.5 high). 장르 낱말은 물·시뮬·게임이 붙을 때만 센다.
  const hasGenreOrGame = /jrpg|제이\s*알\s*피\s*지|알피지|\brpg\b|크로노\s*트리거|chrono\s*trigger|파이널\s*판타지|final\s*fantasy|\bff\s*6\b|드래곤\s*퀘스트|dragon\s*quest|연애\s*(?:물|시뮬|게임|겜)|미연시|로맨스\s*(?:물|게임|겜)|오토메(?:\s*물|\s*게임)?|비주얼\s*노벨|visual\s*novel|dating\s*sim|otome|(?:게임|작품)(?:을|를)?\s*(?:하나\s*)?(?:만들|제작|완성|개발)/iu.test(task);
  const hasCreateVerb = /만들|제작|짜\s*줘|구현|완성|기획|개발|시작해|부탁|싶어|싶습니다|build|create|make\b/iu.test(task);
  return hasGenreOrGame && hasCreateVerb;
}

export function requestsOpeningProduction(rawTask: string): boolean {
  const task = withoutAuthoringPresetManual(rawTask);
  if (/오프닝(?:\s*기능)?(?:을|은|만)?\s*(?:끄|꺼|비활성|삭제)|(?:disable|remove)\s+(?:the\s+)?opening/iu.test(task)) return false;
  return (/오프닝|opening\b/iu.test(task)
    && /만들|제작|연출|개선|새로|바꿔|바꾸|다시|멋|밋밋|작성|구성|넣|create|design|rewrite|improve|polish|redo/iu.test(task))
    || /plan_opening|create_opening_animatic_shot|set_opening_pixel_grid/iu.test(task);
}

/** 정지 컷 나열이 아니라 «실제 맵 위에서 인물이 움직이는 인게임 장면»으로 여는 오프닝 요청. */
export function requestsInGameOpening(rawTask: string): boolean {
  const task = withoutAuthoringPresetManual(rawTask);
  if (/plan_opening|create_opening_animatic_shot|set_opening_pixel_grid|애니메틱|animatic/iu.test(task) && !/인게임\s*오프닝|in-?game\s*opening|script_cutscene_staged/iu.test(task)) {
    return false;
  }
  if (requestsFullGameOpeningProduction(rawTask) && !/인게임\s*오프닝|in-?game\s*opening|오프닝(?:을|은)?\s*(?:그림\s*나열\s*말고\s*)?(?:인게임|실제\s*맵|컷신)/iu.test(task)) {
    return false;
  }
  return /오프닝|opening\b|도입/iu.test(task)
    && /인게임|in-?game|게임\s*화면|실제\s*(?:맵|장면|게임\s*화면)|맵\s*위(?:에서|의)?\s*(?:배우|인물|캐릭터|주인공|장면|연출|걸|걷|움직|행진|이동)|(?:캐릭터|병사|로봇|기계|인물|주인공)\w*\s*(?:가|이)?\s*(?:직접\s*)?(?:걸어|걷|행진|움직|달려)|컷신|연출\s*장면|그림\s*(?:나열|슬라이드)\s*(?:말고|아니)/iu.test(task);
}
// 평범한 사용자 문장이 「맵에서」에 걸려 인게임 컷신 요청으로 판정됐고, 조수는 애니메틱 대신 시작 맵 이벤트를 만들기 시작했다.
// 맵 낱말은 «그 맵 위에서 벌어지는 장면»을 말할 때만 인게임 신호다.

/** Evidence belongs to the executor, never to a model-supplied completed flag. */
export class PiOpeningProduction {
  private plan = false;
  private titleArt = false;
  private plannedShotCount = 0;
  private bible: Record<string, unknown> | null = null;
  private plannedAngles: string[] = [];
  private readonly critics = new Map<string, string>();
  private reviewed = '';
  private readonly viewed = new Map<string, string>();
  private readonly animatics = new Map<string, { fingerprint: string; times: number[] }>();
  readonly inGame: boolean;
  /** Ordinary new-game openings must use the pixel animatic route unless storybook was explicitly requested. */
  readonly requiresPixelAnimatic: boolean;
  /** 인게임 컷신 객관 측정+독립 판정 결과 — 시작 맵 이벤트 명령 지문에 묶인다(바뀌면 무효). */
  private cutsceneReview?: { readonly fingerprint: string; readonly probeIssues: readonly string[]; readonly judge?: { readonly verdict: string; readonly fix: string; readonly scores: Readonly<Record<string, number>>; readonly judge: string } };
  recordCutsceneReview(fingerprint: string, probeIssues: readonly string[], judge?: { verdict: string; fix: string; scores: Record<string, number>; judge: string }): void { this.cutsceneReview = { fingerprint, probeIssues, ...(judge ? { judge } : {}) }; }
  hasCutsceneReview(fingerprint: string): boolean { return this.cutsceneReview?.fingerprint === fingerprint; }
  cutsceneFingerprint(project: Project): string { return JSON.stringify(project.maps[project.startMapId]?.events ?? []); }
  cutsceneReviewSummary(): string { const r = this.cutsceneReview; return r ? `측정 문제 ${r.probeIssues.length}건, 독립 판정 ${r.judge ? `${r.judge.judge}:${r.judge.verdict}` : '없음'}` : '미실시'; }
  constructor(readonly requested: boolean, private readonly task = '') {
    this.inGame = requested && requestsInGameOpening(task);
    this.requiresPixelAnimatic = requested && !this.inGame && !/그림책|storybook|패널|언더테일|undertale/iu.test(task)
      && (/새로하기|new\s*game|오프닝|opening/iu.test(task) || requestsFullGameOpeningProduction(task));
  }
  record(name: string, ok: boolean, project: Project, args?: unknown): void {
    if (!ok) return;
    if (name === 'plan_opening') { this.plan = true; const shots = (args as { shots?: unknown } | undefined)?.shots; this.plannedShotCount = Array.isArray(shots) ? shots.length : 0;
      const bible = (args as { bible?: unknown } | undefined)?.bible; this.bible = bible && typeof bible === 'object' ? bible as Record<string, unknown> : null;
      this.plannedAngles = (Array.isArray(shots) ? shots : []).map(s => String((s as { angle?: unknown })?.angle ?? '').trim().toLowerCase()).filter(Boolean); }
    if (name === 'generate_title_art') this.titleArt = true;
    if (name === 'review_opening') this.reviewed = this.fingerprint(project);
  }
  /** 바이블의 화풍·팔레트를 컷마다 다시 적게 하지 않는다 — 모델이 직접 준 값이 우선이다. */
  withBible(args: Record<string, unknown>): Record<string, unknown> {
    if (!this.bible) return args;
    const out = { ...args };
    for (const key of ['artStyle', 'palette'] as const) if (out[key] === undefined && typeof this.bible[key] === 'string') out[key] = this.bible[key];
    return out;
  }
  critic(resourceId: string, verdict: string): void { this.critics.set(resourceId, verdict); }
  criticContext(args: Record<string, unknown>) {
    const text = (k: string) => typeof args[k] === 'string' ? args[k] as string : undefined;
    return { prompt: text('prompt') ?? '', focus: text('focus'), cast: text('cast'), angle: text('angle'), light: text('light'), palette: text('palette'), artStyle: text('artStyle'), captionSide: text('captionSide'),
      motifs: Array.isArray(this.bible?.motifs) ? this.bible!.motifs as string[] : [], previousAngles: this.plannedAngles };
  }
  saw(project: Project, resourceId: string): void {
    this.viewed.set(resourceId, this.media(project, resourceId));
  }
  private animaticFingerprint(project: Project, id: string): string {
    const s = project.system.opening?.scenes.find(s => s.id === id);
    return JSON.stringify([s, s?.kind === 'animatic' ? animaticResourceIds(s.composition).map(id => this.media(project, id)) : []]);
  }
  sawAnimatic(project: Project, shotId: string, times: number[]): void {
    const fingerprint = this.animaticFingerprint(project, shotId), previous = this.animatics.get(shotId);
    this.animatics.set(shotId, { fingerprint, times: [...new Set([...(previous?.fingerprint === fingerprint ? previous.times : []), ...times])] });
  }
  private media(project: Project, id: string): string { return JSON.stringify(project.assets.uploaded[id] ?? resolveAssetResourceUrl(id, { project }) ?? null); }
  fingerprint(project: Project): string { return JSON.stringify([project.system.opening ?? null,project.meta.oprnOpeningBook??null]); }
  inspect(project: Project, base: Project): string[] {
    if (!this.requested) return [];
    const issues: string[] = [];
    if (this.inGame) {
      const start = project.maps[project.startMapId], before = base.maps[base.startMapId];
      const events = JSON.stringify(start?.events ?? []);
      if (!start || (events === JSON.stringify(before?.events ?? []) && !/"kind":"auto"/u.test(events))) issues.push('인게임 오프닝을 요청받았지만 시작 맵에 연출 이벤트가 없습니다. 시작 맵을 장면에 맞게 만들고 script_cutscene(또는 script_cutscene_staged)을 trigger:"auto", once:true로 넣으세요(find_tools 로 script_cutscene_staged 를 먼저 불러온 뒤 호출).');
      else {
        if (!/"kind":"auto"/u.test(events)) issues.push('시작 맵의 오프닝 이벤트가 자동 실행(trigger:"auto")이 아닙니다. 새 게임 직후 자동으로 재생되어야 합니다.');
        if (!/"kind":"(?:move|moveRoute|setMoveRoute|camera)|m2-[0-9]+-(?:move|scroll|camera)|moveActor|scroll/iu.test(events)) issues.push('오프닝 이벤트에 인물 이동·카메라 연출이 없습니다. 인물이 걷고 카메라가 따라가거나 훑는 연출을 넣으세요.');
        // 다른 맵으로 옮긴 뒤 도착 맵에 이어지는 자동 연출이 없으면 장면이 거기서 끊긴다(실측: 침실→마을 전환 뒤 아무 일도 없던 오프닝).
        const dest = [...events.matchAll(/"kind":"transfer"[^}]*?"mapId":"([^"]+)"/gu)].map(m => m[1]).find(id => id !== start.id && project.maps[id]);
        if (dest && !/"kind":"auto"/u.test(JSON.stringify(project.maps[dest]?.events ?? []))) issues.push(`오프닝이 맵 '${dest}' 로 옮겨 가지만 그 맵에 이어지는 자동(trigger:"auto") 연출이 없어 장면이 끊깁니다. 도착 맵의 연출을 script_cutscene_staged 로 이어 쓰거나, 한 맵 안에서 끝내세요.`);
        if (/한밤|밤(?:중|하늘|거리|길|에)|야간|달빛|\bnight(?:time)?\b|midnight|moonlit/iu.test(this.task) && !/tint/iu.test(events)) issues.push('요청에 밤 장면이 있는데 오프닝에 화면 색조(tint)가 없어 낮처럼 보입니다. script_cutscene_staged 의 tint(tintPreset night/moonlit)를 쓰세요.');
      }
      // 객관 검증 — 조수의 보고가 아니라 측정치와 독립 판정자의 판정을 근거로 삼는다(runtime 이 바로 앞에서 실행해 기록한다).
      if (this.cutsceneReview && this.cutsceneReview.fingerprint === this.cutsceneFingerprint(project)) {
        issues.push(...this.cutsceneReview.probeIssues);
        const j = this.cutsceneReview.judge;
        if (j?.verdict === 'regenerate') issues.push(`독립 판정자(${j.judge})가 컷신을 합격시키지 않았습니다(${Object.entries(j.scores).map(([k, v]) => `${k} ${v}`).join(', ')}). 권고: ${j.fix}`);
      } else if (start && /"kind":"auto"/u.test(events)) issues.push('컷신의 객관 검증(측정·독립 판정)이 아직 실행되지 않았습니다.');
      // 만들어 둔 컷신 소품 그림이 있는데 이벤트가 하나도 안 쓰면(기본 Actor1 걷기만 나오는 실측) 병기·소품이 화면에 안 나온다.
      const madeSprites = Object.keys(project.assets.uploaded).filter(id => /^cutscene_sprite_/u.test(id));
      if (madeSprites.length && start && !madeSprites.some(id => events.includes(id))) {
        const names = madeSprites.slice(0, 3);
        const example = JSON.stringify({ mapId: start.id, trigger: 'auto', actors: names.map((id, k) => ({ name: `주체${k + 1}`, resourceId: id, scale: 30 })), steps: [{ do: 'letterbox', show: true }, { do: 'tint', tintColor: '20,30,90,0.45', ms: 600 }, { do: 'weather', weather: 'snow', intensity: 0.7 }, ...names.map((_, k) => ({ do: 'enter', actor: `주체${k + 1}`, from: 'left', to: { fx: 0.7 - k * 0.2, fy: 0.72 }, ms: 7000, anim: 'bob', ...(k ? { withPrevious: true } : {}) })), { do: 'wait', ms: 800 }, ...names.map((_, k) => ({ do: 'exit', actor: `주체${k + 1}`, exitTo: 'right', ms: 5000, anim: 'bob', ...(k ? { withPrevious: true } : {}) })), { do: 'fade', direction: 'out', ms: 900 }, { do: 'fade', direction: 'in', ms: 600 }] });
        issues.push(`컷신 소품 그림 ${madeSprites.join(', ')} 이(가) 시작 맵 이벤트에 하나도 쓰이지 않았습니다. 지금 바로 script_cutscene_staged 를 호출하세요(안 불려 있으면 find_tools 로 먼저 불러온 뒤). 호출 형태 예(값은 이야기에 맞게 바꾸되 배우마다 enter 단계가 반드시 필요하고 배우는 resourceId 로 넘깁니다): ${example}`);
      }
      if (/타이틀|title|켜자마자|첫\s*화면/iu.test(this.task) && !this.titleArt && !/^title_art_/u.test(String(project.system.titleScreen?.backgroundResourceId ?? ''))) issues.push('게임을 켜자마자 보이는 타이틀 화면이 기본 그림입니다. generate_title_art로 작품 전용 그림을 만드세요.');
      return issues;
    }
    if (this.fingerprint(project) === this.fingerprint(base)) issues.push('오프닝 설정이 요청 전과 같습니다. 실제 변경 또는 변경하지 못한 이유를 보고하세요.');
    if (/타이틀|title|첫\s*(?:화면|장면)|처음\s*(?:화면|장면)|시작\s*화면|켜자마자|켜면|게임을\s*켤/iu.test(this.task) && !this.titleArt && !/^title_art_/u.test(String(project.system.titleScreen?.backgroundResourceId ?? ''))) issues.push('요청에 게임을 켜자마자 보이는 첫 화면(타이틀)이 포함됩니다. 기본 이미지를 두지 말고 오프닝과 같은 화풍·모티프로 generate_title_art(artStyle·light·palette·candidates 지정)를 실행하고 set_title_screen으로 음악·효과를 구성하세요.');
    if (/효과음|\bsfx\b|사운드|이펙트|sound\s*effect/iu.test(this.task) && project.system.opening?.scenes?.length && !project.system.opening.scenes.some(s => s.kind === 'image' && (s.direction?.sounds?.length || s.direction?.soundResourceId))) issues.push('효과음을 요청받았지만 어느 장면에도 효과음이 연결되지 않았습니다. 장면 direction.sounds[{resourceId,atMs,volume}]로 사건 시각마다 effect를 연결하고(edit_opening op:update), 연결하지 않았다면 연결했다고 보고하지 마세요.');
    for (const sc of project.system.opening?.scenes ?? []) if ((sc.presentation?.text?.size ?? 0) > 16) issues.push(`${sc.id}: presentation.text.size ${sc.presentation!.text!.size}는 너무 큽니다. 무대는 320×240 논리 픽셀이라 화면에서 3배로 보입니다. 자막은 10~13, 장 제목은 최대 16으로 줄이세요.`);
    if (!this.plan) issues.push('plan_opening으로 사건·구도·연속성·플레이 진입을 설계하세요.');
    else if (!this.bible) issues.push('plan_opening의 bible(전제·질문·모티프·팔레트·화풍·글 목소리)이 없습니다. 작품 고유 연출 기준을 먼저 세우세요.');
    if (this.plannedAngles.length >= 3) {
      const counts = new Map<string, number>(); for (const a of this.plannedAngles) counts.set(a, (counts.get(a) ?? 0) + 1);
      if (Math.max(...counts.values()) > Math.ceil(this.plannedAngles.length / 2)) issues.push('계획한 카메라 앵글이 절반 넘게 같습니다. 컷마다 위치·거리를 달리해 같은 엽서 구도를 반복하지 마세요.');
    }
    const opening = project.system.opening;
    if (!opening?.enabled || !opening.scenes?.length) issues.push('지정한 위치에서 재생할 오프닝이 활성화되지 않았습니다.');
    if (this.plannedShotCount && opening?.scenes.length !== this.plannedShotCount && !opening?.scenes.some(s => s.kind === 'video')) issues.push(`제출한 계획 ${this.plannedShotCount}샷과 연결된 ${opening?.scenes.length ?? 0}장면이 다릅니다. 계획을 실제 장면으로 연결하거나 변경 이유를 반영해 계획을 수정하세요.`);
    if (/설명.{0,12}(?:길|대신)|그림.{0,8}중심/iu.test(this.task) && opening?.scenes.some(s => (s.narration?.length ?? 0) > 80)) issues.push('요청은 그림으로 사건을 보여주는 도입입니다. 80자를 넘는 설명을 장면 위에 붙이지 말고 사건/동작을 실제 그림으로 옮기세요.');
    for (const id of new Set((opening?.scenes ?? []).filter(s => s.kind === 'image').map(s => s.resourceId ?? ''))) {
      if (this.critics.get(id) === 'regenerate') issues.push(`독립 판정자가 그림 ${id}에 재생성을 권고했습니다(지시 없는 인물·결함·범용 벽지). 권고한 수정으로 다시 생성해 교체하세요.`);
      if (!id || this.viewed.get(id) !== this.media(project, id)) issues.push(`show_opening_image로 현재 그림 ${id || '(미지정)'}의 실제 이미지를 확인하세요. 이름 조회는 시각 검수가 아닙니다.`);
    }
    if (/애니메틱|animatic|독립.*레이어|캐릭터.{0,12}움직/iu.test(this.task) && !opening?.scenes.some(s => s.kind === 'animatic')) issues.push('요청한 애니메틱을 실제 합성 샷으로 저작하세요. 정지 그림의 pan/zoom만으로 애니메틱 제작을 완료하지 마세요.');
    // 픽셀 오프닝 또는 새 게임 전체 제작을 요청받았는데 정지 그림만 있으면 그 요청은 이행되지 않았다 — 격자 무대의 샷이 필요하다.
    if ((/도트|픽셀|pixel|도트\s*격자|새로하기|new\s*game|create_opening_animatic_shot|set_opening_pixel_grid/iu.test(this.task) || requestsFullGameOpeningProduction(this.task)) && !/그림책|storybook|패널|언더테일|undertale/iu.test(this.task) && (opening?.scenes.some(s => s.kind === 'image') || !opening?.scenes.some(s => s.kind === 'animatic')) && !opening?.scenes.some(s => s.kind === 'animatic' && s.composition.pixelGrid)) issues.push('새 게임/픽셀 오프닝을 요청받았습니다. 정지 그림 컷이나 자막 카드가 아니라 정수 픽셀 격자 무대(384×216) 샷으로 저작하세요: create_opening_animatic_shot(width:384,height:216) → set_opening_pixel_grid(384,216) → place_opening_background → place_opening_charset_actor(번들 24×32 캐릭터 칩) → 실제로 움직이는 것(region 루프·glow pulse·shaft·particles·walk)을 넣고 set_opening_caption 으로 막대 안 자막을 붙입니다. get_opening_direction 의 pixel-animatic-opening 레시피를 읽으세요.');
    for (const scene of opening?.scenes ?? []) if (scene.kind === 'animatic') {
      const preview = this.animatics.get(scene.id);
      if (preview?.fingerprint !== this.animaticFingerprint(project, scene.id) || preview.times.length < 2 || Math.max(...preview.times) - Math.min(...preview.times) < scene.durationMs * 0.25) issues.push(`${scene.id}: 마지막 변경 뒤 preview_opening_animatic으로 충분히 떨어진2개 이상의 실제 시간 표본을 보세요.`);
      if (!scene.composition.layers.length) issues.push(`${scene.id}: 애니메틱 무대가 비어 있습니다.`);
      for (const voice of [scene.narration, ...animaticCaptionText(scene.composition)].filter(Boolean)) {
        const characters = [...voice.trim()].length, estimate = characters ? Math.ceil(1000 + characters / 6 * 1000) : 0;
        if (scene.durationMs > 0 && estimate > scene.durationMs) issues.push(`${scene.id}: 샷 ${scene.durationMs}ms 안에 자막·내레이션 ${characters}자를 읽어야 합니다(추정 ${estimate}ms). 큐 시각을 늘리거나 문장을 줄이세요.`);
      }
      for (const layer of scene.composition.layers) if (layer.walk) {
        const travelled = Math.abs(sampleAnimaticTrack(layer.keys?.x, scene.durationMs, layer.x) - sampleAnimaticTrack(layer.keys?.x, layer.startMs ?? 0, layer.x)) * Math.abs(layer.scaleX ?? 1);
        const steps = travelled / layer.walk.stride, remainder = Math.abs(steps - Math.round(steps));
        if (remainder > 0.25 && remainder < 0.75) issues.push(`${scene.id}/${layer.id}: 걷기가 보폭 ${layer.walk.stride}px의 ${(remainder * 100).toFixed(0)}% 지점에서 끝납니다 — 발이 반걸음에서 멈춥니다. 이동 거리를 보폭의 배수로 맞추거나 stride를 조절하세요.`);
      }
      if (scene.composition.pixelGrid) {
        const fractional = scene.composition.layers.filter(l => (l.kind === 'image' || l.kind === 'shape') && (!Number.isInteger(l.width) || !Number.isInteger(l.height))).map(l => l.id);
        if (fractional.length) issues.push(`${scene.id}: 픽셀 격자 ${scene.composition.pixelGrid.width}×${scene.composition.pixelGrid.height} 인데 레이어 ${fractional.join(', ')}의 width/height가 소수입니다. 정수로 맞춰야 그림이 정확한 격자 픽셀에 앉습니다.`);
        // 글자 크기는 격자 픽셀이다 — 무대가 격자보다 크면 작은 fontSize 가 격자 아래로 내려가 뭉개진다.
        for (const layer of scene.composition.layers) {
          const size = layer.kind === 'caption' ? layer.typography?.fontSize ?? 12 : layer.kind === 'text' ? layer.typography?.fontSize ?? 40 : undefined;
          if (size === undefined) continue;
          const gridPx = size; // 이미 격자 픽셀로 해석된다
          if (gridPx < 7) issues.push(`${scene.id}/${layer.id}: 격자 픽셀 ${gridPx}px 글자는 업스케일 뒤 읽히지 않습니다. 자막은 10~12, 장 제목은 14~20으로 올리세요.`);
          else if (gridPx > 24) issues.push(`${scene.id}/${layer.id}: 격자 픽셀 ${gridPx}px 글자는 무대를 덮습니다. 자막은 10~12로 줄이세요.`);
        }
        // charset 배우는 24×32 격자에 앉아야 한다 — 소수배로 늘리면 배경 픽셀과 크기가 달라진다.
        for (const layer of scene.composition.layers) {
          if (layer.kind !== 'image' || !layer.resourceId) continue;
          const asset = project.assets.uploaded[layer.resourceId];
          const frameWidth = layer.sheet?.frameWidth ?? (asset?.kind === 'charset' ? 24 : undefined);
          if (!frameWidth) continue;
          const ratio = layer.width / frameWidth;
          if (Math.abs(ratio - Math.round(ratio)) > 0.01) issues.push(`${scene.id}/${layer.id}: ${frameWidth}px 캐릭터 칩을 ${layer.width}px 로 그려 픽셀 크기가 배경과 다릅니다. 폭을 ${frameWidth}의 정수배(${Math.max(1, Math.round(ratio))}배 = ${frameWidth * Math.max(1, Math.round(ratio))}px)로 맞추세요.`);
        }
        // 격자 무대인데 아무것도 움직이지 않으면 «정지 그림 + 줄자» 이다.
        const alive = scene.composition.layers.filter(l => l.region || l.walk || l.particles || l.shaft || l.glow || l.emote
          || Object.keys(l.keys ?? {}).some(key => key !== 'opacity') || (l.sheet?.fps ?? 0) > 0);
        if (!alive.length) issues.push(`${scene.id}: 픽셀 격자 샷인데 실제로 움직이는 것이 없습니다. region 루프·shaft/glow pulse·particles·walk·emote 중 최소 하나를 넣으세요(정지 그림 + 카메라 이동뿐이면 미완성).`);
        for (const layer of scene.composition.layers) {
          if (layer.kind === 'image' && layer.region && (layer.region.mode === 'scroll-x' || layer.region.mode === 'scroll-y')) {
            const rW = layer.region.width ?? layer.width;
            const rH = layer.region.height ?? layer.height;
            if (rW >= scene.composition.width * 0.8 && rH >= scene.composition.height * 0.65) {
              issues.push(`${scene.id}/${layer.id}: 전체 배경(${rW}×${rH})에 ${layer.region.mode}를 걸어 지평선·건물이 화면 중앙에서 잘립니다. set_opening_region_loop로 상단 하늘 영역(예: y:0, height:52)에만 scroll-x를 걸거나 작은 영역 palette-cycle로 바꾸고, 전체 이동은 animate_opening_camera로 연출하세요.`);
            }
          }
        }
      }
    }
    const animatics = (opening?.scenes ?? []).filter((sc): sc is Extract<typeof sc, { kind: 'animatic' }> => sc.kind === 'animatic');
    const pixelShots = animatics.filter(sc => Boolean(sc.composition.pixelGrid));
    // 화풍 자물쇠(격자·배율·자막 색·움직임 수·말풍선·전환 호흡)는 저작값에서 바로 세어진다 — 같은 수치를
    // 조수의 완료 검토와 review_opening 이 함께 본다. 여기서는 화면 안 겹침처럼 샷 하나에만 걸리는 것만 더 본다.
    if (pixelShots.length) issues.push(...measureOpeningAnimatic(project).issues);
    if (pixelShots.length >= 4) {
      const lastShot = pixelShots[pixelShots.length - 1]!;
      const textLayers = lastShot.composition.layers.filter(l => l.kind === 'text');
      const propLayers = lastShot.composition.layers.filter(l => l.kind === 'image' && l.role !== 'background' && l.width <= 120 && l.height <= 120);
      for (const prop of propLayers) {
        for (const txt of textLayers) {
          const propBottom = prop.y + prop.height;
          const propRight = prop.x + prop.width;
          const txtBottom = txt.y + (txt.typography?.fontSize ?? 20) + 6;
          const txtRight = txt.x + txt.width;
          if (prop.y < txtBottom && propBottom > txt.y && prop.x < txtRight && propRight > txt.x) {
            issues.push(`${lastShot.id}: 소품/엠블럼 레이어 '${prop.id}'(y:${prop.y}..${propBottom})가 제목 글자 '${txt.id}'(y:${txt.y}..${txtBottom})와 겹칩니다. 엠블럼의 y를 상단(y:14..40)으로 옮겨 글자와 분리하세요.`);
          }
        }
      }
    }
    const stills = (opening?.scenes ?? []).filter(sc => sc.kind === 'image');
    const animaticScenes = (opening?.scenes ?? []).filter(sc => sc.kind === 'animatic');
    // 참조 도입부(KNIGHT OF LUMERIA, 2026-10-15 조사)는 정지 그림 한 장 + 카메라 줌이 아니라
    // 번들 캐릭터 칩 배우·지역 루프·시차 레이어가 동시에 사는 격자 무대 샷이다. 그림책을 명시로 요청한 게 아닌데
    // 그림 컷만 3장 이상이고 애니메틱 샷이 0이면 그 요청은 이행되지 않았다(2026-10-16 run-2: 그림 6장만 남았다).
    const storybookRequest = /그림책|storybook|패널|언더테일|undertale/iu.test(this.task);
    if (!storybookRequest && !animaticScenes.length && stills.length >= 1) {
      issues.push(`그림 컷만 ${stills.length}장이고 실제 합성 애니메틱 샷이 하나도 없습니다. 참조 도입부 같은 다층 연출을 내려면 create_opening_animatic_shot(384×216) + set_opening_pixel_grid 로 격자 무대 샷을 만들고, 배경/전경을 독립 레이어로 나눈 뒤 place_opening_charset_actor(번들 24×32 캐릭터 칩)로 인물을 움직이고 set_opening_region_loop(물·불빛)·upsert_opening_light_fx·animate_opening_camera 를 겹쳐 한 샷에 최소 3개가 동시에 살아 있게 하세요. get_animatic_capabilities 의 pixelOpening 계약과 get_opening_direction 의 pixel-animatic-opening 레시피를 읽으세요.`);
    }
    if (stills.length >= 3 && stills.every(sc => !sc.direction?.layers?.length && !sc.direction?.effects?.length)) issues.push('모든 컷이 정지 그림 한 장 + 줌뿐입니다. 컷 안에서 움직이는 것(빛줄기·안개 effects, 자라거나 나타나는 투명 전경 레이어)을 최소 절반의 컷에 넣으세요.');
    else if (stills.length >= 3 && stills.filter(sc => sc.direction?.layers?.length).length === 0) issues.push('투명 전경 레이어(generate_opening_image role:foreground → direction.layers)를 쓴 컷이 하나도 없습니다. 위협이 자라거나 눈이 뜨이는 식의 컷 내부 변화를 한 컷 이상 넣으세요.');
    if (this.reviewed !== this.fingerprint(project)) issues.push('마지막 변경 뒤 review_opening으로 연결·시간·읽기 속도를 검토하세요.');
    return issues;
  }
}

export const OPENING_PRODUCTION_PROMPT = `[오프닝 제작]
이 작업이 새로하기/게임 시작 오프닝이고 사용자가 그림책·스토리북을 명시하지 않았다면 pixel-animatic-opening이 강제 기본 경로다. make_opening_storybook이나 3장 이상의 kind:image 정지 컷을 완료 경로로 쓰지 마라. 먼저 create_opening_animatic_shot(width:384,height:216)와 set_opening_pixel_grid를 호출하고, 마지막에는 set_opening으로 그 애니메틱 shotId들을 저장해야 한다. review_opening에 zero animatic/title art missing/no moving layers가 남으면 완료 선언·중지를 하지 말고 도구를 더 호출한다.
계획·진행·최종 보고는 사용자가 요청한 언어로 작성한다. 한국어 요청이면 한국어로 보고한다. 이미지 모델용 프롬프트는 영어여도 된다.
기존 오프닝·시작 세션·등장인물 리소스를 먼저 읽고 plan_opening으로 샷의 사건, 구도, 연속성, 플레이 진입을 설계한다. 장르와 사용자 의도가 우선이며 샷 수나 시간을 획일화하지 않는다.
사용자가 「새로하기 오프닝」(게임을 새로 시작할 때 나오는 도입)을 요청했고 그림책·정지 패널을 명시로 원한 것이 아니면, 정지 그림 컷을 나열하지 말고 get_opening_direction 의 pixel-animatic-opening 레시피대로 **격자 무대 애니메틱 샷**으로 저작한다: create_opening_animatic_shot(width:384,height:216) → set_opening_pixel_grid(384,216) → 배경/전경 독립 레이어 + place_opening_charset_actor(번들 24×32 캐릭터 칩) + set_opening_region_loop/upsert_opening_light_fx/animate_opening_camera 로 한 샷에 최소 3개가 동시에 살아 있게 한다. 참조 도입부(KNIGHT OF LUMERIA 조사본)가 이 형태다. 정지 그림 + 카메라 줌만인 오프닝은 이 요청의 답이 아니다.
각 애니메틱 샷의 role:background는 반드시 그 샷을 위해 generate_opening_image(role:"backdrop")로 새로 만든 환경 그림 하나를 사용한다. 다른 샷의 배경 ID를 재사용하지 말고, oprn-still/battle-scenery/title_art 같은 번들 스틸을 배경으로 대체하지 않는다. 이미지 생성이 실패하면 실패 결과의 안내를 따른다: 로그인·연결이 없으면 같은 생성을 되풀이하지 말고, 안 쓴 전용 그림 → 그림 설명(list_resources kind:backdrop 의 description)이 가장 가까운 라이브러리 그림 → 그림 없는 장면 순서로 두고 오프닝을 끝까지 짓는다. 실패를 성공으로 보고하거나 이름만 있는 resourceId 를 쓰지 않고, 보고에 «새 그림 생성 불가 — 가장 가까운 그림 사용»을 적는다. 성당·수정 동굴처럼 한 beat에 구도 변화가 필요한 곳은 wide→close-up→reaction/crowd를 별도 샷과 별도 배경으로 만든다.
애니메틱 샷을 이미 create_opening_animatic_shot으로 만들었다면 set_opening으로 다시 빈 composition을 보내지 않는다. set_opening은 각 장면의 composition:{shotId:"기존샷ID"} 별칭으로 현재 애니메틱을 저장하고, 이전 그림책/0ms 장면을 제거해 계획한 샷 수만 남긴다. 기존 샷을 replace해야 하면 clearLayers:true 없이는 교체하지 않는다.
get_opening.generatedStills에는 앞선 제작에서 만든 그림과 미연결 여부가 있다. 이미 생성한 그림을 활용하라는 요청이면 이 ID들을 실제로 보고 계획에 연결한다. list_opening_media는 프로젝트 그림을 공용 샘플보다 먼저 반환한다. 그림을 다시 만들기 전에 제작 중인 소재가 있는지 확인한다.
사용자가 언더테일 같은 서사 도입이나 그림책을 요청하면 get_opening_direction을 읽고 세계→균열→위기→플레이 진입을 원문과 단색 패널로 설계한다. 정지 패널과 짧은 내레이션도 의도적인 연출이다. make_opening_storybook의 기본 progression=confirm으로 Enter까지 문장을 유지한다. 같은 그림은 여러 문장 페이지에 재사용하고 페이지마다 페이드/자동 넘김을 넣지 않는다. 자동 연출은 사용자가 요청한 경우에만 progression=auto와 읽기 시간을 명시한다. 그 요청에 캐릭터 소개 몽타주를 강요하지 않는다. 새 음악을 원하면 get_music_composer/compose_music로 기억할 원문 모티프와 구간별 악보를 만들고 실제 WAV를 연결한다. 모델은 소리를 듣지 않으므로 청취 검증을 주장하지 않는다.
설명문을 배경 위에 반복하는 것으로 연출을 대체하지 않는다. 각 샷에서 무엇이 실제로 달라지고 다음 샷을 보고 싶게 하는지 정한다. 먼저 사건을 보여주고 필요한 문구만 붙인다. 동료 선택 전에는 이미 선택·소유한 동료처럼 그리지 않는다.
샷 사이의 시간대·광원·사건 결과를 유지한다. 꺼진 등대가 이유 없이 다시 켜지거나 같은 밤이 갑자기 노을로 바뀌면 생성 그림을 수정한다. 참고 그림의 분위기보다 현재 이야기의 사건 상태를 우선한다.
캐릭터와 장소가 나오면 show_opening_image로 실제 참고 외형을 보고 generate_opening_image의 referenceResourceIds로 전달한다. 새 그림은 실제 생성·등록된 resourceId만 사용한다. 생성 실패를 이름만 있는 리소스로 덮지 않는다.
plan_opening의 bible에 한 줄 전제, 오프닝이 끝날 때의 단 하나의 질문, 반복 모티프 1~4개, 팔레트, 화풍 문장, 글의 목소리를 먼저 쓴다. 팔레트와 화풍은 이후 그림 생성에 자동 적용된다. 첫 컷은 설명이 아니라 질문을 던지는 구체적 이미지로 연다. 자막은 설명문이 아니라 bible.voice의 한 조각이며 그림에 보이는 것을 되풀이하지 않는다. 컷마다 감정이 변해야 하고(beat), 모티프가 컷을 가로질러 돌아온다. 마지막 컷은 질문을 풀지 않고 첫 행동으로 넘긴다.
artStyle은 형용사가 아니라 기법으로 쓴다(예: "visible square pixels, 32-colour palette, hand-placed dithering, 1px outlines"). "painterly", "gouache" 같은 이름만 적으면 모델 기본 시네마틱 화면으로 수렴한다(2026-10-11 같은 컷 3화풍 시험: 기법을 적은 픽셀 문장만 화풍이 갈렸다). cast에는 나와도 되는 인물·생물을 적고, 사람이 없는 컷은 nobody로 적는다(지시하지 않은 망토 인물·군중이 끼어든다).
첫 컷과 사건이 벌어지는 핵심 컷은 candidates:3으로 뽑는다. 독립 판정자가 고른 한 장만 등록되고, 응답의 critique에 고른 이유와 재생성 권고(fix)가 온다. 권고가 오면 fix를 프롬프트에 반영해 다시 생성한다.
generate_opening_image는 컷마다 focus(시선이 닿을 단 하나의 대상), angle(컷마다 다른 카메라 위치), light(보이는 주 광원), palette(3~4색+포인트색), captionSide를 채우고, artStyle에는 작품 고유 화풍 문장을 정해 모든 컷에 그대로 재사용한다. 모든 컷을 눈높이 정면 엽서 구도나 같은 밝기의 소품 나열로 만들지 않는다.
generate_opening_image의 성공 응답에는 생성된 그림이 들어온다. 외형·사건·구도를 보고 필요하면 다시 생성한다. 기존 그림도 show_opening_image로 보고 연결한다. set_opening/edit_opening 후 review_opening으로 구성 검토한다.
get_opening_references에서 관련 게임의 실제 도입/타이틀 소개/홍보 영상과 확인 범위를 구별한다. 기법을 참고해 독자적인 사건과 화면을 저작하며 원작 소재를 게임 리소스로 복사하지 않는다.
에메랄드 교수의 Enter 확인식 소개에 눈깜빡임·말하기·손짓이 필요하면 실제로 그린 가로 포즈 스트립과 정지 초상을 configure_opening_portrait_motion으로 연결한다. frameWidth/frameHeight/frameCount/fps/frames와 기존 페이지 ID별 sceneFrames를 명시한다. Enter 페이지를 타이머로 바꾸거나 음악을 재시작하지 않는다. 하나의 그림을 위아래로 옮기는 것으로 새 포즈를 만들었다고 주장하지 않는다. 마지막 변경 뒤 실제 native 픽셀 재생과 정본 저장·재로드를 별도로 검증한다.
애니메틱 요청이면 get_animatic_capabilities를 읽고 create_opening_animatic_shot으로 시간축 무대를 만든다. upsert_opening_layer로 배경/배우/전경/글/효과를 나누고 animate_opening_layer/animate_opening_camera, 스프라이트 sheet/pose 키, set_opening_transition, upsert_opening_audio_cue로 실제 연출한다. 하나의 완성 그림에 zoom만 적용하는 것으로 독립 배우 동작을 대신하지 않는다. 움직임은 사건의 원인과 결과를 읽히게 하며 모든 배우를 이유 없이 흔들지 않는다.
각 beat는 가능한 경우 최소 두 컷으로 나눈다. 샷마다 카메라 또는 피사체/전경 변화 하나를 포함한 독립 움직임을 세 개 이상 넣고, 입자만 움직이는 샷은 미완성이다. 기사/주민/마법사/주인공은 place_opening_charset_actor의 characterRole을 장면 역할에 맞게 지정하고, 레터박스 안전영역 안에 둔다.
행동은 walk만 반복하지 않는다. 성당 맹세에는 기사단을 두 줄로 세우고 direction:"down" hold frame과 frame 키/짧은 이동으로 무릎 꿇기와 고개 숙임을 읽히게 하며, 절벽 beat에는 주인공 charset의 hold→draw frame 상태와 검 prop의 sheathed→drawn strip을 시간축에 맞춘다. 마을은 크기·방향·보폭이 다른 주민 5~8명을 배치하고, 수정/눈은 glow만 키우지 말고 normal→cracked 또는 closed→open 상태를 실제 frame/strip으로 전환한다.
배경 그림 속 배우는 독립 레이어가 아니다. 배경에 이미 그려진 배우 위에 같은 배우를 겹쳐 놓지 않는다. 필요하면 generate_opening_image(role:backdrop, cast:"nobody")로 배우 없는 장소, role:foreground로 실제 알파 분리 소재를 만든다. 실패한 단색 배경 제거를 투명 소재 성공이라고 하지 않는다. 기존 투명 그림과 정확한 crop/sheet도 재사용할 수 있다. 포즈를 만들지 않았다면 평면 이동을 골격 애니메이션이라고 부르지 않는다.
inspect_opening_timeline은 구조만 검사한다. preview_opening_animatic으로 각 샷의 시작/중간/후반 실제 합성 프레임을 보고 마지막 수정 후 다시 보라. 피사체가 화면 밖으로 나갔는지, 배경/배우 외형과 조명/접지/전경 가림이 맞는지, 글이 가리지 않는지 검토하고 구체적으로 수정한다. 2D 레이어/카메라/스프라이트 애니메틱과 등록된 영상 재생을 지원한다. 3D 리깅·골격 애니메이션·자동 영상/음성 생성을 했다고 주장하지 않는다. 타이틀 WebGL 효과는 오프닝에 자동 적용되지 않는다.
인게임 오프닝: 요청이 «그림 나열이 아니라 실제 게임 장면/캐릭터가 움직이는 연출/컷신»이면 system.opening 장면을 만들지 않는다. 시작 맵을 이야기에 맞게 직접 지은 뒤(맵 도구) 그 맵 위에서 script_cutscene_staged(또는 script_cutscene)에 trigger:"auto", once:true로 연출한다. 순서와 조합은 이야기가 정한다 — 정해진 틀이 없다. 쓸 수 있는 어휘: 배우 입장·이동·퇴장(enter/move/exit, anim:'walk'=캐릭터셋 걷기 프레임 / 'bob'=걷기 프레임 없는 그림의 발걸음 출렁임), 배우 크기(scale %), 화면 색조(tint: 밤·노을·피·회상), 날씨(weather), 영화식 띠(letterbox), 맵 카메라(camera), 대사·내레이션(say), 효과음·음악(se/bgm), 암전·번쩍임·흔들림(fade/flash/shake), 맵 이동(transfer). 무엇을 쓸지는 «이 장면이 관객에게 어떤 감정을 주려는가»에서 고른다. 어떤 연출이든 지킬 기준: ①중심 대상이 화면에 보이고 움직인다(안 보이는 배우 금지) ②크기·간격이 화면과 어울린다(풍경 속 인물은 작게, 겹치지 않게) ③색조·날씨가 이야기의 시간·기분과 맞는다 ④글자가 읽힌다 ⑤소리가 시각 사건과 같은 시각에 실제로 깔린다 ⑥끝나면 조작이 넘어간다. 먼저 read_directing_guide를 읽고, 배치·미리보기(show_map_region·preview_cutscene)를 눈으로 확인해 위 기준을 점검한다. 효과음은 generate_original_se로 장면에 맞게 합성해 se 단계에 넣는다.
오프닝은 플레이어가 게임을 켜자마자 보는 첫 화면(타이틀)까지 포함한다. 요청이 첫 화면을 포함하면 기본 타이틀 그림을 그대로 두지 말고 bible의 화풍·모티프·팔레트로 generate_title_art(artStyle·light·palette·candidates 2~3)를 실행한 뒤 set_title_screen으로 타이틀 음악·효과를 정한다.
효과음은 자유롭게 설계한다. generate_original_se로 장면에 맞는 소리(발걸음·바람·금속 마찰·종소리·균열 등)를 여러 개 합성하고, 장면 direction.sounds[{resourceId,atMs,volume}]로 시각 사건의 시각(atMs)에 맞춰 최대 8개까지 겹쳐 연결한다. 하나의 soundResourceId만 쓰는 것으로 끝내지 않는다. 모델은 소리를 듣지 못하므로 타이밍은 샷의 사건 시각에서 계산한다.
영상·소리·이미지 가공이 필요하면 run_ffmpeg(inputs=리소스 id, args의 {in0}/{out})로 컷 이어붙이기·페이드·색 보정·소리 믹스·PNG→mp4를 직접 수행해 새 리소스로 등록한다. 외부 파일·네트워크는 쓸 수 없다.
타이틀 키아트의 prompt에는 주인공이나 작품의 상징 사물을 시선의 중심에 명시한다(빈 풍경 금지). 배경 키아트를 set_title_screen의 titleGraphic(로고 그림 전용)에 넣지 않는다 — 로고 그림이 없으면 mode:text.
픽셀 애니메틱의 타이틀은 anti-aliased system font로 끝내지 않는다. generate_title_art 또는 전용 pixel logo resource를 만들고, 실제 픽셀 문자/문장 엠블럼을 title shot의 image/strip 레이어로 배치한다. 생성 실패 시 텍스트 로고를 성공으로 보고하지 않는다.
타이틀/배경 이미지 생성이 실패하면 실패를 사용자에게 보고하되, 이미 업로드된 미사용 opening_still 전용 그림을 먼저 list_opening_media에서 골라 쓰고, 없으면 그림 설명이 이 장면과 가장 가까운 라이브러리 그림(list_resources kind:backdrop 의 description 을 읽고)을, 그것도 맞지 않으면 author_pixel_art 픽셀 로고/엠블럼을 두고 모션·캡션·전환 작업을 계속한다. 이름만 보고 시대·장소가 다른 그림(현대 도시 노을 등)을 깔지 않는다.
새 게임 시네마틱 오프닝(그림 컷 + 자막, 인게임 컷신 아님)은 get_opening_direction의 illustrated-chapter 문법을 따른다: 레터박스 14~18, 막대 안 한 줄 자막(layout:bar, typewriter), 한 장면을 가까워지는 그림 2~4장으로 나누고 dither 전환으로 잇고, 커지는 위협·변화는 투명 전경 레이어(opacity 키)와 effects로 컷 안에서 자라게 한다. 컷 하나가 정지 그림 한 장 + 줌뿐이면 미완성이다. 생성 그림은 실행기가 자동으로 한 도트 격자·팔레트로 내리므로 화풍 형용사 대신 피사체·빛·구도를 쓴다.
새 게임 픽셀 애니메틱 오프닝(정수 픽셀 무대의 샷 목록)은 get_opening_direction의 pixel-animatic-opening 문법과 get_animatic_capabilities의 pixelOpening 계약을 따른다: 모든 샷을 width:384, height:216으로 만들고 set_opening_pixel_grid(384,216)을 부르면 샷 안의 모든 숫자가 이미 격자 픽셀이다(샷 길이 6000~9500ms). 레터박스 0.15(216의 32px, 참조 도입부 실측 32/216)에 막대 안 한 줄 자막을 set_opening_caption으로 넣고, 오프닝 전체에서 기본 자막 색 하나(#fff0dc)로 통일하며 마지막 절벽 결의 대사 한두 큐만 강조색(#ff6878)을 쓴다(전체 자막 색 전환 2회 이하, 샷마다 다른 색 금지!). 중요 규칙: ① 배우나 군중을 올릴 배경은 generate_opening_image 프롬프트에 "16-bit SNES JRPG pixel art, crisp pixel clusters, unified 32-color dark fantasy palette, empty environment only, no people or characters in background"와 cast:"nobody"를 지정해 배경 속 그려진 인물과 캐릭터 칩이 겹치지 않게 한다. ② 절대 384×216 전체 배경에 scroll-x/scroll-y를 걸지 않는다(건물·지평선이 화면 중앙에서 잘린다) — scroll-x는 상단 하늘 띠(x:0, y:28, width:384, height:44)에만 걸고 마을 분수대·수호 수정·창문은 작은 직사각형(width:28..48, height:24..40) palette-cycle을 쓰며, 전체 화면 하강/패닝은 반드시 모든 샷에 animate_opening_camera(예: y:96->114 하강 또는 zoom:1.04->1.14)로 넣는다. ③ 인물·기사·주민·주인공을 author_pixel_art로 찍지 않는다(막대인간 절대 금지!) — 인물은 반드시 번들 24×32 캐릭터 칩(현대·연애·학원·오피스는 oprn-charset-modern1~3, 중세·판타지 JRPG는 oprn-charset-heroes1, easyrpg-charset-actor1~4, easyrpg-charset-people1~5)을 place_opening_charset_actor로 놓는다(scale:1 = 24×32, 보폭 걷기 자동 연결). 성당 맹세 샷에는 기사 5~7명을 2열 대열로 배치하고 대장이 제단으로 걸어가게 하며, 새벽 마을 샷에는 분수대 광장 둘레에 주민 5~6명을 배치하고 1~2명이 걷게 하며, 수정이 마젠타 눈에 죽어가는 샷에는 황금 수정 동굴 배경 위에 독립 전경 레이어(role:foreground 또는 author_pixel_art 소품)로 마젠타 눈/덩굴을 얹어 opacity/scale 키로 서서히 깨어나게 연출한다. ④ 말풍선(upsert_opening_emote)은 width:12, height:14 소형으로 마을 광장(주민 2~3명)과 절벽(주인공 exclaim 1개) 1~2개 샷에만 절제해 쓰고 성당 맹세나 수정 동굴에는 절대 쓰지 않는다. ⑤ 샷마다 최소 3개 이상의 독립 움직임(카메라 키 + region 루프 + shaft/glow pulse + particles + 캐릭터 칩 보행)을 겹친다. ⑥ 샷 사이는 set_opening_transition으로 dither(600ms)를 최소 2~3개 샷에, 충격/검 뽑기/타이틀 등장에는 flash(240ms)를, 나머지에는 fade를 섞는다. ⑦ 마지막 타이틀 로고 샷에서 검/문장 엠블럼 소품은 상단(y:16..44)에 두어 중앙 제목/부제 글자(y:82..135)와 겹치지 않게 하고, 시작 맵은 그대로 유지하며 마지막 로고 샷 뒤에 여분 맵 전환 샷은 만들지 않는다.
오프닝 형식은 하나가 아니다. 요청에 맞춰 get_opening_direction의 recipes(storybook·cinematic·pixel-march(FF6풍 무대사 없는 행진)·title-card·trailer-montage·memory-fragment·credits-roll·duel) 중 고르거나 섞는다. 사용자가 특정 작품풍을 말하면 그 작품의 기법(연출 호흡·무대사 여부·음악 역할)을 따르고 화풍은 기법 문장으로 쓴다. 이야기를 글로 설명하는 것이 기본값이 아니다.
글자 크기: 오프닝 무대는 320×240 논리 픽셀이 3배로 보인다. presentation.text.size는 자막 10~13, 장 제목 최대 16. 글자는 그림의 주 피사체를 가리지 않는 자리(bottom)에 두고 한 컷 1~2줄로 줄인다. 큰 글씨를 기본으로 두지 않는다.
진행 중에는 지금 무엇을 하는지(후보 생성·판정·ffmpeg 등) 사용자에게 한 줄로 알리고 실행기가 띄우는 진행 표시와 모순되지 않게 한다.
시각 전달 증거와 구성 검토는 실행기가 확인한다. 실제 출하 플레이어의 재생·음악·Skip 검증은 별도이며 이 도구만으로 완료했다고 주장하지 않는다. 막힌 단계와 미검증 범위를 정확히 보고한다.`;
