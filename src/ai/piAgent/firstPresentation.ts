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
    const shots = opening.scenes.filter(scene => scene.kind === 'image');
    if (!opening.scenes.some(scene => scene.kind === 'video')) {
      if (shots.length < 3 || new Set(shots.map(scene => scene.resourceId)).size < 2) issues.push('첫 오프닝은 장소 소개 → 사건 발생 → 첫 행동으로 이어지는 세 컷과 서로 다른 실제 그림 2장 이상이 필요합니다. 한 그림 확대만으로 완료하지 마세요.');
      if (!shots.some(scene => scene.direction?.transition || scene.direction?.effects?.length || scene.direction?.soundResourceId)) issues.push('오프닝에 장면별 전환·빛/입자·효과음 연출이 없습니다. 실제 그림과 사건에 맞게 direction을 작성하세요.');
    }
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
  '먼저 세 컷을 설계한다: ① 장소와 인물의 상황을 보여주는 원경 ② 이상 현상/핵심 물체의 사건이 실제로 벌어지는 클로즈업 ③ 그 결과와 첫 플레이 행동으로 넘기는 중경. 같은 그림 확대만으로 사건이 발생했다고 설명하지 않는다. 서로 다른 실제 그림을 2장 이상 generate_opening_image(prompt,name,referenceResourceId?)로 만든다. 앞 그림을 referenceResourceId로 전달해 물체·인물·장소·화풍을 유지하되 구도와 사건 상태를 바꾼다.',
  'set_opening(enabled:true,skippable:true,scenes:[{kind:image,resourceId,narration,durationMs:4000,motion:none,direction}])으로 세 컷을 연결한다. 총 자동 재생 12초 이내, 각 durationMs는 양수. 자막은 컷당 짧은 한 문장이고 읽을 시간을 준다. 글만 있는 검은 화면이나 조작 대기 장면으로 대체하지 않는다.',
  'direction으로 장면별 전환·카메라·효과음의 리듬을 작성한다. transition:{kind:cut|dissolve|fade|flash,durationMs:0..1000}, camera:{from:[초점x,초점y,배율],to:[초점x,초점y,배율]}(x/y=0..1, 배율1..1.6), narrationDelayMs:0..2000, soundResourceId:실제SE id를 쓴다. 원경은 천천히, 사건 클로즈업은 컷, 행동 인계는 디졸브 등 의미에 맞춰 구성한다. 모든 컷의 동일 확대와 번쩍임 남발을 피한다.',
  'direction.effects는 최대4개, godRays(source/toward), glow(source), motes(source/toward 또는 region), mist(region)을 지원한다. 좌표는 실제 그림을 보고 정하고 intensity는 절제한다. region은 3~8개 [x,y] 좌표다. 움직이는 그림 자체가 필요한 사건은 별도 그림/영상을 생성한다. 입자와 카메라가 인물 애니메이션을 대신한다고 말하지 않는다.',
  '타이틀은 이야기의 인상, 오프닝은 사건의 시작, 실제 맵 도입은 첫 행동과 조작 안내를 맡는다. 기획과 맞는 구체적 장소/물체/인물을 보이고 같은 긴 설명을 반복하지 않는다. 이미 작성된 맵·선택 결과·엔딩·일회성 조작 안내는 보존한다.',
  'show_title_opening으로 연결된 타이틀과 모든 오프닝 그림을 보고 전체 원문 및 시작 맵 그림과 대조한다. 세 컷의 구도 차이·사건 전후·동일 물체·첫 행동 연결을 눈으로 검사하고 부족한 그림을 다시 만든다. 이미지 생성 실패·누락은 실패로 보고하며 기본 그림으로 바꾸고 성공이라 말하지 않는다. 실제 브라우저 재생을 했다고 주장하지 않는다.',
] as const;
