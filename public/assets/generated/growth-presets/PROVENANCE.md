# Growth preset cover provenance

These three covers are offline composites of already bundled repository art,
made 2026-09-06 for same-role promotion and skill preset cards. They are not new
AI-generated illustrations. No external download or new dependency was used.

## Recovery and rights

The lead reported native `generate_image` HTTP 403 `key_model_access_denied`
for `gpt-image-2` (the key supports only muse) and editor google-antigravity
`connected:false`. The lead selected packaged-art composition within the requested image-rich preset scope.
This worker did not retry generation, seek credentials, or call an AI service.
There is no new generation prompt, model response, or seed for these composites.

The source files are existing generated game assets in this repository.
This document does **not** assign CC0 or any
new license, assert exclusive ownership, or independently establish original
provider terms. Those terms/rights remain those of the source assets and must
not be inferred from a filename or this processing step.

## Source history

- Backdrops: `67bf391c9207d0742284507674fa1149e78ce978` replaced procedural
  placeholders with raster art. Its commit message attributes generation to
  god-tibo-imagen/Codex via the mdc image API, describing sunrise, moonrise,
  and storybook scenes. This is historical attribution, not a new verified API
  invocation. The message says 1024x1024; actual decoded files are 1254x1254.
- Party warrior/mage: created in `691c6149ce58205e2accbc1570ece6d8ae341c04`
  (commit message: image_gen, green chroma to alpha); current bytes come from
  `48e285dea820319fb780486d867ae57c72634d0f` (border flood-fill chroma correction).
  Exact original prompts/model identifiers were not recovered.
- Ranger: `b57567d61b1bde85d10c970e405e1d916aac7fed` introduced six individual
  rear-view figures. Repository recipe: `scripts/asset-gen/gen-hero-back-grok.mjs`,
  `HEROES`/`backViewPrompt` in `scripts/asset-gen/battlerPrompt.mjs`, and
  `spriteProcess.mjs`. The hero-04 descriptor is a green-clothed scout carrying
  a short recurve bow and hunting dagger.
  The script documents Grok generation using the shipped idle frame as reference;
  the original invocation record/raw response was not recovered or rerun here.

All source paths below are relative to `public/assets/generated/battle-skins/`.
The source commit is the latest pixel-changing commit identified above.

| Source | Dimensions | Bytes | SHA-256 |
| --- | --- | --- | --- |
| `goldensun-backdrop.png` | 1254x1254 | 2280667 | `92dae531bca5368bd964a1f1549ced7caf151518a04585225102e9e4076d89f4` |
| `chrono-backdrop.png` | 1254x1254 | 2517595 | `961bc2bdad755e30d299273d124baba752b63d168619d09e1b82152a49e7a669` |
| `bravely-backdrop.png` | 1254x1254 | 2648544 | `01b5d5e388e8920c9a6f59abbde60be4dfeb071621bfa4db57c508615c761464` |
| `sprites/party-warrior-back.png` | 747x1138 | 518024 | `ce7fe9cf28c1fa7db1d9dfa1bbff1a74e0febc4c3e879ff9d16c94b00601fc2c` |
| `sprites/party-mage-back.png` | 469x886 | 401368 | `a93a5990b92ea633cbe77344ab00e0603d2b7210053cae9b48899f78efbb96ae` |
| `sprites/hero-04-back.png` | 712x712 | 341842 | `a4efac9950118a3a183bc8cde556f94b8af99aaf01bfaf6cd84b5e524583a96b` |

## Reproduction

Run from the repository root with the existing Jimp 0.16.13:

```sh
node scripts/generate-growth-preset-covers.mjs
node scripts/generate-growth-preset-covers.mjs --verify
```

The second command regenerates in memory and requires byte-identical shipped
PNGs. Both commands decode sources, print source commit/hash/bytes/alpha/bounds,
and require exact composed-pixel PNG round-trip equality.

Recipe: center-crop each backdrop to `(0,209,1254,836)` and bilinear-resize to
1024x683. Trim only transparent figure margins, premultiply alpha, bilinear-scale
proportionately to 490px high, then unpremultiply alpha and source-over composite
at y=118, horizontally centered. Restore the mathematically opaque backdrop alpha
after Jimp's floating-point compositing; encode RGB PNG with RGBA input stride,
deflate level 9. No palette reduction, drawn props, text, frames, or logos added.
The figure rectangles fit wholly in the central 16:9 crop band y=54..629.

| Cover | Backdrop / figure | Figure source bounds x,y,w,h | Output figure x,y,w,h | Output bytes | Output SHA-256 |
| --- | --- | --- | --- | --- | --- |
| `vanguard.png` | goldensun / party-warrior-back | 8,8,731,1122 | 353,118,319,490 | 989208 | `342985355ab3712899a3045962aefe6352682b3ecbd8cf4fc88635c1ddb35c77` |
| `arcane.png` | chrono / party-mage-back | 8,8,453,870 | 385,118,255,490 | 1157832 | `39fe5ae74ab29c76105d980bcbfb979a3428cd6d1a69feea237ffcf5fe54a3fe` |
| `ranger.png` | bravely / hero-04-back | 56,5,601,703 | 303,118,419,490 | 1141713 | `684ff227d9f994c3c18105aa44bd5a483a9634e10736b57c706ac70a3639aeb7` |

All outputs are real, fully opaque 1024x683 RGB PNGs. Per the lead's report,
image-capable QA `st_01a0741c` passed vanguard/arcane but found white/magenta
square remnants in the original hero-06 ranger. Ranger therefore uses the
parent-confirmed green archer hero-04 instead; no color deletion, erosion,
blur, or source-art edits were added. Approved vanguard/arcane bytes are unchanged.
This worker cannot inspect images visually. The lead subsequently reported
image-capable re-review PASS for the replacement ranger at SHA-256
`684ff227d9f994c3c18105aa44bd5a483a9634e10736b57c706ac70a3639aeb7`,
completing the all-three-cover PASS verdict.
