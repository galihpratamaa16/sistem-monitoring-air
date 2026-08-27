#include <WiFi.h>
#include <WebServer.h>
#include <ModbusClientTCPasync.h>
#include <time.h>
#include <sys/time.h>
#include <Preferences.h>

const char* ssid = "QMS_AKLAB";
const char* password = "12121212";

WebServer server(80);

IPAddress pzem1IP(192, 168, 88, 140);
IPAddress flowIP(192, 168, 88, 100);
IPAddress ultraIP(192, 168, 88, 130);
IPAddress contactor1IP(192, 168, 88, 120);

ModbusClientTCPasync MBPzem1(pzem1IP, 502);
ModbusClientTCPasync MBFlow(flowIP, 502);
ModbusClientTCPasync MBUltra(ultraIP, 502);
ModbusClientTCPasync MBContactor1(contactor1IP, 502);

float voltage1 = 0, current1 = 0, power1 = 0, energy1 = 0, frequency1 = 0, pf1 = 0;
#define JUMLAH_RUMAH 2
float flowRate[JUMLAH_RUMAH];
float totalLiter[JUMLAH_RUMAH];
uint16_t pulse[JUMLAH_RUMAH];
String statusFlow[JUMLAH_RUMAH];
float tarifPerM3 = 5000.0;
float totalM3[JUMLAH_RUMAH];
float totalTagihan[JUMLAH_RUMAH];
float totalTagihanBulan = 0;

float rekapPemasukan = 0.0;
float totalPengeluaran = 0.0;
String riwayatPengeluaran = "";

int dueYear = 2026, dueMonth = 5, dueDay = 31, dueHour = 23, dueMinute = 59;
float jarakAir = 0, levelAir = 0;
const float KAPASITAS_TORN = 15.0;
uint16_t nilaiTDS = 0, statusAir = 0;

uint16_t modePompa1 = 0, statusPompa1 = 0, modeMaster1 = 1, relayMaster1 = 0;

uint32_t totalRam = 0;
uint32_t freeRam = 0;
uint32_t usedRam = 0;

Preferences prefs;
// --- TAMBAHAN FITUR MAINTENANCE & LEAK DETECTION ---
unsigned long pompaStartMillis = 0;
float totalMenitOperasional = 0.0;
float batasServisMenit = 120.0;  // set awal 2 jam (120 menit)
float batasBawahAuto = 70.0;
float batasAtasAuto = 80.0;
bool terindikasiBocor = false;
float lastFlowWhenOff = 0.0;

void loadAutoFill() {
  prefs.begin("autofill", true);
  batasBawahAuto = prefs.getFloat("b_bawah", 70.0);
  batasAtasAuto = prefs.getFloat("b_atas", 80.0);
  prefs.end();
}

void saveAutoFill() {
  prefs.begin("autofill", false);
  prefs.putFloat("b_bawah", batasBawahAuto);
  prefs.putFloat("b_atas", batasAtasAuto);
  prefs.end();
}

void loadMaintenance() {
  prefs.begin("maintenance", true);
  totalMenitOperasional = prefs.getFloat("menit_op", 0.0);
  batasServisMenit = prefs.getFloat("b_servis", 120.0);
  prefs.end();
}
void saveMaintenance() {
  prefs.begin("maintenance", false);
  prefs.putFloat("menit_op", totalMenitOperasional);
  prefs.putFloat("b_servis", batasServisMenit);
  prefs.end();
}

String jadwalMulai = "05:00", jadwalSelesai = "06:00";
bool jadwalAktif = false, rtcSudahDiset = false;
int lastScheduleMinute = -1;
bool scheduleRelayState = false;

// Fungsi Helper untuk Mengirim CORS Header
void sendCORS(int code, String contentType, String content) {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "*");
  server.send(code, contentType, content);
}

void sendRedirect(String path) {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Location", path);
  server.send(302, "text/plain", "");
}

