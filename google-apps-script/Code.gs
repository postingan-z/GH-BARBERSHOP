/**
 * ============================================================
 * SISTEM BOOKING ONLINE - BACKEND (Google Apps Script)
 * ============================================================
 * Deploy sebagai Web App:
 *  Deploy > New deployment > Type: Web app
 *  Execute as: Me
 *  Who has access: Anyone
 *
 * Setelah deploy, copy URL /exec ke assets/js/config.js (API_URL)
 * ============================================================
 */

// ------------------------------------------------------------
// KONFIGURASI SHEET
// ------------------------------------------------------------
const SHEET_BOOKINGS = 'BOOKINGS';
const SHEET_SETTINGS = 'SETTINGS';
const SHEET_SERVICES = 'SERVICES';
const SHEET_ADMIN    = 'ADMIN';
const SHEET_LOGS     = 'LOGS';

const BOOKINGS_HEADERS = [
  'Booking ID', 'Nama', 'WhatsApp', 'Tanggal', 'Jam', 'Jumlah',
  'Layanan', 'Catatan', 'Status', 'Tanggal Baru', 'Jam Baru',
  'Alasan', 'Created At', 'Updated At'
];

function ss_() {
  return SpreadsheetApp.getActiveSpreadsheet();
}
function sheet_(name) {
  const sh = ss_().getSheetByName(name);
  if (!sh) throw new Error('Sheet "' + name + '" tidak ditemukan. Jalankan setupSheets() dulu.');
  return sh;
}

// ------------------------------------------------------------
// ENTRY POINTS (doGet / doPost)
// ------------------------------------------------------------
function doGet(e) {
  return handleRequest_(e);
}
function doPost(e) {
  return handleRequest_(e);
}

function handleRequest_(e) {
  try {
    const params = parseParams_(e);
    const action = params.action;

    let result;
    switch (action) {
      case 'getBookings':
        result = getBookings(params);
        break;
      case 'getBookingById':
        result = getBookingById(params.bookingId, params.whatsapp);
        break;
      case 'getAvailability':
        result = getAvailability(params.tanggal);
        break;
      case 'getServices':
        result = getServices();
        break;
      case 'getSettings':
        result = getSettingsPublic_();
        break;
      case 'createBooking':
        result = createBooking(params);
        break;
      case 'confirmBooking':
        checkAdmin_(params);
        result = updateBookingStatus_(params.bookingId, 'CONFIRMED', params);
        break;
      case 'rescheduleBooking':
        checkAdmin_(params);
        result = rescheduleBooking(params);
        break;
      case 'cancelBooking':
        checkAdmin_(params);
        result = updateBookingStatus_(params.bookingId, 'CANCELLED', params);
        break;
      case 'rejectBooking':
        checkAdmin_(params);
        result = updateBookingStatus_(params.bookingId, 'REJECTED', params);
        break;
      case 'completeBooking':
        checkAdmin_(params);
        result = updateBookingStatus_(params.bookingId, 'COMPLETED', params);
        break;
      case 'adminLogin':
        result = adminLogin(params.password);
        break;
      case 'getDashboard':
        checkAdmin_(params);
        result = getDashboardStats();
        break;
      default:
        result = { success: false, message: 'Action tidak dikenali: ' + action };
    }
    return jsonResponse_(result);
  } catch (err) {
    return jsonResponse_({ success: false, message: 'Server error: ' + err.message });
  }
}

function parseParams_(e) {
  const params = {};
  if (e && e.parameter) {
    Object.keys(e.parameter).forEach(function (k) { params[k] = e.parameter[k]; });
  }
  if (e && e.postData && e.postData.contents) {
    try {
      const body = JSON.parse(e.postData.contents);
      Object.keys(body).forEach(function (k) { params[k] = body[k]; });
    } catch (err) {
      // postData bukan JSON, abaikan (biarkan pakai e.parameter saja)
    }
  }
  return params;
}

