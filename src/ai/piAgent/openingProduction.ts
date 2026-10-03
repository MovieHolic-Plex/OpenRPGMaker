import type { Project } from '../../project/types';
import { resolveAssetResourceUrl } from '../../assets/generatedAssetResourceResolver';

/** Image transport only, never a saveable proposal. Avoid resending every draft PNG per preview. */
export function openingImageProject(project: Project, resourceIds: readonly string[]): Project {
  return structuredClone({ ...project, maps: {}, tilesets: {}, database: {} as Project['database'], assets: { ...project.assets, sprites: {},
    uploaded: Object.fromEntries(resourceIds.flatMap(id => project.assets.uploaded[id] ? [[id, project.assets.uploaded[id]]] : [])),
  } });
}

export function requestsOpeningProduction(task: string): boolean {
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
  constructor(readonly requested: boolean, private readonly task = '') {}
  record(name: string, ok: boolean, project: Project, args?: unknown): void {
    if (!ok) return;
    if (name === 'plan_opening') { this.plan = true; const shots = (args as { shots?: unknown } | undefined)?.shots; this.plannedShotCount = Array.isArray(shots) ? shots.length : 0; }
    if (name === 'review_opening') this.reviewed = this.fingerprint(project);
  }
  saw(project: Project, resourceId: string): void {
    this.viewed.set(resourceId, this.media(project, resourceId));
  }
  private media(project: Project, id: string): string { return JSON.stringify(project.assets.uploaded[id] ?? resolveAssetResourceUrl(id, { project }) ?? null); }
  fingerprint(project: Project): string { return JSON.stringify(project.system.opening ?? null); }
  inspect(project: Project, base: Project): string[] {
    if (!this.requested) return [];
    const issues: string[] = [];
    if (this.fingerprint(project) === this.fingerprint(base)) issues.push('오프닝 설정이 요청 전과 같습니다. 실제 변경 또는 변경하지 못한 이유를 보고하세요.');
    if (!this.plan) issues.push('plan_opening으로 사건·구도·연속성·플레이 진입을 설계하세요.');
    const opening = project.system.opening;
    if (!opening?.enabled || !opening.scenes?.length) issues.push('새 게임에서 재생할 오프닝이 활성화되지 않았습니다.');
    if (this.plannedShotCount && opening?.scenes.length !== this.plannedShotCount && !opening?.scenes.some(s => s.kind === 'video')) issues.push(`제출한 계획 ${this.plannedShotCount}샷과 연결된 ${opening?.scenes.length ?? 0}장면이 다릅니다. 계획을 실제 장면으로 연결하거나 변경 이유를 반영해 계획을 수정하세요.`);
    if (/설명.{0,12}(?:길|대신)|그림.{0,8}중심/iu.test(this.task) && opening?.scenes.some(s => (s.narration?.length ?? 0) > 80)) issues.push('요청은 그림으로 사건을 보여주는 도입입니다. 80자를 넘는 설명을 장면 위에 붙이지 말고 사건/동작을 실제 그림으로 옮기세요.');
    for (const id of new Set((opening?.scenes ?? []).filter(s => s.kind === 'image').map(s => s.resourceId ?? ''))) {
      if (!id || this.viewed.get(id) !== this.media(project, id)) issues.push(`show_opening_image로 현재 그림 ${id || '(미지정)'}의 실제 이미지를 확인하세요. 이름 조회는 시각 검수가 아닙니다.`);
    }
    if (this.reviewed !== this.fingerprint(project)) issues.push('마지막 변경 뒤 review_opening으로 연결·시간·읽기 속도를 검토하세요.');
    return issues;
  }
}

export const OPENING_PRODUCTION_PROMPT = `[오프닝 제작]
계획·진행·최종 보고는 사용자가 요청한 언어로 작성한다. 한국어 요청이면 한국어로 보고한다. 이미지 모델용 프롬프트는 영어여도 된다.
기존 오프닝·시작 세션·등장인물 리소스를 먼저 읽고 plan_opening으로 샷의 사건, 구도, 연속성, 플레이 진입을 설계한다. 장르와 사용자 의도가 우선이며 샷 수나 시간을 획일화하지 않는다.
get_opening.generatedStills에는 앞선 제작에서 만든 그림과 미연결 여부가 있다. 이미 생성한 그림을 활용하라는 요청이면 이 ID들을 실제로 보고 계획에 연결한다. list_opening_media는 프로젝트 그림을 공용 샘플보다 먼저 반환한다. 그림을 다시 만들기 전에 제작 중인 소재가 있는지 확인한다.
설명문을 배경 위에 반복하는 것으로 연출을 대체하지 않는다. 각 샷에서 무엇이 실제로 달라지고 다음 샷을 보고 싶게 하는지 정한다. 먼저 사건을 보여주고 필요한 문구만 붙인다. 동료 선택 전에는 이미 선택·소유한 동료처럼 그리지 않는다.
샷 사이의 시간대·광원·사건 결과를 유지한다. 꺼진 등대가 이유 없이 다시 켜지거나 같은 밤이 갑자기 노을로 바뀌면 생성 그림을 수정한다. 참고 그림의 분위기보다 현재 이야기의 사건 상태를 우선한다.
캐릭터와 장소가 나오면 show_opening_image로 실제 참고 외형을 보고 generate_opening_image의 referenceResourceIds로 전달한다. 새 그림은 실제 생성·등록된 resourceId만 사용한다. 생성 실패를 이름만 있는 리소스로 덮지 않는다.
generate_opening_image의 성공 응답에는 생성된 그림이 들어온다. 외형·사건·구도를 보고 필요하면 다시 생성한다. 기존 그림도 show_opening_image로 보고 연결한다. set_opening/edit_opening 후 review_opening으로 구성 검토한다.
현재 지원 연출은 정지 그림의 fade/pan/zoom, 글, 등록된 영상, 장면 음성, 전체 음악이다. 배우 애니메이션이나 영상 합성을 했다고 주장하지 않는다. 타이틀의 WebGL 효과는 오프닝 장면에 자동 적용되지 않는다.
시각 전달 증거와 구성 검토는 실행기가 확인한다. 실제 출하 플레이어의 재생·음악·Skip 검증은 별도이며 이 도구만으로 완료했다고 주장하지 않는다. 막힌 단계와 미검증 범위를 정확히 보고한다.`;
