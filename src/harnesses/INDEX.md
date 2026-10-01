# 하네스 목록

> 생성 파일. 손으로 고치지 말고 `npm run harness -- list` 로 다시 만든다.
> 각 하네스의 정의는 `src/harnesses/<id>/harness.ts`, 구조 규칙은 `openwiki/harnesses/README.md`.

| id | 무엇 | 범위 | 시드 | 문서 |
|---|---|---|---|---|
| `monster-collect-species` | 몬스터 수집 종 스프라이트 | 장르 `monster-collect` 전용 | `harness-data/monster-collect-species/seed.json` | `openwiki/harnesses/monster-collect-species.md` |

## monster-collect-species — 몬스터 수집 종 스프라이트

몬스터 수집(포켓몬류) 게임의 종을 도감 시드에서 읽어 앞모습(상대)·뒷모습(내 몬스터) 전투 스프라이트를 만든다. 생성 그림 속 픽셀 격자를 찾아 진짜 도트로 옮기고, 사람이 후보를 고르며, 112 캔버스·바닥 정렬로 맞춘다.

**이럴 때 쓴다:**
- 몬스터 수집(포켓몬류) 게임의 몬스터 종·스타터·진화 계통 그림을 만들 때
- 몬스터 수집 전투의 앞모습/뒷모습 스프라이트를 새로 만들거나 다시 그릴 때
- JRPG 일반 적(enemy) 그림에는 쓰지 않는다 — 그쪽은 자료집 그림 생성 경로

**단계** (`npm run harness -- monster-collect-species <단계>`):
- `status` — 현황: 시드의 종마다 앞·뒤 그림이 골라졌는지, 번들 결과물이 있는지 보여 준다.
- `front` — 앞모습 후보: 종 설명을 화풍 계약에 넣어 상대 앞모습(왼쪽 3/4) 후보 N장을 생성·도트화하고 비교 시트를 만든다.
- `back` — 뒷모습 후보: 고른 앞모습 도트를 키워 참고로 넣고, 같은 종의 뒷모습(오른쪽 위를 보는 등) 후보를 만든다.
- `pick` — 고르기: 사람이 고른 후보를 출처(격자 원본·해시·프롬프트)와 함께 기록한다.
- `import` — 가져오기: 이미 있는 생성 원본 PNG 하나를 도트화해 후보로 등록한다.
- `build` — 번들 굽기: 골라 둔 격자 원본을 112 캔버스로 맞춰 public/assets/harnesses/ 아래에 쓰고 검사한다.
- `check` — 검사: 번들 스프라이트의 색 수·마젠타 잔점·윤곽·앞뒤 색 일치를 검사한다.

**들어오는 길:** CLI 있음 · 에디터 화면 아직 없음 · 조수 도구 아직 없음
