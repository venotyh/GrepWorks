# GrepWorks — Claude Code Project Guide

## Overview

Job board auto-scanner. `gwks scan` scrapes listings via browser automation → filters and deduplicates → `/evaluate-jobs` skill evaluates against CV → outputs a Markdown table with resume suggestions.

## Stack

- Node.js 18+ ESM (`.mjs` files)
- OpenCLI fork (`feat/no-debugger-eval`) + Browser Bridge Chrome extension
- Chrome (must be logged in to target platforms)
- Evaluation engine: Claude Code skill, no separate API key needed

## Commands

```bash
gwks scan                                  # full scan per task.yml
gwks scan --platform liepin
gwks scan --platform boss --keyword "AI Agent" --location 苏州
gwks scan --dry-run                        # debug, no file writes
gwks results                               # show latest evaluation
```

Evaluation (run inside a Claude Code session):
```
按照 EVALUATE_JOBS.md 的规范评估 pending.json 里的岗位
```

## File Layout

```
src/
├── adapters/liepin.mjs     # Liepin browser adapter
├── adapters/boss.mjs       # BOSS Zhipin adapter (--via-extension)
├── cli.mjs                 # gwks entry point
├── scan.mjs                # scrape pipeline
├── filter.mjs              # filter + dedup
└── render.mjs              # output rendering
.agents/skills/
└── opencli-browser/SKILL.md
search_results/
├── pending.json            # jobs awaiting evaluation (written by scan, cleared by evaluate)
└── seen.tsv                # dedup record (persistent across runs)
evaluation_results/
└── evaluation-YYYY-MM-DD-NN.md/.json
task.yml                    # user config (keywords / city / platforms / after_date)
cv.md                       # user CV (gitignored)
EVALUATE_JOBS.md            # evaluation spec (Block A–G framework)
```

## Critical Technical Constraints

### b64eval (required for all browser evals)
On Windows, `spawn` concatenates args into a shell command; spaces inside JS strings cause argument splitting. All JS passed to `browser eval` must be base64-encoded:
```js
// encode
const b64 = Buffer.from(jsCode).toString('base64')
// browser receives: eval(decodeURIComponent(escape(atob('<b64>'))))
```

### UTF-8 Chinese decode (required)
`atob()` decodes as Latin-1, corrupting multibyte UTF-8. Fixed decode pattern:
```js
eval(decodeURIComponent(escape(atob('<b64>'))))
```

### BOSS Zhipin anti-scraping
- `chrome.debugger.attach()` (CDP) triggers detection → tab immediately redirects to `about:blank`
- Use `--via-extension` flag: routes through `chrome.scripting.executeScript({ world: 'MAIN' })`, invisible to page-level anti-scraping
- Programmatic navigation still triggers detection; user must manually open the BOSS search results page before running scan
- Vue state read path: `el.__vue__.jobList` (BOSS uses Vue 2, not Vue 3)

### Session name
The opencli connected profile alias is `work`, not `boss`. Wrong session name opens a blank tab.

### stderr filtering
opencli outputs `(node:XXXX) Warning: ...` to stderr even on success. Filter out lines starting with `(node:` — they are not real errors.

## Do Not
- Overwrite `cv.md` (user CV)
- Delete or truncate `search_results/seen.tsv` without user confirmation
- Auto-submit job applications (evaluation only; user decides whether to apply)

## Evaluation Output Convention

See `EVALUATE_JOBS.md`: Block A–G framework, outputs `.md` table + `.json` array.  
Filename: `evaluation-YYYY-MM-DD-NN` (NN increments each run on the same day, zero-padded to 2 digits).

## Current Phase

- Phase 1 (Liepin + BOSS basic scan pipeline) ✅ done
- Phase 1.5 (Liepin detail page enrichment — fetch `jd_text` + `published_at`) pending
- Phase 2 (adapters for other platforms) pending
