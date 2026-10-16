#!/usr/bin/env python3
"""Build the self-contained listening page (old vs new, side by side) into $VIZ_DIR (default ~/claude-viz).

Reads: final/*.json (chosen patches), patches/*/c*.patch.json (other candidates), the RTP sounds in
public/assets/easyrpg/sound (the 'old' column) and the comparison-only reference renders in $MONSTER_SFX_REF_DIR.
Writes poke-sfx-1.html + poke-sfx-1/ (wav, png).  Nothing here is shipped with the game.
"""
from __future__ import annotations

import html
import json
import os
import shutil
import sys
from pathlib import Path

import numpy as np
from scipy.signal import resample_poly

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(HERE))
import qa  # noqa: E402
import synth  # noqa: E402
from argon_author import leveled  # noqa: E402
from briefs import BRIEFS  # noqa: E402

VIZ = Path(os.environ.get("VIZ_DIR", str(Path.home() / "claude-viz")))
OUT = VIZ / "poke-sfx-1"
RTP = ROOT / "public" / "assets" / "easyrpg" / "sound"
REF_DIR = Path(os.environ.get("MONSTER_SFX_REF_DIR", str(Path.home() / "claude-viz" / "battle-sfx-gba")))
MANIFEST = json.loads((ROOT / "public" / "assets" / "monster-sfx" / "manifest.json").read_text())
EAR = {}
for p in (os.environ.get("EAR_JSON_NEW", ""), ):
    if p and Path(p).exists():
        EAR = json.loads(Path(p).read_text())["results"]
EAR_OLD = {}
if os.environ.get("EAR_JSON_OLD") and Path(os.environ["EAR_JSON_OLD"]).exists():
    EAR_OLD = json.loads(Path(os.environ["EAR_JSON_OLD"]).read_text())["results"]

OLD_FILE = {"ui-cursor": "Cursor1.wav", "ui-confirm": "Decision1.wav", "ui-cancel": "Cancel1.wav", "ui-error": "Buzzer1.wav",
            "faint": "Collapse2.wav"}
PREV_PICK = {"hit-weak": "hit-weak-C", "hit-normal": "hit-normal-A", "hit-super": "hit-super-A"}


