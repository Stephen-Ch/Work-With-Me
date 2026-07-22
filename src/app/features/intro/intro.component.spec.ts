/**
 * MVP IntroComponent tests.
 * @proves Intro uses MVP session state and routes without age-gate/analytics behavior.
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { Router } from '@angular/router';
import { By } from '@angular/platform-browser';
import { IntroComponent } from './intro.component';
import { MvpSessionStore } from '../../core/mvp/mvp-session.store';

class MvpSessionStoreStub {
  private readonly progressState = signal(false);
  private readonly completeState = signal(false);

  readonly hasPermanentProgress = this.progressState.asReadonly();
  readonly hasCompletePermanentProfile = this.completeState.asReadonly();
  readonly startFresh = jasmine.createSpy('startFresh');
  readonly clear = jasmine.createSpy('clear');

  setProgress(progress: boolean, complete: boolean): void {
    this.progressState.set(progress);
    this.completeState.set(complete);
  }
}

describe('IntroComponent (MVP)', () => {
  let component: IntroComponent;
  let fixture: ComponentFixture<IntroComponent>;
  let router: Router;
  let sessionStore: MvpSessionStoreStub;

  beforeEach(async () => {
    sessionStore = new MvpSessionStoreStub();

    await TestBed.configureTestingModule({
      imports: [IntroComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([
          { path: 'setup', component: class {} },
          { path: 'result', component: class {} },
        ]),
        { provide: MvpSessionStore, useValue: sessionStore },
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(IntroComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    spyOn(router, 'navigate');
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render the start button', () => {
    const startButton = fixture.debugElement.query(By.css('[data-testid="start-btn"]'));
    expect(startButton).toBeTruthy();
  });

  it('keeps Start enabled without age confirmation', () => {
    const startButton = fixture.debugElement.query(By.css('[data-testid="start-btn"]'));
    expect(startButton.nativeElement.disabled).toBe(false);
  });

  it('shows only Start when there is no MVP progress', () => {
    const resumeButton = fixture.debugElement.query(By.css('[data-testid="resume-btn"]'));
    expect(resumeButton).toBeFalsy();
    expect(fixture.debugElement.query(By.css('[data-testid="start-btn"]'))).toBeTruthy();
  });

  it('shows Resume and Start over for partial MVP progress', () => {
    sessionStore.setProgress(true, false);
    fixture.detectChanges();

    const resumeButton = fixture.debugElement.query(By.css('[data-testid="resume-btn"]'));
    expect(resumeButton).toBeTruthy();
    expect(fixture.debugElement.query(By.css('[data-testid="start-over-btn"]'))).toBeTruthy();
    expect(fixture.debugElement.query(By.css('[data-testid="start-btn"]'))).toBeFalsy();
  });

  it('routes Resume to /result for complete profile', () => {
    sessionStore.setProgress(true, true);
    fixture.detectChanges();

    component.resume();

    expect(router.navigate).toHaveBeenCalledWith(['/result']);
  });

  it('start creates a fresh MVP session and routes to /setup', () => {
    component.start();

    expect(sessionStore.startFresh).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/setup']);
  });

  it('routes Resume to /setup for partial profile', () => {
    sessionStore.setProgress(true, false);
    fixture.detectChanges();

    component.resume();

    expect(router.navigate).toHaveBeenCalledWith(['/setup']);
  });

  it('start over clears only MVP session state', () => {
    component.startOver();

    expect(sessionStore.clear).toHaveBeenCalled();
  });

  it('does not render age-gate or six-control copy', () => {
    expect(fixture.nativeElement.textContent).not.toContain('13 or older');
    expect(fixture.nativeElement.textContent).not.toContain('Information Load');
    expect(fixture.nativeElement.textContent).not.toContain('Scope Management');
    expect(fixture.nativeElement.textContent).not.toContain('Challenge Level');
    expect(fixture.nativeElement.textContent).not.toContain('Thinking Rigor');
    expect(fixture.nativeElement.textContent).not.toContain('Coaching Threshold');
    expect(fixture.nativeElement.textContent).not.toContain('Coaching Delivery');
  });
});
