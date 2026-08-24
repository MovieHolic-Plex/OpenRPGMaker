# Farming life UI art

These eight card illustrations were generated with the built-in `image_gen` tool on
2026-08-24 and 2026-08-25 for the Stardew-style life simulation journal. They are product assets,
not QA-only mockups. Runtime/editor consumers should reference the public paths
under `/assets/farming/life-ui/`.

All prompts requested crisp 16-bit pixel art, an opaque warm parchment card with a
pale-green border, no text, no logos, and no watermark. Existing chicken, cow, and
potato crop sprites were supplied only as pixel-scale and palette references.

| File | Prompt subject | SHA-256 |
|---|---|---|
| `animals-card.png` | Chicken and cow care, hay trough, egg, milk pail | `ea84f981cef388a273a9d5c878e1f4364fa020ca82744a41b4ec7670e0afa930` |
| `buildings-card.png` | Coop, barn, upgraded farmhouse with greenhouse | `775a6127534d45f30869a4b0298e8f88bbf27593aa2d204d31c9e92cce423c43` |
| `community-bundles-card.png` | Six-slot village restoration bundle board | `a6aca925cc1f385875a916d8d73f6d2f2c4b1ec38a6fec216f52fa56c49c9d3f` |
| `decorating-card.png` | Warm farmhouse furniture placement and rotation ghost | `7b943140c33d04a3f3fe546a24d3b6520d25294912160e669cf67de60e7954d5` |
| `fishing-card.png` | Fishing meter, catch zone, bobber, fish, and rod | `a197f20d51614ca03e42701f7e2a46f04dd9af19dbc912cdc535af1f63ad3957` |
| `foraging-card.png` | Seasonal forest forage basket and discovery notebook | `1d2ee26326e11fccb6ceb91367106ad53acf2f0de0061bf0693e0f76ce1f66f8` |
| `makers-card.png` | Preserve jar, cheese press, and copper keg | `19829f7323eb51ee79900e278e4502bba5fb4a026ade00005184e6b75312648a` |
| `museum-card.png` | Six-slot museum cabinet with three discoveries | `0b60fcf5a863443d0b52cc62381b9ba7d2188c311473bc829bbd4e4652f34880` |

The generated originals were resized with nearest-neighbor sampling to a maximum
width of 768 px so the cards retain pixel edges without adding multi-megabyte
source-resolution payloads to the player.
