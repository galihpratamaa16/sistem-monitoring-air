// Pengaman: Jika belum login, paksa kembali ke halaman login
if (localStorage.getItem('isLoggedIn') !== 'true') {
    window.location.href = 'login.html';
}

// Alamat IP ESP32 Master Anda
const ESP_IP = "http://192.168.88.90";

let grafikKeuangan = null;

function formatRupiahJS(nilai) {
    let isNeg = nilai < 0;
    let angka = Math.abs(Math.round(nilai));
    if (angka === 0) return "Rp 0";
    let rev = angka.toString().split('').reverse().join('');
    let ribuan = '';
    for (let i = 0; i < rev.length; i++) {
        ribuan += rev[i];
        if ((i + 1) % 3 === 0 && (i + 1) !== rev.length) ribuan += '.';
    }
    let hasil = ribuan.split('').reverse().join('');
    return (isNeg ? "-Rp " : "Rp ") + hasil;
}

function initGrafik(pemasukan, pengeluaran) {
    const canvasEl = document.getElementById('grafikKeuangan');
    if (!canvasEl) return;

    const ctx = canvasEl.getContext('2d');

    if (grafikKeuangan) {
        grafikKeuangan.destroy();
    }

    grafikKeuangan = new Chart(ctx, {
        type: 'line',

        data: {
            labels: ['Pemasukan', 'Pengeluaran'],

            datasets: [{
                label: 'Jumlah (Rp)',
                data: [pemasukan, pengeluaran],

                borderColor: 'rgba(37, 99, 235, 1)',
                backgroundColor: 'rgba(37, 99, 235, 0.15)',

                borderWidth: 3,
                pointRadius: 5,
                pointHoverRadius: 7,

                tension: 0.3,
                fill: true
            }]
        },

        options: {
            responsive: true,

            plugins: {
                legend: {
                    display: true
                },

                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return 'Rp ' + Number(context.raw).toLocaleString('id-ID');
                        }
                    }
                }
            },

            scales: {
                y: {
                    beginAtZero: true,

                    ticks: {
                        callback: function(value) {
                            return 'Rp ' + Number(value).toLocaleString('id-ID');
                        }
                    }
                }
            }
        }
    });
}

function formatRupiahJS(nilai) {
    let isNeg = nilai < 0;
    let angka = Math.abs(Math.round(nilai));
    if (angka === 0) return "Rp 0";
    let rev = angka.toString().split('').reverse().join('');
    let ribuan = '';
    for (let i = 0; i < rev.length; i++) {
        ribuan += rev[i];
        if ((i + 1) % 3 === 0 && (i + 1) !== rev.length) ribuan += '.';
    }
    let hasil = ribuan.split('').reverse().join('');
    return (isNeg ? "-Rp " : "Rp ") + hasil;
}

// Fungsi untuk Mengirim Perintah Tombol (ON, OFF, AUTO, MANUAL, Reset)
function kirimAksi(endpoint) {
    fetch(ESP_IP + endpoint)
        .then(() => {
            updateStatusSistem(); // Langsung perbarui tampilan setelah perintah dikirim
        })
        .catch(err => {
            console.error("Gagal mengirim perintah:", err);
        });
}

// Fungsi untuk Mengirim Input Form (Jadwal, Harga, Pengeluaran, dll)
function kirimForm(event, endpoint) {
    event.preventDefault(); // Mencegah browser berpindah halaman/refresh
    const formData = new FormData(event.target);
    const params = new URLSearchParams(formData).toString();
    
    fetch(ESP_IP + endpoint + '?' + params)
        .then(() => {
            alert("Berhasil disimpan!");
            updateStatusSistem();
            event.target.reset(); // Clear input
        })
        .catch(err => alert("Gagal mengirim data ke ESP32."));
}

function syncRTC(){
    let ts = Math.floor(Date.now() / 1000);
    fetch(ESP_IP + '/syncRTC?ts=' + ts)
        .then(r => r.text())
        .then(() => { document.getElementById('rtcStatus').innerHTML = 'Ready'; })
        .catch(() => { document.getElementById('rtcStatus').innerHTML = 'Not Ready'; });
}
syncRTC();

