# Store placement independent review — corrected run — 2026-10-09

- Real model: `gpt-6-astra` / thinking `high`
- Store install: **True**
- Strict harness result: **passed=False**
- Independent saved-map result: **passed=True**
- UI input exercised: `False` (headless real Pi agent path)

## Saved map evidence

The store trail group declares members `38..53` on the upper layer. This corrected run contains:

- lower trail cells: `0`
- upper trail cells: `52`
- upper trail variants: `6` (`[39, 41, 42, 49, 50, 52]`)
- preserved lower ground cells: `864`

The first `lay_path` call was rejected because the imported group is four-neighbor. The error included an exact `fill_region` fallback; the model used it and the resulting path is on `upperTiles` with multiple variants.

![Corrected render](render.png)

Render SHA-256: `d8677049990166f12a796217d15f817be8ddb47f9ea0829c4e1236c35a2cab51`

## Remaining defects

The strict harness remains false because the model made three invalid `list_resources` calls and one intentionally rejected `lay_path` call before recovery. These are visible tool errors, not hidden. The run did complete reference reading, object placement, visual review, reachability, save, and reopen. Desktop editor UI input was not exercised by this headless run.
