# Saber Pit

Saber Pit 4.00.0 is a 2D browser-based saber arena. Play or spectate custom fights, train in Style Lab, run 1v1, 5v5 and 1v3 tournaments, and send Saved Heroes through an offline-capable Idle RPG expedition.

## Run locally

You need Node.js 22 or newer and a modern browser. Running this migration branch requires the pinned development compiler; the compiled game has no runtime dependencies or account requirement.

```sh
npm ci
npm start
```

Open <http://127.0.0.1:4173>. For the original game, open [Classic](http://127.0.0.1:4173/classic.html). To use a different port: `PORT=8080 npm start`.

The generated browser code is served directly from `build/dist/`. The Arena, tournaments, Style Lab, Idle RPG, browser-local saves, and JSON backup/import are usable without a server-side service. Linked-device saves require an authenticated server that this public snapshot does not include. Leave linked saves off for local use.

## Test

```sh
npm run check
npm test
```

The test data is synthetic and includes fixtures for old save migrations. The optional historical browser test scripts need a separate Playwright and Chromium installation; they are not required to run the game or the default tests.

## Credits and source rights

See [in-game credits](dist/credits.html) for artwork, icon and font sources, and `dist/credits/` for the bundled third-party license notices. Those licenses apply to their respective assets. No general license for the project source is included in this release. The game is unofficial and is not affiliated with the owners of the fictional material referenced in the [lore notes](docs/lore-v09.md).

## TypeScript migration branch

This branch builds the full website from `src/` using a pinned TypeScript compiler.
Use Node 22 or newer:

```sh
npm ci
npm start                 # Builds and serves build/dist/ on localhost:4173
npm run typecheck         # Strict checking for current browser source
npm run typecheck:all     # CI gate: requires zero migration exceptions
npm test                  # Tests run against generated code, not the 4.00.0 fixture
npm run verify:parity     # Compare seeded outcomes against exact 4.00.0
```

`src/` is the browser source of truth. During this compatibility pass, `dist/`
contains the immutable JavaScript release reference plus the original static
website assets. The production local entry point serves only `build/dist/`.
Edit browser code in `src/*.ts`; use the root `dist/` for static HTML, CSS,
images, and attribution files. Existing ES module filenames and browser cache
queries intentionally stay unchanged. The strict checker resolves those same
imports without the cache query; the runtime still uses the original URLs.

Arena, Classic, tournament, career, save and replay controllers, and both
animation labs pass strict checking with no exceptions. The Animation Lab's
controller is emitted from TypeScript like the other browser entries. No
new check exceptions or line suppressions are allowed. Do not modify
`dist/*.js` or archived replay engines to match future source changes; those
are frozen regression inputs, not maintained browser source.

Rust/Wasm is not required. Benchmark actual compute plus JS/Wasm transfer,
GC, and browser rendering before extracting a deterministic subsystem; retain
the same seeded replay outcomes across both implementations.
