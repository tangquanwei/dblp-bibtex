# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project adheres to [Semantic Versioning](https://semver.org/).

## [1.0.0] - 2026-11-02

### Added

- Manifest V3 extension that searches DBLP and copies the original BibTeX.
- Background DBLP tab so the browser itself passes DBLP's Anubis check; same-origin
  content-script requests to `/search/publ/api` and `/rec/<key>.bib?param=1`.
- Result list with automatic BibTeX preview for the first hit and one-click copy.
- Direct lookup by pasting a DBLP record URL.
- Restores the previous results when the popup is reopened.

[1.0.0]: https://github.com/tangquanwei/dblp-bibtex/releases/tag/v1.0.0
