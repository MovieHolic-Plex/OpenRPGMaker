# 커스텀 칩셋 투명 픽셀 자동 감지 — 요구사항 ↔ 증거 대응표

OPRN-OUT-026 후속. 브랜치 `agent/chiptrans`.

각 줄은 **요구사항 → 그것을 증명하는 정확한 명령 출력 또는 스크린샷 경로**다.
"통과했다" 가 아니라 "이 명령을 이 디렉터리에서 돌리면 이 줄이 나온다" 로 적는다.

## 재현 환경

```bash
cd /home/main/z-project/rpg-zzu-chiptrans          # 워크트리(브랜치 agent/chiptrans)
DEV_SERVER_PORT=9863 npm run dev:worktree -- --port 9863   # 포트를 명시적으로 넘긴다
node scripts/qa/chipset-transparency-evidence.mjs --port 9863
```

`dev:worktree` 는 node_modules 정션을 통해 메인 저장소의 `.env.local` 을 읽을 수 있으므로
포트를 **인자로도** 넘겨야 한다(환경변수만으로는 5173 등으로 뜰 수 있다).

증거 PNG 와 검사 목록: `verify-shots/chipset-transparency/` (SUMMARY.md 가 실행 시각을 적는다).

---

## 1. 감지는 검토 신호일 뿐 — 메타를 스스로 바꾸지 않는다

| 증명 | 증거 |
|---|---|
| 감지가 검토 목록 97칸을 채운 **뒤에도** 모든 타일셋의 `priority`·`tileMeta` 가 바이트 단위로 동일 | QA 출력 `OK   아무것도 수락하지 않으면 priority·tileMeta 가 바이트 단위로 동일하다` |
| 프로젝트 정본 직렬화(`canonicalPayload`)까지 동일 | QA 출력 `OK   프로젝트 정본 직렬화(canonicalPayload)도 동일하다` |
| 화면 상태 | `verify-shots/chipset-transparency/04-metadata-unchanged.png` |
| 단위 테스트(직렬화 비교) | `npx vitest run test/customChipsetTransparencyDetection.test.ts` → `✓ 감지가 검토 목록을 채워도 타일셋 메타는 그대로다` |
| 적용은 사용자 선택에서만 | QA 출력 `OK   항목마다 선택지 제공(상위 오버레이 버튼 20개) — 적용은 사용자 몫` · `03-review-item-detail.png` (네 선택지가 항목마다 붙어 있다) |

E2E 브리지 `__oprnProjectE2E` 는 **읽기 전용**이다(`src/editor/editorToolHook.ts`).
그래서 이 증거 스크립트는 투명색조차 실제 UI 입력으로 건드린다 — 뒷문으로 상태를 바꿔놓고
"안 바뀌었다" 를 주장할 수 없는 구조다.

## 2. 타일셋별 캐시 + 이미지 변경 시 무효화

| 증명 | 증거 |
|---|---|
| 같은 이미지는 한 번만 스캔 | `✓ 같은 이미지는 한 번만 스캔한다(캐시 히트)` (getImageData 호출 1회) |
| 동시 요청 합치기 | `✓ 동시에 요청해도 한 번만 스캔한다` (이미지 로드 1회) |
| 이미지 바이트가 바뀌면 재스캔 | `✓ 이미지가 바뀌면 캐시가 무효화되고 다시 스캔한다` (1회 → 2회) |
| 아틀라스 기하가 바뀌면 재스캔 | `✓ 아틀라스 기하가 바뀌어도 캐시가 무효화된다` |
| **투명색만 바뀌어도 재스캔** | `✓ 투명색만 바뀌어도 캐시가 무효화된다 — 같은 이미지를 다른 답으로 재해석한다` |
| 스캔 완료 → 규칙 탭 1회 재렌더 | `✓ 스캔이 끝나면 이벤트를 쏜다 — 검토 목록이 그때 다시 그려진다` |

캐시 키는 `이미지 신원 + tileSize + tilesPerRow + count + transparentColor`
(`customChipsetAlphaCacheKey`). 이미지가 바뀌면 `tilesetImageUrl` 이 바뀌므로 키가 자동으로 달라진다.

## 3. 읽지 못하는/오염된 이미지는 정직한 "알 수 없음"

