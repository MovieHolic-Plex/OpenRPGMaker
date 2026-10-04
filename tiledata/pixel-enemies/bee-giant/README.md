# 거대 벌 — retro2003 손도트

원본: `scripts/asset-gen/pixel-enemy/bee-giant.py` + 공통 도구 `beast_lib.py`(이 배치 도형 헬퍼) · `pe_lib.py`(시트·검사·미리보기 출력).
시트: `public/assets/generated/pixel-enemies/bee-giant.png`.
계획: `src/assets/retroMonsterPlan.ts` 의 `bee-giant` · motion `swoop`. 등록은 런타임 담당이 계약 목록으로 한다.

## 제작·규격

Python 3 + Pillow로 최종 격자에 다각형·타원·관·개별 픽셀을 수식으로 직접 찍은 OPRN Studio 원작.
AI 이미지 생성, 외부 몬스터 이미지의 축소·트레이스·팔레트 교체는 사용하지 않았다.
아군 비교 그림(actor1-0)은 검토판에만 쓰고 몬스터 원화 입력으로 쓰지 않는다(아군 출처: `assets/easyrpg/AUTHORS.md`).

- 셀 48×48, 3열×3행, 시트 144×144 RGBA, 실제 사용 13색(투명 제외), 알파 0/255.
- 오른쪽(아군 쪽) 보기. 공중형. 몸이 떠 있고 dead 만 바닥 y=44 에 닿는다.
- 광원 왼쪽 위, 그림자는 오른쪽 아래 면으로 묶고 외곽선은 어두운 색 1px.

노랑·검정 줄무늬 배, 반투명 날개(알파 0/255 를 지키려고 밑색을 비침 색으로 치환), 붉은 겹눈.

## 아홉 칸

| 행/열 | 0 | 1 | 2 |
|---|---|---|---|
| 0 | idle_a | idle_b | idle_c |
| 1 | windup | move | attack |
| 2 | recover | hit | dead |

windup 배를 아래로 말아 침 조준 → move 배를 더 말아 돌진 → attack 침을 앞으로 길게 찔러 착탄 반짝임.
대기는 a→b→c→b 로 1~2px 호흡. recover 는 대기 자세로 돌아가는 중간, hit 은 뒤로 젖힘, dead 는 쓰러진 별도 윤곽.

## 재생성·검사

```sh
cd scripts/asset-gen/pixel-enemy
python3 bee-giant.py            # 시트 + .omo/pixel-enemy-bee-giant/ 검토판
python3 beast_review.py bee-giant   # 크기·알파·색 수·빈 칸·칸끼리 차이·바닥선
```

검토판(`.omo/pixel-enemy-bee-giant/`): `preview.png`(4배, 칸 경계·이름·바닥선), `cycle.gif`(#202840, 2배,
idle 2회 → windup → move → attack → recover → hit → dead), `scale.png`(actor1-0 idle 칸과 같은 4배),
`validation.json`(칸별 경계·크기).

## 직접 보고 고친 기록

1. 날개를 비침 색 치환(tint_poly)으로 그려 몸통 위에서도 반투명하게 읽히게 했다.
2. 4종 재검토에서 미리보기를 다시 보고 그대로 유지했다.