function jsonResponse_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ------------------------------------------------------------
// ADMIN AUTH (sederhana, disimpan di Script Properties)
// ------------------------------------------------------------
function adminLogin(password) {
  const stored = PropertiesService.getScriptProperties().getProperty('ADMIN_PASSWORD');
  if (!stored) {
    return { success: false, message: 'ADMIN_PASSWORD belum diset. Jalankan setAdminPassword("bos210514") di editor.' };
  }
  if (password === stored) {
    const token = Utilities.getUuid();
    // token sederhana disimpan sementara 12 jam di CacheService
    CacheService.getScriptCache().put('token_' + token, 'valid', 60 * 60 * 12);
    return { success: true, token: token };
  }
  return { success: false, message: 'Password salah.' };
}

function checkAdmin_(params) {
  const token = params.token;
  if (!token) throw new Error('Unauthorized: token admin tidak ada.');
  const cached = CacheService.getScriptCache().get('token_' + token);
  if (cached !== 'valid') throw new Error('Unauthorized: sesi admin tidak valid, silakan login ulang.');
}

/** Jalankan sekali secara manual dari editor Apps Script untuk set password admin. */
function setAdminPassword(password) {
  PropertiesService.getScriptProperties().setProperty('ADMIN_PASSWORD', password);
}

// ------------------------------------------------------------
// SETTINGS & SERVICES
// ------------------------------------------------------------
function getSettingsPublic_() {
  const sh = sheet_(SHEET_SETTINGS);
  const data = sh.getDataRange().getValues();
  const settings = {};
  for (let i = 1; i < data.length; i++) {
    if (data[i][0]) settings[data[i][0]] = data[i][1];
  }
  return {
    success: true,
    settings: {
      maxPerSlot: Number(settings['Maximum booking per slot'] || 3),
      jamBuka: settings['Jam buka'] || '09:00',
      jamTutup: settings['Jam tutup'] || '17:00',
      intervalSlot: Number(settings['Interval slot'] || 60)
    }
  };
}

function getServices() {
  const sh = sheet_(SHEET_SERVICES);
  const data = sh.getDataRange().getValues();
  const list = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][0]) list.push({ nama: data[i][0], durasi: data[i][1], harga: data[i][2] });
  }
  return { success: true, services: list };
}

// ------------------------------------------------------------
// GENERATE SLOT (berdasarkan SETTINGS)
// ------------------------------------------------------------
function generateSlots_() {
  const s = getSettingsPublic_().settings;
  const slots = [];
  const [openH, openM] = s.jamBuka.split(':').map(Number);
  const [closeH, closeM] = s.jamTutup.split(':').map(Number);
  let cursor = openH * 60 + openM;
  const end = closeH * 60 + closeM;
  while (cursor < end) {
    const h = Math.floor(cursor / 60);
    const m = cursor % 60;
    slots.push(Utilities.formatString('%02d:%02d', h, m));
    cursor += s.intervalSlot;
  }
  return slots;
}

// ------------------------------------------------------------
// AVAILABILITY
// ------------------------------------------------------------
function getAvailability(tanggal) {
  if (!tanggal) return { success: false, message: 'Tanggal wajib diisi.' };
  const s = getSettingsPublic_().settings;
  const slots = generateSlots_();
  const sh = sheet_(SHEET_BOOKINGS);
  const data = sh.getDataRange().getValues();
  const idx = headerIndex_();

  // hitung jumlah booking aktif (bukan CANCELLED/REJECTED) per jam pada tanggal tsb
  const counts = {};
  slots.forEach(function (sl) { counts[sl] = 0; });

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const rowTanggal = formatDate_(row[idx['Tanggal']]);
    const rowJam = row[idx['Jam']];
    const status = row[idx['Status']];
    if (rowTanggal === tanggal && counts.hasOwnProperty(rowJam) && status !== 'CANCELLED' && status !== 'REJECTED') {
      counts[rowJam] = counts[rowJam] + 1;
    }
  }

  const availability = slots.map(function (sl) {
    const used = counts[sl] || 0;
    const sisa = Math.max(0, s.maxPerSlot - used);
    return { jam: sl, kapasitas: s.maxPerSlot, terisi: used, sisa: sisa, penuh: sisa <= 0 };
  });

  return { success: true, tanggal: tanggal, availability: availability };
}

