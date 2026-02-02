const API_URL = window.API_URL || "https://website-spk-backend.vercel.app";

const AppState = {
  studentData: [],
  dudiData: [],
  vikorResults: null,
  isProcessing: false,

  setStudentData(data) {
    this.studentData = data;
    this.onDataChange();
  },

  setDudiData(data) {
    this.dudiData = data;
    this.onDataChange();
  },

  setVikorResults(results) {
    this.vikorResults = results;
  },

  onDataChange() {
    this.updateProcessButton();
    this.updateHint();
  },

  updateProcessButton() {
    const btn = document.getElementById("btn-process");
    if (btn) {
      btn.disabled =
        this.studentData.length === 0 || this.dudiData.length === 0;
    }
  },

  updateHint() {
    const hint = document.getElementById("process-hint");
    if (hint) {
      if (this.studentData.length > 0 && this.dudiData.length > 0) {
        hint.textContent = `✓ ${this.studentData.length} siswa dan ${this.dudiData.length} DUDI siap diproses`;
        hint.className = "text-success-500 text-sm mt-4";
      } else if (this.studentData.length > 0) {
        hint.textContent = "Upload data DUDI untuk melanjutkan";
        hint.className = "text-warning-500 text-sm mt-4";
      } else if (this.dudiData.length > 0) {
        hint.textContent = "Upload data siswa untuk melanjutkan";
        hint.className = "text-warning-500 text-sm mt-4";
      }
    }
  },

  getWeights() {
    const weightIds = ["c1", "c2", "c3", "c4", "c5"];
    return weightIds.map((id) => {
      const input = document.getElementById(`weight-${id}`);
      return parseFloat(input?.value) || 0;
    });
  },

  validateWeights() {
    const weights = this.getWeights();
    const total = weights.reduce((a, b) => a + b, 0);
    return Math.abs(total - 1) < 0.01;
  },
};

function initTabs() {
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", (e) => {
      const tabId = e.target.dataset.tab;
      const parent = e.target.closest(".card-elevated");

      parent
        .querySelectorAll(".tab")
        .forEach((t) => t.classList.remove("active"));
      parent
        .querySelectorAll(".tab-content")
        .forEach((c) => c.classList.add("hidden"));

      e.target.classList.add("active");
      parent.querySelector(`#${tabId}`)?.classList.remove("hidden");
    });
  });
}

function renderStudentPreview() {
  const tbody = document.querySelector("#student-table tbody");
  if (tbody) {
    tbody.innerHTML = AppState.studentData
      .map(
        (s) =>
          `<tr>
        <td>${s.nama}</td>
        <td class="${s.c1 < 75 ? "text-error-500 font-medium" : ""}">${s.c1}</td>
        <td>${s.c2}</td>
        <td class="${s.c4 < 80 ? "text-error-500 font-medium" : ""}">${s.c4}</td>
        <td>${s.c5}</td>
      </tr>`,
      )
      .join("");
  }

  document.getElementById("student-preview")?.classList.remove("hidden");

  const countEl = document.getElementById("student-count");
  const lowC1 = AppState.studentData.filter((s) => s.c1 < 75).length;
  const lowC4 = AppState.studentData.filter((s) => s.c4 < 80).length;

  if (countEl) {
    let message = `${AppState.studentData.length} siswa dimuat`;
    if (lowC1 > 0 || lowC4 > 0) {
      message += ` (${lowC1 + lowC4} siswa di bawah batas minimum)`;
    }
    countEl.textContent = message;
  }
}

function renderDudiPreview() {
  const tbody = document.querySelector("#dudi-table tbody");
  if (tbody) {
    tbody.innerHTML = AppState.dudiData
      .map(
        (d) =>
          `<tr>
        <td class="font-mono font-medium">${d.kode}</td>
        <td>${d.nama}</td>
        <td>${d.jarak} km</td>
      </tr>`,
      )
      .join("");
  }
  document.getElementById("dudi-preview")?.classList.remove("hidden");
}

async function uploadFile(inputId, type) {
  const input = document.getElementById(inputId);
  if (!input?.files?.[0]) {
    showError("Pilih file terlebih dahulu");
    return;
  }

  const formData = new FormData();
  formData.append("file", input.files[0]);
  formData.append("type", type);

  try {
    const res = await fetch(`${API_URL}/api/upload-file`, {
      method: "POST",
      body: formData,
    });
    const data = await res.json();

    if (data.success) {
      if (type === "students") {
        AppState.setStudentData(data.data);
        renderStudentPreview();
      } else {
        AppState.setDudiData(data.data);
        renderDudiPreview();
      }
    } else {
      showError(data.error?.message || "Gagal upload file");
    }
  } catch (err) {
    showError("Error: " + err.message);
  }
}

