<div align="center">

<img src="showcase/images/icon.png" width="96" alt="OPRN" />

# OPRN Studio

### Make your own pixel-art JRPG — just describe it.

**English** · [中文](#中文) · [日本語](#日本語) · [한국어](#한국어)

[![Website](https://img.shields.io/badge/website-openrpgmaker.com-5865f2)](https://openrpgmaker.com/)
[![Asset Store](https://img.shields.io/badge/asset%20store-store.openrpgmaker.com-f59e0b)](https://store.openrpgmaker.com/)
[![Editor: SUL](https://img.shields.io/badge/editor-Sustainable%20Use-0ea5e9)](LICENSE.md)
[![Runtime: MIT](https://img.shields.io/badge/runtime-MIT-22c55e)](LICENSE-RUNTIME.md)
![Languages](https://img.shields.io/badge/UI-EN%20·%20中文%20·%20日本語%20·%20한국어-a855f7)

<img src="showcase/images/title-moonlit-castle.jpg" width="92%" alt="An animated title screen made with OPRN Studio — a castle under a full moon" />

</div>

<table>
  <tr>
    <td width="50%"><img src="showcase/images/editor-willow-bend.png" alt="The OPRN Studio editor with a riverside village" /></td>
    <td width="50%"><img src="showcase/images/battle-skeleton-knight.png" alt="A side-view pixel battle against a skeleton knight" /></td>
  </tr>
  <tr>
    <td width="50%"><img src="showcase/images/map-joseon-palace.png" alt="A Joseon-era royal palace map" /></td>
    <td width="50%"><img src="showcase/images/map-japanese-town.png" alt="A modern Japanese town map" /></td>
  </tr>
</table>

<div align="center">

[Gallery](#gallery) · [For developers](#for-developers) · [License](#license) · [Showcase notes](showcase/SHOWCASE.md)

</div>

---

<a id="english"></a>

## English

**OPRN Studio is a tile-based JRPG maker with an AI assistant built in.**
Draw maps, place events and play your game instantly — or tell the assistant
*"build a harbor village with a church and a tavern"* and watch it lay the tiles, doors and NPCs for you.
Everything is hand-made 16px pixel art, and the games you make are yours.

### What you can make

- ⚔️ **Classic JRPGs** — towns, dungeons, world maps and side-view battles
- 🐉 **Monster-collecting adventures** — catch, raise and battle creatures
- 🏯 **Historical and modern settings** — a Joseon palace, a Japanese neighbourhood, a modern city, a magic school
- 💌 **Story games** — romance, mystery and horror with branching dialogue and cutscenes

### Highlights

| | |
|---|---|
| 🤖 **AI assistant** | Builds maps, villages, interiors, events and dialogue from plain language. Sign in with Google (Gemini) or ChatGPT (Codex) — no API key needed. |
| 🎨 **Hand-made pixel worlds** | Ready-to-use tilesets: a Roman-style harbor town, Joseon Korea, a Japanese city, a modern city, a magic school and cozy interiors. |
| 🗺️ **Full editor** | Layered tile maps, height and cliffs, world maps, a database for actors, skills, items and enemies, and an RPG Maker-style event command list. |
| 🎬 **Presentation** | Animated title screens with light rays and parallax, opening cinematics, camera moves and dialogue portraits. |
| ⚔️ **Side-view battles** | Pixel battlers with idle animations, skills, states and rewards — all driven by your database. |
| 🌐 **Play anywhere** | Test-play inside the editor and export your game as a web game. The exported player is MIT-licensed. |
| 🛒 **Asset store** | Share and download characters, tilesets and map objects at [store.openrpgmaker.com](https://store.openrpgmaker.com/). |

### Quick start

You need [Node.js 24 LTS](https://nodejs.org/).

```bash
npm ci
npm run mac:launch   # macOS / Linux — asks for a project folder, then opens http://127.0.0.1:9999
```

On first launch, enter the full path of a **new** folder; your project is saved there as SQLite plus asset files.
Click the AI chip at the top right to sign in. Detailed guide (Korean): [`openwiki/getting-started.ko.md`](openwiki/getting-started.ko.md).

---

<a id="中文"></a>

## 中文

**OPRN Studio 是一款内置 AI 助手的图块式 JRPG 制作工具。**
绘制地图、放置事件，立即试玩——或者直接对助手说
*「做一个有教堂和酒馆的港口小镇」*，它就会帮你铺好图块、门和 NPC。
所有素材都是手绘 16px 像素画，你做出的游戏完全属于你。

### 可以做什么

- ⚔️ **经典 JRPG** —— 城镇、地下城、世界地图与横版战斗
- 🐉 **怪兽收集冒险** —— 捕捉、培养并与怪兽对战
- 🏯 **历史与现代舞台** —— 朝鲜王宫、日本街区、现代都市、魔法学校
- 💌 **剧情游戏** —— 带分支对话和过场动画的恋爱、推理、恐怖游戏

### 亮点

| | |
|---|---|
| 🤖 **AI 助手** | 用自然语言生成地图、村庄、室内、事件和对话。使用 Google（Gemini）或 ChatGPT（Codex）账号登录，无需 API 密钥。 |
| 🎨 **手绘像素世界** | 开箱即用的图块：罗马风港口小镇、朝鲜时代、日本城市、现代都市、魔法学校和温馨室内。 |
| 🗺️ **完整编辑器** | 分层图块地图、高度与悬崖、世界地图、角色/技能/道具/敌人数据库，以及 RPG Maker 风格的事件指令。 |
| 🎬 **演出效果** | 带光束与视差的动态标题画面、开场动画、镜头运动和对话立绘。 |
| ⚔️ **横版战斗** | 带待机动画的像素战斗角色，技能、状态和奖励全部由数据库驱动。 |
| 🌐 **随处游玩** | 在编辑器内直接试玩，并导出为网页游戏。导出的播放器采用 MIT 许可。 |
| 🛒 **素材商店** | 在 [store.openrpgmaker.com](https://store.openrpgmaker.com/) 分享和下载角色、图块和地图物件。 |

### 快速开始

需要 [Node.js 24 LTS](https://nodejs.org/)。

```bash
npm ci
npm run mac:launch   # macOS / Linux —— 询问项目文件夹后打开 http://127.0.0.1:9999
```

首次启动时请输入一个**新**文件夹的完整路径，项目会以 SQLite 和素材文件的形式保存在那里。
点击右上角的 AI 标签即可登录。

---

<a id="日本語"></a>

## 日本語

**OPRN Studio は AI アシスタントを内蔵したタイル式 JRPG メーカーです。**
マップを描き、イベントを置いて、すぐにテストプレイ。あるいはアシスタントに
*「教会と酒場のある港町を作って」* と頼めば、タイルや扉、NPC まで配置してくれます。
素材はすべて手打ちの 16px ドット絵。作ったゲームはあなたのものです。

### 作れるもの

- ⚔️ **王道 JRPG** —— 町、ダンジョン、ワールドマップ、サイドビュー戦闘
- 🐉 **モンスター収集アドベンチャー** —— 捕まえて、育てて、戦わせる
- 🏯 **歴史と現代の舞台** —— 朝鮮王朝の王宮、日本の住宅街、現代都市、魔法学校
- 💌 **ストーリーゲーム** —— 分岐会話とカットシーンのある恋愛・ミステリー・ホラー

### 特長

| | |
|---|---|
| 🤖 **AI アシスタント** | 自然な言葉でマップ、村、室内、イベント、会話を作成。Google（Gemini）または ChatGPT（Codex）でログインするだけで、API キーは不要です。 |
| 🎨 **手打ちドットの世界** | すぐ使えるタイルセット：ローマ風の港町、朝鮮時代、日本の街、現代都市、魔法学校、あたたかい室内。 |
| 🗺️ **本格エディタ** | レイヤー付きタイルマップ、高さと崖、ワールドマップ、アクター・スキル・アイテム・敵のデータベース、RPG ツクール風イベントコマンド。 |
| 🎬 **演出** | 光の筋や視差スクロールのあるタイトル画面、オープニングムービー、カメラ演出、会話の立ち絵。 |
| ⚔️ **サイドビュー戦闘** | 待機アニメ付きのドット戦闘キャラ。スキル、ステート、報酬はすべてデータベースで動きます。 |
| 🌐 **どこでも遊べる** | エディタ内ですぐテストプレイ、Web ゲームとして書き出し。書き出したプレイヤーは MIT ライセンスです。 |
| 🛒 **アセットストア** | [store.openrpgmaker.com](https://store.openrpgmaker.com/) でキャラクター、タイルセット、マップ素材を共有・ダウンロード。 |

### クイックスタート

[Node.js 24 LTS](https://nodejs.org/) が必要です。

```bash
npm ci
npm run mac:launch   # macOS / Linux —— プロジェクトフォルダを聞いたあと http://127.0.0.1:9999 を開きます
```

初回は**新しい**フォルダのフルパスを入力してください。プロジェクトは SQLite と素材ファイルとしてそこに保存されます。
右上の AI チップを押すとログインできます。

---

<a id="한국어"></a>

## 한국어

**OPRN Studio 는 AI 조수가 들어 있는 타일 JRPG 메이커입니다.**
맵을 그리고 이벤트를 놓고 바로 플레이해 보세요. 아니면 조수에게
*"교회와 주막이 있는 항구 마을 만들어 줘"* 라고 말하면 타일과 문, NPC 까지 깔아 줍니다.
그림은 전부 손으로 찍은 16px 도트이고, 만든 게임은 만든 사람의 것입니다.

### 무엇을 만들 수 있나

- ⚔️ **정통 JRPG** — 마을, 던전, 월드맵, 측면 전투
- 🐉 **몬스터 수집 모험** — 잡고, 키우고, 겨루기
- 🏯 **역사와 현대 무대** — 조선 궁궐, 일본 주택가, 현대 도시, 마법 학교
- 💌 **이야기 게임** — 갈림길 대화와 컷신이 있는 연애·추리·호러

### 특징

| | |
|---|---|
| 🤖 **AI 조수** | 말로 맵·마을·실내·이벤트·대사를 만듭니다. Google(Gemini)이나 ChatGPT(Codex) 계정으로 로그인하면 되고 API 키는 필요 없습니다. |
| 🎨 **손 도트 세계** | 바로 쓰는 타일셋: 로마풍 항구 도시, 조선, 일본 도시, 현대 도시, 마법 학교, 아늑한 실내. |
| 🗺️ **제대로 된 에디터** | 층으로 나뉜 타일 맵, 높이와 절벽, 월드맵, 배우·스킬·아이템·적 자료집, RPG 쯔꾸르식 이벤트 명령. |
| 🎬 **연출** | 빛내림과 시차 스크롤이 있는 타이틀 화면, 오프닝 컷신, 카메라 연출, 대화 초상. |
| ⚔️ **측면 전투** | 대기 동작이 있는 도트 전투 캐릭터. 스킬·상태·보상이 모두 자료집대로 돌아갑니다. |
| 🌐 **어디서나 플레이** | 에디터 안에서 바로 테스트하고 웹 게임으로 내보냅니다. 내보낸 플레이어는 MIT 라이선스입니다. |
| 🛒 **에셋 스토어** | [store.openrpgmaker.com](https://store.openrpgmaker.com/) 에서 캐릭터·타일셋·맵 기물을 나누고 받습니다. |

### 빠른 시작

[Node.js 24 LTS](https://nodejs.org/) 가 필요합니다.

```bash
npm ci
npm run mac:launch   # macOS / Linux — 프로젝트 폴더를 물은 뒤 http://127.0.0.1:9999 를 엽니다
```

처음 실행할 때 **아직 없는 새 폴더**의 전체 경로를 넣으세요. 프로젝트가 그 폴더에 SQLite 와 소재 파일로 저장됩니다.
오른쪽 위 AI 칩을 눌러 로그인합니다. 자세한 안내(저장·백업 복구·막혔을 때·BGM 설치): [`openwiki/getting-started.ko.md`](openwiki/getting-started.ko.md).

---

<a id="gallery"></a>

## Gallery

<table>
  <tr>
    <td colspan="2"><img src="showcase/images/title-misty-ruins.jpg" alt="Title screen over misty ruins" /><br/><sub>Animated title screens · タイトル画面 · 标题画面 · 타이틀 화면</sub></td>
  </tr>
  <tr>
    <td width="50%"><img src="showcase/images/editor-japanese-town.png" alt="Editing a Japanese shopping street" /><br/><sub>Editing a Japanese shopping street</sub></td>
    <td width="50%"><img src="showcase/images/editor-apartment-interior.png" alt="Editing an apartment interior" /><br/><sub>Interiors and the map tree</sub></td>
  </tr>
  <tr>
    <td width="50%"><img src="showcase/images/play-japanese-house.png" alt="Walking through a Japanese two-storey house" /><br/><sub>Play mode — a Japanese house</sub></td>
    <td width="50%"><img src="showcase/images/map-tram-street.png" alt="A street with a tram line" /><br/><sub>Tram street</sub></td>
  </tr>
  <tr>
    <td colspan="2"><img src="showcase/images/map-joseon-village.png" alt="A Joseon-era village by a stream" /><br/><sub>A Joseon-era village</sub></td>
  </tr>
</table>

<a id="for-developers"></a>

## For developers

```bash
npm ci
npm run dev              # dev server (http://localhost:9999)
npm run build:packaged   # hosted / desktop renderer build
npm run build:player     # standalone web-game player
npm start -- --project-dir /path/to/project   # serve an existing SQLite project
npm test                 # unit tests
```

- Architecture, data and editor guides live in [`openwiki/`](openwiki/) — start with [`openwiki/quickstart.md`](openwiki/quickstart.md) and [`openwiki/PROJECT_WIKI.md`](openwiki/PROJECT_WIKI.md).
- Coding agents: read [`AGENTS.md`](AGENTS.md) first.
- Stack: Phaser + vanilla TypeScript DOM, SQLite project folders, Electron desktop shell.

<a id="license"></a>

## License

| Part | License |
|---|---|
| Editor and tools | [Sustainable Use License 1.0](LICENSE.md) + permissions for your games and outputs |
| Exported game player (runtime) | [MIT](LICENSE-RUNTIME.md) |
| Bundled art and sound | [OPRN Game Use License](ASSET-LICENSE.md) — free to use in your games |
| Third-party components | [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) |
| Names and logos | [TRADEMARKS.md](TRADEMARKS.md) |

**The games you make are yours** — sell them, share them, no royalties.
Contributions are welcome under the [CLA](CLA.md).

OPRN Studio is not affiliated with RPG Maker, Gotcha Gotcha Games or KADOKAWA.
