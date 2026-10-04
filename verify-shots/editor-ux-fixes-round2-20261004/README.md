# 에디터 UX 추가 감사 대응 — 2026-10-04

추가 감사의 34개 코드 후보를 반영했다. 검색 포커스·숨은 작업·목록 재구성·지형의 상주 데이터·조수 기록·저장 준비를 개선했다. **모든 동작의 지연이 없어졌다는 뜻은 아니다.** 1,000개 명령 전체 선택과 1맵 역사 점프에서는 일관된 시간 개선을 입증하지 못했다.

수정은 격리된 영역별 워크트리에서 수행하고 감독자 트리에 순차 통합했다. 독립 검토에서 발견한 저장 중 물 깊이 혼입, 혼합 타일/높이 직접 편집 보호 누락, 음원 행 포커스/관찰자 정리를 추가 수정했다. 실제 브라우저 검증으로 편집 팝오버 clipping과 제목만 보이는 캐릭터 카드의 재생도 수정했다.

## 비교 결과

| 동작·조건 | 이전 | 수정 | 근거·해석 |
| --- | ---: | ---: | --- |
| 생활 검색: 물고기 100종×아이템 1,000개 | option 100,000개, 숨은 폼 99개 | option 1,000개, 숨은 폼 0개 | 선택 상세만 생성. 입력/상세 노드 유지 |
| 같은 생활 검색의 결과 없음, 3회 중앙값 | wall 2,233ms | wall 279ms | 자동화 + 고정 250ms 대기 포함. 장치 입력 지연/호스트 시간 아님 |
| 180ms 간격으로 `abc` 입력 | `a` / BODY 포커스 | `abc` / 검색창 포커스 | 네이티브 키보드 입력 |
| 접힌 진행 패널에서 칠하기 | 이벤트 복제 500회/스트로크 | 0회/스트로크 | 500이벤트 fixture, 패널 DOM 변경 0회 |
| 정상 모션 charset 2초 화면 밖 canvas 그리기 | 1,216회 | 0회 | 보이는 canvas는 320회 유지; 닫은 뒤 0회 |
| 맵 클릭당 목록 직접 자식 교체 기록 | 4개 | 2개 | clear+append가 2개 기록. 전체 재구성 두 번→한 번 |
| 512² 맵 마지막 칸 변경 diff | 112.3ms | 6.4ms | 같은 브라우저 함수 A/B 각 3회 중앙값. wire·호스트 저장은 별도 |
| 12맵에서 10단계 undo 점프 | 1,545.7ms | 436.2ms | 각 1회 관측. 성능 보장/통계적 결론 아님 |
| 1맵에서 10단계 undo 점프 | 877.5ms | 1,045.3ms | 개선 주장하지 않음 |

원래 감사는 main `2cd0368b93`, 저장 A/B의 옛 모듈은 감사 커밋 `7ce9a76555`에서 추출했다. 각 JSON은 실제 캡처 커밋과 생산 파일 SHA-256을 담는다. 서로 다른 시점의 캡처는 파일 해시와 수정 범위를 확인해 해석해야 한다. 최종 main 통합 후에는 저장 계약, 자료/소재/명령 상호작용, 열린 목록의 선택·Tab 및 일반 모션 캐릭터를 다시 캡처했다.

## 34개 후보 대응표

번호는 [원래 감사](../editor-ux-audit-round2-20261004/README.md)의 영역별 보고서 번호다. `코드 검토`는 실행 증거와 구분한다.

