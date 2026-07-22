import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { isMvpResultEligible, mvpResultGuard } from './mvp-result.guard';
import { CapacityId, PermanentQuestionId } from './mvp.types';
import { MvpSessionStore } from './mvp-session.store';

const QUESTION_IDS: readonly PermanentQuestionId[] = [
  'starting-work',
  'information-load',
  'decision-support',
  'side-topics',
  'interruption-recovery',
];

type EligibleProfile = Record<PermanentQuestionId, 'A' | 'B' | 'C'>;

function validProfile(): EligibleProfile {
  return {
    'starting-work': 'A',
    'information-load': 'B',
    'decision-support': 'C',
    'side-topics': 'A',
    'interruption-recovery': 'B',
  };
}

class ProfileCarrier {
  'starting-work' = 'A' as const;
  'information-load' = 'B' as const;
  'decision-support' = 'C' as const;
  'side-topics' = 'A' as const;
  'interruption-recovery' = 'B' as const;
}

describe('isMvpResultEligible', () => {
  it('returns true for a valid complete five-answer profile', () => {
    expect(isMvpResultEligible(validProfile())).toBeTrue();
  });

  it('returns false when each required question is missing', () => {
    for (const questionId of QUESTION_IDS) {
      const profile = { ...validProfile() } as Partial<EligibleProfile>;
      delete profile[questionId];
      expect(isMvpResultEligible(profile)).withContext(questionId).toBeFalse();
    }
  });

  it('returns false for invalid option values per question', () => {
    for (const questionId of QUESTION_IDS) {
      const profile = { ...validProfile(), [questionId]: 'Z' } as unknown;
      expect(isMvpResultEligible(profile)).withContext(questionId).toBeFalse();
    }
  });

  it('returns false for unknown question IDs and extra properties', () => {
    const unknownQuestion = {
      ...validProfile(),
      'unexpected-question': 'A',
    };
    expect(isMvpResultEligible(unknownQuestion)).toBeFalse();

    const extraProperty = {
      ...validProfile(),
      extra: true,
    };
    expect(isMvpResultEligible(extraProperty)).toBeFalse();
  });

  it('returns false for empty object, partial object, null, array, and primitive', () => {
    expect(isMvpResultEligible({})).toBeFalse();
    expect(isMvpResultEligible({ 'starting-work': 'A' })).toBeFalse();
    expect(isMvpResultEligible(null)).toBeFalse();
    expect(isMvpResultEligible([])).toBeFalse();
    expect(isMvpResultEligible('profile')).toBeFalse();
    expect(isMvpResultEligible(7)).toBeFalse();
    expect(isMvpResultEligible(false)).toBeFalse();
  });

  it('returns false for the inherited six-control answer shape', () => {
    const legacy = {
      'load-q1': 'A',
      'scope-q1': 'B',
      'challenge-q1': 'C',
      'rigor-q1': 'A',
      'coachingThreshold-q1': 'B',
      'coachingDelivery-q1': 'C',
    };

    expect(isMvpResultEligible(legacy)).toBeFalse();
  });

  it('returns false for Object.create({}) profiles even with valid keys and values', () => {
    const profile = Object.create({}) as Record<string, unknown>;
    Object.assign(profile, validProfile());

    expect(isMvpResultEligible(profile)).toBeFalse();
  });

  it('returns false for class-instance profiles even with valid keys and values', () => {
    const profile = new ProfileCarrier();

    expect(isMvpResultEligible(profile)).toBeFalse();
  });

  it('returns false when prototype is neither Object.prototype nor null', () => {
    const customPrototype = { marker: true };
    const profile = Object.create(customPrototype) as Record<string, unknown>;
    Object.assign(profile, validProfile());

    expect(isMvpResultEligible(profile)).toBeFalse();
  });

  it('returns true for Object.create(null) when valid keys and values are present', () => {
    const profile = Object.create(null) as Record<string, unknown>;
    Object.assign(profile, validProfile());

    expect(isMvpResultEligible(profile)).toBeTrue();
  });
});

describe('mvpResultGuard', () => {
  let router: { parseUrl: jasmine.Spy<(url: string) => UrlTree> };

  const runGuard = () =>
    TestBed.runInInjectionContext(() =>
      mvpResultGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot)
    );

  const makeStore = (selections: unknown, capacity: CapacityId | null) => ({
    permanentSelections: () => selections,
    capacity: () => capacity,
  });

  beforeEach(() => {
    router = {
      parseUrl: jasmine.createSpy('parseUrl').and.callFake((url: string) => ({ url } as unknown as UrlTree)),
    };
  });

  function configureStore(selections: unknown, capacity: CapacityId | null): void {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: Router, useValue: router },
        { provide: MvpSessionStore, useValue: makeStore(selections, capacity) },
      ],
    });
  }

  it('allows navigation for complete profile', () => {
    configureStore(validProfile(), null);

    const outcome = runGuard();

    expect(outcome).toBeTrue();
    expect(router.parseUrl).not.toHaveBeenCalled();
  });

  it('redirects to /setup for incomplete profile', () => {
    configureStore({ 'starting-work': 'A' }, null);

    const outcome = runGuard();

    expect(router.parseUrl).toHaveBeenCalledWith('/setup');
    expect((outcome as unknown as { url: string }).url).toBe('/setup');
  });

  it('redirects to /setup for malformed profile', () => {
    configureStore('bad-profile', null);

    const outcome = runGuard();

    expect(router.parseUrl).toHaveBeenCalledWith('/setup');
    expect((outcome as unknown as { url: string }).url).toBe('/setup');
  });

  it('allows complete profile when capacity is null', () => {
    configureStore(validProfile(), null);
    expect(runGuard()).toBeTrue();
  });

  it('allows complete profile when capacity is usual', () => {
    configureStore(validProfile(), 'usual');
    expect(runGuard()).toBeTrue();
  });

  it('allows complete profile when capacity is limited', () => {
    configureStore(validProfile(), 'limited');
    expect(runGuard()).toBeTrue();
  });

  it('allows complete profile when capacity is very-limited', () => {
    configureStore(validProfile(), 'very-limited');
    expect(runGuard()).toBeTrue();
  });

  it('redirect URL is exactly /setup', () => {
    configureStore({}, 'limited');

    const outcome = runGuard();

    expect(router.parseUrl).toHaveBeenCalledWith('/setup');
    expect((outcome as unknown as { url: string }).url).toBe('/setup');
  });
});