void loadJadwal() {
  prefs.begin("jadwal", true);
  jadwalMulai = prefs.getString("mulai", "05:00");
  jadwalSelesai = prefs.getString("selesai", "06:00");
  jadwalAktif = prefs.getBool("aktif", false);
  prefs.end();
}
void saveJadwal() {
  prefs.begin("jadwal", false);
  prefs.putString("mulai", jadwalMulai);
  prefs.putString("selesai", jadwalSelesai);
  prefs.putBool("aktif", jadwalAktif);
  prefs.end();
}
void loadKeuangan() {
  prefs.begin("keuangan", true);
  rekapPemasukan = prefs.getFloat("rekap", 0.0);
  totalPengeluaran = prefs.getFloat("pengeluaran", 0.0);
  riwayatPengeluaran = prefs.getString("riwayat", "");
  dueYear = prefs.getInt("d_year", 2026);
  dueMonth = prefs.getInt("d_month", 5);
  dueDay = prefs.getInt("d_day", 31);
  dueHour = prefs.getInt("d_hour", 23);
  dueMinute = prefs.getInt("d_min", 59);
  prefs.end();
}
void saveRekapPemasukan(float val) {
  rekapPemasukan = val;
  prefs.begin("keuangan", false);
  prefs.putFloat("rekap", rekapPemasukan);
  prefs.end();
}
void saveJatuhTempo(int y, int m, int d, int h, int min) {
  dueYear = y;
  dueMonth = m;
  dueDay = d;
  dueHour = h;
  dueMinute = min;
  prefs.begin("keuangan", false);
  prefs.putInt("d_year", y);
  prefs.putInt("d_month", m);
  prefs.putInt("d_day", d);
  prefs.putInt("d_hour", h);
  prefs.putInt("d_min", min);
  prefs.end();
}
void tambahPengeluaran(String tanggal, float nominal, String ket) {
  totalPengeluaran += nominal;
  String entry = "<tr><td>" + tanggal + "</td><td>" + ket + "</td><td>Rp " + String((long)nominal) + "</td></tr>";
  riwayatPengeluaran = entry + riwayatPengeluaran;
  prefs.begin("keuangan", false);
  prefs.putFloat("pengeluaran", totalPengeluaran);
  prefs.putString("riwayat", riwayatPengeluaran);
  prefs.end();
}
int timeToMinute(const String& t) {
  if (t.length() < 5) return -1;
  int jam = t.substring(0, 2).toInt();
  int menit = t.substring(3, 5).toInt();
  return jam * 60 + menit;
}
bool waktuDalamJadwal(int sekarang, int mulai, int selesai) {
  if (mulai == selesai) return false;
  if (mulai < selesai) return sekarang >= mulai && sekarang < selesai;
  return sekarang >= mulai || sekarang < selesai;
}
void loadHarga() {
  prefs.begin("harga", true);
  tarifPerM3 = prefs.getFloat("tarif", 5000.0);
  prefs.end();
  if (tarifPerM3 <= 0) tarifPerM3 = 5000.0;
}

// Handler Modbus
void handlePzem1(ModbusMessage msg, uint32_t token) {
  uint16_t reg[6];
  for (int i = 0; i < 6; i++) msg.get(3 + (i * 2), reg[i]);
  voltage1 = reg[0] / 10.0;
  current1 = reg[1] / 100.0;
  power1 = reg[2];
  energy1 = reg[3] / 100.0;
  frequency1 = reg[4] / 10.0;
  pf1 = reg[5] / 100.0;
}
void handleFlow(ModbusMessage msg, uint32_t token) {
  uint16_t reg;
  for (int i = 0; i < JUMLAH_RUMAH; i++) {
    msg.get(3 + (i * 6), reg);
    flowRate[i] = reg / 100.0;
    msg.get(5 + (i * 6), reg);
    totalLiter[i] = reg / 100.0;
    msg.get(7 + (i * 6), reg);
    pulse[i] = reg;
    statusFlow[i] = (flowRate[i] > 0) ? "Mengalir" : "Tidak Mengalir";
    totalM3[i] = totalLiter[i] / 1000.0;
    totalTagihan[i] = totalM3[i] * tarifPerM3;
  }
  totalTagihanBulan = 0;
  for (int i = 0; i < JUMLAH_RUMAH; i++) totalTagihanBulan += totalTagihan[i];
}
void handleUltra(ModbusMessage msg, uint32_t token) {
  uint16_t reg;
  msg.get(3, reg);
  jarakAir = reg / 100.0;
  msg.get(5, reg);
  levelAir = reg / 1.0;
  msg.get(7, reg);
  nilaiTDS = reg;
  msg.get(9, reg);
  statusAir = reg;
}
void handleContactor1(ModbusMessage msg, uint32_t token) {
  uint16_t reg;
  msg.get(3, reg);
  modePompa1 = reg;
  msg.get(5, reg);
  statusPompa1 = reg;
}
void kirimModeContactor1(uint16_t mode) {
  MBContactor1.addRequest(millis(), 1, 6, 0, mode);
}
void kirimRelayContactor1(uint16_t relay) {
  MBContactor1.addRequest(millis(), 1, 6, 1, relay);
}
void handleError(Error error, uint32_t token) {}

