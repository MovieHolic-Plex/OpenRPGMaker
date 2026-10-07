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

/** Evidence belongs to the executor, never to a model-supplied completed flag. */
export class PiOpeningProduction {
  private plan = false;
  private plannedShotCount = 0;
  private reviewed = '';
  private readonly viewed = new Map<string, string>();
  private readonly animatics = new Map<string, { fingerprint: string; times: number[] }>();
  constructor(readonly requested: boolean, private readonly task = '') {}
  record(name: string, ok: boolean, project: Project, args?: unknown): void {
    if (!ok) return;
    if (name === 'plan_opening') { this.plan = true; const shots = (args as { shots?: unknown } | undefined)?.shots; this.plannedShotCount = Array.isArray(shots) ? shots.length : 0; }
    if (name === 'review_opening') this.reviewed = this.fingerprint(project);
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
    if (this.fingerprint(project) === this.fingerprint(base)) issues.push('오프닝 설정이 요청 전과 같습니다. 실제 변경 또는 변경하지 못한 이유를 보고하세요.');
    if (!this.plan) issues.push('plan_opening으로 사건·구도·연속성·플레이 진입을 설계하세요.');
    const opening = project.system.opening;
    if (!opening?.enabled || !opening.scenes?.length) issues.push('지정한 위치에서 재생할 오프닝이 활성화되지 않았습니다.');
    if (this.plannedShotCount && opening?.scenes.length !== this.plannedShotCount && !opening?.scenes.some(s => s.kind === 'video')) issues.push(`제출한 계획 ${this.plannedShotCount}샷과 연결된 ${opening?.scenes.length ?? 0}장면이 다릅니다. 계획을 실제 장면으로 연결하거나 변경 이유를 반영해 계획을 수정하세요.`);
    if (/설명.{0,12}(?:길|대신)|그림.{0,8}중심/iu.test(this.task) && opening?.scenes.some(s => (s.narration?.length ?? 0) > 80)) issues.push('요청은 그림으로 사건을 보여주는 도입입니다. 80자를 넘는 설명을 장면 위에 붙이지 말고 사건/동작을 실제 그림으로 옮기세요.');
    for (const id of new Set((opening?.scenes ?? []).filter(s => s.kind === 'image').map(s => s.resourceId ?? ''))) {
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
generate_opening_image의 성공 응답에는 생성된 그림이 들어온다. 외형·사건·구도를 보고 필요하면 다시 생성한다. 기존 그림도 show_opening_image로 보고 연결한다. set_opening/edit_opening 후 review_opening으로 구성 검토한다.
get_opening_references에서 관련 게임의 실제 도입/타이틀 소개/홍보 영상과 확인 범위를 구별한다. 기법을 참고해 독자적인 사건과 화면을 저작하며 원작 소재를 게임 리소스로 복사하지 않는다.
에메랄드 교수의 Enter 확인식 소개에 눈깜빡임·말하기·손짓이 필요하면 실제로 그린 가로 포즈 스트립과 정지 초상을 configure_opening_portrait_motion으로 연결한다. frameWidth/frameHeight/frameCount/fps/frames와 기존 페이지 ID별 sceneFrames를 명시한다. Enter 페이지를 타이머로 바꾸거나 음악을 재시작하지 않는다. 하나의 그림을 위아래로 옮기는 것으로 새 포즈를 만들었다고 주장하지 않는다. 마지막 변경 뒤 실제 native 픽셀 재생과 정본 저장·재로드를 별도로 검증한다.
애니메틱 요청이면 get_animatic_capabilities를 읽고 create_opening_animatic_shot으로 시간축 무대를 만든다. upsert_opening_layer로 배경/배우/전경/글/효과를 나누고 animate_opening_layer/animate_opening_camera, 스프라이트 sheet/pose 키, set_opening_transition, upsert_opening_audio_cue로 실제 연출한다. 하나의 완성 그림에 zoom만 적용하는 것으로 독립 배우 동작을 대신하지 않는다. 움직임은 사건의 원인과 결과를 읽히게 하며 모든 배우를 이유 없이 흔들지 않는다.
배경 그림 속 배우는 독립 레이어가 아니다. 배경에 이미 그려진 배우 위에 같은 배우를 겹쳐 놓지 않는다. 필요하면 generate_opening_layer(role:background)로 배우 없는 장소, role:actor/prop/foreground로 실제 알파 분리 소재를 만든다. 실패한 단색 배경 제거를 투명 소재 성공이라고 하지 않는다. 기존 투명 그림과 정확한 crop/sheet도 재사용할 수 있다. 포즈를 만들지 않았다면 평면 이동을 골격 애니메이션이라고 부르지 않는다.
inspect_opening_timeline은 구조만 검사한다. preview_opening_animatic으로 각 샷의 시작/중간/후반 실제 합성 프레임을 보고 마지막 수정 후 다시 보라. 피사체가 화면 밖으로 나갔는지, 배경/배우 외형과 조명/접지/전경 가림이 맞는지, 글이 가리지 않는지 검토하고 구체적으로 수정한다. 2D 레이어/카메라/스프라이트 애니메틱과 등록된 영상 재생을 지원한다. 3D 리깅·골격 애니메이션·자동 영상/음성 생성을 했다고 주장하지 않는다. 타이틀 WebGL 효과는 오프닝에 자동 적용되지 않는다.
시각 전달 증거와 구성 검토는 실행기가 확인한다. 실제 출하 플레이어의 재생·음악·Skip 검증은 별도이며 이 도구만으로 완료했다고 주장하지 않는다. 막힌 단계와 미검증 범위를 정확히 보고한다.`;
