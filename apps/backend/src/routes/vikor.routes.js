import express from "express";
import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";
import { stringify } from "csv-stringify/sync";
import fs from "fs";

import {
  calculateVIKOR,
  validateStudentData,
  validateAlternativesData,
} from "../services/vikor.service.js";

import {
  parseCSV,
  parseExcel,
  parseGoogleSheets,
  normalizeStudentData,
  normalizeAlternativesData,
} from "../services/parser.service.js";

import {
  fetchKriteriaData,
  fetchJarakData,
  fetchCompleteData,
  validateConnection,
} from "../services/googleSheets.service.js";

import { asyncHandler, ApiError } from "../middleware/errorHandler.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "text/csv",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];
    const allowedExtensions = [".csv", ".xls", ".xlsx"];
    const ext = path.extname(file.originalname).toLowerCase();

    if (
      allowedTypes.includes(file.mimetype) ||
      allowedExtensions.includes(ext)
    ) {
      cb(null, true);
    } else {
      cb(
        new ApiError(
          400,
          "Format file tidak didukung. Gunakan CSV atau Excel (.xls/.xlsx)",
        ),
      );
    }
  },
});

let lastCalculationResult = null;

router.post(
  "/process-vikor",
  asyncHandler(async (req, res) => {
    const {
      students,
      alternatives,
      weights,
      vParameter = 0.5,
      jarakPerSiswa = null,
    } = req.body;

    if (!students || !Array.isArray(students) || students.length === 0) {
      throw new ApiError(400, "Data siswa diperlukan dan tidak boleh kosong");
    }

    if (
      !alternatives ||
      !Array.isArray(alternatives) ||
      alternatives.length === 0
    ) {
      throw new ApiError(
        400,
        "Data alternatif (DUDI) diperlukan dan tidak boleh kosong",
      );
    }

    let parsedWeights = [0.3, 0.2, 0.1, 0.25, 0.15];

    if (weights) {
      if (typeof weights === "string") {
        parsedWeights = weights.split(",").map((w) => parseFloat(w.trim()));
      } else if (Array.isArray(weights)) {
        parsedWeights = weights.map((w) => parseFloat(w));
      }
    }

    const weightsSum = parsedWeights.reduce((sum, w) => sum + w, 0);
    if (Math.abs(weightsSum - 1) > 0.01) {
      throw new ApiError(
        400,
        `Total bobot harus sama dengan 1. Total saat ini: ${weightsSum.toFixed(2)}`,
      );
    }

    if (parsedWeights.length !== 5) {
      throw new ApiError(400, "Harus ada tepat 5 bobot kriteria (C1-C5)");
    }

    const studentErrors = validateStudentData(students);
    if (studentErrors.length > 0) {
      throw new ApiError(
        400,
        `Validasi data siswa gagal: ${studentErrors.join("; ")}`,
      );
    }

    if (!jarakPerSiswa) {
      const altErrors = validateAlternativesData(alternatives);
      if (altErrors.length > 0) {
        throw new ApiError(
          400,
          `Validasi data alternatif gagal: ${altErrors.join("; ")}`,
        );
      }
    }

    const result = calculateVIKOR(
      students,
      alternatives,
      parsedWeights,
      vParameter,
      jarakPerSiswa,
    );

    lastCalculationResult = result;

    const summary = generateSummary(result);

    res.json({
      success: true,
      data: {
        ...result,
        summary,
      },
      timestamp: new Date().toISOString(),
    });
  }),
);

router.post(
  "/parse-google-sheets",
  asyncHandler(async (req, res) => {
    const { url, type } = req.body;

    if (!url) {
      throw new ApiError(400, "URL Google Sheets diperlukan");
    }

    if (!type || !["students", "alternatives"].includes(type)) {
      throw new ApiError(400, "Type harus 'students' atau 'alternatives'");
    }

    const rawData = await parseGoogleSheets(url);

    if (rawData.length === 0) {
      throw new ApiError(400, "Google Sheets kosong atau tidak dapat dibaca");
    }

    let normalizedData;
    if (type === "students") {
      normalizedData = normalizeStudentData(rawData);
    } else {
      normalizedData = normalizeAlternativesData(rawData);
    }

    res.json({
      success: true,
      data: normalizedData,
      rawColumns: Object.keys(rawData[0] || {}),
      rowCount: normalizedData.length,
    });
  }),
);

