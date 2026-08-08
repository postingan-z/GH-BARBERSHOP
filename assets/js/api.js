/**
 * API.JS - wrapper komunikasi ke Google Apps Script
 * GET dipakai untuk read-only, POST untuk aksi yang mengubah data.
 * Content-Type "text/plain" dipakai pada POST agar tidak memicu CORS preflight
 * (Apps Script Web App tidak menangani OPTIONS request).
 */
const API = {
  isOnline: true,

  async _get(action, params) {
    const url = new URL(CONFIG.API_URL);
    url.searchParams.set('action', action);
    Object.keys(params || {}).forEach(k => url.searchParams.set(k, params[k]));
    return this._request(url.toString(), { method: 'GET' });
  },

  async _post(action, params) {
    const body = JSON.stringify(Object.assign({ action }, params || {}));
    return this._request(CONFIG.API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body
    });
  },

  async _request(url, options) {
    try {
      const res = await fetch(url, options);
      const data = await res.json();
      this._setOnline(true);
      return data;
    } catch (err) {
      this._setOnline(false);
      return { success: false, message: 'Koneksi ke server gagal.' };
    }
  },

  _setOnline(status) {
    if (this.isOnline === status) return;
    this.isOnline = status;
    document.dispatchEvent(new CustomEvent('connection-change', { detail: { online: status } }));
  },

  // ---- Public (customer) ----
  getAvailability(tanggal) { return this._get('getAvailability', { tanggal }); },
  getServices() { return this._get('getServices'); },
  createBooking(data) { return this._post('createBooking', data); },
  getBookingById(bookingId, whatsapp) { return this._get('getBookingById', { bookingId, whatsapp }); },

  // ---- Admin ----
  adminLogin(password) { return this._post('adminLogin', { password }); },
  getDashboard(token) { return this._get('getDashboard', { token }); },
  getBookings(token) { return this._get('getBookings', { token }); },
  confirmBooking(bookingId, token) { return this._post('confirmBooking', { bookingId, token }); },
  rescheduleBooking(bookingId, tanggalBaru, jamBaru, token) {
    return this._post('rescheduleBooking', { bookingId, tanggalBaru, jamBaru, token });
  },
  cancelBooking(bookingId, alasan, token) { return this._post('cancelBooking', { bookingId, alasan, token }); },
  rejectBooking(bookingId, alasan, token) { return this._post('rejectBooking', { bookingId, alasan, token }); },
  completeBooking(bookingId, token) { return this._post('completeBooking', { bookingId, token }); }
};

/** Indikator koneksi kecil di pojok (LIVE / terputus) */
document.addEventListener('connection-change', (e) => {
  const el = document.getElementById('conn-indicator');
  if (!el) return;
  if (e.detail.online) {
    el.textContent = '● LIVE';
    el.className = 'conn-indicator online';
  } else {
    el.textContent = '⚠ Koneksi ke server terputus';
    el.className = 'conn-indicator offline';
  }
});

/** Helper polling generik: jalankan fn setiap interval, hormati tab tidak aktif tetap jalan ringan */
function startPolling(fn, intervalMs) {
  fn();
  return setInterval(fn, intervalMs || CONFIG.POLLING_INTERVAL_MS);
}

/** Toast notification sederhana */
function toast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const el = document.createElement('div');
  el.className = 'toast toast-' + type;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => el.classList.add('show'), 10);
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
  }, 3500);
}

/** WhatsApp click-to-chat */
function waLink(nomor, pesan) {
  const clean = String(nomor).replace(/\D/g, '');
  return 'https://wa.me/' + clean + '?text=' + encodeURIComponent(pesan);
}

const WA_TEMPLATES = {
  new: (b) => `Halo ${b.nama},\n\nTerima kasih, booking Anda telah kami terima.\n\nBooking ID: ${b.bookingId}\nTanggal: ${b.tanggal}\nJam: ${b.jam}\nStatus: PENDING\n\nKami akan segera konfirmasi.`,
  CONFIRMED: (b) => `Halo ${b.nama},\n\nBooking Anda telah DIKONFIRMASI.\n\nBooking ID: ${b.bookingId}\nTanggal: ${b.tanggal}\nJam: ${b.jam}\n\nTerima kasih.`,
  RESCHEDULED: (b) => `Halo ${b.nama},\n\nBooking Anda DIJADWALKAN ULANG.\n\nBooking ID: ${b.bookingId}\nTanggal baru: ${b.tanggal}\nJam baru: ${b.jam}\n\nMohon konfirmasi kehadiran Anda.`,
  CANCELLED: (b) => `Halo ${b.nama},\n\nBooking Anda telah DIBATALKAN.\n\nBooking ID: ${b.bookingId}\n\nMohon maaf atas ketidaknyamanannya.`,
  REJECTED: (b) => `Halo ${b.nama},\n\nMohon maaf, booking Anda TIDAK DAPAT diproses.\n\nBooking ID: ${b.bookingId}\nAlasan: ${b.alasan || '-'}\n\nSilakan hubungi kami untuk info lebih lanjut.`,
  COMPLETED: (b) => `Halo ${b.nama},\n\nTerima kasih telah menggunakan layanan kami. Booking Anda berstatus SELESAI.\n\nBooking ID: ${b.bookingId}`
};
