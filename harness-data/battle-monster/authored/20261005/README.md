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
