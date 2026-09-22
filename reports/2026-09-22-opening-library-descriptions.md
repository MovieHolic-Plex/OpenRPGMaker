# Opening cleanup and descriptive library

- Normal playback contains no key or scroll footer; keyboard actions remain usable.
- The AI image listing previously queried generic image resources instead of the still picker. It now uses the same catalog as the opening editor.
- Visual inspection covered 19 release stills and 18 bundled images. Thirteen reused welcome images had unrelated names/tags. Corrected descriptions reflect actual pixels. Two collages/UI examples remain compatibility resources with suitableForOpening:false.
- AI metadata: description, mood, useCases, series, cautions, suitableForOpening. Unrelated bundled images have separate series IDs. Queries require all space-separated words.
- The new production plan expands 24 worlds, 12 narrative compositions and 8 lighting treatments to 2,304 unique pending IDs. Intended descriptions must be reviewed against generated pixels. Generated rows begin pending; catalog generation and packaging require approval.
- tibo retry returned quota exhaustion with a reset in about 4h17m. Zero additional images were produced; the current release still contains 19 images. No pending image is offered by the AI.

Evidence under verify-shots/opening-examples (local, not committed):

- bundled-contact.jpg and pack-contact.png: inspected existing pictures.
- winter.gif and ocean.gif: clean playback with no key footer, four pictures then title.
- playback.json: both example paths entered the map with no page errors.
- ai-library-results.json: actual read-tool output for winter/underwater/desert/reference queries.

Player build and SDK packaging succeeded. Catalog and plan generation completed.
No Vitest, full typecheck or gates were executed on this follow-up request, in
accordance with the repository's session restriction. Existing tests were updated.
