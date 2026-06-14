/*
 * ============================================================
 *  Humidity Monitor — ESP32 + DHT11
 *  Mengirim data suhu & kelembaban ke server via HTTP POST
 * ============================================================
 *  Library yang dibutuhkan (instal via Library Manager):
 *    - DHT sensor library by Adafruit
 *    - Adafruit Unified Sensor by Adafruit
 *    - ArduinoJson by Benoit Blanchon
 * ============================================================
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <DHT.h>
#include <ArduinoJson.h>

// ── Konfigurasi WiFi ──────────────────────────────────────────
const char* ssid     = "itel S23";      // ← ganti
const char* password = "ihihih10";  // ← ganti

// ── URL Server ────────────────────────────────────────────────
// Jika menggunakan Render.com, ganti dengan URL deployment kamu:
// const char* serverURL = "https://humidity-monitor-xxxx.onrender.com/api/data";
// Jika lokal (testing dengan laptop di WiFi yang sama):
const char* serverURL = "https://humidity-monitor-production.up.railway.app/api/data"; // ← ganti IP laptop

// ── Konfigurasi DHT11 ─────────────────────────────────────────
#define DHTPIN  4        // GPIO pin tempat DATA DHT11 terhubung
#define DHTTYPE DHT11    // Tipe sensor (DHT11 atau DHT22)

DHT dht(DHTPIN, DHTTYPE);

// ── Konfigurasi ───────────────────────────────────────────────
const char* DEVICE_ID       = "ESP32-01";  // Nama device
const int   SEND_INTERVAL   = 5000;        // Kirim tiap 5 detik (ms)
const int   WIFI_TIMEOUT    = 20000;       // Timeout WiFi 20 detik

// ── LED Built-in untuk status ─────────────────────────────────
#define LED_BUILTIN 2

// ── Variabel Global ───────────────────────────────────────────
unsigned long lastSendTime = 0;
int failCount = 0;

// ─────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  delay(500);

  pinMode(LED_BUILTIN, OUTPUT);
  digitalWrite(LED_BUILTIN, LOW);

  Serial.println("\n╔════════════════════════════════════╗");
  Serial.println("║   Humidity Monitor — ESP32+DHT11   ║");
  Serial.println("╚════════════════════════════════════╝");

  // Inisialisasi DHT
  dht.begin();
  Serial.println("[DHT] Sensor diinisialisasi pada GPIO " + String(DHTPIN));

  // Koneksi WiFi
  connectWiFi();
}

// ─────────────────────────────────────────────────────────────
void loop() {
  // Reconnect jika WiFi terputus
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[WiFi] Koneksi terputus, mencoba reconnect...");
    connectWiFi();
    return;
  }

  unsigned long now = millis();
  if (now - lastSendTime >= SEND_INTERVAL) {
    lastSendTime = now;
    readAndSend();
  }
}

// ─────────────────────────────────────────────────────────────
void connectWiFi() {
  Serial.print("[WiFi] Menghubungkan ke ");
  Serial.print(ssid);

  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);

  unsigned long startTime = millis();
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
    if (millis() - startTime > WIFI_TIMEOUT) {
      Serial.println("\n[WiFi] ✗ Gagal terhubung! Cek SSID/password.");
      // Blink LED tanda error
      for (int i = 0; i < 5; i++) {
        digitalWrite(LED_BUILTIN, HIGH); delay(200);
        digitalWrite(LED_BUILTIN, LOW);  delay(200);
      }
      return;
    }
  }

  Serial.println("\n[WiFi] ✓ Terhubung!");
  Serial.print("[WiFi] IP Address: ");
  Serial.println(WiFi.localIP());
  digitalWrite(LED_BUILTIN, HIGH); // LED nyala = WiFi OK
}

// ─────────────────────────────────────────────────────────────
void readAndSend() {
  // Baca sensor DHT11
  float humidity    = dht.readHumidity();
  float temperature = dht.readTemperature(); // Celsius

  // Cek apakah pembacaan valid
  if (isnan(humidity) || isnan(temperature)) {
    Serial.println("[DHT] ✗ Gagal membaca sensor! Cek kabel.");
    failCount++;
    // Blink LED 2x tanda error sensor
    digitalWrite(LED_BUILTIN, LOW); delay(100);
    digitalWrite(LED_BUILTIN, HIGH); delay(100);
    digitalWrite(LED_BUILTIN, LOW); delay(100);
    digitalWrite(LED_BUILTIN, HIGH);
    return;
  }

  failCount = 0;

  // Tampilkan di Serial Monitor
  Serial.printf("[Sensor] T: %.1f°C | H: %.1f%% | ", temperature, humidity);

  // Buat JSON payload
  StaticJsonDocument<128> doc;
  doc["temperature"] = round(temperature * 10) / 10.0;
  doc["humidity"]    = round(humidity * 10) / 10.0;
  doc["device_id"]   = DEVICE_ID;

  String payload;
  serializeJson(doc, payload);

  // Kirim HTTP POST
  HTTPClient http;
  http.begin(serverURL);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(8000);

  int httpCode = http.POST(payload);

  if (httpCode == 200 || httpCode == 201) {
    Serial.printf("✓ Terkirim (HTTP %d)\n", httpCode);
    // Blink LED sekali = sukses
    digitalWrite(LED_BUILTIN, LOW);  delay(80);
    digitalWrite(LED_BUILTIN, HIGH);
  } else if (httpCode < 0) {
    Serial.printf("✗ Gagal: %s\n", http.errorToString(httpCode).c_str());
  } else {
    Serial.printf("✗ Server error: HTTP %d\n", httpCode);
  }

  http.end();
}
