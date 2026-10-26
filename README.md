# The Brief

A minimal, responsive technology and politics news page. No API keys. Local use needs only Python; deployment uses Gunicorn.

## Run

```sh
python3 server.py
```

Open **http://localhost:8000**. Python 3.9+ and an internet connection are required. Use `python3 server.py --port 8080` to change the port.

The page collects up to 20 recent articles per feed from BBC Technology, The Guardian Technology, BBC Politics (UK), and NPR Politics (US). It displays short publisher-provided summaries, publication ages, and original article links. These are RSS abstracts, not AI-generated summaries or exhaustive coverage of every news event.

Updates run every five minutes while the page is visible and when returning to the tab. The server caches successful results for five minutes. Failed sources are reported; if all sources fail after a successful update, the last available stories remain visible with a stale-data notice. No fabricated fallback news is included.

Search and category filters work together. The Saved button switches to bookmarks, which are stored in this browser, including their summaries for later reading. External fonts are optional; system fonts work offline.

The local Python server binds to localhost. It serves only the public page assets, news endpoint, and `/healthz` health check. Hosted deployments use Gunicorn behind Render's HTTPS proxy.

## Deploy on Render

1. Put the project in a GitHub repository, including `requirements.txt` and `render.yaml`.
2. In Render, choose **New > Blueprint**, connect the repository, and review the service before deploying.
3. The included Blueprint selects **paid `0.5c-512mb` compute** so the service does not sleep from inactivity. Review Render's current pricing before creating it. To use free compute instead, change `plan` to `free`; free services sleep after 15 minutes without traffic and take time to wake up.
4. Open the `onrender.com` URL Render provides after deployment. Your computer can be off.

If creating a **Web Service** manually instead of a Blueprint, use:

| Setting | Value |
| --- | --- |
| Language | Python 3 |
| Build command | `pip install -r requirements.txt` |
| Start command | `gunicorn server:application --bind 0.0.0.0:$PORT --workers 1 --threads 8 --timeout 60 --access-logfile - --error-logfile -` |
| Health check path | `/healthz` |
| Compute | Paid for no inactivity sleep |

Render supplies `PORT` and HTTPS. No database or API keys are required. One worker with eight threads shares the existing in-memory news cache; the cache resets on restart. Saved stories, read history, and preferences stay in each visitor's browser and do not sync between devices. Feed updates happen on requests, so no background worker or scheduled job is needed.

For a local production-server check:

```sh
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/gunicorn server:application --bind 127.0.0.1:8000 --workers 1 --threads 8 --timeout 60
```

The development command also accepts `--host` and the `HOST`/`PORT` environment variables; it defaults to `127.0.0.1:8000`.

Render references: [Web services](https://render.com/docs/web-services), [Blueprint configuration](https://render.com/docs/blueprint-spec), and [free service limits](https://render.com/docs/free).

Stories also receive an automatic headline-based importance label: **Critical** for explicit emergency or urgent security signals, **Worth knowing** for general developments, and **Interesting** for explainers, reviews, and lighter reads. These approximate labels are reading aids, not publisher ratings or verified assessments of urgency. Importance filters combine with topic, search, and Saved filters; existing bookmarks are classified too.

Use the header’s light/dark mode button to change appearance. The page initially follows your system appearance, tracks system changes until you choose a theme, and remembers your selection in this browser.

## Personal reading controls

- **Politics coverage:** US (NPR), UK (BBC Politics), or International (BBC World). Regions describe the feed’s editorial scope; international coverage includes general world affairs. Technology stories remain global. Your choice is remembered.
- **Since last visit:** highlights publication timestamps newer than the previous successful visit. Your first visit establishes a baseline; stories without valid dates are not marked new.
- **Read/unread:** opening an original or related report marks it read. Each card also has a manual toggle. Read history is stored locally in this browser (up to 2,000 URLs).
- **Five-minute briefing:** up to five stories, with unread and higher-priority stories first, newest first within each group. Closely matching cross-source headlines are skipped to reduce repetition. This is a short selection, not a timed full-article reading guarantee.
- **Related coverage:** expandable links to different publishers with strongly similar headlines published within 48 hours. These are approximate matches, not verified accounts of the identical event.
- **Automatic updates:** enabled by default, with a next-check countdown. Checks run every five minutes while visible, immediately on return to the tab, and on reconnect. Disable with the checkbox; manual refresh remains available. The server caches results for five minutes, so early checks may return cached news. Closed tabs do not run background jobs; reopening fetches the latest available feed.

Run reader behavior checks with `node tests/reader.test.cjs`; run syntax checks with `node --check app.js`, `node --check reader.js`, and `python3 -m py_compile server.py`.
