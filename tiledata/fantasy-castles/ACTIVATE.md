# fantasy_castles — 번들 배선(활성화) 순서

**지금은 하지 않는다.** AGENTS.md 「새 도트 그림은 3/4 탑뷰 관문을 통과해야 한다」 — `fc_gate.py check` 의 막힘이 0 이 될 때까지
그림(시트·참고 그림)은 `tiledata/fantasy-castles/build/` 대기 구역에만 있고 `public/` 에 없다. 관문을 건너뛰거나 기준을 낮추는 길은 없다.

## 0. 전제

```bash
python3 scripts/content/fantasy-castles/fc_gate.py units     # 판정 단위 그림 다시 만들기(그림이 바뀌면 해시가 바뀐다)
python3 scripts/content/fantasy-castles/fc_gate.py review    # 판정자 영수증
python3 scripts/content/fantasy-castles/fc_gate.py check     # blocked 0 이어야 한다
python3 scripts/content/fantasy-castles/fc_gate.py publish   # check 를 다시 돌려 0 일 때만 public/·src/assets 로 옮기고 장부를 동결한다
```

## 1. 코드 배선 (publish 가 성공한 뒤, 한 커밋)

| 파일 | 할 일 |
|---|---|
| `src/assets/bundled.ts` | `import fantasyCastlesSheet from "./fantasyCastlesSheet.json"` · `BUNDLED_EASYRPG_CHIPSET_ASSETS` 에 `{textureKey:"tex_fantasy_castles",path:"assets/fantasy-castles/fantasy-castles-chipset.png",name:"판타지 성채 · 스톰베일·헬름 협곡 (손 도트)"}` · frameCount 에 `if (key === "tex_fantasy_castles") return fantasyCastlesSheet.count;` |
| `src/assets/bundledChipsetGeometry.ts` | tilesPerRow 에 `if (key === "tex_fantasy_castles") return fantasyCastlesSheet.tilesPerRow;` |
| `src/project/defaults/defaultAssets.ts` | `import { FANTASY_CASTLES_TEXTURE, createFantasyCastlesTileset, ensureFantasyCastlesReferences, ensureFantasyCastlesTileset, fantasyCastlesBundledReferenceDocuments } from "./fantasyCastles"` · 참고문서 표에 `[FANTASY_CASTLES_TEXTURE]: fantasyCastlesBundledReferenceDocuments` · `ensureBundledTilesets` 블록 `if (asset.textureKey === FANTASY_CASTLES_TEXTURE) { ensureFantasyCastlesTileset · ensureFantasyCastlesReferences }` · `bundledEasyRpgTileset` 생성 분기에 `createFantasyCastlesTileset()` |
| `src/project/tilesetHarness/combinedTown.ts` | `applyCustomChipsetMinimalHarness` 제외 목록에 `tex_fantasy_castles` — 빠지면 RM2k3 480칸 투명표가 칸 번호로 priority 를 upper 로 올려 2·3층 걸음 칸이 ★ 가 되고 통행이 바뀐다 |
| `src/project/tilesetFamily.ts` | `"oprn-fantasy-castles": "판타지 성채(도트)"` |
| `test/bundledTilesetIdParity.test.ts` | 생성자 표에 `tex_fantasy_castles: createFantasyCastlesTileset` |
| `test/fantasyCastlesTileset.test.ts` | 「관문 전이라 … 없다」 시험을 「번들 자산 목록과 ensureBundledTilesets 가 만든다」로 뒤집는다 |
| (선택) `src/project/defaults/bundledJsonSources*.ts`·`bundledJson.ts` | 정의 JSON 이 커지면 지연 읽기로 옮긴다(지금은 정적 import) |

## 2. 검증

새 프로젝트와 기존 프로젝트(타일셋 없음·옛 짧은 사본) 양쪽에서 `ensureBundledTilesets` → 저장 → 재로드, `save-fantasy-castles.mjs` 의 엔진 통행·경로,
`render-fantasy-castles.mjs` 의 편집기 렌더 = composite.png, 실제 편집기 화면 증거 `verify-shots/fantasy-castles/`.
