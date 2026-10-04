# Runtime tile window QA

- player.html; export store shim
- 64×64, native Combined Town 16px / Slates 32px, four layers, quarter terrain/water, shadows, NPC, farm and placeable
- Native QA frame stepping, frozen water phase; exact RGBA comparison against complete-map rendering.
- First destination frame checked for terrain before freezing the comparison phase.
- Real water animation tick: {"before":"tile_30_nw","after":"tile_31_nw","frames":4,"deltaMs":100}

| Beat | Changed pixels | Resident container objects |
|---|---:|---:|
| start16 | 0 | 1547 |
| front16 | 0 | 1394 |
| pan16 | 0 | 1597 |
| jump16 | 0 | 1065 |
| return16 | 0 | 1547 |
| transfer32 | 0 | 898 |
| zoom32 | 0 | 1242 |
| changed32 | 0 | 1242 |

## 즉시 확인

- start16-resident.png: layered field, water, NPC and farm/placeable.
- transfer32-resident.png: settled destination at 32px; first frame also checked above.

Console/page errors: []
