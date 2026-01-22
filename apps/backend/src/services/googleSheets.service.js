import { google } from "googleapis";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function getGoogleSheetsClient() {
  const credentialsPath =
    process.env.GOOGLE_SHEETS_CREDENTIALS || "./credentials.json";
  const absoluteCredPath = path.resolve(
    path.dirname(__dirname),
    "..",
    credentialsPath,
  );

  if (!fs.existsSync(absoluteCredPath)) {
    throw new Error(
      `File credentials tidak ditemukan: ${absoluteCredPath}. Pastikan file credentials.json ada di direktori backend.`,
    );
  }

  const credentials = JSON.parse(fs.readFileSync(absoluteCredPath, "utf8"));

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  const sheets = google.sheets({ version: "v4", auth });
  return sheets;
}

export async function fetchKriteriaData(sheetId) {
  try {
    const sheets = await getGoogleSheetsClient();
    const spreadsheetId = sheetId || process.env.GOOGLE_SHEET_ID;

    if (!spreadsheetId) {
      throw new Error("GOOGLE_SHEET_ID tidak dikonfigurasi di environment");
    }

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "Kriteria!A1:G100",
    });

    const rows = response.data.values;

    if (!rows || rows.length === 0) {
      throw new Error('Sheet "Kriteria" kosong atau tidak ditemukan');
    }

    const headers = rows[0];
    const dataRows = rows.slice(1);

    const students = dataRows
      .filter((row) => row[0] && row[1])
      .map((row) => ({
        no: parseInt(row[0]) || 0,
        nama: String(row[1] || "").trim(),
        c1: parseFloat(String(row[2] || "0").replace(",", ".")) || 0,
        c2: parseFloat(String(row[3] || "0").replace(",", ".")) || 0,
        c4: parseFloat(String(row[5] || "0").replace(",", ".")) || 0,
        c5: parseFloat(String(row[6] || "0").replace(",", ".")) || 0,
      }));

    return {
      success: true,
      data: students,
      headers: headers,
      rowCount: students.length,
    };
  } catch (error) {
    console.error("Error fetching Kriteria data:", error);
    throw new Error(`Gagal mengambil data Kriteria: ${error.message}`);
  }
}

export async function fetchJarakData(sheetId) {
  try {
    const sheets = await getGoogleSheetsClient();
    const spreadsheetId = sheetId || process.env.GOOGLE_SHEET_ID;

    if (!spreadsheetId) {
      throw new Error("GOOGLE_SHEET_ID tidak dikonfigurasi di environment");
    }

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "Jarak!A1:G100",
    });

    const rows = response.data.values;

    if (!rows || rows.length === 0) {
      throw new Error('Sheet "Jarak" kosong atau tidak ditemukan');
    }

    const headerRow1 = rows[0];
    const headerRow2 = rows[1];

    const bankNames = headerRow2.slice(2).filter((name) => name && name.trim());

    const dataRows = rows.slice(2);

    const jarakPerSiswa = {};
    const siswaList = [];

    dataRows
      .filter((row) => row[0] && row[1])
      .forEach((row) => {
        const no = parseInt(row[0]) || 0;
        const nama = String(row[1] || "").trim();

        siswaList.push({ no, nama });

        const jarakKeBanks = {};
        bankNames.forEach((bankName, idx) => {
          const jarakValue = row[idx + 2];
          jarakKeBanks[bankName] =
            parseFloat(String(jarakValue || "0").replace(",", ".")) || 0;
        });

        jarakPerSiswa[nama] = jarakKeBanks;
      });

    const alternatives = bankNames.map((nama, idx) => ({
      kode: `A${idx + 1}`,
      nama: nama.trim(),
    }));

    return {
      success: true,
      data: {
        alternatives,
        jarakPerSiswa,
        siswaList,
        bankNames,
      },
      rowCount: siswaList.length,
    };
  } catch (error) {
    console.error("Error fetching Jarak data:", error);
    throw new Error(`Gagal mengambil data Jarak: ${error.message}`);
  }
}

export async function fetchCompleteData(sheetId) {
  try {
    const [kriteriaResult, jarakResult] = await Promise.all([
      fetchKriteriaData(sheetId),
      fetchJarakData(sheetId),
    ]);

    const students = kriteriaResult.data;
    const { alternatives, jarakPerSiswa } = jarakResult.data;

    const studentsWithJarak = students.map((student) => {
      const jarakData = jarakPerSiswa[student.nama] || {};
      return {
        ...student,
        jarakKeBanks: jarakData,
      };
    });

    return {
      success: true,
      data: {
        students: studentsWithJarak,
        alternatives,
        jarakPerSiswa,
      },
      metadata: {
        totalStudents: students.length,
        totalAlternatives: alternatives.length,
      },
    };
  } catch (error) {
    console.error("Error fetching complete data:", error);
    throw new Error(`Gagal mengambil data lengkap: ${error.message}`);
  }
}

export async function validateConnection(sheetId) {
  try {
    const sheets = await getGoogleSheetsClient();
    const spreadsheetId = sheetId || process.env.GOOGLE_SHEET_ID;

    const response = await sheets.spreadsheets.get({
      spreadsheetId,
    });

    const sheetNames = response.data.sheets.map(
      (sheet) => sheet.properties.title,
    );

    return {
      success: true,
      spreadsheetTitle: response.data.properties.title,
      sheets: sheetNames,
      hasKriteria: sheetNames.includes("Kriteria"),
      hasJarak: sheetNames.includes("Jarak"),
    };
  } catch (error) {
    console.error("Error validating connection:", error);
    throw new Error(`Gagal terkoneksi ke Google Sheets: ${error.message}`);
  }
}

export default {
  fetchKriteriaData,
  fetchJarakData,
  fetchCompleteData,
  validateConnection,
};