router.post(
  "/upload-file",
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new ApiError(400, "File tidak ditemukan");
    }

    const { type } = req.body;

    if (!type || !["students", "alternatives"].includes(type)) {
      throw new ApiError(400, "Type harus 'students' atau 'alternatives'");
    }

    const ext = path.extname(req.file.originalname).toLowerCase();
    let rawData;

    if (ext === ".csv") {
      const content = req.file.buffer.toString("utf-8");
      rawData = parseCSV(content);
    } else if (ext === ".xls" || ext === ".xlsx") {
      rawData = await parseExcel(req.file.buffer);
    } else {
      throw new ApiError(400, "Format file tidak didukung");
    }

    if (rawData.length === 0) {
      throw new ApiError(400, "File kosong atau tidak dapat dibaca");
    }

    let normalizedData;
    if (type === "students") {
      normalizedData = normalizeStudentData(rawData);
    } else {
      normalizedData = normalizeAlternativesData(rawData);
    }

    res.json({
      success: true,
      data: normalizedData,
      rawColumns: Object.keys(rawData[0] || {}),
      rowCount: normalizedData.length,
      fileName: req.file.originalname,
    });
  }),
);

router.get(
  "/download-csv",
  asyncHandler(async (req, res) => {
    if (!lastCalculationResult || !lastCalculationResult.qualifiedResults) {
      throw new ApiError(
        400,
        "Belum ada hasil perhitungan. Lakukan proses VIKOR terlebih dahulu.",
      );
    }

    const csvData = lastCalculationResult.qualifiedResults.map((result) => ({
      "Nama Siswa": result.siswa.nama,
      "Akumulasi Nilai (C1)": result.siswa.c1,
      "Penilaian Sikap (C2)": result.siswa.c2,
      "Nilai Sertifikasi (C4)": result.siswa.c4,
      "Rekomendasi Guru (C5)": result.siswa.c5,
      "Rekomendasi DUDI": result.rekomendasi.nama,
      "Kode DUDI": result.rekomendasi.kode,
      "Jarak (km)": result.rekomendasi.jarak,
      "Nilai S": result.rekomendasi.s,
      "Nilai R": result.rekomendasi.r,
      "Nilai Q": result.rekomendasi.q,
      Ranking: result.rekomendasi.ranking,
    }));

    lastCalculationResult.disqualifiedStudents.forEach((student) => {
      csvData.push({
        "Nama Siswa": student.nama,
        "Akumulasi Nilai (C1)": student.c1,
        "Penilaian Sikap (C2)": "-",
        "Nilai Sertifikasi (C4)": student.c4,
        "Rekomendasi Guru (C5)": "-",
        "Rekomendasi DUDI": "TIDAK LOLOS",
        "Kode DUDI": "-",
        "Jarak (km)": "-",
        "Nilai S": "-",
        "Nilai R": "-",
        "Nilai Q": "-",
        Ranking: "-",
        Keterangan: student.reason,
      });
    });

    const csvContent = stringify(csvData, {
      header: true,
      quoted_string: true,
    });

    const bom = "\ufeff";
    const csvWithBom = bom + csvContent;

    const fileName = `hasil_vikor_${new Date().toISOString().slice(0, 10)}.csv`;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.send(csvWithBom);
  }),
);

router.get("/default-data", (req, res) => {
  const sampleStudents = [
    { nama: "Ahmad Rizki", c1: 85, c2: 80, c4: 78, c5: 82 },
    { nama: "Siti Nurhaliza", c1: 90, c2: 85, c4: 88, c5: 90 },
    { nama: "Budi Santoso", c1: 75, c2: 78, c4: 72, c5: 75 },
    { nama: "Dewi Lestari", c1: 82, c2: 88, c4: 80, c5: 85 },
    { nama: "Eko Prasetyo", c1: 65, c2: 70, c4: 68, c5: 72 }, // Not qualified
    { nama: "Fajar Ramadhan", c1: 88, c2: 82, c4: 85, c5: 80 },
    { nama: "Gita Pertiwi", c1: 78, c2: 75, c4: 76, c5: 78 },
    { nama: "Hendra Wijaya", c1: 92, c2: 90, c4: 95, c5: 88 },
  ];

  const sampleAlternatives = [
    { kode: "A1", nama: "Bank BJB Syariah KC Jakarta (Soepomo)", jarak: 5.2 },
    { kode: "A2", nama: "Bank Jakarta KCP Matraman", jarak: 3.8 },
    { kode: "A3", nama: "Bank BRI KCP Saharjo", jarak: 4.5 },
    { kode: "A4", nama: "Bank Mandiri KCP Jatinegara", jarak: 6.1 },
    { kode: "A5", nama: "Bank BNI KCP Tebet", jarak: 2.9 },
  ];

  const defaultWeights = {
    weights: [0.3, 0.2, 0.1, 0.25, 0.15],
    labels: [
      "C1: Akumulasi Nilai",
      "C2: Penilaian Sikap",
      "C3: Jarak",
      "C4: Nilai Sertifikasi",
      "C5: Rekomendasi Guru",
    ],
    types: ["Benefit", "Benefit", "Cost", "Benefit", "Benefit"],
  };

  res.json({
    success: true,
    data: {
      students: sampleStudents,
      alternatives: sampleAlternatives,
      weights: defaultWeights,
      threshold: parseInt(process.env.MIN_THRESHOLD) || 70,
    },
  });
});

