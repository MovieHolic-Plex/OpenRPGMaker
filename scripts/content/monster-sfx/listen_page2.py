#!/usr/bin/env python3
"""Listening page for the second batch of monster-genre sounds -> $VIZ_DIR/poke-sfx-2.html (+ poke-sfx-2/).

Self-contained <audio> page: for every set-2 sound the chosen render with its automatic-check numbers and a spectrogram,
the other passing candidates, and (where one exists) the closest RTP sound as a loose "what the engine has today" lead.
RTP leads are only for comparison and are not changed or bundled by this. No browser is needed to build it.
"""
from __future__ import annotations

import html
import json
import os
import shutil
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(HERE))
import qa  # noqa: E402
import synth  # noqa: E402
from argon_author import leveled  # noqa: E402
from briefs import BRIEFS  # noqa: E402

VIZ = Path(os.environ.get("VIZ_DIR", str(Path.home() / "claude-viz")))
OUT = VIZ / "poke-sfx-2"
RTP = ROOT / "public" / "assets" / "easyrpg" / "sound"
MANIFEST = json.loads((ROOT / "public" / "assets" / "monster-sfx" / "manifest.json").read_text())
WAV_DIR = Path(os.environ.get("MONSTER_SFX_WAV_DIR", "/tmp/psfx/wav2"))

