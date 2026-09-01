# Dokumentasi Sistem Monitoring & Kontrol Pompa Air Komunitas (Air Warga)

Panduan komprehensif untuk instalasi, pemasangan hardware, konfigurasi jaringan, serta alur kerja teknis pada Sistem Monitoring & Kontrol Pompa Air Warga.

---

## 1. Prasyarat Perangkat Lunak (*Software Requirements*)

Sebelum memulai instalasi, pastikan laptop/komputer tujuan telah terpasang perangkat lunak dan lingkungan kerja berikut:

* **Web Server & Database**: Laragon atau XAMPP (MySQL)
* **Runtime Environment**: Node.js (v14 atau versi lebih baru)
* **Code Editor & Tools**: Visual Studio Code & Arduino IDE
* **Router Wi-Fi Lokal**: Subnet IP `192.168.88.x`

---

## 2. Langkah Instalasi Database & Backend (`server.js`)

### A. Konfigurasi Database MySQL
1. Buka antarmuka **phpMyAdmin** melalui Laragon atau XAMPP.
2. Buat database baru dan **Import** berkas `.sql` sistem ke phpMyAdmin.
3. **Penting:** Matikan service Apache atau web server lain yang berjalan di **port 80** karena server backend Node.js ini akan menggunakan port 80.

### B. Menjalankan Server Backend Node.js
1. Buka **Terminal** atau **Command Prompt** pada direktori utama proyek.
2. Install dependensi modul yang dibutuhkan dengan menjalankan perintah:
   ```bash
   npm install express mysql2 cors body-parser
   ```
3. Jalankan server backend:
   ```bash
   node server.js
   ```
4. Pastikan di terminal muncul konfirmasi:
   > `Berhasil terhubung ke Database MySQL Laragon!`

---

## 3. Konfigurasi Hardware & Upload Program ESP32

1. Hubungkan **ESP32 Master** ke komputer menggunakan kabel data USB.
2. Buka aplikasi **Arduino IDE** dan buka berkas program `sketch_master_jadwal_RTC.ino`.
3. Pastikan library berikut telah terpasang di Arduino IDE:
   * `WiFi.h`
   * `WebServer.h`
   * `ModbusClientTCPasync.h`
   * `Preferences.h`
4. Sesuaikan konfigurasi Wi-Fi pada kode program:
   ```cpp
   const char* ssid     = "QMS_AKLAB";
   const char* password = "12121212";
   ```
5. Pilih board **ESP32 Dev Module** dan port COM yang sesuai, lalu lakukan **Compile** dan **Upload**.

---

## 4. Pemasangan Skema Jaringan & Alamat IP (*IP Addressing*)

Seluruh perangkat (Master dan Slave Nodes) wajib terhubung dalam satu jaringan Wi-Fi lokal yang sama dengan alokasi **IP Static** sebagai berikut:

| Perangkat / Node | Alamat IP | Port / Protokol | Deskripsi / Fungsi |
| :--- | :--- | :--- | :--- |
| **Router Gateway** | `192.168.88.1` | - | Gateway Jaringan Lokal |
| **ESP32 Master** | `192.168.88.90` | Port 80 (HTTP) | Central Hub & WebServer |
| **Flow Slave** | `192.168.88.100` | Port 502 (Modbus TCP) | Sensor Debit Air |
| **Contactor Slave** | `192.168.88.120` | Port 502 (Modbus TCP) | Relay Kontrol Pompa & Sakelar |
| **Ultrasonic / TDS Slave** | `192.168.88.130` | Port 502 (Modbus TCP) | Level Air & Kualitas Air (TDS) |
| **PZEM Slave** | `192.168.88.140` | Port 502 (Modbus TCP) | Sensor Parameter Listrik |

---

## 5. Cara Kerja Sistem (*System Workflow*)

### A. Autentikasi Pengguna & Hak Akses (*Login*)
* **Akses Masuk**: Pengguna membuka halaman login via browser (`login.html`).
* **Verifikasi**: Backend (`server.js`) memverifikasi kredensial ke database MySQL.
* **Pengalihan Peran (*Role Routing*)**:
  * **Role `admin`**: Diarahkan ke `index.html` (Master Panel dengan kontrol penuh terhadap sakelar, penjadwalan, dan laporan keuangan).
  * **Role `warga`**: Diarahkan ke `warga.html` (Warga Panel berbasis *Read-Only* untuk transparansi tagihan & saldo kas).

### B. Komunikasi Data Real-Time
* **HTTP Polling**: Antarmuka web (`script.js`) mengirim *request* HTTP secara berkala (*polling*) langsung ke **ESP32 Master** (`192.168.88.90`).
* **Modbus TCP Master-Slave**: ESP32 Master secara asinkron membaca data dari 4 *Slave Node* via protokol Modbus TCP (Port 502):
  * **Slave Ultrasonic/TDS**: Mengukur jarak, persentase level air torn (`%`), dan nilai TDS (ppm).
  * **Slave Flow Meter**: Mengukur debit air (`L/min`) dan total akumulasi pemakaian warga.
  * **Slave PZEM**: Mengukur parameter listrik (arus, tegangan, daya, dan akumulasi energi).
  * **Slave Contactor**: Membaca status sakelar fisik dan mengontrol *relay* utama pompa.

### C. Fitur Otomatisasi & Diagnostik
* **Mode Auto-Fill**: Pompa beroperasi (ON/OFF) secara otomatis berdasarkan batas minimum dan maksimum level air torn (`%`).
* **Penjadwalan RTC**: Pompa menyala/mati secara terjadwal berdasarkan sistem jam *Real-Time Clock* (RTC).
* **Deteksi Kebocoran Pipa**: Sistem mendeteksi indikasi kebocoran jika sensor *flow* mencatat adanya aliran air saat status kontaktor pompa sedang **OFF**.
* **Notifikasi Servis Berkala**: ESP32 secara otomatis mencatat akumulasi jam kerja mesin pompa untuk memicu notifikasi pemeliharaan rutin.