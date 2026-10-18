// Landing pages for search engines (ARCHITECTURE §10): a static page for every language pair that has words, a
// hub that lists them, and the sitemap. tools/bundle.mjs writes them into the site:
//   decks/<learning>-for-<known>-speakers/   e.g. decks/japanese-for-russian-speakers/
//   decks/<learning>-monolingual/            same-language mode: definitions instead of translations
//   decks/                                   the hub: every page, by the language you speak
//   sitemap.xml                              the app, the hub and every page
//
// A page describes its own deck with the app's deck code: the words per module with a few samples, the card
// fields for the pair, and links that open the app with the pair (and a module) chosen. Plain HTML with the
// app's stylesheet, no scripts. A pair without words gets no page, so pages appear as the vocabulary is
// generated. Slugs come from the English names in data/meta/languages.json: renaming a language moves its pages.
import { APP_VERSION, DATA_LICENSE_URL, PATREON_URL, REPO_URL, SITE_URL } from '../src/config.js';
import { SAME, encodeHash, isFieldShown, moduleIds, validate } from '../src/state.js';
import { localTerms, moduleCounts, selectNotes } from '../src/deck/select.js';
import { deckContext, langTag, noteSummary } from '../src/deck/fields.js';
import { deckName } from '../src/deck/names.js';
import { escapeAttr, escapeHtml } from '../src/text/html.js';
import { DRAFT_HELP, SAME_HELP, UPDATE_HELP, localTermsHelp } from '../src/ui/copy.js';
import { count } from '../src/ui/format.js';

/** @typedef {import('../src/data/loader.js').Concepts} Concepts */
/** @typedef {import('../src/data/loader.js').LanguageData} LanguageData */
/** @typedef {import('../src/deck/select.js').Note} Note */
/** @typedef {{ meta: any, concepts: Concepts, data: Map<string, LanguageData> }} Input */

/**
 * @typedef {object} Pair  a language pair with words, and its page
 * @property {string} learn
 * @property {string} know     a language code, or SAME
 * @property {string} dir      the page's directory, relative to the site root
 * @property {string} name     "Japanese for Russian speakers", "Monolingual Japanese"
 * @property {Note[]} notes    the deck with every module chosen
 * @property {Note[]} pool     the notes that may be samples
 * @property {Map<string, number>} counts  words per module
 * @property {Map<string, { count: number, example: string }>} local  words only the learned language has, per module
 * @property {import('../src/deck/fields.js').DeckContext} ctx
 */

/** The hub, relative to the site root; the pages are its subdirectories. */
export const DECKS_DIR = 'decks/';
/** Sample words per module. */
const SAMPLES = 3;
/** Never shown as samples, like the 18+ modules. */
const UNSAFE_REGISTERS = new Set(['vulgar', 'offensive']);
const NO_DATA = { lang: new Map(), ex: new Map(), ipa: new Map(), etym: new Map() };
const EXTERNAL = 'target="_blank" rel="noopener"';

