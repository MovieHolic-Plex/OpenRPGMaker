# 미노타우로스 — retro2003 손도트

원본: `scripts/asset-gen/pixel-enemy/minotaur-maze.py` + 공통 관절·검사 출력기 `pe_rig.py`(도형 도구는 `pe_lib.py`).
시트: `public/assets/generated/pixel-enemies/minotaur-maze.png`.
리소스: `generated-enemy-minotaur-maze` · motion `stomp`(두 걸음 뒤 내려찍기) · 권장 idleFrameMs `320`. 등록은 런타임 에이전트가 `retroMonsterPlan.ts` 목록으로 일괄 한다.

## 제작·규격

Python 3 + Pillow로 최종 격자에 다각형·둥근 끝 선·손으로 친 픽셀 격자를 직접 찍은 OPRN Studio 원작.
AI 이미지 생성, 외부 몬스터 이미지의 축소·트레이스·팔레트 교체는 쓰지 않았다. 아군 비교 그림(actor1-0)은 검토 보드에만 쓴다(출처: `assets/easyrpg/AUTHORS.md`).

- 셀 96×96, 3열×3행, 시트 288×288 RGBA, 실제 사용 14색(투명 제외), 알파 0/255.
- 오른쪽(아군 쪽) 보기, 몸 중심 x≈48, 공통 바닥 y=92(move 는 발을 드는 칸이라 바닥 위 허용).
- 광원 왼쪽 위(IK 팔다리의 왼쪽 위 면에 밝은 선, 오른쪽 아래 면에 어두운 선), 1px 외곽선. 고립 픽셀 0.
- 크기: idle_a 몸 60×76px, actor1-0 대기 칸 몸 23×24px 의 높이 3.17배.

황소 머리 거인(보스급). 앞으로 휜 두 뿔, 옅은 주둥이와 청동 코뚜레, 붉은 눈, 청동 팔찌·벨트, 양날 도끼.

## 아홉 칸

| 행/열 | 0 | 1 | 2 |
|---|---|---|---|
| 0 | idle_a | idle_b | idle_c |
| 1 | windup | move | attack |
| 2 | recover | hit | dead |

대기는 a→b→c→b 로 1~2px 호흡. 양날 도끼를 뿔 위로 들어올린 windup → 발굽으로 내딛는 move → 도끼를 앞쪽 아래로 내려찍는 attack.
recover 는 공격을 거두는 중간 자세, hit 는 몸과 머리를 뒤로 젖히고 눈을 감는 칸, dead 는 따로 그린 쓰러진 윤곽.

칸별 경계(bbox): idle_a 60×76, idle_b 60×74, idle_c 59×72, windup 59×91, move 63×75, attack 70×65, recover 70×71, hit 69×80, dead 86×39. 가장 비슷한 두 칸도 757px 다르다(idle_b/idle_c).

## 재생성·직접 검토

```sh
python3 scripts/asset-gen/pixel-enemy/minotaur-maze.py
```

생성기가 검사해 한 줄로 출력하고, 어기면 exit 1: 시트 크기 cell×3 정사각, 알파 0/255, 색 수 ≤16, 빈 칸 없음, 칸끼리 모두 다름, 칸 밖 침범 없음, 바닥선(지상형은 move 외 전 칸 y=cell−4, 공중형은 dead 만), 고립 픽셀 0, PNG 재로드 일치, GIF 시간축 대조.
검토 산출물은 `.omo/pixel-enemy-minotaur-maze/`(세션 로컬, Git 제외):

- `preview.png`: 4배, 칸 경계·칸 이름·바닥선.
- `cycle.gif`: #202840 배경 2배, idle 2회 → windup → move → attack → recover → hit → dead.
- `scale.png`: actor1-0 의 (0,0) 48px 칸과 같은 4배율, 발 기준선 맞춤.
- `validation.json`: 색 수·칸별 경계·바닥·최소 칸 차이.

직접 `view_image`로 본 뒤 고친 기록(수정 전 미리보기는 `round0/`, `round1/`):
1. 위로만 솟아 있던 큰 뿔을 옆으로 휜 한 쌍의 뿔로 다시 그리고, 대기 때 도끼를 아래로 내림.
2. 머리를 어두운 갈색·옅은 주둥이로 어깨와 분리. 앞팔 어깨를 내려 얼굴을 가리지 않게 하고 attack 도끼를 더 낮게.
