# 버들항 기본 집·포석·시야 수정

- 원래 작업 워크트리: `/home/main/.t3/worktrees/rpg-zzu/t3code-77478098`.
- 빈 새 프로젝트/새 맵의 기본 타일셋 `beodeul_city`, 기본 집 `beodeul-manor-a`, 버들항 카드 6종을 실제 브라우저에서 확인.
- 공용 반목조 3종/통나무 3종의 지붕·벽·창·문 부품을 조립한다. 새 그림/타일을 추가하지 않는다. 너비 5/7~24칸, 높이는 온전한 2행 층 단위(최대 9층).
- 실제 드래그 집 7×6 / 10×8(역방향) / 7×7칸. 확정 전 지도 무변경, 중복 거부, Esc 취소, 한 채씩 Undo/Redo.
- 버들항 포석 자동타일로 도로 3개, 포석 137칸. 외부 칩셋 바닥 0칸. 문 앞 도로 통행 연결.
- 출처 이름의 「길」 낱말 때문에 윗층 나무가 바닥으로 분류되던 오류 수정. 물/포석 바닥은 시야 장애물이 아니다.
- 에디터/출하 player.html + export shim: 나무 뒤 NPC와 건물 뒤 NPC 가림, 가까운 NPC 표시. 낮은 땅→고지 차단, 고지→낮은 땅 허용.
- 시야 OFF에서는 고지 시야 확대가 켜져 있어도 마스크/NPC 숨김 해제. ON/이동 시 다시 갱신.
- 브라우저 오류: 에디터 0, 런타임 0. 콜드 부팅의 일시적 ERR_NETWORK_CHANGED만 초기 로드에서 최대 3회 재시도.
- 독립 SQLite 저장 후 close/open 재로드: 프로젝트 `c04de657-ef0e-4ea5-bcee-a4b134662b22`, revision 2, 저장소 `/home/main/.t3/worktrees/rpg-zzu/t3code-77478098/.vite-cache/beodeul-building-store`. 타일/집 정의·크기/배치/도로/시야 보존. 사용자 실제 프로젝트 콘텐츠는 수정하지 않았다.
- packaged/electron/player 빌드 성공. AGENTS 실행 제한에 따라 gates/vitest/전체 typecheck는 실행하지 않았다.
- 참고문서: 정본 SQLite의 버들항에 문서가 없어서, 실제 에디터 로드와 같은 `ensureBeodeulCityReferences`로 공용 문서를 보강한 읽기용 사본에서 「저택·외곽」 MD 2쪽 전체/그림 4장과 길 자동타일 문서/그림을 확인했다. 정본 DB에는 쓰지 않았다.

## 즉시 확인

- `03-roads.png`: 버들항 집·포석 도로 전체 결과.
- `04-vision-on.png` / `05-vision-off.png`: 실제 에디터 시야 ON/OFF.
- `06-runtime-on.png`: 나무 뒤 NPC 가림.
- `07-runtime-wall.png`: 반목조 집 뒤 NPC 가림.
- `10-runtime-off.png`: OFF에서 NPC 복원.
- `editor-2x.mp4` / `runtime-2x.mp4`: 실제 Chromium 연속 프레임, 시간 간격대로 2배속.
