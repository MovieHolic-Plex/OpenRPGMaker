# 버들항 건물 · 공개 전 적대적 Visual QA (round 2)

사용자가 첫 10종의 지붕·벽 질감을 반려해 이전 검수 후보/선택/공개 그림을 삭제했다. 삭제 목록은 `harness-data/beodeul-building-review/deleted-round-1.json`. 반려 그림 한 장만 비공개 부정 대조군으로 보존한다.

## 새 경로

원본 타일과 승인된 beodeul-architecture 픽셀을 명시한 source/crop/at 좌표로 1:1 조립한다. 첫 격자 패널은 폐기했다. 색 수 감소·노이즈·새 평면 질감으로 대체하지 않는다. 원본 시트나 정본 마을은 변경하지 않는다.

`build`는 비공개 drafts/staging만 만든다. `validate` 뒤 실제 이미지를 첨부한 서로 다른 읽기 전용 Codex 프로세스가 질감과 구조를 각각 검사한다. 질감 각 항목 94 이상, 구조 각 항목 90 이상, 결함 0이어야 한다. 숨긴 반려 질감·떠 있는 지붕·중복 문 표본을 정확히 FAIL 처리해야 검사 자체가 유효하다. 활성 후보 모두 현재 그림/레시피/규칙/코드/원본에 묶인 통과 증거를 갖춰야 `publish`한다. 사람의 허용은 별도다.

## 실제 첫 검사에서 잡힌 문제

[first-gate-rejection.json](first-gate-rejection.json): 원본 대장간이라도 roof_grain 86, light_consistency 92여서 반려됐다. 공개 0. 원본의 더 입체적인 기와와 양쪽 지붕 마감을 보존하는 부품으로 교체했다. 구조 검사에서는 숨긴 떠 있는 지붕(roof_joints 0)과 중복 문(single_door 20)을 잡았다. 질감 표본도 roof_grain 35, wall_grain 39로 탈락했다. 새 검사를 통과하기 전 공개하지 않는다.

## 두 번째 질감 검사

[second-texture-rejection.json](second-texture-rejection.json): 대장간 보정본은 96 이상으로 통과했지만 창고의 반복 나무 벽과 상점 차양이 각각 88로 반려됐다. 이후 구조 실행을 중단하고 전체를 비공개로 유지했다. 창고 벽을 원본 회벽으로, 상점은 원본 기와 박공/진열 창으로 교체했다. 이후 gate는 질감 실패가 있으면 즉시 차단하여 불필요한 다음 검사를 실행하지 않는다.

## 세 번째 질감 검사

[third-texture-rejection.json](third-texture-rejection.json): 대장간 창을 윗부분만 덮어 남은 창턱과, 이층 석조집의 보정 띠에 섞인 문 픽셀을 실제 검사자가 찾아냈다. 각각 90/92로 반려되어 gate가 실패 종료했다. 창은 원본 전체를 복원하고, 보정 띠는 문이 없는 석벽만 복사했다. 문 개수 메타데이터 검사로는 찾지 못하는 작은 조각도 실제 이미지 검사에서 차단했다.

## 최종 결과

수정한 10개 모두 두 실제 이미지 검사에 통과했다. 최저 질감 점수 96, 최저 구조 점수 95. 숨긴 반려 질감·지붕 간격·문 두 개 표본 모두 FAIL, 해당 축 점수도 기준 미만. 통과 증거를 봉인한 뒤 10개를 공개했고 서버 재시작/HTTP 재조회에서 허용 0·거절 0·미선택 10을 확인했다.

Firefox 분리 QA는 초안 비공개, 증거 누락 공개 차단, 화면 자동 갱신, PNG/비교 장면/픽셀 배열/영수증 변조 차단, 허용/거절/취소의 재로드 유지, 허용만 ZIP, 낡은 SHA/빠진 토큰 거부를 확인했다. 페이지 오류 0. 실제 사용자 큐에는 선택을 기록하지 않았다. 검수 화면 PNG도 직접 열어 확인했다.

## 파일과 화면

- [round2-visualqa-proof.json](round2-visualqa-proof.json): round 2 최종 실제 모델 출력·점수·결함 및 부정 대조군 결과. 상세 모델 출력/실행 로그는 저장소 밖 데이터 폴더에 보존한다.
- [validation.json](validation.json): 출처 픽셀 재현·파일 해시 확인. 문 개수의 시각 판정은 Visual QA가 담당한다.
- [candidates-native.png](candidates-native.png): 공개된 후보 원본 크기. 최근접 확대만 사용한다.
- [review-screen.png](review-screen.png), [review-context.png](review-context.png), [review-mobile.png](review-mobile.png): 실제 검수 화면.
- [browser-proof.json](browser-proof.json): 분리 QA DB에서 비공개 초안/누락 증거/그림 및 비교 장면 변조 차단, 버튼 저장/재로드/취소/허용만 다운로드를 확인한다. 실제 사용자 큐에는 모의 선택을 넣지 않는다.

