# Saber Pit runtime baseline

Reproduce after `npm ci && npm run build`:

```sh
node scripts/bench-typescript-simulation.mjs dist
node scripts/bench-typescript-simulation.mjs build/dist
```

The benchmark uses two fixed seeds on Crossroads, 120 Hz combat ticks, 60 Hz sampled presentation, and 1,200 frames per fixture after warm-up. Canvas calls are counted through a headless stub: this measures JavaScript combat, rig preparation and paint submission, not browser rasterization, GPU load, actual FPS, or a phone's performance.

Measured on the 4.0 JavaScript release under Node 24.22.3. Milliseconds per sampled frame, full visual detail, 95th percentile:

| Fight | Simulation | Total headless frame |
| --- | ---: | ---: |
| 1v1 | 0.50 | 2.19 |
| 5v5 | 2.21 | 7.15 |
| 12v12 | 6.54 | 13.43 |
| 24v24 | 14.77 | 27.93 |

**Decision:** keep TypeScript/JavaScript as the runtime for this migration. Standard 5v5 did not make a case for a Rust rewrite on this host; 24v24 showed a concrete simulation budget problem. Profile real phone frames next, then test a spatial index that preserves the existing collision-pair order. Consider Rust/WebAssembly only for a measured hot path that remains too slow, and require both the same seeded outcomes and a meaningful end-to-end gain after data transfer costs. Rust is not shipped in this branch.
