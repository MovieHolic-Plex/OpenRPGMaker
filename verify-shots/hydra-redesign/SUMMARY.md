# 새 히드라 — 96px 전투 도트 9포즈

## 즉시 확인

| 파일 | 볼 내용 |
|---|---|
| `poses-2x.png` | 9칸 전체의 머리 분리, 자세 차이, 칸 경계, 발 접지. |
| `poses.gif` | 대기 → 준비 → 이동 → 공격 → 복귀 → 피격 → 쓰러짐의 저작 포즈 확인판. 게임 녹화가 아니다. |
| `idle.gif` | 대기 a→b→c→b, 200ms/칸, 독립적인 머리 움직임·호흡·눈 깜빡임. |
| `battle.png` | 실제 player.html + exportProjectStoreShim의 RM2003 명령 화면. 새 히드라 시트와 접지 확인. |

## 그림과 배포 시트

청록 비늘·산호 지느러미·황금 배판, 세 개의 독립적인 목과 머리, 왼쪽에 감긴 큰 꼬리의 새 원화다.
`scripts/asset-gen/pixel-enemy/hydra-three.py`에서 각 자세의 관절 좌표를 정수로 확정한 뒤
최종 96px 격자에 그린다. 원본 이미지 입력이나 이미지 생성 모델을 사용하지 않는다.
한 장의 비트맵을 확대·기울여 포즈로 삼는 방식이 아니다. 쓰러진 몸·목·사지·꼬리는 별도 그림이다.

| 행 | 0열 | 1열 | 2열 |
|---|---|---|---|
| 0 | idle_a | idle_b | idle_c |
| 1 | windup | move | attack |
| 2 | recover | hit | dead |

- 원본 셀: `tiledata/pixel-enemies/hydra-three/<pose>.png` 9개, 96×96.
- 배포 시트: `public/assets/generated/pixel-enemies/hydra-three.png`, 288×288.
- 공용 초상: `public/assets/generated/pixel-enemy-portraits/hydra-three.png`, idle_a와 같은 픽셀.
- `hydra-sheet.png`는 배포 시트 사본, `hydra-4x.png`는 초상 확인판.
- 기존 ID `generated-enemy-hydra-three`, cell 96, breath, idleFrameMs 200 계약을 유지한다.
- PWA 자산 캐시는 v6로 변경해 같은 PNG 주소의 이전 디자인 캐시를 비운다.

## 재로드와 실제 확인

`pixels.json`: 저장된 시트·초상 PNG를 다시 열어 크기·픽셀·알파·색·전체 칸을 확인했다.
22색, 알파 0/255, 9칸 모두 다른 픽셀 해시, 칸 경계에서 잘림 없음, 마지막 행 y=92.
입력 관절 좌표의 최솟값·최댓값도 검사하므로 캔버스 밖에 그려 잘린 그림을 정상으로 보지 않는다.
humanoid 일괄 생성의 `draw('hydra-three', pose)`도 9칸 모두 저장된 시트와 일치했다.
접촉 경계 측정의 변경은 히드라 한 항목뿐이다 (`battleContactBounds.json`).

`runtime/SUMMARY.md`를 먼저 읽었다. 타이틀 → 맵 결정키 → 전투 명령으로 실제 플레이어에 진입했다.
시나리오 1비트 통과, 런타임 에러 0. 최종 캡처 전에 도입 종료·actorCommand·sequenceBusy=false를 기다렸다.
`renderer.json`: retro2003 / sideview, 96px 시트, breath, 실제 새 PNG 요청, starter 그림 요청 0.
브라우저에서는 대기 표시를 확인하며 전체 포즈 연결은 별도 확인판에서 본다.

```sh
python3 scripts/asset-gen/pixel-enemy/hydra-three.py
python3 scripts/content/measure-battle-contact-bounds.py
node scripts/qa/runtime/hydra-rm2003.mjs verify-shots/hydra-redesign
```

공용 자산·원본 코드와 임시 QA fixture 작업이다. 사용자 프로젝트 SQLite를 수정하지 않았다.
로컬 gates/vitest/typecheck는 실행하지 않았다. 커밋·푸시·PR·머지도 하지 않았다.
