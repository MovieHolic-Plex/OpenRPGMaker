# 나루 v2: 원작 판형에 부분 저작

사용자 지시: 기존 캐릭터를 판형으로 삼아 해당 부분을 수정한다. 작은 활동적인 캐릭터에 맞는 Emerald Camper를 선택했다. 한 판형을 모든 연령·직업에 공통 사용하지 않고, 역할에 맞는 기존 체형을 고른 뒤 필요한 부분을 바꾼다.

## 유지와 수정

- 유지: 원작 체형, 눈·표정의 주요 배치, 손·다리의 포즈, 발 교대와 접지, 1px 상하 움직임, 네 방향 프레임 순서.
- 수정: 녹색 모자를 적갈색 짧은 머리로 교체, 청록 재킷·밝은 목수건·지도 배낭으로 복장 수정. 앞·뒤·좌우 각 포즈의 수정 행을 명시했다.
- `template.json`: 원작 SHA, 선택한 팔레트 변경, 12포즈별 부분 행 수정. 원본 그림이 바뀌면 재현을 거부한다. 하단4행의 픽셀 색 번호/투명/발 배치는 그대로이며 팔레트에 따른 색은 바뀐다.
- 원작은 Nintendo / Game Freak / Creatures 작품. Codex GPT-6가 일부 픽셀과 색을 수정한 파생 그림이며, 처음부터 독립적으로 그린 원화라고 부르지 않는다.

`template.py`가 원작 9칸을 네 방향12포즈로 배치한다. 원작 동쪽의 hFlip은 원작 계약대로 한 뒤 명시한 오른쪽 부분 수정을 적용한다. 자동 윤곽 교정이나 리사이즈는 하지 않는다. 모든 변경은 기록된 행 또는 팔레트에 대응한다.

`template.png`는 원작, `charset.png`는 수정본, `changes.png`는 RGBA가 달라진 픽셀(주황색)이다. 변경 표시에는 팔레트 수정도 포함된다. 실제 걷기는 `walk.gif`에서 본다. 사진 배경의 `context.png`는 크기 비교 모형이며 게임 QA가 아니다.

## 재현

저장소 루트에서:

```sh
python3 src/harnesses/pokemon-character-casting/node/render-template.py \
  --spec harness-data/pokemon-character-casting/templates/naru-camper-v2/template.json \
  --candidate harness-data/pokemon-character-casting/templates/naru-camper-v2/candidate.json \
  --out /absolute/review/naru-template
npm run harness -- pokemon-character-casting queue --bundle /absolute/review/naru-template
```

규격 검사는 통과했고 후보는 사용자 검토 대기다. 기존 나루 E는 비교할 수 있게 보존했다.
