# 최종 검증

이 문서는 런타임 최적화 커밋 `1b54977be`를 만들기 직전의 검증 기록이다. 후속 공식 상한 512 변경은 `../official-map-512-20261001/SUMMARY.md`를 본다.

- 관련 5파일 54개 테스트: 실제 프로세스 exit 0. unit-tests.log 참조.
- 앱 typecheck: NODE_OPTIONS=--max-old-space-size=8192, 실제 프로세스 exit 0. typecheck.log 참조.
- 256/512 벤치마크: 실제 프로세스 exit 0; 측정 실행 6회, 각 오류 0.
- 런타임 QA: 실제 프로세스 exit 0; Combined Town 16px 및 Slates 32px의 8장 모두 픽셀 차이 0; 첫 도착 프레임의 지형 표시 및 물의 실제 프레임 변경 확인. ../runtime-tile-window-20261001/results.json 참조.
- raw-results.json의 실행 소스 SHA-256을 현재 파일과 대조: 모두 일치.
- git diff --check: exit 0.
- 정본 콘텐츠 작업/저장 없음; 엔진 코드와 최소 QA fixture만 변경.
