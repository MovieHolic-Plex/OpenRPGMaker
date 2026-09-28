# 지옥 사냥개 — retro2003 손도트

원본: `scripts/asset-gen/pixel-enemy/hound-hell.py` + 공통 도구 `beast_lib.py`(이 배치 도형 헬퍼) · `pe_lib.py`(시트·검사·미리보기 출력).
시트: `public/assets/generated/pixel-enemies/hound-hell.png`.
계획: `src/assets/retroMonsterPlan.ts` 의 `hound-hell` · motion `dash`. 등록은 런타임 담당이 계약 목록으로 한다.

## 제작·규격

Python 3 + Pillow로 최종 격자에 다각형·타원·관·개별 픽셀을 수식으로 직접 찍은 OPRN Studio 원작.
AI 이미지 생성, 외부 몬스터 이미지의 축소·트레이스·팔레트 교체는 사용하지 않았다.
아군 비교 그림(actor1-0)은 검토판에만 쓰고 몬스터 원화 입력으로 쓰지 않는다(아군 출처: `assets/easyrpg/AUTHORS.md`).

- 셀 64×64, 3열×3행, 시트 192×192 RGBA, 실제 사용 12색(투명 제외), 알파 0/255.
- 오른쪽(아군 쪽) 보기. 지상형. attack(도약) 칸만 바닥에서 뜬다. 나머지는 바닥 y=60.
- 광원 왼쪽 위, 그림자는 오른쪽 아래 면으로 묶고 외곽선은 어두운 색 1px.

검은 털의 마른 사냥개, 목덜미에서 어깨까지 타오르는 갈기, 붉은 눈, 불꽃 꼬리 끝, 불빛 도는 입.

## 아홉 칸

| 행/열 | 0 | 1 | 2 |
|---|---|---|---|
| 0 | idle_a | idle_b | idle_c |
| 1 | windup | move | attack |
| 2 | recover | hit | dead |

windup 몸을 낮추고 불길이 커짐 → move 질주 → attack 앞으로 도약하며 입을 벌려 불을 뿜음 → hit 머리를 젖힘 → dead 옆으로 쓰러져 갈기가 불씨·연기로.
대기는 a→b→c→b 로 1~2px 호흡. recover 는 대기 자세로 돌아가는 중간, hit 은 뒤로 젖힘, dead 는 쓰러진 별도 윤곽.

## 재생성·검사

```sh
cd scripts/asset-gen/pixel-enemy
python3 hound-hell.py            # 시트 + .omo/pixel-enemy-hound-hell/ 검토판
python3 beast_review.py hound-hell   # 크기·알파·색 수·빈 칸·칸끼리 차이·바닥선
```

검토판(`.omo/pixel-enemy-hound-hell/`): `preview.png`(4배, 칸 경계·이름·바닥선), `cycle.gif`(#202840, 2배,
idle 2회 → windup → move → attack → recover → hit → dead), `scale.png`(actor1-0 idle 칸과 같은 4배),
`validation.json`(칸별 경계·크기).

## 직접 보고 고친 기록

1. 1차: 몸이 63px 로 칸을 꽉 채움 → 몸통·꼬리를 줄이고 머리를 당김.
2. 2차: 귀가 머리와 뭉침 → 귀를 키우고 안쪽에 붉은 선.

