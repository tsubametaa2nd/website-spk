import type {
  LoadingState,
  VikorResult,
  StudentData,
  AlternativeData,
  ApiError,
} from "./types";

type Listener<T> = (state: T) => void;

export class Store<T> {
  private state: T;
  private listeners: Set<Listener<T>> = new Set();

  constructor(initialState: T) {
    this.state = initialState;
  }

  getState(): T {
    return this.state;
  }

  setState(newState: Partial<T>): void {
    this.state = { ...this.state, ...newState };
    this.notify();
  }

  replaceState(newState: T): void {
    this.state = newState;
    this.notify();
  }

  subscribe(listener: Listener<T>): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach((listener) => listener(this.state));
  }
}

export interface AppState {
  loading: LoadingState;
  students: StudentData[];
  alternatives: AlternativeData[];

  weights: number[];
  vParameter: number;
  threshold: number;
  result: VikorResult | null;

  error: ApiError | null;

  currentStep: "input" | "processing" | "result";
  inputMethod: "manual" | "file" | "sheets";
}

export const initialAppState: AppState = {
  loading: { isLoading: false },
  students: [],
  alternatives: [],
  weights: [0.3, 0.2, 0.1, 0.25, 0.15],
  vParameter: 0.5,
  threshold: 70,
  result: null,
  error: null,
  currentStep: "input",
  inputMethod: "manual",
};

export const appStore = new Store<AppState>(initialAppState);

export function setLoading(loading: Partial<LoadingState>): void {
  appStore.setState({
    loading: { ...appStore.getState().loading, ...loading },
  });
}

export function setStudents(students: StudentData[]): void {
  appStore.setState({ students });
}

export function setAlternatives(alternatives: AlternativeData[]): void {
  appStore.setState({ alternatives });
}

export function setWeights(weights: number[]): void {
  appStore.setState({ weights });
}

export function setVParameter(vParameter: number): void {
  appStore.setState({ vParameter });
}

export function setThreshold(threshold: number): void {
  appStore.setState({ threshold });
}

export function setResult(result: VikorResult | null): void {
  appStore.setState({ result, currentStep: result ? "result" : "input" });
}

export function setError(error: ApiError | null): void {
  appStore.setState({ error });
}

export function setCurrentStep(step: AppState["currentStep"]): void {
  appStore.setState({ currentStep: step });
}

export function setInputMethod(method: AppState["inputMethod"]): void {
  appStore.setState({ inputMethod: method });
}

export function resetState(): void {
  appStore.replaceState(initialAppState);
}

export function clearResults(): void {
  appStore.setState({
    result: null,
    error: null,
    currentStep: "input",
  });
}

export function selectLoading(): LoadingState {
  return appStore.getState().loading;
}

export function selectHasStudents(): boolean {
  return appStore.getState().students.length > 0;
}

export function selectHasAlternatives(): boolean {
  return appStore.getState().alternatives.length > 0;
}

export function selectCanProcess(): boolean {
  const state = appStore.getState();
  return state.students.length > 0 && state.alternatives.length > 0;
}

export function selectQualifiedCount(): number {
  const result = appStore.getState().result;
  return result?.qualifiedResults.length ?? 0;
}

export function selectDisqualifiedCount(): number {
  const result = appStore.getState().result;
  return result?.disqualifiedStudents.length ?? 0;
}

const STORAGE_KEY = "spk_vikor_state";

export function persistState(): void {
  try {
    const state = appStore.getState();
    const stateToPersist = {
      students: state.students,
      alternatives: state.alternatives,
      weights: state.weights,
      vParameter: state.vParameter,
      threshold: state.threshold,
      inputMethod: state.inputMethod,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToPersist));
  } catch (e) {
    console.warn("Failed to persist state:", e);
  }
}

export function loadPersistedState(): Partial<AppState> | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.warn("Failed to load persisted state:", e);
  }
  return null;
}

export function initializeFromStorage(): void {
  const persisted = loadPersistedState();
  if (persisted) {
    appStore.setState(persisted);
  }
}

export function clearPersistedState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.warn("Failed to clear persisted state:", e);
  }
}
