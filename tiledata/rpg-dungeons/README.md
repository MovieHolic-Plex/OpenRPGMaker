# RPG 던전 22곳 — 자연 동굴·광산·묘지·수로·신전·마법사 탑·마왕성·기후 동굴·피라미드·용의 둥지·큰 던전

지형·배치 참고 사례(이동 이벤트·적·함정 동작·레버/열쇠 이벤트 없음). 「장소」 카드 22장과 공용 AI 문서 세 분류(자연·지은 던전·큰 던전, 모두 번들 던전 시트 `easyrpg_chipset_dungeon`에 붙는다)로 배포된다.

| 파일 | 내용 |
|---|---|
| `catalog.json` | 계획(plans: 입구·목표·출구·놓은 소품)·맵 22장·타일셋 다섯(`oprn_dungeon_stone` = 던전 시트 + 상자·광차·돌계단·흉벽 이식, `oprn_dungeon_cave/sea/desert/lair` = 같은 번호의 재칠 시트) |
| `validation.json` | 입구에서 목표·출구 칸까지 런타임 `canMove`로 닿는지(저작 스크립트가 실패하면 멈춘다), 닫힌 곳(`sealed`) |
| `sheet-classes.json` | 재칠 시트에서 무엇을 어떤 색으로 바꿨는지 |
| `images/` | 앱 렌더러로 그린 원본 픽셀 그림 |
| `*.md` | 공용 AI 문서 사본(`src/assets/sharedRpgDungeonReferences.json`과 같은 본문) |
| `storage-proof.json` | 정본 `.oprn-projects/rpg-dungeons-20260924` 저장·재오픈 증명 |

계획은 `scripts/content/rpg-dungeons/*.mjs`(caves·halls·tower·demon·climate·grand), 조립 도구는 `kit.mjs`(벽 문법·덩이·레일·계단), 채움은 `dress.mjs`(모서리 무더기·자연 무리, 빈칸 게이트 목표), 벽 혹은 `outcrops.mjs`.

재생성 순서(렌더는 dev 서버 `npm run dev:worktree`가 떠 있어야 한다):

```bash
python3 scripts/content/build-rpg-dungeon-sheets.py      # 재칠 시트 넷(사막 석관 포함)
node scripts/content/author-rpg-dungeons.mjs             # 저작 + 통행 검사
node scripts/content/render-rpg-dungeons.mjs tiledata/rpg-dungeons/catalog.json tiledata/rpg-dungeons/images
python3 /tmp/oprn-qa/emptiness.py tiledata/rpg-dungeons/catalog.json --kind dungeon --plain 421,187,108,301,67,110,141
node scripts/content/prepare-rpg-dungeons-references.mjs
node scripts/content/save-rpg-dungeons.mjs
node scripts/content/prepare-rpg-dungeons-regions.mjs output/evidence/rpg-dungeons/reloaded.json
```

한 맵만 고칠 때: `DUNGEON_ONLY=<id,…> DUNGEON_LAX=1 node scripts/content/author-rpg-dungeons.mjs`(→ `catalog.partial.json`).
분류를 고쳐 다시 배포할 때는 분류 id의 `-v1`을 올리고 옛 id를 은퇴 목록에 넣어야 기존 프로젝트에서 교체된다(지금은 추가만 한다).
마왕성 정문(`dungeon-demon-front`)과 숲 미로는 아직 없다 — 복도 남쪽 출구는 자리만 있다.
