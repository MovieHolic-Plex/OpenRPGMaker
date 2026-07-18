# 전투 스킨 에셋 규약

- 투명 영역은 **#00FF00 (순수 초록)** 로 칠한다. 다른 투명 표현 금지.
- 임포트 시 `scripts/assets/chromaKey.mjs` 의 `chromaKeyToAlpha` 로 알파 변환.
- 배틀러: 스킨 레이아웃에 맞춘 방향(sideview=측면, frontview=정면/후면, firstperson=적만).
- 배경(backdrop): 스킨별 1장 이상, 16:9 또는 4:3.
- 생성/편집은 **Codex CLI** 로만. 결과는 generated-asset manifest 에 등록 → DB Resources 탭에서 확인.
- 파일명: `battle-skin-<id>-<enemy|ally|backdrop>-NN.png`.
