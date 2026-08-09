/**
 * KONFIGURASI FRONTEND
 * Ganti API_URL dengan URL Web App hasil deploy Google Apps Script.
 * Contoh: https://script.google.com/macros/s/AKfycbxxxxxxxxxxxxxxxxxxxxxx/exec
 */
const CONFIG = {
  // ========== API CONFIGURATION ==========
  // URL Google Apps Script Web App
  API_URL: 'https://script.google.com/macros/s/AKfycbyERB6e2dgINlzPDbdo3Fp7x3D5IFwU29doPLgiDc_hqtKaWxbaolYeIaT9GPGJw0S3/exec',
  
  // ========== POLLING ==========
  POLLING_INTERVAL_MS: 4000, // 3-5 detik untuk real-time update
  
  // ========== WHATSAPP ==========
  WHATSAPP_ADMIN_NUMBER: '62812xxxxxxx', // nomor WA admin (format internasional, tanpa +)
  
  // ========== LOCAL STORAGE ==========
  // Gunakan Local Storage sebagai fallback jika API tidak tersedia
  USE_LOCAL_STORAGE_FALLBACK: true,
  STORAGE_KEY: 'bookings_data',
  
  // ========== ADMIN ==========
  ADMIN_PASSWORD: 'admin123', // Password untuk admin panel
  
  // ========== OPERATIONAL HOURS ==========
  OPERATIONAL_HOURS: {
    start: '08:00', // Jam buka
    end: '21:00'    // Jam tutup
  },
  SLOT_DURATION: 60, // Durasi per slot dalam menit
  MAX_CAPACITY: 10   // Maksimum booking per slot
};

// ========== WHATSAPP TEMPLATES ==========
const WA_TEMPLATES = {
  'new': function(booking) {
    return `Halo *${booking.nama}*, booking Anda telah kami terima dengan ID: *${booking.bookingId}*

📅 Tanggal: ${booking.tanggal}
🕐 Jam: ${booking.jam}
👥 Jumlah: ${booking.jumlah} orang
💇 Layanan: ${booking.layanan}

📌 Status: PENDING
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

// ========== HELPER FUNCTIONS ==========
function getApiUrl() {
  return CONFIG.API_URL;
}

function getWhatsAppNumber() {
  return CONFIG.WHATSAPP_ADMIN_NUMBER;
}

function getPollingInterval() {
  return CONFIG.POLLING_INTERVAL_MS;
}

function waLink(phone, message) {
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

// ========== EXPORT ==========
// Untuk penggunaan di browser
if (typeof window !== 'undefined') {
  window.CONFIG = CONFIG;
  window.WA_TEMPLATES = WA_TEMPLATES;
  window.getApiUrl = getApiUrl;
  window.getWhatsAppNumber = getWhatsAppNumber;
  window.getPollingInterval = getPollingInterval;
  window.waLink = waLink;
}

console.log('✅ Config loaded successfully!');
console.log('📡 API URL:', CONFIG.API_URL);
console.log('📱 WhatsApp Admin:', CONFIG.WHATSAPP_ADMIN_NUMBER);
console.log('⏱️ Polling interval:', CONFIG.POLLING_INTERVAL_MS, 'ms');