/** "Japanese" → "japanese", "Portuguese (Brazil)" → "portuguese-brazil". @param {string} name */
export function slug(name) {
  return name.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/** @param {any} meta @param {string} code */
const nameOf = (meta, code) => meta.languages.languages[code]?.name ?? code;

/** A pair's page directory and name. @param {any} meta @param {string} learn @param {string} know */
export function pairPage(meta, learn, know) {
  const l = nameOf(meta, learn);
  if (know === SAME) return { dir: `${DECKS_DIR}${slug(l)}-monolingual/`, name: `Monolingual ${l}` };
  const k = nameOf(meta, know);
  return { dir: `${DECKS_DIR}${slug(l)}-for-${slug(k)}-speakers/`, name: `${l} for ${k} speakers` };
}

/**
 * Every language pair with words, in registry order, the same-language deck after the bilingual ones.
 * @param {Input} input @returns {Pair[]}
 */
function pairs({ meta, concepts, data }) {
  const active = /** @type {string[]} */ (meta.languages.active);
  const modules = moduleIds(meta);
  const adult = new Set(meta.modules.categories.flatMap((/** @type {any} */ cat) => cat.modules.filter((/** @type {any} */ m) => m.adult).map((/** @type {any} */ m) => m.id)));
  /** Samples never come from an 18+ module or have a vulgar or offensive register. @param {Note} note */
  const clean = (note) =>
    note.conceptIds.every((id) => {
      const c = concepts.byId.get(id)?.c;
      return c && !c.mods.some((/** @type {string} */ m) => adult.has(m)) && !UNSAFE_REGISTERS.has(c.reg);
    });
  return active.flatMap((learn) =>
    [...active.filter((code) => code !== learn), SAME].flatMap((know) => {
      const config = validate({ learn, know, modules }, meta);
      const learnData = data.get(learn) ?? NO_DATA;
      const knowData = know === SAME ? learnData : (data.get(know) ?? NO_DATA);
      const notes = selectNotes(config, meta, concepts, learnData, knowData);
      if (!notes.length) return [];
      return [{
        learn,
        know,
        ...pairPage(meta, learn, know),
        notes,
        pool: notes.filter(clean),
        counts: moduleCounts(config, meta, concepts, learnData, knowData),
        local: localTerms(config, meta, concepts, learnData, knowData),
        ctx: deckContext({ config, meta, concepts, learnData, knowData }),
      }];
    }),
  );
}

/**
 * The landing pages, the hub and the sitemap, as { path relative to the site root: content }.
 * Same data, same bytes.
 * @param {Input} input
 */
export function landingFiles(input) {
  const list = pairs(input);
  /** @type {Record<string, string>} */
  const files = {};
  for (const pair of list) files[`${pair.dir}index.html`] = pairHtml(pair, list, input.meta);
  files[`${DECKS_DIR}index.html`] = hubHtml(list, input.meta);
  files['sitemap.xml'] = sitemapXml(['', DECKS_DIR, ...list.map((p) => p.dir)]);
  return files;
}

/** The same, from the data a loader reads (tools/bundle.mjs passes one that reads the built site). @param {ReturnType<typeof import('../src/data/loader.js').createLoader>} loader */
export async function landingSite(loader) {
  const meta = await loader.getMeta();
  const concepts = await loader.getConcepts();
  const codes = /** @type {string[]} */ (meta.languages.active);
  const data = new Map(await Promise.all(codes.map(async (code) => /** @type {[string, LanguageData]} */ ([code, await loader.getLanguage(code)]))));
  return landingFiles({ meta, concepts, data });
}

// ---------------------------------------------------------------- pages

/** @param {string} dir */
const depth = (dir) => dir.split('/').filter(Boolean).length;

/**
 * The page around a body: head (canonical URL, link preview, breadcrumb data), breadcrumb, footer.
 * @param {{ meta: any, dir: string, title: string, description: string, trail: { name: string, dir: string }[], body: string }} page
 *   trail: the breadcrumb after AnkiGen, ending with this page
 */
function pageHtml({ meta, dir, title, description, trail, body }) {
  const root = '../'.repeat(depth(dir));
  const url = SITE_URL + dir;
  const crumbs = [{ name: 'AnkiGen', dir: '' }, ...trail];
  const last = crumbs.length - 1;
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, ...(i < last ? { item: SITE_URL + c.dir } : {}) })),
  };
  // Every crumb is this page or a directory above it.
  const nav = crumbs
    .map((c, i) => `<li><a href="${'../'.repeat(depth(dir) - depth(c.dir)) || './'}"${i === last ? ' aria-current="page"' : ''}>${escapeHtml(c.name)}</a></li>`)
    .join('');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeAttr(description)}">
<link rel="canonical" href="${url}">
<meta name="color-scheme" content="light dark">
<meta name="theme-color" content="#f6f6f4" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#151618" media="(prefers-color-scheme: dark)">
<link rel="icon" href="${root}favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="${root}apple-touch-icon.png">
<meta property="og:type" content="website">
<meta property="og:site_name" content="AnkiGen">
<meta property="og:url" content="${url}">
<meta property="og:title" content="${escapeAttr(title)}">
<meta property="og:description" content="${escapeAttr(description)}">
<meta property="og:image" content="${SITE_URL}og-image.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="AnkiGen: free Anki vocabulary decks in 15 languages, with a sample card for the Japanese word 水, water.">
<meta property="og:locale" content="en_US">
<meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>
<link rel="stylesheet" href="${root}css/app.css">
</head>
<body class="lp-page">
<header class="site-head">
  <nav class="crumbs" aria-label="Breadcrumb"><ol>${nav}</ol></nav>
</header>

<main class="lp">
${body}
</main>