검수: http://mdc-server:18317/ . 데이터 `/home/main/.local/share/oprn/beodeul-building-review/review.sqlite`. 선택/메모는 PNG SHA에 묶어 저장한다. 사람이 허용한 현재 그림만 팩으로 내려받는다. 아직 공용 번들·정본 마을에 설치하지 않는다.

실행: `npm run harness -- beodeul-building-review produce|build|validate|gate|publish|serve|status|export`. 서버 `serve --port 18317`. 전체 gates/vitest/typecheck는 실행하지 않는다.

## round 3 — 갤러리와 용도가 다른 10종

사용자가 UI와 반복되는 건물 형태를 지적하고 타 게임의 간판·지붕을 참고하라고 요청했다. 기존 10종 및 4개의 Allow를 삭제하지 않는다. `round3-prior-human-decisions.json`은 작업 시작 시 실제 결정/그림 SHA 스냅샷이다. 새로운 모의 결정은 분리 QA 서버에만 기록한다.

새 화면은 전체 갤러리와 고정 검수 패널, 검색/선택/새 형태 필터, 집중 보기, 동일 배율 원본/나무 비교, 후보 전환/재로드 시 임시 메모 유지, 메모만 저장, 모바일 목록/검수 전환을 제공한다. API 결정은 종전의 그림 해시·검증 영수증 검사를 그대로 쓴다. `gallery-browser-proof.json`은 별도 SQLite에서 실제 Firefox로 확인한 결과다.

새 후보는 T자·쌍박공·깊은 차양/마루·옆채·첨탑·안마당·높이가 다른 점포·원뿔 탑으로 구분하고, 침대·열쇠·빵·물약·책·저울·방패·곡물·깃펜 간판을 저작했다. 지붕의 선택 팔레트만 변경하며 기와 입자 좌표/명암은 보존한다. 원본 부품 좌표·팔레트 사전·간판 전체 격자와 좌표는 `harness-data/beodeul-building-review/round3-detail-sources.json`, 조사 근거는 같은 폴더 `round3-design-references.md`다. 타 게임 그림은 후보에 포함하지 않는다.

첫 실제 질감 검사에서 제분소만 탈락했다 (`round3-first-texture-rejection.json`: roof_grain 55, wall_grain 88). 원본의 둥근 갈색 지붕도 거친 질감이라 예외로 통과시키지 않았다. 원본 원뿔 기와로 바꾸고 기초에 원본 석재 입자를 옮겨 재검수한다. 활성 시드 20종 전체가 실제 질감/구조 이미지 검사와 부정 대조군을 통과해야 공개된다.

`round3-native-source-proof.json`은 후보 소스 해시 20개 일치와 원본 좌표/색상표/간판 격자에 따른 10종 RGBA 재현 근거다. 기계 일치는 Visual QA 통과나 사람의 Allow를 대신하지 않는다. 원본 및 정본 마을은 변경하지 않는다.

두 번째 실제 질감 검사에서도 약방/서점의 색상 마스크 경계와 제분소의 큰 기와 입자가 반려됐다 (`round3-second-texture-rejection.json`). 경계를 지우고 제분소 기와 내부에 촘촘한 원본 기와 픽셀을 옮겼다. 선택한 우측 하이라이트 5픽셀은 기존 음영색으로 낮췄다. 모든 좌표·색 편집을 기록했고 전체 10종을 다시 RGBA 비교하여 재현했다. 세 번째 질감 검사는 활성 20종 모두 통과했다.

20종 구조 단일 실행이 600초 제한으로 종료되어 공개를 차단했다. 실행기를 최대 5종씩 묶되 모든 묶음에 부정 대조군을 반복하고 각각 보정 검사를 통과하게 바꿨다. 모든 개별 판정/출력/로그와 합본을 해시로 봉인하며 기준점은 그대로다. 검사 코드 변경으로 전체 20종을 새 프로필로 다시 검사한다. 인간 결정 행·PNG SHA는 바꾸지 않는다.

빵집 차양의 가려진 문, 약방 벽 연결부는 실제 구조 검사에서 반려됐다 (`round3-first-complete-structure-rejection.json`). 문을 차양 밖으로 옮기고 가려진 문 조각을 창으로 바꿨다. 약방은 실제 알파 배열을 추가 확인하여 남은 투명 2열 x78~79 전32행도 원본 기둥으로 메웠다. 검수자가 한 회차 중복 문 대조군의 단일 문 축을 잘못 통과시킨 경우도 보정 검사가 차단했다 (`round3-calibration-rejection.json`). 이 회차의 점수는 공개 근거로 쓰지 않는다.

