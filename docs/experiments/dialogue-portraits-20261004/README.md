# 대화 초상 선택 · 조선풍 UI 근거 (2026-10-04)

## 수정 경로

- 작은 얼굴만 안내하던 FACE_SCHEMA를 얼굴·흉상·전신으로 정정하고 make_villager.face를 노출했다.
- 얼굴 전체 검색 첫 페이지에서 공용 흉상·전신도 보이며 portraitMode로 따로 조회한다.
- 걷기 그림 조회는 검토된 짝 얼굴과 같은 공용 표정 세트의 큰 초상만 추천한다.
- 기존 NPC의 초상만 갱신해도 대사·페이지 조건·퀘스트 분기를 보존한다.
- 저수준 대사에는 changeFace가 필요하다는 조수 지침과 초상 검색 예시를 추가했다.
- 공통 폰트 설정 도구, 한지/나무틀 대화창, 내보낸 플레이어의 저장된 글꼴 적용을 추가했다.

## 확인

`tool-proof.json`: 실제 queryTools/eventCompile/io 모듈을 esbuild로 로드하여 직접 실행했다.
첫 20개에 작은 얼굴 10개·흉상 5개·전신 5개, 흉상/전신 각각 76개를 페이지별로 조회했다.
faceset 이외의 portraitMode는 거부했다. 선택한 흉상 id가 changeFace와 JSON 재로드에 유지됐다.

`update-proof.json`: 실제 훈장 이벤트의 세 페이지에 초상만 바꾸는 make_villager를 실행했다.
첫 changeFace 이외의 페이지·대사·조건·퀘스트 분기가 원본과 일치했다.

`npm run build:player`: PR 작업트리에서 exit 0, SDK artifact `63b8e006163db234`.
새 회귀 계약은 `test/dialoguePortraitDiscovery.test.ts`에 있으며, 이 세션에서는 AGENTS의
실행 제한에 따라 Vitest·전체 typecheck·gates를 실행하지 않았다.

## 실제 게임 근거

조선 콘텐츠 작업트리에 동일한 런타임 UI 수정을 적용해 내보낸 패키지를 관찰했다.
이 PR 작업트리의 플레이어 빌드와 콘텐츠 작업트리의 패키지 QA는 서로 다른 근거다.

- 정본 id: `0d6dca6b-a6a7-49be-a49f-1edf5eccc602`
- 저장 폴더: `/home/main/z-project/rpg-zzu/.oprn-projects/joseon-beodeul-rpg-20261004`
- SQLite revision: 9, SHA-256 `218021812b24da736b25a828c680049efb384b697ee8254771e120c47b95919d`
- 같은 저장 API로 저장 후 닫기·재열기했다. 직렬화한 정본과 출하 문서의 지도·이벤트·DB·시작점·세션·시스템·타일 그림/통행이 일치했다(`gameplay-export-proof.json`). 참고문서의 출하 이미지 경로만 바뀐다.
- 대화 페이지 39개에 검토된 native Actor1 짝 얼굴을 붙였다(`dialogue-face-proof.json`).
- `normal-player-proof.json`: QA 주입 없이 Enter 시작 → 방향키 이동 → 훈장 대화 → 48×48 짝 얼굴 로딩 → 네 직업 선택. Galmuri9 로딩 완료, 실행/리소스 오류 0.
- `npc-portrait.png`: 실제 출하 플레이어의 한지/나무틀 대화창과 짝 얼굴.
- `battle-runtime-summary.md`: 직업 선택·기술 사용·승리·보상·굴 배경 등 10비트 통과, 실행 오류 0. 지도 이동에 QA 계측을 사용했다.

## 시각 판정 범위

기본 RM2003 측면·게이지 전투를 유지할 수 있다. 한지색 창·픽셀 글꼴과 숲/굴 배경은
조선풍 모험에 사용할 방향이다. 현재 아군은 서양풍 RTP 복식이며 적은 고블린 그림이다.
`붉은 도깨비 두목`이 초록색이고 기술창에 `이중…`·`Sword`가 남아 있어 그림/표기를 더 다듬어야 한다.
이는 실제 화면에 대한 디자인 판단이며 역사적 고증 또는 전체 게임 완성 판정은 아니다.
실제 모델이 항상 적절한 초상을 고른다는 검증도 포함하지 않는다.
