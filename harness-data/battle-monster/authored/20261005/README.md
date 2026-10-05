# 몬스터 검토 후보 원본 · 2026-10-05

GPT 6.1 sol high가 원본 크기에서 직접 저작한 팔레트/문자 격자다.
기본 9자세와 스킬·독·기절·수면의 추가 9자세, 시간표와 독립 시각 검수 출처를 보존한다.
기존 네 몬스터의 기본 9자세는 앞선 조선 설화 팩에서 가져왔고 추가 자세만 새로 저작했다.
새 인간형 6종은 본체와 모든 자세를 새로 저작했다. 외부 그림/상용 게임 소재를 추출하지 않았다.

이 디렉터리는 **검토 후보**다. `manifest.json`은 사람의 선택이나 게임 설치를 선언하지 않는다.
현재 선택은 대시보드 ledger에서만 조회한다. 독립 검수 의견 역시 사람이 결정한 결과가 아니다.
게임 정본, 공용 자산 목록, 적 DB에는 아직 설치하지 않았다.

다른 체크아웃에서 AI가 복원할 때는 `ingest --phase suite`를 사용한다. 예:

```bash
npm run harness -- battle-monster ingest --monster mountain-bandit --candidate restored \
  --phase suite --source harness-data/battle-monster/authored/20261005/mountain-bandit/motions-v1/source/poses \
  --palette harness-data/battle-monster/authored/20261005/mountain-bandit/motions-v1/source/palette.json
```

복원은 원본을 굽고 검사한다. 예전 사용자 선택은 가져오지 않으며 새 검토 후보가 된다.
GIF는 `motions.py`가 프레임 원본과 실제 속도로 다시 굽는다.

## 검객 기본 자세 재검토

`wandering-swordsman/silhouette-sd-a`와 `silhouette-wuxia-b`는 각각 **idle_a 한 장만 있는**
체형 방향 후보다. 아직 18자세 완성 후보가 아니다. manifest의 phase/frames를 먼저 확인한다.
장포 후보는 실제 모델 저작이 429로 중단된 뒤 남은 완전한 격자를 회수했고, 별도 실제 high
검수를 완료했다. 중단 기록을 성공으로 바꾸지 않는다. 두 검수의 rework는 참고 의견이며
사용자의 선택을 대신하지 않는다. 원본 연구용 외부 PNG는 배포하지 않는다.

이 후보를 새 체크아웃에 복원할 때는 `ingest --phase idle`을 사용하고 새 독립 검수를 받는다.
과거 작업 폴더 경로를 가진 보존 job 기록은 저작/검수 출처이며 현재 사용자의 승인 기록이 아니다.

## 눈만 교정한 후보

`wandering-swordsman/eyes-v4`는 reference-v3의 18자세, `eyes-sd-a`와 `eyes-wuxia-b`는
각 체형의 대기 한 장에서 눈·눈꺼풀·콧등만 수정했다. 각각 98/6/5픽셀이 달라졌고,
`eye-repair.json`에서 모든 수정 좌표와 눈 주변 밖/팔레트/시간표 보존을 확인할 수 있다.
이전 전체 그림은 승인된 기준작이 아니며, 이번 결과도 사용자 선택을 받은 게임 자산이 아니다.
부모의 옛 source/previews를 함께 배포하지 않는다. 현재 격자에서 하네스로 다시 굽는다.
