# 조선 적3종 — 배포용 문자 격자

각 종 폴더의9개 `.pxgrid`는 64행×64열이다. `.`은 완전 투명, 나머지 글자는
바깥의 `<slug>.palette.json` 색을 사용한다. 원본 픽셀을 확대하거나 보간하지 않는다.

순서: idle_a/b/c → windup/move/attack → recover/hit/dead.
`../refined.py`가 직접 픽셀에 배정하고 `../draw.py`가 192×192 시트와64×64 초상으로 묶는다.
기존 `jf-enemy-*` 리소스 ID·motion·idleFrameMs를 유지한다.

저작 이력·초안·수정 코드·작업자 시각 검토는
`../../../art-direction/monsters/refinement/`에 있다. 프로젝트에서 직접 저작한 코드 도트이며
생성 이미지나 상용 게임 그림을 사용하지 않았다. 사용자 지시: 숲은 현재 유지, 적은 후보 방향으로 교정.
