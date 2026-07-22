import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import {
  MVP_SESSION_NOW,
  MVP_SESSION_STORAGE_KEY,
  MvpSessionStore,
} from './mvp-session.store';
import { CapacityId, MvpSessionV1, PermanentQuestionId } from './mvp.types';

const QUESTION_IDS: readonly PermanentQuestionId[] = [
  'starting-work',
  'information-load',
  'decision-support',
  'side-topics',
  'interruption-recovery',
];

function makeNow(values: readonly string[]): () => string {
  let index = 0;
  return () => {
    const value = values[index] ?? values[values.length - 1];
    index += 1;
    return value;
  };
}

function makeSession(overrides?: Partial<MvpSessionV1>): MvpSessionV1 {
  return {
    schemaVersion: 1,
    flow: 'questionnaire',
    startedAtIso: '2026-01-01T00:00:00.000Z',
    updatedAtIso: '2026-01-01T00:00:00.000Z',
    permanentSelections: {},
    capacity: null,
    ...overrides,
  };
}

function bootStore(nowValues: readonly string[] = ['2026-01-01T00:00:00.000Z']): MvpSessionStore {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      {
        provide: MVP_SESSION_NOW,
        useFactory: () => makeNow(nowValues),
      },
    ],
  });
  return TestBed.inject(MvpSessionStore);
}

