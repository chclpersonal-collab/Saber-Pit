# Saber Pit

Saber Pit 5.2.1 is a 2D browser-based saber arena. Play or spectate custom fights, push three lanes in Three Fronts, train in Style Lab, run 1v1, 5v5 and 1v3 tournaments, and send Saved Heroes through an offline-capable Idle RPG expedition.

## Run locally

Use Node.js 22.18 or newer and a modern browser.

```sh
npm ci
npm start
```

Open <http://127.0.0.1:4173>. For the original mode, open [Classic](http://127.0.0.1:4173/classic.html). Set the `PORT` environment variable to use a different port.

The local server serves the generated website from `build/dist/`. Arena, tournaments, Style Lab, Idle RPG, browser-local saves and JSON backup/import work without an account or server-side service. Linked-device saves require an authenticated backend that is not included here. Leave linked saves off for local use.

## Three Fronts

[Three Fronts](http://127.0.0.1:4173/moba.html) is a separate local 5v5 fight with three lanes, minion waves, towers, and a Core. You control one fighter. The nine others use AI. It does not require matchmaking or modify your Arena career. [Controls and objectives](docs/three-fronts.md)

## Arena Elo

Equal-team Arena elimination rounds from 1v1 through 15v15 earn Elo. Fighters start at 100, and their training rank sets a ceiling just below the next rank's threshold (for example, F caps at 199.5 until promotion to E). Higher rated Arena AI reads and adapts to fights more effectively; its rating does not add health or damage. Results and ratings stay with the Arena run on this device. Training, objective and Hero matches do not change this rating, and tournament ratings remain separate.

## Source and validation

Browser code lives in `src/*.ts`; development tools and tests use `.mts`. The checked-in `dist/` contains static HTML, CSS and assets. No standalone JavaScript source files are checked in. The build emits browser and Node JavaScript under the ignored `build/` directory. The generated website has no runtime package dependencies.

```sh
npm run typecheck      # Strictly check the browser application, with zero exceptions
npm run check          # Type-check, build and check generated module syntax
npm test               # Build and test the resulting game
npm run verify:parity  # After building, compare seeded outcomes against the original 4.0 release
```

The optional historical browser tests use Playwright and Chromium; these are not needed for the default suite. Unit and replay tests use synthetic data.

The [frozen compatibility fixtures](fixtures/README.md) contain compressed historical replay engines and an independent regression reference. They are not maintained application source. The builder verifies the fixture hashes before extracting them, so old recordings still work without a network connection after setup. Only historical replay runtimes are emitted into the served website; independent comparison data is not served.

## Credits and source rights

See [in-game credits](dist/credits.html) for artwork, icon and font sources, and `dist/credits/` for the third-party asset license notices. No general license for the project source is included. The game is unofficial and is not affiliated with the owners of the fictional material referenced in the [lore notes](docs/lore-v09.md).
