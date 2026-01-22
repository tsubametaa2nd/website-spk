/**
 * VIKOR Method Implementation
 * Metode VlseKriterijumska Optimizacija I Kompromisno Resenje
 *
 * VIKOR adalah metode pengambilan keputusan multi-kriteria yang berfokus pada
 * perangkingan dan pemilihan dari sekumpulan alternatif dengan kriteria yang saling bertentangan.
 *
 * Langkah-langkah VIKOR:
 * 1. Normalisasi matriks keputusan
 * 2. Tentukan nilai terbaik (f*) dan terburuk (f-) untuk setiap kriteria
 * 3. Hitung nilai S (utility measure) dan R (regret measure)
 * 4. Hitung nilai Q (VIKOR index)
 * 5. Ranking berdasarkan Q (semakin kecil semakin baik)
 */

/**
 * Calculate VIKOR analysis for student placement
 * @param {Array} students - Array of student data with criteria values
 * @param {Array} alternatives - Array of DUDI alternatives with distance data
 * @param {Array} weights - Bobot kriteria [C1, C2, C3, C4, C5]
 * @param {number} v - Parameter strategi (default 0.5 = konsensus)
 * @param {Object} jarakPerSiswa - Optional: Object berisi jarak per siswa ke setiap alternatif
 * @returns {Object} VIKOR calculation results
 */
export function calculateVIKOR(
  students,
  alternatives,
  weights,
  v = 0.5,
  jarakPerSiswa = null,
) {
  const results = [];

  // Filter students who meet minimum threshold (C1 >= 70 and C4 >= 70)
  const threshold = parseFloat(process.env.MIN_THRESHOLD) || 70;
  const qualifiedStudents = students.filter(
    (student) => student.c1 >= threshold && student.c4 >= threshold,
  );

  const disqualifiedStudents = students.filter(
    (student) => student.c1 < threshold || student.c4 < threshold,
  );

  // Process each qualified student
  for (const student of qualifiedStudents) {
    // Jika ada data jarak per siswa, gunakan itu; jika tidak, gunakan jarak default dari alternatif
    let studentAlternatives = alternatives;

    if (jarakPerSiswa && jarakPerSiswa[student.nama]) {
      // Buat alternatives dengan jarak spesifik untuk siswa ini
      const jarakSiswa = jarakPerSiswa[student.nama];
      studentAlternatives = alternatives.map((alt) => ({
        ...alt,
        jarak:
          jarakSiswa[alt.nama] !== undefined
            ? jarakSiswa[alt.nama]
            : alt.jarak || 0,
      }));
    } else if (student.jarakKeBanks) {
      // Jika siswa memiliki property jarakKeBanks langsung
      studentAlternatives = alternatives.map((alt) => ({
        ...alt,
        jarak:
          student.jarakKeBanks[alt.nama] !== undefined
            ? student.jarakKeBanks[alt.nama]
            : alt.jarak || 0,
      }));
    }

    const studentResult = processStudentVIKOR(
      student,
      studentAlternatives,
      weights,
      v,
    );
    results.push(studentResult);
  }

  return {
    qualifiedResults: results,
    disqualifiedStudents: disqualifiedStudents.map((s) => ({
      nama: s.nama,
      c1: s.c1,
      c4: s.c4,
      reason: getDisqualificationReason(s, threshold),
    })),
    metadata: {
      totalStudents: students.length,
      qualifiedCount: qualifiedStudents.length,
      disqualifiedCount: disqualifiedStudents.length,
      weights,
      threshold,
      vParameter: v,
    },
  };
}

/**
 * Process VIKOR for a single student across all alternatives
 */
