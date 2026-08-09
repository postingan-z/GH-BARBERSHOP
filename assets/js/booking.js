/**
 * BOOKING.JS - Logika halaman booking
 * Menggunakan Local Storage sebagai database
 */
(function() {
    'use strict';

    // ========== DOM REFS ==========
    const form = document.getElementById('booking-form');
    const formCard = document.getElementById('form-card');
    const resultCard = document.getElementById('result-card');
    const submitBtn = document.getElementById('submit-btn');
    const slotGrid = document.getElementById('slot-grid');
    const inputJam = document.getElementById('input-jam');
    const inputTanggal = document.getElementById('input-tanggal');
    const selectLayanan = document.getElementById('select-layanan');
    const connIndicator = document.getElementById('conn-indicator');

    // Result elements
    const resId = document.getElementById('res-id');
    const resNama = document.getElementById('res-nama');
    const resTanggal = document.getElementById('res-tanggal');
    const resJam = document.getElementById('res-jam');
    const resWaBtn = document.getElementById('res-wa-btn');
    const resNewBtn = document.getElementById('res-new-btn');

    // ========== STATE ==========
    let selectedJam = null;
    let currentBooking = null;

    // ========== CONFIGURATION ==========
    const CONFIG = {
        STORAGE_KEY: 'bookings_data',
        WHATSAPP_ADMIN_NUMBER: '6281234567890',
        OPERATIONAL_HOURS: {
            start: '08:00',
            end: '21:00'
        },
        SLOT_DURATION: 60,
        MAX_CAPACITY: 10
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

    function generateId() {
        return 'BK' + Date.now().toString(36).toUpperCase() + 
               Math.random().toString(36).substring(2, 5).toUpperCase();
    }

    function generateTimeSlots() {
        const slots = [];
        const start = CONFIG.OPERATIONAL_HOURS.start;
        const end = CONFIG.OPERATIONAL_HOURS.end;
        const duration = CONFIG.SLOT_DURATION;
        
        let current = new Date(`2000-01-01 ${start}`);
        const endTime = new Date(`2000-01-01 ${end}`);
        
        while (current < endTime) {
            slots.push(current.toTimeString().slice(0, 5));
            current.setMinutes(current.getMinutes() + duration);
        }
        return slots;
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

    // ========== INITIALIZATION ==========
    function init() {
        // Set default date to tomorrow
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split('T')[0];
        inputTanggal.value = tomorrowStr;
        inputTanggal.min = tomorrowStr;

        // Load layanan options (already in HTML)
        // Set connection status
        updateConnectionStatus(true);

        // Event listeners
        inputTanggal.addEventListener('change', onTanggalChange);
        selectLayanan.addEventListener('change', onLayananChange);
        form.addEventListener('submit', onSubmit);
        resNewBtn.addEventListener('click', resetForm);

        // Initial load
        loadSlots();

        // Check connection periodically
        setInterval(checkConnection, 30000);
    }

    // ========== LOAD SLOTS ==========
    async function loadSlots() {
        const tanggal = inputTanggal.value;
        const layanan = selectLayanan.value;

        if (!tanggal || !layanan) {
            slotGrid.innerHTML = '<div class="loading-row">Pilih tanggal dan layanan untuk melihat jam tersedia</div>';
            return;
        }

        slotGrid.innerHTML = '<div class="loading-row">Memuat jam tersedia...</div>';

        // Simulasi loading
        setTimeout(() => {
            const bookings = getBookings();
            const allSlots = generateTimeSlots();
            
            // Filter booking untuk tanggal dan layanan yang dipilih
            const existingBookings = bookings.filter(b => 
                b.tanggal === tanggal && 
                b.layanan === layanan &&
                (b.status === 'PENDING' || b.status === 'CONFIRMED' || b.status === 'RESCHEDULED')
            );

            const availableSlots = allSlots.map(slot => {
                const count = existingBookings.filter(b => b.jam === slot).length;
                return {
                    time: slot,
                    available: count < CONFIG.MAX_CAPACITY,
                    booked: count,
                    max: CONFIG.MAX_CAPACITY
                };
            });

            renderSlots(availableSlots);
        }, 300);
    }

    function renderSlots(slots) {
        if (!slots || slots.length === 0) {
            slotGrid.innerHTML = '<div class="loading-row">Tidak ada jam tersedia untuk tanggal ini</div>';
            return;
        }

        let html = '';
        let hasAvailable = false;

        slots.forEach(slot => {
            const isAvailable = slot.available !== false;
            const isSelected = selectedJam === slot.time;
            
            if (isAvailable) hasAvailable = true;

            html += `
                <div class="slot-item ${isAvailable ? 'available' : 'unavailable'} ${isSelected ? 'selected' : ''}"
                     data-time="${slot.time}"
                     data-available="${isAvailable}"
                     ${!isAvailable ? 'style="cursor:not-allowed;opacity:0.5;"' : ''}>
                    <span class="slot-time">${slot.time}</span>
                    ${slot.booked !== undefined ? `<span class="slot-info">${slot.booked}/${slot.max}</span>` : ''}
                    ${isAvailable ? '' : '<span class="slot-badge">Full</span>'}
                </div>
            `;
        });

        slotGrid.innerHTML = html;

        if (!hasAvailable) {
            slotGrid.innerHTML = '<div class="loading-row">Maaf, semua jam sudah penuh untuk tanggal ini</div>';
            return;
        }

        // Add click listeners
        document.querySelectorAll('.slot-item.available').forEach(el => {
            el.addEventListener('click', function() {
                const time = this.dataset.time;
                selectSlot(time);
            });
        });

        // If no slot selected, clear selection
        if (!selectedJam || !document.querySelector(`.slot-item[data-time="${selectedJam}"]`)) {
            selectedJam = null;
            inputJam.value = '';
        }
    }

    function selectSlot(time) {
        // Deselect previous
        document.querySelectorAll('.slot-item.selected').forEach(el => {
            el.classList.remove('selected');
        });

        // Select new
        const slotEl = document.querySelector(`.slot-item[data-time="${time}"]`);
        if (slotEl) {
            slotEl.classList.add('selected');
            selectedJam = time;
            inputJam.value = time;
        }
    }

    // ========== EVENT HANDLERS ==========
    function onTanggalChange() {
        selectedJam = null;
        inputJam.value = '';
        loadSlots();
    }

    function onLayananChange() {
        selectedJam = null;
        inputJam.value = '';
        loadSlots();
    }

    // ========== SUBMIT FORM ==========
    async function onSubmit(e) {
        e.preventDefault();

        // Validate
        const formData = new FormData(form);
        const nama = formData.get('nama').trim();
        const whatsapp = formData.get('whatsapp').trim();
        const tanggal = formData.get('tanggal');
        const jumlah = parseInt(formData.get('jumlah'));
        const layanan = formData.get('layanan');
        const catatan = formData.get('catatan').trim() || '-';

        if (!nama) {
            toast('Nama lengkap wajib diisi', 'error');
            return;
        }

        if (!whatsapp) {
            toast('Nomor WhatsApp wajib diisi', 'error');
            return;
        }

        // Validate WhatsApp number
        if (!/^[0-9]{10,15}$/.test(whatsapp)) {
            toast('Nomor WhatsApp tidak valid (min 10 digit angka)', 'error');
            return;
        }

        if (!tanggal) {
            toast('Tanggal wajib dipilih', 'error');
            return;
        }

        if (!layanan) {
            toast('Layanan wajib dipilih', 'error');
            return;
        }

        if (!selectedJam) {
            toast('Silakan pilih jam terlebih dahulu', 'error');
            return;
        }

        // Disable submit button
        submitBtn.disabled = true;
        submitBtn.textContent = 'Memproses...';

        try {
            // Cek ketersediaan slot terakhir
            const bookings = getBookings();
            const existingBookings = bookings.filter(b => 
                b.tanggal === tanggal && 
                b.jam === selectedJam &&
                b.layanan === layanan &&
                (b.status === 'PENDING' || b.status === 'CONFIRMED' || b.status === 'RESCHEDULED')
            );

            if (existingBookings.length >= CONFIG.MAX_CAPACITY) {
                toast('Maaf, slot sudah penuh!', 'error');
                submitBtn.disabled = false;
                submitBtn.textContent = 'Buat Booking';
                loadSlots(); // Refresh slots
                return;
            }

            // Create booking
            const newBooking = {
                bookingId: generateId(),
                nama,
                whatsapp,
                tanggal,
                jam: selectedJam,
                jumlah,
                layanan,
                catatan,
                status: 'PENDING',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            bookings.push(newBooking);
            saveBookings(bookings);

            currentBooking = newBooking;
            
            // Show result
            showResult(newBooking);
            
            toast('Booking berhasil dibuat!', 'success');

        } catch (error) {
            console.error('Error creating booking:', error);
            toast('Terjadi kesalahan, silakan coba lagi', 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Buat Booking';
        }
    }

    // ========== SHOW RESULT ==========
    function showResult(booking) {
        formCard.style.display = 'none';
        resultCard.style.display = 'block';

        resId.textContent = booking.bookingId;
        resNama.textContent = booking.nama;
        resTanggal.textContent = booking.tanggal;
        resJam.textContent = booking.jam;

        // Update WhatsApp link
        const waNumber = CONFIG.WHATSAPP_ADMIN_NUMBER;
        const waMessage = `Halo *${booking.nama}*, booking Anda telah kami terima dengan ID: *${booking.bookingId}*

📅 Tanggal: ${booking.tanggal}
🕐 Jam: ${booking.jam}
👥 Jumlah: ${booking.jumlah} orang
💇 Layanan: ${booking.layanan}

📌 Status: PENDING
Mohon tunggu konfirmasi dari kami.`;

        resWaBtn.href = `https://wa.me/${waNumber}?text=${encodeURIComponent(waMessage)}`;

        // Scroll to result
        resultCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // ========== SEND WHATSAPP ==========
    function sendWhatsApp(e) {
        e.preventDefault();
        if (resWaBtn.href) {
            window.open(resWaBtn.href, '_blank');
        }
    }

    // ========== RESET FORM ==========
    function resetForm() {
        form.reset();
        selectedJam = null;
        inputJam.value = '';
        currentBooking = null;
        
        // Reset date to tomorrow
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        inputTanggal.value = tomorrow.toISOString().split('T')[0];

        // Clear slot grid
        slotGrid.innerHTML = '<div class="loading-row">Pilih tanggal untuk melihat jam tersedia</div>';

        // Show form, hide result
        formCard.style.display = 'block';
        resultCard.style.display = 'none';

        // Scroll to form
        formCard.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // Reload slots if tanggal and layanan are set
        if (inputTanggal.value && selectLayanan.value) {
            loadSlots();
        }
    }

    // ========== CONNECTION STATUS ==========
    function updateConnectionStatus(isOnline) {
        if (!connIndicator) return;
        if (isOnline) {
            connIndicator.className = 'conn-indicator online';
            connIndicator.textContent = '● LIVE';
        } else {
            connIndicator.className = 'conn-indicator offline';
            connIndicator.textContent = '● OFFLINE';
        }
    }

    function checkConnection() {
        // Check if localStorage is available
        try {
            localStorage.setItem('_test', 'test');
            localStorage.removeItem('_test');
            updateConnectionStatus(true);
        } catch (error) {
            updateConnectionStatus(false);
        }
    }

    // ========== EXPOSE FUNCTIONS FOR TESTING ==========
    window.booking = {
        loadSlots,
        resetForm,
        getBookings,
        saveBookings
    };

    // ========== INIT ==========
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    console.log('✅ Booking.js loaded successfully!');
    console.log('📊 Using Local Storage key:', CONFIG.STORAGE_KEY);

})();
