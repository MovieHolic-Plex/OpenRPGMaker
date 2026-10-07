# 문 열림 도트/GIF 시안

사용자 요청: “문이 열리는 것도 … 니가 도트찍어서 … gif”.

직접 픽셀 좌표를 저작한 16×32 8단계 문이다. 왼쪽 경첩을 기준으로 안쪽으로 열리고 닫힌다.
원본 버들항 살림집의 문틀·인방·문턱을 보존했다. 집 전체와 문 확대 GIF를 만들고
닫힘/중간/완전 열림의 실제 GIF 프레임을 확인했다.

- GIF: `public/assets/beodeul-door/house-door.gif`, `door-detail.gif`
- PNG 원본: `public/assets/beodeul-door/door-states.png`(128×32, 8열×2행)
- 소스: `scripts/content/build-beodeul-door.py`
- 불변 검사: 닫힘 원본과 바이트 일치, 8단계 서로 다름, 문틀·문턱 좌표/색 불변.
- 같은 단계의 위/아래 두 칸 짝을 유지하며 혼합 오류 `(0,1)` 그림도 만들었다.
- 공용 번들 등록: 새 프로젝트와 기존 시험 프로젝트 모두 16칸·8키트·참고문서 1용도 확인.
- 참고문서가 빠진 기존 사본에도 `ensureBundledTilesets`가 보충함을 확인했다.

정본 시험 프로젝트 id `3dd2427f-38dc-46e5-925b-a717dbe5bb03`, 폴더
`/home/main/.local/share/oprn/assistant-house-entry-e7d2-20261004`의 SQLite 저장 API로
새 공용 시트 정의를 저장했다. 닫고 같은 폴더를 다시 열어 정의가 동일함을 확인했다.
revision 2, SHA-256 및 검사 결과는 `storage-proof.json`에 있다.

GIF는 그림 동작 시안이다. 기존 맵/출입 이벤트는 변경하지 않았으며 게임 출입에 문 재생을
연결한 결과나 게임 녹화라고 주장하지 않는다. 전체 테스트·게이트는 실행하지 않았다.

후속 공용 적용(2026-10-04): 이제 `apply_beodeul_door_animation` 도구로 같은 시험 프로젝트의
입장 열림·귀환 닫힘을 연결했다. revision 4 저장·재로드와 실제 게임 프레임 검사는
`applied/README.md`, `applied/canonical-proof.json`, `applied/rendered-stages.json`에 있다.
위 revision 2 기록은 자산 시안 등록 당시의 상태다.
