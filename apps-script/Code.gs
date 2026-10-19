/**
 * HoP Nola Heart Meter: backend.
 *
 * Lives in a Google Sheet (Extensions > Apps Script). The GitHub Pages site
 * reads with GET and writes with POST. Writes need the team code, stored in
 * Project Settings > Script Properties as TEAM_CODE.
 *
 * Sheets it uses (created on first run if missing):
 *   Donations: id, createdAt, date, leader, donor, amount, event, note, received, thanked
 *   Outreach:  id, createdAt, date, leader, org, how, status, note
 *   Settings:  key, value   (goal = 2000, leaders = comma separated names)
 *   Log:       every write, with the full row of anything deleted (audit trail)
 *
 * Security: writes need TEAM_CODE; after 25 wrong codes in 10 minutes all
 * writes pause for 10 minutes; text that would start a formula is stored as
 * plain text; nothing here can edit Settings or the script.
 */

const HEADERS = {
  Donations: ['id', 'createdAt', 'date', 'leader', 'donor', 'amount', 'event', 'note', 'received', 'thanked'],
  Outreach: ['id', 'createdAt', 'date', 'leader', 'org', 'how', 'status', 'note'],
  Settings: ['key', 'value'],
  Log: ['at', 'action', 'kind', 'id', 'detail'],
};
const DEFAULT_LEADERS = 'Ava, Bishop, Catherine, Ceci, Charlotte, Ella, Emerson, Kate, Lesley, Libby, Maddie, Maeve, Mary Claire, Philip, Sophie, Teresa, Yve';
const STATUSES = ['contacted', 'waiting', 'yes', 'no'];

function sheet_(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(HEADERS[name]);
    sh.setFrozenRows(1);
  }
  return sh;
}

function rows_(name) {
  const values = sheet_(name).getDataRange().getValues();
  const head = values.shift();
  return values.filter(r => r[0] !== '').map(r => {
    const o = {};
    head.forEach((h, i) => { o[h] = r[i] instanceof Date ? Utilities.formatDate(r[i], 'America/Chicago', 'yyyy-MM-dd') : r[i]; });
    return o;
  });
}

function settings_() {
  const s = {};
  rows_('Settings').forEach(r => { s[r.key] = r.value; });
  return {
    goal: Number(s.goal) || 2000,
    leaders: String(s.leaders || DEFAULT_LEADERS).split(',').map(x => x.trim()).filter(Boolean),
  };
}

function log_(action, kind, id, detail) {
  sheet_('Log').appendRow([new Date().toISOString(), action, kind, id, clean_(JSON.stringify(detail || {}), 2000)]);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function clean_(v, max) {
  const t = String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max || 200);
  // A cell that starts with = + - @ would run as a formula in Sheets.
  return /^[=+\-@]/.test(t) ? "'" + t : t;
}

function date_(v) {
  const t = String(v || '');
  return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : Utilities.formatDate(new Date(), 'America/Chicago', 'yyyy-MM-dd');
}

function tooManyWrongCodes_() {
  return Number(CacheService.getScriptCache().get('wrong') || 0) >= 25;
}

function countWrongCode_() {
  const c = CacheService.getScriptCache();
  c.put('wrong', String(Number(c.get('wrong') || 0) + 1), 600);
}

function doGet() {
  const donations = rows_('Donations').map(d => Object.assign(d, {
    amount: Number(d.amount) || 0,
    received: d.received === true || d.received === 'TRUE',
    thanked: d.thanked === true || d.thanked === 'TRUE',
  }));
  return json_({ ok: true, settings: settings_(), donations: donations, outreach: rows_('Outreach') });
}

function doPost(e) {
  let body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: 'bad_request' }); }

  if (tooManyWrongCodes_()) return json_({ ok: false, error: 'paused' });
  const code = PropertiesService.getScriptProperties().getProperty('TEAM_CODE');
  if (!code || String(body.code == null ? '' : body.code).trim().toLowerCase() !== String(code).trim().toLowerCase()) {
    countWrongCode_();
    return json_({ ok: false, error: 'wrong_code' });
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const s = settings_();
    const now = new Date().toISOString();
    const a = body.action;

    if (a === 'check') return json_({ ok: true });

    if (a === 'add_donation') {
      const amount = Math.round(Number(body.amount) * 100) / 100;
      if (s.leaders.indexOf(body.leader) < 0) return json_({ ok: false, error: 'unknown_leader' });
      if (!(amount > 0) || amount > 1000000) return json_({ ok: false, error: 'bad_amount' });
      const id = Utilities.getUuid();
      sheet_('Donations').appendRow([id, now, date_(body.date), body.leader, clean_(body.donor, 120), amount,
        clean_(body.event, 60), clean_(body.note), !!body.received, !!body.thanked]);
      log_('add', 'donation', id, { leader: body.leader, amount: amount });
      return json_({ ok: true, id: id });
    }

    if (a === 'add_outreach') {
      if (s.leaders.indexOf(body.leader) < 0) return json_({ ok: false, error: 'unknown_leader' });
      if (STATUSES.indexOf(body.status) < 0) return json_({ ok: false, error: 'bad_status' });
      const id = Utilities.getUuid();
      sheet_('Outreach').appendRow([id, now, date_(body.date), body.leader, clean_(body.org, 120),
        clean_(body.how, 40), body.status, clean_(body.note)]);
      log_('add', 'outreach', id, { leader: body.leader });
      return json_({ ok: true, id: id });
    }

    if (a === 'toggle' || a === 'move' || a === 'delete') {
      const name = body.kind === 'outreach' ? 'Outreach' : 'Donations';
      const sh = sheet_(name);
      const ids = sh.getRange(1, 1, sh.getLastRow(), 1).getValues().map(r => r[0]);
      const row = ids.indexOf(body.id) + 1;
      if (row < 2) return json_({ ok: false, error: 'not_found' });
      if (a === 'delete') {
        log_('delete', body.kind, body.id, sh.getRange(row, 1, 1, sh.getLastColumn()).getValues()[0]);
        sh.deleteRow(row);
        return json_({ ok: true });
      }
      if (a === 'toggle' && name === 'Donations' && (body.field === 'received' || body.field === 'thanked')) {
        const col = HEADERS.Donations.indexOf(body.field) + 1;
        sh.getRange(row, col).setValue(!!body.value);
        log_('toggle', 'donation', body.id, { field: body.field, value: !!body.value });
        return json_({ ok: true });
      }
      if (a === 'move' && name === 'Outreach' && STATUSES.indexOf(body.status) >= 0) {
        sh.getRange(row, HEADERS.Outreach.indexOf('status') + 1).setValue(body.status);
        log_('move', 'outreach', body.id, { status: body.status });
        return json_({ ok: true });
      }
      return json_({ ok: false, error: 'bad_request' });
    }

    return json_({ ok: false, error: 'unknown_action' });
  } finally {
    lock.releaseLock();
  }
}

/** Run once from the editor: creates the three sheets and the 2027 roster. */
function setup() {
  ['Donations', 'Outreach', 'Settings', 'Log'].forEach(sheet_);
  const sh = sheet_('Settings');
  if (sh.getLastRow() < 2) {
    sh.appendRow(['goal', 2000]);
    sh.appendRow(['leaders', DEFAULT_LEADERS]);
  }
  SpreadsheetApp.flush();
}
