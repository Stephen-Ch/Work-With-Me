/**
 * MVP ResultComponent tests.
 * @proves deterministic permanent prompt rendering and copy/start-over behavior.
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { ResultComponent } from './result.component';
import { MvpContentService, MvpContentState } from '../core/mvp/mvp-content.service';
import { MvpSessionStore, MVP_SESSION_NOW, MVP_SESSION_STORAGE_KEY } from '../core/mvp/mvp-session.store';
import { validateMvpContent } from '../core/mvp/mvp-content.repository';
import rawMvpContent from '../../assets/content/mvp-content.json';
import { generatePermanentPrompt } from '../core/mvp/mvp-generator';

function validatedContent() {
  const result = validateMvpContent(rawMvpContent);
  if (!result.valid || !result.value) {
    throw new Error('Fixture should be valid');
  }
  return result.value;
}

class MvpContentServiceStub {
  private readonly contentSignal = signal(validatedContent());
  private readonly loadingSignal = signal(false);
  private readonly errorSignal = signal<string | null>(null);

  readonly content = this.contentSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();
  readonly state = signal<MvpContentState>({
    content: this.contentSignal(),
    loading: false,
    error: null,
  }).asReadonly();
  readonly loadContent = jasmine.createSpy('loadContent').and.resolveTo();
}

describe('ResultComponent (MVP)', () => {
  let component: ResultComponent;
  let fixture: ComponentFixture<ResultComponent>;
  let router: Router;
  let sessionStore: MvpSessionStore;
  let contentService: MvpContentServiceStub;
  const content = validatedContent();
  const profile = {
    'starting-work': 'A',
    'information-load': 'B',
    'decision-support': 'C',
    'side-topics': 'A',
    'interruption-recovery': 'B',
  } as const;

  beforeEach(async () => {
    sessionStorage.clear();
    sessionStorage.setItem(
      MVP_SESSION_STORAGE_KEY,
      JSON.stringify({
        schemaVersion: 1,
        flow: 'questionnaire',
        startedAtIso: '2026-07-22T00:00:00.000Z',
        updatedAtIso: '2026-07-22T00:00:00.000Z',
        permanentSelections: profile,
        capacity: null,
      })
    );

    contentService = new MvpContentServiceStub();

    await TestBed.configureTestingModule({
      imports: [ResultComponent],
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

    fixture = TestBed.createComponent(ResultComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    sessionStore = TestBed.inject(MvpSessionStore);
    spyOn(router, 'navigate');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders deterministic permanent prompt', () => {
    const preview = fixture.nativeElement.querySelector('[data-testid="document-preview"]');
    const btn = fixture.nativeElement.querySelector('[data-testid="copy-btn"]');
    const expectedPrompt = generatePermanentPrompt(profile, content).prompt;

    expect(preview).toBeTruthy();
    expect(preview.textContent).toBe(expectedPrompt);
    expect(btn).toBeTruthy();
    expect(btn.textContent.trim()).toBe('Copy permanent prompt');
  });

  it('copies exactly the visible prompt and announces success', async () => {
    const writeText = jasmine.createSpy('writeText').and.resolveTo();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText }
    });

    const preview = fixture.nativeElement.querySelector('[data-testid="document-preview"]') as HTMLElement;

    await component.copyPermanentPrompt();
    fixture.detectChanges();

    expect(writeText).toHaveBeenCalledOnceWith(preview.textContent as string);
    expect(component.copyStatus()).toContain('copied');
  });

  it('shows copy failure guidance when clipboard write fails', async () => {
    const writeText = jasmine.createSpy('writeText').and.rejectWith(new Error('blocked'));
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    await component.copyPermanentPrompt();
    fixture.detectChanges();

    expect(component.copyStatus()).toBe('Copy failed');
    expect(fixture.nativeElement.querySelector('[data-testid="copy-fallback"]')).toBeTruthy();
  });

  it('startOver clears MVP session and routes home', () => {
    sessionStorage.setItem('unrelated-key', 'keep-me');

    component.startOver();

    expect(sessionStore.session()).toBeNull();
    expect(sessionStorage.getItem('unrelated-key')).toBe('keep-me');
    expect(router.navigate).toHaveBeenCalledWith(['/']);
  });

  it('keeps the same prompt after component reload in the same browser session', async () => {
    const firstPrompt = (fixture.nativeElement.querySelector('[data-testid="document-preview"]') as HTMLElement).textContent;

    fixture = TestBed.createComponent(ResultComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const secondPrompt = (fixture.nativeElement.querySelector('[data-testid="document-preview"]') as HTMLElement).textContent;
    expect(secondPrompt).toBe(firstPrompt);
  });

  it('does not render feedback form or capacity UI', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).not.toContain('forms.gle');
    expect(text).not.toContain('Share feedback');
    expect(text).not.toContain('How much bandwidth do you have right now');
    expect(text).not.toContain('Usual bandwidth');
  });
});
