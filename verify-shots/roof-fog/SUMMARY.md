# 버들항 지붕만 조절 · 둥글고 점진적인 시야 (2026-10-04)

- 작업 워크트리: `/home/main/.t3/worktrees/rpg-zzu/t3code-77478098`.
- 실제 새 프로젝트 기본 `beodeul_city`, native 기본 집 6종. SQLite/IndexedDB AI 기록은 0건.
- 실제 집 도구에서 「드래그 대상 → 지붕만」을 선택. 기존 반목조 지붕 7→11칸, 통나무 지붕 7→11칸 역방향 드래그. 원본 3행 지붕 끝/처마와 벽·창·문 픽셀/좌표, placement id/순서 보존.
- 확정 전 구조물 수 3 유지. 확정 후 교체도 3 유지. 한 번 Undo/Redo(7→11칸), Esc 취소. 새 집도 지붕 11칸/벽 7칸으로 독립 조절, 총 4채.
- 같은 가시 칸 판정의 원형 반경/물체 뒤 실루엣에 0.8타일 흐림. 카메라 버퍼 너비를 고정해 맵 가장자리 이동 때 마스크가 초기화되는 문제 방지. 240ms smoothstep으로 이전/새 마스크 알파를 이어 줌.
- NPC/그림자는 프레임 시간에 따라 지수형 페이드. 렌더 후 저작 visible/alpha 복원. AI/타깃 판정은 즉시 적용.
- 출하 `player.html`/export shim에서 벽·나무 뒤 NPC 가림, 가까운 NPC 표시, 낮은 땅→고지 차단/고지→아래 허용, OFF의 마스크/숨김 해제 확인.
- 실제 런타임 마스크 알파 256종. 중간 알파 픽셀 80,773개. 이동/관찰점 변경 중 NPC의 0<alpha<1 프레임 26개.
- 브라우저 pageerror: 편집기 0, 출하 플레이어 0. 초기 브라우저 네트워크 변화는 boot에서만 최대 3회 재시도.
- 독립 SQLite 저장(close/open 재로드): project id `9044a710-a187-4926-8fef-c62694bc7135`, revision 1, 저장소 `/home/main/.t3/worktrees/rpg-zzu/t3code-77478098/.vite-cache/roof-fog-store`. 타일·relief·시야 규칙·집 정의/부위·배치/크기 완전 일치.
- 사용자 실프로젝트의 콘텐츠는 수정하지 않음. 시연은 별도 프로젝트.
- 문법 parse/diff 공백 검사 및 packaged/electron/player 빌드. AGENTS 제한에 따라 gates/vitest/전체 typecheck 미실행.
- 참고문서는 실제 정본의 버들항 참고자료/부품(89종)을 읽기 사본으로 확인. 부품 MD/실제 그림을 사용, 새 타일 그림/학습 번들은 만들지 않음.
- editor/runtime MP4는 실제 Chromium 연속 프레임을 시간 간격대로 2배속. 사용자용 합본은 초기 집 배치 장면을 제외하고 지붕 조절부터 이어 붙임.

## 즉시 확인

- `03-roof-controls.png`: 실제 지붕만 모드/벽 너비·층수 설정.
- `05-roof-resized.png` / `06-roof-wide.png`: 벽·창·문은 고정한 넓은 처마.
- `08-vision-on.png` / `09-vision-moved.png`: 편집기 둥근 시야 경계.
- `06-runtime-on.png` / `07-runtime-wall.png`: 출하 플레이어의 부드러운 가림.
- `10-runtime-off.png`: OFF 해제.
- `observations.json` / `runtime-observations.json` / `sqlite-roundtrip.json`: 비교 값과 재로드 근거.