time_t getDueEpoch() {
  struct tm t = { 0 };
  t.tm_year = dueYear - 1900;
  t.tm_mon = dueMonth - 1;
  t.tm_mday = dueDay;
  t.tm_hour = dueHour;
  t.tm_min = dueMinute;
  t.tm_sec = 0;
  return mktime(&t);
}

// API Status & Data untuk Frontend Terpisah
void handleStatusAPI() {
  char dueStr[32];
  snprintf(dueStr, sizeof(dueStr), "%04d-%02d-%02d %02d:%02d", dueYear, dueMonth, dueDay, dueHour, dueMinute);

  time_t currentTime = time(nullptr);
  time_t dueTime = getDueEpoch();
  float totalTunggakan = (currentTime > dueTime && currentTime > 1000000000) ? totalTagihanBulan : 0.0;

  float sesiBerjalanMenit = 0.0;
  if (statusPompa1 == 1 && pompaStartMillis >0) {
    sesiBerjalanMenit = (float)(millis() - pompaStartMillis) / 60000.0;
  }
  float totalRealtimeMenit = totalMenitOperasional + sesiBerjalanMenit;

  String json = "{";
  json += "\"modeMaster\":" + String(modeMaster1);
  json += ",\"statusPompa\":" + String(statusPompa1);
  json += ",\"jadwalAktif\":" + String(jadwalAktif ? 1 : 0);
  json += ",\"jadwalMulai\":\"" + jadwalMulai + "\"";
  json += ",\"jadwalSelesai\":\"" + jadwalSelesai + "\"";
  json += ",\"tarif\":" + String(tarifPerM3, 0);
  json += ",\"rekap\":" + String(rekapPemasukan, 2);
  json += ",\"totalPengeluaran\":" + String(totalPengeluaran, 2);
  json += ",\"riwayatPengeluaran\":\"" + riwayatPengeluaran + "\"";
  json += ",\"tagihanBulan\":" + String(totalTagihanBulan, 2);
  json += ",\"m3_0\":" + String(totalM3[0], 3);
  json += ",\"tagihan_0\":" + String(totalTagihan[0], 2);
  json += ",\"m3_1\":" + String(totalM3[1], 3);
  json += ",\"tagihan_1\":" + String(totalTagihan[1], 2);
  json += ",\"dueStr\":\"" + String(dueStr) + "\"";
  json += ",\"tunggakan\":" + String(totalTunggakan, 2);
  json += ",\"liter_0\":" + String(totalLiter[0], 2);
  json += ",\"liter_1\":" + String(totalLiter[1], 2);
  json += ",\"menitOperasional\":" + String(totalRealtimeMenit, 1);
  json += ",\"batasServis\":" + String(batasServisMenit, 1);
  json += ",\"batasBawahAuto\":" + String(batasBawahAuto, 1);
  json += ",\"batasAtasAuto\":" + String(batasAtasAuto, 1);
  json += ",\"statusBocor\":" + String(terindikasiBocor ? 1 : 0);
  json += ",\"flowLeakVal\":" + String(lastFlowWhenOff, 2);
  json += ",\"ramTotal\":" + String(totalRam);
  json += ",\"ramUsed\":" + String(usedRam);
  json += ",\"ramFree\":" + String(freeRam);
  json += "}";

  sendCORS(200, "application/json", json);
}

