import { API_ENDPOINTS } from "./config";
import { httpClient, ApiException } from "./http-client";
import type {
  ProcessVikorRequest,
  ProcessVikorSheetsRequest,
  ParseGoogleSheetsRequest,
  VikorResult,
  DefaultData,
  StudentData,
  AlternativeData,
  HealthResponse,
  InfoResponse,
  SheetsValidationResult,
  ApiResponse,
  RequestOptions,
} from "./types";

export async function checkHealth(
  options?: RequestOptions,
): Promise<HealthResponse> {
  return httpClient.get<HealthResponse>(
    API_ENDPOINTS.HEALTH,
    undefined,
    options,
  );
}

export async function getApiInfo(
  options?: RequestOptions,
): Promise<InfoResponse> {
  return httpClient.get<InfoResponse>(API_ENDPOINTS.INFO, undefined, options);
}

export async function processVikor(
  data: ProcessVikorRequest,
  options?: RequestOptions,
): Promise<ApiResponse<VikorResult>> {
  return httpClient.post<ApiResponse<VikorResult>>(
    API_ENDPOINTS.PROCESS_VIKOR,
    data,
    options,
  );
}

export async function processVikorFromSheets(
  data: ProcessVikorSheetsRequest,
  options?: RequestOptions,
): Promise<
  ApiResponse<
    VikorResult & {
      sourceData?: {
        studentCount: number;
        alternativeCount: number;
        alternatives: AlternativeData[];
      };
    }
  >
> {
  return httpClient.post<
    ApiResponse<
      VikorResult & {
        sourceData?: {
          studentCount: number;
          alternativeCount: number;
          alternatives: AlternativeData[];
        };
      }
    >
  >(API_ENDPOINTS.PROCESS_VIKOR_SHEETS, data, options);
}

export async function parseGoogleSheets(
  url: string,
  type: "students" | "alternatives",
  options?: RequestOptions,
): Promise<
  ApiResponse<StudentData[] | AlternativeData[]> & {
    rawColumns?: string[];
    rowCount?: number;
  }
> {
  return httpClient.post<
    ApiResponse<StudentData[] | AlternativeData[]> & {
      rawColumns?: string[];
      rowCount?: number;
    }
  >(
    API_ENDPOINTS.PARSE_GOOGLE_SHEETS,
    { url, type } as ParseGoogleSheetsRequest,
    options,
  );
}

export async function uploadFile(
  file: File,
  type: "students" | "alternatives",
  options?: RequestOptions,
): Promise<
  ApiResponse<StudentData[] | AlternativeData[]> & {
    rawColumns?: string[];
    rowCount?: number;
    fileName?: string;
  }
> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("type", type);

  return httpClient.postFormData<
    ApiResponse<StudentData[] | AlternativeData[]> & {
      rawColumns?: string[];
      rowCount?: number;
      fileName?: string;
    }
  >(API_ENDPOINTS.UPLOAD_FILE, formData, options);
}

export async function downloadCsv(options?: RequestOptions): Promise<Blob> {
  return httpClient.downloadBlob(
    API_ENDPOINTS.DOWNLOAD_CSV,
    undefined,
    options,
  );
}

export async function downloadCsvToFile(filename?: string): Promise<void> {
  const blob = await downloadCsv();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download =
    filename || `hasil_vikor_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function getDefaultData(
  options?: RequestOptions,
): Promise<ApiResponse<DefaultData>> {
  return httpClient.get<ApiResponse<DefaultData>>(
    API_ENDPOINTS.DEFAULT_DATA,
    undefined,
    options,
  );
}

export async function validateSheetsConnection(
  sheetId: string,
  options?: RequestOptions,
): Promise<ApiResponse<SheetsValidationResult>> {
  return httpClient.get<ApiResponse<SheetsValidationResult>>(
    API_ENDPOINTS.SHEETS_VALIDATE,
    { sheetId },
    options,
  );
}

export async function fetchKriteriaFromSheets(
  sheetId: string,
  options?: RequestOptions,
): Promise<
  ApiResponse<{ data: StudentData[]; headers: string[]; rowCount: number }>
> {
  return httpClient.get<
    ApiResponse<{ data: StudentData[]; headers: string[]; rowCount: number }>
  >(API_ENDPOINTS.SHEETS_KRITERIA, { sheetId }, options);
}

export async function fetchJarakFromSheets(
  sheetId: string,
  options?: RequestOptions,
): Promise<
  ApiResponse<{
    data: Record<string, Record<string, number>>;
    rowCount: number;
  }>
> {
  return httpClient.get<
    ApiResponse<{
      data: Record<string, Record<string, number>>;
      rowCount: number;
    }>
  >(API_ENDPOINTS.SHEETS_JARAK, { sheetId }, options);
}

export async function fetchCompleteFromSheets(
  sheetId: string,
  options?: RequestOptions,
): Promise<
  ApiResponse<{
    data: {
      students: StudentData[];
      alternatives: AlternativeData[];
      jarakPerSiswa: Record<string, Record<string, number>> | null;
    };
    metadata: {
      studentCount: number;
      alternativeCount: number;
      hasDistanceData: boolean;
    };
  }>
> {
  return httpClient.get<
    ApiResponse<{
      data: {
        students: StudentData[];
        alternatives: AlternativeData[];
        jarakPerSiswa: Record<string, Record<string, number>> | null;
      };
      metadata: {
        studentCount: number;
        alternativeCount: number;
        hasDistanceData: boolean;
      };
    }>
  >(API_ENDPOINTS.SHEETS_COMPLETE, { sheetId }, options);
}

export async function isApiAvailable(): Promise<boolean> {
  try {
    const response = await checkHealth({ timeout: 5000, retries: 0 });
    return response.status === "ok";
  } catch {
    return false;
  }
}

export function extractSheetId(url: string): string | null {
  const patterns = [
    /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/,
    /id=([a-zA-Z0-9-_]+)/,
    /^([a-zA-Z0-9-_]{20,})$/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return null;
}

export function validateUploadFile(file: File): {
  valid: boolean;
  error?: string;
} {
  const allowedExtensions = [".csv", ".xls", ".xlsx"];
  const maxSize = 5 * 1024 * 1024;

  const ext = `.${file.name.split(".").pop()?.toLowerCase()}`;

  if (!allowedExtensions.includes(ext)) {
    return {
      valid: false,
      error: `Format file tidak didukung. Gunakan: ${allowedExtensions.join(", ")}`,
    };
  }

  if (file.size > maxSize) {
    return {
      valid: false,
      error: `Ukuran file terlalu besar. Maksimal: ${maxSize / 1024 / 1024}MB`,
    };
  }

  return { valid: true };
}

export { ApiException } from "./http-client";
export type * from "./types";
