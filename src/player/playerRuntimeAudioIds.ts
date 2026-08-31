/**
 * 플레이어가 **프로젝트 데이터와 무관하게** 재생하는 오디오 리소스 id.
 *
 * 왜 목록이 따로 필요한가: 내보내기는 프로젝트 문자열을 훑어 사용처를 찾는다(webExportAssets).
 * 그런데 UI 효과음과 전투 효과음은 프로젝트가 아니라 **소스에 박힌 id** 로 재생된다 —
 * runtimeJuice 의 RUNTIME_JUICE_SPECS, battleJuice 의 BATTLE_SFX/SFX_FALLBACK,
 * playSceneActionCombat 의 SE_* 상수, playerStatusMenuMutations 의 아이템 사용음,
 * mapBgm 의 FALLBACK_BGM_RESOURCE_ID 가 그것이다. 훑기로는 보이지 않으므로 내보낼 때
 * 명시적으로 얹어야 한다.
 *
 * 실측으로 잡은 결함이다: 오디오 카탈로그를 사용처 집계에서 빼자 내보낸 게임이 타이틀에서
 * Decision1/Decision2.wav 를 404 로 받았다. 그전에는 카탈로그가 전량 실려서 우연히 따라왔다.
 *
 * 표를 직접 import 하지 않고 목록으로 둔 이유는 순환 참조를 피하기 위해서다(player 모듈들은
 * store 를 물고 있고, 이 목록은 project/webExportAssets 가 읽는다). 복사본이 낡는 문제는
 * test/playerRuntimeAudioIds.test.ts 가 소스를 훑어 막는다 — 새 id 를 박으면 그 테스트가
 * 먼저 빨개진다.
 */
export const PLAYER_RUNTIME_AUDIO_RESOURCE_IDS: readonly string[] = Object.freeze([
  // mapBgm — 맵에 BGM 이 지정되지 않았을 때의 폴백
  "cc0-bgm-field",
  // runtimeJuice — 메뉴/타이틀 UI
  "easyrpg-sound-buzzer1",
  "easyrpg-sound-cancel1",
  "easyrpg-sound-cancel2",
  "easyrpg-sound-cursor1",
  "easyrpg-sound-decision1",
  "easyrpg-sound-decision2",
  // battleJuice — 전투 연출 + RTP 판본 차이용 폴백
  "easyrpg-sound-attack1",
  "easyrpg-sound-barrier1",
  "easyrpg-sound-blow4",
  "easyrpg-sound-chime2",
  "easyrpg-sound-collapse1",
  "easyrpg-sound-collapse2",
  "easyrpg-sound-damage2",
  "easyrpg-sound-escape",
  "easyrpg-sound-evade1",
  "easyrpg-sound-fall1",
  "easyrpg-sound-recovery5",
  "easyrpg-sound-recovery7",
  // playSceneActionCombat — 액션 전투 타격음
  "easyrpg-sound-blow2",
  // playerStatusMenuMutations — 아이템 사용
  "easyrpg-sound-item1",
]);