void handleUSTDSData() {
  String json = "{\"jarak\":" + String(jarakAir, 2) + ",\"level\":" + String(levelAir, 1) + ",\"tds\":" + String(nilaiTDS) + ",\"status\":" + String(statusAir) + "}";
  sendCORS(200, "application/json", json);
}
void handlePzemData() {
  String json = "{\"v\":" + String(voltage1, 1) + ",\"i\":" + String(current1, 2) + ",\"p\":" + String(power1, 0) + ",\"e\":" + String(energy1, 2) + ",\"f\":" + String(frequency1, 1) + ",\"pf\":" + String(pf1, 2) + "}";
  sendCORS(200, "application/json", json);
}
void handleFlowData() {
  String json = "{\"flow0\":" + String(flowRate[1], 2) + ",\"liter0\":" + String(totalLiter[1], 2) + ",\"pulse0\":" + String(pulse[1]) + ",\"status0\":\"" + statusFlow[1] + "\"}";
  sendCORS(200, "application/json", json);
}

// Endpoint Kontrol & Aksi
void handleAuto() {
  modeMaster1 = 1;
  jadwalAktif = false;
  saveJadwal();
  kirimModeContactor1(1);
  sendCORS(200, "text/plain", "OK");
}
void handleManual() {
  modeMaster1 = 0;
  jadwalAktif = false;
  saveJadwal();
  kirimModeContactor1(0);
  sendCORS(200, "text/plain", "OK");
}
void handleOn() {
  if (modeMaster1 == 0) {
    relayMaster1 = 1;
    statusPompa1 = 1;
    kirimRelayContactor1(1);
  }
  sendCORS(200, "text/plain", "OK");
}
void handleOff() {
  if (modeMaster1 == 0) {
    relayMaster1 = 0;
    statusPompa1 = 0;
    kirimRelayContactor1(0);
  }
  sendCORS(200, "text/plain", "OK");
}

void syncRTCFromBrowser() {
  if (server.hasArg("ts")) {
    time_t epoch = (time_t)atoll(server.arg("ts").c_str());
    struct timeval tv = { epoch, 0 };
    settimeofday(&tv, nullptr);
    rtcSudahDiset = true;
  }
  sendCORS(200, "text/plain", "RTC OK");
}

void handleSaveJadwal() {
  if (server.hasArg("mulai") && server.hasArg("selesai")) {
    jadwalMulai = server.arg("mulai");
    jadwalSelesai = server.arg("selesai");
    jadwalAktif = true;
    saveJadwal();
    modeMaster1 = 1;
    kirimModeContactor1(1);
  }
  sendCORS(200, "text/plain", "OK");
}
void handleDisableJadwal() {
  jadwalAktif = false;
  saveJadwal();
  modeMaster1 = 1;
  kirimModeContactor1(1);
  sendCORS(200, "text/plain", "OK");
}
void handleSaveHarga() {
  if (server.hasArg("harga")) {
    tarifPerM3 = server.arg("harga").toFloat();
    prefs.begin("harga", false);
    prefs.putFloat("tarif", tarifPerM3);
    prefs.end();
  }
  sendCORS(200, "text/plain", "OK");
}
void handleSaveRekap() {
  if (server.hasArg("rekap")) saveRekapPemasukan(server.arg("rekap").toFloat());
  sendCORS(200, "text/plain", "OK");
}
void handleSaveJatuhTempoRoute() {
  if (server.hasArg("tahun") && server.hasArg("bulan") && server.hasArg("tanggal"))
    saveJatuhTempo(server.arg("tahun").toInt(), server.arg("bulan").toInt(), server.arg("tanggal").toInt(), dueHour, dueMinute);
  sendCORS(200, "text/plain", "OK");
}
void handleSavePengeluaranRoute() {
  if (server.hasArg("tanggal") && server.hasArg("nominal") && server.hasArg("keterangan"))
    tambahPengeluaran(server.arg("tanggal"), server.arg("nominal").toFloat(), server.arg("keterangan"));
  sendCORS(200, "text/plain", "OK");
}
void handleResetPemasukan() {
  saveRekapPemasukan(0.0);
  sendCORS(200, "text/plain", "OK");
}
void handleResetPengeluaran() {
  totalPengeluaran = 0.0;
  riwayatPengeluaran = "";
  prefs.begin("keuangan", false);
  prefs.putFloat("pengeluaran", 0.0);
  prefs.putString("riwayat", "");
  prefs.end();
  sendCORS(200, "text/plain", "OK");
}
void handleResetNeraca() {
  saveRekapPemasukan(0.0);
  handleResetPengeluaran();
  sendCORS(200, "text/plain", "OK");
}
void handleResetServis() {
  totalMenitOperasional = 0.0;
  saveMaintenance();
  sendCORS(200, "text/plain", "OK");
}

