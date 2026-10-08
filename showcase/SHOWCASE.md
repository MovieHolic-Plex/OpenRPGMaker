# OPRN Studio 쇼케이스 자료 (사이트 제작용)

openrpgmaker.com 메인 페이지를 꾸미는 에이전트가 읽는 문서입니다. 그림, 문구, 페이지 구성, 주의할 점을 담았습니다.
그림은 모두 이 폴더의 `images/`에 있습니다. 아래 경로는 이 문서 기준 상대 경로입니다.

- 저장소: https://github.com/MovieHolic-Plex/OpenRPGMaker (공개)
- 에셋 스토어: https://store.openrpgmaker.com/
- 그림 11장은 사용자가 직접 고른 것입니다. 다른 그림을 임의로 더하지 마세요. 필요하면 먼저 사용자에게 물어보세요.

---

## 1. 한 줄 소개

| 언어 | 큰 제목 | 부제 |
|---|---|---|
| English | Make your own pixel-art JRPG — just describe it. | A tile-based JRPG maker with an AI assistant built in. Hand-made 16px worlds, and the games you make are yours. |
| 中文 | 说出你的想法，做出你的像素 JRPG。 | 内置 AI 助手的图块式 JRPG 制作工具。手绘 16px 世界，你做出的游戏完全属于你。 |
| 日本語 | 話すだけで、あなたのドット絵 JRPG を。 | AI アシスタント内蔵のタイル式 JRPG メーカー。手打ち 16px の世界、作ったゲームはあなたのもの。 |
| 한국어 | 말하면 만들어지는 나만의 도트 JRPG. | AI 조수가 들어 있는 타일 JRPG 메이커. 손으로 찍은 16px 세계, 만든 게임은 만든 사람의 것. |

사이트에 이미 있는 「브라우저에서 JRPG를 만든다」 문구는 부제로 써도 됩니다.

---

## 2. 그림 목록

모두 직접 만든 그림이고 제3자 그림은 없습니다. 도트 그림이므로 확대할 때 반드시 `image-rendering: pixelated`를 쓰세요.
흐릿하게 늘리거나 JPEG로 다시 압축하면 도트가 뭉개집니다.
도트 그림은 2배·3배 같은 **정수 배율**로만 키우세요.

| 파일 | 크기 | 보이는 것 | 추천 자리 | alt (영어) |
|---|---|---|---|---|
| `images/title-moonlit-castle.jpg` | 1024×768 | 달밤의 성 위로 뜬 타이틀 「Oath of the Blade」. 빛내림·시차 스크롤이 움직이는 타이틀 화면 | **히어로 1순위** | Animated title screen — a castle under a full moon |
| `images/title-misty-ruins.jpg` | 1024×768 | 안개 낀 숲 유적 위의 같은 타이틀 | 히어로 슬라이드 2장째 / 「연출」 절 | Animated title screen over misty ruins |
| `images/editor-willow-bend.png` | 1600×1000 | 영어 UI 에디터. 강이 굽이치는 로마풍 마을(목조 집 41동, 교회, 다리 3개)을 편집하는 화면 | 「에디터」 절 대표 | The editor with a riverside village |
| `images/editor-japanese-town.png` | 1600×1000 | 한국어 UI 에디터. 일본 상점가(간판, 전봇대, 자전거)를 편집하는 화면 | 「에디터」 절 둘째 | Editing a Japanese shopping street |
| `images/editor-apartment-interior.png` | 1600×1000 | 맵 트리와 원룸 아파트 실내를 편집하는 화면 | 「실내·맵 트리」 설명 | Editing an apartment interior with the map tree |
| `images/play-japanese-house.png` | 960×720 | 실제 플레이 화면. 2층 일본 주택 1층(다다미방, 부엌, 욕실, 거실)을 주인공이 걷는 장면 | 「바로 플레이」 절 | Play mode — walking through a Japanese house |
| `images/battle-skeleton-knight.png` | 960×720 | 숲 배경의 측면 도트 전투. 해골 기사와 주인공, 명령 창 | 「전투」 절 | Side-view pixel battle against a skeleton knight |
| `images/map-joseon-palace.png` | 1600×1664 | 조선 궁궐 맵 전체. 해자, 정전, 정원, 성곽 | 「세계」 갤러리 큰 칸 | A Joseon-era royal palace |
| `images/map-joseon-village.png` | 1024×896 | 개울가 조선 마을 전체. 기와집, 초가, 논밭 | 「세계」 갤러리 | A Joseon-era village by a stream |
| `images/map-japanese-town.png` | 1536×1280 | 현대 일본 주택가·상점가 전체 | 「세계」 갤러리 큰 칸 | A modern Japanese town |
| `images/map-tram-street.png` | 768×480 | 노면전차가 지나는 일본 거리 | 「세계」 갤러리 작은 칸 | A street with a tram line |
| `images/icon.png` | 256×256 | 앱 아이콘(도트 검) | 파비콘, 머리말 로고 옆 | OPRN Studio icon |

---

## 3. 추천 페이지 구성

1. **히어로**
   - 배경은 `title-moonlit-castle.jpg`를 크게 깔고 큰 제목과 부제를 얹습니다.
   - 버튼은 「GitHub 에서 받기」와 「에셋 스토어」 두 개입니다.
   - 슬라이드를 쓴다면 `title-misty-ruins.jpg`를 둘째 장으로 씁니다.
2. **무엇을 만들 수 있나** — 카드 4장 (문구는 4절)
   - 정통 JRPG: `battle-skeleton-knight.png`
   - 역사·현대 무대: `map-joseon-palace.png`
   - 일상·현대: `play-japanese-house.png`
   - 이야기 게임: 맞는 그림이 없으니 아이콘이나 글만 씁니다.
