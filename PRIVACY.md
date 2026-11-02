# Privacy Policy

**DBLP BibTeX does not collect, transmit, or sell any user data.**

## What the extension accesses

- **`https://dblp.org/*`** — to search DBLP and download `.bib` entries on your behalf.
  Requests are made from a `dblp.org` tab using the browser's normal session and cookies.
- **Clipboard** — only when you click **Copy**. The extension writes the BibTeX text you see;
  it never reads the clipboard.
- **Session storage** (`chrome.storage.session`) — the id of the background DBLP tab and the
  last search results, kept in memory for the current browser session. It is not synced and
  is cleared when the browser closes.

## What the extension does not do

- No analytics, telemetry, crash reporting, or remote logging.
- No network requests to any server other than `dblp.org`.
- No access to pages outside `dblp.org`; no `<all_urls>` host permission.
- No selling or sharing of data with third parties.
- No reading of your browsing history, bookmarks, cookies, or clipboard.

## Third parties

Search results and BibTeX come directly from DBLP. Your use of DBLP is subject to
[DBLP's own terms](https://dblp.org/faq.html).

## Contact

Open an issue at <https://github.com/tangquanwei/dblp-bibtex/issues>.
