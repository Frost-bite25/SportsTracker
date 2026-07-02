# Race Tracker — hosting on GitHub Pages (fully automatic)

`index.html` + `data.json` is a static site. Once it's on GitHub, it refreshes
itself with **no manual editing and no app needed** — a GitHub Action runs on
GitHub's servers every 6 hours and updates the results for every sport.

| Series | Source the Action uses | Reliability |
|---|---|---|
| **F1** | Jolpica/Ergast API + live browser fetch | Exact |
| **MotoGP / Supercross / Motocross / Hard Enduro / Tour de France** | Wikipedia season page (parsed by the Action) | Best-effort — updates within hours of each event; a parse miss just retries next run |

The site never breaks if a scrape fails: the Action only fills a winner it
successfully read, and never clears an existing value.

## Files

```
index.html                    the page (reads ./data.json, embedded data as fallback)
data.json                     the data shown on the site — updated automatically
scripts/update-data.mjs       the updater the Action runs (F1 API + Wikipedia)
.github/workflows/refresh.yml the schedule + permissions (every 6 hours)
```

## One-time setup (browser only — no terminal)

1. **Create the repo** at github.com/new → name it, set **Public**, no README.
2. **Upload the files.** In Finder press **Cmd+Shift+.** to reveal the hidden
   `.github` folder, then **Add file → Upload files** and drag everything in
   (keep the `scripts` and `.github/workflows` folders). Commit.
   - If `.github` won't drag in, use **Add file → Create new file**, type the
     path `.github/workflows/refresh.yml` (the slashes make the folders), paste
     the contents, commit. Repeat for `scripts/update-data.mjs`.
3. **Enable Pages.** Settings → Pages → Deploy from a branch → **main / (root)**.
   Site lives at `https://<you>.github.io/<repo>/` (needs an `index.html`, which
   this is).
4. **Let the Action write back.** Settings → Actions → General → Workflow
   permissions → **Read and write permissions** → Save. *(Required, or the
   Action can't save the refreshed data.json.)*
5. **Kick it off.** Actions tab → **Refresh race data** → **Run workflow**.
   It runs itself every 6 hours after that.

## Notes

- **F1** also refreshes live in every visitor's browser, so it's current even
  between Action runs, and its click-to-expand shows the full finishing order.
- The other sports' click-to-expand shows the winner; a fuller podium appears if
  the optional weekly Cowork task (or a manual edit) adds a `results` array.
- **To adjust frequency**, edit the `cron` line in `refresh.yml`
  (`0 */6 * * *` = every 6 hours).
- **The weekly Cowork task is now optional** — the Action is the real engine.
  Keep the task if you want a human-quality correction pass; otherwise you can
  disable it in the Scheduled sidebar and rely entirely on GitHub.
