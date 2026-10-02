# 공용 몬스터 옛 그림 폐기 근거

- 요청 97종 + 추가 일반 적 3종을 새로 저작, native 공용 시트 총 140종.
- 옛 이미지 343개 삭제. 목록/바이트/원본 해시는 `retired-images.json`; 기존 공용 ID 141개는 `retired-resource-map.json`과 `asset-audit.json`에서 새 파일로 해석된다.
- 전체 종과 포즈의 원본/검수: `organic/`, `arcane/`, `humanoid/`. 부모가 전체 포즈 보드 15개와 native contact 2장을 직접 확인했다.
- `runtime/SUMMARY.md`부터 읽고 표시된 3장만 확인: 실제 player.html에서 retro2003·rm2000·사용자 업로드 우선권. 전체 140종 초상+시트 브라우저 디코드. `runtime/hydra/SUMMARY.md`: 실제 새 히드라 공격 GIF와 포즈 순서.
- `skill-comparison/`: 현재 RM2003 4스킬과 새 FX 시안의 비교. 제품 효과 변경 없음.

이 증거는 원본 그림/앱 코드/공용 기본 데이터 검사이며 사용자 SQLite나 원격 DB를 수정하지 않았다. 세션 지시에 따라 gates/vitest/typecheck를 실행하지 않았다. 원본 이미지 삭제는 사용자 요청이며 사용자 프로젝트의 적/종 레코드와 업로드 파일은 보존한다.