<footer class="site-foot">
  <a class="button support" href="${PATREON_URL}" ${EXTERNAL}>Support this project</a>
  <p class="foot-line"><a href="${REPO_URL}" ${EXTERNAL}>Source on GitHub</a> · Data ${escapeHtml(meta.version.data)} · App ${APP_VERSION}</p>
  <p class="foot-line">Code under the <a href="${REPO_URL}/blob/master/LICENSE" ${EXTERNAL}>MIT license</a>; vocabulary under <a href="${DATA_LICENSE_URL}" ${EXTERNAL}>CC&nbsp;BY-SA&nbsp;4.0</a>.</p>
</footer>
</body>
</html>
`;
}

/** @param {Pair} pair @param {Pair[]} list @param {any} meta */
function pairHtml(pair, list, meta) {
  const { learn, know, ctx, notes, counts } = pair;
  const same = know === SAME;
  const l = nameOf(meta, learn);
  const k = same ? l : nameOf(meta, know);
  /** The app with this pair and these modules chosen. @param {string[]} modules */
  const appHref = (modules) => escapeAttr(`../../${encodeHash(validate({ learn, know, modules }, meta), meta)}`);
  const groups = moduleGroups(meta, counts);
  const shown = groups.flatMap((g) => g.modules);
  const first = shown[0];
  const words = count(notes.length, 'word');
  const modules = count(shown.length, 'module');
  const examples = notes.some((note) => note.conceptIds.some((id) => ctx.learn.data.ex.get(id)?.length)) ? ' and example sentences' : '';
  const phrase = same ? `monolingual ${l}` : `${l} for ${k} speakers`;

  const title = same ? `Free monolingual ${l} Anki deck — AnkiGen` : `Free ${l} Anki deck for ${k} speakers — AnkiGen`;
  const description = same
    ? `Free monolingual Anki deck for ${l}: ${words} with short definitions in ${l}, in ${modules}, for Anki and AnkiDroid.`
    : `Free Anki deck for ${k} speakers learning ${l}: ${words} in ${modules}, with ${k} translations${examples ? ' and examples' : ''}, for Anki and AnkiDroid.`;
  const lede = same ? `A free Anki deck of ${l} words with short definitions in ${l}, built in your browser.` : `A free Anki deck of ${l} words with ${k} translations, built in your browser.`;
  const intro = same
    ? `AnkiGen makes free monolingual Anki decks for ${l}: ${words} in ${modules}, with short definitions in ${l}${examples}. Good once you can read simple sentences in ${l}.`
    : `AnkiGen makes free Anki decks for learning ${l} from ${k}: ${words} in ${modules}, with ${k} translations${examples}.`;
  const caption = ctx.know.code !== 'en' && meta.labels.labels[ctx.know.code] ? ctx.label('section.examples') : null;

  const body = `<h1>${escapeHtml(pair.name)}</h1>
<p class="lede">${escapeHtml(lede)}</p>
<p class="lp-facts">${escapeHtml(`${words} · ${modules} · Anki deck: ${deckName(ctx.config, meta)}`)}</p>
<p class="lp-cta"><a class="button primary" href="${appHref([first.id])}">Build your deck</a> <span>Opens AnkiGen set to ${escapeHtml(phrase)}, with ${escapeHtml(first.name)} chosen.</span></p>
<p>${escapeHtml(intro)} Choose the modules and what each card shows, then download an .apkg file for Anki or AnkiDroid. It all happens in your browser, with no account and nothing to install.</p>

<h2>What the cards show</h2>
<p>${escapeHtml(`Each card shows a ${l} word and ${same ? `a short definition in ${l}` : `its ${k} translation`}. You choose what else it shows, and on which side:`)}</p>
${fieldsHtml(pair, meta)}${caption ? `\n<p>Card captions, such as “<span lang="${ctx.know.tag}">${escapeHtml(caption)}</span>”, are in ${escapeHtml(k)}.</p>` : ''}

<h2>Modules</h2>
<p>${escapeHtml(`${words} in ${modules}. A word that belongs to several modules is in the deck once. Each module opens AnkiGen with just that module chosen; you can add more there.`)}</p>
${groups.map((g) => `<h3>${escapeHtml(g.name)}</h3>\n<ul class="lp-mods">\n${g.modules.map((m) => moduleHtml(pair, m, appHref([m.id]), l)).join('\n')}\n</ul>`).join('\n')}