function processStudentVIKOR(student, alternatives, weights, v) {
  // Build decision matrix for this student
  // Each row = one alternative, columns = [C1, C2, C3, C4, C5]
  const matrix = alternatives.map((alt) => [
    student.c1, // C1: Akumulasi Nilai
    student.c2, // C2: Penilaian Sikap
    alt.jarak, // C3: Jarak (cost - semakin kecil semakin baik)
    student.c4, // C4: Nilai Sertifikasi
    student.c5, // C5: Rekomendasi Guru
  ]);

  // Criteria types: true = benefit (higher is better), false = cost (lower is better)
  const criteriaTypes = [true, true, false, true, true]; // C3 is cost

  // Step 1-2: Find best (f*) and worst (f-) values for each criterion
  const numCriteria = 5;
  const fBest = [];
  const fWorst = [];

  for (let j = 0; j < numCriteria; j++) {
    const columnValues = matrix.map((row) => row[j]);
    if (criteriaTypes[j]) {
      // Benefit criterion: max is best, min is worst
      fBest.push(Math.max(...columnValues));
      fWorst.push(Math.min(...columnValues));
    } else {
      // Cost criterion: min is best, max is worst
      fBest.push(Math.min(...columnValues));
      fWorst.push(Math.max(...columnValues));
    }
  }

  // Step 3: Calculate S and R values for each alternative
  const sValues = [];
  const rValues = [];

  for (let i = 0; i < matrix.length; i++) {
    let s = 0;
    let r = 0;

    for (let j = 0; j < numCriteria; j++) {
      const fij = matrix[i][j];
      const denominator = fBest[j] - fWorst[j];

      let normalizedValue = 0;
      if (denominator !== 0) {
        if (criteriaTypes[j]) {
          // Benefit: (f* - fij) / (f* - f-)
          normalizedValue = (fBest[j] - fij) / denominator;
        } else {
          // Cost: (fij - f*) / (f- - f*)
          normalizedValue = (fij - fBest[j]) / (fWorst[j] - fBest[j]);
        }
      }

      const weightedValue = weights[j] * normalizedValue;
      s += weightedValue;
      r = Math.max(r, weightedValue);
    }

    sValues.push(s);
    rValues.push(r);
  }

  // Step 4: Calculate Q values
  const sMin = Math.min(...sValues);
  const sMax = Math.max(...sValues);
  const rMin = Math.min(...rValues);
  const rMax = Math.max(...rValues);

  const qValues = [];
  for (let i = 0; i < matrix.length; i++) {
    let q = 0;
    const sDenom = sMax - sMin;
    const rDenom = rMax - rMin;

    if (sDenom !== 0 && rDenom !== 0) {
      q =
        v * ((sValues[i] - sMin) / sDenom) +
        (1 - v) * ((rValues[i] - rMin) / rDenom);
    } else if (sDenom === 0 && rDenom !== 0) {
      q = (1 - v) * ((rValues[i] - rMin) / rDenom);
    } else if (sDenom !== 0 && rDenom === 0) {
      q = v * ((sValues[i] - sMin) / sDenom);
    }

    qValues.push(q);
  }

  // Step 5: Create ranking based on Q (lower Q = better rank)
  const alternativesWithScores = alternatives.map((alt, idx) => ({
    kode: alt.kode,
    nama: alt.nama,
    jarak: alt.jarak,
    s: roundTo(sValues[idx], 4),
    r: roundTo(rValues[idx], 4),
    q: roundTo(qValues[idx], 4),
    criteriaValues: {
      c1: matrix[idx][0],
      c2: matrix[idx][1],
      c3: matrix[idx][2],
      c4: matrix[idx][3],
      c5: matrix[idx][4],
    },
  }));

  // Sort by Q value (ascending - lower is better)
  alternativesWithScores.sort((a, b) => a.q - b.q);

  // Assign ranks
  alternativesWithScores.forEach((alt, idx) => {
    alt.ranking = idx + 1;
  });

  // Get best alternative (lowest Q)
  const bestAlternative = alternativesWithScores[0];

  return {
    siswa: {
      nama: student.nama,
      c1: student.c1,
      c2: student.c2,
      c4: student.c4,
      c5: student.c5,
    },
    alternatifRanking: alternativesWithScores,
    rekomendasi: bestAlternative,
    narasi: generateNarrative(student, bestAlternative, alternativesWithScores),
    calculationDetails: {
      fBest: fBest.map((v) => roundTo(v, 4)),
      fWorst: fWorst.map((v) => roundTo(v, 4)),
      criteriaTypes: ["Benefit", "Benefit", "Cost", "Benefit", "Benefit"],
      criteriaNames: [
        "Akumulasi Nilai (C1)",
        "Sikap (C2)",
        "Jarak (C3)",
        "Sertifikasi (C4)",
        "Rekomendasi (C5)",
      ],
    },
  };
}

