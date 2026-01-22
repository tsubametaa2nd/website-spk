export const API_CONFIG = {
  BASE_URL:
    import.meta.env.PUBLIC_API_URL || "https://website-spk-backend.vercel.app",

  TIMEOUT: 30000,

  RETRY_ATTEMPTS: 3,

  RETRY_DELAY: 1000,

  DEFAULT_HEADERS: {
    "Content-Type": "application/json",
  },
} as const;

export function getApiUrl(): string {
  return API_CONFIG.BASE_URL;
}

export const API_ENDPOINTS = {
  HEALTH: "/health",
  INFO: "/",

  PROCESS_VIKOR: "/api/process-vikor",
  PROCESS_VIKOR_SHEETS: "/api/process-vikor-sheets",

  UPLOAD_FILE: "/api/upload-file",
  PARSE_GOOGLE_SHEETS: "/api/parse-google-sheets",
  DOWNLOAD_CSV: "/api/download-csv",

  DEFAULT_DATA: "/api/default-data",

  SHEETS_VALIDATE: "/api/sheets/validate",
  SHEETS_KRITERIA: "/api/sheets/kriteria",
  SHEETS_JARAK: "/api/sheets/jarak",
  SHEETS_COMPLETE: "/api/sheets/complete",
} as const;

export type ApiEndpoint = (typeof API_ENDPOINTS)[keyof typeof API_ENDPOINTS];