describe('MvpSessionStore', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it('starts empty when storage key is missing', () => {
    const store = bootStore();

    expect(store.session()).toBeNull();
    expect(store.permanentSelections()).toEqual({});
    expect(store.capacity()).toBeNull();
    expect(store.hasPermanentProgress()).toBeFalse();
    expect(store.hasCompletePermanentProfile()).toBeFalse();
  });

  it('hydrates a valid empty stored session', () => {
    sessionStorage.setItem(MVP_SESSION_STORAGE_KEY, JSON.stringify(makeSession()));

    const store = bootStore();

    expect(store.session()).toEqual(makeSession());
    expect(store.hasPermanentProgress()).toBeFalse();
    expect(store.hasCompletePermanentProfile()).toBeFalse();
  });

  it('hydrates a valid partial stored session', () => {
    const partial = makeSession({
      permanentSelections: {
        'starting-work': 'A',
        'information-load': 'B',
      },
      capacity: 'limited',
      updatedAtIso: '2026-01-01T00:00:10.000Z',
    });
    sessionStorage.setItem(MVP_SESSION_STORAGE_KEY, JSON.stringify(partial));

    const store = bootStore();

    expect(store.session()).toEqual(partial);
    expect(store.hasPermanentProgress()).toBeTrue();
    expect(store.hasCompletePermanentProfile()).toBeFalse();
    expect(store.capacity()).toBe('limited');
  });

  it('hydrates a valid complete stored session', () => {
    const complete = makeSession({
      permanentSelections: {
        'starting-work': 'A',
        'information-load': 'B',
        'decision-support': 'C',
        'side-topics': 'A',
        'interruption-recovery': 'B',
      },
      capacity: 'very-limited',
      updatedAtIso: '2026-01-01T00:00:15.000Z',
    });
    sessionStorage.setItem(MVP_SESSION_STORAGE_KEY, JSON.stringify(complete));

    const store = bootStore();

    expect(store.session()).toEqual(complete);
    expect(store.hasPermanentProgress()).toBeTrue();
    expect(store.hasCompletePermanentProfile()).toBeTrue();
  });

  it('rejects malformed JSON and removes the MVP key', () => {
    sessionStorage.setItem(MVP_SESSION_STORAGE_KEY, '{bad-json');

    const store = bootStore();

    expect(store.session()).toBeNull();
    expect(sessionStorage.getItem(MVP_SESSION_STORAGE_KEY)).toBeNull();
  });

  it('rejects non-object stored values', () => {
    const invalidValues: unknown[] = [null, [], 'x', 7, true];

    for (const invalid of invalidValues) {
      sessionStorage.setItem(MVP_SESSION_STORAGE_KEY, JSON.stringify(invalid));
      const store = bootStore();
      expect(store.session()).withContext(String(invalid)).toBeNull();
      expect(sessionStorage.getItem(MVP_SESSION_STORAGE_KEY)).toBeNull();
    }
  });

  it('rejects missing required structural fields', () => {
    const base = makeSession() as unknown as Record<string, unknown>;
    const requiredFields = [
      'schemaVersion',
      'flow',
      'startedAtIso',
      'updatedAtIso',
      'permanentSelections',
      'capacity',
    ];

    for (const field of requiredFields) {
      const clone = { ...base };
      delete clone[field];
      sessionStorage.setItem(MVP_SESSION_STORAGE_KEY, JSON.stringify(clone));
      const store = bootStore();
      expect(store.session()).withContext(`missing ${field}`).toBeNull();
      expect(sessionStorage.getItem(MVP_SESSION_STORAGE_KEY)).toBeNull();
    }
  });

  it('rejects extra top-level fields (strict schema)', () => {
    const withExtra = {
      ...makeSession(),
      extra: 'nope',
    };
    sessionStorage.setItem(MVP_SESSION_STORAGE_KEY, JSON.stringify(withExtra));

    const store = bootStore();

    expect(store.session()).toBeNull();
    expect(sessionStorage.getItem(MVP_SESSION_STORAGE_KEY)).toBeNull();
  });

  it('rejects wrong schemaVersion or flow', () => {
    sessionStorage.setItem(MVP_SESSION_STORAGE_KEY, JSON.stringify({ ...makeSession(), schemaVersion: 2 }));
    expect(bootStore().session()).toBeNull();

    sessionStorage.setItem(MVP_SESSION_STORAGE_KEY, JSON.stringify({ ...makeSession(), flow: 'wizard' }));
    expect(bootStore().session()).toBeNull();
  });

  it('rejects invalid timestamps and updated earlier than started', () => {
    const invalidCases = [
      { ...makeSession(), startedAtIso: 'not-a-date' },
      { ...makeSession(), updatedAtIso: 'also-not-a-date' },
      {
        ...makeSession(),
        startedAtIso: '2026-01-01T00:00:10.000Z',
        updatedAtIso: '2026-01-01T00:00:09.000Z',
      },
    ];

    for (const invalid of invalidCases) {
      sessionStorage.setItem(MVP_SESSION_STORAGE_KEY, JSON.stringify(invalid));
      const store = bootStore();
      expect(store.session()).toBeNull();
      expect(sessionStorage.getItem(MVP_SESSION_STORAGE_KEY)).toBeNull();
    }
  });

  it('rejects non-object permanentSelections', () => {
    const invalidValues: unknown[] = [null, [], 'A', 7, true];

    for (const invalid of invalidValues) {
      sessionStorage.setItem(
        MVP_SESSION_STORAGE_KEY,
        JSON.stringify({ ...makeSession(), permanentSelections: invalid })
      );
      const store = bootStore();
      expect(store.session()).withContext(String(invalid)).toBeNull();
      expect(sessionStorage.getItem(MVP_SESSION_STORAGE_KEY)).toBeNull();
    }
  });

  it('rejects unknown question IDs in permanent selections', () => {
    const invalid = makeSession({
      permanentSelections: {
        'starting-work': 'A',
        'unexpected-question': 'B',
      } as unknown as Partial<Record<PermanentQuestionId, 'A' | 'B' | 'C'>>,
    });

    sessionStorage.setItem(MVP_SESSION_STORAGE_KEY, JSON.stringify(invalid));

    const store = bootStore();

    expect(store.session()).toBeNull();
    expect(sessionStorage.getItem(MVP_SESSION_STORAGE_KEY)).toBeNull();
  });

  it('rejects invalid option codes in permanent selections', () => {
    for (const questionId of QUESTION_IDS) {
      const invalid = makeSession({
        permanentSelections: {
          [questionId]: 'Z',
        } as unknown as Partial<Record<PermanentQuestionId, 'A' | 'B' | 'C'>>,
      });

      sessionStorage.setItem(MVP_SESSION_STORAGE_KEY, JSON.stringify(invalid));
      const store = bootStore();
      expect(store.session()).withContext(questionId).toBeNull();
      expect(sessionStorage.getItem(MVP_SESSION_STORAGE_KEY)).toBeNull();
    }
  });

  it('rejects invalid capacity values', () => {
    const invalidCapacities: unknown[] = ['busy', 4, {}, [], false];

    for (const invalidCapacity of invalidCapacities) {
      sessionStorage.setItem(
        MVP_SESSION_STORAGE_KEY,
        JSON.stringify({ ...makeSession(), capacity: invalidCapacity })
      );
      const store = bootStore();
      expect(store.session()).withContext(String(invalidCapacity)).toBeNull();
      expect(sessionStorage.getItem(MVP_SESSION_STORAGE_KEY)).toBeNull();
    }
  });

  it('clears inherited legacy key on boot and does not migrate it', () => {
    sessionStorage.setItem('wwm-session-v2', JSON.stringify({ v: 2, answers: { 'load-q1': 'A' } }));

    const store = bootStore();

    expect(store.session()).toBeNull();
    expect(sessionStorage.getItem(MVP_SESSION_STORAGE_KEY)).toBeNull();
    expect(sessionStorage.getItem('wwm-session-v2')).toBeNull();
  });

  it('records each permanent answer and persists complete valid session', () => {
    const store = bootStore(['2026-01-01T00:00:00.000Z', '2026-01-01T00:00:01.000Z']);

    const answers: Record<PermanentQuestionId, 'A' | 'B' | 'C'> = {
      'starting-work': 'A',
      'information-load': 'B',
      'decision-support': 'C',
      'side-topics': 'A',
      'interruption-recovery': 'B',
    };

    for (const questionId of QUESTION_IDS) {
      store.recordPermanentAnswer(questionId, answers[questionId]);
    }

    const persisted = JSON.parse(sessionStorage.getItem(MVP_SESSION_STORAGE_KEY) as string) as MvpSessionV1;
    expect(persisted.permanentSelections).toEqual(answers);
    expect(store.hasCompletePermanentProfile()).toBeTrue();
  });

  it('replaces an existing answer without affecting other answers or capacity', () => {
    const store = bootStore([
      '2026-01-01T00:00:00.000Z',
      '2026-01-01T00:00:10.000Z',
      '2026-01-01T00:00:20.000Z',
      '2026-01-01T00:00:30.000Z',
    ]);

    store.recordPermanentAnswer('starting-work', 'A');
    store.recordPermanentAnswer('information-load', 'B');
    store.setCapacity('limited');
    store.recordPermanentAnswer('starting-work', 'C');

    expect(store.permanentSelections()['starting-work']).toBe('C');
    expect(store.permanentSelections()['information-load']).toBe('B');
    expect(store.capacity()).toBe('limited');
  });

  it('keeps permanent answers and capacity independent', () => {
    const store = bootStore(['2026-01-01T00:00:00.000Z', '2026-01-01T00:00:10.000Z', '2026-01-01T00:00:20.000Z']);

    store.recordPermanentAnswer('decision-support', 'A');
    expect(store.capacity()).toBeNull();

    store.setCapacity('very-limited');
    expect(store.permanentSelections()['decision-support']).toBe('A');

    store.setCapacity(null);
    expect(store.permanentSelections()['decision-support']).toBe('A');
  });

  it('distinguishes incomplete versus complete permanent profile state', () => {
    const store = bootStore(['2026-01-01T00:00:00.000Z', '2026-01-01T00:00:01.000Z']);

    store.recordPermanentAnswer('starting-work', 'A');
    expect(store.hasPermanentProgress()).toBeTrue();
    expect(store.hasCompletePermanentProfile()).toBeFalse();

    store.recordPermanentAnswer('information-load', 'B');
    store.recordPermanentAnswer('decision-support', 'C');
    store.recordPermanentAnswer('side-topics', 'A');
    store.recordPermanentAnswer('interruption-recovery', 'B');

    expect(store.hasCompletePermanentProfile()).toBeTrue();
  });

  it('uses deterministic timestamps for answer and capacity updates', () => {
    const store = bootStore([
      '2026-01-01T00:00:00.000Z',
      '2026-01-01T00:00:05.000Z',
      '2026-01-01T00:00:09.000Z',
      '2026-01-01T00:00:12.000Z',
    ]);

    store.recordPermanentAnswer('starting-work', 'A');
    const first = store.session() as MvpSessionV1;
    expect(first.startedAtIso).toBe('2026-01-01T00:00:00.000Z');
    expect(first.updatedAtIso).toBe('2026-01-01T00:00:05.000Z');

    store.recordPermanentAnswer('information-load', 'B');
    const second = store.session() as MvpSessionV1;
    expect(second.startedAtIso).toBe('2026-01-01T00:00:00.000Z');
    expect(second.updatedAtIso).toBe('2026-01-01T00:00:09.000Z');

    store.setCapacity('limited');
    const third = store.session() as MvpSessionV1;
    expect(third.startedAtIso).toBe('2026-01-01T00:00:00.000Z');
    expect(third.updatedAtIso).toBe('2026-01-01T00:00:12.000Z');
  });

  it('startFresh resets to an empty questionnaire session and persists it', () => {
    const store = bootStore(['2026-01-01T00:00:00.000Z', '2026-01-01T00:00:10.000Z']);
    store.recordPermanentAnswer('starting-work', 'A');

    store.startFresh();

    const session = store.session() as MvpSessionV1;
    expect(session.permanentSelections).toEqual({});
    expect(session.capacity).toBeNull();
    expect(session.startedAtIso).toBe('2026-01-01T00:00:10.000Z');
    expect(session.updatedAtIso).toBe('2026-01-01T00:00:10.000Z');

    const persisted = JSON.parse(sessionStorage.getItem(MVP_SESSION_STORAGE_KEY) as string) as MvpSessionV1;
    expect(persisted).toEqual(session);
  });

  it('clear removes only the MVP key and preserves unrelated session storage entries', () => {
    const store = bootStore(['2026-01-01T00:00:00.000Z', '2026-01-01T00:00:10.000Z']);
    sessionStorage.setItem('unrelated-key', 'keep-me');

    store.recordPermanentAnswer('starting-work', 'A');
    store.clear();

    expect(store.session()).toBeNull();
    expect(sessionStorage.getItem(MVP_SESSION_STORAGE_KEY)).toBeNull();
    expect(sessionStorage.getItem('unrelated-key')).toBe('keep-me');
  });

  it('handles sessionStorage read exceptions gracefully', () => {
    spyOn(Storage.prototype, 'getItem').and.throwError('read-failure');

    const store = bootStore();

    expect(store.session()).toBeNull();
    expect(store.hasPermanentProgress()).toBeFalse();
  });

  it('handles sessionStorage write exceptions gracefully', () => {
    const setSpy = spyOn(Storage.prototype, 'setItem').and.throwError('write-failure');
    const store = bootStore(['2026-01-01T00:00:00.000Z', '2026-01-01T00:00:10.000Z']);

    expect(() => store.recordPermanentAnswer('starting-work', 'A')).not.toThrow();
    expect(store.permanentSelections()['starting-work']).toBe('A');
    expect(setSpy).toHaveBeenCalled();
  });

  it('handles sessionStorage remove exceptions gracefully', () => {
    sessionStorage.setItem(MVP_SESSION_STORAGE_KEY, '{bad-json');
    spyOn(Storage.prototype, 'removeItem').and.throwError('remove-failure');

    const store = bootStore();

    expect(store.session()).toBeNull();
    expect(() => store.clear()).not.toThrow();
  });

  it('never uses localStorage', () => {
    const localGet = spyOn(localStorage, 'getItem').and.callThrough();
    const localSet = spyOn(localStorage, 'setItem').and.callThrough();
    const localRemove = spyOn(localStorage, 'removeItem').and.callThrough();

    const store = bootStore(['2026-01-01T00:00:00.000Z', '2026-01-01T00:00:05.000Z']);
    store.recordPermanentAnswer('starting-work', 'A');
    store.setCapacity('usual');
    store.startFresh();
    store.clear();

    expect(localGet).not.toHaveBeenCalled();
    expect(localSet).not.toHaveBeenCalled();
    expect(localRemove).not.toHaveBeenCalled();
  });

  it('accepts all allowed capacity values including null', () => {
    const store = bootStore([
      '2026-01-01T00:00:00.000Z',
      '2026-01-01T00:00:10.000Z',
      '2026-01-01T00:00:20.000Z',
      '2026-01-01T00:00:30.000Z',
    ]);

    const capacities: readonly (CapacityId | null)[] = ['usual', 'limited', 'very-limited', null];

    for (const capacity of capacities) {
      store.setCapacity(capacity);
      expect(store.capacity()).toBe(capacity);
    }
  });
});
