# Store placement independent review — 2026-10-09

- Real model: `gpt-6-astra` / thinking `high`
- Store install: **True**
- Model summary: **passed=True**
- Independent result: **passed=False**
- UI input exercised: `False` (this is the real Pi agent path, not desktop UI automation)

## What the saved map proves

The store trail group declares members `38..53` on the **upper** layer. The saved project contains:

- lower trail cells: `67` (`[53]`)
- upper trail cells: `0`
- upper trail variants: `0`
- preserved lower ground cells: `768`

So the model's completion text is a false visual pass. It painted tile `53` onto the lower layer, where the renderer produces a hard strip; it did not produce the connected upper-layer autotile path.

![Raw render](render.png)

Render SHA-256: `270e5d31c0c7c88bafa92e33badfd637edd42b92082ec18517bbacb030bad774`

## Corrective change

The next run must route imported autotile members through their explicit group layer and use the exact `fill_region(material, path, width, layer)` fallback when `lay_path` rejects a four-neighbor path.
