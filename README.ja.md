<div align="center">

<img src="showcase/images/icon.png" width="96" alt="OPRN" />

# OPRN Studio

### 話すだけで、あなたのドット絵 JRPG を。

[English](README.md) · [中文](README.zh-CN.md) · **日本語** · [한국어](README.ko.md)

[![Website](https://img.shields.io/badge/website-openrpgmaker.com-5865f2)](https://openrpgmaker.com/)
[![Asset Store](https://img.shields.io/badge/asset%20store-store.openrpgmaker.com-f59e0b)](https://store.openrpgmaker.com/)
[![Editor: SUL](https://img.shields.io/badge/editor-Sustainable%20Use-0ea5e9)](LICENSE.md)
[![Runtime: MIT](https://img.shields.io/badge/runtime-MIT-22c55e)](LICENSE-RUNTIME.md)
![Languages](https://img.shields.io/badge/UI-EN%20·%20中文%20·%20日本語%20·%20한국어-a855f7)

<img src="showcase/images/title-moonlit-castle.jpg" width="92%" alt="OPRN Studio で作ったタイトル画面——満月の下の城" />

</div>

<table>
  <tr>
    <td width="50%"><img src="showcase/images/editor-willow-bend.png" alt="川沿いの村を編集する OPRN Studio エディタ" /></td>
    <td width="50%"><img src="showcase/images/battle-skeleton-knight.png" alt="骸骨の騎士とのサイドビュー戦闘" /></td>
  </tr>
  <tr>
    <td width="50%"><img src="showcase/images/map-joseon-palace.png" alt="朝鮮王朝の王宮マップ" /></td>
    <td width="50%"><img src="showcase/images/map-japanese-town.png" alt="現代日本の町のマップ" /></td>
  </tr>
</table>

<div align="center">

[作れるもの](#作れるもの) · [特長](#特長) · [クイックスタート](#クイックスタート) · [ギャラリー](#ギャラリー) · [ライセンス](#ライセンス)

</div>

---

**OPRN Studio は AI アシスタントを内蔵したタイル式 JRPG メーカーです。**
マップを描き、イベントを置いて、すぐにテストプレイ。あるいはアシスタントに
*「教会と酒場のある港町を作って」* と頼めば、タイルや扉、NPC まで配置してくれます。
素材はすべて手打ちの 16px ドット絵。作ったゲームはあなたのものです。

## 作れるもの

- ⚔️ **王道 JRPG** —— 町、ダンジョン、ワールドマップ、サイドビュー戦闘
- 🐉 **モンスター収集アドベンチャー** —— 捕まえて、育てて、戦わせる
- 🏯 **歴史と現代の舞台** —— 朝鮮王朝の王宮、日本の住宅街、現代都市、魔法学校
- 💌 **ストーリーゲーム** —— 分岐会話とカットシーンのある恋愛・ミステリー・ホラー

## 特長

| | |
|---|---|
| 🤖 **AI アシスタント** | 自然な言葉でマップ、村、室内、イベント、会話を作成。Google（Gemini）または ChatGPT（Codex）でログインするだけで、API キーは不要です。 |
| 🎨 **手打ちドットの世界** | すぐ使えるタイルセット：ローマ風の港町、朝鮮時代、日本の街、現代都市、魔法学校、あたたかい室内。 |
| 🗺️ **本格エディタ** | レイヤー付きタイルマップ、高さと崖、ワールドマップ、アクター・スキル・アイテム・敵のデータベース、RPG ツクール風イベントコマンド。 |
| 🎬 **演出** | 光の筋や視差スクロールのあるタイトル画面、オープニングムービー、カメラ演出、会話の立ち絵。 |
| ⚔️ **サイドビュー戦闘** | 待機アニメ付きのドット戦闘キャラ。スキル、ステート、報酬はすべてデータベースで動きます。 |
| 🌐 **どこでも遊べる** | エディタ内ですぐテストプレイ、Web ゲームとして書き出し。書き出したプレイヤーは MIT ライセンスです。 |
| 🛒 **アセットストア** | [store.openrpgmaker.com](https://store.openrpgmaker.com/) でキャラクター、タイルセット、マップ素材を共有・ダウンロード。 |
| 🌏 **4 言語対応** | エディタは English、中文、日本語、한국어 に対応しています。 |

## クイックスタート

[Node.js 24 LTS](https://nodejs.org/) が必要です。

```bash
npm ci
npm run mac:launch   # macOS / Linux —— プロジェクトフォルダを聞いたあと http://127.0.0.1:9999 を開きます
```

初回は**新しい**フォルダのフルパスを入力してください。プロジェクトは SQLite と素材ファイルとしてそこに保存されます。
右上の AI チップを押すとログインできます。

## ギャラリー

<table>
  <tr>
    <td colspan="2"><img src="showcase/images/title-misty-ruins.jpg" alt="動くタイトル画面" /><br/><sub>動くタイトル画面</sub></td>
  </tr>
  <tr>
    <td width="50%"><img src="showcase/images/editor-japanese-town.png" alt="日本の商店街を編集" /><br/><sub>日本の商店街を編集</sub></td>
    <td width="50%"><img src="showcase/images/editor-apartment-interior.png" alt="室内とマップツリー" /><br/><sub>室内とマップツリー</sub></td>
  </tr>
  <tr>
    <td width="50%"><img src="showcase/images/play-japanese-house.png" alt="プレイ画面——日本の家" /><br/><sub>プレイ画面——日本の家</sub></td>
    <td width="50%"><img src="showcase/images/map-tram-street.png" alt="路面電車の走る通り" /><br/><sub>路面電車の走る通り</sub></td>
  </tr>
  <tr>
    <td colspan="2"><img src="showcase/images/map-joseon-village.png" alt="小川沿いの朝鮮の村" /><br/><sub>小川沿いの朝鮮の村</sub></td>
  </tr>
</table>

## 開発者向け

```bash
npm ci
npm run dev              # 開発サーバー (http://localhost:9999)
npm run build:packaged   # ホスト / デスクトップ用レンダラーのビルド
npm run build:player     # 単体の Web ゲームプレイヤー
npm start -- --project-dir /path/to/project   # 既存の SQLite プロジェクトを開く
npm test                 # ユニットテスト
```

- 設計・データ・エディタの資料は [`openwiki/`](openwiki/) にあります（現在は韓国語）。まず [`openwiki/quickstart.md`](openwiki/quickstart.md) と [`openwiki/PROJECT_WIKI.md`](openwiki/PROJECT_WIKI.md) から。
- コーディングエージェントは最初に [`AGENTS.md`](AGENTS.md) を読んでください。
- 技術スタック：Phaser + 素の TypeScript DOM、SQLite プロジェクトフォルダ、Electron デスクトップシェル。

## ライセンス

| 対象 | ライセンス |
|---|---|
| エディタとツール | [Sustainable Use License 1.0](LICENSE.md) + あなたのゲームと成果物への追加許諾 |
| 書き出したゲームプレイヤー（ランタイム） | [MIT](LICENSE-RUNTIME.md) |
| 同梱の絵と音 | [OPRN Game Use License](ASSET-LICENSE.md) —— あなたのゲームで自由に使えます |
| サードパーティ部品 | [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) |
| 名称とロゴ | [TRADEMARKS.md](TRADEMARKS.md) |

**作ったゲームはあなたのもの** —— 販売も配布も自由、ロイヤリティは不要です。
コントリビュートは [CLA](CLA.md) のもとで歓迎します。

OPRN Studio は RPG ツクール（RPG Maker）、Gotcha Gotcha Games、KADOKAWA とは関係ありません。
