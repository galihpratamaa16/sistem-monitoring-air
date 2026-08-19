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
                const ctx = document.getElementById('grafikKeuangan').getContext('2d');
                if (grafikKeuangan) {
                    grafikKeuangan.destroy(); // Hancurkan grafik lama jika ada sebelum dibuat ulang
                }
                
                grafikKeuangan = new Chart(ctx, {
                    type: 'bar', // Bisa diganti 'pie' atau 'doughnut' jika ingin bentuk lingkaran
                    data: {
                        labels: ['Pemasukan', 'Pengeluaran'],
                        datasets: [{
                            label: 'Jumlah (Rp)',
                            data: [pemasukan, pengeluaran],
                            backgroundColor: [
                                'rgba(22, 163, 74, 0.7)',   // Hijau untuk Pemasukan
                                'rgba(220, 38, 38, 0.7)'    // Merah untuk Pengeluaran
                            ],
                            borderColor: [
                                'rgba(22, 163, 74, 1)',
                                'rgba(220, 38, 38, 1)'
                            ],
                            borderWidth: 1
                        }]
                    },
                    options: {
                        responsive: true,
                        plugins: {
                            legend: {
                                display: false
                            }
                        },
                        scales: {
                            y: {
                                beginAtZero: true
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
        })
        .catch(() => {});
}
setInterval(updateStatusSistem, 2000);

function updateUSTDS(){
    fetch(ESP_IP + '/api/ustds')
        .then(r => r.json())
        .then(data => {
            let el = document.getElementById('webLevelAir'); if(el) el.innerText = Number(data.level).toFixed(1);
            let elD = document.getElementById('webLevelAirDetail'); if(elD) elD.innerText = Number(data.level).toFixed(1);
            let elT = document.getElementById('webTotalAir'); if(elT) elT.innerText = ((Number(data.level) / 100) * 15).toFixed(2);
            let elJ = document.getElementById('webJarakAir'); if(elJ) elJ.innerText = Number(data.jarak).toFixed(2);
            let elTds = document.getElementById('webTDS'); if(elTds) elTds.innerText = data.tds;
            
            let statusAirEl = document.getElementById('webStatusAir');
            if(statusAirEl) {
                switch(data.status) {
                    case 0: statusAirEl.innerHTML = "<span class='green'>Sangat Baik</span>"; break;
                    case 1: statusAirEl.innerHTML = "<span class='blue'>Baik</span>"; break;
                    case 2: statusAirEl.innerHTML = "<span class='orange'>Buruk</span>"; break;
                    case 3: statusAirEl.innerHTML = "<span class='red'>Buruk Sekali</span>"; break;
                    default: statusAirEl.innerHTML = "-"; break;
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

function downloadPDF(){
    var element = document.getElementById('laporan');
    html2pdf().from(element).save('Laporan_Air.pdf');
}