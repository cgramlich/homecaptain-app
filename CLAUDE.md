# CLAUDE.md - HomeCaptain App (frontend)

Auto-read by Claude Code at session start. Keep it current.

**Doc currency (see starter spec §5):** keep this file + the architecture doc in step
with the code in the SAME session you change code. Don't hardcode the version here
(point to `APP_VERSION`/`BUILD` + the backend `/health`); update the doc body when the
architecture changes; write a DATED entry in the app's Log folder for EVERY work session:
`C:\Users\cjgra\Dropbox\My AI\CG Apps\HomeCaptain\HomeCaptain Log\`.
Rule: `CG Apps\Forever Apps\forever-apps-starter-spec.md` section 5.

## What this is
HomeCaptain frontend: a SINGLE-FILE HTML PWA (React via CDN + Babel standalone,
no build step) - the Forever Apps home-management hub (homes, repair/maintenance
log, bill scanning, docs, reminders). Fresh clean extract of the MenuCaptain/
Tracker template (this shell is also the parent of the FitnessCaptain shell),
with the MenuCaptain photo storage/OCR lift. Backend is a SEPARATE repo
(`homecaptain-backend`, FastAPI on Railway + Supabase with the private `photos`
bucket).

## Coordinates
- Repo: `cgramlich/homecaptain-app` (public). GitHub username is `cgramlich`
  (no "j" - easy to mistype as the email handle cjgramlich).
- Deploy: push to `main` -> GitHub Pages redeploys (Pages from `main`/root).
  `teaser.html` = shareable public teaser page.
- The app is one file: `index.html`. Deliverable file name is exactly `index.html`.
- Version: source of truth = `APP_VERSION` (friendly label) + `BUILD`
  ("YYYY-MM-DD.N" - what the updater compares) in `index.html`, plus `VERSION` in
  `sw.js` in lockstep. Bump on EVERY deploy or installed users silently never
  update. Do NOT hardcode the current number in this doc - it drifts.
- Backend base URL: `API_BASE` in `index.html` =
  https://web-production-cd84d.up.railway.app (verify via its `/health`).

## Verify before delivering
- `npm run check` (check.js, Babel-in-Node compile gate) BEFORE every deploy;
  then content-grep to confirm each intended change is present.
- For automated edits, assert each anchor string appears EXACTLY ONCE before
  replacing.
- One change set per deploy.

## How Chris works
- Plain-English feedback; you read the code and make edits directly. Iterate freely.
- Ask before building: feature work gets a SHORT proposal + sign-off first. One
  step at a time; wait for confirmation.
- Debug logs-first: ask for console output / network response / screenshot before
  theorizing. Do not guess.
- Direct, no hedging. Production-ready, not demos.
- Commands handed to Chris: ONE per code block, never grouped, wait for output.
- Environment: Windows 11. Keep console/log output ASCII-safe (no emoji).

## Reference docs (read for full context; keep in sync)
- HomeCaptain docs folder: `C:\Users\cjgra\Dropbox\My AI\CG Apps\HomeCaptain\`
- Backend CLAUDE.md: `C:\Users\cjgra\homecaptain-backend\CLAUDE.md`
- Forever Apps starter spec: `CG Apps\Forever Apps\forever-apps-starter-spec.md`
