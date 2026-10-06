# 별빛섬 몬스터 원정 — original score

Fourteen original pieces: twelve repeating background tracks, a victory fanfare,
and a short confirmation sound. No recording, MIDI, melody, soundfont, or sample
from Pokémon or another game is used. The source explicitly authors each melody
and harmonic progression; synthesis is mathematical and percussion uses seeded
noise. Shared instrumentation gives the island a consistent sound.

| Export key | Piece | Music and placement |
| --- | --- | --- |
| title | 별빛섬의 약속 | D major, 112 BPM; open fourths, rising answer, pulse lead. Title. |
| town | 온빛마을의 창가 | C major, 96 BPM; soft triangle melody, measured walking bass. Towns/inns. |
| route | 바람개비 길 | G major, 132 BPM; eighth-note travel melody, quarter-note tonic/fifth bass. Routes. |
| forest | 이끼숲의 작은 행진 | E dorian, 108 BPM, 3/4; flute-like harmonics, bright A-major turn. Forest. |
| coast | 유리물결 항구 | F major, 104 BPM; offbeat FM bell melody and displaced arpeggios. Harbor/coast. |
| cave | 반향의 결정굴 | D minor, 82 BPM; hollow sine harmonics, rests, circular echo, no drums. Caves/ruins. |
| snow | 눈꽃 우체국 | B-flat major, 90 BPM, 3/4; upper-register bells and delicate waltz percussion. Snow. |
| gym | 여덟 등불 | A mixolydian, 126 BPM; saw lead and G-major color resolve through E major. Gyms. |
| wildBattle | 풀숲의 도전 | E minor, 154 BPM; narrow pulse, immediate eighth-note challenge, B-major turnaround. Wild battle. |
| trainerBattle | 맞바람 결투 | C minor, 144 BPM; lower saw theme, high response and four-part chord movement. Trainer battle. |
| league | 별관의 계단 | F-sharp minor, 138 BPM; wider pulse, climbing sequence and sustained C-sharp dominant. League/champion. |
| ending | 함께 돌아가는 별빛 | D major, 94 BPM; new descending flute theme, warm chord bed, reflective return. Ending/postgame. |
| victory | 별빛 승리 | 2.6-second six-note fanfare with IV–V–I cadence. Single playback on ME. |
| confirm | 선택 확인 | 0.25-second A5–D6 triangle/bell interval. Single playback on SE. |

## Arrangement and loop construction

Each BGM is eight full measures with separate melody, sustained harmonic bed,
picked chord arpeggios, low triangle bass, and rhythm. Forest and snow use six
eighth-note slots per measure; others use eight. Ties and rests are authored in
the score. Forest, snow, cave, harbor, and battle have distinct pacing/timbre.
The last harmony leads back into the first; bar-eight percussion pickups belong
to the repeating phrase. There is no fade-in, fade-out, silence pad, or detached
intro on a loop. Echo is circular: note and delay tails cross the phrase boundary
as they would during ongoing playback. Attack/release envelopes reduce clicks,
and harmonic synthesis is limited below Nyquist to reduce aliasing.

The renderer uses 22,050 Hz mono PCM, then FFmpeg's existing libvorbis encoder at
quality 2. The confirmation cue remains PCM WAV for immediate short playback.
OGG LOOPSTART/LOOPEND metadata records source sample boundaries; the engine loops
the entire decoded buffer, so playback does not depend on metadata support.

## Deterministic generation and measured inspection

Run `python3 scripts/content/monster-expedition-music.py` from the repository.
The existing Python numpy and FFmpeg are the only tools; nothing is downloaded.
The script writes media, `manifest.json`, and the generated TypeScript registrar.
Do not edit the base64 lines by hand. Percussion seeds derive from SHA-256 of
the track key; FFmpeg bitexact flags fix the OGG stream serial and metadata.

The script decodes every emitted file through FFmpeg, measures sample count,
duration, peak and RMS level, and the last-to-first sample step. It rejects sample
count drift, peaks >= 0.9 full scale, and loop boundary steps > 0.035 full scale.
The checked-in manifest is the exact measured output and SHA-256 inventory.
The BGM peaks sit approximately 4.3–4.7 dB below full scale and RMS levels
approximately 15.5–17.6 dB below full scale. No clipping occurs. Phrase lengths
are 12.468–23.415 seconds. This is offline media inspection; interactive browser
playback and canonical-project save/reload belong to campaign integration.

## Player and portable export contract

`configureExpeditionAudio(project)` synchronously registers all fourteen tracks
under `project.assets.uploaded`, with `kind: music` for BGM/victory and `kind:
sound` for confirmation. It also configures title BGM, default town BGM, default
wild battle BGM, victory ME, and title confirmation SE. Existing title layout
and menu labels are preserved; projects without title settings receive defaults.

`EXPEDITION_AUDIO` exports exact resource IDs under the keys above. The campaign
builder selects map tracks, trainer battles, league battles and ending music
from this table. Background playback must loop; victory/confirmation must not.
For a trainer-specific BGM use the engine's authored system-BGM override/event
path rather than modifying the media. Reset the override after that encounter.

The upload `dataUrl` contains the real encoded bytes, not `/assets/...` text.
`resolveAudioSource` accepts these music/sound uploads, the shared asset resolver
accepts their audio MIME types, and `uploadedAssetBytes` decodes the same payload
for portable export and SQLite content-addressed media promotion. A URL string
in `dataUrl` would be rejected by the resolver and exported as non-media text.
The public copies enable independent audition and inspection; running the game
does not require an external BGM catalog, CDN or composer tools. Unused uploaded
tracks are pruned by portable export; maps/events must actually reference them.
