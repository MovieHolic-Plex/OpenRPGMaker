# lib/ 변경 기록
- `oblique.py`, `icons_v9_lib.py`: 커밋 0d48383ed / d2721b83f 의 사본. 렌더러 규칙(KX=.28, KY=.5, 법선 기반 밝기, 지면 그림자)은 그대로.
- 이 세트용 수정은 `oblique.py` 두 곳뿐: (1) `render()` 에 입체별 `post(tag, P, col, s, nrm)` 훅(창 격자·태양광 셀 같은 면 무늬), (2) 통계 역할 목록을 장면의 역할로 동적 확장.
- 새 입체(돔·구·절두원뿔·임의 방향 상자·원판)와 현대·SF 재질은 `modsf_kit.py` 에 있다(oblique 를 고치지 않고 덧붙임).
- (3) 그림자 계산에서 role 'steam'·'nocast' 제외.
