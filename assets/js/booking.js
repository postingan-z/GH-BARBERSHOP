/**
 * BOOKING.JS - logika halaman index.html (form booking customer)
 */
(function () {
  const form = document.getElementById('booking-form');
  const tanggalInput = document.getElementById('input-tanggal');
  const jamHidden = document.getElementById('input-jam');
  const slotGrid = document.getElementById('slot-grid');
  const layananSelect = document.getElementById('select-layanan');
  const submitBtn = document.getElementById('submit-btn');

  let availabilityPollHandle = null;
  let selectedSlot = null;

  // set tanggal minimum = hari ini
  const today = new Date().toISOString().split('T')[0];
  tanggalInput.min = today;
  tanggalInput.value = today;

  // ---------- load layanan ----------
  async function loadServices() {
    const res = await API.getServices();
    if (res.success) {
      layananSelect.innerHTML = res.services
        .map(s => `<option value="${s.nama}">${s.nama}</option>`)
        .join('');
    } else {
      layananSelect.innerHTML = '<option value="">Gagal memuat layanan</option>';
    }
  }

  // ---------- render slot availability ----------
  function renderSlots(availability) {
    if (!availability || !availability.length) {
      slotGrid.innerHTML = '<div class="loading-row">Tidak ada slot tersedia.</div>';
      return;
    }
    slotGrid.innerHTML = availability.map(function (a) {
      const cls = ['slot'];
      if (a.penuh) cls.push('full');
      if (selectedSlot === a.jam && !a.penuh) cls.push('selected');
      return `<div class="${cls.join(' ')}" data-jam="${a.jam}" data-penuh="${a.penuh}">
                ${a.jam}<small>${a.penuh ? 'PENUH' : 'sisa ' + a.sisa}</small>
              </div>`;
    }).join('');
  }

  async function refreshAvailability() {
    if (!tanggalInput.value) return;
    const res = await API.getAvailability(tanggalInput.value);
    if (res.success) {
      // jika slot yang sedang dipilih ternyata sudah penuh (diambil orang lain), batalkan pilihan
      const chosen = res.availability.find(a => a.jam === selectedSlot);
      if (chosen && chosen.penuh) {
        selectedSlot = null;
        jamHidden.value = '';
        toast('Slot yang Anda pilih baru saja penuh, silakan pilih jam lain.', 'error');
      }
      renderSlots(res.availability);
    }
  }

  function startAvailabilityPolling() {
    if (availabilityPollHandle) clearInterval(availabilityPollHandle);
    availabilityPollHandle = startPolling(refreshAvailability, CONFIG.POLLING_INTERVAL_MS);
  }

  tanggalInput.addEventListener('change', function () {
    selectedSlot = null;
    jamHidden.value = '';
    startAvailabilityPolling();
  });

  slotGrid.addEventListener('click', function (e) {
    const el = e.target.closest('.slot');
    if (!el) return;
    if (el.dataset.penuh === 'true') return;
    selectedSlot = el.dataset.jam;
    jamHidden.value = selectedSlot;
    slotGrid.querySelectorAll('.slot').forEach(s => s.classList.remove('selected'));
    el.classList.add('selected');
  });

  // ---------- submit booking ----------
  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    if (!jamHidden.value) {
      toast('Silakan pilih jam terlebih dahulu.', 'error');
      return;
    }

    const fd = new FormData(form);
    const payload = Object.fromEntries(fd.entries());

    submitBtn.disabled = true;
    submitBtn.textContent = 'Memproses...';

    const res = await API.createBooking(payload);

    submitBtn.disabled = false;
    submitBtn.textContent = 'Buat Booking';

    if (!res.success) {
      toast(res.message || 'Booking gagal.', 'error');
      refreshAvailability(); // sinkronkan ulang slot jika ternyata penuh
      return;
    }

    toast('Booking berhasil dibuat!', 'success');
    showResult(res.booking);
  });

  function showResult(booking) {
    document.getElementById('form-card').style.display = 'none';
    document.getElementById('result-card').style.display = 'block';
    document.getElementById('res-id').textContent = booking.bookingId;
    document.getElementById('res-nama').textContent = booking.nama;
    document.getElementById('res-tanggal').textContent = booking.tanggal;
    document.getElementById('res-jam').textContent = booking.jam;

    const waBtn = document.getElementById('res-wa-btn');
    waBtn.href = waLink(CONFIG.WHATSAPP_ADMIN_NUMBER, WA_TEMPLATES.new(booking));

    if (availabilityPollHandle) clearInterval(availabilityPollHandle);
  }

  document.getElementById('res-new-btn').addEventListener('click', function () {
    document.getElementById('result-card').style.display = 'none';
    document.getElementById('form-card').style.display = 'block';
    form.reset();
    tanggalInput.value = today;
    selectedSlot = null;
    jamHidden.value = '';
    startAvailabilityPolling();
  });

  // ---------- init ----------
  loadServices();
  startAvailabilityPolling();
})();