void handleSaveBatasServis() {
  if (server.hasArg("jam") && server.hasArg("menit")) {
        float jam = server.arg("jam").toFloat();
        float menit = server.arg("menit").toFloat();
        batasServisMenit = (jam * 60.0) + menit; // Konversi total ke menit
        saveMaintenance();
    }
    sendCORS(200, "text/plain", "OK");
}

void handleSaveBatasAutoFill() {
  if (server.hasArg("bawah") && server.hasArg("atas")) {
    batasBawahAuto = server.arg("bawah").toFloat();
    batasAtasAuto = server.arg("atas").toFloat();
    saveAutoFill();
  }
  sendCORS(200, "text/plain", "OK");
}

void jalankanJadwal() {
  if (!jadwalAktif || modeMaster1 != 1)
    return;

  struct tm now;
  time_t currentTime = time(nullptr);
  if (currentTime < 1000000000)
    return;

  localtime_r(&currentTime, &now);

  int sekarang = now.tm_hour * 60 + now.tm_min;
  int mulai = timeToMinute(jadwalMulai);
  int selesai = timeToMinute(jadwalSelesai);

  if (mulai < 0 || selesai < 0 || mulai == selesai)
    return;

  bool harusON = waktuDalamJadwal(sekarang, mulai, selesai);

  if (harusON != scheduleRelayState || lastScheduleMinute != sekarang) {
    scheduleRelayState = harusON;
    lastScheduleMinute = sekarang;

    if (harusON) {
      kirimRelayContactor1(1);
      relayMaster1 = 1;
    } else {
      kirimRelayContactor1(0);
      relayMaster1 = 0;
    }
  }
}

void setup() {
  Serial.begin(115200);
  setenv("TZ", "WIB-7", 1);
  tzset();
  loadJadwal();
  loadHarga();
  loadKeuangan();
  loadMaintenance();
  loadAutoFill();

  WiFi.mode(WIFI_STA);
  IPAddress local_IP(192, 168, 88, 90), gateway(192, 168, 88, 1), subnet(255, 255, 255, 0);
  WiFi.config(local_IP, gateway, subnet);
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) { delay(500); }

  MBPzem1.onDataHandler(&handlePzem1);
  MBPzem1.connect();
  MBFlow.onDataHandler(&handleFlow);
  MBFlow.connect();
  MBUltra.onDataHandler(&handleUltra);
  MBUltra.connect();
  MBContactor1.onDataHandler(&handleContactor1);
  MBContactor1.connect();

  // Daftarkan Endpoint API & Aksi dengan dukungan CORS
  server.on("/api/status", handleStatusAPI);
  server.on("/api/ustds", handleUSTDSData);
  server.on("/api/pzem", handlePzemData);
  server.on("/api/flow", handleFlowData);
  server.on("/auto", handleAuto);
  server.on("/manual", handleManual);
  server.on("/on", handleOn);
  server.on("/off", handleOff);
  server.on("/syncRTC", syncRTCFromBrowser);
  server.on("/saveSchedule", handleSaveJadwal);
  server.on("/disableSchedule", handleDisableJadwal);
  server.on("/saveHarga", handleSaveHarga);
  server.on("/saveRekap", handleSaveRekap);
  server.on("/saveJatuhTempo", handleSaveJatuhTempoRoute);
  server.on("/savePengeluaran", handleSavePengeluaranRoute);
  server.on("/resetPemasukan", handleResetPemasukan);
  server.on("/resetPengeluaran", handleResetPengeluaran);
  server.on("/resetNeraca", handleResetNeraca);
  server.on("/resetServis", handleResetServis);
  server.on("/saveBatasServis", handleSaveBatasServis);
  server.on("/saveBatasAutoFill", handleSaveBatasAutoFill);

  server.begin();
}