| 증명 | 증거 |
|---|---|
| CORS 오염(SecurityError) → unknown | `✓ CORS 오염 이미지는 unknown 이다 — opaque 로 낙관하지 않는다` |
| 오염 시 타일이 '알 수 없음' 으로 표시되고 불투명이라 말하지 않음 | `✓ 오염된 칩셋의 타일은 '알 수 없음' 으로 표시되고 불투명이라 말하지 않는다` |
| 로드 실패 → unknown | `✓ 이미지 로드 실패도 unknown 이다` |
| unknown 도 캐시(실패 이미지를 매 렌더 재시도하지 않음) | `✓ unknown 결과도 캐시된다` |
| 버퍼가 이미지보다 작으면 unknown | `✓ 버퍼가 이미지보다 작으면 모른다고 답한다 — 불투명으로 추측하지 않는다` |

화면 문구는 `tileset-alpha-scan-unknown` 노트로 이유까지 그대로 적는다
(`⚠ 투명 여부 알 수 없음 — … 불투명으로 단정하지 않았습니다.`).

## 4. 내장 칩셋 경로 불변

| 증명 | 증거 |
|---|---|
| 내장 칩셋 규칙 탭에 스캔 노트가 아예 없다 | QA 출력 `OK   내장 칩셋(easyrpg_chipset_dungeon) 규칙 탭에는 스캔 노트가 없다 — 생성 목록이 정본` |
| 화면 | `verify-shots/chipset-transparency/05-bundled-chipset-unscanned.png` |
| 스캔 자체를 하지 않는다 | `✓ 내장 칩셋은 스캔하지 않는다 — 생성된 투명 목록이 정본이다` |
| 감지를 억지로 주입해도 판정이 안 바뀐다 | `✓ 감지를 주입해도 내장 칩셋 판정은 바뀌지 않는다` |
| 런타임 렌더러 경로 무영향 | `tileBackingTile(tileset, tile)` 는 감지 인자를 받지 않는다(`src/editor/tileLayerPolicy.ts`) — 감지는 편집기 표면에서만 주입된다 |

## 5. 실측 임계값

`node scripts/measureChipsetAlpha.mjs` — 시트 6장 · 16×16 셀 2,880칸.

| 상수 | 값 | 관측 근거 |
|---|---|---|
| `OPAQUE_ALPHA` | 250 | 알파 249~254 픽셀이 표본에 **0개** |
| `EMPTY_ALPHA` | 8 | 알파 1~8 픽셀이 표본에 **0개** |
| `SOFT_EDGE_MAX_RATIO` | 16/256 (6.25%) | 비불투명 픽셀 수가 2·4·5·6·7·8·11·12·16 에 몰리고 그 위로 벌어진다 |
| `MOSTLY_EMPTY_MAX_COVERAGE` | 0.15 | 0이 아닌 최저 커버리지 0.043·0.109·0.121·0.129 다음이 0.156 — 그 빈 구간을 가른다 |

브라우저 실측(Modern Exteriors 아틀라스 480칸):
`불투명 302 · 부분 투명 135 · 거의 빈 칸 2 · 가장자리만 부드러움 19 · 빈 칸 22`,
그중 검토 목록에 오른 것은 **97칸**(뚫린 투명만).
→ QA 출력 `OK   스캔 요약 표시: …` 및 `OK   검토 목록 열림: 배경 없는 하위 타일 검토 (97)`.

## 6. 투명색 키(color key) — 실측으로 찾아낸 결함과 수정

이어받기 전 남아 있던 `99-failure.png` 는 **실패한 수확의 잔해**였다(수확이 예외로 죽으면서
찍힌 catch 블록 스크린샷). 다만 그 그림이 우연히 진짜 결함을 담고 있었다:
`투명색 #ff00ff` 가 걸린 칩셋인데 규칙 탭이
`자동 판정: 하위 / 불투명 바닥 — … 받침이 필요 없습니다` 라고 단정하고 있었다.

원인(코드로 확인): 런타임은 `transparentColor` 를 **베이크 시점에** 키아웃하는데
(`tilesetTextureNeedsBake` → `createTransparentColorKeyCanvas`), 알파 스캔이 읽는
`tilesetImageUrl` 은 키아웃 **이전** 바이트다. 그래서 마젠타 배경 시트(알파 전부 255)가
'전부 불투명' 으로 판정되어 검토 목록에서 사라진다 — 가장 위험한 거짓 음성.

- 수정: 커밋 `2aa344397` — 스캔도 베이크와 같은 `applyTransparentColorKeys` 를 적용한다.
  `getImageData` 는 사본이라 원본 이미지·캔버스를 만지지 않는다.
- 회귀 테스트 3건(합성 마젠타 시트):
  - `✓ 투명색 키로 배경을 만든 칩셋은 부분 투명으로 잡힌다 — 알파만 보면 전부 불투명이다`
    (키 없으면 `opaque×4`, 키 걸면 `partial×4` + 검토 목록 4칸)
  - `✓ 투명색만 바뀌어도 캐시가 무효화된다`
  - `✓ 스캔은 원본 픽셀 버퍼를 오염시키지 않는다 — 키아웃은 사본에서만 일어난다`
