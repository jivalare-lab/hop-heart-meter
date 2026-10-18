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
 */

const HEADERS = {
  Donations: ['id', 'createdAt', 'date', 'leader', 'donor', 'amount', 'event', 'note', 'received', 'thanked'],
  Outreach: ['id', 'createdAt', 'date', 'leader', 'org', 'how', 'status', 'note'],
  Settings: ['key', 'value'],
};
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
    leaders: String(s.leaders || '').split(',').map(x => x.trim()).filter(Boolean),
  };
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function clean_(v, max) {
  return String(v == null ? '' : v).trim().slice(0, max || 200);
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

  const code = PropertiesService.getScriptProperties().getProperty('TEAM_CODE');
  if (!code || clean_(body.code, 100).toLowerCase() !== String(code).trim().toLowerCase()) {
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
      sheet_('Donations').appendRow([id, now, clean_(body.date, 10), body.leader, clean_(body.donor, 120), amount,
        clean_(body.event, 60), clean_(body.note), !!body.received, !!body.thanked]);
      return json_({ ok: true, id: id });
    }

    if (a === 'add_outreach') {
      if (s.leaders.indexOf(body.leader) < 0) return json_({ ok: false, error: 'unknown_leader' });
      if (STATUSES.indexOf(body.status) < 0) return json_({ ok: false, error: 'bad_status' });
      const id = Utilities.getUuid();
      sheet_('Outreach').appendRow([id, now, clean_(body.date, 10), body.leader, clean_(body.org, 120),
        clean_(body.how, 40), body.status, clean_(body.note)]);
      return json_({ ok: true, id: id });
    }

    if (a === 'toggle' || a === 'move' || a === 'delete') {
      const name = body.kind === 'outreach' ? 'Outreach' : 'Donations';
      const sh = sheet_(name);
      const ids = sh.getRange(1, 1, sh.getLastRow(), 1).getValues().map(r => r[0]);
      const row = ids.indexOf(body.id) + 1;
      if (row < 2) return json_({ ok: false, error: 'not_found' });
      if (a === 'delete') { sh.deleteRow(row); return json_({ ok: true }); }
      if (a === 'toggle' && name === 'Donations' && (body.field === 'received' || body.field === 'thanked')) {
        const col = HEADERS.Donations.indexOf(body.field) + 1;
        sh.getRange(row, col).setValue(!!body.value);
        return json_({ ok: true });
      }
      if (a === 'move' && name === 'Outreach' && STATUSES.indexOf(body.status) >= 0) {
        sh.getRange(row, HEADERS.Outreach.indexOf('status') + 1).setValue(body.status);
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
  ['Donations', 'Outreach', 'Settings'].forEach(sheet_);
  const sh = sheet_('Settings');
  if (sh.getLastRow() < 2) {
    sh.appendRow(['goal', 2000]);
    sh.appendRow(['leaders', 'Ava, Bishop, Catherine, Ceci, Charlotte, Ella, Emerson, Kate, Lesley, Libby, Maddie, Maeve, Mary Claire, Philip, Sophie, Teresa, Yve']);
  }
}
