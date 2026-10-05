# 확장 시설 검수 후속 처리

- 원본 판정은 `tiledata/modern-city/parking-wide/visual-review.json`: 조립 PASS / 시설 INCOMPLETE.
- 실제 intake는 누적 art_revision 6 → 7, stage art / queued로 전이했다.
- 같은 입력을 다시 제출해 duplicate=true, 회차 7 유지. 이어서 실제 준비 작업 job 663 / PID 2689540 시작을 읽어 확인했다.
- global paused=1, max_art_revisions=10 유지. 다른 개념은 재개하지 않았다.
- 이전 작은 표본의 계약·선택·설치·검수는 scene-followup-history/<fingerprint>/에 보존했다.
- 현재 네 지적 모두 required 수정 주문이며 새 계약은 parking-facility-v1이다.
- `dispatch.json`은 실제 상태 재조회 기록. 새 그림의 품질 합격 또는 프로젝트 저장 완료 근거가 아니다.

Python AST와 git diff --check만 확인했다. 저장소 지시에 따라 테스트/전체 게이트는 실행하지 않았다.
회귀 테스트 소스는 `src/harnesses/super-harness/tests/test_scene_followup.py`에 추가했다(미실행).
