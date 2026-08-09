/**
 * API.JS - wrapper komunikasi ke Google Apps Script
 * GET dipakai untuk read-only, POST untuk aksi yang mengubah data.
 * Content-Type "text/plain" dipakai pada POST agar tidak memicu CORS preflight
 * (Apps Script Web App tidak menangani OPTIONS request).
 * 
 * Dengan Local Storage Fallback jika API tidak tersedia
 */
const API = {
  isOnline: true,
  useFallback: true, // Gunakan Local Storage jika API gagal

  // ========== LOCAL STORAGE HELPERS ==========
  getBookingsFromStorage() {
    try {
      const data = localStorage.getItem('bookings_data');
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  },

  saveBookingsToStorage(bookings) {
    localStorage.setItem('bookings_data', JSON.stringify(bookings));
  },

  generateId() {
    return 'BK' + Date.now().toString(36).toUpperCase() + 
           Math.random().toString(36).substring(2, 5).toUpperCase();
  },

  // ========== CORE REQUEST ==========
  async _get(action, params) {
    const url = new URL(CONFIG.API_URL);
    url.searchParams.set('action', action);
    Object.keys(params || {}).forEach(k => url.searchParams.set(k, params[k]));
    return this._request(url.toString(), { method: 'GET' }, action, params);
  },

  async _post(action, params) {
    const body = JSON.stringify(Object.assign({ action }, params || {}));
    return this._request(CONFIG.API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body
    }, action, params);
  },

  async _request(url, options, action, params) {
    try {
      const res = await fetch(url, options);
      const data = await res.json();
      this._setOnline(true);
      return data;
    } catch (err) {
      this._setOnline(false);
      console.warn('API Error:', err.message);
      
      // Gunakan fallback jika diaktifkan
      if (this.useFallback) {
        console.log('Using Local Storage fallback for:', action);
        return this._handleFallback(action, params, options);
      }
      
      return { success: false, message: 'Koneksi ke server gagal.' };
    }
  },

  // ========== FALLBACK HANDLER ==========
  _handleFallback(action, params, options) {
    const bookings = this.getBookingsFromStorage();

    // === GET / READ operations ===
    if (options.method === 'GET' || !options.method) {
      switch(action) {
        case 'getAvailability': {
          const tanggal = params.tanggal;
          const allSlots = this._generateTimeSlots();
          // Filter booking untuk tanggal tersebut
          const existingBookings = bookings.filter(b => 
            b.tanggal === tanggal && 
            (b.status === 'PENDING' || b.status === 'CONFIRMED' || b.status === 'RESCHEDULED')
          );
          const slots = allSlots.map(slot => {
            const count = existingBookings.filter(b => b.jam === slot).length;
            return {
              time: slot,
              available: count < (CONFIG.MAX_CAPACITY || 10),
              booked: count,
              max: CONFIG.MAX_CAPACITY || 10
            };
          });
          return { success: true, slots };
        }

        case 'getServices': {
          return { 
            success: true, 
            services: [
              'Potong Rambut',
              'Creambath',
              'Cat Rambut',
              'Smoothing',
              'Hair Treatment',
              'Full Package'
            ] 
          };
        }

        case 'getBookingById': {
          const booking = bookings.find(b => 
            b.bookingId === params.bookingId && 
            b.whatsapp === params.whatsapp
          );
          if (booking) {
            return { success: true, booking };
          }
          return { success: false, message: 'Booking tidak ditemukan' };
        }

        case 'getDashboard': {
          const stats = {
            total: bookings.length,
            PENDING: 0,
            CONFIRMED: 0,
            RESCHEDULED: 0,
            CANCELLED: 0,
            REJECTED: 0,
            COMPLETED: 0
          };
          bookings.forEach(b => {
            if (stats[b.status] !== undefined) stats[b.status]++;
          });
          return { success: true, stats };
        }

        case 'getBookings': {
          return { success: true, bookings };
        }

        default:
          return { success: false, message: 'Action tidak dikenal' };
      }
    }

    // === POST / WRITE operations ===
    if (options.method === 'POST') {
      switch(action) {
        case 'adminLogin': {
          if (params.password === (CONFIG.ADMIN_PASSWORD || 'admin123')) {
            return { success: true, token: 'admin_' + Date.now() };
          }
          return { success: false, message: 'Password salah!' };
        }

        case 'createBooking': {
          // Cek ketersediaan slot
          const existingBookings = bookings.filter(b => 
            b.tanggal === params.tanggal && 
            b.jam === params.jam &&
            (b.status === 'PENDING' || b.status === 'CONFIRMED' || b.status === 'RESCHEDULED')
          );
          
          if (existingBookings.length >= (CONFIG.MAX_CAPACITY || 10)) {
            return { success: false, message: 'Slot sudah penuh!' };
          }

          const newBooking = {
            bookingId: this.generateId(),
            ...params,
            status: 'PENDING',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          bookings.push(newBooking);
          this.saveBookingsToStorage(bookings);
          return { success: true, booking: newBooking };
        }

        case 'confirmBooking': {
          const index = bookings.findIndex(b => b.bookingId === params.bookingId);
          if (index === -1) return { success: false, message: 'Booking tidak ditemukan' };
          bookings[index].status = 'CONFIRMED';
          bookings[index].updatedAt = new Date().toISOString();
          this.saveBookingsToStorage(bookings);
          return { success: true, booking: bookings[index] };
        }

        case 'rescheduleBooking': {
          const index = bookings.findIndex(b => b.bookingId === params.bookingId);
          if (index === -1) return { success: false, message: 'Booking tidak ditemukan' };
          bookings[index].tanggal = params.tanggalBaru;
          bookings[index].jam = params.jamBaru;
          bookings[index].status = 'RESCHEDULED';
          bookings[index].updatedAt = new Date().toISOString();
          this.saveBookingsToStorage(bookings);
          return { success: true, booking: bookings[index] };
        }

        case 'cancelBooking': {
          const index = bookings.findIndex(b => b.bookingId === params.bookingId);
          if (index === -1) return { success: false, message: 'Booking tidak ditemukan' };
          bookings[index].status = 'CANCELLED';
          bookings[index].alasan = params.alasan || '-';
          bookings[index].updatedAt = new Date().toISOString();
          this.saveBookingsToStorage(bookings);
          return { success: true, booking: bookings[index] };
        }

        case 'rejectBooking': {
          const index = bookings.findIndex(b => b.bookingId === params.bookingId);
          if (index === -1) return { success: false, message: 'Booking tidak ditemukan' };
          bookings[index].status = 'REJECTED';
          bookings[index].alasan = params.alasan || '-';
          bookings[index].updatedAt = new Date().toISOString();
          this.saveBookingsToStorage(bookings);
          return { success: true, booking: bookings[index] };
        }

        case 'completeBooking': {
          const index = bookings.findIndex(b => b.bookingId === params.bookingId);
          if (index === -1) return { success: false, message: 'Booking tidak ditemukan' };
          bookings[index].status = 'COMPLETED';
          bookings[index].updatedAt = new Date().toISOString();
          this.saveBookingsToStorage(bookings);
          return { success: true, booking: bookings[index] };
        }

        default:
          return { success: false, message: 'Action tidak dikenal' };
      }
    }

    return { success: false, message: 'Method tidak didukung' };
  },

  _generateTimeSlots() {
    const slots = [];
    const start = CONFIG.OPERATIONAL_HOURS?.start || '08:00';
    const end = CONFIG.OPERATIONAL_HOURS?.end || '21:00';
    const duration = CONFIG.SLOT_DURATION || 60;
    
    let current = new Date(`2000-01-01 ${start}`);
    const endTime = new Date(`2000-01-01 ${end}`);
    
    while (current < endTime) {
      slots.push(current.toTimeString().slice(0, 5));
      current.setMinutes(current.getMinutes() + duration);
    }
    return slots;
  },

  _setOnline(status) {
    if (this.isOnline === status) return;
    this.isOnline = status;
    document.dispatchEvent(new CustomEvent('connection-change', { detail: { online: status } }));
  },

  // ---- Public (customer) ----
  getAvailability(tanggal) { 
    return this._get('getAvailability', { tanggal }); 
  },
  
  getServices() { 
    return this._get('getServices'); 
  },
  
  createBooking(data) { 
    return this._post('createBooking', data); 
  },
  
  getBookingById(bookingId, whatsapp) { 
    return this._get('getBookingById', { bookingId, whatsapp }); 
  },

  // ---- Admin ----
  adminLogin(password) { 
    return this._post('adminLogin', { password }); 
  },
  
  getDashboard(token) { 
    return this._get('getDashboard', { token }); 
  },
  
  getBookings(token) { 
    return this._get('getBookings', { token }); 
  },
  
  confirmBooking(bookingId, token) { 
    return this._post('confirmBooking', { bookingId, token }); 
  },
  
  rescheduleBooking(bookingId, tanggalBaru, jamBaru, token) {
    return this._post('rescheduleBooking', { bookingId, tanggalBaru, jamBaru, token });
  },
  
  cancelBooking(bookingId, alasan, token) { 
    return this._post('cancelBooking', { bookingId, alasan, token }); 
  },
  
  rejectBooking(bookingId, alasan, token) { 
    return this._post('rejectBooking', { bookingId, alasan, token }); 
  },
  
  completeBooking(bookingId, token) { 
    return this._post('completeBooking', { bookingId, token }); 
  }
};

// ========== CONNECTION INDICATOR ==========
document.addEventListener('connection-change', (e) => {
  const el = document.getElementById('conn-indicator');
  if (!el) return;
  if (e.detail.online) {
    el.textContent = '● LIVE';
    el.className = 'conn-indicator online';
  } else {
    el.textContent = '⚠ OFFLINE (Fallback)';
    el.className = 'conn-indicator offline';
  }
});

// ========== HELPER: POLLING ==========
function startPolling(fn, intervalMs) {
  fn();
  return setInterval(fn, intervalMs || CONFIG.POLLING_INTERVAL_MS || 4000);
}

// ========== HELPER: TOAST ==========
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

// ========== HELPER: WHATSAPP ==========
function waLink(nomor, pesan) {
  const clean = String(nomor).replace(/\D/g, '');
  return 'https://wa.me/' + clean + '?text=' + encodeURIComponent(pesan);
}

// ========== WHATSAPP TEMPLATES ==========
const WA_TEMPLATES = {
  new: (b) => `Halo ${b.nama},

Terima kasih, booking Anda telah kami terima.

Booking ID: ${b.bookingId}
Tanggal: ${b.tanggal}
Jam: ${b.jam}
Status: PENDING

Kami akan segera konfirmasi.`,

  PENDING: (b) => `Halo ${b.nama},

Booking Anda masih dalam status PENDING.

Booking ID: ${b.bookingId}
Tanggal: ${b.tanggal}
Jam: ${b.jam}

Mohon tunggu konfirmasi dari kami.`,

  CONFIRMED: (b) => `Halo ${b.nama},

Booking Anda telah DIKONFIRMASI! ✅

Booking ID: ${b.bookingId}
Tanggal: ${b.tanggal}
Jam: ${b.jam}

Silakan datang tepat waktu. Terima kasih.`,

  RESCHEDULED: (b) => `Halo ${b.nama},

Booking Anda DIJADWALKAN ULANG. 🔄

Booking ID: ${b.bookingId}
Tanggal baru: ${b.tanggal}
Jam baru: ${b.jam}

Mohon konfirmasi kehadiran Anda.`,

  CANCELLED: (b) => `Halo ${b.nama},

Booking Anda telah DIBATALKAN. ❌

Booking ID: ${b.bookingId}
Alasan: ${b.alasan || '-'}

Mohon maaf atas ketidaknyamanannya.`,

  REJECTED: (b) => `Halo ${b.nama},

Mohon maaf, booking Anda TIDAK DAPAT diproses. ❌

Booking ID: ${b.bookingId}
Alasan: ${b.alasan || '-'}

Silakan hubungi kami untuk info lebih lanjut.`,

  COMPLETED: (b) => `Halo ${b.nama},

Terima kasih telah menggunakan layanan kami. Booking Anda berstatus SELESAI. ✅

Booking ID: ${b.bookingId}

Sampai jumpa kembali! 🙏`
};

// ========== EXPORT ==========
if (typeof window !== 'undefined') {
  window.API = API;
  window.startPolling = startPolling;
  window.toast = toast;
  window.waLink = waLink;
  window.WA_TEMPLATES = WA_TEMPLATES;
}

console.log('✅ API loaded successfully!');
console.log('📡 API URL:', CONFIG.API_URL);
console.log('💾 Fallback mode:', API.useFallback ? 'ENABLED' : 'DISABLED');