function formatDate_(val) {
  if (val instanceof Date) {
    return Utilities.formatDate(val, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return String(val);
}

function headerIndex_() {
  const idx = {};
  BOOKINGS_HEADERS.forEach(function (h, i) { idx[h] = i; });
  return idx;
}

// ------------------------------------------------------------
// CREATE BOOKING (dengan LockService anti double-booking)
// ------------------------------------------------------------
function createBooking(params) {
  const required = ['nama', 'whatsapp', 'tanggal', 'jam', 'jumlah', 'layanan'];
  for (const f of required) {
    if (!params[f]) return { success: false, message: 'Field "' + f + '" wajib diisi.' };
  }

  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000); // tunggu maksimal 15 detik
  } catch (err) {
    return { success: false, message: 'Server sedang sibuk, silakan coba lagi.' };
  }

  try {
    // Cek availability SEKALI LAGI di backend (jangan percaya frontend)
    const s = getSettingsPublic_().settings;
    const sh = sheet_(SHEET_BOOKINGS);
    const data = sh.getDataRange().getValues();
    const idx = headerIndex_();

    let used = 0;
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (formatDate_(row[idx['Tanggal']]) === params.tanggal &&
          row[idx['Jam']] === params.jam &&
          row[idx['Status']] !== 'CANCELLED' &&
          row[idx['Status']] !== 'REJECTED') {
        used++;
      }
    }

    if (used >= s.maxPerSlot) {
      return { success: false, message: 'Maaf, slot tersebut baru saja penuh. Silakan pilih waktu lainnya.' };
    }

    // generate Booking ID: BK-yyyyMMdd-000x
    const bookingId = generateBookingId_(sh, idx);
    const now = new Date();

    sh.appendRow([
      bookingId,
      params.nama,
      params.whatsapp,
      params.tanggal,
      params.jam,
      params.jumlah,
      params.layanan,
      params.catatan || '',
      'PENDING',
      '', '', '',
      now,
      now
    ]);

    writeLog_(bookingId, 'Created', 'Booking baru dibuat oleh ' + params.nama);

    return {
      success: true,
      booking: {
        bookingId: bookingId,
        status: 'PENDING',
        nama: params.nama,
        tanggal: params.tanggal,
        jam: params.jam
      }
    };
  } finally {
    lock.releaseLock();
  }
}

function generateBookingId_(sh, idx) {
  const tz = Session.getScriptTimeZone();
  const todayStr = Utilities.formatDate(new Date(), tz, 'yyyyMMdd');
  const prefix = 'BK-' + todayStr + '-';

  const data = sh.getDataRange().getValues();
  let maxSeq = 0;
  for (let i = 1; i < data.length; i++) {
    const id = String(data[i][idx['Booking ID']] || '');
    if (id.indexOf(prefix) === 0) {
      const seq = parseInt(id.substring(prefix.length), 10);
      if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
    }
  }
  const nextSeq = maxSeq + 1;
  return prefix + Utilities.formatString('%04d', nextSeq);
}

// ------------------------------------------------------------
// GET BOOKINGS (untuk admin) & GET BY ID (untuk customer)
// ------------------------------------------------------------
function findRow_(bookingId) {
  const sh = sheet_(SHEET_BOOKINGS);
  const data = sh.getDataRange().getValues();
  const idx = headerIndex_();
  for (let i = 1; i < data.length; i++) {
    if (data[i][idx['Booking ID']] === bookingId) {
      return { sheet: sh, rowNum: i + 1, row: data[i], idx: idx };
    }
  }
  return null;
}