3. **AI 조수**
   - `editor-willow-bend.png`에 말풍선 예시 「교회와 주막이 있는 항구 마을 만들어 줘」를 겹쳐 둡니다.
   - 그림 속 화면에는 조수 창이 닫혀 있습니다. 말풍선은 장식으로 그려 넣으세요.
4. **제대로 된 에디터** — `editor-japanese-town.png`, `editor-apartment-interior.png`, 특징 표 (5절)
5. **손 도트 세계 갤러리**
   - 큰 칸: `map-joseon-palace.png`, `map-japanese-town.png`
   - 작은 칸: `map-joseon-village.png`, `map-tram-street.png`
   - 맵 전체 그림은 세로가 긴 것이 있습니다. 칸에 맞춰 자를 때는 가운데를 기준으로 자르세요.
6. **오픈 소스·라이선스**
   - 만든 게임은 만든 사람의 것입니다(판매 가능, 로열티 없음).
   - 런타임은 MIT, 에디터는 Sustainable Use License 입니다.
7. **바닥글** — GitHub, 에셋 스토어. 「RPG Maker·Gotcha Gotcha Games·KADOKAWA와 관계없음」 한 줄을 넣습니다.

---

## 4. 무엇을 만들 수 있나 (카드 문구)

| | English | 한국어 |
|---|---|---|
| ⚔️ | **Classic JRPGs** — towns, dungeons, world maps and side-view battles | **정통 JRPG** — 마을, 던전, 월드맵, 측면 전투 |
| 🐉 | **Monster-collecting adventures** — catch, raise and battle creatures | **몬스터 수집 모험** — 잡고, 키우고, 겨루기 |
| 🏯 | **Historical and modern settings** — a Joseon palace, a Japanese neighbourhood, a modern city, a magic school | **역사와 현대 무대** — 조선 궁궐, 일본 주택가, 현대 도시, 마법 학교 |
| 💌 | **Story games** — romance, mystery and horror with branching dialogue and cutscenes | **이야기 게임** — 갈림길 대화와 컷신이 있는 연애·추리·호러 |

중국어·일본어 문구는 저장소 루트 `README.md`의 「可以做什么」「作れるもの」 절에 같은 내용이 있습니다.

---

## 5. 특징 (본문 문구)

| | English | 한국어 |
|---|---|---|
| 🤖 AI 조수 | Builds maps, villages, interiors, events and dialogue from plain language. Sign in with Google (Gemini) or ChatGPT (Codex) — no API key needed. | 말로 맵·마을·실내·이벤트·대사를 만듭니다. Google(Gemini)이나 ChatGPT(Codex) 계정으로 로그인하면 되고 API 키는 필요 없습니다. |
| 🎨 손 도트 세계 | Ready-to-use tilesets: a Roman-style harbor town, Joseon Korea, a Japanese city, a modern city, a magic school and cozy interiors. | 바로 쓰는 타일셋: 로마풍 항구 도시, 조선, 일본 도시, 현대 도시, 마법 학교, 아늑한 실내. |
| 🗺️ 에디터 | Layered tile maps, height and cliffs, world maps, a database for actors, skills, items and enemies, and an RPG Maker-style event command list. | 층으로 나뉜 타일 맵, 높이와 절벽, 월드맵, 배우·스킬·아이템·적 자료집, RPG 쯔꾸르식 이벤트 명령. |
| 🎬 연출 | Animated title screens with light rays and parallax, opening cinematics, camera moves and dialogue portraits. | 빛내림과 시차 스크롤이 있는 타이틀 화면, 오프닝 컷신, 카메라 연출, 대화 초상. |
| ⚔️ 측면 전투 | Pixel battlers with idle animations, skills, states and rewards — all driven by your database. | 대기 동작이 있는 도트 전투 캐릭터. 스킬·상태·보상이 모두 자료집대로 돌아갑니다. |
| 🌐 내보내기 | Test-play inside the editor and export your game as a web game. The exported player is MIT-licensed. | 에디터 안에서 바로 테스트하고 웹 게임으로 내보냅니다. 내보낸 플레이어는 MIT 라이선스입니다. |
| 🛒 스토어 | Share and download characters, tilesets and map objects at store.openrpgmaker.com. | store.openrpgmaker.com 에서 캐릭터·타일셋·맵 기물을 나누고 받습니다. |
| 🌏 4개 언어 | The editor speaks English, 中文, 日本語 and 한국어. | 에디터는 영어·중국어·일본어·한국어를 지원합니다. |

---

## 6. 주의할 점

- **지금 히어로 초상화.** 사이트 메인의 안내인 초상이 「진격의 거인」 아르민과 많이 닮았습니다. 그림을 바꾸거나 위 타이틀 그림으로 대체하세요.
- **지금 페이지 아래쪽이 비어 있습니다.** 전체 페이지 캡처에서 히어로 아래가 빈 화면으로 나옵니다. 스크롤 애니메이션이 화면에 들어올 때만 내용을 그리는 구조라면, 캡처와 검색 엔진에도 내용이 보이게 하세요.
- **다른 작품 이름을 쓰지 마세요.** 「포켓몬」「해리포터」「쯔꾸르 대체」 같은 표현을 문구에 넣지 않습니다. 「몬스터 수집」「마법 학교」로 씁니다.
- **새 게임 화면(컨셉 피드) 그림은 쓰지 마세요.** 일부 카드가 남의 캐릭터를 닮아 사용자가 이번 목록에서 뺐습니다.
- **API 키, 내부 주소(사내 호스트 이름, 내부 IP), 개인 경로를 페이지에 넣지 마세요.**
- 「PRIVATE PREVIEW」 표시는 저장소가 공개되었으므로 빼도 됩니다. 단, 사용자에게 한 번 확인하세요.
