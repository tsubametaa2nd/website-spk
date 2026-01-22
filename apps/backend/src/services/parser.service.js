import { parse } from "csv-parse/sync";
import ExcelJS from "exceljs";

export function parseCSV(content) {
  try {
    const records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relaxColumnCount: true,
    });
    return records;
  } catch (error) {
    throw new Error(`Gagal parsing CSV: ${error.message}`);
  }
}

export async function parseExcel(buffer) {
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      throw new Error("Tidak ada worksheet ditemukan dalam file Excel");
    }

    const data = [];
    const headers = [];

    worksheet.getRow(1).eachCell((cell, colNumber) => {
      headers[colNumber] = cell.value
        ? String(cell.value).trim()
        : `Column${colNumber}`;
    });

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;

      const rowData = {};
      row.eachCell((cell, colNumber) => {
        const header = headers[colNumber];
        if (header) {
          let value = cell.value;
          if (value && typeof value === "object") {
            if (value.result !== undefined) {
              value = value.result;
            } else if (value.text !== undefined) {
              value = value.text;
            } else if (value.richText !== undefined) {
              value = value.richText.map((rt) => rt.text).join("");
            }
          }
          rowData[header] = value !== null && value !== undefined ? value : "";
        }
      });

      if (Object.values(rowData).some((v) => v !== "")) {
        data.push(rowData);
      }
    });

    return data;
  } catch (error) {
    throw new Error(`Gagal parsing Excel: ${error.message}`);
  }
}

export async function parseGoogleSheets(url) {
  try {
    let csvUrl = url;

    if (url.includes("/edit")) {
      csvUrl = url.replace(/\/edit.*$/, "/export?format=csv");
    } else if (url.includes("/view")) {
      csvUrl = url.replace(/\/view.*$/, "/export?format=csv");
    } else if (!url.includes("/export")) {
      csvUrl = url.replace(/\?.*$/, "") + "/export?format=csv";
    }

    const gidMatch = url.match(/gid=(\d+)/);
    if (gidMatch && !csvUrl.includes("gid=")) {
      csvUrl += `&gid=${gidMatch[1]}`;
    }

    const response = await fetch(csvUrl);

    if (!response.ok) {
      throw new Error(
        `Tidak dapat mengakses Google Sheets: ${response.status} ${response.statusText}`,
      );
    }

    const csvContent = await response.text();

    if (
      csvContent.includes("<!DOCTYPE html>") ||
      csvContent.includes("<html")
    ) {
      throw new Error(
        "Google Sheets tidak dapat diakses. Pastikan sheet bersifat publik (Anyone with the link can view).",
      );
    }

    return parseCSV(csvContent);
  } catch (error) {
    throw new Error(`Gagal mengakses Google Sheets: ${error.message}`);
  }
}

export function normalizeStudentData(rawData) {
  const columnMappings = {
    nama: [
      "nama",
      "name",
      "nama_siswa",
      "nama siswa",
      "student_name",
      "student",
    ],

    c1: [
      "c1",
      "akumulasi_nilai",
      "akumulasi nilai",
      "nilai_akumulasi",
      "akumulasi",
      "nilai_gabungan",
      "nilai gabungan",
      "total_nilai",
      "total nilai",
      "akuntansi_perbankan",
      "layanan_perbankan",
      "pengelolaan_kas",
    ],

    c2: [
      "c2",
      "sikap",
      "penilaian_sikap",
      "penilaian sikap",
      "nilai_sikap",
      "attitude",
    ],

    c4: [
      "c4",
      "sertifikasi",
      "nilai_sertifikasi",
      "nilai sertifikasi",
      "certification",
      "pelatihan_cs",
      "pelatihan_teller",
      "cs_teller",
    ],

    c5: [
      "c5",
      "rekomendasi",
      "rekomendasi_guru",
      "rekomendasi guru",
      "teacher_recommendation",
      "rec",
      "recommendation",
    ],
  };

  return rawData
    .map((row) => {
      const normalized = {};

      for (const [targetKey, possibleNames] of Object.entries(columnMappings)) {
        for (const name of possibleNames) {
          const matchingKey = Object.keys(row).find(
            (k) => k.toLowerCase().trim() === name.toLowerCase(),
          );

          if (
            matchingKey &&
            row[matchingKey] !== undefined &&
            row[matchingKey] !== ""
          ) {
            if (targetKey === "nama") {
              normalized[targetKey] = String(row[matchingKey]).trim();
            } else {
              normalized[targetKey] = parseFloat(row[matchingKey]) || 0;
            }
            break;
          }
        }
      }

      return normalized;
    })
    .filter((row) => row.nama);
}

export function normalizeAlternativesData(rawData) {
  const columnMappings = {
    kode: ["kode", "code", "id", "alternatif", "alt", "kode_dudi", "dudi_code"],
    nama: [
      "nama",
      "name",
      "nama_dudi",
      "dudi",
      "tempat_magang",
      "tempat magang",
      "perusahaan",
      "company",
      "bank",
    ],
    jarak: ["jarak", "distance", "jarak_km", "jarak (km)", "km", "c3"],
  };

  return rawData
    .map((row) => {
      const normalized = {};

      for (const [targetKey, possibleNames] of Object.entries(columnMappings)) {
        for (const name of possibleNames) {
          const matchingKey = Object.keys(row).find(
            (k) => k.toLowerCase().trim() === name.toLowerCase(),
          );

          if (
            matchingKey &&
            row[matchingKey] !== undefined &&
            row[matchingKey] !== ""
          ) {
            if (targetKey === "jarak") {
              normalized[targetKey] =
                parseFloat(String(row[matchingKey]).replace(",", ".")) || 0;
            } else {
              normalized[targetKey] = String(row[matchingKey]).trim();
            }
            break;
          }
        }
      }

      return normalized;
    })
    .filter((row) => row.nama);
}

export default {
  parseCSV,
  parseExcel,
  parseGoogleSheets,
  normalizeStudentData,
  normalizeAlternativesData,
};
