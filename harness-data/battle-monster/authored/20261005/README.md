# 몬스터 검토 후보 원본 · 2026-10-05

GPT 6.1 sol high가 원본 크기에서 직접 저작한 팔레트/문자 격자다.
기본 9자세와 스킬·독·기절·수면의 추가 9자세, 시간표와 독립 시각 검수 출처를 보존한다.
기존 네 몬스터의 기본 9자세는 앞선 조선 설화 팩에서 가져왔고 추가 자세만 새로 저작했다.
검객을 제외한 인간형 5종은 본체와 모든 자세를 새로 저작했다. 외부 그림/상용 게임 소재를 추출하지 않았다.

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

## 검객 전면 재제작

사용자의 「검객 다 지우고 다시만들어바」 요청으로 이전 검객 7후보를 모두 폐기했다.
현재 원본/후보 목록에서 motions-v1, reference-v3, silhouette-*, eyes-*를 제거했다.
이전 그림을 승인된 기준작이나 새로운 검객의 뼈대로 재사용하지 않는다.

새 검객 fresh-gat-v1은 빈 source에서 만든 검은 갓·회청 도포·남색 쾌자·붉은 허리띠 원안이다.
이 기본 자세의 팔레트/idle_a를 그대로 보존하고 fresh-gat-complete-v1에 나머지17자세를 직접
저작했다. 현재 manifest에는 완성18자세와 대기·공격·피격·쓰러짐·기술·독·기절·수면을
보여 주는8개 GIF 후보가 등록된다(이동은 공격 GIF의 돌진 구간이다).
fresh-gat-v1은 새 원안의 저작 출처이며, 완성 후보는 `ingest --phase suite`로 복원한다.
완성 후보의 `production-timing.json`은 대시보드8GIF의 실제 순서/노출 시간이다.
source/TIMING.md의 inspection GIF는 작가의 중간 검토 시간 제안이며 배포 시간표와 구별한다.
두 후보 모두 사용자 Allow를 자동으로 받지 않는다. 동작 제작을 위해 기본 자세를 승인했다고
기록하지 않았으며, 사용자가 검토 대기의 완성 후보에 Allow/Modify/Deny를 결정한다.
기본 자세가 검토 대기일 때는 대시보드에서 완성 후보 하나로 대체하고 source/실제 검수는 보존한다.
다른 종의 결정과 과거 원문은 변경하지 않는다.

독립 검수가 지적한 공격의 평평한 칼끝/짧은 칼집은 공격 한 자세의 지정 부위에서만
추가로 고쳤다. 다른17자세와 팔레트를 그대로 보존하며, `localized-repair.json`의 좌표와
`previous-critique-suite.json` 및 실제 추가 저작/재검수 job에 전후 근거가 있다.

이어진 검수에서 지적한 검 뽑기의 추출 축과 내딛기의 짧은 칼날도 해당 두 자세에서
추가로 맞췄다. 얼굴/갓과 다른16자세/팔레트는 보존하며, 중간 rework와
`weapon-continuity-repair.json` 및 실제 추가 저작/검수 job을 함께 남긴다.