# Closest RTP sound — a loose lead only (the game does not play these for these events today).
RTP_LEAD = {
    "status-poison": "Poison.wav", "status-burn": "Fire1.wav", "status-sleep": "Sleep.wav", "status-confusion": "Confusion.wav",
    "stat-up": "Buff.wav", "stat-down": "Debuff.wav", "weather-sand": "Sandstorm.wav", "weather-hail": "Ice1.wav",
    "weather-rain": "Wave1.wav", "item-get": "Item1.wav", "door-open": "Close1.wav", "hm-rock-smash": "Earth2.wav",
    "hm-surf": "Wave2.wav", "shop-buy": "Decision1.wav", "crit": "Blow4.wav",
}
SET2 = [sid for sid, b in sorted(BRIEFS.items(), key=lambda kv: kv[1]["rank"]) if b.get("set") == 2]


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


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    rows, seq = [], {}
    for sid in SET2:
        b = BRIEFS[sid]
        sound = MANIFEST["sounds"].get(sid)
        if not sound:
            continue
        shutil.copy(WAV_DIR / f"{sid}.wav", OUT / f"{sid}.wav")
        spectro(OUT / f"{sid}.wav", OUT / f"{sid}.png")
        seq[sid] = f"poke-sfx-2/{sid}.wav"
        lead = ""
        if sid in RTP_LEAD:
            shutil.copy(RTP / RTP_LEAD[sid], OUT / f"rtp-{sid}.wav")
            lead = (f'<div class="cell cur"><div class="lbl">RTP 비슷한 소리(참고 · 지금 이 사건엔 안 남)</div>'
                    f'<audio controls preload="none" src="poke-sfx-2/rtp-{sid}.wav"></audio></div>')
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
            others.append(f'<div class="mini"><span>{pf.name.split(".")[0]}</span><audio controls preload="none" src="poke-sfx-2/{name}"></audio></div>')
        gate = sound["gate"]
        chips = [chip(f'{sound["durationSeconds"]:.2f}s'), chip(f'peak {sound["peakDbfs"]} dBFS'), chip(f'rms {sound["rmsDbfs"]} dBFS'),
                 chip(f'clip {sound["clippedSamples"]}'), chip(f'DC {sound["dcOffset"]}'), chip(f'앞 무음 {sound["leadSilenceMs"]}ms'),
                 chip(f'뒤 무음 {sound["trailSilenceMs"]}ms'), chip(f'밝기 {sound["centroidHz"]:.0f}Hz'), chip("44.1kHz mono", "ok"),
                 chip("자동 검사 통과" if gate == "pass" else "검사: " + "; ".join(gate), "ok" if gate == "pass" else "bad")]
        new = (f'<div class="cell new"><div class="lbl">새소리(채택) · 오리지널 합성</div>'
               f'<audio controls preload="none" src="poke-sfx-2/{sid}.wav"></audio>'
               f'<div class="chips">{"".join(chips)}</div><img src="poke-sfx-2/{sid}.png" alt=""></div>')
        rows.append(f'<section id="{sid}"><h3>{b["rank"]}. {html.escape(b["title"])} <small>{sid} · 지금: {html.escape(b["old"])}</small></h3>'
                    f'<p class="brief">{html.escape(b["brief"])}</p><div class="row">{lead}{new}</div>'
                    + (f'<details><summary>다른 통과 후보 {len(others)}개</summary><div class="minis">{"".join(others)}</div></details>' if others else "")
                    + "</section>")
    page = f"""<!doctype html><html lang="ko"><meta charset="utf-8"><title>몬스터 장르 효과음 2차 — 진화·획득·상태·날씨·필드</title>
<style>
body{{background:#0f1116;color:#e8e8ea;font:14px/1.5 system-ui,"Noto Sans CJK KR",sans-serif;margin:0;padding:16px 22px 80px}}
h1{{font-size:19px;margin:0 0 4px}} h3{{margin:26px 0 2px;font-size:16px;border-bottom:1px solid #2a2d36}} h3 small{{color:#99a;font-weight:400;font-size:12px;margin-left:8px}}
.brief{{color:#9aa;font-size:12px;margin:2px 0 6px;max-width:1100px}} .lede{{color:#aab;max-width:1100px}}
.row{{display:flex;gap:8px;flex-wrap:wrap}} .cell{{background:#171a22;border:1px solid #2a2d36;border-radius:7px;padding:6px;width:330px}}
.cell.cur{{border-color:#6a3a1c}}.cell.new{{border-color:#2d5a2a;width:380px}}
.lbl{{font-size:12px;color:#ccd;margin-bottom:3px}} .cur .lbl{{color:#ffc79e}} .new .lbl{{color:#b9f29e}}
audio{{width:100%;height:30px}} img{{width:100%;display:block;margin-top:4px;border-radius:3px}}
.chips{{display:flex;flex-wrap:wrap;gap:3px;margin-top:4px}} .chip{{font-size:11px;background:#222632;border-radius:3px;padding:0 5px}} .chip.ok{{background:#1f4a22;color:#c9f5c0}} .chip.bad{{background:#5a2316;color:#ffd0bd}}
.minis{{display:flex;gap:8px;flex-wrap:wrap;margin-top:6px}} .mini{{width:250px;font-size:12px;color:#99a}} .mini audio{{height:26px}}
button{{background:#2b6cb0;color:#fff;border:0;border-radius:5px;padding:7px 14px;cursor:pointer;font-size:13px;margin:4px 6px 4px 0}}
</style>
<h1>몬스터 장르 효과음 2차 — 진화 · 획득 · 상태 이상 · 날씨 · 필드</h1>
<p class="lede">초록 = 새소리(Argon 이 쓴 합성 패치를 코드로 렌더, 원본) · 주황 = 가까운 RTP 소리(참고만, 게임에 안 넣음). 원작 샘플은 쓰지 않았다.
 숫자는 자동 검사 결과이고 귀로 들은 판정이 아니다. 거슬리는 소리는 번호와 느낌만 알려 주면 그 패치를 다시 쓴다.</p>
<div><button onclick="seq('evolve')">진화 한 판(시작→변신 중→완료)</button><button onclick="seq('status')">상태 이상 5종</button>
<button onclick="seq('weather')">날씨 4종</button><button onclick="seq('field')">필드(풀숲×4→문→체육관 문)</button>
<button onclick="seq('hm')">비전 3종</button><button onclick="stopAll()">정지</button> <span id="now"></span></div>
{''.join(rows)}
<script>
const NEW={json.dumps(seq)};
const SCRIPTS={{
 evolve:[['evolve-before',0],['evolve-during',1900],['evolve-after',6900]],
 status:[['status-poison',0],['status-burn',1200],['status-paralysis',2400],['status-sleep',3600],['status-confusion',5200]],
 weather:[['weather-rain',0],['weather-sun',2200],['weather-sand',4400],['weather-hail',6600]],
 field:[['walk-grass',0],['walk-grass',300],['walk-grass',600],['walk-grass',900],['door-open',1500],['gym-door',2600]],
 hm:[['hm-cut',0],['hm-rock-smash',1200],['hm-surf',2500]],
}};
let timers=[], playing=[];
function stopAll(){{timers.forEach(clearTimeout);timers=[];playing.forEach(a=>{{a.pause()}});playing=[];document.getElementById('now').textContent='';}}
function seq(name){{stopAll();
 for(const [id,t] of SCRIPTS[name]){{ timers.push(setTimeout(()=>{{const src=NEW[id];document.getElementById('now').textContent=id;if(!src)return;const a=new Audio(src);playing.push(a);a.play();}},t)); }}}}
</script></html>"""
    (VIZ / "poke-sfx-2.html").write_text(page)
    print("wrote", VIZ / "poke-sfx-2.html")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
