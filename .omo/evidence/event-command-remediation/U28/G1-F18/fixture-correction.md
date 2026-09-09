# Actor ordinal fixture correction

The first post-fix run passed variable insertion but rendered the actual second
default actor's name rather than Other. The blank project already contains more
than one actor; appending Other did not satisfy the pre-RED fixture contract
that Other occupies slot 2.

Other is now inserted at index 1 without deleting any existing actor or
reference. Setup asserts the actor and variable IDs in slot 2. Expected body,
token, runtime text, metadata and all original assertions are unchanged.

The original RED failures remain valid: both tools immediately inserted slot 1
before a picker existed. That failure occurs before the corrected actor lookup.
`basic-green.json` retains the unsuccessful post-fix run; it is not a passing
receipt.