async function processVikor() {
  if (!AppState.validateWeights()) {
    showError("Total bobot harus sama dengan 1.00");
    return;
  }

  const btn = document.getElementById("btn-process");
  const btnText = document.getElementById("btn-process-text");

  try {
    AppState.isProcessing = true;
    if (btn) btn.disabled = true;
    if (btnText) btnText.textContent = "Memproses...";

    const hasJarakPerSiswa =
      window.JarakPerSiswa && Object.keys(window.JarakPerSiswa).length > 0;

    let res;
    if (hasJarakPerSiswa && window.GoogleSheetId) {
      res = await fetch(`${API_URL}/api/process-vikor-sheets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sheetId: window.GoogleSheetId,
          weights: AppState.getWeights(),
        }),
      });
    } else {
      res = await fetch(`${API_URL}/api/process-vikor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          students: AppState.studentData,
          alternatives: AppState.dudiData,
          weights: AppState.getWeights(),
          jarakPerSiswa: window.JarakPerSiswa || null,
        }),
      });
    }

    const data = await res.json();

    if (data.success) {
      AppState.setVikorResults(data.data);
      renderResults();
      document.getElementById("results-section")?.classList.remove("hidden");
      document
        .getElementById("results-section")
        ?.scrollIntoView({ behavior: "smooth" });
    } else {
      showError(data.error?.message || "Gagal memproses VIKOR");
    }
  } catch (err) {
    showError("Error: " + err.message);
  } finally {
    AppState.isProcessing = false;
    if (btn) btn.disabled = false;
    if (btnText) btnText.textContent = "Proses Perhitungan VIKOR";
  }
}

function renderResults() {
  const results = AppState.vikorResults;
  if (!results) return;

  // Update stats
  document.getElementById("stat-total").textContent =
    results.metadata.totalStudents;
  document.getElementById("stat-qualified").textContent =
    results.metadata.qualifiedCount;
  document.getElementById("stat-disqualified").textContent =
    results.metadata.disqualifiedCount;
  document.getElementById("stat-dudi").textContent = AppState.dudiData.length;

  const tbody = document.querySelector("#results-table tbody");
  if (tbody) {
    tbody.innerHTML = results.qualifiedResults
      .map(
        (r, i) => `
      <tr class="hover:bg-primary-50 transition-colors">
        <td>${i + 1}</td>
        <td class="font-medium">${r.siswa.nama}</td>
        <td>${r.siswa.c1}</td>
        <td>${r.siswa.c2}</td>
        <td>${r.siswa.c4}</td>
        <td>${r.siswa.c5}</td>
        <td class="font-medium text-accent-700">${r.rekomendasi.nama}</td>
        <td class="font-mono text-primary-600">${r.rekomendasi.q}</td>
        <td><span class="badge-success">Lolos</span></td>
      </tr>
    `,
      )
      .join("");
  }

  if (results.disqualifiedStudents.length > 0) {
    document.getElementById("disqualified-section")?.classList.remove("hidden");
    const dqTbody = document.querySelector("#disqualified-table tbody");
    if (dqTbody) {
      dqTbody.innerHTML = results.disqualifiedStudents
        .map(
          (s, i) => `
        <tr>
          <td>${i + 1}</td>
          <td class="font-medium">${s.nama}</td>
          <td class="${s.c1 < 75 ? "text-error-500 font-medium" : ""}">${s.c1}</td>
          <td class="${s.c4 < 80 ? "text-error-500 font-medium" : ""}">${s.c4}</td>
          <td class="text-error-500 text-sm">${s.reason}</td>
        </tr>
      `,
        )
        .join("");
    }
  } else {
    document.getElementById("disqualified-section")?.classList.add("hidden");
  }

  // Render narratives
  const narrContent = document.getElementById("narrative-content");
  if (narrContent) {
    const narratives = results.qualifiedResults.slice(0, 3).map(
      (r) =>
        `<div class="p-4 bg-secondary-50 rounded-lg border-l-4 border-primary-500">
        ${r.narasi.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/\n/g, "<br>")}
      </div>`,
    );
    narrContent.innerHTML = narratives.join("");

    // Show "show more" button if there are more results
    const showMoreContainer = document.getElementById(
      "show-more-narrative-container",
    );
    if (results.qualifiedResults.length > 3 && showMoreContainer) {
      showMoreContainer.style.display = "block";
    }
  }

  // Render charts
  renderCharts();

  // Show summary button
  document.getElementById("summary-button-section")?.classList.remove("hidden");
}

