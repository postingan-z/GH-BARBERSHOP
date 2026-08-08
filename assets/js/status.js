/**
 * STATUS.JS - logika halaman status.html (cek status real-time)
 */
(function () {
  const searchForm = document.getElementById('search-form');
  const searchBtn = document.getElementById('search-btn');
  let currentBookingId = null;
  let currentWhatsapp = null;
  let pollHandle = null;
  let lastStatus = null;

  searchForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    const fd = new FormData(searchForm);
    currentBookingId = fd.get('bookingId').trim();
    currentWhatsapp = fd.get('whatsapp').trim();

    searchBtn.disabled = true;
    searchBtn.textContent = 'Mencari...';
    const res = await API.getBookingById(currentBookingId, currentWhatsapp);
    searchBtn.disabled = false;
    searchBtn.textContent = 'Cek Status';

    if (!res.success) {
      toast(res.message || 'Booking tidak ditemukan.', 'error');
      return;
    }

    lastStatus = res.booking.status;
    showDetail(res.booking);
    document.getElementById('search-card').style.display = 'none';
    document.getElementById('detail-card').style.display = 'block';

    if (pollHandle) clearInterval(pollHandle);
    pollHandle = startPolling(pollStatus, CONFIG.POLLING_INTERVAL_MS);
  });

  async function pollStatus() {
    if (!currentBookingId) return;
    const res = await API.getBookingById(currentBookingId, currentWhatsapp);
    if (!res.success) return;

    if (res.booking.status !== lastStatus) {
      toast('Status booking Anda diperbarui: ' + res.booking.status, 'success');
      lastStatus = res.booking.status;
    }
    showDetail(res.booking);
  }

  function showDetail(b) {
    document.getElementById('d-id').textContent = b.bookingId;
    document.getElementById('d-nama').textContent = b.nama;
    document.getElementById('d-tanggal').textContent = b.tanggal;
    document.getElementById('d-jam').textContent = b.jam;
    document.getElementById('d-jumlah').textContent = b.jumlah;
    document.getElementById('d-layanan').textContent = b.layanan;
    document.getElementById('d-catatan').textContent = b.catatan || '-';
    document.getElementById('d-updated').textContent = b.updatedAt || '-';

    const badge = document.getElementById('detail-badge');
    badge.textContent = b.status;
    badge.className = 'badge badge-' + b.status;

    const waBtn = document.getElementById('d-wa-btn');
    const tmpl = WA_TEMPLATES[b.status] || WA_TEMPLATES.new;
    waBtn.href = waLink(CONFIG.WHATSAPP_ADMIN_NUMBER, tmpl(b));
  }

  document.getElementById('d-back-btn').addEventListener('click', function () {
    if (pollHandle) clearInterval(pollHandle);
    currentBookingId = null;
    document.getElementById('detail-card').style.display = 'none';
    document.getElementById('search-card').style.display = 'block';
    searchForm.reset();
  });
})();
