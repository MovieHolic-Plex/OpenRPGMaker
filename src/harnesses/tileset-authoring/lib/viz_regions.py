"""지역 시트 전부를 한 쪽 HTML 로 — 사용자 보고용. 맵 PNG 는 ~/claude-viz/pk3/ 에 복사하고(같은 서버 디렉터리) 상대 경로로 건다.
사용: python3 viz_regions.py <out.html> <테마>[:원작1.png,원작2.png] ...
각 테마는 /tmp/viz/<테마>/maps 순서(bake/maps.json 이 없으면 PNG 이름순)로 싣는다. 원작 그림은 /tmp/viz/orig/g 기준 상대 이름."""
import html
import json
import shutil
import sys
from pathlib import Path

from PIL import Image

VIZ = Path("/tmp/viz")
OUT_DIR = Path.home() / "claude-viz" / "pk3"
TITLES = {
    "monster-overworld": "본 시트 — 마을·도로·동굴·실내·체육관 3관",
    "monster-coast": "해안 — 항구 도시·해변 바닷길·큰 도시",
    "monster-climate": "기후 — 눈 마을·얼음 도로·사막·화산재",
    "monster-dungeon": "던전 — 얼음 동굴·용암·유령 탑·아지트·유적·해저",
    "monster-rooms": "실내 — 연구소·학교·박물관·백화점·배·사천왕",
    "monster-gyms": "체육관 8관",
    "monster-wild": "야생 — 숲 미로·절벽·늪·꽃 정원·강",
}
SKIP = {"sheet", "catalog_raw"}
ROOT = Path(__file__).resolve().parents[4]
# 정직한 남은 한계(감독이 마지막 검수에서 본 것) — 보고서에 그대로 싣는다
LIMITS = {
    "monster-overworld": "마트가 센터 틀의 색 바꿈이다. 이벤트(스위치·전기 문)는 자리만 있다.",
    "monster-coast": "3차 검수는 아직 안 했다(2차 점수 항구 5.5·해변 5.5·도시 6·도감 6.5). 옹벽 앞면이 얇다(6px). 깊은 바다 단은 색이 아니라 반짝임만 다르다.",
    "monster-climate": "검수 1차만 반영. 2차 검수는 안 했다.",
    "monster-dungeon": "용암 웅덩이 경계가 직각 사각형이다(원작은 덩이 모양). 검수 1차만 반영.",
    "monster-rooms": "검수 2차까지 반영(평균 약 5 → 6.9, 그 뒤 한 번 더 고침). 갑판 원근은 아직 원작보다 단순하다.",
    "monster-gyms": "검수 1차만 반영(1차 평균 4.75). 퍼즐 장치는 이벤트 자리 칸이다 — 엔진이 스스로 하는 것은 미끄럼뿐.",
    "monster-wild": "산 절벽이 여전히 가는 띠로 읽힌다(원작의 두꺼운 층 절벽이 아님). 검수 1차만 반영.",
}


def thumb(src: Path, name: str, max_w=1400) -> str:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    im = Image.open(src)
    if im.width > max_w:
        k = max(1, round(im.width / max_w))
        im = im.resize((im.width // k, im.height // k), Image.NEAREST)
    dst = OUT_DIR / name
    im.save(dst, optimize=True)
    return f"pk3/{name}"


def main():
    out = Path(sys.argv[1])
    sections = []
    for arg in sys.argv[2:]:
        theme, _, origs = arg.partition(":")
        d = VIZ / theme if theme != "monster-overworld" else VIZ
        idx = {e["theme"]: e for e in json.loads((ROOT / "src/assets/monsterKit/index.json").read_text())}
        mj = ROOT / "qa-runs/harnesses/tileset-authoring" / theme / idx.get(theme, {}).get("run", "") / "bake/maps.json"
        if theme == "monster-overworld":
            pngs = [VIZ / f for f in ("town_b.png", "route_b.png", "cave_map.png", "room_center.png", "room_mart.png", "room_house.png",
                                      "room_gymspin.png", "room_gymelec.png", "room_gymrock.png")]
        else:
            names = [m["file"][len("verify-"):-len(".json")] for m in json.loads(mj.read_text())] if mj.exists() else []
            pngs = [d / f"{n}.png" for n in names if "-err-" not in n] + [d / f"{n}.png" for n in names if "-err-" in n][:1]
        cards = []
        for p in pngs:
            if not p.exists():
                continue
            rel = thumb(p, f"{theme}-{p.stem}.png")
            cap = ("오류 예시(엔진 도달 검사가 잡은 것) · " if "-err-" in p.stem else "") + p.stem
            cards.append(f'<figure><img src="{rel}" loading="lazy"><figcaption>{html.escape(cap)}</figcaption></figure>')
        orig_cards = []
        for o in [x for x in origs.split(",") if x]:
            op = next((q for q in (VIZ / theme / "orig" / o, VIZ / "orig" / "g" / o) if q.exists()), VIZ / "orig" / "g" / o)
            if op.exists():
                rel = thumb(op, f"orig-{op.stem}.png")
                orig_cards.append(f'<figure class="orig"><img src="{rel}" loading="lazy"><figcaption>원작 대조 · {html.escape(op.stem)}</figcaption></figure>')
        meta = idx.get(theme, {})
        info = f'<p class="meta">{meta.get("count", "?")}칸 · 굽기 {meta.get("run", "?")} · 남은 한계: {html.escape(LIMITS.get(theme, ""))}</p>'
        sections.append(f'<section><h2>{html.escape(TITLES.get(theme, theme))}</h2>{info}<div class="grid">{"".join(cards)}</div>'
                        + (f'<details><summary>원작(학습용) 대조 {len(orig_cards)}장</summary><div class="grid">{"".join(orig_cards)}</div></details>' if orig_cards else "")
                        + "</section>")
    page = f"""<!doctype html><meta charset="utf-8"><title>몬스터 수집 손 도트 — 지역 시트</title>
<style>
body{{background:#1d1f27;color:#e8e8ee;font:15px/1.5 system-ui,sans-serif;margin:24px}}
h1{{font-size:22px}} h2{{font-size:18px;border-top:1px solid #3a3d4a;padding-top:18px;margin-top:28px}}
.grid{{display:flex;flex-wrap:wrap;gap:14px;align-items:flex-start}}
figure{{margin:0;background:#262934;padding:8px;border-radius:6px}}
figure img{{display:block;image-rendering:pixelated;max-width:min(100%,900px);height:auto}}
figure.orig{{outline:1px dashed #6a6f84}}
figcaption{{font-size:13px;color:#a8acbd;margin-top:4px}}
.meta{{color:#c9cde0;font-size:14px;max-width:1100px}}
.note{{background:#2b2e3a;padding:10px 14px;border-radius:6px;max-width:1100px}}
details summary{{cursor:pointer;color:#9fb8ff;margin:10px 0}}
</style>
<h1>몬스터 수집 손 도트 타일셋 — 지역 시트</h1>
<div class="note">모든 그림은 좌표로 찍은 원본 도트(생성 이미지·원작 픽셀 없음). 「원작 대조」는 배치 문법을 배운 GBA 원작 조립본이며 저장소에 넣지 않는다.
보고 판단할 것: 각 장소가 포켓몬 GBA 맵으로 읽히는지, 시트끼리 같은 게임으로 보이는지.</div>
{"".join(sections)}
"""
    out.write_text(page)
    print(out)


if __name__ == "__main__":
    main()
