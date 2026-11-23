# Saber Pit

Saber Pit 4.00.0 is a 2D browser-based saber arena. Play or spectate custom fights, train in Style Lab, run 1v1, 5v5 and 1v3 tournaments, and send Saved Heroes through an offline-capable Idle RPG expedition.

## Run locally

You need Node.js 22 or newer and a modern browser. No install, package download, account, or build step is needed.

```sh
npm start
```

Open <http://127.0.0.1:4173>. For the original game, open [Classic](http://127.0.0.1:4173/classic.html). To use a different port: `PORT=8080 npm start`.

The browser code lives in `dist/` and is served directly. The Arena, tournaments, Style Lab, Idle RPG, browser-local saves, and JSON backup/import are usable without a server-side service. Linked-device saves require an authenticated server that this public snapshot does not include. Leave linked saves off for local use.

## Test

```sh
npm run check
npm test
```

The test data is synthetic and includes fixtures for old save migrations. The optional historical browser test scripts need a separate Playwright and Chromium installation; they are not required to run the game or the default tests.

## Credits and source rights

See [in-game credits](dist/credits.html) for artwork, icon and font sources, and `dist/credits/` for the bundled third-party license notices. Those licenses apply to their respective assets. No general license for the project source is included in this release. The game is unofficial and is not affiliated with the owners of the fictional material referenced in the [lore notes](docs/lore-v09.md).
