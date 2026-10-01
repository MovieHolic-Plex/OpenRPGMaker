"""버들항 마을 배치 문법 문서를 고른 조각 용도(beodeul-picks-village·climate-village)에 넣는다.
python3 scripts/content/beodeul-picks/add_layout_grammar.py
정본: tiledata/beodeul-city/references/bd-pick-doc-village-grammar.md + grammar/*.png(도구가 깐 엔진 렌더, r1 블록 격자 오류 그림).
bake_picks.py 가 끝에서 부른다(다시 구워도 문서가 남게). 같은 id 가 있으면 바꾸고, 없으면 용도 문서 맨 앞에 넣는다."""
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[3]
REF_PATH = ROOT / "src/assets/beodeulCityReferences.json"
IMG_DIR = ROOT / "public/assets/beodeul-city/references/picks"
SRC = ROOT / "tiledata/beodeul-city/references"
TARGETS = {"beodeul-picks-village": "bd-pick-doc-village-grammar", "beodeul-picks-climate-village": "bd-pick-doc-climate-grammar"}
RENDERS = [("river-3", "theme river seed 3 — 강가 마을 56×44: 강(넓은 둑으로 굽이)·아치 다리·굽은 큰길·뒷길 고리·광장과 맞은편 앵커·방앗간."),
           ("coast-3", "theme coast seed 3 — 포구 56×40: 바다·물가 길·생선 시장(물에 걸침)·잔교 T머리·배·광장."),
           ("desert-29", "theme desert seed 29 — 사막 오아시스 58×44: 못+풀밭 고리+야자, 표본 길·광장, 사막 집, 대상 마당."),
           ("snow-11", "theme snow seed 11 — 설원 56×44: 얼음 못(얼음배·구멍)·표본 눈길·광장 모닥불·설원 집·전나무 덩이."),
           ("swamp-3", "theme swamp seed 3 — 늪 56×44: 진흙 섬(길·집에서 2~4칸) 밖은 늪물, 갑판 광장·늪 집·맹그로브.")]

def small(im, side=820):
    s = min(1.0, side / max(im.size))
    if s < 1: im = im.resize((max(1, int(im.width * s)), max(1, int(im.height * s))), Image.LANCZOS)
    return im.convert("RGB").quantize(colors=128, method=Image.Quantize.MEDIANCUT)

def img(name, im, caption):
    small(im).save(IMG_DIR / f"{name}.png", optimize=True)
    return dict(id=f"bd-pick-img-{name}", name=f"{name}.png", caption=caption, dataUrl=f"/assets/beodeul-city/references/picks/{name}.png")

def main():
    md = (SRC / "bd-pick-doc-village-grammar.md").read_text()
    images = []
    bad, good = Image.open(SRC / "grammar/r1-grid.png").convert("RGB"), Image.open(SRC / "grammar/river-3.png").convert("RGB")
    h = max(bad.height, good.height); pair = Image.new("RGB", (bad.width + good.width + 16, h), (0, 0, 0))
    pair.paste(bad, (0, 0)); pair.paste(good, (bad.width + 16, 0))
    images.append(img("grammar-err-grid", pair, "왼쪽 오류 · 오른쪽 정상. 「마을 만들어 줘」에 블록 격자 도시(theme city, r1 시험)를 깔았다 — 바둑판 블록·같은 폭 대로. 오른쪽은 같은 요청을 theme river(seed 3)로 깐 것(엔진 렌더)."))
    for name, cap in RENDERS: images.append(img(f"grammar-{name}", Image.open(SRC / f"grammar/{name}.png"), cap + " 도구가 실제로 깐 맵(엔진 렌더)."))
    refs = json.loads(REF_PATH.read_text())
    for cat in refs:
        if cat["id"] not in TARGETS: continue
        doc = dict(id=TARGETS[cat["id"]], name="마을 배치 문법 — author_beodeul_town theme(먼저 읽는다)", markdown=md)
        cat["documents"] = [doc] + [d for d in cat["documents"] if d["id"] != doc["id"]]
        ids = {i["id"] for i in images}
        cat["images"] = [i for i in cat["images"] if i["id"] not in ids] + images
    REF_PATH.write_text(json.dumps(refs, ensure_ascii=False, indent=0) + "\n")
    print("grammar doc →", list(TARGETS), "images", len(images))

if __name__ == "__main__":
    main()