- **테스트에 이빨이 있는지 실측**: 수정 한 줄을 주석 처리하고 돌리면
  `Tests  1 failed | 23 passed (24)` 로 첫 번째 테스트만 떨어진다. 되돌리면 24 통과.

`99-failure.png` 는 삭제했다(잔해이므로). 대신 같은 화면을 **설명된 검사**로 다시 찍었다:
`06-transparent-color-key-rescan.png`.

### 06 이 증명하는 것 (그리고 증명하지 않는 것)

Modern Exteriors 아틀라스는 이미 RGBA 알파를 쓰고 **마젠타 픽셀이 0개**다. 직접 센 값:

```
$ python3 (PNG 디코드) public/assets/modern-exteriors/modern-city-atlas.png
IHDR 480 256 8 6
magenta(#ff00ff +-8) pixels: 0
alpha==0: 16144  alpha==255: 102294  partial alpha: 4442
```

따라서 이 아틀라스에서 `#ff00ff` 키는 **정당한 no-op** 이고, 판정이 그대로인 것이 정답이다.
06 이 고정하는 계약은 "키를 걸어도 없는 투명을 발명하지 않고, 요약이 사라지지도 않는다" 다.
→ QA 출력 `OK   투명색 #ff00ff 를 걸어도 판정이 변하지 않는다 — … 없는 투명을 발명하지 않았다`.

색 키가 실제로 판정을 뒤집는 변환은 마젠타 픽셀이 **있는** 합성 시트로 단위 테스트가 잡는다
(위 회귀 3건). 브라우저 증거와 단위 증거의 역할을 섞지 않는다.

> 첫 시도에서는 06 에 "판정이 바뀌어야 한다" 고 단언했다가 `FAIL` 이 났다.
> 코드가 아니라 **내 단언이 틀렸다** — 아틀라스를 직접 디코드해 마젠타 0개를 확인하고
> 계약을 사실에 맞췄다. 실패를 지우지 않고 원인을 측정한 기록으로 남긴다.

## 7. 수확 스크립트 자체의 정직성

| 요구 | 증거 |
|---|---|
| 단언 실패 시 **비영(非零) 종료** | 대상 타일셋 id 를 존재하지 않는 값으로 바꿔 실행 → `EXIT=1`, `FAIL` 1건. 원복 후 `EXIT=0` |
| 진짜 페이지 오류 보고 | `page.on("pageerror")` + 콘솔 error 수집. 무해 패턴(favicon 등)만 이름으로 빼고 나머지는 검사 실패로 올린다 → `OK   페이지 오류 0건(콘솔 error · 잡히지 않은 예외)` |
| 고정 sleep 금지 | 모든 대기는 `waitFor` / `waitForFunction` — 시간 운에 기대는 통과가 없다 |

## 8. 최종 검증 (이 워크트리에서 실제로 돌린 것)

```
$ npm run typecheck:app
(무출력 — 통과)

$ npx vitest run test/customChipsetTransparencyDetection.test.ts test/tileLayerPolicy.test.ts \
    test/tileLayerPolicyEditorSurface.test.ts test/tilesetSectionTabs.test.ts --maxWorkers=2
 Test Files  4 passed (4)
      Tests  55 passed (55)

$ node scripts/qa/chipset-transparency-evidence.mjs --port 9863
 13개 검사 전부 OK, EXIT=0
```

전체 `npm run typecheck` · 전체 스위트 · `npm run gates` 는 **기준선에서 이미 적색**이다
(gates 는 vitest JSON 리포트를 아예 쓰지 않는다). 이 변경과 무관함은 stash 로 확인한다.

## 커밋

| 해시 | 내용 |
|---|---|
| `d70c9f140` | 순수 알파 스캔 판정 + 임계값 실측 스크립트 |
| `6396a7ca1` | 감지를 검토 신호로만 배선(정책 주입·검토 목록·unknown 표시·내장 불변) |
| `2aa344397` | 투명색 키 칩셋도 스캔이 런타임과 같은 알파를 본다(거짓 음성 수정) + 회귀 3건 |
| `07e24e303` | 브라우저 증거 수확 스크립트 + 실패 시 비영 종료 + 페이지 오류 검사 |
| `108173212` | openwiki 계약 확정(임계값 숫자) + 이 대응표 |
| `edf54d0a1` | 최종 커밋 트리에서 증거 재수확(문구 오타 수정분 반영) |