function updateStatusSistem() {
    fetch(ESP_IP + '/api/status')
        .then(r => r.json())
        .then(data => {
            // Update Mode & Status Pompa
            let modeEl = document.getElementById('webModeMasterText');
            if(modeEl) {
                modeEl.innerText = (data.modeMaster == 1) ? "AUTO" : "MANUAL";
                modeEl.className = (data.modeMaster == 1) ? "blue" : "orange";
            }

            let pompaTop = document.getElementById('webStatusPompaTop');
            let pompaText = document.getElementById('webStatusPompaText');
            let pStatusStr = (data.statusPompa == 1) ? "ON" : "OFF";
            let pClass = (data.statusPompa == 1) ? "green" : "red";

            if(pompaTop) { pompaTop.innerText = pStatusStr; pompaTop.className = pClass; }
            if(pompaText) { pompaText.innerText = pStatusStr; pompaText.className = pClass; }

            // Update Jadwal
            let tMulai = document.getElementById('teksMulai');
            let tSelesai = document.getElementById('teksSelesai');
            if(tMulai) tMulai.innerText = data.jadwalMulai;
            if(tSelesai) tSelesai.innerText = data.jadwalSelesai;

            let statusJadwal = document.getElementById('statusJadwalHTML');
            if(statusJadwal) {
                statusJadwal.innerHTML = data.jadwalAktif == 1 ? 
                    "<p class='green'><b>Jadwal AKTIF</b></p>" : 
                    "<p class='red'><b>Jadwal NONAKTIF</b></p>";
            }

            // Update Harga
            let teksHarga = document.getElementById('teksHargaAktif');
            if(teksHarga) teksHarga.innerText = formatRupiahJS(data.tarif) + " / m³";

            // Update Keuangan
            let tagihanBulanEl = document.getElementById('valTagihanBulan');
            if(tagihanBulanEl) tagihanBulanEl.innerText = formatRupiahJS(data.tagihanBulan);

            let valPembayaran = document.getElementById('valPembayaran');
            if(valPembayaran) valPembayaran.innerText = formatRupiahJS(data.tagihanBulan);

            let valTunggakan = document.getElementById('valTunggakan');
            if(valTunggakan) valTunggakan.innerText = formatRupiahJS(data.tunggakan);

            let rekapTampil = document.getElementById('valRekapTampil');
            let neracaPemasukan = document.getElementById('neracaPemasukan');
            if(rekapTampil) rekapTampil.innerText = formatRupiahJS(data.rekap);
            if(neracaPemasukan) neracaPemasukan.innerText = formatRupiahJS(data.rekap);

            let totPengeluaran = document.getElementById('valTotalPengeluaran');
            let neracaPengeluaran = document.getElementById('neracaPengeluaran');
            if(totPengeluaran) totPengeluaran.innerText = formatRupiahJS(data.totalPengeluaran);
            if(neracaPengeluaran) neracaPengeluaran.innerText = formatRupiahJS(data.totalPengeluaran);

            let tabelRiwayat = document.getElementById('tabelRiwayatPengeluaran');
            if(tabelRiwayat) tabelRiwayat.innerHTML = data.riwayatPengeluaran;

            let saldoBerjalan = data.rekap - data.totalPengeluaran;
            let neracaSaldo = document.getElementById('neracaSaldo');
            if(neracaSaldo) {
                neracaSaldo.innerText = formatRupiahJS(saldoBerjalan);
                neracaSaldo.style.color = saldoBerjalan >= 0 ? "#16a34a" : "#dc2626";
            }

            // Update Grafik
            if (typeof window.grafikInisialisasi === 'undefined') {
                initGrafik(data.rekap, data.totalPengeluaran);
                window.grafikInisialisasi = true;
            } else if (grafikKeuangan) {
                grafikKeuangan.data.datasets[0].data = [data.rekap, data.totalPengeluaran];
                grafikKeuangan.update();
            }

            // Update Tagihan Air Rumah 1 & 2
            let m3_0 = document.getElementById('m3_0');
            let tagihan_0 = document.getElementById('tagihan_0');
            if(m3_0) m3_0.innerText = Number(data.m3_0).toFixed(3) + " m³";
            if(tagihan_0) tagihan_0.innerText = formatRupiahJS(data.tagihan_0);

            let m3_1 = document.getElementById('m3_1');
            let tagihan_1 = document.getElementById('tagihan_1');
            if(m3_1) m3_1.innerText = Number(data.m3_1).toFixed(3) + " m³";
            if(tagihan_1) tagihan_1.innerText = formatRupiahJS(data.tagihan_1);

            // Update Jatuh Tempo Aktif
            let jatuhTempoEl = document.getElementById('valJatuhTempoStr');
            if(jatuhTempoEl && data.dueStr) {
                jatuhTempoEl.innerText = data.dueStr;
            }

            // Update Data Warga (Jumlah Pemakaian dalam Liter)
            let pemR1 = document.getElementById('pemakaianR1');
            let pemR2 = document.getElementById('pemakaianR2');
            if(pemR1 && data.liter_0 !== undefined) pemR1.innerText = Number(data.liter_0).toFixed(2);
            if(pemR2 && data.liter_1 !== undefined) pemR2.innerText = Number(data.liter_1).toFixed(2);

            // --- LOGIKA NOTIFICATION BADGE SIDEBAR ---
            let badge = document.getElementById('sidebarBadge');
            if (badge) {
                let perluServis = (data.menitOperasional >= (data.batasServis || 120));
                let adaBocor = (data.statusBocor == 1);
                
                if (perluServis || adaBocor) {
                    badge.style.display = 'inline-block';
                    if (adaBocor && perluServis) {
                        badge.innerText = 'BOCOR & SERVIS';
                    } else if (adaBocor) {
                        badge.innerText = 'BOCOR!';
                    } else {
                        badge.innerText = 'SERVIS!';
                    }
                } else {
                    badge.style.display = 'none';
                }
            }
        })
        .catch(() => {});
}
setInterval(updateStatusSistem, 2000);

