import type { Project } from '../../project/types';
import { resolveAssetResourceUrl } from '../../assets/generatedAssetResourceResolver';
import { animaticResourceIds } from '../../project/openingAnimatic';

/** Image transport only, never a saveable proposal. Avoid resending every draft PNG per preview. */
export function openingImageProject(project: Project, resourceIds: readonly string[]): Project {
  return structuredClone({ ...project, maps: {}, tilesets: {}, database: {} as Project['database'], assets: { ...project.assets, sprites: {},
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
export function withoutAuthoringPresetManual(task: string): string {
  return task.replace(/AUTHORING_PRESET_BEGIN [\s\S]*?AUTHORING_PRESET_END[^\n]*/gu, '');
}

export function requestsOpeningProduction(rawTask: string): boolean {
  const task = withoutAuthoringPresetManual(rawTask);
  return /오프닝|opening\b/iu.test(task)
    && /만들|제작|연출|개선|새로|바꿔|바꾸|다시|멋|밋밋|create|design|rewrite|improve|polish|redo/iu.test(task)
    && !/오프닝(?:\s*기능)?(?:을|은|만)?\s*(?:끄|꺼|비활성|삭제)|(?:disable|remove)\s+(?:the\s+)?opening/iu.test(task);
}

/** 정지 컷 나열이 아니라 «실제 맵 위에서 인물이 움직이는 인게임 장면»으로 여는 오프닝 요청. */
export function requestsInGameOpening(rawTask: string): boolean {
  const task = withoutAuthoringPresetManual(rawTask);
  return /오프닝|opening\b|도입/iu.test(task)
    && /인게임|in-?game|게임\s*화면|실제\s*(?:맵|장면|게임\s*화면)|맵\s*(?:위|에서)|(?:캐릭터|병사|로봇|기계|인물|주인공)\w*\s*(?:가|이)?\s*(?:직접\s*)?(?:걸어|걷|행진|움직|달려)|컷신|연출\s*장면|그림\s*(?:나열|슬라이드)\s*(?:말고|아니)/iu.test(task);
}

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
  /** 인게임 컷신 객관 측정+독립 판정 결과 — 시작 맵 이벤트 명령 지문에 묶인다(바뀌면 무효). */
  private cutsceneReview?: { readonly fingerprint: string; readonly probeIssues: readonly string[]; readonly judge?: { readonly verdict: string; readonly fix: string; readonly scores: Readonly<Record<string, number>>; readonly judge: string } };
  recordCutsceneReview(fingerprint: string, probeIssues: readonly string[], judge?: { verdict: string; fix: string; scores: Record<string, number>; judge: string }): void { this.cutsceneReview = { fingerprint, probeIssues, ...(judge ? { judge } : {}) }; }
  hasCutsceneReview(fingerprint: string): boolean { return this.cutsceneReview?.fingerprint === fingerprint; }
  cutsceneFingerprint(project: Project): string { return JSON.stringify(project.maps[project.startMapId]?.events ?? []); }
  cutsceneReviewSummary(): string { const r = this.cutsceneReview; return r ? `측정 문제 ${r.probeIssues.length}건, 독립 판정 ${r.judge ? `${r.judge.judge}:${r.judge.verdict}` : '없음'}` : '미실시'; }
  constructor(readonly requested: boolean, private readonly task = '') { this.inGame = requested && requestsInGameOpening(task); }
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
      // 업로드한 캐릭터셋(걷는 칩)이 있는데 컷신이 안 쓰면 — 그림 슬라이드 대신 맵 위를 진짜로 걷는 칩이 시점·크기·걷기까지 맞다.
      const madeCharsets = Object.values(project.assets.uploaded).filter(a => a.kind === 'charset');
      if (madeCharsets.length && start && /"kind":"auto"/u.test(events) && !madeCharsets.some(a => events.includes(a.id))) {
        issues.push(`프로젝트에 업로드한 캐릭터셋 ${madeCharsets.map(a => `${a.id}(${a.name})`).join(', ')} 이(가) 있는데 시작 맵 컷신이 쓰지 않았습니다. 이야기에 맞는 인물·기계가 있으면 그림 대신 캐릭터셋을 배우로 쓰세요: script_cutscene_staged actors:[{name, character:{resourceId:"<캐릭터셋 id>", characterIndex:0~7}, scale}] (characterIndex 는 4열×2행 칸, 걷기 프레임은 자동). 크기는 scale 로 키웁니다.`);
      }
      if (/타이틀|title|켜자마자|첫\s*화면/iu.test(this.task) && !this.titleArt && !/^title_art_/u.test(String(project.system.titleScreen?.backgroundResourceId ?? ''))) issues.push('게임을 켜자마자 보이는 타이틀 화면이 기본 그림입니다. generate_title_art로 작품 전용 그림을 만드세요.');
      return issues;
    }
    if (this.fingerprint(project) === this.fingerprint(base)) issues.push('오프닝 설정이 요청 전과 같습니다. 실제 변경 또는 변경하지 못한 이유를 보고하세요.');
    if (/타이틀|title|첫\s*(?:화면|장면)|처음\s*(?:화면|장면)|시작\s*화면|켜자마자|켜면|게임을\s*켤/iu.test(this.task) && !this.titleArt && !/^title_art_/u.test(String(project.system.titleScreen?.backgroundResourceId ?? ''))) issues.push('요청에 게임을 켜자마자 보이는 첫 화면(타이틀)이 포함됩니다. 기본 이미지를 두지 말고 오프닝과 같은 화풍·모티프로 generate_title_art(artStyle·light·palette·candidates 지정)를 실행하고 set_title_screen으로 음악·효과를 구성하세요.');
    if (/효과음|\bsfx\b|사운드|이펙트|sound\s*effect/iu.test(this.task) && project.system.opening?.scenes?.length && !project.system.opening.scenes.some(s => s.kind === 'image' && (s.direction?.sounds?.length || s.direction?.soundResourceId))) issues.push('효과음을 요청받았지만 어느 장면에도 효과음이 연결되지 않았습니다. 장면 direction.sounds[{resourceId,atMs,volume}]로 사건 시각마다 effect를 연결하고(edit_opening op:update), 연결하지 않았다면 연결했다고 보고하지 마세요.');
    for (const sc of project.system.opening?.scenes ?? []) if ((sc.presentation?.text?.size ?? 0) > 14) issues.push(`${sc.id}: presentation.text.size ${sc.presentation!.text!.size}는 너무 큽니다. 무대는 320×240 논리 픽셀이라 화면에서 3배로 보입니다. 자막은 10~13, 장 제목은 최대 16으로 줄이세요.`);
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
    for (const scene of opening?.scenes ?? []) if (scene.kind === 'animatic') {
      const preview = this.animatics.get(scene.id);
      if (preview?.fingerprint !== this.animaticFingerprint(project, scene.id) || preview.times.length < 2 || Math.max(...preview.times) - Math.min(...preview.times) < scene.durationMs * 0.25) issues.push(`${scene.id}: 마지막 변경 뒤 preview_opening_animatic으로 충분히 떨어진2개 이상의 실제 시간 표본을 보세요.`);
      if (!scene.composition.layers.length) issues.push(`${scene.id}: 애니메틱 무대가 비어 있습니다.`);
    }
    if (this.reviewed !== this.fingerprint(project)) issues.push('마지막 변경 뒤 review_opening으로 연결·시간·읽기 속도를 검토하세요.');
    return issues;
  }
}

export const OPENING_PRODUCTION_PROMPT = `[오프닝 제작]
계획·진행·최종 보고는 사용자가 요청한 언어로 작성한다. 한국어 요청이면 한국어로 보고한다. 이미지 모델용 프롬프트는 영어여도 된다.
기존 오프닝·시작 세션·등장인물 리소스를 먼저 읽고 plan_opening으로 샷의 사건, 구도, 연속성, 플레이 진입을 설계한다. 장르와 사용자 의도가 우선이며 샷 수나 시간을 획일화하지 않는다.
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
배경 그림 속 배우는 독립 레이어가 아니다. 배경에 이미 그려진 배우 위에 같은 배우를 겹쳐 놓지 않는다. 필요하면 generate_opening_layer(role:background)로 배우 없는 장소, role:actor/prop/foreground로 실제 알파 분리 소재를 만든다. 실패한 단색 배경 제거를 투명 소재 성공이라고 하지 않는다. 기존 투명 그림과 정확한 crop/sheet도 재사용할 수 있다. 포즈를 만들지 않았다면 평면 이동을 골격 애니메이션이라고 부르지 않는다.
inspect_opening_timeline은 구조만 검사한다. preview_opening_animatic으로 각 샷의 시작/중간/후반 실제 합성 프레임을 보고 마지막 수정 후 다시 보라. 피사체가 화면 밖으로 나갔는지, 배경/배우 외형과 조명/접지/전경 가림이 맞는지, 글이 가리지 않는지 검토하고 구체적으로 수정한다. 2D 레이어/카메라/스프라이트 애니메틱과 등록된 영상 재생을 지원한다. 3D 리깅·골격 애니메이션·자동 영상/음성 생성을 했다고 주장하지 않는다. 타이틀 WebGL 효과는 오프닝에 자동 적용되지 않는다.
인게임 오프닝: 요청이 «그림 나열이 아니라 실제 게임 장면/캐릭터가 움직이는 연출/컷신»이면 system.opening 장면을 만들지 않는다. 시작 맵을 이야기에 맞게 직접 지은 뒤(맵 도구) 그 맵 위에서 script_cutscene_staged(또는 script_cutscene)에 trigger:"auto", once:true로 연출한다. 순서와 조합은 이야기가 정한다 — 정해진 틀이 없다. 쓸 수 있는 어휘: 배우 입장·이동·퇴장(enter/move/exit, anim:'walk'=캐릭터셋 걷기 프레임 / 'bob'=걷기 프레임 없는 그림의 발걸음 출렁임), 배우 크기(scale %), 화면 색조(tint: 밤·노을·피·회상), 날씨(weather), 영화식 띠(letterbox), 맵 카메라(camera), 대사·내레이션(say), 효과음·음악(se/bgm), 암전·번쩍임·흔들림(fade/flash/shake), 맵 이동(transfer). 무엇을 쓸지는 «이 장면이 관객에게 어떤 감정을 주려는가»에서 고른다. 어떤 연출이든 지킬 기준: ①중심 대상이 화면에 보이고 움직인다(안 보이는 배우 금지) ②크기·간격이 화면과 어울린다(풍경 속 인물은 작게, 겹치지 않게) ③색조·날씨가 이야기의 시간·기분과 맞는다 ④글자가 읽힌다 ⑤소리가 시각 사건과 같은 시각에 실제로 깔린다 ⑥끝나면 조작이 넘어간다. 먼저 read_directing_guide를 읽고, 배치·미리보기(show_map_region·preview_cutscene)를 눈으로 확인해 위 기준을 점검한다. 효과음은 generate_original_se로 장면에 맞게 합성해 se 단계에 넣는다.
오프닝은 플레이어가 게임을 켜자마자 보는 첫 화면(타이틀)까지 포함한다. 요청이 첫 화면을 포함하면 기본 타이틀 그림을 그대로 두지 말고 bible의 화풍·모티프·팔레트로 generate_title_art(artStyle·light·palette·candidates 2~3)를 실행한 뒤 set_title_screen으로 타이틀 음악·효과를 정한다.
효과음은 자유롭게 설계한다. generate_original_se로 장면에 맞는 소리(발걸음·바람·금속 마찰·종소리·균열 등)를 여러 개 합성하고, 장면 direction.sounds[{resourceId,atMs,volume}]로 시각 사건의 시각(atMs)에 맞춰 최대 8개까지 겹쳐 연결한다. 하나의 soundResourceId만 쓰는 것으로 끝내지 않는다. 모델은 소리를 듣지 못하므로 타이밍은 샷의 사건 시각에서 계산한다.
영상·소리·이미지 가공이 필요하면 run_ffmpeg(inputs=리소스 id, args의 {in0}/{out})로 컷 이어붙이기·페이드·색 보정·소리 믹스·PNG→mp4를 직접 수행해 새 리소스로 등록한다. 외부 파일·네트워크는 쓸 수 없다.
타이틀 키아트의 prompt에는 주인공이나 작품의 상징 사물을 시선의 중심에 명시한다(빈 풍경 금지). 배경 키아트를 set_title_screen의 titleGraphic(로고 그림 전용)에 넣지 않는다 — 로고 그림이 없으면 mode:text.
오프닝 형식은 하나가 아니다. 요청에 맞춰 get_opening_direction의 recipes(storybook·cinematic·pixel-march(FF6풍 무대사 없는 행진)·title-card·trailer-montage·memory-fragment·credits-roll·duel) 중 고르거나 섞는다. 사용자가 특정 작품풍을 말하면 그 작품의 기법(연출 호흡·무대사 여부·음악 역할)을 따르고 화풍은 기법 문장으로 쓴다. 이야기를 글로 설명하는 것이 기본값이 아니다.
글자 크기: 오프닝 무대는 320×240 논리 픽셀이 3배로 보인다. presentation.text.size는 자막 10~13, 장 제목 최대 16. 글자는 그림의 주 피사체를 가리지 않는 자리(bottom)에 두고 한 컷 1~2줄로 줄인다. 큰 글씨를 기본으로 두지 않는다.
진행 중에는 지금 무엇을 하는지(후보 생성·판정·ffmpeg 등) 사용자에게 한 줄로 알리고 실행기가 띄우는 진행 표시와 모순되지 않게 한다.
시각 전달 증거와 구성 검토는 실행기가 확인한다. 실제 출하 플레이어의 재생·음악·Skip 검증은 별도이며 이 도구만으로 완료했다고 주장하지 않는다. 막힌 단계와 미검증 범위를 정확히 보고한다.`;
