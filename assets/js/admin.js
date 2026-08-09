/**
 * ADMIN.JS - Logika halaman admin.html
 * Menggunakan Local Storage sebagai database
 */
(function() {
    'use strict';

    // ========== CONFIGURATION ==========
    const CONFIG = {
        ADMIN_PASSWORD: 'admin123',
        STORAGE_KEY: 'bookings_data',
        WHATSAPP_ADMIN_NUMBER: '6281234567890',
        POLLING_INTERVAL_MS: 3000
    };

    // ========== LOCAL STORAGE HELPERS ==========
    function getBookings() {
        try {
            const data = localStorage.getItem(CONFIG.STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            return [];
        }
    }

    function saveBookings(bookings) {
        localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(bookings));
    }

    // ========== WHATSAPP TEMPLATES ==========
    const WA_TEMPLATES = {
        'new': function(booking) {
            return `Halo *${booking.nama}*, booking Anda telah kami terima dengan ID: *${booking.bookingId}*

📅 Tanggal: ${booking.tanggal}
🕐 Jam: ${booking.jam}
👥 Jumlah: ${booking.jumlah} orang
💇 Layanan: ${booking.layanan}

📌 Status: ${booking.status}
Mohon tunggu konfirmasi dari kami.`;
        },
        'PENDING': function(booking) {
            return `Halo *${booking.nama}*, booking Anda dengan ID: *${booking.bookingId}* masih dalam status PENDING.

📅 Tanggal: ${booking.tanggal}
🕐 Jam: ${booking.jam}
👥 Jumlah: ${booking.jumlah} orang
💇 Layanan: ${booking.layanan}

Mohon tunggu konfirmasi dari kami.`;
        },
        'CONFIRMED': function(booking) {
            return `Halo *${booking.nama}*, booking Anda dengan ID: *${booking.bookingId}* telah dikonfirmasi! ✅

📅 Tanggal: ${booking.tanggal}
🕐 Jam: ${booking.jam}
👥 Jumlah: ${booking.jumlah} orang
💇 Layanan: ${booking.layanan}

Silakan datang tepat waktu. Terima kasih!`;
        },
        'RESCHEDULED': function(booking) {
            return `Halo *${booking.nama}*, booking Anda dengan ID: *${booking.bookingId}* telah dijadwalkan ulang. 🔄

📅 Tanggal baru: ${booking.tanggal}
🕐 Jam baru: ${booking.jam}
👥 Jumlah: ${booking.jumlah} orang
💇 Layanan: ${booking.layanan}

Mohon konfirmasi kembali. Terima kasih!`;
        },
        'COMPLETED': function(booking) {
            return `Halo *${booking.nama}*, booking Anda dengan ID: *${booking.bookingId}* telah selesai. ✅

Terima kasih telah menggunakan layanan kami! 🙏`;
        },
        'CANCELLED': function(booking) {
            return `Halo *${booking.nama}*, booking Anda dengan ID: *${booking.bookingId}* telah dibatalkan. ❌

📌 Alasan: ${booking.alasan || '-'}

Untuk informasi lebih lanjut, silakan hubungi kami.`;
        },
        'REJECTED': function(booking) {
            return `Halo *${booking.nama}*, mohon maaf booking Anda dengan ID: *${booking.bookingId}* tidak dapat kami terima. ❌

📌 Alasan: ${booking.alasan || '-'}

Silakan coba tanggal/jam lain atau hubungi kami untuk informasi lebih lanjut.`;
        }
    };

    // ========== TOAST NOTIFICATION ==========
    function toast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;
        
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (container.contains(toast)) {
                    container.removeChild(toast);
                }
            }, 300);
        }, 3000);
    }

    // ========== DOM REFS ==========
    const loginWrap = document.getElementById('login-wrap');
    const dashboardWrap = document.getElementById('dashboard-wrap');
    const loginForm = document.getElementById('login-form');
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const tbody = document.getElementById('booking-tbody');

    // ========== STATE ==========
    let token = sessionStorage.getItem('admin_token') || null;
    let pollHandle = null;
    let currentBookings = [];
    let lastRenderHash = '';
    let actionTargetId = null;

    // ========== LOGIN ==========
    loginForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const password = new FormData(e.target).get('password');

        loginBtn.disabled = true;
        loginBtn.textContent = 'Memeriksa...';

        // Simulasi login
        setTimeout(() => {
            if (password === CONFIG.ADMIN_PASSWORD) {
                token = 'admin_' + Date.now();
                sessionStorage.setItem('admin_token', token);
                toast('Login berhasil!', 'success');
                enterDashboard();
            } else {
                toast('Password salah!', 'error');
            }
            loginBtn.disabled = false;
            loginBtn.textContent = 'Masuk';
        }, 500);
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
        pollHandle = setInterval(refreshAll, CONFIG.POLLING_INTERVAL_MS);
    }

    // ========== REFRESH ALL ==========
    function refreshAll() {
        const bookings = getBookings();
        renderStats(bookings);
        renderTable(bookings);
    }

    // ========== RENDER STATS ==========
    function renderStats(bookings) {
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

        ['total', 'PENDING', 'CONFIRMED', 'RESCHEDULED', 'CANCELLED', 'REJECTED', 'COMPLETED'].forEach(function(k) {
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

        if (!bookings.length) {
            tbody.innerHTML = '<tr><td colspan="10" class="loading-row">Belum ada booking.</td></tr>';
            return;
        }

        // Sort by newest first
        const sorted = [...bookings].sort((a, b) => 
            new Date(b.createdAt) - new Date(a.createdAt)
        );

        tbody.innerHTML = sorted.map(function(b) {
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
                        ${b.status === 'PENDING' ? 
                            `<button class="btn btn-green btn-sm" data-action="confirm" data-id="${b.bookingId}">Confirm</button>` : ''}
                        ${b.status !== 'COMPLETED' && b.status !== 'CANCELLED' && b.status !== 'REJECTED' ? 
                            `<button class="btn btn-blue btn-sm" data-action="reschedule" data-id="${b.bookingId}">Reschedule</button>` : ''}
                        ${b.status !== 'CANCELLED' && b.status !== 'REJECTED' && b.status !== 'COMPLETED' ? 
                            `<button class="btn btn-outline btn-sm" data-action="cancel" data-id="${b.bookingId}">Cancel</button>` : ''}
                        ${b.status === 'PENDING' ? 
                            `<button class="btn btn-red btn-sm" data-action="reject" data-id="${b.bookingId}">Reject</button>` : ''}
                        ${b.status !== 'COMPLETED' && b.status !== 'CANCELLED' && b.status !== 'REJECTED' ? 
                            `<button class="btn btn-outline btn-sm" data-action="complete" data-id="${b.bookingId}">Complete</button>` : ''}
                        <a class="btn btn-amber btn-sm" data-action="wa" data-id="${b.bookingId}" target="_blank" rel="noopener">WA</a>
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
        const d = new Date(dateStr);
        return d.toLocaleDateString('id-ID') + ' ' + 
               d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
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
            updateStatus(bookingId, 'CONFIRMED');
        } else if (action === 'cancel') {
            openReasonModal(bookingId, 'cancel');
        } else if (action === 'reject') {
            openReasonModal(bookingId, 'reject');
        } else if (action === 'complete') {
            if (!confirm('Tandai booking ' + bookingId + ' sebagai selesai?')) return;
            updateStatus(bookingId, 'COMPLETED');
        } else if (action === 'reschedule') {
            openRescheduleModal(bookingId);
        } else if (action === 'wa') {
            e.preventDefault();
            sendWhatsApp(booking);
        }
    });

    // ========== UPDATE STATUS ==========
    function updateStatus(bookingId, status, alasan = '') {
        const bookings = getBookings();
        const index = bookings.findIndex(b => b.bookingId === bookingId);
        
        if (index === -1) {
            toast('Booking tidak ditemukan', 'error');
            return;
        }

        bookings[index].status = status;
        if (alasan) bookings[index].alasan = alasan;
        bookings[index].updatedAt = new Date().toISOString();
        
        saveBookings(bookings);
        lastRenderHash = ''; // Force re-render
        toast(`Status berhasil diupdate menjadi ${status}`, 'success');
        refreshAll();
    }

    // ========== SEND WHATSAPP ==========
    function sendWhatsApp(booking) {
        const template = WA_TEMPLATES[booking.status] || WA_TEMPLATES['new'];
        const message = template(booking);
        const waNumber = CONFIG.WHATSAPP_ADMIN_NUMBER;
        window.open(`https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`, '_blank');
    }

    // ========== MODAL: RESCHEDULE ==========
    const rescheduleModal = document.getElementById('reschedule-modal');
    const rsBookingId = document.getElementById('rs-booking-id');
    const rsTanggal = document.getElementById('rs-tanggal');
    const rsJam = document.getElementById('rs-jam');

    document.getElementById('rs-cancel-btn').addEventListener('click', function() {
        rescheduleModal.classList.remove('open');
    });

    document.getElementById('rs-submit-btn').addEventListener('click', function() {
        const tanggalBaru = rsTanggal.value;
        const jamBaru = rsJam.value;
        
        if (!tanggalBaru || !jamBaru) {
            toast('Tanggal dan jam baru wajib diisi.', 'error');
            return;
        }

        const bookings = getBookings();
        const index = bookings.findIndex(b => b.bookingId === actionTargetId);
        
        if (index === -1) {
            toast('Booking tidak ditemukan', 'error');
            return;
        }

        bookings[index].tanggal = tanggalBaru;
        bookings[index].jam = jamBaru;
        bookings[index].status = 'RESCHEDULED';
        bookings[index].updatedAt = new Date().toISOString();
        
        saveBookings(bookings);
        rescheduleModal.classList.remove('open');
        lastRenderHash = '';
        toast('Booking berhasil direschedule!', 'success');
        refreshAll();
    });

    function openRescheduleModal(bookingId) {
        actionTargetId = bookingId;
        rsBookingId.textContent = bookingId;
        rsTanggal.value = '';
        rsJam.value = '';
        rescheduleModal.classList.add('open');
    }

    // ========== MODAL: REASON (cancel/reject) ==========
    const reasonModal = document.getElementById('reason-modal');
    const reasonTitle = document.getElementById('reason-title');
    const rnBookingId = document.getElementById('rn-booking-id');
    const rnAlasan = document.getElementById('rn-alasan');
    let reasonMode = 'cancel';

    document.getElementById('rn-cancel-btn').addEventListener('click', function() {
        reasonModal.classList.remove('open');
    });

    document.getElementById('rn-submit-btn').addEventListener('click', function() {
        const alasan = rnAlasan.value.trim();
        
        if (!alasan) {
            toast('Alasan wajib diisi.', 'error');
            return;
        }

        const status = reasonMode === 'cancel' ? 'CANCELLED' : 'REJECTED';
        updateStatus(actionTargetId, status, alasan);
        reasonModal.classList.remove('open');
    });

    function openReasonModal(bookingId, mode) {
        actionTargetId = bookingId;
        reasonMode = mode;
        reasonTitle.textContent = mode === 'cancel' ? 'Alasan Pembatalan' : 'Alasan Penolakan';
        rnBookingId.textContent = bookingId;
        rnAlasan.value = '';
        reasonModal.classList.add('open');
    }

    // ========== INIT ==========
    if (token) {
        // Verify token is valid (simple check)
        enterDashboard();
    }

    console.log('✅ Admin.js loaded successfully!');
    console.log('🔑 Password admin: admin123');
    console.log('📊 Using Local Storage key:', CONFIG.STORAGE_KEY);

})();
