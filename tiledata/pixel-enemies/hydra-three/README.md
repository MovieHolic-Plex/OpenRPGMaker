# 새 세 머리 히드라 — RM2003 손도트 9포즈 (2026-10-03)

원본: `scripts/asset-gen/pixel-enemy/hydra-three.py`.
공용 ID: `generated-enemy-hydra-three` (기존 ID 유지).

Python + Pillow로 다각형·선·픽셀 묶음을 **최종 96×96 격자에 직접 저작**했다.
윤곽, 표정, 비늘, 지느러미, 배판의 좌표가 원본이다. 관절을 이동·굽히고 좌표를 정수로
확정한 뒤 그린다. 기존 이미지의 픽셀을 옮기거나 회전하는 방식이 아니다.
입력 이미지, 이미지 생성, 큰 그림 축소, 보간, 외부 게임 소재는 사용하지 않는다.
저장소 코드/자산 정책을 따르는 OPRN 원작이다.

- 22색 + 투명, 알파 0/255, 오른쪽 보기, 접지 y=92.
- 청록 비늘·산호색 지느러미·황금색 배판의 새 디자인. 세 머리의 높이와 방향이 다르고,
  큰 가운데 머리는 포효한다. 네 발·발톱과 왼쪽으로 크게 감긴 꼬리가 있다.
- 셀 96×96, 시트 288×288 RGBA. 초상은 idle_a 한 칸의 정확한 사본이다.
- 3×3: idle_a / idle_b / idle_c, windup / move / attack, recover / hit / dead.
- 대기 3칸은 독립적인 머리 움직임·호흡·한쪽 눈 깜빡임. windup은 목을 당기고 턱을 닫고,
  move는 몸을 기울이며 발을 바꾸고, attack은 세 머리가 앞으로 뻗는다.
  recover는 돌아오는 중간 자세, hit은 반동·눈 감김·턱 닫힘이다.
- dead의 몸통·꼬리·사지·접힌 세 목은 별도 원화다. 세 머리는 쓰러진 관절 위치에서 다시 그린다.
- 이 폴더의 `<pose>.png` 9개는 재생성한 원본 셀이다. 배포 PNG를 재로드해 모든 셀과 대조한다.
- `retirement/humanoid/art.py`의 일괄 생성도 이 원본을 불러오므로 옛 히드라로 되돌아가지 않는다.

```sh
python3 scripts/asset-gen/pixel-enemy/hydra-three.py
node scripts/qa/runtime/hydra-rm2003.mjs verify-shots/hydra-redesign
```

첫 명령은 공용 시트/초상을 저장하고 색·알파·칸 경계를 확인한다.
둘째 명령은 임시 fixture를 실제 `player.html` + export shim에서 열어 전투를 캡처한다.
사용자 프로젝트/SQLite를 수정하는 명령은 아니다.

검토: `verify-shots/hydra-redesign/SUMMARY.md`.
`poses-2x.png`에서 아홉 실루엣, `poses.gif`에서 직접 저작한 포즈의 연결을 확인한다.
이 GIF는 게임 녹화가 아니다. 실제 전투 화면은 `battle.png`다.
전체 테스트/게이트 통과 주장은 하지 않는다.