function updateUSTDS(){
    fetch(ESP_IP + '/api/ustds')
        .then(r => r.json())
        .then(data => {
            let levelVal = Number(data.level) || 0;
            let tdsVal = Number(data.tds) || 0;
            let jarakVal = Number(data.jarak) || 0;

            // 1. Update elemen angka statis
            let el = document.getElementById('webLevelAir'); if(el) el.innerText = levelVal.toFixed(1);
            let elD = document.getElementById('webLevelAirDetail'); if(elD) elD.innerText = levelVal.toFixed(1);
            let elT = document.getElementById('webTotalAir'); if(elT) elT.innerText = ((levelVal / 100) * 15).toFixed(2);
            let elJ = document.getElementById('webJarakAir'); if(elJ) elJ.innerText = jarakVal.toFixed(2);
            let elTds = document.getElementById('webTDS'); if(elTds) elTds.innerText = tdsVal;

            // 2. LOGIKA TORN TWIN VISUALIZER
            let ttWater = document.getElementById('ttWaterLevel');
            let ttBadge = document.getElementById('ttBadgeTDS');

            if (ttWater) {
                // Batasi level antara 0% - 100%
                let clampedLevel = Math.min(Math.max(levelVal, 0), 100);
                ttWater.style.height = clampedLevel + '%';

                // Tentukan Warna Air & Text Badge berdasarkan TDS
                let waterColor = "#00d2ff"; // Default Biru Segar
                let statusText = "Sangat Baik";
                let badgeClass = "bg-good";

                if (tdsVal > 500) {
                    waterColor = "#dc2626"; // Merah
                    statusText = "Keruh / Buruk";
                    badgeClass = "bg-bad";
                } else if (tdsVal > 300) {
                    waterColor = "#f97316"; // Orange
                    statusText = "Sedang / Layak";
                    badgeClass = "bg-medium";
                }

                ttWater.style.setProperty('--water-color', waterColor);

                if (ttBadge) {
                    ttBadge.innerText = statusText;
                    ttBadge.className = 'badge ' + badgeClass;
                }
            }
        }).catch(() => {});
}
setInterval(updateUSTDS, 1000);

