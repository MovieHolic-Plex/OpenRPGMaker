# 조수가 읽는 걷기 칩 정보: 누락 교정과 응답 증거

## 앞선 설명의 정정

PR #2168의 이름표 전수 조사만으로 **조수가 참고하는 모든 경로가 교정됐다고 말할 수 없었다.**
후속 확인에서 `list_resources`의 별도 검색 구현, 얼굴 검색 응답의 옛 걷기 칩 이름,
기본 데모의 옛 이름 조회 두 곳이 남아 있었다. 이번 변경은 그 누락을 교정한다.
왕과 골렘의 이름표가 서로 바뀌어 있었다는 증거는 없다. 사용자가 겪은 과거 선택 오류의 정확한
실행 기록도 확보하지 못했으므로, 이번에 찾은 검색 결함을 그 실행의 확정 원인으로 단정하지 않는다.

## 수정 전후 반환값

아래 수정 전 값은 기준 커밋 `0c3a186fa476896f5e15fabe5cb11c06bbb0fd9a`에서
실행한 **검색 함수** `searchResources('charset', query)`의 반환값이다.
수정 후 값은 실제 등록 도구 `list_resources.run()`의 응답을 끝 페이지까지 수집한 값이다.
두 검증 모두 모델 호출은 0회다. 단위 테스트의 예상값을 표에 옮긴 것이 아니다.

| 검색어 | 수정 전 리소스 검색 | 수정 후 실제 도구 |
| --- | --- | --- |
| `king` | 0개 | 왕 1개: `people3#0`, frame 25 |
| `golem` | 이끼 골렘 1개 | 이끼·스톤 골렘 2개: `monster4#5`, `monster2#4` |
| `animal` | 8개, 농장 동물 누락 | 10개, 농장 닭·젖소 포함 |
| 흑발 여성 마법사 | 다른 머리색·남성 등을 포함한 32개 | 0개: 없는 외형을 다른 칩으로 채우지 않음 |

원본: [수정 전 응답](before-search-results.json), [수정 후 항목별 응답](tool-route-proof.json).
수정 전 호출 코드와 로그도 `before-probe-source.mts`, `before-probe.log`에 보존했다.

## 실제 조회 경로에서 확인한 범위

독립적으로 픽셀과 대조한 [기존 전수 조사표](../charset-mapping-audit-20261005/audit.json)를
기대값으로 삼았다. 자기 이름으로 검색되는지만 확인한 검사가 아니다.

- 이름 있는 걷기 칩 **319개 모두**: `list_npc_graphics`와 `list_resources(kind:"charset")`의
  실제 응답에서 시트/칸 ID·이름·태그·외형 설명·그림 종류·방향·정지 프레임을 대조했다.
  NPC 응답의 성별·연령 필드도 조사표와 일치한다. **불일치 0개**.
  리소스 설명은 도구 계약의 240자 제한을 적용했다. 프로젝트 이름표는 자기 이름을 첫 태그로 붙이는
  기존 계약까지 대조했다. 모든 기대값·응답·개별 판정은 `tool-route-proof.json.rows`에 있다.
- 리소스 전체 목록을 50개씩 끝까지 조회: **319개, 중복·누락 0개**.
  NPC 도구는 기존 상위 20개 계약을 유지한다. `monster`의 20개 대 리소스 73개는 이 제한의 차이다.
- 얼굴 응답에 붙는 **걷기 칩 설명 116개**: 현재 걷기 이름을 표시한다. 얼굴 자체 이름과 그림을
  재검수한 결과가 아니다. `paired`에 기존 설명과 현재 설명을 함께 기록했다.
- 첫 장면 물건 목록 **16개**: 이름·태그·시트/프레임을 같은 조사표와 대조했다.
- 정확한 업로드 ID `custom_golem`은 그 시트 8칸만 돌려준다.
  첫 테스트에서 공용 골렘까지 섞여 10개가 나오는 회귀를 발견했고, 정확한 업로드 ID/전체 이름을
  우선하도록 고쳤다. 실패 로그를 지우지 않았다.

공용 판본은 `charset-actor-kept:c3a0cd02a24b5fc80ac98617ee30f992df0126ebb6e22377835b12baa25c8294`로
고정했다. SQLite 사본은 읽기 전용이며 원본 라이브러리나 사용자 프로젝트에는 쓰지 않았다.
조사표 SHA-256와 검증 당시 소스 SHA-256는 `tool-route-proof.json`에 있다.

재현 명령:

```bash
node_modules/.bin/vite-node --script scripts/content/probe-charset-reference-routes.mts \
  --audit verify-shots/charset-mapping-audit-20261005/audit.json \
  --shared-db output/charset-mapping-audit-20261005/shared-snapshot.sqlite \
  --out output/charset-reference-routes-new-proof.json
```

출력 파일을 덮어쓰지 않으며 공용 판본이 조사표와 다르면 검사를 중단한다.
SQLite 사본은 공용 호스트에서 받아 저장한 로컬 검증 입력이며 저장소에 포함하지 않는다.

## 테스트와 실패 이력

- 최종: [7파일·73테스트](targeted-tests.txt), [앱 타입 검사](typecheck-app.txt),
  [319개 실제 도구 응답 검사](tool-route-probe.log) 모두 **실제 종료 코드 0**.
- 최초 단위 검사: 업로드 ID 결과가 8개 대신 10개여서 실패했다. 수정 후 최종 검사에서 통과했다.
  [최초 실패 로그](initial-targeted-tests.txt).
- 최초 응답 검사: 프로젝트 이름표가 이름을 태그에 붙이는 계약을 검사기가 빠뜨려 155행의
  태그 비교만 실패했다. 해당 기대값 계산을 바로잡았다. [최초 검사 보고서](initial-checker-report.json).
- 명령 종료 코드와 파일 SHA-256: [검증 영수증](verification-receipt.json).

## 실제 조수 실행과 그림 증거

앞선 수정 때 실제 입력창의 Pi 경로로 왕·골렘을 각각 배치하고 플레이·기존 콘텐츠 보존·SQLite
저장/재로드까지 검사했다. 골렘은 `monster2#4`/frame 73, 왕은 `people3#0`/frame 25로 저장됐다.

- [골렘 모델 실행·저장 영수증](../charset-mapping-audit-20261005/assistant/npc-golem/receipt.json)
- [왕 모델 실행·저장 영수증](../charset-mapping-audit-20261005/assistant/npc-king/receipt.json)
- [골렘 실제 후보 그림](../charset-mapping-audit-20261005/assistant/npc-golem/candidate-preview-1.png)
- [왕 실제 후보 그림](../charset-mapping-audit-20261005/assistant/npc-king/candidate-preview-1.png)

이 두 실행의 소스 해시는 영수증에 남아 있다. **이번 후속 코드로 모델을 새로 실행한 기록은 아니다.**
이번 후속 검증은 실제 읽기 도구 응답 검사와 73개 회귀 테스트다.

## 확실하다고 말할 수 있는 범위

현재 조사한 판본의 **이름 있는 걷기 칩 319개와 위 조회 경로**가 일치한다는 근거다.
기존 시각 조사는 공용 실제 322칸과 프로젝트 전용 17칸, 총 339칸을 확인했다.
공용 저작 원형 3칸과 프로젝트 전용 이름 없는 17칸은 이 319개 이름표 검사에 포함하지 않는다.
사용자가 붙인 이름을 임의로 교정하지 않으며, 이후 공용 라이브러리에 추가되는 그림,
얼굴 그림 전체·초상 태그 전체·모든 자유 질의에 대한 모델의 해석까지 보증하는 결과도 아니다.
