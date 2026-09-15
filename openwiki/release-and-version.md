# 릴리스와 버전

**TL;DR** — 이 저장소에는 **네 개의 다른 버전 축**이 있다. 섞으면 "지금 몇 버전이지" 라는 질문에 답할 수 없게 된다.
릴리스 버전의 정본은 `package.json` 하나이고, 올리는 명령은 `npm run release` 하나다.
매 머지마다 올리지 않는다(실측 하루 머지 26건).

## 네 축을 구분한다

| 축 | 현재 값 | 무엇의 약속인가 | 정본 위치 |
|---|---|---|---|
| **앱 버전** | `0.1.0` | 도구 OPRN Studio 자체의 릴리스 | `package.json` → 빌드가 주입 |
| 프로젝트 문서 스키마 | `SCHEMA_VERSION` = 4 | 저장 파일 포맷 호환 | `src/project/types/base.ts`, `projects.schema_version` |
| 로컬 스토어 포맷 | 설계 중 | SQLite 레이아웃 | `docs/superpowers/specs/2026-09-15-oprn-local-sqlite-store-design.md` (`meta.format_version`) |
| 발행 게임 버전 | 기본 `1.0` | **사용자가 만든 게임**의 릴리스 | 발행 대화상자 "게임 버전" (`src/editor/panels/publishingDialog.ts`) |

앱 `0.1.0` 과 게임 `1.0` 은 다른 물건이다. 앱 버전을 올렸다고 사용자 게임 버전이 바뀌지 않는다.

## 릴리스 버전은 왜 매 머지가 아닌가

실측(2026-09-16): 지난 7일 머지 184건 = **하루 약 26건**, 전체 커밋 716건.
매 머지마다 버전을 올리면 하루에 26개 버전이 생긴다. 그러면:

- 숫자가 아무 약속도 하지 않는다(0.1.17 에서 고쳤는지 묻는 질문 자체가 의미를 잃는다).
- CHANGELOG 가 하루 26줄이 되어 아무도 안 읽는다.

그래서 숫자를 둘로 나눈다.

- **빌드 식별자**: 매 머지·빌드마다 자동. 아무도 관리하지 않는다. `0.1.0-dev.184+gddc7a88`
- **릴리스 버전**: 사람이 정한다. `npm run release` 만 올린다. 태그 `v0.1.0` 이 그 약속의 정체성이다.

## 빌드 식별자

계산 지점은 `scripts/lib/appVersion.mjs` 하나다. 빌드는 vite 플러그인(`appVersionPlugin()`)이
`__APP_VERSION__`·`__APP_VERSION_META__` 를 define 으로 주입하고, 앱은 `src/brand.ts` 에서 읽는다.

| 상태 | 라벨 |
|---|---|
| 태그가 현재 버전 그대로이고 그 위 커밋 없음 | `0.1.0` |
| 태그 이후 N커밋 | `0.1.0-dev.3+gddc7a88` |
| 태그가 아직 없음(저장소 전체 커밋 수를 쓴다) | `0.1.0-dev.5160+gddc7a88` |
| 추적 파일이 수정된 트리 | 위 라벨 + `.dirty` |
| git 을 못 쓰는 환경(tarball 등) | `0.1.0+nogit` |

보이는 곳 세 군데 — 값이 갈라지지 않게 한 계산을 공유한다.

- 도움말 모달의 `버전 …` 줄(툴팁에 커밋·기준 태그·빌드 시각)
- `window.__oprnVersion()` — 버그 리포트·헤드리스 도구용
- CLI: `npm run version:info` (`--json` 가능). 아티팩트 이름·CI 가 쓴다.

주입이 없는 번들(vitest 등)에서는 `0.0.0-nogit` 으로 떨어진다 — 죽지 않는다.

## 릴리스 절차

```bash
# 1. 기준선 확인. 릴리스 대상 파일에 미커밋 변경이 있으면 스크립트가 거부한다.
git status --porcelain -- package.json package-lock.json CHANGELOG.md

# 2. 노트 미리보기 (아무것도 쓰지 않는다)
npm run release -- --dry-run --minor --summary "로컬 SQLite 저장 첫 배포"

# 3. 자르기 — package.json·package-lock.json 범프 + CHANGELOG 항목 + 커밋 + 주석 태그
npm run release -- --minor --summary "로컬 SQLite 저장 첫 배포"

# 4. 사람이 확인하고 민다 (스크립트는 푸시하지 않는다)
git push origin HEAD && git push origin v0.2.0
gh release create v0.2.0 --title "v0.2.0" --notes-from-tag
```

첫 릴리스는 범프 없이 현재 버전을 태그한다: `npm run release -- --first` (노트는 최근 300커밋까지).

**언제 올리나** — 사용자가 알아챌 약속이 바뀌었을 때만.

- 저장 포맷·스키마·업데이터 호환처럼 되돌리기 어려운 변화 → `--minor` (0.x 에서는 깨지는 변경이 MINOR 다)
- 그 외 수정·기능 → `--patch`
- `1.0.0` 조건: 로컬 SQLite 저장 + 데스크톱 패키징 + 업데이트 채널. 그 전까지는 정직하게 0.x.
- 되돌릴 때도 숫자는 내려가지 않는다 — 새 버전으로 다시 낸다.

## 커밋 메시지가 릴리스 노트의 원고다

`npm run release` 는 `git log` 에서 노트를 만든다(`scripts/lib/releaseNotes.mjs`). 손으로 쓰는 노트는
릴리스마다 빠지고, 빠진 릴리스는 아무도 안 쓴다.

- 섹션: `feat` 기능 · `fix` 수정 · `perf` 성능 · `refactor` 정리 · `docs` 문서 · `test` 테스트 ·
  `style` 스타일 · `build` 빌드 · `ci` CI · `revert` 되돌림 · `chore` 잡무
- `!` 를 붙이면(`feat(editor)!:`) "깨지는 변경" 섹션이 맨 앞에 서고 원래 섹션에도 남는다
- 머지 커밋과 `chore(release): …` 는 제외한다
- 규약을 안 따른 메시지도 버리지 않고 "기타" 로 싣는다 — 조용히 사라지는 변경을 만들지 않기 위해서다
- 같은 요약은 한 번만 싣는다(체리픽·리베이스 중복 방지)

사람이 쓸 자리는 `--summary` 한 줄이다.

## 아직 안 한 것

- **release-please**: 릴리스가 주기적으로 돌기 시작하면 붙인다(지금 붙이면 릴리스 PR 이 계속 열려 있다).
  커밋 규약은 이미 있어 그대로 동작한다.
- **업데이터·채널**: 데스크톱 패키징 뒤. stable/beta/nightly 는 프리릴리스 태그(`0.2.0-beta.1`)로 가른다.
- **아티팩트 매니페스트의 도구 버전**: 내보낸 플레이어(sdk-manifest.json)에 아직 앱 버전이 안 들어간다.
- **CHANGELOG 링크**: 저장소 URL 이 정해지면 버전 제목에 compare 링크를 붙인다.

## 검증

```bash
npm run version:info                                  # 이 트리의 빌드 라벨
node scripts/run-vitest.mjs run test/releaseTooling.test.ts  # 라벨 규칙·범프·노트 생성
npm run release -- --minor --dry-run                   # 계획과 노트만 (파일 안 씀)
npm run build:app && grep -rhoE '0\.1\.0-dev\.[0-9]+\+g[0-9a-f]+' dist/assets | head -1
```

실제 릴리스 절차는 임시 저장소에서 먼저 돌려볼 수 있다(커밋·태그가 그 저장소 안에서만 만들어지므로 안전하다).
