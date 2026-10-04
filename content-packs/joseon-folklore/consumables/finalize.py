#!/usr/bin/env python3
"""Verify saved payload and existing direct-review/smoke evidence, then write ready LAST.

Does not run a test suite, approve artwork for a user, publish, or connect storage.
"""
import hashlib
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent
def read(name): return json.loads((ROOT/name).read_text())
def sha(name): return hashlib.sha256((ROOT/name).read_bytes()).hexdigest()

def main():
    data=read("data.json"); design=read("design.json"); ids=read("../ids.json")
    art=read("art-manifest.json"); visual=read("review/visual-review.json"); smoke=read("review/smoke.json")
    assert {r["id"] for r in data["items"]} == set(ids["items"].values()) | set(ids["materials"].values())
    assert len(data["items"])==32 and len(data["skills"])==4
    assert sum(r["type"]=="normalGoods" for r in data["items"])==12
    assert len(art["icons"])==len(visual["icons"])==32
    assert art["phase"]==visual["phase"]==smoke["phase"]==design["phase"]=="full"
    assert visual["userApproval"] is None and smoke["passed"] and smoke["checkCount"]==161
    assert smoke["dataSha256"]==sha("data.json") and smoke["designSha256"]==sha("design.json")
    for src in [*smoke["scriptSources"],*art["sources"]]:assert src["sha256"]==sha(src["file"]),src["file"]
    for src in smoke["engineFiles"]:
        assert src["sha256"]==hashlib.sha256((ROOT/"../../.."/src["path"]).read_bytes()).hexdigest(),src["path"]
    reviewed={i["slug"]:i for i in visual["icons"]}
    for i in art["icons"]:
        r=reviewed[i["slug"]]
        assert r["observed"] and r["userApproval"] is None
        assert i["sha256"]==r["sha256"]==sha(i["sourceFile"])
        im=Image.open(ROOT/i["sourceFile"]).convert("RGBA")
        assert im.size==(32,32) and sorted(set(im.getchannel("A").tobytes()))==[0,255]
        pixels=im.get_flattened_data() if hasattr(im,"get_flattened_data") else im.getdata()
        assert len({p[:3] for p in pixels if p[3]})==i["opaqueColours"]<=32
    assert len({i["sha256"] for i in art["icons"]})==32
    for sheet in visual["sheets"]:assert sheet["sha256"]==sha(sheet["file"])
    files=sorted(str(p.relative_to(ROOT)) for p in ROOT.rglob("*") if p.is_file() and p.name!="status.json" and "__pycache__" not in p.parts)
    assert "README.md" in files and "full-report.md" in files
    status={"phase":"full","ready":True,"readyScope":"full 20+12 role payload saved for supervisor review; not installed or user-approved",
        "counts":{"items":32,"consumables":20,"materials":12,"skills":4,"icons":32},
        "fullTarget":{"consumables":20,"materials":12},
        "reviewFiles":[*art["reviewSheets"],"review/visual-review.json","review/smoke.json","art-manifest.json","design.json","full-report.md"],
        "userApproval":None,"publicRegistered":False,"liveProjectWritten":False,
        "verification":{"script":"node content-packs/joseon-folklore/consumables/run-smoke.mjs","exitCode":0,"checkCount":161,
            "originalPngsDirectlyViewed":32,"nearestSheetsDirectlyViewed":4,"gatesExecuted":False},
        "externalDependencies":["element_jf_fire","element_jf_ice","element_jf_lightning"],
        "limitations":["환생부는 약품의 필드 메뉴 부활만 지원; 도사의 전투부활 기술과 별개",
            "연막은 민첩 하락만; 암흑·명중저하·도주보장 없음","공격부3은 속성/상태 보정 적용; 매 대상 고정 피해 약속 없음",
            "획득·상점·드롭은 미설치 제안","public 등록·게임 통합·화면 QA·정본 저장은 감독자 담당"],
        "savedFiles":[{"file":file,"sha256":sha(file)} for file in files]}
    # Every payload and evidence file is already saved. This is the final role-file write.
    (ROOT/"status.json").write_text(json.dumps(status,ensure_ascii=False,indent=2)+"\n")
    print(json.dumps({"phase":"full","ready":True,"counts":status["counts"],"checks":161,"savedFiles":len(files),"lastWritten":"status.json"}))

if __name__=="__main__":main()
