# 아스트라 스타터 3차 후보 (wip, 2026-10-23)

사용자가 도트 2차 판을 반려했다(「하나도 안 귀엽다, 생성형으로 아예 다른 느낌, 눈도 별로」).
이번 판은 강한 이미지 모델(8091 god-tibo-imagen, gpt-image)로 원화를 먼저 만들고, 사람이 고른다.

- `prompts/{a,b,c,d}.txt`: 네 화풍(카와이 치비 / 공식 일러스트 / 봉제·스티커 / 3D 비닐 피규어). 각 화풍이 풀·불·물 셋을 한 장에 담는다.
- `gen.py <prompt> <out.png>`: 8091 `/v1/generate/json` 호출(1536x1024).
- `convert.py <tag...>`: 마젠타 배경 제거 → 연결 성분으로 세 마리 분리 → A(64칸 도트: Lanczos 축소, 40색, 색 있는 1px 윤곽) / B(128px 매끈 축소).
- `page.py`: 고르기 시트 `~/claude-viz/astra-starters-3.html` 작성. 원본·중간 산출물은 `~/astra-starters-wip/s3/`에 있다.
- 사용자가 번호를 고르기 전에는 번들·게임에 넣지 않는다.