실제 모델 실행 결과는 정확히 같은 입력 그림·규칙·코드·참고 그림에 한해서만 HMAC으로 봉인한 체크포인트로 재사용한다. 실패 판정도 보존하여 같은 그림을 반복 실행해 합격을 고르는 것을 막는다. 개별 출력·실행 로그 해시가 변조되거나 입력 그림이 바뀌면 재사용하지 않는다. 묶음당 1,200초 제한이 있으며, 제한 종료·보정 실패·점수 미달은 모두 공개를 막는다.

검사 출력이 실제 그림 SHA를 잘못 복사한 회차는 `STALE_VQA`로 거부했다 (`round3-malformed-review-rejection.json`). 해당 서명 없는 출력을 고쳐 재사용하지 않고 실제 검사자를 새로 실행했다. `round3-checkpoint-proof.json`은 분리 데이터에서 정확한 입력의 봉인 결과 재사용, 점수 변조 차단, 실제 그림 1픽셀 변경 시 재검사 요구를 확인한다. `round3-batch-evidence-proof.json`은 개별 모델 출력·로그 변조 시 공개 영수증이 무효가 되는 근거다. 실제 사용자 결정/원본 검사 파일에는 모의 변경을 하지 않는다.

재검사에서도 기존 중복 문 대조군을 창문으로 오인하여 검사 전체를 차단했다 (`round3-second-calibration-rejection.json`). 대조군 픽셀이나 점수 기준은 그대로 두고, 구조용 그림에서 옆 비교 집을 제거한 한 채 4배 확대를 모든 후보/구조 대조군에 적용했다. `round3-isolated-double-door-control.png`은 새 검사 표현이다. 출력 ID/SHA enum도 요청에 묶어 잘못 복사한 해시를 차단한다. 역할별 읽기 전용 묶음은 최대4개 독립 폴더에서 병렬 실행하되 모두 통과해야 공개한다. 변경된 프로필로 활성20종을 전부 재검사한다.

## round 3 최종 통과

새 표시/출력 계약으로 활성20종 모두 실제 질감·구조 검사를 통과했다. 최저 질감95, 최저 구조93. 네 묶음 각각 반려 질감과 떠 있는 지붕·중복 문을 올바른 축으로 FAIL 처리했다. 모든 현재 영수증 확인 후20종을 공개했다. 신규10종은 사람 검수 대상이고 자동 Allow를 기록하지 않는다. `round3-visualqa-proof.json`에 실제 판정과 대조군, `round3-preserved-human-decisions.json`에 SQLite/HTTP 재조회와 기존4개 결정·그림SHA 보존을 남긴다. 갤러리·집중 비교·모바일의 실제 화면은 `round3-gallery.png`, `round3-context.png`, `round3-mobile.png`다.

## round 4 — 제분소의 낮은 목재 너와 지붕

사용자가 원뿔 기와 제분소를 반려하고 지붕의 다른 느낌을 요청했다. 지붕을 낮추고 처마를 넓힌 회갈색 목재 너와로 보정했다. 최종 전체격자/원본좌표/색상표/명시한 도트는 `harness-data/beodeul-building-review/round4-mill-roof.json`, 재현은 `src/harnesses/beodeul-building-review/node/bake_mill_roof.py`. 몸체 y56 아래의 RGBA·문·기초·곡물 간판을 보존한다. 기존 소스와 이전SHA의 인간 결정은 보존한다.

최초 제분소는 실제 두 검사 모두 통과했으나, 기존 안마당 여관의 야외 통로를 두 번째 문으로 세어 일괄 공개가 막혔다 (`round4-mill-pass-courtyard-rejection.json`). 닫힌 건물 실내의 문/입구와 날개 사이 야외 통로를 구분하는 일반 판정 기준을 명확히 하고 모든20종을 새 프로필로 실제 재검수했다. 후보별 예외·점수 완화·강제PASS는 없다. 전체20종 및 모든 묶음의 숨긴 대조군이 통과한 뒤 공개됐다. 제분소 구조 최저96, 질감 최소95 이상. `round4-mill-visualqa-proof.json`, `round4-mill-save-proof.json`, `round4-mill-browser-proof.json`에 실제 검사·SQLite/HTTP 재로드·이전 결정 보존·제분소 바로가기/비교장면 확인을 기록한다. 비교 그림 `round4-mill-before-after.png`, 실제 장면 `round4-mill-context.png`. 수정본은 새SHA의 미선택 상태이며 게임 번들/지도 설치는 사람의 Allow 이후다.
