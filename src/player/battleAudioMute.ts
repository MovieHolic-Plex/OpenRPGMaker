// 전투 소리 잠금 — 편집기 안 전투 미리보기(editor/panels/battleScreenPreview.ts)가 켜 두는 동안 전투 소리를 모두 막는다.
//
// 전투의 소리는 한 곳이 아니다: WebAudio 합성음(battleSfx)·디코딩 샘플(battleSeSamples)·몬스터 세트(monsterSfx)·저작 슬롯의 오디오 엔진
// (playAudioCommand)·기술 이펙트 프레임 소리(battleAnimationDom)·팡파레(battleFanfareDom)가 각자 낸다. 미리보기는 편집 중에 몇 번이고
// 다시 도는 장면이라 소리가 새면 안 된다. 그래서 장면을 마운트한 쪽이 잠금을 쥐고(hold) 놓을 때까지 위 소리 낼 곳이 먼저 이 값을 본다.
// 실제 플레이·전투 테스트는 잠금을 쥐지 않으므로 아무것도 달라지지 않는다.

let holds = 0;

/** 전투 소리를 잠근다. 돌려받은 함수로 놓는다(여러 번 불러도 한 번만 놓인다). */
export function holdBattleAudioMute(): () => void {
  holds += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    holds -= 1;
  };
}

export function isBattleAudioMuted(): boolean {
  return holds > 0;
}
