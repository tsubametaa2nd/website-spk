export function calculateVIKOR(
  students,
  alternatives,
  weights,
  v = 0.5,
  jarakPerSiswa = null,
) {
  const results = [];

  const thresholdC1 =
    parseFloat(process.env.MIN_THRESHOLD_C1) ||
    parseFloat(process.env.MIN_THRESHOLD) ||
    75;
  const thresholdC4 =
    parseFloat(process.env.MIN_THRESHOLD_C4) ||
    parseFloat(process.env.MIN_THRESHOLD) ||
    80;

  const qualifiedStudents = students.filter(
    (student) => student.c1 >= thresholdC1 && student.c4 >= thresholdC4,
  );

  const disqualifiedStudents = students.filter(
    (student) => student.c1 < thresholdC1 || student.c4 < thresholdC4,
  );

  const kapasitasTracker = {};
  alternatives.forEach((alt) => {
    kapasitasTracker[alt.nama] = {
      total: alt.kapasitas || 999,
      used: 0,
      remaining: alt.kapasitas || 999,
    };
  });

  const studentsWithScores = [];

  for (const student of qualifiedStudents) {
    let studentAlternatives = alternatives;

    if (jarakPerSiswa && jarakPerSiswa[student.nama]) {
      const jarakSiswa = jarakPerSiswa[student.nama];
      studentAlternatives = alternatives.map((alt) => ({
        ...alt,
        jarak:
          jarakSiswa[alt.nama] !== undefined
            ? jarakSiswa[alt.nama]
            : alt.jarak || 0,
      }));
    } else if (student.jarakKeBanks) {
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

    const overallScore = calculateOverallStudentScore(student);

    studentsWithScores.push({
      ...studentResult,
      overallScore,
      studentAlternatives,
    });
  }

  studentsWithScores.sort((a, b) => b.overallScore - a.overallScore);

  for (const studentData of studentsWithScores) {
    const { alternatifRanking, siswa } = studentData;
    let assigned = false;
    let finalRekomendasi = null;

    const pilihanUtama = alternatifRanking[0];
    let dipindahkanDari = null;
    let alasanPindah = null;
    for (const alt of alternatifRanking) {
      const tracker = kapasitasTracker[alt.nama];

      if (tracker && tracker.remaining > 0) {
        tracker.used += 1;
        tracker.remaining -= 1;

        if (alt.nama !== pilihanUtama.nama) {
          dipindahkanDari = pilihanUtama;
          alasanPindah = `Kapasitas ${pilihanUtama.nama} sudah penuh (${kapasitasTracker[pilihanUtama.nama]?.total || 0} siswa)`;
        }

        finalRekomendasi = {
          ...alt,
          kapasitasInfo: {
            totalKapasitas: tracker.total,
            terpakai: tracker.used,
            sisaTersedia: tracker.remaining,
          },
          pilihanUtama: pilihanUtama.nama,
          dipindahkan: alt.nama !== pilihanUtama.nama,
          dipindahkanDari: dipindahkanDari?.nama || null,
          alasanPindah: alasanPindah,
        };
        assigned = true;
        break;
      }
    }

    if (!assigned && alternatifRanking.length > 0) {
      const bestAlt = alternatifRanking[0];
      const tracker = kapasitasTracker[bestAlt.nama];

      finalRekomendasi = {
        ...bestAlt,
        kapasitasInfo: {
          totalKapasitas: tracker?.total || 0,
          terpakai: tracker?.used || 0,
          sisaTersedia: 0,
          overKapasitas: true,
        },
        pilihanUtama: pilihanUtama.nama,
        dipindahkan: false,
        dipindahkanDari: null,
        alasanPindah: "Semua tempat magang sudah penuh kapasitasnya",
      };
    }

    results.push({
      siswa: studentData.siswa,
      alternatifRanking: studentData.alternatifRanking,
      rekomendasi: finalRekomendasi,
      pilihanUtama: pilihanUtama,
      narasi: generateNarrative(
        studentData.siswa,
        finalRekomendasi,
        studentData.alternatifRanking,
        thresholdC1,
        thresholdC4,
        pilihanUtama,
      ),
      calculationDetails: studentData.calculationDetails,
      overallScore: studentData.overallScore,
    });
  }

  const kapasitasSummary = Object.entries(kapasitasTracker).map(
    ([nama, data]) => ({
      nama,
      totalKapasitas: data.total,
      terisi: data.used,
      sisaTersedia: data.remaining,
      persentaseTerisi:
        data.total > 0 ? Math.round((data.used / data.total) * 100) : 0,
    }),
  );

  return {
    qualifiedResults: results,
    disqualifiedStudents: disqualifiedStudents.map((s) => ({
      nama: s.nama,
      c1: s.c1,
      c4: s.c4,
      reason: getDisqualificationReason(s, thresholdC1, thresholdC4),
    })),
    kapasitasSummary,
    metadata: {
      totalStudents: students.length,
      qualifiedCount: qualifiedStudents.length,
      disqualifiedCount: disqualifiedStudents.length,
      weights,
      thresholds: {
        c1: thresholdC1,
        c4: thresholdC4,
      },
      vParameter: v,
    },
  };
}

function calculateOverallStudentScore(student) {
  const weights = { c1: 0.3, c2: 0.25, c4: 0.3, c5: 0.15 };

  return (
    student.c1 * weights.c1 +
    student.c2 * weights.c2 +
    student.c4 * weights.c4 +
    student.c5 * weights.c5
  );
}

function processStudentVIKOR(student, alternatives, weights, v) {
  const matrix = alternatives.map((alt) => [
    student.c1,
    student.c2,
    alt.jarak,
    student.c4,
    student.c5,
  ]);

  const criteriaTypes = [true, true, false, true, true];

  const numCriteria = 5;
  const fBest = [];
  const fWorst = [];

  for (let j = 0; j < numCriteria; j++) {
    const columnValues = matrix.map((row) => row[j]);
    if (criteriaTypes[j]) {
      fBest.push(Math.max(...columnValues));
      fWorst.push(Math.min(...columnValues));
    } else {
      fBest.push(Math.min(...columnValues));
      fWorst.push(Math.max(...columnValues));
    }
  }

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
          normalizedValue = (fBest[j] - fij) / denominator;
        } else {
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

  const alternativesWithScores = alternatives.map((alt, idx) => ({
    kode: alt.kode,
    nama: alt.nama,
    jarak: alt.jarak,
    kapasitas: alt.kapasitas || 0,
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

  alternativesWithScores.sort((a, b) => a.q - b.q);

  alternativesWithScores.forEach((alt, idx) => {
    alt.ranking = idx + 1;
  });

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

function generateNarrative(
  student,
  bestAlt,
  allAlts,
  thresholdC1,
  thresholdC4,
  pilihanUtama = null,
) {
  const narrativeParts = [
    `Berdasarkan analisis menggunakan metode VIKOR (VlseKriterijumska Optimizacija I Kompromisno Resenje), `,
    `siswa **${student.nama}** direkomendasikan untuk melaksanakan Program Kerja Industri (Prakerin) di `,
    `**${bestAlt.nama}** (${bestAlt.kode}).`,
    `\n\n`,
  ];

  if (bestAlt.dipindahkan && bestAlt.dipindahkanDari) {
    narrativeParts.push(
      `**Informasi Pemindahan:** Pilihan utama siswa berdasarkan analisis VIKOR adalah **${bestAlt.pilihanUtama}**, `,
      `namun karena kapasitas tempat tersebut sudah maksimal, siswa dipindahkan ke **${bestAlt.nama}** `,
      `yang masih memiliki slot tersedia.`,
      `\n\n`,
    );
  }

  if (bestAlt.kapasitasInfo) {
    if (bestAlt.kapasitasInfo.overKapasitas) {
      narrativeParts.push(
        `**Perhatian:** Semua tempat magang sudah mencapai kapasitas maksimal. `,
        `Siswa ini memerlukan penanganan khusus untuk penempatan.`,
        `\n\n`,
      );
    } else {
      narrativeParts.push(
        `Kapasitas tersedia: ${bestAlt.kapasitasInfo.sisaTersedia} dari ${bestAlt.kapasitasInfo.totalKapasitas} slot.`,
        `\n\n`,
      );
    }
  }

  narrativeParts.push(
    `Rekomendasi ini didasarkan pada nilai indeks VIKOR (Q) terendah sebesar **${bestAlt.q}**, `,
    `yang menunjukkan kompromi optimal antara kriteria benefit (Akumulasi Nilai, Penilaian Sikap, `,
    `Nilai Sertifikasi, dan Rekomendasi Guru) dengan kriteria cost (Jarak tempuh).`,
    `\n\n`,
    `**Profil Akademik ${student.nama}:**\n`,
    `- Akumulasi Nilai (C1): ${student.c1} (min. ${thresholdC1})\n`,
    `- Penilaian Sikap (C2): ${student.c2}\n`,
    `- Nilai Sertifikasi (C4): ${student.c4} (min. ${thresholdC4})\n`,
    `- Rekomendasi Guru (C5): ${student.c5}\n`,
    `- Jarak ke ${bestAlt.nama}: ${bestAlt.jarak} km`,
    `\n\n`,
    `**Urutan Peringkat Alternatif:**\n`,
  );

  allAlts.forEach((alt, idx) => {
    const kapasitasNote =
      alt.kapasitas > 0 ? ` | Kapasitas: ${alt.kapasitas}` : "";
    const pilihanMarker =
      pilihanUtama && alt.nama === pilihanUtama.nama ? " Pilihan utama" : "";
    narrativeParts.push(
      `${idx + 1}. ${alt.nama} (Q=${alt.q}, S=${alt.s}, R=${alt.r}, Jarak=${alt.jarak}km${kapasitasNote})${pilihanMarker}\n`,
    );
  });

  if (bestAlt.dipindahkan) {
    narrativeParts.push(
      `\n**Kesimpulan:** Meskipun ${pilihanUtama?.nama || bestAlt.pilihanUtama} adalah pilihan optimal berdasarkan VIKOR, `,
      `${bestAlt.nama} dipilih karena masih memiliki kapasitas dan merupakan alternatif terbaik berikutnya.`,
    );
  } else {
    narrativeParts.push(
      `\nDengan demikian, ${bestAlt.nama} merupakan pilihan terbaik yang mengakomodasi `,
      `keseimbangan antara potensi akademik siswa dan faktor operasional seperti jarak tempuh `,
      `dari domisili ke lokasi magang serta ketersediaan kuota.`,
    );
  }

  return narrativeParts.join("");
}

function getDisqualificationReason(student, thresholdC1, thresholdC4) {
  const reasons = [];
  if (student.c1 < thresholdC1) {
    reasons.push(
      `Akumulasi Nilai (C1 = ${student.c1}) di bawah batas minimum ${thresholdC1}`,
    );
  }
  if (student.c4 < thresholdC4) {
    reasons.push(
      `Nilai Sertifikasi (C4 = ${student.c4}) di bawah batas minimum ${thresholdC4}`,
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
  const requiredFields = ["kode", "nama"];

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

    if (alt.jarak !== undefined) {
      const jarak = parseFloat(alt.jarak);
      if (isNaN(jarak) || jarak < 0) {
        errors.push(`Alternatif baris ${idx + 1}: Jarak harus angka positif`);
      }
    }

    if (alt.kapasitas !== undefined) {
      const kapasitas = parseInt(alt.kapasitas);
      if (isNaN(kapasitas) || kapasitas < 0) {
        errors.push(
          `Alternatif baris ${idx + 1}: Kapasitas harus angka positif`,
        );
      }
    }
  });

  return errors;
}

export default {
  calculateVIKOR,
  validateStudentData,
  validateAlternativesData,
};