void loop() {
  server.handleClient();
  jalankanJadwal();  // Menjalankan pengecekan waktu jadwal otomatis

  static unsigned long lastPzem1 = 0;
  static unsigned long lastFlow = 0;
  static unsigned long lastUltra = 0;
  static unsigned long lastContactor1 = 0;

  // --- LOGIKA TAMBAHAN DI LOOP ---
  // 1. Logika Runtime-Based Maintenance
  static bool prevStatusPompa = false;
  if (statusPompa1 == 1 && !prevStatusPompa) {
    prevStatusPompa = true;
    pompaStartMillis = millis();
  } else if (statusPompa1 == 0 && prevStatusPompa) {
    prevStatusPompa = false;
    if (pompaStartMillis > 0) {
      unsigned long durasiMillis = millis() - pompaStartMillis;
      float menitBaru = (float)durasiMillis / 60000.0;
      totalMenitOperasional += menitBaru;
      saveMaintenance();
      pompaStartMillis = 0;
    }
  }

  // 2. Logika Smart Leak Detection
  float totalDebitSekarang = flowRate[0] + flowRate[1];
  if (statusPompa1 == 0) {
    if (totalDebitSekarang > 0.2) {  // Toleransi minimal 0.2 L/min
      terindikasiBocor = true;
      lastFlowWhenOff = totalDebitSekarang;
    } else {
      terindikasiBocor = false;
      lastFlowWhenOff = 0.0;
    }
  } else {
    terindikasiBocor = false;
  }
  // --------------------------------

  delay(200);

  // Polling data PZEM
  if (millis() - lastPzem1 >= 6000) {
    lastPzem1 = millis();
    MBPzem1.addRequest(lastPzem1, 1, READ_HOLD_REGISTER, 0, 6);
  }

  // Polling data Flow Meter
  if (millis() - lastFlow >= 4000) {
    lastFlow = millis();
    MBFlow.addRequest(lastFlow, 1, READ_HOLD_REGISTER, 0, JUMLAH_RUMAH * 3);

    for (int i = 0; i < JUMLAH_RUMAH; i++) {
      totalM3[i] = totalLiter[i] / 1000.0;
      totalTagihan[i] = totalM3[i] * tarifPerM3;
    }
  }

  // Polling data Ultrasonic/TDS
  if (millis() - lastUltra >= 500) {
    lastUltra = millis();
    MBUltra.addRequest(lastUltra, 1, READ_HOLD_REGISTER, 0, 4);
  }

  // Polling status Contactor / Pompa (PENTING AGAR STATUS WEB BERUBAH)
  if (millis() - lastContactor1 >= 2000) {
    lastContactor1 = millis();
    MBContactor1.addRequest(lastContactor1, 1, READ_HOLD_REGISTER, 0, 2);

    // Logika Auto jika level air kurang/lebih dan jadwal tidak aktif
    if (modeMaster1 == 1 && !jadwalAktif) {
      if (levelAir >= batasAtasAuto && statusPompa1 == 1) {
        kirimRelayContactor1(0);
      }
      if (levelAir <= batasBawahAuto && statusPompa1 == 0) {
        kirimRelayContactor1(1);
      }
    }
  }

  // --- MONITORING RAM ESP32 ---
  static unsigned long lastRamCheck = 0;
  if (millis() - lastRamCheck >= 5000) { // Cek setiap 5 detik
    lastRamCheck = millis();
    
    totalRam = ESP.getHeapSize();
    freeRam = ESP.getFreeHeap();
    usedRam = totalRam - freeRam;
    float persenUsed = ((float)usedRam / totalRam) * 100.0;

    Serial.print("[RAM] Total: ");
    Serial.print(totalRam);
    Serial.print(" bytes | Terpakai: ");
    Serial.print(usedRam);
    Serial.print(" bytes (");
    Serial.print(persenUsed, 1);
    Serial.print("%) | Sisa Free: ");
    Serial.println(freeRam);
  }

  delay(200);
}