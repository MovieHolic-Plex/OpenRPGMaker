# 바위 게 — retro2003 손도트

원본: `scripts/asset-gen/pixel-enemy/crab-rock.py` + 공통 도구 `beast_lib.py`(이 배치 도형 헬퍼) · `pe_lib.py`(시트·검사·미리보기 출력).
시트: `public/assets/generated/pixel-enemies/crab-rock.png`.
계획: `src/assets/retroMonsterPlan.ts` 의 `crab-rock` · motion `dash`. 등록은 런타임 담당이 계약 목록으로 한다.

## 제작·규격

Python 3 + Pillow로 최종 격자에 다각형·타원·관·개별 픽셀을 수식으로 직접 찍은 OPRN Studio 원작.
AI 이미지 생성, 외부 몬스터 이미지의 축소·트레이스·팔레트 교체는 사용하지 않았다.
아군 비교 그림(actor1-0)은 검토판에만 쓰고 몬스터 원화 입력으로 쓰지 않는다(아군 출처: `assets/easyrpg/AUTHORS.md`).

- 셀 48×48, 3열×3행, 시트 144×144 RGBA, 실제 사용 14색(투명 제외), 알파 0/255.
- 오른쪽(아군 쪽) 보기. 지상형. 모든 칸 바닥 y=44.
- 광원 왼쪽 위, 그림자는 오른쪽 아래 면으로 묶고 외곽선은 어두운 색 1px.

적갈색 등딱지 위에 회색 바위(금·이끼), 눈자루 둘, 아군 쪽 큰 집게와 뒤쪽 작은 집게.

## 아홉 칸

| 행/열 | 0 | 1 | 2 |
|---|---|---|---|
| 0 | idle_a | idle_b | idle_c |
| 1 | windup | move | attack |
| 2 | recover | hit | dead |

windup 큰 집게를 들어 크게 벌림 → move 옆걸음 전진 → attack 집게를 끝까지 뻗어 꽉 닫음(반짝임).
대기는 a→b→c→b 로 1~2px 호흡. recover 는 대기 자세로 돌아가는 중간, hit 은 뒤로 젖힘, dead 는 쓰러진 별도 윤곽.

## 재생성·검사

```sh
cd scripts/asset-gen/pixel-enemy
python3 crab-rock.py            # 시트 + .omo/pixel-enemy-crab-rock/ 검토판
python3 beast_review.py crab-rock   # 크기·알파·색 수·빈 칸·칸끼리 차이·바닥선
```

검토판(`.omo/pixel-enemy-crab-rock/`): `preview.png`(4배, 칸 경계·이름·바닥선), `cycle.gif`(#202840, 2배,
idle 2회 → windup → move → attack → recover → hit → dead), `scale.png`(actor1-0 idle 칸과 같은 4배),
`validation.json`(칸별 경계·크기).

## 직접 보고 고친 기록

1. 1차: 팔이 너무 길고 다리가 치마처럼 뭉침 → 팔을 짧게, 등딱지를 넓게.
2. 2차: 다리가 등딱지 위를 가로지름 → 다리를 모두 몸 뒤로 보내고 옆으로 벌어지게, 먼 쪽 다리는 외곽선 없는 어두운 색.