| 영역/번호 | 최종 대응 | 검증 범위 |
| --- | --- | --- |
| DB 1 | 패널 소유 연결 reader; 참조 입력 투영·명령 predicate 캐시; More 데이터 재사용 | 캐시/비캐시 결과 일치: 표시 편집과 새 명령 참조. 모든 컬렉션 회귀 파일은 미실행 |
| DB 2 | 결과 행을 먼저 필터, 선택 물고기 상세만 생성, 접힌 아이템 chips 지연 | 생활 10/50/100×100/500/1,000 옵션 수·노드 동일성 |
| DB 3 | 입력창·선택 상세 유지, 검색 결과만 갱신 | 천천히 입력한 `abc`와 포커스 유지 |
| Palette 1 | 필터 custom atlas 선택을 제자리 갱신; 닫힌 kits/combos/assist 본문 지연 | 실제 필터 선택의 sheet/input/chip 동일성; 보조 작업 호출 회귀 파일 미실행 |
| Palette 2 | 동기 store/editorState 갱신 후 맵 목록 중복 render 차단, 삭제 가능 판단 한 번 | 10/100/300맵 각각 3회 클릭 및 교체 기록 |
| Palette 3 | 조상 접힘도 Progress 비표시로 처리; 불변 이벤트 기반 완료 수 캐시 | visible/collapsed/tools 각 3회 칠하기, 복제·DOM 관측 |
| Relief 1 | committed generation 기반 서명, 변경기 무효화; lift field 최대 높이 기억 | warm 100회 격자 읽기 0, 변경기·가변 초안 무효화, 경사 pick |
| Relief 2 | 고정 world-coordinate pixel pages; pad 변경에도 상주 범위 유지 | 3스타일×4상태에서 독립 전체 RGBA/owner/under-over 동일 |
| Relief 3 | destroyed 객체 즉시 swap-remove; 새 객체도 현재 컬링 창 적용 | 실제 128² 지도 이동: tracked=resident, destroyed=0 |
| Relief 4 | 지면 surface/fingerprint 유지; 작은 칸 변경·이웃과 atlas만 무효화 | 코드 검토 + 지면 샘플을 포함한 페이지 픽셀 계약 |
| Relief 5 | 들림 전환 후보를 viewport/source window에서 먼저 선택 | 실제 페이지 이동·렌더 계약; 전환 회귀 파일 미실행 |
| Relief 6 | 타일 eviction 뒤 비어 있는 chunk를 실제 parent에서 제거 | 실제 128² 이동: emptyChunks=0 |
| Assistant 1 | IndexedDB 요약 store/index; 1회 backfill 후 scope/map/page/query, 검색 debounce | native v3→v4, scope/map/search/page/delete/abort, warm transcript scans=0 |
| Assistant 2 | 이미 검증한 불변 항목의 spatial roundtrip projection 재사용; 새 문서는 전체 검증 | 코드 독립 검토 + 공간 저작 거부/소유권 회귀 파일 미실행 |
| Assistant 3 | 정확한 source/graft/chroma key로 활동 atlas promise와 pixels 공유, 제한된 eviction | 요청 20회에서 전체 픽셀 scan 1회; 투명 픽셀 일치 |
| Assistant 4 | 변경된 dense 가지와 sparse metadata만 비교; tile/relief descriptor 각각 보호 | sparse affected [3,4,5] 및 native 혼합 사람 높이 보호 |
| Assistant 5 | 보조 격자를 crop 전에 전체 복제하지 않음; frozen 실행 tileset snapshot 공유 | 16,384칸에서 96칸×5격자×2캡처=960 읽기, 재기준화·동일 snapshot |
| Assistant 6 | activity Blob archive metadata index/key cursor prune, bounded debounce | native metadata cursor 사용; 전체 Blob/visual 조회 금지 instrumentation |
| Assets O1 | 80개 gallery page; lazy image; 선택 active만 갱신 | 241개 fixture에서 DOM 80개, 카드/scroll 유지 |
| Assets O2 | 연결·최상위·가시 strip만 캐릭터 ticker 실행; 비모션은 static | 일반 모션과 reduced 모션을 별도 캡처 |
| Assets O3 | 음원 shell/detail 유지, virtual rows, 키보드 창 이동, 명시적 dispose | 35 Tab 이동; dirty detail/focus 유지; ResizeObserver 생성/해제 2/2 |
| Assets O4 | parked 상태를 생성 전에 설정; surface/cache/visibility lifecycle | 실제 전투 preview와 parked/retained/evicted lifecycle; 전체 Skills 네이티브 조합 미측정 |
| Assets O5 | Electron If-None-Match/ETag/status 전달; 304는 gunzip 전에 bodyless 반환 | 코드 검토·회귀 파일 추가. **Electron 출하 앱 실행은 미검증** |
| Assets N1 | 전투 frame cell DOM을 high-water pool로 재사용 | 실제 preview의 노드 동일성과 childList 변경 관측 |
| Assets N2 | 전역 body observer 대신 surface owner lifecycle | 실제 preview 생성 시 body observer 수 관측 |
| Assets N3 | count projection과 monster catalog 실제 의존성 캐시; non-monster full metadata 생성 제외 | 코드 검토·호출 횟수 회귀 파일 미실행 |
| Events 1 | Tab 경계 캐시·동적 DOM 무효화, 중간 이동은 전체 열거 제외 | native 양방향 경계 wrap, 열린 100/1,000명령 Tab |
| Events 2 | selected event/command tree만 복제, immutable move/history, 영향 없는 행 유지 | native move/undo/redo: dense grid/다른 행/워크벤치 동일성, Apply |
| Events 3 | ordinary JSON structural diff·조기 종료; dense wire copy 내부 양보 | JSON fallback 동등성, wire 동등성, 실제 붓을 양보 중 실행해 제출본 보호 |
| Events 4 | 역사 점프 snapshot 순서를 계획하고 최종 복원 한 번 | mixed map/project/tileset 순서·되돌리기/다시하기 계약 |
| Events 5 | page model 검색 index, 보이는 surface만 필터, 숨은 list mount 일시정지 | 실제 zero match와 원복. 중첩/IME 전체 조합은 회귀 파일 미실행 |
| Events 6 | selection membership Set, 행 index, 변경 선택만 paint; toolbar selection sync 분리 | 100/1,000명령 전체 선택 수 일치. 시간 개선은 입증 못함 |
| Events 7 | issue path→행 index로 badge 적용 | 코드 검토·회귀 파일 미실행 |
| Events 8 | 불변 events별 draft 목록·개별 JSON·vault revision cache, 공개 읽기 사본 | warm 1,000이벤트×100 sync 읽기 0, 10초안×1,000명령 반복 저장 clone/stringify 0 |