<h2>How it works</h2>
<ol>
<li>Choose the modules you want. Each one says how many words it has for ${escapeHtml(same ? l : `${l} and ${k}`)}.</li>
<li>Choose what each card shows, and on which side. The preview shows real cards as you go.</li>
<li>Download the .apkg file and open it with Anki (File → Import), or tap it on your phone to open it in AnkiDroid.</li>
</ol>
<p>${escapeHtml(UPDATE_HELP.intro)}</p>

<h2>About the vocabulary</h2>
<p>${escapeHtml(DRAFT_HELP[0])} If something looks wrong, select it on a preview card in AnkiGen and press Ctrl+Enter (⌘+Enter on a Mac), or use the Feedback button there. Every report helps fix the deck for everyone.</p>

${moreHtml(pair, list, meta)}`;
  return pageHtml({ meta, dir: pair.dir, title, description, trail: [{ name: 'Decks', dir: DECKS_DIR }, { name: pair.name, dir: pair.dir }], body });
}

/**
 * Categories with the modules that have words for the pair, in tree order.
 * @param {any} meta @param {Map<string, number>} counts
 * @returns {{ name: string, modules: { id: string, name: string, desc: string, adult?: boolean, words: number }[] }[]}
 */
function moduleGroups(meta, counts) {
  return meta.modules.categories
    .map((/** @type {any} */ cat) => ({
      name: cat.name,
      modules: cat.modules.filter((/** @type {any} */ m) => counts.get(m.id)).map((/** @type {any} */ m) => ({ ...m, words: counts.get(m.id) })),
    }))
    .filter((/** @type {any} */ g) => g.modules.length);
}

/**
 * The field rows and deck options the app shows for the pair, with their help text; not the word and its
 * translation, which every card has.
 * @param {Pair} pair @param {any} meta
 */
function fieldsHtml(pair, meta) {
  const rows = meta.fields.fields.filter((/** @type {any} */ def) => !def.fixed && isFieldShown(def, pair.ctx.config));
  const options = meta.fields.deckOptions.filter((/** @type {any} */ o) => !o.langs || o.langs.includes(pair.learn) || o.langs.includes(pair.know));
  const items = [...rows, ...options].map((/** @type {any} */ d) => `<dt>${escapeHtml(d.label)}</dt><dd>${escapeHtml(d.help)}</dd>`);
  return `<dl class="lp-fields">\n${items.join('\n')}\n</dl>`;
}

/**
 * A module with its word count, description, sample words and the words only the learned language has.
 * @param {Pair} pair @param {{ id: string, name: string, desc: string, adult?: boolean, words: number }} m @param {string} href @param {string} learnName
 */
function moduleHtml(pair, m, href, learnName) {
  const badge = m.adult ? ' <span class="badge">18+</span>' : '';
  const picks = samples(pair, m.id);
  const list = picks.length ? `\n<ul class="lp-words" aria-label="Sample words">${picks.map((note) => sampleHtml(note, pair.ctx)).join('')}</ul>` : '';
  const local = pair.local.get(m.id);
  const localText = local ? `\n<p class="lp-local">${escapeHtml(localTermsHelp(local.count, local.example, learnName))}</p>` : '';
  return `<li class="lp-mod">
