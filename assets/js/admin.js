/**
 * ADMIN.JS - logika halaman admin.html
 */
(function () {
  let token = sessionStorage.getItem('admin_token') || null;
  let pollHandle = null;
  let currentBookings = []; // cache render terakhir untuk deteksi perubahan (agar tidak redraw semua)
  let lastRenderHash = '';
  let actionTargetId = null;

  const loginWrap = document.getElementById('login-wrap');
  const dashboardWrap = document.getElementById('dashboard-wrap');

  // ---------- LOGIN ----------
  document.getElementById('login-form').addEventListener('submit', async function (e) {
    e.preventDefault();
    const password = new FormData(e.target).get('password');
    const btn = document.getElementById('login-btn');
    btn.disabled = true;
    btn.textContent = 'Memeriksa...';

    const res = await API.adminLogin(password);
    btn.disabled = false;
    btn.textContent = 'Masuk';

    if (!res.success) {
      toast(res.message || 'Login gagal.', 'error');
      return;
    }
    token = res.token;
    sessionStorage.setItem('admin_token', token);
    enterDashboard();
  });

  document.getElementById('logout-btn').addEventListener('click', function () {
    sessionStorage.removeItem('admin_token');
    token = null;
    if (pollHandle) clearInterval(pollHandle);
    dashboardWrap.style.display = 'none';
    loginWrap.style.display = 'flex';
  });

  function enterDashboard() {
    loginWrap.style.display = 'none';
    dashboardWrap.style.display = 'block';
    if (pollHandle) clearInterval(pollHandle);
    pollHandle = startPolling(refreshAll, CONFIG.POLLING_INTERVAL_MS);
  }

  // ---------- POLLING (dashboard stats + tabel) ----------
  async function refreshAll() {
    const [statsRes, bookingsRes] = await Promise.all([
      API.getDashboard(token),
      API.getBookings(token)
    ]);

    if (!statsRes.success || !bookingsRes.success) {
      // token mungkin kadaluarsa
      if ((statsRes.message || '').indexOf('Unauthorized') !== -1) {
        toast('Sesi admin berakhir, silakan login ulang.', 'error');
        document.getElementById('logout-btn').click();
      }
      return;
    }

    renderStats(statsRes.stats);
    renderTable(bookingsRes.bookings);
  }

  function renderStats(stats) {
    ['total', 'PENDING', 'CONFIRMED', 'RESCHEDULED', 'CANCELLED', 'REJECTED', 'COMPLETED'].forEach(function (k) {
      const el = document.getElementById('s-' + k);
      if (el) el.textContent = stats[k] ?? 0;
    });
  }

  function renderTable(bookings) {
    // hanya redraw jika ada perubahan data (hemat DOM ops)
    const hash = JSON.stringify(bookings.map(b => [b.bookingId, b.status, b.updatedAt]));
    if (hash === lastRenderHash) return;
    lastRenderHash = hash;
    currentBookings = bookings;

    const tbody = document.getElementById('booking-tbody');
    if (!bookings.length) {
      tbody.innerHTML = '<tr><td colspan="10" class="loading-row">Belum ada booking.</td></tr>';
      return;
    }

    tbody.innerHTML = bookings.map(function (b) {
      return `<tr>
        <td>${b.bookingId}</td>
        <td>${escapeHtml(b.nama)}</td>
        <td>${escapeHtml(b.whatsapp)}</td>
        <td>${b.tanggal}</td>
        <td>${b.jam}</td>
        <td>${b.jumlah}</td>
        <td>${escapeHtml(b.layanan)}</td>
        <td><span class="badge badge-${b.status}">${b.status}</span></td>
        <td>${b.updatedAt || '-'}</td>
        <td>
          <div class="action-cell">
            <button class="btn btn-green btn-sm" data-action="confirm" data-id="${b.bookingId}">Confirm</button>
            <button class="btn btn-blue btn-sm" data-action="reschedule" data-id="${b.bookingId}">Reschedule</button>
            <button class="btn btn-outline btn-sm" data-action="cancel" data-id="${b.bookingId}">Cancel</button>
            <button class="btn btn-red btn-sm" data-action="reject" data-id="${b.bookingId}">Reject</button>
            <button class="btn btn-outline btn-sm" data-action="complete" data-id="${b.bookingId}">Completed</button>
            <a class="btn btn-amber btn-sm" data-action="wa" data-id="${b.bookingId}" target="_blank" rel="noopener">WA</a>
          </div>
        </td>
      </tr>`;
    }).join('');
  }

  function escapeHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  // ---------- ACTIONS ----------
  document.getElementById('booking-tbody').addEventListener('click', async function (e) {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const bookingId = btn.dataset.id;
    const booking = currentBookings.find(b => b.bookingId === bookingId);

    if (action === 'confirm') {
      if (!confirm('Konfirmasi booking ' + bookingId + '?')) return;
      const res = await API.confirmBooking(bookingId, token);
      handleActionResult(res, 'Booking dikonfirmasi.');
    } else if (action === 'cancel') {
      openReasonModal(bookingId, 'cancel');
    } else if (action === 'reject') {
      openReasonModal(bookingId, 'reject');
    } else if (action === 'complete') {
      if (!confirm('Tandai booking ' + bookingId + ' sebagai selesai?')) return;
      const res = await API.completeBooking(bookingId, token);
      handleActionResult(res, 'Booking ditandai selesai.');
    } else if (action === 'reschedule') {
      openRescheduleModal(bookingId);
    } else if (action === 'wa') {
      e.preventDefault();
      if (!booking) return;
      const tmpl = WA_TEMPLATES[booking.status] || WA_TEMPLATES.new;
      window.open(waLink(CONFIG.WHATSAPP_ADMIN_NUMBER, tmpl(booking)), '_blank');
    }
  });

  function handleActionResult(res, successMsg) {
    if (!res.success) {
      toast(res.message || 'Aksi gagal.', 'error');
      return;
    }
    toast(successMsg, 'success');
    lastRenderHash = ''; // paksa re-render di poll berikutnya
    refreshAll();
  }

  // ---------- MODAL: RESCHEDULE ----------
  const rescheduleModal = document.getElementById('reschedule-modal');
  function openRescheduleModal(bookingId) {
    actionTargetId = bookingId;
    document.getElementById('rs-booking-id').textContent = bookingId;
    document.getElementById('rs-tanggal').value = '';
    document.getElementById('rs-jam').value = '';
    rescheduleModal.classList.add('open');
  }
  document.getElementById('rs-cancel-btn').addEventListener('click', () => rescheduleModal.classList.remove('open'));
  document.getElementById('rs-submit-btn').addEventListener('click', async function () {
    const tanggalBaru = document.getElementById('rs-tanggal').value;
    const jamBaru = document.getElementById('rs-jam').value;
    if (!tanggalBaru || !jamBaru) { toast('Tanggal dan jam baru wajib diisi.', 'error'); return; }
    const res = await API.rescheduleBooking(actionTargetId, tanggalBaru, jamBaru, token);
    rescheduleModal.classList.remove('open');
    handleActionResult(res, 'Booking dijadwalkan ulang.');
  });

  // ---------- MODAL: ALASAN (cancel/reject) ----------
  const reasonModal = document.getElementById('reason-modal');
  let reasonMode = 'cancel';
  function openReasonModal(bookingId, mode) {
    actionTargetId = bookingId;
    reasonMode = mode;
    document.getElementById('reason-title').textContent = mode === 'cancel' ? 'Alasan Pembatalan' : 'Alasan Penolakan';
    document.getElementById('rn-booking-id').textContent = bookingId;
    document.getElementById('rn-alasan').value = '';
    reasonModal.classList.add('open');
  }
  document.getElementById('rn-cancel-btn').addEventListener('click', () => reasonModal.classList.remove('open'));
  document.getElementById('rn-submit-btn').addEventListener('click', async function () {
    const alasan = document.getElementById('rn-alasan').value;
    const res = reasonMode === 'cancel'
      ? await API.cancelBooking(actionTargetId, alasan, token)
      : await API.rejectBooking(actionTargetId, alasan, token);
    reasonModal.classList.remove('open');
    handleActionResult(res, reasonMode === 'cancel' ? 'Booking dibatalkan.' : 'Booking ditolak.');
  });

  // ---------- INIT ----------
  if (token) enterDashboard();
})();
