# Frozen compatibility data

`legacy-javascript-*.gz.part` (concatenated in manifest order) is a version-pinned fixture containing exact released
4.0 JavaScript reference bytes, older replay engine/geometry data, and the independent
Phase 1 test oracle. The original Animation Lab page is an independently pinned compressed fixture, restored only for comparison. It is not a source tree and should never be edited or regenerated
from the current TypeScript modules. The authored project sources are TypeScript.

The build checks the tracked bundle SHA-256 and every entry digest before materializing
compatibility modules in ignored `build/`. The old snapshots keep historical recordings
playable without the network and let tests compare against the same released behavior.
