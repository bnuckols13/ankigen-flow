# Vendored dependencies

Loaded only when a deck is downloaded. Never fetched from a CDN at runtime. Update them deliberately: check the
release notes, replace the files, update this table, and run `npm test` (which builds and reopens packages).

| File | Package | Source in the npm tarball | SHA-256 |
|---|---|---|---|
| `sql-wasm.js` | [sql.js](https://github.com/sql-js/sql.js) 1.14.2 (SQLite 3.49.1) | `dist/sql-wasm.js` | `f1c84000dbc856c9d87f4f3aabc4d3654bd436165db4be3da13751db3a9c20d7` |
| `sql-wasm.wasm` | sql.js 1.14.2 | `dist/sql-wasm.wasm` | `38c14f6e379210bc942bdc4ebca44e7bfdb4318ecc1c72ca666a28fdce96670a` |
| `fflate.js` | [fflate](https://github.com/101arrowz/fflate) 0.8.3 | `esm/browser.js` (ES module) | `b7ca4450b19559a1d50eb381adcee94b82449674be4cd17789d9beba7e6122a1` |
| `fflate.d.ts` | fflate 0.8.3 | `esm/browser.d.ts` (types for the type check) | `985db2599e33d85a70a6da5f2b7b6f1b0bf9b9119781b684573a1a9b463e0cc4` |

npm integrity:

- `sql.js@1.14.2`: `sha512-3ZGPovObMFrdw79zrUHbfdE/DLIsy8jdNdssmMSQuRAymedU6q84asPt0kgiqrdMYlPegDItiIMfmIXzZnYFcw==` (published from GitHub Actions with provenance)
- `fflate@0.8.3`: `sha512-tbZNuJrLwGUp3zshBtdy4W+ORxZuIh8a5ilyIEQDC5rY1f3U20JMry0Ll3WBzU58EZKsEuJFXhb5gwv8CsPvgA==`

To check the files: `sha256sum vendor/*.js vendor/*.wasm vendor/*.d.ts`.

Licenses: `LICENSE-sql.js` (MIT; SQLite itself is public domain) and `LICENSE-fflate` (MIT).

How they are loaded:

- `sql-wasm.js` is a classic script that defines `initSqlJs`. The page adds it with a `<script>` tag on first download and calls `initSqlJs({ locateFile: (f) => 'vendor/' + f })`. Node (tests, `tools/apkg.mjs`) loads it through `tools/lib/sqljs.mjs`.
- `fflate.js` is imported as an ES module by `src/deck/apkg.js`.

## Share logos

`src/ui/share-icons.js` holds the path data (`d`, viewBox `0 0 24 24`) of nine logos, copied as is from
[simple-icons](https://simpleicons.org) 16.33.0, `icons/<name>.svg`: x, facebook, reddit, telegram, whatsapp, vk, line,
sinaweibo (as `weibo`) and bluesky. They load with the Share block only.

- Tarball `simple-icons-16.33.0.tgz`: SHA-256 `11e1ab7c25fd0acbf0014c4a88745c33fe0f87341e6d94c7ba1e62334b2d2375`;
  npm integrity `sha512-z14u6A8ngAg9mgERRsNO8YkjIMefehIpBk7A8Dz3Gd91945qFP19MLPSHgV4z8P5u/MRYd5e07OTzaDoB4d6qA==`.
- License: CC0-1.0 for the icon data. The logos are trademarks of their owners, shown only to link to their sites.

The flags in `img/flags/` are drawn for this project (no third-party source).
