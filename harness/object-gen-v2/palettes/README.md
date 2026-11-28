# Palettes

Every `object-gen-v2` batch locks opaque pixels 100% to one palette file (`palette_violations == 0`).

- `fable-city.json`: 16-bit JRPG daylight ramp palette shared with OpenRPGMaker `jp_city` (`jp-bldg-f-*`), `modern_city`, and `modern_campus`. Contains warm/cool architectural ramps (`wood`, `cedar`, `steel`, `concrete`, `pavement`, `navy`, `midori`, `cream`, `coolwhite`, etc.) with zero harsh `#000000` reliance.

Add new theme palettes (e.g. `beodeul.json`, `joseon.json`, `murim.json`, `sf-station.json`) as JSON hex-ramp dicts or `.pal` hex lists and pass `--palette` to `verify` / `pack`.
