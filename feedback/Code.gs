/**
 * AnkiGen feedback endpoint — Google Apps Script web app bound to a Google Sheet.
 * Setup: docs/FEEDBACK.md. Deploy as Web app → Execute as: Me → Who has access: Anyone.
 *
 * The page POSTs JSON with Content-Type text/plain (no CORS preflight). Every report becomes one row.
 * Server-side defenses (the client-side limits are only friction):
 *   - payload size cap, field length caps, schema check
 *   - honeypot field "website" (bots fill it; we answer ok and drop it)
 *   - per-client cap per rolling 6 hours (CacheService)
 *   - global cap per UTC day (ScriptProperties)
 *   - formula-injection guard on every cell
 */

var SHEET_NAME = 'Reports';
var MAX_BODY_CHARS = 8000;
var DAILY_GLOBAL_CAP = 2000;
var PER_CLIENT_CAP_6H = 30;

var COLUMNS = [
  ['received_at', null],
  ['client_time', 40],
  ['tz_offset_min', 8],
  ['client_id', 64],
  ['category', 32],
  ['message', 4000],
  ['email', 254],
  ['selected_text', 1000],
  ['concept_id', 80],
  ['direction', 16],
  ['side', 16],
  ['field', 40],
  ['learning', 12],
  ['known', 12],
  ['config_url', 1000],
  ['app_version', 40],
  ['data_version', 40],
  ['browser_lang', 40],
  ['status', null],
  ['notes', null]
];

var KEY_MAP = {
  client_time: 'clientTime', tz_offset_min: 'tzOffsetMin', client_id: 'clientId', category: 'category',
  message: 'message', email: 'email', selected_text: 'selectedText', concept_id: 'conceptId',
  direction: 'direction', side: 'side', field: 'field', learning: 'learning', known: 'known',
  config_url: 'configUrl', app_version: 'appVersion', data_version: 'dataVersion', browser_lang: 'browserLang'
};

function doGet() {
  return json_({ ok: true, service: 'ankigen-feedback' });
}

function doPost(e) {
  try {
    var raw = (e && e.postData && e.postData.contents) || '';
    if (raw.length > MAX_BODY_CHARS) return json_({ ok: false, error: 'too_large' });
    var d;
    try { d = JSON.parse(raw); } catch (err) { return json_({ ok: false, error: 'bad_json' }); }
    if (!d || typeof d !== 'object') return json_({ ok: false, error: 'bad_json' });

    if (d.website) return json_({ ok: true }); // honeypot: pretend success

    var message = str_(d.message, 4000);
    if (!message.replace(/\s/g, '')) return json_({ ok: false, error: 'empty' });
    var clientId = str_(d.clientId, 64);
    if (!/^[A-Za-z0-9-]{8,64}$/.test(clientId)) return json_({ ok: false, error: 'bad_client' });
    var email = str_(d.email, 254);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json_({ ok: false, error: 'bad_email' });

    var lock = LockService.getScriptLock();
    if (!lock.tryLock(10000)) return json_({ ok: false, error: 'busy' });
    try {
      var props = PropertiesService.getScriptProperties();
      var day = Utilities.formatDate(new Date(), 'UTC', 'yyyy-MM-dd');
      var gKey = 'g:' + day;
      var g = Number(props.getProperty(gKey) || 0);
      if (g >= DAILY_GLOBAL_CAP) return json_({ ok: false, error: 'daily_cap' });

      var cache = CacheService.getScriptCache();
      var cKey = 'c:' + clientId;
      var c = Number(cache.get(cKey) || 0);
      if (c >= PER_CLIENT_CAP_6H) return json_({ ok: false, error: 'client_cap' });

      var row = COLUMNS.map(function (col) {
        var name = col[0], max = col[1];
        if (name === 'received_at') return new Date();
        if (name === 'status' || name === 'notes') return '';
        if (name === 'message') return safe_(message);
        if (name === 'email') return safe_(email);
        return safe_(str_(d[KEY_MAP[name]], max));
      });
      sheet_().appendRow(row);

      if (g === 0) cleanupCounters_(props, gKey);
      props.setProperty(gKey, String(g + 1));
      cache.put(cKey, String(c + 1), 21600); // 6 h
    } finally {
      lock.releaseLock();
    }
    return json_({ ok: true });
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: 'server' });
  }
}

function sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(COLUMNS.map(function (c) { return c[0]; }));
    sh.setFrozenRows(1);
  }
  return sh;
}

function str_(v, max) {
  if (v === null || v === undefined) return '';
  var s = String(v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim();
  return max ? s.slice(0, max) : s;
}

// Prevent formula injection: Sheets treats cells starting with = + - @ as formulas.
function safe_(s) {
  if (typeof s !== 'string') return s;
  return /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
}

function cleanupCounters_(props, keepKey) {
  var all = props.getProperties();
  Object.keys(all).forEach(function (k) {
    if (k.indexOf('g:') === 0 && k !== keepKey) props.deleteProperty(k);
  });
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/** Run once from the editor to create the sheet header and grant permissions. */
function setup() {
  sheet_();
  Logger.log('Sheet "' + SHEET_NAME + '" ready.');
}
