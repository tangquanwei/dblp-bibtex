# Contributing

Thanks for taking a look! This is a small, dependency-free Manifest V3 extension.

## Development setup

1. Clone the repository.
2. Load the folder as an unpacked extension (`chrome://extensions/` → Developer mode → Load unpacked).
3. After editing, click the reload icon on the extension card, then reopen the popup.

There is no build step. `sw.js`, `content.js` and `popup.js` are plain ES modules.

## Checks

```sh
npm run check   # manifest shape, file layout, PNG signatures, JS syntax
npm run pack    # dist/dblp-bibtex-<version>.zip
```

CI runs `npm run check` and `npm run pack` on every push and pull request.

## Testing against DBLP

Headless browsers are rejected by DBLP's bot check, so real-site testing has to be manual:

1. Load the extension in a normal Chrome/Edge window.
2. Search for a well-known paper (e.g. "Attention Is All You Need").
3. Confirm the background DBLP tab passes the check and the popup receives results.
4. Paste a DBLP record URL and confirm the `.bib` path works too.

To test the plumbing without hitting DBLP, point the extension at a local mock by changing
`https://dblp.org` to your mock origin in `manifest.json` (host permission + content-script
match), `sw.js`, and `content.js`. Keep such changes out of commits.

## Code style

- No third-party runtime dependencies.
- Keep user-facing strings in Chinese for now; an English/i18n PR is welcome and should not
  change behavior.
- Prefer `textContent` over `innerHTML` when rendering fetched data.
- Keep the permission surface minimal; new permissions need a clear justification in the PR.

## Pull requests

- One topic per PR, with a short description of the behavior change.
- Include the manual test steps you ran (search query, DBLP record, Chrome version).
- If you touch `content.js`, describe how DBLP's response shape was verified.
- Update `CHANGELOG.md` for user-visible changes.

## Reporting issues

Please include:

- Chrome/Edge version and OS,
- the search query or DBLP record URL,
- what the popup showed (status text / error), and
- what the background DBLP tab displayed (normal page, challenge page, or an error).
