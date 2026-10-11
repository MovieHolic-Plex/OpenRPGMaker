<div align="center">

<img src="showcase/images/icon.png" width="96" alt="OPRN" />

# OPRN Studio

### Make your own pixel-art JRPG — just describe it.

**English** · [中文](README.zh-CN.md) · [日本語](README.ja.md) · [한국어](README.ko.md)

### Download the desktop app

[![Windows Download (EXE)](https://img.shields.io/badge/Windows-Download%20EXE-2563eb?style=for-the-badge)](https://github.com/MovieHolic-Plex/OpenRPGMaker/releases/latest/download/OPRN.Studio-windows.exe)
[![Windows Download (ZIP)](https://img.shields.io/badge/Windows-Download%20ZIP-2563eb?style=for-the-badge)](https://github.com/MovieHolic-Plex/OpenRPGMaker/releases/latest/download/OPRN.Studio-windows.zip)
[![Linux Download (AppImage)](https://img.shields.io/badge/Linux-Download%20AppImage-eab308?style=for-the-badge)](https://github.com/MovieHolic-Plex/OpenRPGMaker/releases/latest/download/OPRN.Studio-linux.AppImage)

Windows: run the EXE, or unzip the ZIP and run `OPRN Studio.exe`. Linux: make the AppImage executable, then run it.

[All downloads & release notes](https://github.com/MovieHolic-Plex/OpenRPGMaker/releases/latest)

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

[Download](#download) · [What you can make](#what-you-can-make) · [Highlights](#highlights) · [Quick start](#quick-start) · [Gallery](#gallery) · [License](#license)

</div>

---

**OPRN Studio is a tile-based JRPG maker with an AI assistant built in.**
Draw maps, place events and play your game instantly — or tell the assistant
*"build a harbor village with a church and a tavern"* and watch it lay the tiles, doors and NPCs for you.
Everything is hand-made 16px pixel art, and the games you make are yours.

## What you can make

- ⚔️ **Classic JRPGs** — towns, dungeons, world maps and side-view battles
- 🐉 **Monster-collecting adventures** — catch, raise and battle creatures
- 🏯 **Historical and modern settings** — a Joseon palace, a Japanese neighbourhood, a modern city, a magic school
- 💌 **Story games** — romance, mystery and horror with branching dialogue and cutscenes

## Highlights

| | |
|---|---|
| 🤖 **AI assistant** | Builds maps, villages, interiors, events and dialogue from plain language. Sign in with Google (Gemini) or ChatGPT (Codex) — no API key needed. |
| 🎨 **Hand-made pixel worlds** | Ready-to-use tilesets: a Roman-style harbor town, Joseon Korea, a Japanese city, a modern city, a magic school and cozy interiors. |
| 🗺️ **Full editor** | Layered tile maps, height and cliffs, world maps, a database for actors, skills, items and enemies, and an RPG Maker-style event command list. |
| 🎬 **Presentation** | Animated title screens with light rays and parallax, opening cinematics, camera moves and dialogue portraits. |
| ⚔️ **Side-view battles** | Pixel battlers with idle animations, skills, states and rewards — all driven by your database. |
| 🌐 **Play anywhere** | Test-play inside the editor and export your game as a web game. The exported player is MIT-licensed. |
| 🛒 **Asset store** | Share and download characters, tilesets and map objects at [store.openrpgmaker.com](https://store.openrpgmaker.com/). |
| 🌏 **Four languages** | The editor speaks English, 中文, 日本語 and 한국어. |

## Download

Packaged builds are on the [latest release](https://github.com/MovieHolic-Plex/OpenRPGMaker/releases/latest). These two links always download that release's desktop app.

| | |
|---|---|
| Windows | [OPRN.Studio-windows.zip](https://github.com/MovieHolic-Plex/OpenRPGMaker/releases/latest/download/OPRN.Studio-windows.zip) — unzip, then run `OPRN Studio.exe` |
| Linux | [OPRN.Studio-linux.AppImage](https://github.com/MovieHolic-Plex/OpenRPGMaker/releases/latest/download/OPRN.Studio-linux.AppImage) — `chmod +x` the file, then run it |
| macOS | No packaged build yet. Use the source command below. |

## Quick start

For macOS, or to run from source. You need [Node.js 24 LTS](https://nodejs.org/).

```bash
npm ci
npm run mac:launch   # macOS / Linux — asks for a project folder, then opens http://127.0.0.1:9999
```

On first launch, enter the full path of a **new** folder; your project is saved there as SQLite plus asset files.
Click the AI chip at the top right to sign in.

## Gallery

<table>
  <tr>
    <td colspan="2"><img src="showcase/images/title-misty-ruins.jpg" alt="Animated title screens" /><br/><sub>Animated title screens</sub></td>
  </tr>
  <tr>
    <td width="50%"><img src="showcase/images/editor-japanese-town.png" alt="Editing a Japanese shopping street" /><br/><sub>Editing a Japanese shopping street</sub></td>
    <td width="50%"><img src="showcase/images/editor-apartment-interior.png" alt="Interiors and the map tree" /><br/><sub>Interiors and the map tree</sub></td>
  </tr>
  <tr>
    <td width="50%"><img src="showcase/images/play-japanese-house.png" alt="Play mode — a Japanese house" /><br/><sub>Play mode — a Japanese house</sub></td>
    <td width="50%"><img src="showcase/images/map-tram-street.png" alt="A street with a tram line" /><br/><sub>A street with a tram line</sub></td>
  </tr>
  <tr>
    <td colspan="2"><img src="showcase/images/map-joseon-village.png" alt="A Joseon-era village by a stream" /><br/><sub>A Joseon-era village by a stream</sub></td>
  </tr>
</table>

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
