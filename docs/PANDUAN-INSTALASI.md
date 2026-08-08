# Panduan Instalasi — Sistem Booking Online Gratis

Sistem ini pakai **Google Sheets** sebagai database, **Google Apps Script** sebagai backend,
dan HTML/CSS/JS murni sebagai frontend. Semua gratis, tidak butuh VPS/hosting berbayar.

---

## 1. Siapkan Google Sheets

1. Buka [Google Sheets](https://sheets.new), buat spreadsheet baru.
2. Beri nama, misalnya **"Database Booking"**.
3. Buka menu **Extensions > Apps Script**.
4. Hapus isi default `Code.gs`, lalu copy-paste seluruh isi file
   `google-apps-script/Code.gs` dari paket ini.
5. Di dropdown fungsi (atas editor), pilih fungsi **`setupSheets`**, klik **Run**.
   - Ini otomatis membuat sheet `BOOKINGS`, `SETTINGS`, `SERVICES`, `ADMIN`, `LOGS`
     beserta kolom-kolomnya.
   - Google akan minta izin akses — klik **Allow**.
6. Masih di editor, jalankan fungsi **`setAdminPassword`** secara manual:
   - Ubah baris terakhir sementara jadi: `setAdminPassword("password_anda_disini");`
   - lalu jalankan sekali. Setelah itu boleh dihapus/dibiarkan (password sudah tersimpan
     aman di Script Properties, bukan di sheet).

### Sesuaikan data awal
- Sheet **SETTINGS**: atur jam buka/tutup, interval slot (menit), dan maksimum booking per slot.
- Sheet **SERVICES**: isi daftar layanan Anda (nama, durasi, harga).

---

## 2. Deploy sebagai Web App

1. Di Apps Script editor, klik **Deploy > New deployment**.
2. Pilih tipe **Web app**.
3. Isi:
   - **Execute as**: Me
   - **Who has access**: Anyone
4. Klik **Deploy**, salin **URL** yang muncul (diakhiri `/exec`).
5. Setiap kali Anda mengubah `Code.gs`, gunakan **Deploy > Manage deployments > Edit > New version**
   agar perubahan ter-update di URL yang sama.

---

## 3. Hubungkan Frontend ke Backend

1. Buka `assets/js/config.js`.
2. Ganti:
   ```js
   API_URL: 'GANTI_DENGAN_URL_WEB_APP_ANDA',
   ```
   dengan URL `/exec` dari langkah sebelumnya.
3. Ganti juga `WHATSAPP_ADMIN_NUMBER` dengan nomor WhatsApp admin (format internasional
   tanpa `+`, contoh: `6281234567890`).

---

## 4. Hosting Gratis untuk Frontend

Pilih salah satu (semua gratis):

- **GitHub Pages** — push folder ini ke repo GitHub, aktifkan Pages di Settings.
- **Cloudflare Pages** — drag & drop folder ini ke dashboard Cloudflare Pages.
- **Netlify Drop** — buka app.netlify.com/drop, seret folder ini.

Tidak perlu build step apa pun — ini murni HTML/CSS/JS statis.

---

## 5. Struktur File

```
booking-system/
├── index.html              # Halaman booking customer
├── status.html              # Halaman cek status booking
├── admin.html                # Dashboard admin
├── assets/
│   ├── css/style.css         # Semua styling
│   └── js/
│       ├── config.js         # API_URL & konfigurasi (WAJIB diedit)
│       ├── api.js             # Wrapper komunikasi ke Apps Script + toast + WA helper
│       ├── booking.js         # Logika halaman booking
│       ├── status.js          # Logika halaman cek status
│       └── admin.js           # Logika dashboard admin
├── google-apps-script/
│   └── Code.gs                # Seluruh backend (copy ke Apps Script editor)
└── docs/
    └── PANDUAN-INSTALASI.md
```

---

## 6. Cara Kerja Real-Time

- Frontend melakukan **polling** setiap 4 detik (`CONFIG.POLLING_INTERVAL_MS`) ke Apps Script.
- Setiap perubahan (booking baru, confirm, reschedule, cancel, reject, complete) langsung
  tersimpan di Google Sheets dan akan terbaca oleh polling berikutnya — customer & admin
  melihat perubahan tanpa refresh manual.
- Anti double-booking: backend memakai `LockService` + pengecekan ulang kapasitas slot
  sebelum menyimpan booking, jadi dua customer tidak bisa mengambil slot terakhir
  secara bersamaan.

---

## 7. Yang Sengaja Belum Dibuat (silakan dikembangkan sendiri)

Supaya paket ini tetap ringan dan mudah dipahami, beberapa hal **belum** diotomatisasi
penuh — ini titik-titik yang bisa Anda upgrade sesuai kebutuhan:

- **Notifikasi WhatsApp otomatis ke customer** saat admin mengubah status — saat ini
  tombol "Kirim WhatsApp" perlu diklik manual oleh admin/customer (Click-to-Chat, bukan API).
- **Validasi nomor WhatsApp** (format Indonesia) masih sederhana — bisa ditambah regex lebih ketat.
- **Export data ke Excel/PDF** dari dashboard admin belum ada.
- **Multi-admin dengan role berbeda** belum ada (saat ini 1 password admin).
- **Kalender bulanan visual** di halaman booking — saat ini hanya date picker native.
- **Reminder H-1** — bisa ditambahkan pakai Google Apps Script Trigger (`Time-driven trigger`)
  yang jalan otomatis tiap hari, cek booking besok, dan siapkan pesan WA.
- **Rate limiting / anti-spam** pada form booking.

Semua fungsi di `Code.gs` sudah modular (`getBookings`, `createBooking`,
`confirmBooking`, dst) sehingga mudah ditambah tanpa mengubah struktur inti.

---

## 8. Troubleshooting

| Masalah | Penyebab Umum |
|---|---|
| `API_URL` error / tidak ada respons | URL belum diganti di `config.js`, atau belum re-deploy setelah edit `Code.gs` |
| "Unauthorized" di admin | Token expired (12 jam) — login ulang |
| Booking selalu gagal | Jalankan `setupSheets()` dulu, pastikan sheet `BOOKINGS` ada dan headernya sama persis |
| Data tidak real-time | Cek `POLLING_INTERVAL_MS` di `config.js`, pastikan tidak diblok oleh browser (tab di background biasanya masih jalan) |
