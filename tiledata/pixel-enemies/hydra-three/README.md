# 세 머리 히드라 — RM2003 손도트 (2026-10-03)

원본: `scripts/asset-gen/pixel-enemy/hydra-three.py`.
공용 ID: `generated-enemy-hydra-three` (기존 ID 유지).

Python + Pillow로 다각형·선·픽셀 묶음을 **최종 96×96 격자에 직접 저작**했다.
160px 정수 좌표로 적어 둔 윤곽을 96px 좌표로 옮긴 뒤 그린다. 입력 이미지, 이미지 생성,
그림 축소, 보간, 외부 게임 소재는 사용하지 않는다. 저장소 코드/자산 정책을 따르는 OPRN 원작이다.

- 16색 + 투명, 알파 0/255, 오른쪽 보기.
- 세 개의 독립된 목과 머리, 뿔·이빨, 황갈색 배판, 네 발·발톱, 뒤로 감긴 꼬리.
- 셀 96×96, 시트 288×288 RGBA. 초상은 idle_a 한 칸의 정확한 사본이다.
- 3×3: idle_a / idle_b / idle_c, windup / move / attack, recover / hit / dead.
- 머리/목 관절을 그리기 전에 바꿔 각 칸을 저작한다. dead는 접힌 목과 세 머리를 별도로 그린다.
- `retirement/humanoid/art.py`의 일괄 생성도 이 원본을 불러오므로 옛 히드라로 되돌아가지 않는다.

```sh
python3 scripts/asset-gen/pixel-enemy/hydra-three.py
node scripts/qa/runtime/hydra-rm2003.mjs
```

첫 명령은 공용 시트/초상을 저장하고 색·알파·칸 경계를 확인한다.
둘째 명령은 임시 fixture를 실제 `player.html` + export shim에서 열어 전투를 캡처한다.
사용자 프로젝트/SQLite를 수정하는 명령은 아니다.

검토: `verify-shots/hydra-rm2003/SUMMARY.md`.
`poses.png`에서 아홉 실루엣, `battle.png`에서 실제 RM2003 파티/크기를 직접 확인했다.
전체 테스트/게이트 통과 주장은 하지 않는다.
