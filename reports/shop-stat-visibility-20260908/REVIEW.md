# Keyboard shop stat visibility fix

The reproduced visibility defects are fixed without changing input policy,
equipment calculations, transaction behavior, or canonical project data.
This does not establish the original reporter's exact screen configuration.

## Before and after

| Viewport | Before | Candidate shipping player |
|---|---|---|
| 1024x768 | Four rows visible | Four rows and all numeric spans visible |
| 640x480 | Mind clipped; agility below the panel | Four rows and all numeric spans visible |
| 320x240 | Stat-slot ancestor has display:none | Four compact stat columns visible |

| Viewport | Before screenshot | After screenshot |
|---|---|---|
| 1024x768 | [Before](baseline/1024x768-inline.png) | [After](shipping/1024x768-inline.png) |
| 640x480 | [Before](baseline/640x480-inline.png) | [After](shipping/640x480-inline.png) |
| 320x240 | [Before](baseline/320x240-inline.png) | [After](shipping/320x240-inline.png) |

## Scope

- Compact equipment summaries prioritize numbers over duplicated artwork,
  description and ownership metadata.
- Minimum-size summaries show four stat columns. Existing keyboard guidance
  shares the action row instead of consuming another line.
- Complete replacement names, restrictions and effects remain in the
  keyboard-scrollable detail view.
- Global mouse blocking remains intentional and unchanged. It is not the
  diagnosis or the fix.

## Actual gameplay proof

The canonical `oprn-e98456e1d8` project was loaded without editing its content.
The hero's `equip_sword` was unequipped through the normal keyboard equipment
menu, then selected in the existing weapon shop's Sell list. No inventory grant,
stock replacement, or database write was used.

The comparison remains attack 45 -> 53 (+8), defense 72 -> 72 (0),
mind 48 -> 48 (0), and agility 45 -> 45 (0). It previews equipping the sword;
selling it does not grant those stats.

The lead independently ran the candidate shipping build and native Firefox
keyboard flow, then the recorded-evidence audit. Both exited 0.
[The assertion table](assertion-table.json) records 12 inline rows, 24 numeric
spans, and 1,719 clipping-ancestor checks. Selected stock, quantity, total,
balance and action controls were in bounds and nonoverlapping at all three sizes.
Keyboard detail scrolling and exact opener restoration also passed.

CSS budget/graph gate: exit 0, no baseline regression. CSS language-server
diagnostics were unavailable because Biome is not installed; no dependency was
added. Browser errors and failed requests were zero in the final run.
Owned browser, server and temporary build resources were closed/removed.
Existing application servers were not restarted or modified.

The detailed local probe and canonical baseline are preserved in the
investigation workspace, not replaced with a synthetic regression project.
Screenshots are actual captures; image pixels were unavailable to the execution
model, so subjective visual approval is not claimed.