function rowToObject_(row, idx) {
  const obj = {};
  BOOKINGS_HEADERS.forEach(function (h) {
    let val = row[idx[h]];
    if (val instanceof Date) {
      val = Utilities.formatDate(val, Session.getScriptTimeZone(),
        (h === 'Tanggal' || h === 'Tanggal Baru') ? 'yyyy-MM-dd' : 'yyyy-MM-dd HH:mm:ss');
    }
    obj[camelKey_(h)] = val;
  });
  return obj;
}

function camelKey_(header) {
  const map = {
    'Booking ID': 'bookingId', 'Nama': 'nama', 'WhatsApp': 'whatsapp',
    'Tanggal': 'tanggal', 'Jam': 'jam', 'Jumlah': 'jumlah', 'Layanan': 'layanan',
    'Catatan': 'catatan', 'Status': 'status', 'Tanggal Baru': 'tanggalBaru',
    'Jam Baru': 'jamBaru', 'Alasan': 'alasan', 'Created At': 'createdAt', 'Updated At': 'updatedAt'
  };
  return map[header] || header;
}

function getBookings(params) {
  // dipakai admin dashboard - butuh token
  checkAdmin_(params);
  const sh = sheet_(SHEET_BOOKINGS);
  const data = sh.getDataRange().getValues();
  const idx = headerIndex_();
  const list = [];
  for (let i = 1; i < data.length; i++) {
    list.push(rowToObject_(data[i], idx));
  }
  list.sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
  return { success: true, bookings: list };
}

function getBookingById(bookingId, whatsapp) {
  if (!bookingId || !whatsapp) return { success: false, message: 'Booking ID dan No. WhatsApp wajib diisi.' };
  const found = findRow_(bookingId);
  if (!found) return { success: false, message: 'Booking tidak ditemukan.' };
  const obj = rowToObject_(found.row, found.idx);
  if (String(obj.whatsapp).replace(/\D/g, '') !== String(whatsapp).replace(/\D/g, '')) {
    return { success: false, message: 'Nomor WhatsApp tidak cocok dengan data booking.' };
  }
  return { success: true, booking: obj };
}

// ------------------------------------------------------------
// UPDATE STATUS (confirm / cancel / reject / complete)
// ------------------------------------------------------------
function updateBookingStatus_(bookingId, newStatus, params) {
  const found = findRow_(bookingId);
  if (!found) return { success: false, message: 'Booking tidak ditemukan.' };

  const idx = found.idx;
  const now = new Date();
  found.sheet.getRange(found.rowNum, idx['Status'] + 1).setValue(newStatus);
  found.sheet.getRange(found.rowNum, idx['Updated At'] + 1).setValue(now);
  if (params && params.alasan) {
    found.sheet.getRange(found.rowNum, idx['Alasan'] + 1).setValue(params.alasan);
  }

  writeLog_(bookingId, newStatus, 'Status diubah menjadi ' + newStatus);

  const updatedRow = found.sheet.getRange(found.rowNum, 1, 1, BOOKINGS_HEADERS.length).getValues()[0];
  return { success: true, booking: rowToObject_(updatedRow, idx) };
}

