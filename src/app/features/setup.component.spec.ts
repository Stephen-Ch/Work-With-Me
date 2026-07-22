import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import {
  MVP_SESSION_NOW,
  MVP_SESSION_STORAGE_KEY,
  MvpSessionStore,
} from '../core/mvp/mvp-session.store';
import { MvpContentService, MvpContentState } from '../core/mvp/mvp-content.service';
import { validateMvpContent } from '../core/mvp/mvp-content.repository';
import { SetupComponent } from './setup.component';
import rawMvpContent from '../../assets/content/mvp-content.json';

function validatedContent() {
  const result = validateMvpContent(rawMvpContent);
  if (!result.valid || !result.value) {
    throw new Error('Fixture should be valid');
  }
  return result.value;
}

class MvpContentServiceStub {
  private readonly _state = signal<MvpContentState>({
    content: validatedContent(),
    loading: false,
    error: null,
  });
  private readonly contentState = signal(this._state().content);
  private readonly loadingState = signal(this._state().loading);
  private readonly errorState = signal(this._state().error);

  readonly state = this._state.asReadonly();
  readonly content = this.contentState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly loadContent = jasmine.createSpy('loadContent').and.callFake(async () => {
    this.refresh();
  });
  readonly retry = jasmine.createSpy('retry').and.callFake(async () => {
    this.refresh();
  });

  setState(state: MvpContentState): void {
    this._state.set(state);
    this.refresh();
  }

  private refresh(): void {
    this.contentState.set(this._state().content);
    this.loadingState.set(this._state().loading);
    this.errorState.set(this._state().error);
  }
}