function updatePzem(){
    fetch(ESP_IP + '/api/pzem')
        .then(r => r.json())
        .then(data => {
            let el;
            el = document.getElementById('webV'); if(el) el.innerText = data.v;
            el = document.getElementById('webI'); if(el) el.innerText = data.i;
            el = document.getElementById('webP'); if(el) el.innerText = data.p;
            let pz = document.getElementById('webPZEM'); if(pz) pz.innerText = data.p;
            el = document.getElementById('webE'); if(el) el.innerText = data.e;
            let lTotal = document.getElementById('webListrikTotal'); if(lTotal) lTotal.innerText = data.e;
            el = document.getElementById('webF'); if(el) el.innerText = data.f;
            el = document.getElementById('webPF'); if(el) el.innerText = data.pf;
        }).catch(() => {});
}
setInterval(updatePzem, 2000);

function updateFlow(){
    fetch(ESP_IP + '/api/flow')
        .then(r => r.json())
        .then(data => {
            let el;
            el = document.getElementById('webFlow0'); if(el) el.innerText = Number(data.flow0).toFixed(2);
            el = document.getElementById('webTotal0'); if(el) el.innerText = Number(data.liter0).toFixed(2);
            el = document.getElementById('webPulse0'); if(el) el.innerText = data.pulse0;
            let sf = document.getElementById('webStatusFlow'); if(sf) sf.innerText = data.status0;
        }).catch(() => {});
}
setInterval(updateFlow, 3000);

function downloadPDF() {
    // 1. Sinkronisasi data real-time ke dalam elemen template PDF
    document.getElementById('pdfTeksHarga').innerText = document.getElementById('teksHargaAktif').innerText;
    document.getElementById('pdfM3_0').innerText = document.getElementById('m3_0').innerText;
    document.getElementById('pdfTagihan_0').innerText = document.getElementById('tagihan_0').innerText;
    document.getElementById('pdfM3_1').innerText = document.getElementById('m3_1').innerText;
    document.getElementById('pdfTagihan_1').innerText = document.getElementById('tagihan_1').innerText;
    
    document.getElementById('pdfRekap').innerText = document.getElementById('neracaPemasukan').innerText;
    document.getElementById('pdfPengeluaran').innerText = document.getElementById('neracaPengeluaran').innerText;
    
    let saldoEl = document.getElementById('neracaSaldo');
    let pdfSaldo = document.getElementById('pdfSaldo');
    pdfSaldo.innerText = saldoEl.innerText;
    pdfSaldo.style.color = saldoEl.style.color;

    // Evaluasi statistik kondisi saldo untuk laporan
    let teksSaldo = saldoEl.innerText;
    let statusKondisi = document.getElementById('pdfStatusKondisi');
    if (teksSaldo.includes("-")) {
        statusKondisi.innerText = "Defisit (Pengeluaran melebihi pemasukan)";
        statusKondisi.style.color = "#dc2626";
    } else {
        statusKondisi.innerText = "Surplus / Seimbang (Keuangan sehat)";
        statusKondisi.style.color = "#16a34a";
    }

    // 2. Ambil elemen template PDF
    var element = document.getElementById('pdf-report');

    // 3. Konfigurasi format A4 menggunakan html2pdf
    var opt = {
        margin:       10, // mm
        filename:     'Laporan Manajemen Air Warga.pdf',
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    // 4. Proses dan unduh PDF langsung
    html2pdf().from(element).set(opt).save();
}

function logout() {
    if (confirm("Apakah Anda yakin ingin keluar?")) {
        localStorage.clear();
        window.location.href = 'login.html';
    }
}

// --- LOGIKA NAVIGASI MOBILE ---
function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    if (sidebar) sidebar.classList.toggle('active');
    if (overlay) overlay.classList.toggle('active');
}

// Tutup sidebar otomatis ketika salah satu menu di-klik (layar HP)
document.querySelectorAll('.sidebar a').forEach(link => {
    link.addEventListener('click', () => {
        if (window.innerWidth <= 768) {
            toggleSidebar();
        }
    });
});