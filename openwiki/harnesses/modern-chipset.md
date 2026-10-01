# modern-chipset — 현대(modern3) 칩셋 도트 하네스

타일셋 종류마다 하네스를 따로 둔다(조선·포켓몬풍 야외 등은 별도). 이 하네스는 modern3 현대 거리 칩셋 전용이고, 기물 종류(kind)는 이 안에서 늘린다. 지금은 `vehicle` 만 있다.

modern3 팔레트 거리 칩셋(도쿄 지구 맵용 `jp_shopstreet16`)의 자동차·버스·트럭·열차를 **3/4 시점**으로 찍는다.
생성 이미지가 아니라 pxgrid 로 한 글자씩 놓는 손 도트다(`monster-collect-species` 와 다르다).

## 왜 만들었나 (2026-10-01)
- 지금 탈것은 순수 옆모습 + 윗띠 4px 였다. 당시 QA 규칙이 「윗띠가 있으면 통과」라 전부 통과했다.
- 이 프로젝트에서 받아들여진 기준은 `public/assets/modern-exteriors/modern-city-atlas.png` 의 경찰차(픽셀 박스 383,104–466,146):
  옆면 위에 지붕·보닛·트렁크 윗면이 큰 면으로 보이고, 앞·뒤 유리는 윗면 사이 기울어진 띠다. 색도 단계만 쓰지 않는다.
- 감독이 직접 그리면 윗면이 각진 상자가 된다. 취향 판단은 사람이 한다 — 후보 5장을 사람이 고른다.

## 흐름
```
draw car side ─► 판 v<MMDD-HHMMSS> (qa-runs/harnesses/modern-chipset/<판>/)
   Sonnet 5.5 high × 5 (방향 A 기준 충실 · B 지금 차에서 출발 · C 둥근 차체 · D 낮고 날렵 · E 자유)
   → check.py (캔버스·투명 귀퉁이·# 잔존·윤곽 90%·접지·바퀴·한 덩어리·앞/뒤 대칭)  불합격이면 이유 들고 다시 그림
   → 독립 검수자(review.md): ref|old|후보 8배 + 3배 길 위 그림, 윗면 행 수를 세어 PASS/FAIL  FAIL 이면 다시 그림(최대 3번)
sheet ─► ~/claude-viz/veh-<판>.html (자체완결)   사용자가 고른다
pick ─► harness-data/modern-chipset/picked/<탈것>-<시점>.pxg|png + ledger.json (다음 판의 화풍 기준)
```

## 파일
| 경로 | 역할 |
|---|---|
| `src/harnesses/modern-chipset/harness.py` | 명령줄 본체 |
| `palette.py` | modern3 램프 → 글자 팔레트(`vehicles.pal` 생성). 이 밖의 색은 못 쓴다 |
| `check.py` | 기계 검사(시점은 수치로 대신하지 않는다) |
| `prompt.md` · `review.md` | 작업자·검수자 지시문 |
| `harness-data/modern-chipset/seed.json` | 기준 그림 위치·계약·탈것/시점 정의 |
| `harness-data/modern-chipset/old/` | 지금 쓰던 그림(비교용) |

## 함정
- 검수 ✓ 는 보증이 아니다 — 사용자가 고른 것만 정본. 통과율 숫자를 근거로 쓰지 마라.
- 차체는 `conc` 회색 램프로 찍고 색 변형(빨강·택시·흰색)은 램프 교체로 만든다(아직 미구현 — bake 단계 예정).
- 앞/뒤 시점은 프로젝트 안에 기준이 없다. 옆면 시점이 골라진 뒤 그 그림(anchors)을 화풍 기준으로 쓴다.
