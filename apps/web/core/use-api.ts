import * as api from "./api";
import {
  appStore,
  setLoading,
  setStudents,
  setAlternatives,
  setResult,
  setError,
  setCurrentStep,
} from "./hooks";
import type {
  ProcessVikorRequest,
  VikorResult,
  StudentData,
  AlternativeData,
  RequestOptions,
} from "./types";
import { ApiException } from "./http-client";

function handleError(error: unknown): void {
  if (error instanceof ApiException) {
    setError({
      status: error.status,
      message: error.message,
      code: error.code,
    });
  } else if (error instanceof Error) {
    setError({
      status: 0,
      message: error.message,
    });
  } else {
    setError({
      status: 0,
      message: "An unknown error occurred",
    });
  }
}

interface ProcessVikorOptions extends RequestOptions {
  useJarakPerSiswa?: boolean;
  jarakPerSiswa?: Record<string, Record<string, number>>;
}

export async function processVikorCalculation(
  options?: ProcessVikorOptions,
): Promise<VikorResult | null> {
  const state = appStore.getState();

  if (state.students.length === 0) {
    setError({ status: 400, message: "Data siswa tidak boleh kosong" });
    return null;
  }

  if (state.alternatives.length === 0) {
    setError({
      status: 400,
      message: "Data alternatif (DUDI) tidak boleh kosong",
    });
    return null;
  }

  setLoading({ isLoading: true, message: "Memproses perhitungan VIKOR..." });
  setError(null);
  setCurrentStep("processing");

  try {
    const request: ProcessVikorRequest = {
      students: state.students,
      alternatives: state.alternatives,
      weights: state.weights,
      vParameter: state.vParameter,
      jarakPerSiswa: options?.useJarakPerSiswa ? options.jarakPerSiswa : null,
    };

    const response = await api.processVikor(request, options);

    if (response.success && response.data) {
      setResult(response.data);
      return response.data;
    } else {
      throw new Error(response.message || "Gagal memproses perhitungan");
    }
  } catch (error) {
    handleError(error);
    setCurrentStep("input");
    return null;
  } finally {
    setLoading({ isLoading: false });
  }
}

export async function processVikorFromSheets(
  sheetId: string,
  weights?: number[],
  vParameter?: number,
  options?: RequestOptions,
): Promise<VikorResult | null> {
  setLoading({
    isLoading: true,
    message: "Mengambil data dari Google Sheets...",
  });
  setError(null);
  setCurrentStep("processing");

  try {
    const state = appStore.getState();

    const response = await api.processVikorFromSheets(
      {
        sheetId,
        weights: weights || state.weights,
        vParameter: vParameter ?? state.vParameter,
      },
      options,
    );

    if (response.success && response.data) {
      setResult(response.data);
      return response.data;
    } else {
      throw new Error(response.message || "Gagal memproses dari Google Sheets");
    }
  } catch (error) {
    handleError(error);
    setCurrentStep("input");
    return null;
  } finally {
    setLoading({ isLoading: false });
  }
}

export async function loadStudentsFromFile(
  file: File,
  options?: RequestOptions,
): Promise<StudentData[] | null> {
  const validation = api.validateUploadFile(file);
  if (!validation.valid) {
    setError({ status: 400, message: validation.error! });
    return null;
  }

  setLoading({ isLoading: true, message: "Mengupload file siswa..." });
  setError(null);

  try {
    const response = await api.uploadFile(file, "students", options);

    if (response.success && response.data) {
      const students = response.data as StudentData[];
      setStudents(students);
      return students;
    } else {
      throw new Error(response.message || "Gagal memparse file");
    }
  } catch (error) {
    handleError(error);
    return null;
  } finally {
    setLoading({ isLoading: false });
  }
}

export async function loadAlternativesFromFile(
  file: File,
  options?: RequestOptions,
): Promise<AlternativeData[] | null> {
  const validation = api.validateUploadFile(file);
  if (!validation.valid) {
    setError({ status: 400, message: validation.error! });
    return null;
  }

  setLoading({ isLoading: true, message: "Mengupload file alternatif..." });
  setError(null);

  try {
    const response = await api.uploadFile(file, "alternatives", options);

    if (response.success && response.data) {
      const alternatives = response.data as AlternativeData[];
      setAlternatives(alternatives);
      return alternatives;
    } else {
      throw new Error(response.message || "Gagal memparse file");
    }
  } catch (error) {
    handleError(error);
    return null;
  } finally {
    setLoading({ isLoading: false });
  }
}