function generateNarrative(student, bestAlt, allAlts) {
  const ordinal = ["pertama", "kedua", "ketiga", "keempat", "kelima"];

  const narrativeParts = [
    `Berdasarkan analisis menggunakan metode VIKOR (VlseKriterijumska Optimizacija I Kompromisno Resenje), `,
    `siswa ${student.nama} direkomendasikan untuk melaksanakan Program Kerja Industri (Prakerin) di `,
    `**${bestAlt.nama}** (${bestAlt.kode}).`,
    `\n\n`,
    `Rekomendasi ini didasarkan pada nilai indeks VIKOR (Q) terendah sebesar **${bestAlt.q}**, `,
    `yang menunjukkan kompromi optimal antara kriteria benefit (Akumulasi Nilai, Penilaian Sikap, `,
    `Nilai Sertifikasi, dan Rekomendasi Guru) dengan kriteria cost (Jarak tempuh).`,
    `\n\n`,
    `Profil akademik ${student.nama}: Akumulasi Nilai = ${student.c1}, Penilaian Sikap = ${student.c2}, `,
    `Nilai Sertifikasi = ${student.c4}, dan Rekomendasi Guru = ${student.c5}.`,
    `\n\n`,
    `Urutan peringkat alternatif berdasarkan nilai Q:\n`,
  ];

  allAlts.forEach((alt, idx) => {
    narrativeParts.push(
      `${idx + 1}. ${alt.nama} (Q = ${alt.q}, S = ${alt.s}, R = ${alt.r})\n`,
    );
  });

  narrativeParts.push(
    `\nDengan demikian, ${bestAlt.nama} merupakan pilihan terbaik yang mengakomodasi `,
    `keseimbangan antara potensi akademik siswa dan faktor operasional seperti jarak tempuh `,
    `dari domisili ke lokasi magang.`,
  );

  return narrativeParts.join("");
}

function getDisqualificationReason(student, threshold) {
  const reasons = [];
  if (student.c1 < threshold) {
    reasons.push(
      `Akumulasi Nilai (C1 = ${student.c1}) di bawah batas minimum ${threshold}`,
    );
  }
  if (student.c4 < threshold) {
    reasons.push(
      `Nilai Sertifikasi (C4 = ${student.c4}) di bawah batas minimum ${threshold}`,
    );
  }
  return reasons.join("; ");
}

function roundTo(num, decimals) {
  return Math.round(num * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

export function validateStudentData(students) {
  const errors = [];
  const requiredFields = ["nama", "c1", "c2", "c4", "c5"];

  students.forEach((student, idx) => {
    requiredFields.forEach((field) => {
      if (
        student[field] === undefined ||
        student[field] === null ||
        student[field] === ""
      ) {
        errors.push(
          `Siswa baris ${idx + 1}: Field '${field}' tidak boleh kosong`,
        );
      }
    });

    ["c1", "c2", "c4", "c5"].forEach((field) => {
      const value = parseFloat(student[field]);
      if (isNaN(value) || value < 0 || value > 100) {
        errors.push(
          `Siswa baris ${idx + 1}: Nilai '${field}' harus angka valid antara 0-100`,
        );
      }
    });
  });

  return errors;
}

export function validateAlternativesData(alternatives) {
  const errors = [];
  const requiredFields = ["kode", "nama", "jarak"];

  alternatives.forEach((alt, idx) => {
    requiredFields.forEach((field) => {
      if (
        alt[field] === undefined ||
        alt[field] === null ||
        alt[field] === ""
      ) {
        errors.push(
          `Alternatif baris ${idx + 1}: Field '${field}' tidak boleh kosong`,
        );
      }
    });

    const jarak = parseFloat(alt.jarak);
    if (isNaN(jarak) || jarak < 0) {
      errors.push(`Alternatif baris ${idx + 1}: Jarak harus angka positif`);
    }
  });

  return errors;
}

export default {
  calculateVIKOR,
  validateStudentData,
  validateAlternativesData,
};
