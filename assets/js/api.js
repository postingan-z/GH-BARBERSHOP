/**
 * API.JS - Real-time wrapper ke Google Apps Script
 */
const API = {
  isOnline: true,
  _lastRequest: {},
  _cache: {},

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
    const startTime = Date.now();
    try {
      console.log(`📡 [${action}] Request...`);
      const res = await fetch(url, options);
      const data = await res.json();
      const duration = Date.now() - startTime;
      console.log(`✅ [${action}] Response (${duration}ms):`, data);
      
      this._setOnline(true);
      this._cache[action] = data;
      return data;
    } catch (err) {
      this._setOnline(false);
      console.warn(`⚠️ [${action}] Error:`, err.message);
      
      // Return cached data if available
      if (this._cache[action]) {
        console.log(`📦 Using cached data for ${action}`);
        return this._cache[action];
      }
      
      return { success: false, message: 'Koneksi ke server gagal.' };
    }
  },

  _setOnline(status) {
    if (this.isOnline === status) return;
    this.isOnline = status;
    document.dispatchEvent(new CustomEvent('connection-change', { 
      detail: { online: status } 
    }));
  },

  // ---- Public ----
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
    el.textContent = '⚠ OFFLINE';
    el.className = 'conn-indicator offline';
  }
});

console.log('✅ API loaded! Real-time polling enabled');
