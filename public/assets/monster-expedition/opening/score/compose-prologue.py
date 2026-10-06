#!/usr/bin/env python3
"""Original three-scene prologue. Run with installed numpy and ffmpeg only.

This standalone source writes only its own directory. Notes and scene score are
new; mathematical instrument timbres adapt the existing campaign composer.
"""
from pathlib import Path
import base64
import hashlib
import json
import math
import subprocess
import tempfile
import wave

import numpy as np

RATE = 22050
DURATION = 18.3
OUT = Path(__file__).resolve().parent
NAME = "작은 등대, 첫 친구"
SOURCE_REFERENCE_SHA256 = "117b678a5f52fee3a342a73b9c07436155d24f226cbd087de14604428638f53f"


def oscillator(note, time, kind):
    freq = 440 * 2 ** ((note - 69) / 12)
    phase = 2 * np.pi * freq * time + .025 * np.sin(2 * np.pi * 5 * time)
    if kind == "bell":
        return (np.sin(phase + 1.2 * np.sin(2 * phase) * np.exp(-5 * time))
                + .18 * np.sin(3 * phase) * np.exp(-8 * time)) * np.exp(-2.4 * time)
    if kind in {"flute", "hollow"}:
        return .85 * np.sin(phase) + (.13 if kind == "flute" else .34) * np.sin(3 * phase)
    result = np.zeros_like(time)
    for harmonic in range(1, min(13, int(RATE * .44 / freq)) + 1):
        if kind == "triangle" and harmonic % 2:
            result += (-1) ** ((harmonic - 1) // 2) / harmonic ** 2 * np.sin(harmonic * phase)
        elif kind == "pulse25":
            result += np.sin(np.pi * harmonic * .25) * np.cos(harmonic * phase) / harmonic
    return result / 1.1


def add_sound(mix, at, sound):
    # Linear placement: no hidden wrap of releases into the opening scene.
    first = round(at * RATE)
    count = min(len(sound), len(mix) - first)
    if count > 0:
        mix[first:first + count] += sound[:count]


def note(mix, pitch, at, length, amp, kind="bell", release=.18, attack=.012):
    time = np.arange(round((length + release) * RATE)) / RATE
    envelope = np.minimum(1, time / attack)
    envelope *= np.minimum(1, np.maximum(0, (length + release - time) / release))
    envelope *= .82 + .18 * np.exp(-10 * time)
    add_sound(mix, at, amp * oscillator(pitch, time, kind) * envelope)


def chord(mix, pitches, at, length, amp=.023, release=.25):
    for pitch in pitches:
        note(mix, pitch, at, length, amp, "triangle", release, attack=.08)


def kick(mix, at, amp=.032):
    time = np.arange(round(.16 * RATE)) / RATE
    phase = 2 * np.pi * (48 * time + 95 * .021 * (1 - np.exp(-time / .021)))
    env = np.exp(-time * 26) * np.minimum(1, time / .005)
    env *= np.minimum(1, np.maximum(0, (.16 - time) / .015))
    add_sound(mix, at, amp * np.sin(phase) * env)


def score():
    mix = np.zeros(round(DURATION * RATE), dtype=np.float64)
    # I: warm eight-beat bell phrase, D major / Dadd9 -> Gmaj7 / D.
    # New theme: D-F#-A, E-F#-D, B-A-F#-E. No borrowed tune or samples.
    intro = [(74, 0, .58), (78, .75, .32), (81, 1.25, .60),
             (76, 2, .30), (78, 2.5, .32), (74, 3, .38)]
    for pitch, at, length in intro:
        note(mix, pitch, at, length, .11, "bell", release=.28)
    for pitch, at in [(86, .5), (90, 1.75), (83, 2.75), (81, 3.5)]:
        note(mix, pitch, at, .16, .032, "bell", release=.22)
    chord(mix, [62, 66, 69, 76], 0, 1.75, .022, .35)
    chord(mix, [62, 67, 71, 78], 2, 1.65, .020, .42)
    note(mix, 50, .03, 1.55, .045, "triangle", .3, .08)
    note(mix, 55, 2.03, 1.45, .038, "triangle", .4, .08)

    # II: the lighthouse dims. Let the opening decay, remove pulse entirely.
    # Quiet relative-minor colour, then a restrained A7 suspension invites D.
    note(mix, 78, 4.04, .20, .028, "bell", .40)
    chord(mix, [59, 62, 66], 5.10, 1.05, .014, .40)
    note(mix, 47, 5.10, 1.10, .020, "triangle", .40, .10)
    note(mix, 78, 5.25, .48, .047, "hollow", .28, .06)
    note(mix, 76, 6.10, .36, .038, "bell", .34)
    chord(mix, [57, 61, 67, 76], 6.85, 1.12, .013, .45)
    note(mix, 45, 6.85, 1.15, .021, "triangle", .45, .10)
    note(mix, 73, 7.45, .58, .043, "hollow", .36, .06)
    note(mix, 76, 8.25, .32, .028, "bell", .25)

    # III: laboratory/starter invitation; return to D with a softer flute lead.
    # Nine seconds = eighteen quarter beats at 120 bpm, extended final cadence.
    lead = [(78, 9, .38), (76, 9.5, .24), (74, 10, .60),
            (81, 11, .38), (78, 11.5, .35), (79, 12, .65),
            (83, 13, .34), (81, 13.5, .36), (78, 14, .68),
            (76, 15, .38), (78, 15.5, .32), (74, 16, .72)]
    for pitch, at, length in lead:
        note(mix, pitch, at, length, .080, "flute", .17, .025)
        note(mix, pitch + 12, at, min(length, .16), .018, "bell", .20)
    harmony = [(9, [62, 66, 69, 76], 50), (11, [62, 67, 71, 78], 55),
               (13, [59, 62, 66, 69], 47), (15, [61, 64, 67, 69], 45)]
    for at, pitches, bass in harmony:
        chord(mix, pitches, at, 1.62, .018, .28)
        for offset in [0, .75, 1.5]:
            note(mix, bass, at + offset, .29, .037, "triangle", .12, .025)
        for offset, pitch in zip([.25, .75, 1.25, 1.75], [pitches[0], pitches[2], pitches[1], pitches[3]]):
            note(mix, pitch + 12, at + offset, .12, .018, "pulse25", .06)
        kick(mix, at)
        kick(mix, at + 1, .021)

    # Dadd9 resolve before normal runtime teardown at 18 s. The extra .3 s is
    # boundary slack/breath. D/D framing and zero-valued boundaries let a
    # slow reader hear the same scene sequence again without a hard loop click.
    chord(mix, [62, 66, 69, 76], 17, .40, .020, .82)
    note(mix, 50, 17, .32, .031, "triangle", .70, .05)
    note(mix, 81, 17, .15, .038, "bell", .34)
    note(mix, 78, 17.35, .14, .034, "bell", .36)
    note(mix, 74, 17.65, .20, .052, "bell", .45)
    # A small non-circular echo preserves the common campaign room colour.
    dry = mix.copy()
    for delay, wet in [(.1875, .075), (.375, .025)]:
        shift = round(delay * RATE)
        mix[shift:] += dry[:-shift] * wet
    mix = np.tanh(mix * 1.1)
    mix *= .46 / max(float(np.max(np.abs(mix))), 1e-8)
    fade_start, fade_end = round(17.5 * RATE), round(18 * RATE)
    mix[fade_start:fade_end] *= np.cos(np.linspace(0, np.pi / 2, fade_end - fade_start)) ** 2
    mix[fade_end:] = 0
    mix[:round(.012 * RATE)] *= np.sin(np.linspace(0, np.pi / 2, round(.012 * RATE))) ** 2
    return mix


def dbfs(value):
    return round(20 * math.log10(max(float(value), 1e-12)), 3)


def measure(decoded, path):
    def region(a, b):
        samples = decoded[round(a * RATE):round(b * RATE)]
        return {"start": a, "end": b, "rmsDbfs": dbfs(np.sqrt(np.mean(samples ** 2))),
                "peakDbfs": dbfs(np.max(np.abs(samples)))}
    # Aggregate consecutive 50 ms windows above -50 dBFS, actual OGG decode.
    frame = round(.05 * RATE)
    intervals = []
    start = None
    for first in range(0, len(decoded), frame):
        rms = float(np.sqrt(np.mean(decoded[first:first + frame] ** 2)))
        audible = rms > 10 ** (-50 / 20)
        if audible and start is None:
            start = first / RATE
        if not audible and start is not None:
            intervals.append([round(start, 4), round(first / RATE, 4)])
            start = None
    if start is not None:
        intervals.append([round(start, 4), round(len(decoded) / RATE, 4)])
    # First/last sample values and their step are objective boundary evidence;
    # seam listening is a separate judgement, not a proof from sample values.
    return {"file": path.name, "resourceId": "mx_audio_prologue", "sampleRate": RATE,
            "channels": 1, "sourceSamples": round(DURATION * RATE), "decodedSamples": len(decoded),
            "decodedDurationSeconds": len(decoded) / RATE,
            "peakDbfs": dbfs(np.max(np.abs(decoded))),
            "rmsDbfs": dbfs(np.sqrt(np.mean(decoded ** 2))),
            "clippedSamplesAbsAtLeastOne": int(np.count_nonzero(np.abs(decoded) >= 1)),
            "firstSample": float(decoded[0]), "lastSample": float(decoded[-1]),
            "loopJoinStep": float(abs(decoded[0] - decoded[-1])),
            "last300msRmsDbfs": region(18, 18.3)["rmsDbfs"],
            "regions": [region(0, 4), region(4, 9), region(9, 18), region(18, 18.3)],
            "nonsilenceThresholdDbfs": -50, "nonsilenceWindowSeconds": frame / RATE,
            "nonsilenceIntervalsSeconds": intervals,
            "bytes": path.stat().st_size,
            "sha256": hashlib.sha256(path.read_bytes()).hexdigest()}


def main():
    mix = score()
    destination = OUT / "prologue.ogg"
    with tempfile.TemporaryDirectory(prefix="mx-prologue-") as temporary:
        wav = Path(temporary) / "source.wav"
        with wave.open(str(wav), "wb") as output:
            output.setnchannels(1)
            output.setsampwidth(2)
            output.setframerate(RATE)
            output.writeframes((np.clip(mix, -1, 1) * 32767).astype("<i2").tobytes())
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(wav), "-map_metadata", "-1",
                        "-c:a", "libvorbis", "-q:a", "2", "-flags", "+bitexact",
                        "-fflags", "+bitexact", "-metadata", "encoder=OPRN-original-score",
                        "-metadata", "LOOPSTART=0", "-metadata", f"LOOPEND={len(mix)}",
                        str(destination)], check=True)
    raw = subprocess.check_output(["ffmpeg", "-v", "error", "-i", str(destination),
                                   "-f", "f32le", "-ac", "1", "-ar", str(RATE), "pipe:1"])
    decoded = np.frombuffer(raw, dtype="<f4")
    inspection = measure(decoded, destination)
    inspection["sourcePcmSha256"] = hashlib.sha256((mix * 32767).astype("<i2").tobytes()).hexdigest()
    inspection["containerProbe"] = json.loads(subprocess.check_output(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration:stream=codec_name,sample_rate,channels",
         "-of", "json", str(destination)]))
    inspection["generatorSha256"] = hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
    inspection["sourceReferenceSha256"] = SOURCE_REFERENCE_SHA256
    if len(decoded) != len(mix) or inspection["clippedSamplesAbsAtLeastOne"] or inspection["loopJoinStep"] > .002:
        raise RuntimeError(inspection)
    payload = {"id": "mx_audio_prologue", "name": NAME, "kind": "music",
               "dataUrl": "data:audio/ogg;base64," + base64.b64encode(destination.read_bytes()).decode(),
               "meta": {"composer": "OPRN original mathematical score", "license": "CC0-1.0",
                        "durationSeconds": DURATION, "sampleRate": RATE, "channels": 1,
                        "sceneBoundariesSeconds": [0, 4, 9, 18], "loop": True,
                        "sha256": inspection["sha256"]}}
    (OUT / "payload.json").write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n")
    (OUT / "inspection.json").write_text(json.dumps(inspection, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps(inspection, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
