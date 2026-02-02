import { google } from "googleapis";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function getGoogleSheetsClient() {
  let credentials;

  if (process.env.GOOGLE_SHEETS_CREDENTIALS) {
    try {
      credentials = JSON.parse(process.env.GOOGLE_SHEETS_CREDENTIALS);
      console.log("✓ Loaded credentials from environment variable");
    } catch (parseError) {
      const credPath = path.resolve(
        path.dirname(__dirname),
        "..",
        process.env.GOOGLE_SHEETS_CREDENTIALS,
      );

      if (!fs.existsSync(credPath)) {
        throw new Error(
          `File credentials tidak ditemukan: ${credPath}. Pastikan GOOGLE_SHEETS_CREDENTIALS berisi JSON string atau path yang valid.`,
        );
      }

      credentials = JSON.parse(fs.readFileSync(credPath, "utf8"));
      console.log("✓ Loaded credentials from file path:", credPath);
    }
  } else {
    const defaultCredPath = path.resolve(
      path.dirname(__dirname),
      "..",
      "credentials.json",
    );

    if (!fs.existsSync(defaultCredPath)) {
      throw new Error(
        `File credentials.json tidak ditemukan di: ${defaultCredPath}. ` +
          `Untuk production, set environment variable GOOGLE_SHEETS_CREDENTIALS dengan JSON credentials.`,
      );
    }

    credentials = JSON.parse(fs.readFileSync(defaultCredPath, "utf8"));
    console.log("✓ Loaded credentials from default file:", defaultCredPath);
  }

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

/**
 * @param {string} sheetId
 * @returns {Object}
 */
export async function fetchKapasitasData(sheetId) {
  try {
    const sheets = await getGoogleSheetsClient();
    const spreadsheetId = sheetId || process.env.GOOGLE_SHEET_ID;

    if (!spreadsheetId) {
      throw new Error("GOOGLE_SHEET_ID tidak dikonfigurasi di environment");
    }

    console.log("📊 Fetching Kapasitas data from sheet...");
    console.log("📊 Using spreadsheetId:", spreadsheetId);

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "Kapasitas!B2:C100",
    });

    const rows = response.data.values;

    console.log("Kapasitas raw response:", JSON.stringify(rows, null, 2));

    if (!rows || rows.length === 0) {
      console.warn('Sheet "Kapasitas" kosong, menggunakan kapasitas default');
      return {
        success: false,
        data: {
          kapasitasPerBank: {},
          totalKapasitas: 0,
        },
        rowCount: 0,
        error: "Sheet Kapasitas kosong",
      };
    }

    const kapasitasPerBank = {};
    let totalKapasitas = 0;

    rows.forEach((row, index) => {
      const bankName = row[0] ? String(row[0]).trim() : "";
      const kapasitasValue = row[1] ? String(row[1]).trim() : "0";

      if (!bankName || bankName.toLowerCase() === "total") {
        console.log(`  [Skipped row ${index + 2}]: "${bankName}"`);
        return;
      }

      const kapasitas = parseInt(kapasitasValue.replace(",", ".")) || 0;

      console.log(`  ✓ Row ${index + 2}: "${bankName}" = ${kapasitas} siswa`);

      kapasitasPerBank[bankName] = kapasitas;
      totalKapasitas += kapasitas;
    });

    console.log("✓ Loaded Kapasitas data:", kapasitasPerBank);
    console.log("✓ Total Kapasitas:", totalKapasitas);
    console.log("✓ Bank count:", Object.keys(kapasitasPerBank).length);

    return {
      success: true,
      data: {
        kapasitasPerBank,
        totalKapasitas,
      },
      rowCount: Object.keys(kapasitasPerBank).length,
    };
  } catch (error) {
    console.error("Error fetching Kapasitas data:", error.message);
    console.error("   Full error:", error);
    return {
      success: false,
      data: {
        kapasitasPerBank: {},
        totalKapasitas: 0,
      },
      rowCount: 0,
      error: error.message,
    };
  }
}