function renderCharts() {
  const results = AppState.vikorResults;
  if (!results) return;

  // Clear existing charts
  const distCanvas = document.getElementById("chart-distribution");
  const compCanvas = document.getElementById("chart-comparison");

  // Distribution chart
  const distribution = results.summary.distribusiDUDI;
  const labels = Object.keys(distribution);
  const values = Object.values(distribution);

  if (distCanvas && window.Chart) {
    // Destroy existing chart if exists
    const existingChart = Chart.getChart(distCanvas);
    if (existingChart) existingChart.destroy();

    new Chart(distCanvas, {
      type: "doughnut",
      data: {
        labels,
        datasets: [
          {
            data: values,
            backgroundColor: [
              "#1e3a5f",
              "#0d9488",
              "#3b82f6",
              "#f59e0b",
              "#22c55e",
            ],
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "bottom" },
        },
      },
    });
  }

  // Comparison chart
  const dudiStats = {};
  AppState.dudiData.forEach((d) => {
    dudiStats[d.kode] = { nama: d.nama, total: 0, count: 0 };
  });

  results.qualifiedResults.forEach((r) => {
    r.alternatifRanking.forEach((alt) => {
      if (dudiStats[alt.kode]) {
        dudiStats[alt.kode].total += alt.q;
        dudiStats[alt.kode].count++;
      }
    });
  });

  const compLabels = Object.values(dudiStats).map(
    (s) => s.nama.slice(0, 15) + "...",
  );
  const compValues = Object.values(dudiStats).map((s) =>
    s.count > 0 ? (s.total / s.count).toFixed(3) : 0,
  );

  if (compCanvas && window.Chart) {
    const existingChart = Chart.getChart(compCanvas);
    if (existingChart) existingChart.destroy();

    new Chart(compCanvas, {
      type: "bar",
      data: {
        labels: compLabels,
        datasets: [
          {
            label: "Rata-rata Nilai Q",
            data: compValues,
            backgroundColor: "#0d9488",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true },
        },
      },
    });
  }
}

// Utility Functions
function showError(message) {
  const errEl = document.getElementById("process-error");
  if (errEl) {
    errEl.textContent = message;
    errEl.classList.remove("hidden");
    setTimeout(() => errEl.classList.add("hidden"), 5000);
  }
  console.error(message);
}

function downloadCSV() {
  window.open(`${API_URL}/api/download-csv`, "_blank");
}

// Event Listeners Initialization
function initEventListeners() {
  // Sample data buttons removed

  // Google Sheets parsing removed

  // File uploads
  document
    .getElementById("btn-upload-student")
    ?.addEventListener("click", () =>
      uploadFile("student-file-input", "students"),
    );
  document
    .getElementById("btn-upload-dudi")
    ?.addEventListener("click", () =>
      uploadFile("dudi-file-input", "alternatives"),
    );

  // Process button
  document
    .getElementById("btn-process")
    ?.addEventListener("click", processVikor);

  // Download button
  document
    .getElementById("btn-download")
    ?.addEventListener("click", downloadCSV);

  // Show more narratives
  document
    .getElementById("btn-show-more-narrative")
    ?.addEventListener("click", () => {
      const narrContent = document.getElementById("narrative-content");
      const results = AppState.vikorResults;
      if (narrContent && results) {
        narrContent.innerHTML = results.qualifiedResults
          .map(
            (r) =>
              `<div class="p-4 bg-secondary-50 rounded-lg border-l-4 border-primary-500">
          ${r.narasi.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/\n/g, "<br>")}
        </div>`,
          )
          .join("");
        document.getElementById("show-more-narrative-container").style.display =
          "none";
      }
    });
}

// Initialize on DOM ready
document.addEventListener("DOMContentLoaded", () => {
  initTabs();
  initEventListeners();
  AppState.updateProcessButton();
});

// Export for global access
window.AppState = AppState;
window.API_URL = API_URL;
