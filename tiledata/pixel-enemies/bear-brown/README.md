# 갈색 곰 — retro2003 손도트

원본: `scripts/asset-gen/pixel-enemy/bear-brown.py` + 공통 도구 `beast_lib.py`(이 배치 도형 헬퍼) · `pe_lib.py`(시트·검사·미리보기 출력).
시트: `public/assets/generated/pixel-enemies/bear-brown.png`.
계획: `src/assets/retroMonsterPlan.ts` 의 `bear-brown` · motion `stomp`. 등록은 런타임 담당이 계약 목록으로 한다.

## 제작·규격

Python 3 + Pillow로 최종 격자에 다각형·타원·관·개별 픽셀을 수식으로 직접 찍은 OPRN Studio 원작.
AI 이미지 생성, 외부 몬스터 이미지의 축소·트레이스·팔레트 교체는 사용하지 않았다.
아군 비교 그림(actor1-0)은 검토판에만 쓰고 몬스터 원화 입력으로 쓰지 않는다(아군 출처: `assets/easyrpg/AUTHORS.md`).

- 셀 64×64, 3열×3행, 시트 192×192 RGBA, 실제 사용 12색(투명 제외), 알파 0/255.
- 오른쪽(아군 쪽) 보기. 지상형. 모든 칸 바닥 y=60.
- 광원 왼쪽 위, 그림자는 오른쪽 아래 면으로 묶고 외곽선은 어두운 색 1px.

어깨 혹이 있는 갈색 곰, 밝은 주둥이, 흰 발톱.

## 아홉 칸

| 행/열 | 0 | 1 | 2 |
|---|---|---|---|
| 0 | idle_a | idle_b | idle_c |
| 1 | windup | move | attack |
| 2 | recover | hit | dead |

windup 뒷발로 일어서 두 앞발을 치켜듦 → move 사족 보행 → attack 몸을 앞으로 숙이며 두 앞발로 땅을 내려침(흙 튐).
대기는 a→b→c→b 로 1~2px 호흡. recover 는 대기 자세로 돌아가는 중간, hit 은 뒤로 젖힘, dead 는 쓰러진 별도 윤곽.

## 재생성·검사

```sh
cd scripts/asset-gen/pixel-enemy
python3 bear-brown.py            # 시트 + .omo/pixel-enemy-bear-brown/ 검토판
python3 beast_review.py bear-brown   # 크기·알파·색 수·빈 칸·칸끼리 차이·바닥선
```

검토판(`.omo/pixel-enemy-bear-brown/`): `preview.png`(4배, 칸 경계·이름·바닥선), `cycle.gif`(#202840, 2배,
idle 2회 → windup → move → attack → recover → hit → dead), `scale.png`(actor1-0 idle 칸과 같은 4배),
`validation.json`(칸별 경계·크기).

## 직접 보고 고친 기록

1. 재검토: 발 관이 바닥선 아래로 1px 내려가 시트 검사에 걸림 → 발 끝 반지름·위치를 올리고 dead 는 settle 로 바닥 맞춤. 시트가 그동안 커밋에 없었다.
2. 재검토: attack 에서 몸통이 앞발을 삼켜 안 읽힘 → 몸을 뒤로 빼고 기울기를 키워 두 앞발이 몸 앞에서 땅에 닿게.

