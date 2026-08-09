/**
 * ADMIN.JS - Real-time admin dashboard dengan Google Apps Script
 */
(function() {
  'use strict';

  let token = sessionStorage.getItem('admin_token') || null;
  let pollHandle = null;
  let currentBookings = [];
  let lastRenderHash = '';
  let actionTargetId = null;
  let reasonMode = 'cancel';

  const loginWrap = document.getElementById('login-wrap');
  const dashboardWrap = document.getElementById('dashboard-wrap');
  const loginForm = document.getElementById('login-form');
  const loginBtn = document.getElementById('login-btn');
  const logoutBtn = document.getElementById('logout-btn');
  const tbody = document.getElementById('booking-tbody');
  const connIndicator = document.getElementById('conn-indicator');

  // Modals
  const rescheduleModal = document.getElementById('reschedule-modal');
  const rsBookingId = document.getElementById('rs-booking-id');
  const rsTanggal = document.getElementById('rs-tanggal');
  const rsJam = document.getElementById('rs-jam');
  const rsCancelBtn = document.getElementById('rs-cancel-btn');
  const rsSubmitBtn = document.getElementById('rs-submit-btn');

  const reasonModal = document.getElementById('reason-modal');
  const reasonTitle = document.getElementById('reason-title');
  const rnBookingId = document.getElementById('rn-booking-id');
  const rnAlasan = document.getElementById('rn-alasan');
  const rnCancelBtn = document.getElementById('rn-cancel-btn');
  const rnSubmitBtn = document.getElementById('rn-submit-btn');

  // ========== LOGIN ==========
  loginForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    const password = new FormData(e.target).get('password');

    loginBtn.disabled = true;
    loginBtn.textContent = '⏳ Memeriksa...';

    try {
      const res = await API.adminLogin(password);

      if (!res.success) {
        toast(res.message || 'Login gagal.', 'error');
        loginBtn.disabled = false;
        loginBtn.textContent = 'Masuk';
        return;
      }

      token = res.token;
      sessionStorage.setItem('admin_token', token);
      toast('✅ Login berhasil!', 'success');
      enterDashboard();

    } catch (error) {
      console.error('Login error:', error);
      toast('Terjadi kesalahan, silakan coba lagi', 'error');
    } finally {
      loginBtn.disabled = false;
      loginBtn.textContent = 'Masuk';
    }
  });

  // ========== LOGOUT ==========
  logoutBtn.addEventListener('click', function() {
    sessionStorage.removeItem('admin_token');
    token = null;
    if (pollHandle) { clearInterval(pollHandle); pollHandle = null; }
    dashboardWrap.style.display = 'none';
    loginWrap.style.display = 'flex';
    toast('Logout berhasil', 'info');
  });

  // ========== ENTER DASHBOARD ==========
  function enterDashboard() {
    loginWrap.style.display = 'none';
    dashboardWrap.style.display = 'block';
    
    refreshAll();
    
    // Real-time polling setiap 3 detik
    if (pollHandle) clearInterval(pollHandle);
    pollHandle = setInterval(refreshAll, CONFIG.POLLING_INTERVAL_MS || 3000);
  }

  // ========== REFRESH ALL ==========
  async function refreshAll() {
    try {
      const [statsRes, bookingsRes] = await Promise.all([
        API.getDashboard(token),
        API.getBookings(token)
      ]);

      if (!statsRes.success || !bookingsRes.success) {
        const msg = statsRes.message || bookingsRes.message || '';
        if (msg.includes('Unauthorized') || msg.includes('token')) {
          toast('Sesi admin berakhir, silakan login ulang.', 'error');
          logoutBtn.click();
        }
        return;
      }

      renderStats(statsRes.stats);
      renderTable(bookingsRes.bookings);

    } catch (error) {
      console.error('Refresh error:', error);
    }
  }

  function renderStats(stats) {
    ['total', 'PENDING', 'CONFIRMED', 'RESCHEDULED', 'CANCELLED', 'REJECTED', 'COMPLETED'].forEach(k => {
      const el = document.getElementById('s-' + k);
      if (el) el.textContent = stats[k] ?? 0;
    });
  }

  function renderTable(bookings) {
    const hash = JSON.stringify(bookings.map(b => [b.bookingId, b.status, b.updatedAt]));
    if (hash === lastRenderHash) return;
    lastRenderHash = hash;
    currentBookings = bookings;

    if (!bookings || bookings.length === 0) {
      tbody.innerHTML = '<tr><td colspan="10" class="loading-row">Belum ada booking.</td></tr>';
      return;
    }

    const sorted = [...bookings].sort((a, b) => 
      new Date(b.createdAt || b.updatedAt) - new Date(a.createdAt || a.updatedAt)
    );

    tbody.innerHTML = sorted.map(function(b) {
      let actions = '';
      
      if (b.status === 'PENDING') {
        actions += `<button class="btn btn-green btn-sm" data-action="confirm" data-id="${b.bookingId}">✅ Confirm</button>`;
      }
      
      if (!['COMPLETED', 'CANCELLED', 'REJECTED'].includes(b.status)) {
        actions += `<button class="btn btn-blue btn-sm" data-action="reschedule" data-id="${b.bookingId}">🔄 Reschedule</button>`;
      }
      
      if (!['CANCELLED', 'REJECTED', 'COMPLETED'].includes(b.status)) {
        actions += `<button class="btn btn-outline btn-sm" data-action="cancel" data-id="${b.bookingId}">❌ Cancel</button>`;
      }
      
      if (b.status === 'PENDING') {
        actions += `<button class="btn btn-red btn-sm" data-action="reject" data-id="${b.bookingId}">⛔ Reject</button>`;
      }
      
      if (!['COMPLETED', 'CANCELLED', 'REJECTED'].includes(b.status)) {
        actions += `<button class="btn btn-outline btn-sm" data-action="complete" data-id="${b.bookingId}">✔️ Complete</button>`;
      }
      
      actions += `<a class="btn btn-amber btn-sm" data-action="wa" data-id="${b.bookingId}" target="_blank" rel="noopener">💬 WA</a>`;

      return `<tr>
        <td><strong>${b.bookingId}</strong></td>
        <td>${escapeHtml(b.nama)}</td>
        <td>${escapeHtml(b.whatsapp)}</td>
        <td>${b.tanggal}</td>
        <td>${b.jam}</td>
        <td>${b.jumlah}</td>
        <td>${escapeHtml(b.layanan)}</td>
        <td><span class="badge badge-${b.status}">${b.status}</span></td>
        <td>${formatDate(b.updatedAt)}</td>
        <td><div class="action-cell">${actions}</div></td>
      </tr>`;
    }).join('');
  }

  function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, c => 
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  }

  function formatDate(dateStr) {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('id-ID') + ' ' + 
             d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    } catch { return dateStr; }
  }

  // ========== ACTIONS ==========
  tbody.addEventListener('click', async function(e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const bookingId = btn.dataset.id;

    if (action === 'confirm') {
      if (!confirm('Konfirmasi booking ' + bookingId + '?')) return;
      const res = await API.confirmBooking(bookingId, token);
      handleActionResult(res, '✅ Booking dikonfirmasi.');
    } else if (action === 'cancel') {
      openReasonModal(bookingId, 'cancel');
    } else if (action === 'reject') {
      openReasonModal(bookingId, 'reject');
    } else if (action === 'complete') {
      if (!confirm('Tandai booking ' + bookingId + ' sebagai selesai?')) return;
      const res = await API.completeBooking(bookingId, token);
      handleActionResult(res, '✔️ Booking ditandai selesai.');
    } else if (action === 'reschedule') {
      openRescheduleModal(bookingId);
    } else if (action === 'wa') {
      e.preventDefault();
      const booking = currentBookings.find(b => b.bookingId === bookingId);
      if (!booking) return;
      const tmpl = WA_TEMPLATES[booking.status] || WA_TEMPLATES['new'];
      window.open(waLink(CONFIG.WHATSAPP_ADMIN_NUMBER, tmpl(booking)), '_blank');
    }
  });

  function handleActionResult(res, successMsg) {
    if (!res.success) {
      toast(res.message || 'Aksi gagal.', 'error');
      return;
    }
    toast(successMsg, 'success');
    lastRenderHash = '';
    refreshAll();
  }

  // ========== MODALS ==========
  function openRescheduleModal(bookingId) {
    actionTargetId = bookingId;
    rsBookingId.textContent = bookingId;
    rsTanggal.value = '';
    rsJam.value = '';
    rescheduleModal.classList.add('open');
  }

  rsCancelBtn.addEventListener('click', () => rescheduleModal.classList.remove('open'));
  rsSubmitBtn.addEventListener('click', async function() {
    const tanggalBaru = rsTanggal.value;
    const jamBaru = rsJam.value;
    if (!tanggalBaru || !jamBaru) {
      toast('Tanggal dan jam baru wajib diisi.', 'error');
      return;
    }
    const res = await API.rescheduleBooking(actionTargetId, tanggalBaru, jamBaru, token);
    rescheduleModal.classList.remove('open');
    handleActionResult(res, '🔄 Booking dijadwalkan ulang.');
  });

  function openReasonModal(bookingId, mode) {
    actionTargetId = bookingId;
    reasonMode = mode;
    reasonTitle.textContent = mode === 'cancel' ? 'Alasan Pembatalan' : 'Alasan Penolakan';
    rnBookingId.textContent = bookingId;
    rnAlasan.value = '';
    reasonModal.classList.add('open');
  }

  rnCancelBtn.addEventListener('click', () => reasonModal.classList.remove('open'));
  rnSubmitBtn.addEventListener('click', async function() {
    const alasan = rnAlasan.value.trim();
    if (!alasan) {
      toast('Alasan wajib diisi.', 'error');
      return;
    }
    const res = reasonMode === 'cancel'
      ? await API.cancelBooking(actionTargetId, alasan, token)
      : await API.rejectBooking(actionTargetId, alasan, token);
    reasonModal.classList.remove('open');
    handleActionResult(res, reasonMode === 'cancel' ? '❌ Booking dibatalkan.' : '⛔ Booking ditolak.');
  });

  // ========== CONNECTION INDICATOR ==========
  document.addEventListener('connection-change', function(e) {
    if (!connIndicator) return;
    connIndicator.textContent = e.detail.online ? '● LIVE' : '⚠ OFFLINE';
    connIndicator.className = `conn-indicator ${e.detail.online ? 'online' : 'offline'}`;
  });

  // ========== INIT ==========
  console.log('✅ Admin.js loaded - Real-time dashboard enabled');
  console.log('🔑 Password: admin123');
  console.log('📡 API:', CONFIG.API_URL);

  if (token) enterDashboard();

})();