## 실행 증거와 한계

- `life/`, `extras/`, `selection/`, `progress-events/`는 첫 수정 통합 관측이다. `selection/`·`progress-events/`의 초기 구간에는 분할 mount가 계속되는 작업이 섞였다.
- `selection-warm/`·`progress-events-warm/`은 `aria-busy` 종료 후 조작을 측정한다. 초기 mount가 빨라졌다는 증거로 사용하지 않는다. baseline warm 전체 선택 1,000개의 중앙값은 1,095ms이며 수정 warm 결과를 그대로 별도 JSON에 기록한다. 레이아웃·표시 비용과 50ms 이상 작업은 남는다.
- `contracts/`는 실제 지형 페이지·컬링과 독립 full render 픽셀 비교다. resident bytes는 page의 세 배열만 세며 프로세스 heap/RSS가 아니다. 초기 geometry/fingerprint는 여전히 O(WH), edge raster dependency는 넓은 범위를 요구할 수 있다.
- `data-resources/`, `animation/`, `storage-final/`, `extras-motion/`이 후속 통합 계약이다. 저장 왕복/SQLite 영수증 또는 게임 런타임 전체 검증으로 해석하지 않는다.
- `storage/`는 A/B 성능 원본이며 `storage-final/`은 최종 생산 파일의 계약 재확인이다. 원래 저장 fixture의 기본 칩셋 정규화 때문에 붓이 고르는 tile ID가 고정 1이라는 QA 가정은 틀렸다. 최종 계약은 실제 material/오토타일 선택을 유지하고 제출 전후 격자 쌍을 비교한다.
- fixture 구축, dev HMR 모듈 동일성, 메뉴 클릭 및 Apply 후 새 편집 초안을 여는 기존 계약에 맞춰 QA 스크립트를 보정했다. 실패 캡처를 성공 증거로 세지 않는다.
- 모든 캡처는 브라우저별 일회용 fixture로 실행했다. 실제 프로젝트 콘텐츠·원격 대화·라이브 모델에 쓰지 않았다. 조수의 viewport/백그라운드 실행 정책은 기존 경로를 유지한다.
- AGENTS 제한에 따라 local Vitest/gates/전체 typecheck를 실행하지 않았다. 회귀 파일은 추가했으나 미실행이다. esbuild syntax parse와 whitespace 검사는 별도 기록이며 타입/동작 테스트가 아니다. PR의 자동 CI는 별도로 판정한다.

## 재현

`npm run dev:worktree`로 서버를 켜고 `BASE`와 `OUT`을 지정해 `scripts/qa/editor-ux-{round2-audit,contracts-capture,data-resources-capture,animation-capture,storage-capture}.mjs`를 실행한다. audit은 `MODE=selection|progress-events|extras`, `ASSERT_AFTER=1`, 열린 명령 비교는 `EVENT_WARM=1`, charset 일반 모션은 `MOTION=no-preference`를 사용한다. 저장 성능 반복을 생략하려면 `CONTRACT_ONLY=1`이다. 생산 모듈을 갱신한 후에는 감독자의 dev 서버만 다시 시작하여 module graph를 고정한다.
