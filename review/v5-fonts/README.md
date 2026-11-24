# v5 fonts, review copy

Review only. Not loaded by the game. No HUD source here.

The three OFL font files from `clarissa-v5.1-hud` at f5c4442b1faaa6668e46ebdd9cc074e6b07a5eb1 (`dist/art/`), as base64 text so a text-only reader can check them.

| File in HUD branch | Base64 here | SHA-256 of the woff2 |
|---|---|---|
| dist/art/lilita-one.woff2 | lilita-one.woff2.base64.txt | d2575d4fa3632580aafcbcdf6978b3b57e144b90cf5bd9c2c98194f28b869704 |
| dist/art/nunito-800.woff2 | nunito-800.woff2.base64.txt | 2363d3ed037283ebb961e8c4b4917e40a8bc8853cf9965cf1ea7b4daa1df630a |
| dist/art/nunito-900.woff2 | nunito-900.woff2.base64.txt | 9ca32f5d8334579387361096944286df451272a557bb09bd906254a623aba99e |

Licenses: `lilita-one-OFL.txt`, `nunito-OFL.txt` (same as `dist/credits/` in the HUD branch).

Check: `base64 -d lilita-one.woff2.base64.txt | sha256sum` should match the table. `SHA256SUMS` has the same hashes.
