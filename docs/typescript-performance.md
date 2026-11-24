# Saber Pit runtime baseline

Reproduce after `npm ci && npm run build`:

```sh
node build/scripts/bench-typescript-simulation.mjs build/baseline/dist
node build/scripts/bench-typescript-simulation.mjs build/dist
```

The benchmark uses two fixed seeds on Crossroads, 120 Hz combat ticks, 60 Hz sampled presentation, and up to 1,200 frames per fixture after warm-up. The `step` and `snapshot` columns separate the two engine ticks from the two intermediate renderer-input snapshots. Canvas calls are counted through a headless stub: this measures JavaScript combat, rig preparation and paint submission, not browser rasterization, GPU load, actual FPS, or a phone's performance.

Measured on the 4.0 JavaScript release under Node 24.22.3. Milliseconds per sampled frame, full visual detail, 95th percentile:

| Fight | Combat + snapshots (original combined measurement) | Total headless frame |
| --- | ---: | ---: |
| 1v1 | 0.50 | 2.19 |
| 5v5 | 2.21 | 7.15 |
| 12v12 | 6.54 | 13.43 |
| 24v24 | 14.77 | 27.93 |

In a later split measurement on this host, 5v5 recorded about 2.07 ms in the engine versus 0.22 ms copying snapshots (p95); 24v24 recorded 17.09 ms versus 0.75 ms, respectively. These came from a separate run, not a before/after speed comparison. Percentiles from separate timing columns cannot be added to derive the frame percentile.

A desktop cloud Chromium smoke of the compiled game started both seeded
Crossroads configurations through the Arena menu. The 5v5 HUD showed 50 FPS
early; the 24v24 HUD showed 34 FPS with 48 fighters still alive. The latter's
canvas later resized from 1298 × 729 to 971 × 545, consistent with adaptive
detail, though the later observation was after the fight ended. These are
HUD spot checks, not frame distributions or a handset test.

**Decision:** keep TypeScript/JavaScript as the runtime for this migration. The 24v24 results motivate capture of real Arena frame timing and an engine profile before choosing Rust. Record whether the Arena switched to lower detail; it lowers the canvas pixel budget and skips effects separately from the engine. Check any collision optimization against the existing pair order because body separation updates positions within a pass. The parity runner compares authoritative fighter state, seeded randomness and event order for ordinary seeded 24v24 and a packed corner. Consider Rust/WebAssembly only for a measured hot path, with the same seeded outcomes and a meaningful end-to-end gain after data transfer. Rust is not shipped in this branch.
