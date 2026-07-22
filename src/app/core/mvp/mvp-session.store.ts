import { Injectable, InjectionToken, computed, inject, signal } from '@angular/core';
import { CapacityId, MvpSessionV1, OptionCode, PermanentQuestionId, PermanentSelections } from './mvp.types';

export const MVP_SESSION_STORAGE_KEY = 'wwm-mvp-session-v1';
const LEGACY_SESSION_STORAGE_KEY = 'wwm-session-v2';

const MVP_SCHEMA_VERSION = 1 as const;
const MVP_FLOW = 'questionnaire' as const;

const PERMANENT_QUESTION_IDS: readonly PermanentQuestionId[] = [
  'starting-work',
  'information-load',
  'decision-support',
  'side-topics',
  'interruption-recovery',
];

const OPTION_CODES: readonly OptionCode[] = ['A', 'B', 'C'];
const CAPACITY_IDS: readonly CapacityId[] = ['usual', 'limited', 'very-limited'];

export type IsoNowFn = () => string;

export const MVP_SESSION_NOW = new InjectionToken<IsoNowFn>('MVP_SESSION_NOW', {
  providedIn: 'root',
  factory: () => () => new Date().toISOString(),
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isOptionCode(value: unknown): value is OptionCode {
  return typeof value === 'string' && OPTION_CODES.includes(value as OptionCode);
}

function isCapacityId(value: unknown): value is CapacityId {
  return typeof value === 'string' && CAPACITY_IDS.includes(value as CapacityId);
}

function isPermanentQuestionId(value: unknown): value is PermanentQuestionId {
  return typeof value === 'string' && PERMANENT_QUESTION_IDS.includes(value as PermanentQuestionId);
}

function isIsoTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }
  return Number.isFinite(Date.parse(value));
}

function hasExactTopLevelKeys(value: Record<string, unknown>): boolean {
  const expected = new Set([
    'schemaVersion',
    'flow',
    'startedAtIso',
    'updatedAtIso',
    'permanentSelections',
    'capacity',
  ]);
  const keys = Object.keys(value);
  if (keys.length !== expected.size) {
    return false;
  }
  return keys.every((key) => expected.has(key));
}

function validatePermanentSelections(value: unknown): value is Partial<PermanentSelections> {
  if (!isPlainObject(value)) {
    return false;
  }

  for (const [questionId, optionCode] of Object.entries(value)) {
    if (!isPermanentQuestionId(questionId)) {
      return false;
    }
    if (!isOptionCode(optionCode)) {
      return false;
    }
  }

  return true;
}

function isMvpSessionV1(value: unknown): value is MvpSessionV1 {
  if (!isPlainObject(value) || !hasExactTopLevelKeys(value)) {
    return false;
  }

  if (value['schemaVersion'] !== MVP_SCHEMA_VERSION) {
    return false;
  }

  if (value['flow'] !== MVP_FLOW) {
    return false;
  }

  if (!isIsoTimestamp(value['startedAtIso']) || !isIsoTimestamp(value['updatedAtIso'])) {
    return false;
  }

  const startedAt = Date.parse(value['startedAtIso']);
  const updatedAt = Date.parse(value['updatedAtIso']);
  if (updatedAt < startedAt) {
    return false;
  }

  if (!validatePermanentSelections(value['permanentSelections'])) {
    return false;
  }

  const capacity = value['capacity'];
  if (capacity !== null && !isCapacityId(capacity)) {
    return false;
  }

  return true;
}

function createFreshSession(nowIso: string): MvpSessionV1 {
  return {
    schemaVersion: MVP_SCHEMA_VERSION,
    flow: MVP_FLOW,
    startedAtIso: nowIso,
    updatedAtIso: nowIso,
    permanentSelections: {},
    capacity: null,
  };
}

function hasCompleteSelections(selections: Partial<PermanentSelections>): selections is PermanentSelections {
  return PERMANENT_QUESTION_IDS.every((questionId) => isOptionCode(selections[questionId]));
}

@Injectable({
  providedIn: 'root',
})
export class MvpSessionStore {
  private readonly now = inject(MVP_SESSION_NOW);
  private readonly _session = signal<MvpSessionV1 | null>(null);

  readonly session = this._session.asReadonly();
  readonly permanentSelections = computed(() => this._session()?.permanentSelections ?? {});
  readonly capacity = computed(() => this._session()?.capacity ?? null);
  readonly hasPermanentProgress = computed(() => Object.keys(this.permanentSelections()).length > 0);
  readonly hasCompletePermanentProfile = computed(() => hasCompleteSelections(this.permanentSelections()));

  constructor() {
    this.hydrateFromStorage();
  }

  recordPermanentAnswer(questionId: PermanentQuestionId, optionCode: OptionCode): void {
    const current = this.ensureSession();
    const next: MvpSessionV1 = {
      ...current,
      updatedAtIso: this.now(),
      permanentSelections: {
        ...current.permanentSelections,
        [questionId]: optionCode,
      },
    };
    this._session.set(next);
    this.persist(next);
  }

  setCapacity(capacity: CapacityId | null): void {
    const current = this.ensureSession();
    const next: MvpSessionV1 = {
      ...current,
      updatedAtIso: this.now(),
      capacity,
    };
    this._session.set(next);
    this.persist(next);
  }

  startFresh(): void {
    const next = createFreshSession(this.now());
    this._session.set(next);
    this.persist(next);
  }

  clear(): void {
    this._session.set(null);
    this.removePersisted();
  }

  private ensureSession(): MvpSessionV1 {
    const current = this._session();
    if (current) {
      return current;
    }
    return createFreshSession(this.now());
  }

  private hydrateFromStorage(): void {
    // Remove inherited six-control session data to prevent stale state leaks.
    try {
      sessionStorage.removeItem(LEGACY_SESSION_STORAGE_KEY);
    } catch {
      // Ignore legacy-key cleanup failures.
    }

    let raw: string | null = null;

    try {
      raw = sessionStorage.getItem(MVP_SESSION_STORAGE_KEY);
    } catch {
      this._session.set(null);
      return;
    }

    if (!raw) {
      this._session.set(null);
      return;
    }

    try {
      const parsed: unknown = JSON.parse(raw);
      if (!isMvpSessionV1(parsed)) {
        this._session.set(null);
        this.removePersisted();
        return;
      }

      this._session.set(parsed);
    } catch {
      this._session.set(null);
      this.removePersisted();
    }
  }

  private persist(session: MvpSessionV1): void {
    try {
      sessionStorage.setItem(MVP_SESSION_STORAGE_KEY, JSON.stringify(session));
    } catch {
      // Keep safe in-memory state when browser storage is unavailable.
    }
  }

  private removePersisted(): void {
    try {
      sessionStorage.removeItem(MVP_SESSION_STORAGE_KEY);
    } catch {
      // Keep safe in-memory state when browser storage is unavailable.
    }
  }
}