def write_old_hit(name: str, tier: str) -> None:
    """What the pokemon skin does today: Damage2 shaped by tier (weak 0.6/+22%, super 1.3/-12% plus a second hit at -22%)."""
    y, sr, _ = qa.read_wav(RTP / "Damage2.wav")
    def shaped(rate: float, vol: float) -> np.ndarray:
        up = int(round(rate * 1000))
        z = resample_poly(y, 1000, up)  # playbackRate = rate  -> shorter / higher when rate > 1
        return z * vol * 0.4
    if tier == "weak":
        out = shaped(1.22, 0.6)
    elif tier == "normal":
        out = shaped(1.0, 1.0)
    else:
        a = shaped(0.88, 1.3)
        b = shaped(0.78, 0.9)
        n = int(0.055 * sr)
        out = np.zeros(max(len(a), n + len(b)))
        out[: len(a)] += a
        out[n : n + len(b)] += b
    out = np.clip(out, -1, 1)
    with __import__("wave").open(str(OUT / f"old-{name}.wav"), "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr); w.writeframes((out * 32767).astype("<i2").tobytes())


def spectro(wav: Path, png: Path) -> None:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    y, sr, _ = qa.read_wav(wav)
    fig, ax = plt.subplots(figsize=(3.4, 1.5))
    ax.specgram(y, NFFT=512, Fs=sr, noverlap=384, cmap="magma", vmin=-110, vmax=-30)
    ax.set_ylim(0, 12000); ax.tick_params(labelsize=6)
    fig.tight_layout(pad=0.3); fig.savefig(png, dpi=70); plt.close(fig)


def chip(text: str, cls: str = "") -> str:
    return f'<span class="chip {cls}">{html.escape(text)}</span>'


def audio(src: str | None, label: str, cls: str, extra: str = "") -> str:
    if not src:
        return f'<div class="cell none {cls}"><div class="lbl">{html.escape(label)}</div><div class="mute">무음</div></div>'
    return f'<div class="cell {cls}"><div class="lbl">{html.escape(label)}</div><audio controls preload="none" src="{src}"></audio>{extra}</div>'


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    rows = []
    seq_new, seq_old = {}, {}
    for sid, b in sorted(BRIEFS.items(), key=lambda kv: kv[1]["rank"]):
        sound = MANIFEST["sounds"].get(sid)
        if not sound:
            continue
        # new (chosen)
        src_wav = Path(os.environ.get("MONSTER_SFX_WAV_DIR", str(OUT))) / f"{sid}.wav"
        if src_wav.resolve() != (OUT / f"{sid}.wav").resolve():
            shutil.copy(src_wav, OUT / f"{sid}.wav")
        spectro(OUT / f"{sid}.wav", OUT / f"{sid}.png")
        seq_new[sid] = f"poke-sfx-1/{sid}.wav"
        # old
        old_src = None
        if sid in OLD_FILE:
            shutil.copy(RTP / OLD_FILE[sid], OUT / f"old-{sid}.wav")
            old_src = f"poke-sfx-1/old-{sid}.wav"
        elif sid.startswith("hit-"):
            write_old_hit(sid, sid.split("-")[1])
            old_src = f"poke-sfx-1/old-{sid}.wav"
        if old_src:
            seq_old[sid] = old_src
        # reference (comparison only)
        ref_src = None
        if b["ref"] and (REF_DIR / f"{b['ref']}.wav").exists():
            shutil.copy(REF_DIR / f"{b['ref']}.wav", OUT / f"{b['ref']}.wav")
            ref_src = f"poke-sfx-1/{b['ref']}.wav"
        # previously chosen (hit set only)
        prev_src = None
        if sid in PREV_PICK and (REF_DIR / f"{PREV_PICK[sid]}.wav").exists():
            shutil.copy(REF_DIR / f"{PREV_PICK[sid]}.wav", OUT / f"prev-{sid}.wav")
            prev_src = f"poke-sfx-1/prev-{sid}.wav"
        # other candidates
        others = []
        chosen = json.loads((HERE / "final" / f"{sid}.json").read_text())
        for pf in sorted((HERE / "patches" / sid).glob("c*.patch.json")):
            patch = json.loads(pf.read_text())
            if patch == chosen:
                continue
            try:
                y = leveled(synth.render(patch), b["rms"])
            except synth.PatchError:
                continue
            m = qa.analyze(y, synth.SR)
            if qa.gate(m, {"dur": b["dur"], "max_trail_ms": b.get("max_trail", 60)}):
                continue
            name = f"{sid}-{pf.name.split('.')[0]}.wav"
            synth.write_wav(OUT / name, y)
            others.append(f'<div class="mini"><span>{pf.name.split(".")[0]}</span><audio controls preload="none" src="poke-sfx-1/{name}"></audio></div>')
        gate = sound["gate"]
        chips = [chip(f'{sound["durationSeconds"]:.2f}s'), chip(f'peak {sound["peakDbfs"]} dBFS'), chip(f'rms {sound["rmsDbfs"]} dBFS'),
                 chip(f'clip {sound["clippedSamples"]}'), chip(f'DC {sound["dcOffset"]}'), chip(f'앞 무음 {sound["leadSilenceMs"]}ms'),
                 chip(f'뒤 무음 {sound["trailSilenceMs"]}ms'), chip(f'밝기 {sound["centroidHz"]:.0f}Hz'), chip("44.1kHz mono", "ok"),
                 chip("자동 검사 통과" if gate == "pass" else "검사: " + "; ".join(gate), "ok" if gate == "pass" else "bad")]
        e = EAR.get(sid)
        if e and e.get("ok"):
            chips.append(chip(f'귀(Argon×{e["n"]}) 적합 {e["fit"]} · 깨끗 {e["clean"]}', "ear"))
        eo = EAR_OLD.get(sid)
        old_extra = ""
        if eo and eo.get("ok") and old_src:
            old_extra = f'<div class="chips">{chip(f"귀 적합 {eo["fit"]} · 깨끗 {eo["clean"]}", "ear")}</div>'
        new_extra = f'<div class="chips">{"".join(chips)}</div><img src="poke-sfx-1/{sid}.png" alt="">'
        rows.append(
            f'<section id="{sid}"><h3>{b["rank"]}. {html.escape(b["title"])} <small>{sid} · 지금: {html.escape(b["old"])}</small></h3>'
            f'<p class="brief">{html.escape(b["brief"])}</p><div class="row">'
            + audio(old_src, "옛소리", "cur", old_extra)
            + audio(prev_src, "이전에 고른 소리(GBA 후보, 하네스 소실)", "prev") * (1 if prev_src else 0)
            + audio(ref_src, "참고(원작 소리 · 비교 전용, 게임에 안 넣음)", "ref") * (1 if ref_src else 0)
            + audio(f"poke-sfx-1/{sid}.wav", "새소리(채택) · 오리지널 합성", "new", new_extra)
            + "</div>"
            + (f'<details><summary>다른 통과 후보 {len(others)}개</summary><div class="minis">{"".join(others)}</div></details>' if others else "")
            + "</section>")
    if os.environ.get("EAR_NOTE"):
        ear_note = os.environ["EAR_NOTE"]
    else:
        ear_note = "귀 판정: 이 판에는 없음."
    page = f"""<!doctype html><html lang="ko"><meta charset="utf-8"><title>몬스터 장르 효과음 — 옛소리 vs 새소리</title>
<style>
body{{background:#0f1116;color:#e8e8ea;font:14px/1.5 system-ui,"Noto Sans CJK KR",sans-serif;margin:0;padding:16px 22px 80px}}
h1{{font-size:19px;margin:0 0 4px}} h3{{margin:26px 0 2px;font-size:16px;border-bottom:1px solid #2a2d36}} h3 small{{color:#99a;font-weight:400;font-size:12px;margin-left:8px}}
.brief{{color:#9aa;font-size:12px;margin:2px 0 6px;max-width:1100px}} .lede{{color:#aab;max-width:1100px}}
.row{{display:flex;gap:8px;flex-wrap:wrap}} .cell{{background:#171a22;border:1px solid #2a2d36;border-radius:7px;padding:6px;width:330px}}
.cell.cur{{border-color:#6a3a1c}}.cell.ref{{border-color:#1f4a66}}.cell.prev{{border-color:#5a4a1c}}.cell.new{{border-color:#2d5a2a;width:380px}}
.cell.none{{display:flex;flex-direction:column;justify-content:center;width:150px}} .mute{{color:#ff8a3d;text-align:center;padding:14px 0}}
.lbl{{font-size:12px;color:#ccd;margin-bottom:3px}} .cur .lbl{{color:#ffc79e}} .ref .lbl{{color:#8fd3ff}} .prev .lbl{{color:#f0d98a}} .new .lbl{{color:#b9f29e}}
audio{{width:100%;height:30px}} img{{width:100%;display:block;margin-top:4px;border-radius:3px}}
.chips{{display:flex;flex-wrap:wrap;gap:3px;margin-top:4px}} .chip{{font-size:11px;background:#222632;border-radius:3px;padding:0 5px}} .chip.ok{{background:#1f4a22;color:#c9f5c0}} .chip.bad{{background:#5a2316;color:#ffd0bd}} .chip.ear{{background:#2a2a52;color:#cfd0ff}}
.minis{{display:flex;gap:8px;flex-wrap:wrap;margin-top:6px}} .mini{{width:250px;font-size:12px;color:#99a}} .mini audio{{height:26px}}
button{{background:#2b6cb0;color:#fff;border:0;border-radius:5px;padding:7px 14px;cursor:pointer;font-size:13px;margin:4px 6px 4px 0}}
code{{color:#8fd3ff}} table{{border-collapse:collapse;margin:8px 0}} td,th{{border:1px solid #2a2d36;padding:3px 8px;font-size:12px}}
</style>
<h1>몬스터 장르 효과음 — 옛소리 vs 새소리</h1>
<p class="lede">주황 = 지금(RTP·무음) · 노랑 = 이전에 사용자가 골랐던 타격 후보 · 파랑 = 참고(원작 소리, <b>비교 전용</b>, 게임에 안 넣음) · 초록 = <b>새소리</b>(Argon 이 쓴 합성 패치를 코드로 렌더, 원본).
 거슬리는 소리가 있으면 번호와 느낌(너무 높다·길다·찌른다 등)만 알려 주면 그 패치를 다시 쓴다. 각 소리 아래 「다른 통과 후보」도 들어볼 수 있다.</p>
<p class="lede">{html.escape(ear_note)}</p>
<div><button onclick="seq('new','battle')">새 소리로 전투 한 판 이어 듣기</button><button onclick="seq('old','battle')">옛 소리로 이어 듣기</button>
<button onclick="seq('new','capture')">새 소리: 포획(던지기→흔들림×3→성공)</button><button onclick="seq('new','capturefail')">새 소리: 포획 실패</button>
<button onclick="seq('new','menu')">새 소리: 메뉴(커서×3→결정→취소→오류)</button><button onclick="stopAll()">정지</button> <span id="now"></span></div>
{''.join(rows)}
<script>
const NEW={json.dumps(seq_new)}, OLD={json.dumps(seq_old)};
const SCRIPTS={{
 battle:[['encounter',0],['ui-cursor',1100],['ui-cursor',1350],['ui-confirm',1650],['hit-weak',2300],['hit-normal',3200],['hit-super',4100],['faint',5200],['level-up',6600]],
 capture:[['ball-throw',0],['ball-shake',1200],['ball-shake',1960],['ball-shake',2720],['capture-success',3500]],
 capturefail:[['ball-throw',0],['ball-shake',1200],['ball-shake',1960],['ball-break',2720]],
 menu:[['ui-cursor',0],['ui-cursor',250],['ui-cursor',500],['ui-confirm',900],['ui-cancel',1400],['ui-error',1900]],
}};
let timers=[], playing=[];
function stopAll(){{timers.forEach(clearTimeout);timers=[];playing.forEach(a=>{{a.pause()}});playing=[];document.getElementById('now').textContent='';}}
function seq(which,name){{stopAll();const map=which==='new'?NEW:OLD;
 for(const [id,t] of SCRIPTS[name]){{ timers.push(setTimeout(()=>{{const src=map[id];document.getElementById('now').textContent=id+(src?'':' (옛소리 없음=무음)');if(!src)return;const a=new Audio(src);playing.push(a);a.play();}},t)); }}}}
</script></html>"""
    (VIZ / "poke-sfx-1.html").write_text(page)
    print("wrote", VIZ / "poke-sfx-1.html")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