describe('SetupComponent', () => {
  let component: SetupComponent;
  let fixture: ComponentFixture<SetupComponent>;
  let sessionStore: MvpSessionStore;
  let contentService: MvpContentServiceStub;
  let router: Router;

  beforeEach(async () => {
    sessionStorage.clear();
    contentService = new MvpContentServiceStub();

    await TestBed.configureTestingModule({
      imports: [SetupComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        {
          provide: MVP_SESSION_NOW,
          useValue: () => '2026-07-22T00:00:00.000Z',
        },
        { provide: MvpContentService, useValue: contentService },
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(SetupComponent);
    component = fixture.componentInstance;
    sessionStore = TestBed.inject(MvpSessionStore);
    router = TestBed.inject(Router);
    spyOn(router, 'navigate');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('loads exactly five MVP questions', () => {
    expect(component.totalQuestions()).toBe(5);
  });

  it('uses exact locked question order', () => {
    expect(component.questions().map((q) => q.id)).toEqual([
      'starting-work',
      'information-load',
      'decision-support',
      'side-topics',
      'interruption-recovery',
    ]);
  });

  it('renders exact answer text for the current question', () => {
    const firstQuestion = component.questions()[0];
    expect(fixture.nativeElement.textContent).toContain(firstQuestion.options[0].answerText);
    expect(fixture.nativeElement.textContent).toContain(firstQuestion.options[1].answerText);
    expect(fixture.nativeElement.textContent).toContain(firstQuestion.options[2].answerText);
  });

  it('uses native radio semantics', () => {
    const fieldset = fixture.nativeElement.querySelector('[data-testid="question-fieldset"]') as HTMLElement;
    const legend = fieldset.querySelector('legend');
    const radios = Array.from(fieldset.querySelectorAll('input[type="radio"]')) as HTMLInputElement[];

    expect(legend).toBeTruthy();
    expect(radios.length).toBe(3);
    expect(new Set(radios.map((radio) => radio.name)).size).toBe(1);
  });

  it('requires an answer before advancing', () => {
    const next = fixture.nativeElement.querySelector('[data-testid="next-btn"]') as HTMLButtonElement;
    expect(next.disabled).toBeTrue();

    const optionA = fixture.nativeElement.querySelector('[data-testid="option-A"]') as HTMLInputElement;
    optionA.click();
    fixture.detectChanges();

    expect(next.disabled).toBeFalse();
  });

  it('supports Back and answer replacement while preserving other answers', () => {
    const optionA = fixture.nativeElement.querySelector('[data-testid="option-A"]') as HTMLInputElement;
    optionA.click();
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('[data-testid="next-btn"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    const optionC = fixture.nativeElement.querySelector('[data-testid="option-C"]') as HTMLInputElement;
    optionC.click();
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('[data-testid="back-btn"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    const firstQuestionOptionB = fixture.nativeElement.querySelector('[data-testid="option-B"]') as HTMLInputElement;
    firstQuestionOptionB.click();
    fixture.detectChanges();

    expect(sessionStore.permanentSelections()['starting-work']).toBe('B');
    expect(sessionStore.permanentSelections()['information-load']).toBe('C');
  });

  it('resumes at the first unanswered question after reload', async () => {
    sessionStorage.setItem(
      MVP_SESSION_STORAGE_KEY,
      JSON.stringify({
        schemaVersion: 1,
        flow: 'questionnaire',
        startedAtIso: '2026-07-22T00:00:00.000Z',
        updatedAtIso: '2026-07-22T00:00:00.000Z',
        permanentSelections: {
          'starting-work': 'A',
          'information-load': 'B',
        },
        capacity: null,
      })
    );

    TestBed.resetTestingModule();
    contentService = new MvpContentServiceStub();

    await TestBed.configureTestingModule({
      imports: [SetupComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        {
          provide: MVP_SESSION_NOW,
          useValue: () => '2026-07-22T00:00:00.000Z',
        },
        { provide: MvpContentService, useValue: contentService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SetupComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.currentQuestion()?.id).toBe('decision-support');
    expect(fixture.nativeElement.textContent).toContain('Question 3 of 5');
  });

  it('navigates to /result when a complete profile already exists on reload', async () => {
    sessionStorage.setItem(
      MVP_SESSION_STORAGE_KEY,
      JSON.stringify({
        schemaVersion: 1,
        flow: 'questionnaire',
        startedAtIso: '2026-07-22T00:00:00.000Z',
        updatedAtIso: '2026-07-22T00:00:00.000Z',
        permanentSelections: {
          'starting-work': 'A',
          'information-load': 'B',
          'decision-support': 'C',
          'side-topics': 'A',
          'interruption-recovery': 'B',
        },
        capacity: null,
      })
    );

    TestBed.resetTestingModule();
    contentService = new MvpContentServiceStub();

    await TestBed.configureTestingModule({
      imports: [SetupComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        {
          provide: MVP_SESSION_NOW,
          useValue: () => '2026-07-22T00:00:00.000Z',
        },
        { provide: MvpContentService, useValue: contentService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SetupComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    spyOn(router, 'navigate');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(router.navigate).toHaveBeenCalledWith(['/result']);
  });

  it('shows loading and error states and supports Retry', async () => {
    contentService.setState({ content: null, loading: true, error: null });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-testid="loading-state"]')).toBeTruthy();

    contentService.setState({ content: null, loading: false, error: 'Unable to load Work With Me content. Please retry.' });
    fixture.detectChanges();
    const retryButton = fixture.nativeElement.querySelector('[data-testid="retry-btn"]') as HTMLButtonElement;
    expect(retryButton).toBeTruthy();

    retryButton.click();
    await fixture.whenStable();
    expect(contentService.loadContent).toHaveBeenCalled();
  });

  it('navigates to /result only when profile is complete on final Next', () => {
    const answers: ReadonlyArray<'A' | 'B' | 'C'> = ['A', 'B', 'C', 'A', 'B'];
    for (const answer of answers) {
      const option = fixture.nativeElement.querySelector(`[data-testid="option-${answer}"]`) as HTMLInputElement;
      option.click();
      fixture.detectChanges();

      const next = fixture.nativeElement.querySelector('[data-testid="next-btn"]') as HTMLButtonElement;
      next.click();
      fixture.detectChanges();
    }

    expect(router.navigate).toHaveBeenCalledWith(['/result']);
  });

  it('clears inherited legacy key while running MVP setup flow', async () => {
    sessionStorage.setItem('wwm-session-v2', 'legacy');

    TestBed.resetTestingModule();
    contentService = new MvpContentServiceStub();

    await TestBed.configureTestingModule({
      imports: [SetupComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        {
          provide: MVP_SESSION_NOW,
          useValue: () => '2026-07-22T00:00:00.000Z',
        },
        { provide: MvpContentService, useValue: contentService },
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(SetupComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();

    expect(sessionStorage.getItem('wwm-session-v2')).toBeNull();
  });
});