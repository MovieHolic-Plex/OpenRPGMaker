import type { Project } from '../../project/types';
import { presentationArtIds } from '../../editor/tools/presentationTools';

/** Minimum structural contract; semantic artwork review and shipping-player QA are separate. */
export function inspectFirstPresentation(project: Project): string[] {
  const issues: string[] = [];
  const title = project.system.titleScreen;
  if (!title?.title?.trim() || /^(새 프로젝트|새 게임|New Project|New Game)$/iu.test(title.title.trim())) issues.push('작품의 타이틀 제목이 없습니다.');
  const art = title?.backgroundResourceId ? project.assets.uploaded[title.backgroundResourceId] : undefined;
  if (!art || !(art.dataUrl || art.ref) || !['title', 'picture', 'backdrop'].includes(art.kind)) issues.push('작품 전용 타이틀 배경이 없습니다. 기본 마을 그림과 제목 교체만으로 완료할 수 없습니다.');
  if (!title?.logoStyle || !title.sequence || !title.transition) issues.push('타이틀의 로고·등장 순서·새 게임 전환을 작성해야 합니다.');
  if (title?.backgroundFit !== 'cover') issues.push('타이틀 그림은 비율을 보존하면서 화면 전체를 채워야 합니다(backgroundFit:cover).');
  const opening = project.system.opening;
  if (!opening?.enabled || !opening.scenes.length) issues.push('첫 제작의 오프닝이 꺼져 있거나 비어 있습니다. 실제 그림이 있는 짧은 도입을 작성하세요.');
  else {
    if (!opening.scenes.some(scene => scene.kind === 'image' || scene.kind === 'video')) issues.push('오프닝이 검은 화면의 글뿐입니다. 작품의 장면 그림/영상이 필요합니다.');
    if (opening.scenes.some(scene => scene.durationMs <= 0) || opening.scenes.reduce((sum, scene) => sum + scene.durationMs, 0) > 12_000) issues.push('첫 오프닝은 모든 장면이 자동 진행되고 총 12초 이내여야 합니다.');
    if (!opening.skippable) issues.push('첫 오프닝을 건너뛸 수 있어야 합니다.');
    if (!opening.scenes.some(scene => scene.narration.trim())) issues.push('첫 오프닝에 이야기의 계기와 첫 행동을 잇는 짧은 서술이 없습니다.');
  }
  for (const id of presentationArtIds(project)) {
    const image = project.assets.uploaded[id];
    if (!image || !(image.dataUrl || image.ref) || !['title', 'picture', 'backdrop'].includes(image.kind)) issues.push(`실제 그림을 검수할 수 없는 타이틀/오프닝 리소스입니다: ${id}`);
  }
  return issues;
}

export const FIRST_PRESENTATION_INSTRUCTIONS = [
  '작품 전용 타이틀과 실제 장면 오프닝은 첫 제작의 필수 결과물이다. 기본 눈 덮인 마을에 제목만 바꾸거나 system.opening을 끄고 완료하지 않는다.',
  '전체 사용자 기획과 완성된 시작 장소/핵심 물체를 확인한다. generate_title_art(prompt,name,title,logoSubtitle)로 작품 전용 키아트를 만들면 그림 등록과 타이틀 연결까지 자동 수행된다. 존재하지 않는 resourceId를 만들지 않는다.',
  'set_title_screen으로 logoStyle, logoSubtitle, sequence(예:fadeMs:1200,logoAtMs:800,menuAtMs:1800,logoReveal:rise), transition(예:kind:fade,durationMs:700), menuStyle을 작품에 맞게 구성한다. 그림은 cover/smooth로 화면 전체를 채운다. 효과는 생성된 그림의 실제 빛·물·안개에 맞는 자리만 쓴다.',
  'generate_opening_image(prompt,name)로 실제 첫 장소와 핵심 사건을 보여주는 별도의 전체화면 장면을 만든다. 반환된 resourceId를 set_opening(enabled:true,skippable:true,scenes:[{kind:image,resourceId,narration,durationMs,motion}])에 연결한다. 한두 장면, 총 자동 재생 12초 이내, 각 durationMs는 양수다. 글만 있는 검은 화면이나 조작 대기 장면으로 대체하지 않는다.',
  '타이틀은 이야기의 인상, 오프닝은 사건의 시작, 실제 맵 도입은 첫 행동과 조작 안내를 맡는다. 기획과 맞는 구체적 장소/물체/인물을 보이고 같은 긴 설명을 반복하지 않는다. 이미 작성된 맵·선택 결과·엔딩·일회성 조작 안내는 보존한다.',
  'show_title_opening으로 연결된 실제 두 그림을 보고 전체 원문 및 시작 맵 그림과 대조한다. 이미지 생성 실패·누락은 실패로 보고하며 기본 그림으로 바꾸고 성공이라 말하지 않는다. 실제 브라우저 재생을 했다고 주장하지 않는다.',
] as const;
