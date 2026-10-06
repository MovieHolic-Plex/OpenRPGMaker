# Merchant v2 identity redesign

Review: http://mdc-server:18326/?wave=merchant-redesign-v2&candidate=merchant-246f53bcdb027e7d

Original / V1 / V2 comparison GIF and decoded actual GIF frames were visually reviewed.
The head is a teal bandana with a back knot, the face has a moustache, and the torso uses
leather workwear and an apron. Original foot rows and registered gait offsets are retained.

Native structure, exact GIF frame media, source-template replay and clone policy passed during registration.
The native checker reports raw frame-change warnings caused by the one-pixel original gait offset;
registered head/torso geometry passes. GIF frames were inspected for scarf, face and garment continuity.
No appearance approval is claimed. The new candidate is pending; no user vote was written.
Candidate stored and reloaded in the independent harness SQLite `.data/`.

Sources: standalone `variants/merchant-v2/{author.py,template.json,candidate.json}`.
Compared original, V1, V2 in that order. These remain derivatives of the original mart_employee template.
