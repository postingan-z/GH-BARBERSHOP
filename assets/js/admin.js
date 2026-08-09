/**
 * ADMIN.JS - logika halaman admin.html
 * Terintegrasi dengan API dan Local Storage fallback
 */
(function() {
    'use strict';

    // ========== DOM REFS ==========
    const loginWrap = document.getElementById('login-wrap');
    const dashboardWrap = document.getElementById('dashboard-wrap');
    const loginForm = document.getElementById('login-form');
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const tbody = document.getElementById('booking-tbody');
    const connIndicator = document.getElementById('conn-indicator');

    // Modal elements
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

    // ========== STATE ==========
    let token = sessionStorage.getItem('admin_token') || null;
    let pollHandle = null;
    let currentBookings = [];
    let lastRenderHash = '';
    let actionTargetId = null;
    let reasonMode = 'cancel';

    // ========== LOGIN ==========
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const password = new FormData(e.target).get('password');

        loginBtn.disabled = true;
        loginBtn.textContent = 'Memeriksa...';

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
            toast('Login berhasil!', 'success');
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
        if (pollHandle) {
            clearInterval(pollHandle);
            pollHandle = null;
        }
        dashboardWrap.style.display = 'none';
        loginWrap.style.display = 'flex';
        toast('Logout berhasil', 'info');
    });

    // ========== ENTER DASHBOARD ==========
    function enterDashboard() {
        loginWrap.style.display = 'none';
        dashboardWrap.style.display = 'block';
        
        // Initial refresh
        refreshAll();
        
        // Start polling
        if (pollHandle) clearInterval(pollHandle);
        pollHandle = setInterval(refreshAll, CONFIG.POLLING_INTERVAL_MS || 4000);
    }

    // ========== REFRESH ALL ==========
    async function refreshAll() {
        try {
            const [statsRes, bookingsRes] = await Promise.all([
                API.getDashboard(token),
                API.getBookings(token)
            ]);

            if (!statsRes.success || !bookingsRes.success) {
                // Check if unauthorized
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
            // Don't show error toast to avoid spam
        }
    }

    // ========== RENDER STATS ==========
    function renderStats(stats) {
        const keys = ['total', 'PENDING', 'CONFIRMED', 'RESCHEDULED', 'CANCELLED', 'REJECTED', 'COMPLETED'];
        keys.forEach(function(k) {
            const el = document.getElementById('s-' + k);
            if (el) el.textContent = stats[k] ?? 0;
        });
    }

    // ========== RENDER TABLE ==========
    function renderTable(bookings) {
        // Only redraw if data changed
        const hash = JSON.stringify(bookings.map(b => [b.bookingId, b.status, b.updatedAt]));
        if (hash === lastRenderHash) return;
        lastRenderHash = hash;
        currentBookings = bookings;

        if (!bookings || bookings.length === 0) {
            tbody.innerHTML = '<tr><td colspan="10" class="loading-row">Belum ada booking.</td></tr>';
            return;
        }

        // Sort by newest first
        const sorted = [...bookings].sort((a, b) => 
            new Date(b.createdAt || b.updatedAt) - new Date(a.createdAt || a.updatedAt)
        );

        tbody.innerHTML = sorted.map(function(b) {
            // Tampilkan tombol aksi sesuai status
            let actions = '';
            
            // Confirm - hanya untuk PENDING
            if (b.status === 'PENDING') {
                actions += `<button class="btn btn-green btn-sm" data-action="confirm" data-id="${b.bookingId}">Confirm</button>`;
            }
            
            // Reschedule - untuk semua kecuali COMPLETED, CANCELLED, REJECTED
            if (!['COMPLETED', 'CANCELLED', 'REJECTED'].includes(b.status)) {
                actions += `<button class="btn btn-blue btn-sm" data-action="reschedule" data-id="${b.bookingId}">Reschedule</button>`;
            }
            
            // Cancel - untuk semua kecuali CANCELLED, REJECTED, COMPLETED
            if (!['CANCELLED', 'REJECTED', 'COMPLETED'].includes(b.status)) {
                actions += `<button class="btn btn-outline btn-sm" data-action="cancel" data-id="${b.bookingId}">Cancel</button>`;
            }
            
            // Reject - hanya untuk PENDING
            if (b.status === 'PENDING') {
                actions += `<button class="btn btn-red btn-sm" data-action="reject" data-id="${b.bookingId}">Reject</button>`;
            }
            
            // Complete - untuk semua kecuali COMPLETED, CANCELLED, REJECTED
            if (!['COMPLETED', 'CANCELLED', 'REJECTED'].includes(b.status)) {
                actions += `<button class="btn btn-outline btn-sm" data-action="complete" data-id="${b.bookingId}">Complete</button>`;
            }
            
            // WA - selalu tampil
            actions += `<a class="btn btn-amber btn-sm" data-action="wa" data-id="${b.bookingId}" target="_blank" rel="noopener">WA</a>`;

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
                <td>
                    <div class="action-cell">
                        ${actions}
                    </div>
                </td>
            </tr>`;
        }).join('');
    }

    // ========== HELPER FUNCTIONS ==========
    function escapeHtml(str) {
        return String(str ?? '').replace(/[&<>"']/g, function(c) {
            return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
        });
    }

    function formatDate(dateStr) {
        if (!dateStr) return '-';
        try {
            const d = new Date(dateStr);
            return d.toLocaleDateString('id-ID') + ' ' + 
                   d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        } catch {
            return dateStr;
        }
    }

    // ========== ACTIONS ==========
    tbody.addEventListener('click', function(e) {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        
        const action = btn.dataset.action;
        const bookingId = btn.dataset.id;
        const booking = currentBookings.find(b => b.bookingId === bookingId);

        if (!booking) {
            toast('Booking tidak ditemukan', 'error');
            return;
        }

        if (action === 'confirm') {
            if (!confirm('Konfirmasi booking ' + bookingId + '?')) return;
            handleAction(() => API.confirmBooking(bookingId, token), 'Booking dikonfirmasi.');
        } else if (action === 'cancel') {
            openReasonModal(bookingId, 'cancel');
        } else if (action === 'reject') {
            openReasonModal(bookingId, 'reject');
        } else if (action === 'complete') {
            if (!confirm('Tandai booking ' + bookingId + ' sebagai selesai?')) return;
            handleAction(() => API.completeBooking(bookingId, token), 'Booking ditandai selesai.');
        } else if (action === 'reschedule') {
            openRescheduleModal(bookingId);
        } else if (action === 'wa') {
            e.preventDefault();
            sendWhatsApp(booking);
        }
    });

    // ========== HANDLE ACTION ==========
    async function handleAction(actionFn, successMsg) {
        try {
            const res = await actionFn();
            
            if (!res.success) {
                toast(res.message || 'Aksi gagal.', 'error');
                return;
            }
            
            toast(successMsg, 'success');
            lastRenderHash = ''; // Force re-render
            refreshAll();
            
        } catch (error) {
            console.error('Action error:', error);
            toast('Terjadi kesalahan, silakan coba lagi', 'error');
        }
    }

    // ========== SEND WHATSAPP ==========
    function sendWhatsApp(booking) {
        const template = WA_TEMPLATES[booking.status] || WA_TEMPLATES['new'];
        const message = template(booking);
        const waNumber = CONFIG.WHATSAPP_ADMIN_NUMBER || '6281234567890';
        window.open(waLink(waNumber, message), '_blank');
    }

    // ========== MODAL: RESCHEDULE ==========
    function openRescheduleModal(bookingId) {
        actionTargetId = bookingId;
        rsBookingId.textContent = bookingId;
        rsTanggal.value = '';
        rsJam.value = '';
        // Set min date to today
        const today = new Date();
        rsTanggal.min = today.toISOString().split('T')[0];
        rescheduleModal.classList.add('open');
    }

    rsCancelBtn.addEventListener('click', function() {
        rescheduleModal.classList.remove('open');
    });

    rsSubmitBtn.addEventListener('click', async function() {
        const tanggalBaru = rsTanggal.value;
        const jamBaru = rsJam.value;
        
        if (!tanggalBaru || !jamBaru) {
            toast('Tanggal dan jam baru wajib diisi.', 'error');
            return;
        }

        try {
            const res = await API.rescheduleBooking(actionTargetId, tanggalBaru, jamBaru, token);
            rescheduleModal.classList.remove('open');
            
            if (!res.success) {
                toast(res.message || 'Gagal reschedule.', 'error');
                return;
            }
            
            toast('Booking dijadwalkan ulang.', 'success');
            lastRenderHash = '';
            refreshAll();
            
        } catch (error) {
            console.error('Reschedule error:', error);
            toast('Terjadi kesalahan, silakan coba lagi', 'error');
        }
    });

    // ========== MODAL: REASON ==========
    function openReasonModal(bookingId, mode) {
        actionTargetId = bookingId;
        reasonMode = mode;
        reasonTitle.textContent = mode === 'cancel' ? 'Alasan Pembatalan' : 'Alasan Penolakan';
        rnBookingId.textContent = bookingId;
        rnAlasan.value = '';
        reasonModal.classList.add('open');
    }

    rnCancelBtn.addEventListener('click', function() {
        reasonModal.classList.remove('open');
    });

    rnSubmitBtn.addEventListener('click', async function() {
        const alasan = rnAlasan.value.trim();
        
        if (!alasan) {
            toast('Alasan wajib diisi.', 'error');
            return;
        }

        try {
            const actionFn = reasonMode === 'cancel' 
                ? () => API.cancelBooking(actionTargetId, alasan, token)
                : () => API.rejectBooking(actionTargetId, alasan, token);
            
            const res = await actionFn();
            reasonModal.classList.remove('open');
            
            if (!res.success) {
                toast(res.message || 'Aksi gagal.', 'error');
                return;
            }
            
            toast(reasonMode === 'cancel' ? 'Booking dibatalkan.' : 'Booking ditolak.', 'success');
            lastRenderHash = '';
            refreshAll();
            
        } catch (error) {
            console.error('Reason action error:', error);
            toast('Terjadi kesalahan, silakan coba lagi', 'error');
        }
    });

    // ========== CONNECTION INDICATOR ==========
    document.addEventListener('connection-change', function(e) {
        if (!connIndicator) return;
        if (e.detail.online) {
            connIndicator.textContent = '● LIVE';
            connIndicator.className = 'conn-indicator online';
        } else {
            connIndicator.textContent = '⚠ OFFLINE (Fallback)';
            connIndicator.className = 'conn-indicator offline';
        }
    });

    // ========== KEYBOARD SHORTCUTS ==========
    document.addEventListener('keydown', function(e) {
        // ESC to close modals
        if (e.key === 'Escape') {
            if (rescheduleModal.classList.contains('open')) {
                rescheduleModal.classList.remove('open');
            }
            if (reasonModal.classList.contains('open')) {
                reasonModal.classList.remove('open');
            }
        }
    });

    // ========== INIT ==========
    function init() {
        console.log('✅ Admin.js loaded successfully!');
        
        // Auto login if token exists
        if (token) {
            enterDashboard();
        }
    }

    // ========== START ==========
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
