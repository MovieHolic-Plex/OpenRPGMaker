# 시야와 빠른 배치 확인

- 기본 버들항 등록 집 선택 149개, 미리보기 중 가려진 이벤트 배지 숨김.
- 실제 에디터 버튼과 포인터: 집 3채, 드래그 도로 3개, 기존 집 중복 배치 거부, 길 통행 연결.
- 플레이어: 출하 player.html + export shim. 나무 뒤 NPC는 숨김, 근처 NPC는 표시.
- 고지: 낮은 위치에서 높은 칸은 가림, 높은 위치에서 낮은 칸은 표시.
- 시야 OFF: 고지 시야 확대가 켜져 있어도 마스크와 NPC 숨김 모두 제거. 다시 ON/이동 시 갱신.
- 에디터/런타임 페이지 오류 각각 0.
- 독립 SQLite 저장 후 close/open 재로드: 프로젝트 9d9042ae-9a35-41a0-8e30-4e36c93e8ff6, revision 3. 타일/집/도로/시야 의미 보존. 사용자의 실제 지도에는 시연 콘텐츠를 쓰지 않음.
- gates/vitest/전체 typecheck는 AGENTS 실행 제한에 따라 실행하지 않음. packaged/electron/player 빌드 및 실제 브라우저 확인.

## 즉시 확인

- 03-roads.png: 집과 도로 전체 결과.
- 06-runtime-on.png: 나무 뒤 NPC 가림.
- 10-runtime-off.png: OFF 후 전체 지형과 NPC 표시.
- editor-2x.mp4, runtime-2x.mp4: 실제 조작 화면 2배속.
