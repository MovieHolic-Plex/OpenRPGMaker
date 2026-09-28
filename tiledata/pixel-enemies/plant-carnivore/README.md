# 식충 식물 — retro2003 손도트

원본: `scripts/asset-gen/pixel-enemy/plant-carnivore.py` + 공통 도구 `beast_lib.py`(이 배치 도형 헬퍼) · `pe_lib.py`(시트·검사·미리보기 출력).
시트: `public/assets/generated/pixel-enemies/plant-carnivore.png`.
계획: `src/assets/retroMonsterPlan.ts` 의 `plant-carnivore` · motion `stomp`. 등록은 런타임 담당이 계약 목록으로 한다.

## 제작·규격

Python 3 + Pillow로 최종 격자에 다각형·타원·관·개별 픽셀을 수식으로 직접 찍은 OPRN Studio 원작.
AI 이미지 생성, 외부 몬스터 이미지의 축소·트레이스·팔레트 교체는 사용하지 않았다.
아군 비교 그림(actor1-0)은 검토판에만 쓰고 몬스터 원화 입력으로 쓰지 않는다(아군 출처: `assets/easyrpg/AUTHORS.md`).

- 셀 64×64, 3열×3행, 시트 192×192 RGBA, 실제 사용 13색(투명 제외), 알파 0/255.
- 오른쪽(아군 쪽) 보기. 지상형(뿌리 고정). 모든 칸 바닥 y=60.
- 광원 왼쪽 위, 그림자는 오른쪽 아래 면으로 묶고 외곽선은 어두운 색 1px.

큰 입 꽃봉오리(분홍 속살·흰 이빨·노란 점), 마디진 줄기, 가시 덩굴 둘, 넓은 잎 뭉치와 흙.

## 아홉 칸

| 행/열 | 0 | 1 | 2 |
|---|---|---|---|
| 0 | idle_a | idle_b | idle_c |
| 1 | windup | move | attack |
| 2 | recover | hit | dead |

제자리에서만 움직인다. windup 줄기를 뒤로 감고 입을 벌리며 덩굴을 치켜듦 → move 앞으로 몸을 기울임 → attack 줄기를 채찍처럼 뻗어 입을 크게 벌려 물고 앞 덩굴이 낮게 휘감음. stomp 슬롯이지만 연출은 덩굴 채찍이다.
대기는 a→b→c→b 로 1~2px 호흡. recover 는 대기 자세로 돌아가는 중간, hit 은 뒤로 젖힘, dead 는 쓰러진 별도 윤곽.

## 재생성·검사

```sh
cd scripts/asset-gen/pixel-enemy
python3 plant-carnivore.py            # 시트 + .omo/pixel-enemy-plant-carnivore/ 검토판
python3 beast_review.py plant-carnivore   # 크기·알파·색 수·빈 칸·칸끼리 차이·바닥선
```

검토판(`.omo/pixel-enemy-plant-carnivore/`): `preview.png`(4배, 칸 경계·이름·바닥선), `cycle.gif`(#202840, 2배,
idle 2회 → windup → move → attack → recover → hit → dead), `scale.png`(actor1-0 idle 칸과 같은 4배),
`validation.json`(칸별 경계·크기).

## 직접 보고 고친 기록

1. 1차: 머리가 작아 "큰 입"이 안 읽힘 → 두 입술을 ±gape/2 회전한 국소 좌표로 크게 다시 그림.
2. 2차: attack 덩굴이 몸 뒤로 말림 → 앞으로 낮게 뻗게.

