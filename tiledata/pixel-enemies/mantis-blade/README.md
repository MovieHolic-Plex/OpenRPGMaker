# 칼날 사마귀 — retro2003 손도트

원본: `scripts/asset-gen/pixel-enemy/mantis-blade.py` + 공통 도구 `beast_lib.py`(이 배치 도형 헬퍼) · `pe_lib.py`(시트·검사·미리보기 출력).
시트: `public/assets/generated/pixel-enemies/mantis-blade.png`.
계획: `src/assets/retroMonsterPlan.ts` 의 `mantis-blade` · motion `dash`. 등록은 런타임 담당이 계약 목록으로 한다.

## 제작·규격

Python 3 + Pillow로 최종 격자에 다각형·타원·관·개별 픽셀을 수식으로 직접 찍은 OPRN Studio 원작.
AI 이미지 생성, 외부 몬스터 이미지의 축소·트레이스·팔레트 교체는 사용하지 않았다.
아군 비교 그림(actor1-0)은 검토판에만 쓰고 몬스터 원화 입력으로 쓰지 않는다(아군 출처: `assets/easyrpg/AUTHORS.md`).

- 셀 48×48, 3열×3행, 시트 144×144 RGBA, 실제 사용 11색(투명 제외), 알파 0/255.
- 오른쪽(아군 쪽) 보기. 지상형. 모든 칸 바닥 y=44.
- 광원 왼쪽 위, 그림자는 오른쪽 아래 면으로 묶고 외곽선은 어두운 색 1px.

연두색 몸, 길게 솟은 앞가슴, 세모 머리·노란 겹눈·더듬이, 낫 같은 앞다리 둘(안쪽 날은 흰색).

## 아홉 칸

| 행/열 | 0 | 1 | 2 |
|---|---|---|---|
| 0 | idle_a | idle_b | idle_c |
| 1 | windup | move | attack |
| 2 | recover | hit | dead |

windup 몸을 세우고 분홍 속날개를 부채처럼 펼치며 두 낫을 머리 위로 → move 몸을 숙여 전진 → attack 앞으로 뛰어들며 두 낫을 X 로 교차(베기 궤적).
대기는 a→b→c→b 로 1~2px 호흡. recover 는 대기 자세로 돌아가는 중간, hit 은 뒤로 젖힘, dead 는 쓰러진 별도 윤곽.

## 재생성·검사

```sh
cd scripts/asset-gen/pixel-enemy
python3 mantis-blade.py            # 시트 + .omo/pixel-enemy-mantis-blade/ 검토판
python3 beast_review.py mantis-blade   # 크기·알파·색 수·빈 칸·칸끼리 차이·바닥선
```

검토판(`.omo/pixel-enemy-mantis-blade/`): `preview.png`(4배, 칸 경계·이름·바닥선), `cycle.gif`(#202840, 2배,
idle 2회 → windup → move → attack → recover → hit → dead), `scale.png`(actor1-0 idle 칸과 같은 4배),
`validation.json`(칸별 경계·크기).

## 직접 보고 고친 기록

1. 1차: 앞가슴이 굵은 원통이라 머리·낫이 안 보임 → 칸별 좌표를 직접 지정하고 앞가슴을 가늘게.
2. 2차: 대기 칸에서 낫이 머리를 덮음 → 어깨를 낮추고 머리를 앞으로.
3. 3차: windup 낫이 머리를 가림 → 낫을 머리 뒤 위로 올림.

