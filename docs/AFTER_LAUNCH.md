# After the launch

Things to do once the site is live at https://xenohunter.github.io/ankigen/.

1. **Search Console.** Add the property `https://xenohunter.github.io/ankigen/` (type "URL prefix"). The verification meta tag is in `index.html` (`google-site-verification`), so press Verify once it is deployed. Then submit `https://xenohunter.github.io/ankigen/sitemap.xml` under Sitemaps. A few days later, check under Pages that the `decks/` pages are indexed.
2. **Phone check**, on an iPhone (Safari) and on Android (Chrome):
   - pick a pair and a module, open Preview, select a word on a card and tap Feedback (the corner button): the dialog should quote it;
   - tap Reset all, then Cancel, then Reset all again and confirm: the page should come back with nothing chosen;
   - tap Download: the file should open in AnkiDroid (or AnkiMobile) and import.
3. **Feedback.** Send one real report from the live site. A row should appear in the sheet within a minute. `docs/FEEDBACK.md` explains the columns and triage.
4. **Blank cards in AnkiDroid** (see below): find where AnkiDroid keeps "Empty cards", and tell Claude Code the menu path.
5. **When IPA is done:** bump the app version to 1.1.0 and the data version, then push.

## Blank cards and "Empty Cards"

Anki never deletes cards when you import a file. Suppose someone downloads a deck with reverse cards, studies it, then turns reverse cards off on the site, downloads again and imports. Anki updates the notes, but the reverse cards stay in the collection. Their template now shows nothing, so Anki calls them "empty cards", and they keep coming up for review as blank cards.

On the desktop, Tools → Empty Cards… lists them and deletes them. The site's "Updating your deck" help says so, but names only that desktop menu. AnkiDroid has the same cleanup somewhere in its menus (probably the ⋮ menu on the deck list), and the help should name it for phone users too.

To check:
1. On the live site, pick a pair and one small module, turn **Reverse cards** on, download, and import into AnkiDroid. The deck has two cards per word.
2. Turn **Reverse cards** off, download again and import. The deck still has two cards per word, and the reverse ones are blank.
3. Find "Empty cards" in AnkiDroid, run it, and check that only the blank cards go.
4. Tell Claude Code the menu path, and it will add it to the help text.