export async function loadStudentsFromSheets(
  url: string,
  options?: RequestOptions,
): Promise<StudentData[] | null> {
  setLoading({
    isLoading: true,
    message: "Mengambil data siswa dari Google Sheets...",
  });
  setError(null);

  try {
    const response = await api.parseGoogleSheets(url, "students", options);

    if (response.success && response.data) {
      const students = response.data as StudentData[];
      setStudents(students);
      return students;
    } else {
      throw new Error(response.message || "Gagal memparse Google Sheets");
    }
  } catch (error) {
    handleError(error);
    return null;
  } finally {
    setLoading({ isLoading: false });
  }
}

export async function loadAlternativesFromSheets(
  url: string,
  options?: RequestOptions,
): Promise<AlternativeData[] | null> {
  setLoading({
    isLoading: true,
    message: "Mengambil data alternatif dari Google Sheets...",
  });
  setError(null);

  try {
    const response = await api.parseGoogleSheets(url, "alternatives", options);

    if (response.success && response.data) {
      const alternatives = response.data as AlternativeData[];
      setAlternatives(alternatives);
      return alternatives;
    } else {
      throw new Error(response.message || "Gagal memparse Google Sheets");
    }
  } catch (error) {
    handleError(error);
    return null;
  } finally {
    setLoading({ isLoading: false });
  }
}

export async function loadDefaultData(
  options?: RequestOptions,
): Promise<boolean> {
  setLoading({ isLoading: true, message: "Memuat data contoh..." });
  setError(null);

  try {
    const response = await api.getDefaultData(options);

    if (response.success && response.data) {
      setStudents(response.data.students);
      setAlternatives(response.data.alternatives);
      return true;
    } else {
      throw new Error(response.message || "Gagal memuat data default");
    }
  } catch (error) {
    handleError(error);
    return false;
  } finally {
    setLoading({ isLoading: false });
  }
}

export async function downloadResults(filename?: string): Promise<boolean> {
  setLoading({ isLoading: true, message: "Menyiapkan file download..." });
  setError(null);

  try {
    await api.downloadCsvToFile(filename);
    return true;
  } catch (error) {
    handleError(error);
    return false;
  } finally {
    setLoading({ isLoading: false });
  }
}

export async function loadCompleteFromSheets(
  sheetIdOrUrl: string,
  options?: RequestOptions,
): Promise<{
  students: StudentData[];
  alternatives: AlternativeData[];
} | null> {
  const sheetId = api.extractSheetId(sheetIdOrUrl) || sheetIdOrUrl;

  setLoading({
    isLoading: true,
    message: "Memvalidasi dan mengambil data dari Google Sheets...",
  });
  setError(null);

  try {
    const validation = await api.validateSheetsConnection(sheetId, options);
    if (!validation.success || !validation.data?.isValid) {
      throw new Error(validation.data?.message || "Google Sheets tidak valid");
    }

    const response = await api.fetchCompleteFromSheets(sheetId, options);

    if (response.success && response.data?.data) {
      const { students, alternatives } = response.data.data;
      setStudents(students);
      setAlternatives(alternatives);
      return { students, alternatives };
    } else {
      throw new Error("Gagal mengambil data lengkap");
    }
  } catch (error) {
    handleError(error);
    return null;
  } finally {
    setLoading({ isLoading: false });
  }
}

export async function checkApiConnection(): Promise<boolean> {
  setLoading({ isLoading: true, message: "Memeriksa koneksi ke server..." });

  try {
    const isAvailable = await api.isApiAvailable();
    if (!isAvailable) {
      setError({
        status: 0,
        message:
          "Tidak dapat terhubung ke server. Pastikan backend sudah berjalan.",
      });
    }
    return isAvailable;
  } finally {
    setLoading({ isLoading: false });
  }
}