<h4><a href="${href}">${escapeHtml(m.name)}</a>${badge} <span class="lp-count">${count(m.words, 'word')}</span></h4>
<p>${escapeHtml(m.desc)}</p>${list}${localText}
</li>`;
}

/**
 * Up to SAMPLES notes of a module. Its own words (from its concept file) show it best, and of those the ones
 * with a single meaning; words it shares with other modules (Core words come first in canonical order) and
 * merged notes (one word for several concepts) only fill up.
 * @param {Pair} pair @param {string} module
 */
function samples(pair, module) {
  /** @type {Note[][]} own single-meaning, own merged, shared */
  const tiers = [[], [], []];
  for (const note of pair.pool) {
    if (!note.modules.includes(module)) continue;
    const own = note.conceptIds.some((id) => pair.ctx.concepts.byId.get(id)?.module === module);
    tiers[own ? (note.conceptIds.length === 1 ? 0 : 1) : 2].push(note);
  }
  /** @type {Note[]} */
  const picked = [];
  for (const tier of tiers) picked.push(...spread(tier, SAMPLES - picked.length));
  return picked;
}

/** Up to n of the notes, spread evenly from the first one. @param {Note[]} notes @param {number} n */
function spread(notes, n) {
  const k = Math.min(n, notes.length);
  return Array.from({ length: k }, (_, i) => notes[Math.floor((i * notes.length) / k)]);
}

/** "word (caption) — translation", as the app's word list shows it. @param {Note} note @param {import('../src/deck/fields.js').DeckContext} ctx */
function sampleHtml(note, ctx) {
  const s = noteSummary(note, ctx);
  const caption = s.disambig ? ` <span class="lp-dis" lang="${ctx.know.tag}">(${escapeHtml(s.disambig)})</span>` : '';
  return `<li><span lang="${ctx.learn.tag}">${escapeHtml(s.word)}</span>${caption} — <span class="lp-tr" lang="${ctx.know.tag}">${escapeHtml(s.translation)}</span></li>`;
}

/** Links to the other pages for the same speakers and for the same learned language. @param {Pair} pair @param {Pair[]} list @param {any} meta */
function moreHtml(pair, list, meta) {
  const l = nameOf(meta, pair.learn);
  const link = (/** @type {Pair} */ p, /** @type {string} */ text) => `<li><a href="../${p.dir.slice(DECKS_DIR.length)}">${escapeHtml(text)}</a></li>`;
  const sameLearn = list.filter((p) => p.learn === pair.learn && p !== pair);
  const forLearn = sameLearn.map((p) => link(p, p.know === SAME ? 'Monolingual' : `${nameOf(meta, p.know)} speakers`));
  const others =
    pair.know === SAME
      ? { heading: 'More monolingual decks', items: list.filter((p) => p.know === SAME && p !== pair).map((p) => link(p, nameOf(meta, p.learn))) }
      : { heading: `More decks for ${nameOf(meta, pair.know)} speakers`, items: list.filter((p) => p.know === pair.know && p !== pair).map((p) => link(p, nameOf(meta, p.learn))) };
  const sections = [others, { heading: `${l} for speakers of other languages`, items: forLearn }]
    .filter((s) => s.items.length)
    .map((s) => `<h3>${escapeHtml(s.heading)}</h3>\n<ul class="lp-pairs">${s.items.join('')}</ul>\n`);
  return `<h2>More decks</h2>\n${sections.join('')}<p><a href="../">All decks by language pair</a></p>`;
}

/** The hub: every page, by the language you speak, then the monolingual decks. @param {Pair[]} list @param {any} meta */
function hubHtml(list, meta) {
  const active = /** @type {string[]} */ (meta.languages.active);
  const link = (/** @type {Pair} */ p) => `<li><a href="${p.dir.slice(DECKS_DIR.length)}">${escapeHtml(nameOf(meta, p.learn))}</a></li>`;
  const sections = active
    .map((know) => {
      const pages = list.filter((p) => p.know === know);
      if (!pages.length) return '';
      const reg = meta.languages.languages[know];
      const native = reg.native !== reg.name ? ` <span class="lp-native" lang="${langTag(reg, know, 'cyrl')}">${escapeHtml(reg.native)}</span>` : '';
      return `<h2>For ${escapeHtml(reg.name)} speakers${native}</h2>\n<ul class="lp-pairs">${pages.map(link).join('')}</ul>`;
    })
    .filter(Boolean);
  const mono = list.filter((p) => p.know === SAME);
  if (mono.length) sections.push(`<h2>Monolingual decks</h2>\n<p>${escapeHtml(SAME_HELP)}</p>\n<ul class="lp-pairs">${mono.map(link).join('')}</ul>`);

  const languages = active.filter((code) => list.some((p) => p.learn === code || p.know === code));
  const pairCount = list.length - mono.length;
  const decks = [pairCount ? count(pairCount, 'language pair') : '', mono.length ? count(mono.length, 'monolingual deck') : ''].filter(Boolean).join(' and ');
  const description = `Free Anki vocabulary decks: ${decks}, in ${count(languages.length, 'language')}. Each page lists its deck’s modules with sample words.`;
  const body = `<h1>Decks by language pair</h1>
<p class="lede">Pick the language you speak, then the one you’re learning.</p>
<p>${escapeHtml(description)} Every deck is built in your browser, with no account and nothing to install.</p>
${sections.join('\n')}`;
  return pageHtml({ meta, dir: DECKS_DIR, title: 'Anki vocabulary decks by language pair — AnkiGen', description, trail: [{ name: 'Decks', dir: DECKS_DIR }], body });
}

/** @param {string[]} dirs relative to the site root */
function sitemapXml(dirs) {
  const urls = dirs.map((dir) => `  <url>\n    <loc>${escapeHtml(SITE_URL + dir)}</loc>\n  </url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
}