export async function fetchCompleteData(sheetId) {
  try {
    const [kriteriaResult, jarakResult, kapasitasResult] = await Promise.all([
      fetchKriteriaData(sheetId),
      fetchJarakData(sheetId),
      fetchKapasitasData(sheetId),
    ]);

    const students = kriteriaResult.data;
    const { alternatives, jarakPerSiswa } = jarakResult.data;
    const { kapasitasPerBank, totalKapasitas } = kapasitasResult.data;

    console.log("Merging kapasitas data with alternatives...");
    console.log("Kapasitas per bank:", kapasitasPerBank);
    console.log(
      "Alternatives:",
      alternatives.map((a) => a.nama),
    );

    const normalizeBankName = (name) => {
      return name
        .toLowerCase()
        .replace(/bank\s*/gi, "")
        .replace(/kcp\s*/gi, "")
        .replace(/kc\s*/gi, "")
        .replace(/cabang\s*/gi, "")
        .replace(/\s+/g, " ")
        .trim();
    };

    // Merge alternatives with capacity data
    const alternativesWithKapasitas = alternatives.map((alt) => {
      const normalizedAltName = normalizeBankName(alt.nama);

      // Try to match bank name using multiple strategies
      let matchedBankKey = null;

      // Strategy 1: Exact match (case-insensitive)
      matchedBankKey = Object.keys(kapasitasPerBank).find(
        (bankName) => bankName.toLowerCase() === alt.nama.toLowerCase(),
      );

      // Strategy 2: Partial match (one contains the other)
      if (!matchedBankKey) {
        matchedBankKey = Object.keys(kapasitasPerBank).find(
          (bankName) =>
            alt.nama.toLowerCase().includes(bankName.toLowerCase()) ||
            bankName.toLowerCase().includes(alt.nama.toLowerCase()),
        );
      }

      // Strategy 3: Normalized name matching
      if (!matchedBankKey) {
        matchedBankKey = Object.keys(kapasitasPerBank).find((bankName) => {
          const normalizedKapasitasName = normalizeBankName(bankName);
          return (
            normalizedAltName.includes(normalizedKapasitasName) ||
            normalizedKapasitasName.includes(normalizedAltName)
          );
        });
      }

      const kapasitas = matchedBankKey ? kapasitasPerBank[matchedBankKey] : 0;

      console.log(
        `  - Alt "${alt.nama}" matched with "${matchedBankKey || "NONE"}" → kapasitas: ${kapasitas}`,
      );

      return {
        ...alt,
        kapasitas: kapasitas,
        sisaTersedia: kapasitas, // Will be updated during allocation
        matchedFrom: matchedBankKey || null,
      };
    });

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
        alternatives: alternativesWithKapasitas,
        jarakPerSiswa,
        kapasitasPerBank,
      },
      metadata: {
        totalStudents: students.length,
        totalAlternatives: alternatives.length,
        totalKapasitas,
        hasKapasitasData:
          kapasitasResult.success && kapasitasResult.rowCount > 0,
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

    console.log("📋 Available sheets:", sheetNames);

    // Case-insensitive check for sheet names
    const hasKriteria = sheetNames.some(
      (name) => name.toLowerCase() === "kriteria",
    );
    const hasJarak = sheetNames.some((name) => name.toLowerCase() === "jarak");
    const hasKapasitas = sheetNames.some(
      (name) => name.toLowerCase() === "kapasitas",
    );

    console.log(
      `✓ Sheet status: Kriteria=${hasKriteria}, Jarak=${hasJarak}, Kapasitas=${hasKapasitas}`,
    );

    return {
      success: true,
      spreadsheetTitle: response.data.properties.title,
      sheets: sheetNames,
      hasKriteria,
      hasJarak,
      hasKapasitas,
    };
  } catch (error) {
    console.error("Error validating connection:", error);
    throw new Error(`Gagal terkoneksi ke Google Sheets: ${error.message}`);
  }
}

export default {
  fetchKriteriaData,
  fetchJarakData,
  fetchKapasitasData,
  fetchCompleteData,
  validateConnection,
};
