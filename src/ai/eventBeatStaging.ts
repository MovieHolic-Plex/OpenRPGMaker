// 충격 연출 지침. 이벤트 명령 조수와 스튜디오 조수가 같은 순서를 본다.
//
// 명령은 위에서 아래로 실행된다. 함정·피격을 대사 한 줄로 시작하면 플레이어는
// 맞는 그림과 소리를 보지 못한다. 화면을 덮는 애니메이션 id 를 프롬프트 앞에 둔다.

import type { BattleAnimationRecord, Project } from "@/project/types";

const MAX_ANIMATION_ENTRIES = 40;

const BEAT_ORDER = [
  "명령은 위에서 아래로 실행된다. 함정·피격·마법·폭발·사망처럼 화면이 바뀌는 사건은 대사로 시작하지 않는다.",
  "1. playAudio — 그 자리에 맞는 효과음. loop 는 false. resourceId 는 효과음 목록의 id.",
  "2. showAnimation — 맞은 대상(보통 target:\"player\"). wait:true 라서 연출이 끝난 뒤에야 다음 명령이 실행된다. animationId 는 전투 애니메이션 id.",
  "3. 그 다음 실제 변화(HP, 스위치, 이동, killPlayer).",
  "4. 마지막에 무슨 일이 있었는지 text.",
  "세계 컨셉에 맞춘다. 마법학교면 맨손 타격이 아니라 화면을 덮는 마법(목록에서 «화면을 덮음»인 마법 폭풍·운석·차원문)이 먼저 나오고, 그 다음에 파티가 바뀐다. 검술이면 검격, 공포면 낮은 효과음. id 를 지어내지 마라.",
].join("\n");

/** 이벤트 명령 JSON 조수용. 툴 이름은 넣지 않는다 — 출력은 커맨드 배열뿐이다. */
export const EVENT_BEAT_STAGING_BLOCK = [
  "## 충격 연출(문장만 두지 말 것)",
  BEAT_ORDER,
  "animationId 와 효과음 resourceId 는 이 프롬프트에 적힌 id 만 쓴다. 게임오버 화면의 그림·제목은 이 명령 목록 밖이다.",
].join("\n");

/** 스튜디오 조수용. 같은 순서에, 게임오버 화면을 직접 고치는 툴을 붙인다. */
export const ASSISTANT_PRESENTATION_BLOCK = [
  "## 충격 연출(문장만 두지 말 것)",
  BEAT_ORDER,
  "animationId 는 get_database_records(collection:\"battleAnimations\")의 id, 효과음은 조회한 sound id. 둘 다 추측하지 마라.",
  "## 게임오버 화면",
  "손대지 않은 게임오버는 작은 창과 「게임 오버」뿐이다. 사망·함정·패배를 넣을 때 get_game_over 로 현재를 읽고, set_game_over 로 세계 컨셉에 맞는 제목·메시지·전체화면 배경을 넣는다.",
  "배경 id 는 list_opening_media(kind:\"image\")의 배경화·타이틀 아트다. 아이콘은 전체화면에 쓰지 마라. 맞는 그림이 없으면 generate_game_over_image 로 만든 id 를 set_game_over 의 backgroundResourceId 에 쓴다.",
  "killPlayer.message 는 그 순간의 한 줄이고, 화면 디자인은 system.gameOver 다.",
].join("\n");

function coversScreen(record: BattleAnimationRecord): boolean {
  return record.position === "screen" || record.scope === "screen" || record.scope === "allTargets" || record.large === true;
}

/** 화면을 덮는 연출을 앞에 둔다. 상한 뒤의 단발 타격만 잘리게 하기 위해서다. */
export function animationCatalogSection(project: Project): string {
  const ordered = [...project.database.battleAnimations].sort(
    (left, right) => Number(coversScreen(right)) - Number(coversScreen(left)),
  );
  const shown = ordered.slice(0, MAX_ANIMATION_ENTRIES);
  const lines = shown.map((record) => {
    const name = record.name || "(이름 없음)";
    const coverage = coversScreen(record) ? " (화면을 덮음)" : "";
    return `- ${record.id}: ${name}${coverage}`;
  });
  if (ordered.length > shown.length) {
    lines.push(`- …외 ${ordered.length - shown.length}개 생략(위 목록의 id만 사용)`);
  }
  return [
    "### 전투 애니메이션 id (showAnimation.animationId)",
    ...(lines.length ? lines : ["- (없음 — showAnimation을 만들지 말 것)"]),
  ].join("\n");
}
