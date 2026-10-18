# Feedback backend: Google Sheet + Apps Script

Reports from the site arrive as rows in a Google Sheet you own. There are no API keys and nothing secret in the page. The endpoint URL is public by design, and the script enforces the limits.

## One-time setup (about 5 minutes)

1. Create a Google Sheet, e.g. "AnkiGen feedback".
2. **Extensions → Apps Script.** Delete the sample code, paste the whole of `feedback/Code.gs`, and save.
3. In the editor, choose the function **`setup`** and press **Run**. Approve the permission prompt. It needs access to this spreadsheet only. This creates the `Reports` tab with headers.
4. **Deploy → New deployment →** type **Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Deploy, then copy the **Web app URL** (ends with `/exec`).
5. Put that URL into `src/config.js` (`FEEDBACK_ENDPOINT`), or give it to Claude Code.
6. Test it: open the URL in a browser. It should show `{"ok":true,"service":"ankigen-feedback"}`.

**Updating the script later:** Deploy → Manage deployments → edit (pencil) → Version: *New version* → Deploy. This keeps the same URL. A plain "New deployment" would create a new URL.

## What you get

One row per report, with these columns:
- `received_at`, `client_time`, `tz_offset_min`
- `client_id` (a random ID stored in the user's browser; no fingerprinting)
- `category`, `message`, `email`, `selected_text`
  - `category` is empty or one of `wrong-translation`, `typo`, `wrong-form`, `bad-example`, `suggestion`, `other`.
  - `message` starts with the quoted selection, if there was one.
- `concept_id`, `direction`, `side`, `field`
  - `concept_id` is one ID, or a merged note's IDs separated by commas.
  - The other three say where the selected text was, e.g. `forward`, `back`, `Examples` (a field of the note type). They are empty for a report from a card in the word list, or for general feedback.
- `learning`, `known`, `config_url`
- `app_version`, `data_version`, `browser_lang`
- `status` and `notes` (empty, for your triage)

To filter spam, sort or filter by `client_id`. Then fix the data, run lint, and bump the data version.

## Limits (in `Code.gs`, adjust freely)

| Limit | Value |
|---|---|
| Body size | 8,000 chars |
| Message | 4,000 chars |
| Per client ID | 30 reports per rolling 6 h |
| Global | **2,000 rows per UTC day**; after that, the script refuses until midnight UTC |
| Honeypot | non-empty `website` field → silently dropped |
| Formula injection | cells starting with `= + - @` are prefixed with `'` |

The client adds friction on top:
- ≥ 15 s between sends, ≤ 5 per 10 minutes, ≤ 20 per day;
- after 10 "garbage" messages it silently stops sending garbage (real reports still go through).

## Privacy note for the site (short)

> Reports are stored in a private spreadsheet and used only to fix the vocabulary and, if you leave an email, to reply to you. We store a random ID kept in your browser to filter spam. No tracking, no analytics.
