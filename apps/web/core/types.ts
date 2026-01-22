export interface StudentData {
  nama: string;
  c1: number;
  c2: number;
  c4: number;
  c5: number;
}

export interface AlternativeData {
  kode: string;
  nama: string;
  jarak: number;
}

export interface ProcessVikorRequest {
  students: StudentData[];
  alternatives: AlternativeData[];
  weights?: number[] | string;
  vParameter?: number;
  jarakPerSiswa?: Record<string, Record<string, number>> | null;
}

export interface ProcessVikorSheetsRequest {
  sheetId: string;
  weights?: number[] | string;
  vParameter?: number;
}

export interface ParseGoogleSheetsRequest {
  url: string;
  type: "students" | "alternatives";
}

export interface UploadFileRequest {
  file: File;
  type: "students" | "alternatives";
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp?: string;
}

export interface DudiRecommendation {
  nama: string;
  kode: string;
  jarak: number;
  s: number;
  r: number;
  q: number;
  ranking: number;
}

export interface QualifiedResult {
  siswa: StudentData;
  rekomendasi: DudiRecommendation;
  allRankings?: DudiRecommendation[];
}

export interface DisqualifiedStudent extends StudentData {
  reason: string;
}

export interface VikorMetadata {
  totalStudents: number;
  qualifiedCount: number;
  disqualifiedCount: number;
  weights: number[];
  vParameter: number;
  threshold: number;
}

export interface VikorSummary {
  totalSiswa: number;
  siswaLolos: number;
  siswaTidakLolos: number;
  distribusiDUDI: Record<string, number>;
  bobotKriteria: {
    kriteria: string;
    bobot: number;
    persentase: string;
  }[];
  batasMinimum: number;
  parameterV: number;
}

export interface VikorResult {
  qualifiedResults: QualifiedResult[];
  disqualifiedStudents: DisqualifiedStudent[];
  metadata: VikorMetadata;
  summary?: VikorSummary;
  fStar?: number[];
  fMinus?: number[];
}

export interface ProcessVikorResponse extends ApiResponse<VikorResult> {}

export interface DefaultData {
  students: StudentData[];
  alternatives: AlternativeData[];
  weights: {
    weights: number[];
    labels: string[];
    types: ("Benefit" | "Cost")[];
  };
  threshold: number;
}

export interface DefaultDataResponse extends ApiResponse<DefaultData> {}

export interface ParseDataResponse extends ApiResponse<
  StudentData[] | AlternativeData[]
> {
  rawColumns?: string[];
  rowCount?: number;
  fileName?: string;
}

export interface HealthResponse {
  status: string;
  message: string;
  timestamp: string;
}

export interface InfoResponse {
  name: string;
  version: string;
  description: string;
  endpoints: Record<string, string>;
}

export interface SheetsValidationResult {
  isValid: boolean;
  sheetId?: string;
  sheetsFound?: string[];
  message?: string;
}

export interface ApiError {
  status: number;
  message: string;
  code?: string;
  details?: Record<string, unknown>;
}

export interface LoadingState {
  isLoading: boolean;
  progress?: number;
  message?: string;
}

export interface RequestOptions {
  timeout?: number;
  retries?: number;
  signal?: AbortSignal;
  onProgress?: (progress: number) => void;
}

export type SupportedFileType = "csv" | "xls" | "xlsx";

export interface Criteria {
  id: string;
  label: string;
  weight: number;
  type: "Benefit" | "Cost";
}

export const DEFAULT_CRITERIA: Criteria[] = [
  { id: "c1", label: "Akumulasi Nilai", weight: 0.3, type: "Benefit" },
  { id: "c2", label: "Penilaian Sikap", weight: 0.2, type: "Benefit" },
  { id: "c3", label: "Jarak", weight: 0.1, type: "Cost" },
  { id: "c4", label: "Nilai Sertifikasi", weight: 0.25, type: "Benefit" },
  { id: "c5", label: "Rekomendasi Guru", weight: 0.15, type: "Benefit" },
];
