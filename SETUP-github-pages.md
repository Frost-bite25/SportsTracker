# Race Tracker — hosting on GitHub Pages with auto-refresh

This site is **static** (just `race-tracker.html` + `data.json`), but it refreshes
itself two ways so the hosted page stays current:

| Series | How it stays current | Runs when |
|---|---|---|
| **F1** | Live API call in the browser **and** a GitHub Action | Always (browser) + every 6h (Action) |
| **MotoGP** | GitHub Action (best-effort feed) + weekly task | Every 6h + weekly |
| **Supercross / Motocross / Hard Enduro** | Weekly Cowork task pushes updates | Mondays (while Claude app is open) |

---

## Files

```
race-tracker.html            the page (reads ./data.json, falls back to embedded data)
data.json                    the data the hosted site shows — what gets auto-updated
scripts/update-data.mjs      Node script the Action runs (F1 + MotoGP)
.github/workflows/refresh.yml GitHub Action, runs every 6 hours on GitHub's servers
```

## One-time setup

1. **Create the repo & push these files.** In this folder:
   ```bash
   git init
   git add .
   git commit -m "Race tracker"
   git branch -M main
   git remote add origin https://github.com/<you>/<repo>.git
   git push -u origin main
   ```

2. **Enable GitHub Pages.** Repo → **Settings → Pages** → *Build and deployment* →
   *Deploy from a branch* → branch **main**, folder **/ (root)** → **Save**.
   Your site appears at `https://<you>.github.io/<repo>/race-tracker.html`.

3. **Let the Action commit back.** Repo → **Settings → Actions → General** →
   *Workflow permissions* → select **Read and write permissions** → **Save**.
   (This lets the every-6-hours job push the refreshed `data.json`.)

4. **Test the Action now.** Repo → **Actions** tab → *Refresh race data* → **Run workflow**.
   After it runs, check that `data.json`'s `updated` timestamp changed.

5. **Weekly task → live site.** The Cowork task "race-tracker-weekly-refresh" updates
   `data.json` for the dirt-bike series and runs `git push`. For that push to work,
   this folder must be the same git repo from step 1 with push access cached
   (the `git push` in step 1 sets that up). The task only runs while the Claude
   desktop app is open.

## Notes

- **F1 is the most autonomous:** it updates in every visitor's browser regardless of
  the Action, so even between commits it shows the latest results.
- **MotoGP via the Action is best-effort** (it reads motogp.com's unofficial feed). The
  weekly task is the guaranteed updater for MotoGP if the feed changes shape.
- **Editing by hand:** change `data.json` and commit — the hosted page updates on refresh.
- Change the Action frequency by editing the `cron` line in `refresh.yml`
  (e.g. `0 7 * * 1` = Mondays 7am UTC).
