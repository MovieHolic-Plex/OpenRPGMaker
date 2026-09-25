# RPG 던전 25곳 — 자연 동굴·광산·묘지·수로·신전·마법사 탑·마왕성·기후 동굴·피라미드·용의 둥지·큰 던전·해저 신전

지형·배치 참고 사례(이동 이벤트·적·함정 동작·레버/열쇠 이벤트 없음). 「장소」 카드 25장과 공용 AI 문서 네 분류(자연·지은 던전·큰 던전·해저 신전, 모두 번들 던전 시트 `easyrpg_chipset_dungeon`에 붙는다)로 배포된다.

| 파일 | 내용 |
|---|---|
| `catalog.json` | 계획(plans: 입구·목표·출구·놓은 소품)·맵 22장·타일셋 다섯(`oprn_dungeon_stone` = 던전 시트 + 상자·광차·돌계단·흉벽 이식, `oprn_dungeon_cave/sea/desert/lair` = 같은 번호의 재칠 시트) |
| `validation.json` | 입구에서 목표·출구 칸까지 런타임 `canMove`로 닿는지(저작 스크립트가 실패하면 멈춘다), 닫힌 곳(`sealed`) |
| `sheet-classes.json` | 재칠 시트에서 무엇을 어떤 색으로 바꿨는지 |
| `images/` | 앱 렌더러로 그린 원본 픽셀 그림 |
| `*.md` | 공용 AI 문서 사본(`src/assets/sharedRpgDungeonReferences.json`과 같은 본문) |
| `storage-proof.json` | 정본 `.oprn-projects/rpg-dungeons-20260924` 저장·재오픈 증명 |

계획은 `scripts/content/rpg-dungeons/*.mjs`(caves·halls·tower·demon·climate·grand·sunken), 조립 도구는 `kit.mjs`(벽 문법·덩이·레일·계단), 채움은 `dress.mjs`(모서리 무더기·자연 무리, 빈칸 게이트 목표), 벽 혹은 `outcrops.mjs`.

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

## 해저 신전 (2026-09-25, `sunken.mjs`)
해저 동굴 북쪽 출구(15,0)에서 이어지는 세 방: 「물에 잠긴 입구 회랑」 36×23 → 「산호 기둥 대전」 40×28 → 「바다 여신 제단」 34×24. 해저 재칠 시트 `oprn_dungeon_sea`를 그대로 쓴다(새 시트 없음): 청록 바다 바위 벽·석주·여신상, 신전 석판 바닥 108·무늬 석판 109, 곧은 물길(~)과 판자 다리, 바닥이 꺼진 불규칙한 웅덩이(W, 벽면 모서리엔 붙이지 않는다), 석주 밑동이 물에 닿는 곳의 산호 무리·해초, 신전 석판 섬을 두른 둥근 물 해자(W)와 무늬 석판 제단. 출입구는 방에 낸다 — 북쪽은 벽면의 석조 아치, 남쪽은 맵 끝 테두리 한 줄을 뚫는 문 틈(허공 위 바닥 띠 없음). 지은 방이라 바닥 꾸밈(groves·heaps)은 끄고 산호는 계획에 적은 무리만. 분류는 따로 `rpg-dungeons-sunken-temple-v2`(개정2, 2026-09-25: 벽 없는 복도·흩뿌린 산호·네모 해자 수정). 옛 판은 `previous-reference.json` 으로 걷는다. 넓은 대전은 무늬 석판 신랑을 8칸 폭으로 넓히고 웅덩이를 엇갈려 파서 빈칸 게이트(≤4·≤40%)를 넘긴다.
