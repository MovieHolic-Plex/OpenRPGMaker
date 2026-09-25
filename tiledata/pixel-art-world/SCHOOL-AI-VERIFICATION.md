# 계단실 공용 등록과 실제 조수 재현 — 2026-09-25

결과: 공용 자료를 읽은 실제 Gemini 3.7 Flash가 계단실을 다른 좌표에 재현했다.
하위81칸·상위81칸 전부 일치, 범위 밖 변경0칸, 양쪽 접근 경로 통과.
마지막 모델 검토는 아래 중단 기록의 결과 맵을 이어받아 완료했다. 한 번에 오류 없이 끝난 실행으로 보고하지 않는다.

## 등록 내용

- 지침 정본: `SCHOOL-STAIRWELL.md`. 원본 SHA/좌표·합성 번호·전체 배열·벽 연결·계단참·이식·이벤트 규칙.
- 공용 타일셋: `shared_paw_school_four_composed`, 용도 `school-stairwell`, MD2개와 실제 그림3개.
- 정상, `DIVIDER_GAP`(4,2), `LANDING_BLOCKED`(4,6)/(4,7)의 전체 하위 배열과 상위 배열을 제공한다.
- 공용 계단 객체의 참고문서에도 같은 용도를 연결했다. 새 원본 가져오기에는 메타데이터 번들 지침을 제공한다.
- 원본/파생 그림은 사용자 로컬 공용 DB에만 있다. 기존380개 범위에 새 소재를 추가하지 않았다.

공용 저장: `/home/main/.local/share/oprn/shared-content.sqlite`, library `pixel-art-world-local`.
라이브러리 revision `8646991e9a886db1d9367b1ee742758003b72edbe952af2e05ee730a70e3a2ad`, API CAS 저장 후 재로드 일치.
실제 AI 도구로 새 프로젝트의 학교 타일셋1개·객체15개·학교 장소5개·지역1개 자료를 읽었다.
MD65개/페이지98개/이미지67개를 전달·디코딩했고 serialize/deserialize 왕복과 두 번째 공용 투영의 무변경을 확인했다.
이는 문서 접근 확인이며 모델 배치 성공과 별도다.

사용자 정본: project `6ae74f7a-23a2-449b-8171-5afb5dff532b`,
`/home/main/.local/share/oprn/paw-city-20260924`, revision75,
SHA `b3286ad3d6e1ce24f014d11694adbae0964c0f1a7576c3c2532567fe6787ff80`.
공용 투영 저장·호스트 재로드 일치. 기존12맵은 전부 동일하다.

## 실제 모델 확인 방식

`scripts/qa/pixel-art-world-school-ai.mts`는 앱과 같은 `runPiAgent`, 도구 레지스트리,
실제 제공자 요청과 문서/이미지 선행 읽기 게이트를 사용한다. 응답 모킹은 없다.
확인 범위를 고정하려고 도구를 문서 조회·맵 조회·타일 정보·paint_tiles·show_map_region으로 제한했다.
기본 시스템 프롬프트는 유지했으며 쓰기 도구의 문서 게이트를 우회하지 않았다.

모델에는 공용 타일셋과 용도 이름, 빈15×14 맵, 목적 원점(3,2),9×9 크기만 지정했다.
정답 배열은 요청문에 넣지 않았다. 모델이 공용 MD2개와 그림3개를 실제로 읽고,
paint_tiles의 cells 모드로 직접 작성했다. 모델 반환 후 채점기가 전체 배열과 엔진 통행을 검사했다.
채점기는 모델이 만든 타일을 수정하지 않았다.

| 항목 | 확인 결과 |
|---|---|
| 두 레이어 전체 배열 | 162/162 일치 |
| 범위 밖 변경 | 0칸 |
| 남쪽 계단참 → 상행/하행 접근 | 실제 `canMove` 탐색으로 모두 도달 |
| 옮긴 접근 좌표 | 상행(5,7),하행(9,7); 모델 최종 설명도 일치 |
| 오류 설명 | 중앙 천장 연결 누락, 계단참 차단을 모델이 정확히 구분 |
| 최종 실제 그림 | show_map_region으로 전달 후 완료 응답 수신 |
| 전이 이벤트 | 0개; 모델이 목적층 미연결이라고 명시 |

## 실행 중단과 재개를 포함한 원기록

1. 첫 실행:10턴/40도구. 배열은 일치했으나 확인용 렌더 콜백이 순수 base64 대신 data URL을
   반환해 제공자가 마지막 그림을 거절했다. `live-initial/report.json`은 실패로 남겼다.
2. 렌더 콜백을 고친 재실행:17턴/39도구. 배열은 일치했지만 확인 스크립트의16턴 제한으로
   마지막 응답 전에 중단됐다. `live-build/report.json`에 실패와 부분 결과를 보존했다.
3. 그 결과 맵을 변경 없이 이어받아 모델이 문서/그림을 다시 읽고 검토했다:5턴/10도구,
   추가 타일 쓰기0회, 제공자 오류0개, 정상 완료 응답. `live/report.json`이 최종 판정이다.
   각 실행에서 문서 ID 또는 밑그림 인자 오류가 있었고 모델이 재조회·수정했다. 무오류 도구 호출이라고 주장하지 않는다.

확인 스크립트는 기본 제한을48턴으로 올리고 `--resume <이전 결과 폴더>`를 명시적으로 기록한다.
제공자 오류·완료 응답 누락은 배열이 같더라도 통과시키지 않는다.
첫 실행/재실행/재개에서 제공자가 보고한 누적 토큰은 각각106,698/186,921/47,998이다.
이는 실측 사용량이며 성공률 또는 향후 작업 비용 추정이 아니다.

## 결과 저장과 재현

AI 결과는 별도 SQLite project `c2749be8-2e22-4e15-a661-fe1a266253ff`,
`/home/main/.local/share/oprn/paw-school-ai-check-20260925`에 revision1로 저장했다.
SHA `80474641d04b86049b7420a06dd414ac00134d06625a677712345cab89e9b887`.
스토어를 닫고 다시 열어 프로젝트 JSON과 원본 atlas 바이트가 모두 일치함을 확인했다.
SQLite가 자산을 ref로 분리한 뒤의 비교는 실제 bytes를 다시 읽어 원래 dataURL로 복원한다.
선택 필드의 undefined는 JSON 계약대로 비교에서 정규화한다. 최초 엄격 객체 비교 실패는
그림·맵 변경이 아니라 이 저장 표현 차이였으며 원래 저장 데이터를 덮지 않고 재검증했다.

개인 증거: `output/paw-school-ai-check/`의 `shared/proof.json`, `shared-save/proof.json`,
`document-observations.json`, `live/{request.txt,events.json,tool-calls.json,report.json,actual.png,storage-proof.json}`.
원본 픽셀이 포함된 증거는 커밋하지 않는다.

새 실행은 `bun scripts/qa/pixel-art-world-school-ai.mts --out <별도 증거 폴더>`.
결과 저장은 `node scripts/content/save-school-ai-observation.mjs <result-project.json> <새 프로젝트 폴더> <증거 폴더>`.
기존 결과의 읽기 검증만 할 때 `--verify-existing`을 쓴다. 사용자 원본 학교 저장소에는 쓰지 않는다.

확인 범위는 문서가 있는 고정 계단실 한 사례다. 임의 학교 설계, 다른 타일셋,
실제 층간 이벤트 생성, 여러 모델의 일반 성공률은 이번 확인에 포함하지 않았다.
학교 원본의 실제6방향 층간 이동은 앞선 `paw-school-stair-divider` 플레이어 기록을 따른다.
