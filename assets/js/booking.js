/**
 * BOOKING.JS - Real-time booking dengan Google Apps Script
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

  const resId = document.getElementById('res-id');
  const resNama = document.getElementById('res-nama');
  const resTanggal = document.getElementById('res-tanggal');
  const resJam = document.getElementById('res-jam');
  const resWaBtn = document.getElementById('res-wa-btn');
  const resNewBtn = document.getElementById('res-new-btn');

  let selectedJam = null;
  let currentBooking = null;
  let slotPollHandle = null;

  // ========== LOAD LAYANAN ==========
  async function loadLayanan() {
    try {
      const response = await API.getServices();
      if (response.success && response.services) {
        selectLayanan.innerHTML = '<option value="">Pilih Layanan</option>';
        response.services.forEach(service => {
          const option = document.createElement('option');
          option.value = service;
          option.textContent = service;
          selectLayanan.appendChild(option);
        });
        console.log('✅ Layanan loaded:', response.services.length);
      }
    } catch (error) {
      console.error('Error loading layanan:', error);
    }
  }

  // ========== LOAD SLOTS (Real-time) ==========
  async function loadSlots() {
    const tanggal = inputTanggal.value;
    const layanan = selectLayanan.value;

    if (!tanggal || !layanan) {
      slotGrid.innerHTML = '<div class="loading-row">Pilih tanggal dan layanan untuk melihat jam tersedia</div>';
      return;
    }

    slotGrid.innerHTML = '<div class="loading-row">⏳ Memuat jam tersedia...</div>';

    try {
      const response = await API.getAvailability(tanggal);
      
      if (!response.success) {
        slotGrid.innerHTML = `<div class="loading-row error">${response.message || 'Gagal memuat slot'}</div>`;
        return;
      }

      renderSlots(response.slots || []);
      
      // Start real-time polling for slots
      if (slotPollHandle) clearInterval(slotPollHandle);
      slotPollHandle = setInterval(() => {
        API.getAvailability(tanggal).then(res => {
          if (res.success) renderSlots(res.slots || []);
        });
      }, CONFIG.POLLING_INTERVAL_MS || 3000);

    } catch (error) {
      console.error('Error loading slots:', error);
      slotGrid.innerHTML = '<div class="loading-row error">Gagal memuat jam tersedia</div>';
    }
  }

  function renderSlots(slots) {
    if (!slots || slots.length === 0) {
      slotGrid.innerHTML = '<div class="loading-row">Tidak ada jam tersedia</div>';
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
      slotGrid.innerHTML = '<div class="loading-row">Maaf, semua jam sudah penuh</div>';
      return;
    }

    document.querySelectorAll('.slot-item.available').forEach(el => {
      el.addEventListener('click', function() {
        document.querySelectorAll('.slot-item.selected').forEach(e => e.classList.remove('selected'));
        this.classList.add('selected');
        selectedJam = this.dataset.time;
        inputJam.value = selectedJam;
      });
    });

    if (!selectedJam || !document.querySelector(`.slot-item[data-time="${selectedJam}"]`)) {
      selectedJam = null;
      inputJam.value = '';
    }
  }

  // ========== EVENT HANDLERS ==========
  inputTanggal.addEventListener('change', function() {
    selectedJam = null;
    inputJam.value = '';
    if (slotPollHandle) clearInterval(slotPollHandle);
    loadSlots();
  });

  selectLayanan.addEventListener('change', function() {
    selectedJam = null;
    inputJam.value = '';
    if (slotPollHandle) clearInterval(slotPollHandle);
    loadSlots();
  });

  // ========== SUBMIT ==========
  form.addEventListener('submit', async function(e) {
    e.preventDefault();

    const formData = new FormData(form);
    const nama = formData.get('nama').trim();
    const whatsapp = formData.get('whatsapp').trim();
    const tanggal = formData.get('tanggal');
    const jumlah = parseInt(formData.get('jumlah'));
    const layanan = formData.get('layanan');
    const catatan = formData.get('catatan').trim() || '-';

    if (!selectedJam) {
      toast('Silakan pilih jam terlebih dahulu', 'error');
      return;
    }

    if (!/^[0-9]{10,15}$/.test(whatsapp)) {
      toast('Nomor WhatsApp tidak valid (min 10 digit)', 'error');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = '⏳ Memproses...';

    try {
      const bookingData = { nama, whatsapp, tanggal, jam: selectedJam, jumlah, layanan, catatan };
      const response = await API.createBooking(bookingData);

      if (!response.success) {
        toast(response.message || 'Gagal membuat booking', 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Buat Booking';
        return;
      }

      currentBooking = response.booking;
      showResult(currentBooking);
      toast('✅ Booking berhasil dibuat!', 'success');

    } catch (error) {
      console.error('Error:', error);
      toast('Terjadi kesalahan, silakan coba lagi', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Buat Booking';
    }
  });

  // ========== SHOW RESULT ==========
  function showResult(booking) {
    formCard.style.display = 'none';
    resultCard.style.display = 'block';

    resId.textContent = booking.bookingId;
    resNama.textContent = booking.nama;
    resTanggal.textContent = booking.tanggal;
    resJam.textContent = booking.jam;

    const waNumber = CONFIG.WHATSAPP_ADMIN_NUMBER;
    const message = WA_TEMPLATES['new'](booking);
    resWaBtn.href = waLink(waNumber, message);

    resultCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // ========== RESET ==========
  resNewBtn.addEventListener('click', function() {
    form.reset();
    selectedJam = null;
    inputJam.value = '';
    currentBooking = null;

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    inputTanggal.value = tomorrow.toISOString().split('T')[0];

    slotGrid.innerHTML = '<div class="loading-row">Pilih tanggal untuk melihat jam tersedia</div>';
    formCard.style.display = 'block';
    resultCard.style.display = 'none';
    formCard.scrollIntoView({ behavior: 'smooth', block: 'center' });

    if (slotPollHandle) clearInterval(slotPollHandle);
    if (inputTanggal.value && selectLayanan.value) {
      loadSlots();
    }
  });

  // ========== CONNECTION INDICATOR ==========
  document.addEventListener('connection-change', function(e) {
    if (!connIndicator) return;
    if (e.detail.online) {
      connIndicator.textContent = '● LIVE';
      connIndicator.className = 'conn-indicator online';
    } else {
      connIndicator.textContent = '⚠ OFFLINE';
      connIndicator.className = 'conn-indicator offline';
    }
  });

  // ========== INIT ==========
  async function init() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    inputTanggal.value = tomorrow.toISOString().split('T')[0];
    inputTanggal.min = tomorrow.toISOString().split('T')[0];

    await loadLayanan();
    setTimeout(loadSlots, 500);

    console.log('✅ Booking.js loaded - Real-time enabled');
    console.log('📡 API:', CONFIG.API_URL);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
