/**
 * V2 resultGuard tests
 * @proves Guard allows /result only after all six required answers are present, and redirects to /setup otherwise
 */
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { resultGuard } from './result.guard';
import { SessionStore } from '../core/session/session.store';

describe('resultGuard (V2)', () => {
  let router: { parseUrl: jasmine.Spy<(url: string) => UrlTree> };

  const makeStore = (hasCompletedSetup: boolean, hasProgress: boolean) => ({
    hasCompletedSetup: () => hasCompletedSetup,
    hasSavedProgress: () => hasProgress,
    answers: () => hasProgress ? { 'load-q1': 'A' as const } : {}
  });

  beforeEach(() => {
    router = {
      parseUrl: jasmine.createSpy('parseUrl').and.callFake((url: string) => ({ url } as unknown as UrlTree))
    };
  });

  const runGuard = () =>
    TestBed.runInInjectionContext(() =>
      resultGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot)
    );

  it('allows navigation when user has answered all six required questions', () => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: Router, useValue: router },
        { provide: SessionStore, useValue: makeStore(true, true) }
      ]
    });

    const outcome = runGuard();

    expect(router.parseUrl).not.toHaveBeenCalled();
    expect(outcome).toBeTrue();
  });

  it('redirects to /setup when the user has partial progress only', () => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: Router, useValue: router },
        { provide: SessionStore, useValue: makeStore(false, true) }
      ]
    });

    const outcome = runGuard();

    expect(router.parseUrl).toHaveBeenCalledWith('/setup');
    expect((outcome as unknown as { url: string }).url).toBe('/setup');
  });

  it('redirects to /setup when the user has no saved progress', () => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: Router, useValue: router },
        { provide: SessionStore, useValue: makeStore(false, false) }
      ]
    });

    const outcome = runGuard();

    expect(router.parseUrl).toHaveBeenCalledWith('/setup');
    expect((outcome as unknown as { url: string }).url).toBe('/setup');
  });
});
