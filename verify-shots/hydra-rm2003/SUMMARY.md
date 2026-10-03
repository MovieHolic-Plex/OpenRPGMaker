# 히드라 — 실제 RM2003 도트 전투 검토 (2026-10-03)

## 즉시 확인

| 그림 | 직접 확인한 내용 |
|---|---|
| `battle.png` | 도입 종료 후 실제 `retro2003` / sideview 명령 화면. 히드라 왼쪽, 네 native 도트 아군 오른쪽, 파란 RM2003 창. |
| `poses.png` | 96px 셀 아홉 개의 직접 저작 도트. 세 머리의 분리, 공격/피격/쓰러짐 실루엣, 칸 경계. nearest 3배 표시. |
| `hydra-idle-4x.png` | 자료집 초상 idle_a와 같은 픽셀을 nearest 4배로 표시. |

`battle.png`는 임의 전투 그림/HTML 목업이 아닌 **player.html + exportProjectStoreShim** 캡처다.
최신 main의 전투 정리와 합친 뒤 다시 캡처했다. 히드라는 현재 공용 ID/시트를 사용하고,
아군은 `charset-battler-actor1-0` / `actor2-0` / `actor3-0` / `actor4-0`다.

## 재로드·관측 근거

- `pixels.json`: 16색, 알파 0/255, 9칸 모두 다른 픽셀 해시, 저장된 시트/초상 SHA-256.
  humanoid 일괄 생성 함수를 통해서도 현재 시트 아홉 칸과 일치했다.
- `renderer.json`: 실제 DOM 셀 96px, breath 모션, 아군 ID, 요청 경로.
  `/generated/starter/` 요청 **0건**, 런타임 오류 **0건**.
- `runtime/manifest.json`, `runtime/SUMMARY.md`: 전용 런타임 하네스의 1비트 관측.
  `runtime/01-command.png`는 도입 중 샷이다. 최종 전투 화면은 도입 종료를 기다린 **battle.png**를 쓴다.

```sh
python3 scripts/asset-gen/pixel-enemy/hydra-three.py
node scripts/qa/runtime/hydra-rm2003.mjs
```

공용 자산/코드 변경의 임시 fixture이며 사용자 정본 프로젝트/SQLite는 수정하지 않았다.
세션 규칙에 따라 gates/vitest/typecheck는 실행하지 않았다.