function rescheduleBooking(params) {
  const found = findRow_(params.bookingId);
  if (!found) return { success: false, message: 'Booking tidak ditemukan.' };
  if (!params.tanggalBaru || !params.jamBaru) {
    return { success: false, message: 'Tanggal baru dan jam baru wajib diisi.' };
  }

  const idx = found.idx;
  const now = new Date();
  found.sheet.getRange(found.rowNum, idx['Tanggal Baru'] + 1).setValue(params.tanggalBaru);
  found.sheet.getRange(found.rowNum, idx['Jam Baru'] + 1).setValue(params.jamBaru);
  found.sheet.getRange(found.rowNum, idx['Tanggal'] + 1).setValue(params.tanggalBaru);
  found.sheet.getRange(found.rowNum, idx['Jam'] + 1).setValue(params.jamBaru);
  found.sheet.getRange(found.rowNum, idx['Status'] + 1).setValue('RESCHEDULED');
  found.sheet.getRange(found.rowNum, idx['Updated At'] + 1).setValue(now);

  writeLog_(params.bookingId, 'Rescheduled', 'Dijadwalkan ulang ke ' + params.tanggalBaru + ' ' + params.jamBaru);

  const updatedRow = found.sheet.getRange(found.rowNum, 1, 1, BOOKINGS_HEADERS.length).getValues()[0];
  return { success: true, booking: rowToObject_(updatedRow, idx) };
}

// ------------------------------------------------------------
// DASHBOARD STATS
// ------------------------------------------------------------
function getDashboardStats() {
  const sh = sheet_(SHEET_BOOKINGS);
  const data = sh.getDataRange().getValues();
  const idx = headerIndex_();
  const stats = { total: 0, PENDING: 0, CONFIRMED: 0, RESCHEDULED: 0, CANCELLED: 0, REJECTED: 0, COMPLETED: 0 };
  for (let i = 1; i < data.length; i++) {
    stats.total++;
    const st = data[i][idx['Status']];
    if (stats.hasOwnProperty(st)) stats[st]++;
  }
  return { success: true, stats: stats };
}

// ------------------------------------------------------------
// LOGS
// ------------------------------------------------------------
function writeLog_(bookingId, action, detail) {
  try {
    const sh = sheet_(SHEET_LOGS);
    sh.appendRow([new Date(), bookingId, action, detail]);
  } catch (err) {
    // jangan sampai gagal log menghentikan proses utama
  }
}

// ------------------------------------------------------------
// SETUP OTOMATIS - jalankan sekali dari editor Apps Script
// ------------------------------------------------------------
function setupSheets() {
  const ss = ss_();

  // BOOKINGS
  let sh = ss.getSheetByName(SHEET_BOOKINGS) || ss.insertSheet(SHEET_BOOKINGS);
  sh.clear();
  sh.appendRow(BOOKINGS_HEADERS);
  sh.setFrozenRows(1);

  // SETTINGS
  sh = ss.getSheetByName(SHEET_SETTINGS) || ss.insertSheet(SHEET_SETTINGS);
  sh.clear();
  sh.appendRow(['Key', 'Value']);
  sh.appendRow(['Maximum booking per slot', 3]);
  sh.appendRow(['Jam buka', '09:00']);
  sh.appendRow(['Jam tutup', '17:00']);
  sh.appendRow(['Interval slot', 60]);
  sh.setFrozenRows(1);

  // SERVICES
  sh = ss.getSheetByName(SHEET_SERVICES) || ss.insertSheet(SHEET_SERVICES);
  sh.clear();
  sh.appendRow(['Nama Layanan', 'Durasi (menit)', 'Harga']);
  sh.appendRow(['Layanan A', 'Sampai Selesai', 100000]);
  sh.setFrozenRows(1);

  // ADMIN (opsional, catatan saja - password sesungguhnya di Script Properties)
  sh = ss.getSheetByName(SHEET_ADMIN) || ss.insertSheet(SHEET_ADMIN);
  sh.clear();
  sh.appendRow(['Catatan']);
  sh.appendRow(['Password admin diset lewat fungsi setAdminPassword() di editor Apps Script, BUKAN di sheet ini.']);

  // LOGS
  sh = ss.getSheetByName(SHEET_LOGS) || ss.insertSheet(SHEET_LOGS);
  sh.clear();
  sh.appendRow(['Timestamp', 'Booking ID', 'Action', 'Detail']);
  sh.setFrozenRows(1);

SpreadsheetApp.flush();
  Logger.log('Setup selesai.');
}

function jalankanSekali() {
  setAdminPassword("bos210514");
}
