# Interior layout review

Compact homes use shared activity areas and seeded topology candidates. Furniture placement preserves required capacity, physical north-wall overlap, supported small props, and usable approaches. Interior activity zones persist through the spatial schema and compiler.

The reviewed authored maps and reusable place definitions are saved in LegacyDb project `rpg-zzu-ashen-vault-20260913`; they are not bundled project seeds in this commit. `place-registration.json` records save/reload equality, preservation of all 75 maps, and detached preview/apply checks for six reusable facilities. The two-story inn generated two maps and bidirectional stair transfers.

`shops.png` shows the reviewed shop arrangements. `stair-fix.png` shows the final aligned northeast stairs and the relocated bathroom. Native tile renders support visual review; movement test success does not establish aesthetic quality.

Runtime review: the final stair revision passed 38 beats across both floors and both transfer directions. Earlier seven-map review passed 124 beats, including front and back counter approaches. Full repository tests have a known failing baseline; focused tests and the app typecheck are reported separately in the PR.
