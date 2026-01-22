
export { API_CONFIG, API_ENDPOINTS } from "./config";
export type { ApiEndpoint } from "./config";

export type {
  StudentData,
  AlternativeData,
  ProcessVikorRequest,
  ProcessVikorSheetsRequest,
  ParseGoogleSheetsRequest,
  UploadFileRequest,

  ApiResponse,
  VikorResult,
  QualifiedResult,
  DisqualifiedStudent,
  DudiRecommendation,
  VikorMetadata,
  VikorSummary,
  DefaultData,
  DefaultDataResponse,
  ParseDataResponse,
  HealthResponse,
  InfoResponse,
  SheetsValidationResult,

  ApiError,
  LoadingState,
  RequestOptions,
  SupportedFileType,
  Criteria,
} from "./types";

export { DEFAULT_CRITERIA } from "./types";

export {
  HttpClient,
  httpClient,
  createHttpClient,
  ApiException,
  buildUrl,
} from "./http-client";

export {
  checkHealth,
  getApiInfo,
  isApiAvailable,
  processVikor,
  processVikorFromSheets,

  parseGoogleSheets,
  uploadFile,

  downloadCsv,
  downloadCsvToFile,

  getDefaultData,

  validateSheetsConnection,
  fetchKriteriaFromSheets,
  fetchJarakFromSheets,
  fetchCompleteFromSheets,

  extractSheetId,
  validateUploadFile,
} from "./api";

export {
  Store,
  appStore,
  initialAppState,

  setLoading,
  setStudents,
  setAlternatives,
  setWeights,
  setVParameter,
  setThreshold,
  setResult,
  setError,
  setCurrentStep,
  setInputMethod,
  resetState,
  clearResults,

  selectLoading,
  selectHasStudents,
  selectHasAlternatives,
  selectCanProcess,
  selectQualifiedCount,
  selectDisqualifiedCount,

  persistState,
  loadPersistedState,
  initializeFromStorage,
  clearPersistedState,
} from "./hooks";

export type { AppState } from "./hooks";

export {
  processVikorCalculation,
  processVikorFromSheets as executeVikorFromSheets,

  loadStudentsFromFile,
  loadAlternativesFromFile,
  loadStudentsFromSheets,
  loadAlternativesFromSheets,
  loadDefaultData,
  loadCompleteFromSheets,

  downloadResults,

  checkApiConnection,
} from "./use-api";
