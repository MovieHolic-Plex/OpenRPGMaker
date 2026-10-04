# 모래 전갈 — retro2003 손도트

원본: `scripts/asset-gen/pixel-enemy/scorpion-sand.py` + 공통 도구 `beast_lib.py`(이 배치 도형 헬퍼) · `pe_lib.py`(시트·검사·미리보기 출력).
시트: `public/assets/generated/pixel-enemies/scorpion-sand.png`.
계획: `src/assets/retroMonsterPlan.ts` 의 `scorpion-sand` · motion `dash`. 등록은 런타임 담당이 계약 목록으로 한다.

## 제작·규격

Python 3 + Pillow로 최종 격자에 다각형·타원·관·개별 픽셀을 수식으로 직접 찍은 OPRN Studio 원작.
AI 이미지 생성, 외부 몬스터 이미지의 축소·트레이스·팔레트 교체는 사용하지 않았다.
아군 비교 그림(actor1-0)은 검토판에만 쓰고 몬스터 원화 입력으로 쓰지 않는다(아군 출처: `assets/easyrpg/AUTHORS.md`).

- 셀 48×48, 3열×3행, 시트 144×144 RGBA, 실제 사용 11색(투명 제외), 알파 0/255.
- 오른쪽(아군 쪽) 보기. 지상형. 모든 칸 바닥 y=44.
- 광원 왼쪽 위, 그림자는 오른쪽 아래 면으로 묶고 외곽선은 어두운 색 1px.

모래색 갑각, 집게 둘(먼 쪽은 어둡게), 마디진 꼬리가 등 위로 휘고 끝에 붉은 독침.

## 아홉 칸

| 행/열 | 0 | 1 | 2 |
|---|---|---|---|
| 0 | idle_a | idle_b | idle_c |
| 1 | windup | move | attack |
| 2 | recover | hit | dead |

windup 꼬리를 뒤로 더 젖히고 집게를 벌림 → move 다리를 벌려 전진 → attack 꼬리가 머리 위로 넘어와 앞으로 찌름(독 튐).
대기는 a→b→c→b 로 1~2px 호흡. recover 는 대기 자세로 돌아가는 중간, hit 은 뒤로 젖힘, dead 는 쓰러진 별도 윤곽.

## 재생성·검사

```sh
cd scripts/asset-gen/pixel-enemy
python3 scorpion-sand.py            # 시트 + .omo/pixel-enemy-scorpion-sand/ 검토판
python3 beast_review.py scorpion-sand   # 크기·알파·색 수·빈 칸·칸끼리 차이·바닥선
```

검토판(`.omo/pixel-enemy-scorpion-sand/`): `preview.png`(4배, 칸 경계·이름·바닥선), `cycle.gif`(#202840, 2배,
idle 2회 → windup → move → attack → recover → hit → dead), `scale.png`(actor1-0 idle 칸과 같은 4배),
`validation.json`(칸별 경계·크기).

## 직접 보고 고친 기록

1. 1차: 꼬리가 굵은 통나무처럼 읽힘 → 가는 관 + 마디 눈금으로 교체.
2. 2차: 구슬 꼬리가 점으로 흩어짐 → 연속 관으로 되돌리고 윗면 하이라이트 추가.
3. 3차: 집게가 몸통과 뭉침 → 손바닥+위/아래 손가락을 따로 그리고 먼 쪽 집게를 높고 어둡게.

