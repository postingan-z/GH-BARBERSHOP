/**
 * STATUS.JS - Logika halaman status.html (cek status real-time)
 * Menggunakan Local Storage sebagai database
 */
(function() {
    'use strict';

    // ========== CONFIGURATION ==========
    const CONFIG = {
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

    // ========== DOM REFS ==========
    const searchForm = document.getElementById('search-form');
    const searchBtn = document.getElementById('search-btn');
    const searchCard = document.getElementById('search-card');
    const detailCard = document.getElementById('detail-card');
    const backBtn = document.getElementById('d-back-btn');
    const waBtn = document.getElementById('d-wa-btn');

    // Detail elements
    const dId = document.getElementById('d-id');
    const dNama = document.getElementById('d-nama');
    const dTanggal = document.getElementById('d-tanggal');
    const dJam = document.getElementById('d-jam');
    const dJumlah = document.getElementById('d-jumlah');
    const dLayanan = document.getElementById('d-layanan');
    const dCatatan = document.getElementById('d-catatan');
    const dUpdated = document.getElementById('d-updated');
    const dBadge = document.getElementById('detail-badge');

    // ========== STATE ==========
    let currentBookingId = null;
    let currentWhatsapp = null;
    let pollHandle = null;
    let lastStatus = null;

    // ========== SEARCH BOOKING ==========
    searchForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        const fd = new FormData(searchForm);
        const bookingId = fd.get('bookingId').trim();
        const whatsapp = fd.get('whatsapp').trim();

        if (!bookingId) {
            toast('Silakan masukkan Booking ID', 'error');
            return;
        }

        if (!whatsapp) {
            toast('Silakan masukkan nomor WhatsApp', 'error');
            return;
        }

        // Validate WhatsApp number
        if (!/^[0-9]{10,15}$/.test(whatsapp)) {
            toast('Nomor WhatsApp tidak valid (min 10 digit angka)', 'error');
            return;
        }

        searchBtn.disabled = true;
        searchBtn.textContent = 'Mencari...';

        // Simulasi pencarian
        setTimeout(() => {
            const result = findBooking(bookingId, whatsapp);
            
            searchBtn.disabled = false;
            searchBtn.textContent = 'Cek Status';

            if (!result) {
                toast('Booking tidak ditemukan. Periksa kembali ID dan nomor WhatsApp Anda.', 'error');
                return;
            }

            currentBookingId = bookingId;
            currentWhatsapp = whatsapp;
            lastStatus = result.status;

            showDetail(result);
            searchCard.style.display = 'none';
            detailCard.style.display = 'block';

            // Start polling for real-time updates
            if (pollHandle) clearInterval(pollHandle);
            pollHandle = setInterval(pollStatus, CONFIG.POLLING_INTERVAL_MS);

            toast('Booking ditemukan!', 'success');
        }, 500);
    });

    // ========== FIND BOOKING ==========
    function findBooking(bookingId, whatsapp) {
        const bookings = getBookings();
        return bookings.find(b => 
            b.bookingId === bookingId && 
            b.whatsapp === whatsapp
        ) || null;
    }

    // ========== POLL STATUS ==========
    function pollStatus() {
        if (!currentBookingId || !currentWhatsapp) return;

        const result = findBooking(currentBookingId, currentWhatsapp);
        if (!result) {
            toast('Booking tidak ditemukan lagi', 'error');
            clearInterval(pollHandle);
            return;
        }

        if (result.status !== lastStatus) {
            toast(`Status booking Anda diperbarui: ${result.status}`, 'success');
            lastStatus = result.status;
            showDetail(result);
        }
    }

    // ========== SHOW DETAIL ==========
    function showDetail(booking) {
        dId.textContent = booking.bookingId;
        dNama.textContent = booking.nama;
        dTanggal.textContent = booking.tanggal;
        dJam.textContent = booking.jam;
        dJumlah.textContent = booking.jumlah;
        dLayanan.textContent = booking.layanan;
        dCatatan.textContent = booking.catatan || '-';
        dUpdated.textContent = booking.updatedAt ? formatDate(booking.updatedAt) : '-';

        // Update badge
        dBadge.textContent = booking.status;
        dBadge.className = 'badge badge-' + booking.status;

        // Update WhatsApp button
        const template = WA_TEMPLATES[booking.status] || WA_TEMPLATES['new'];
        const message = template(booking);
        const waNumber = CONFIG.WHATSAPP_ADMIN_NUMBER;
        waBtn.href = `https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`;
    }

    // ========== FORMAT DATE ==========
    function formatDate(dateStr) {
        if (!dateStr) return '-';
        const d = new Date(dateStr);
        return d.toLocaleDateString('id-ID') + ' ' + 
               d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    }

    // ========== BACK BUTTON ==========
    backBtn.addEventListener('click', function() {
        // Stop polling
        if (pollHandle) {
            clearInterval(pollHandle);
            pollHandle = null;
        }
        
        currentBookingId = null;
        currentWhatsapp = null;
        lastStatus = null;

        detailCard.style.display = 'none';
        searchCard.style.display = 'block';
        searchForm.reset();
    });

    // ========== WHATSAPP BUTTON ==========
    waBtn.addEventListener('click', function(e) {
        e.preventDefault();
        if (this.href) {
            window.open(this.href, '_blank');
        }
    });

    // ========== EXPOSE FUNCTIONS FOR TESTING ==========
    window.status = {
        findBooking,
        pollStatus,
        getBookings
    };

    // ========== INIT ==========
    console.log('✅ Status.js loaded successfully!');
    console.log('📊 Using Local Storage key:', CONFIG.STORAGE_KEY);

})();