router.get(
  "/sheets/validate",
  asyncHandler(async (req, res) => {
    const { sheetId } = req.query;

    const validation = await validateConnection(sheetId);

    res.json({
      success: true,
      data: validation,
    });
  }),
);

router.get(
  "/sheets/kriteria",
  asyncHandler(async (req, res) => {
    const { sheetId } = req.query;

    const result = await fetchKriteriaData(sheetId);

    res.json({
      success: true,
      data: result.data,
      headers: result.headers,
      rowCount: result.rowCount,
    });
  }),
);

router.get(
  "/sheets/jarak",
  asyncHandler(async (req, res) => {
    const { sheetId } = req.query;

    const result = await fetchJarakData(sheetId);

    res.json({
      success: true,
      data: result.data,
      rowCount: result.rowCount,
    });
  }),
);

router.get(
  "/sheets/complete",
  asyncHandler(async (req, res) => {
    const { sheetId } = req.query;

    const result = await fetchCompleteData(sheetId);

    res.json({
      success: true,
      data: result.data,
      metadata: result.metadata,
    });
  }),
);

router.post(
  "/process-vikor-sheets",
  asyncHandler(async (req, res) => {
    const { sheetId, weights, vParameter = 0.5 } = req.body;

    const sheetsData = await fetchCompleteData(sheetId);
    const { students, alternatives, jarakPerSiswa } = sheetsData.data;

    if (!students || students.length === 0) {
      throw new ApiError(400, "Data siswa dari spreadsheet kosong");
    }

    if (!alternatives || alternatives.length === 0) {
      throw new ApiError(
        400,
        "Data alternatif (bank/tempat magang) dari spreadsheet kosong",
      );
    }

    let parsedWeights = [0.3, 0.2, 0.1, 0.25, 0.15];

    if (weights) {
      if (typeof weights === "string") {
        parsedWeights = weights.split(",").map((w) => parseFloat(w.trim()));
      } else if (Array.isArray(weights)) {
        parsedWeights = weights.map((w) => parseFloat(w));
      }
    }

    const weightsSum = parsedWeights.reduce((sum, w) => sum + w, 0);
    if (Math.abs(weightsSum - 1) > 0.01) {
      throw new ApiError(
        400,
        `Total bobot harus sama dengan 1. Total saat ini: ${weightsSum.toFixed(2)}`,
      );
    }

    if (parsedWeights.length !== 5) {
      throw new ApiError(400, "Harus ada tepat 5 bobot kriteria (C1-C5)");
    }

    const studentErrors = validateStudentData(students);
    if (studentErrors.length > 0) {
      throw new ApiError(
        400,
        `Validasi data siswa gagal: ${studentErrors.join("; ")}`,
      );
    }

    const result = calculateVIKOR(
      students,
      alternatives,
      parsedWeights,
      vParameter,
      jarakPerSiswa,
    );

    lastCalculationResult = result;

    const summary = generateSummary(result);

    res.json({
      success: true,
      data: {
        ...result,
        summary,
        sourceData: {
          studentCount: students.length,
          alternativeCount: alternatives.length,
          alternatives: alternatives,
        },
      },
      timestamp: new Date().toISOString(),
    });
  }),
);

function generateSummary(result) {
  const dudiDistribution = {};

  result.qualifiedResults.forEach((r) => {
    const dudiName = r.rekomendasi.nama;
    dudiDistribution[dudiName] = (dudiDistribution[dudiName] || 0) + 1;
  });

  return {
    totalSiswa: result.metadata.totalStudents,
    siswaLolos: result.metadata.qualifiedCount,
    siswaTidakLolos: result.metadata.disqualifiedCount,
    distribusiDUDI: dudiDistribution,
    bobotKriteria: result.metadata.weights.map((w, i) => ({
      kriteria: [
        "C1: Akumulasi Nilai",
        "C2: Penilaian Sikap",
        "C3: Jarak",
        "C4: Nilai Sertifikasi",
        "C5: Rekomendasi Guru",
      ][i],
      bobot: w,
      persentase: `${(w * 100).toFixed(0)}%`,
    })),
    batasMinimum: result.metadata.threshold,
    parameterV: result.metadata.vParameter,
  };
}

export default router;
