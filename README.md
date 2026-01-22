# SPK VIKOR - Sistem Pemilihan Tempat Magang

Sistem Pendukung Keputusan (SPK) untuk **Pemilihan Tempat Magang (DUDI)** menggunakan metode **VIKOR** untuk Program Keahlian Layanan Perbankan.

## 🎯 Fitur Utama

- **Input Data Fleksibel**: Google Sheets URL, upload CSV/Excel, atau data sampel
- **Algoritma VIKOR**: Perhitungan S, R, Q dengan normalisasi otomatis
- **Validasi Otomatis**: Filter siswa berdasarkan batas minimum C1 & C4 (≥70)
- **Visualisasi**: Grafik distribusi dan perbandingan alternatif
- **Narasi Akademik**: Output siap kutip untuk jurnal/laporan
- **Export CSV**: Download hasil rekomendasi

## 🏗️ Arsitektur

```
web-spk/
├── apps/
│   ├── backend/          # Express.js API
│   │   └── src/
│   │       ├── index.js
│   │       ├── routes/
│   │       ├── services/
│   │       └── middleware/
│   └── web/              # Astro Frontend
│       └── src/
│           ├── layouts/
│           ├── pages/
│           └── styles/
└── package.json          # Turborepo config
```

## 🚀 Setup Lokal

### 1. Install Dependencies

```bash
# Di root folder
npm install
```

### 2. Konfigurasi Environment

```bash
# Copy .env.example ke .env di folder backend
cp apps/backend/.env.example apps/backend/.env
```

### 3. Jalankan Development Server

```bash
# Jalankan backend & frontend bersamaan
npm run dev

# Atau jalankan terpisah:
cd apps/backend && npm run dev   # Backend: http://localhost:3001
cd apps/web && npm run dev       # Frontend: http://localhost:4321
```

## 📊 Kriteria Penilaian

| Kode | Kriteria          | Tipe    | Bobot | Keterangan                 |
| ---- | ----------------- | ------- | ----- | -------------------------- |
| C1   | Akumulasi Nilai   | Benefit | 30%   | Nilai akademik (wajib ≥70) |
| C2   | Penilaian Sikap   | Benefit | 20%   | Kedisiplinan & etika       |
| C3   | Jarak             | Cost    | 10%   | Jarak tempuh (km)          |
| C4   | Nilai Sertifikasi | Benefit | 25%   | CS & Teller (wajib ≥70)    |
| C5   | Rekomendasi Guru  | Benefit | 15%   | Penilaian guru             |

## 🏦 Alternatif DUDI Default

- A1: Bank BJB Syariah KC Jakarta (Soepomo)
- A2: Bank Jakarta KCP Matraman
- A3: Bank BRI KCP Saharjo
- A4: Bank Mandiri KCP Jatinegara
- A5: Bank BNI KCP Tebet

## 📡 API Endpoints

| Method | Endpoint                   | Deskripsi                     |
| ------ | -------------------------- | ----------------------------- |
| POST   | `/api/process-vikor`       | Proses perhitungan VIKOR      |
| POST   | `/api/parse-google-sheets` | Parse data dari Google Sheets |
| POST   | `/api/upload-file`         | Upload file CSV/Excel         |
| GET    | `/api/download-csv`        | Download hasil sebagai CSV    |
| GET    | `/api/default-data`        | Data sampel untuk testing     |

## 📚 Referensi

- Opricovic, S. (1998). Multicriteria Optimization of Civil Engineering Systems
- Opricovic, S., & Tzeng, G. H. (2004). Compromise solution by MCDM methods

---

**© 2024 Program Keahlian Layanan Perbankan**
