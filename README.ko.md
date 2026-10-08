<div align="center">

<img src="showcase/images/icon.png" width="96" alt="OPRN" />

# OPRN Studio

### 말하면 만들어지는 나만의 도트 JRPG.

[English](README.md) · [中文](README.zh-CN.md) · [日本語](README.ja.md) · **한국어**

[![Website](https://img.shields.io/badge/website-openrpgmaker.com-5865f2)](https://openrpgmaker.com/)
[![Asset Store](https://img.shields.io/badge/asset%20store-store.openrpgmaker.com-f59e0b)](https://store.openrpgmaker.com/)
[![Editor: SUL](https://img.shields.io/badge/editor-Sustainable%20Use-0ea5e9)](LICENSE.md)
[![Runtime: MIT](https://img.shields.io/badge/runtime-MIT-22c55e)](LICENSE-RUNTIME.md)
![Languages](https://img.shields.io/badge/UI-EN%20·%20中文%20·%20日本語%20·%20한국어-a855f7)

<img src="showcase/images/title-moonlit-castle.jpg" width="92%" alt="OPRN Studio 로 만든 움직이는 타이틀 화면 — 보름달 아래의 성" />

</div>

<table>
  <tr>
    <td width="50%"><img src="showcase/images/editor-willow-bend.png" alt="강마을을 편집하는 OPRN Studio 에디터" /></td>
    <td width="50%"><img src="showcase/images/battle-skeleton-knight.png" alt="해골 기사와의 측면 도트 전투" /></td>
  </tr>
  <tr>
    <td width="50%"><img src="showcase/images/map-joseon-palace.png" alt="조선 궁궐 맵" /></td>
    <td width="50%"><img src="showcase/images/map-japanese-town.png" alt="현대 일본 마을 맵" /></td>
  </tr>
</table>

<div align="center">

[무엇을 만들 수 있나](#무엇을-만들-수-있나) · [특징](#특징) · [빠른 시작](#빠른-시작) · [갤러리](#갤러리) · [라이선스](#라이선스)

</div>

---

**OPRN Studio 는 AI 조수가 들어 있는 타일 JRPG 메이커입니다.**
맵을 그리고 이벤트를 놓고 바로 플레이해 보세요. 아니면 조수에게
*"교회와 주막이 있는 항구 마을 만들어 줘"* 라고 말하면 타일과 문, NPC 까지 깔아 줍니다.
그림은 전부 손으로 찍은 16px 도트이고, 만든 게임은 만든 사람의 것입니다.

## 무엇을 만들 수 있나

- ⚔️ **정통 JRPG** — 마을, 던전, 월드맵, 측면 전투
- 🐉 **몬스터 수집 모험** — 잡고, 키우고, 겨루기
- 🏯 **역사와 현대 무대** — 조선 궁궐, 일본 주택가, 현대 도시, 마법 학교
- 💌 **이야기 게임** — 갈림길 대화와 컷신이 있는 연애·추리·호러

## 특징

| | |
|---|---|
| 🤖 **AI 조수** | 말로 맵·마을·실내·이벤트·대사를 만듭니다. Google(Gemini)이나 ChatGPT(Codex) 계정으로 로그인하면 되고 API 키는 필요 없습니다. |
| 🎨 **손 도트 세계** | 바로 쓰는 타일셋: 로마풍 항구 도시, 조선, 일본 도시, 현대 도시, 마법 학교, 아늑한 실내. |
| 🗺️ **제대로 된 에디터** | 층으로 나뉜 타일 맵, 높이와 절벽, 월드맵, 배우·스킬·아이템·적 자료집, RPG 쯔꾸르식 이벤트 명령. |
| 🎬 **연출** | 빛내림과 시차 스크롤이 있는 타이틀 화면, 오프닝 컷신, 카메라 연출, 대화 초상. |
| ⚔️ **측면 전투** | 대기 동작이 있는 도트 전투 캐릭터. 스킬·상태·보상이 모두 자료집대로 돌아갑니다. |
| 🌐 **어디서나 플레이** | 에디터 안에서 바로 테스트하고 웹 게임으로 내보냅니다. 내보낸 플레이어는 MIT 라이선스입니다. |
| 🛒 **에셋 스토어** | [store.openrpgmaker.com](https://store.openrpgmaker.com/) 에서 캐릭터·타일셋·맵 기물을 나누고 받습니다. |
| 🌏 **4개 언어** | 에디터는 영어·중국어·일본어·한국어를 지원합니다. |

## 빠른 시작

[Node.js 24 LTS](https://nodejs.org/) 가 필요합니다.

```bash
npm ci
npm run mac:launch   # macOS / Linux — 프로젝트 폴더를 물은 뒤 http://127.0.0.1:9999 를 엽니다
```

처음 실행할 때 **아직 없는 새 폴더**의 전체 경로를 넣으세요. 프로젝트가 그 폴더에 SQLite 와 소재 파일로 저장됩니다.
오른쪽 위 AI 칩을 눌러 로그인합니다. 자세한 안내(저장·백업 복구·막혔을 때·BGM 설치): [`openwiki/getting-started.ko.md`](openwiki/getting-started.ko.md).

## 갤러리

<table>
  <tr>
    <td colspan="2"><img src="showcase/images/title-misty-ruins.jpg" alt="움직이는 타이틀 화면" /><br/><sub>움직이는 타이틀 화면</sub></td>
  </tr>
  <tr>
    <td width="50%"><img src="showcase/images/editor-japanese-town.png" alt="일본 상점가 편집" /><br/><sub>일본 상점가 편집</sub></td>
    <td width="50%"><img src="showcase/images/editor-apartment-interior.png" alt="실내와 맵 트리" /><br/><sub>실내와 맵 트리</sub></td>
  </tr>
  <tr>
    <td width="50%"><img src="showcase/images/play-japanese-house.png" alt="플레이 화면 — 일본 집" /><br/><sub>플레이 화면 — 일본 집</sub></td>
    <td width="50%"><img src="showcase/images/map-tram-street.png" alt="노면전차가 지나는 거리" /><br/><sub>노면전차가 지나는 거리</sub></td>
  </tr>
  <tr>
    <td colspan="2"><img src="showcase/images/map-joseon-village.png" alt="개울가 조선 마을" /><br/><sub>개울가 조선 마을</sub></td>
  </tr>
</table>

## 개발자용

```bash
npm ci
npm run dev              # 개발 서버 (http://localhost:9999)
npm run build:packaged   # 호스팅 / 데스크톱 렌더러 빌드
npm run build:player     # 단독 웹 게임 플레이어
npm start -- --project-dir /path/to/project   # 기존 SQLite 프로젝트 열기
npm test                 # 단위 테스트
```

- 구조·데이터·에디터 문서는 [`openwiki/`](openwiki/) 에 있습니다. [`openwiki/quickstart.md`](openwiki/quickstart.md) 와 [`openwiki/PROJECT_WIKI.md`](openwiki/PROJECT_WIKI.md) 부터 읽으세요.
- 코딩 에이전트는 [`AGENTS.md`](AGENTS.md) 를 먼저 읽습니다.
- 기술: Phaser + 바닐라 TypeScript DOM, SQLite 프로젝트 폴더, Electron 데스크톱 셸.

## 라이선스

| 대상 | 라이선스 |
|---|---|
| 에디터와 도구 | [Sustainable Use License 1.0](LICENSE.md) + 만든 게임·산출물에 대한 추가 허가 |
| 내보낸 게임 플레이어(런타임) | [MIT](LICENSE-RUNTIME.md) |
| 기본 그림과 소리 | [OPRN Game Use License](ASSET-LICENSE.md) — 내 게임에 자유롭게 사용 |
| 제3자 구성 요소 | [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) |
| 이름과 로고 | [TRADEMARKS.md](TRADEMARKS.md) |

**만든 게임은 만든 사람의 것입니다** — 팔아도, 나눠도 되고 로열티는 없습니다.
기여는 [CLA](CLA.md) 에 따라 받습니다.

OPRN Studio 는 RPG Maker(쯔꾸르), Gotcha Gotcha Games, KADOKAWA 와 관계가 없습니다.
