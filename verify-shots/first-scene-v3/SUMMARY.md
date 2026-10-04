# 첫 장면 자동 제작 v3 — 시각 실패

AI 제작·정본 저장·재로드·실제 ZIP 내보내기는 완료됐지만, 감독자의 실제 화면 검수는 실패했다.

- 정본 project id: `dcd14331-1032-4f2f-bd57-fa9a24e034ac`
- 저장 대상: `/home/main/.codex/worktrees/0a57/rpg-zzu/output/qa/first-scene/project/.oprn-projects/c77d8b1a-e3df-457e-b736-5f6b686fa8db`
- **즉시 확인**: `keep/04-clock.png` — 회중시계로 선언한 물체가 실제로는 Object2 보석이다.
- **즉시 확인**: `keep/02-in-map-introduction.png` — 따옴표 앞 역슬래시 노출.
- 도입의 후속 안내도 내부 타일 좌표를 플레이어에게 노출했다.
- 두 선택 모두 정상 키보드로 엔딩에 도달. 첫 선택 결과 검사의 Enter 타이밍 문제는 QA 대사 대기 계약으로 별도 수정했다.
- AI 이미지 검수의 통과 보고를 제품의 시각 합격으로 받아들이지 않았다. 실제 자산 라벨을 검수에 추가하고 표시용 이스케이프를 코드에서 거부하도록 수정했다.
