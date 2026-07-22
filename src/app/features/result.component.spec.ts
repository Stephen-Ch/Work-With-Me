/**
 * MVP ResultComponent tests.
 * @proves deterministic permanent prompt behavior and one-copy composed instructions flow.
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { ResultComponent } from './result.component';
import { MvpContentService, MvpContentState } from '../core/mvp/mvp-content.service';
import { MvpSessionStore, MVP_SESSION_NOW, MVP_SESSION_STORAGE_KEY } from '../core/mvp/mvp-session.store';
import { validateMvpContent } from '../core/mvp/mvp-content.repository';
import rawMvpContent from '../../assets/content/mvp-content.json';
import {
  composeInstructionsForCopy,
  generateCapacityModifier,
  generatePermanentPrompt,
} from '../core/mvp/mvp-generator';
import { CapacityId } from '../core/mvp/mvp.types';

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

  function seedSession(capacity: CapacityId | null): void {
    sessionStorage.setItem(
      MVP_SESSION_STORAGE_KEY,
      JSON.stringify({
        schemaVersion: 1,
        flow: 'questionnaire',
        startedAtIso: '2026-07-22T00:00:00.000Z',
        updatedAtIso: '2026-07-22T00:00:00.000Z',
        permanentSelections: profile,
        capacity,
      })
    );
  }

  async function createComponentWithCapacity(capacity: CapacityId | null): Promise<void> {
    sessionStorage.clear();
    seedSession(capacity);
    TestBed.resetTestingModule();

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
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ResultComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    sessionStore = TestBed.inject(MvpSessionStore);
    spyOn(router, 'navigate');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await createComponentWithCapacity(null);
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
    expect(btn.textContent.trim()).toBe('Copy instructions');
  });

  it('renders one copy action and one copy status region', () => {
    expect(fixture.nativeElement.querySelectorAll('[data-testid="copy-btn"]').length).toBe(1);
    expect(fixture.nativeElement.querySelectorAll('[aria-live="polite"]').length).toBe(1);
    expect(fixture.nativeElement.querySelector('[data-testid="capacity-copy-btn"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="capacity-copy-status"]')).toBeNull();
  });

  it('renders exact capacity question and labels', () => {
    const legend = fixture.nativeElement.querySelector('[data-testid="capacity-fieldset"] legend') as HTMLElement;
    const text = fixture.nativeElement.textContent as string;

    expect(legend.textContent?.trim()).toBe('How much bandwidth do you have right now?');
    expect(text).toContain('Usual bandwidth');
    expect(text).toContain('Limited bandwidth');
    expect(text).toContain('Very limited bandwidth');
  });

  it('uses native capacity radio semantics', () => {
    const fieldset = fixture.nativeElement.querySelector('[data-testid="capacity-fieldset"]') as HTMLElement;
    const legend = fieldset.querySelector('legend');
    const radios = Array.from(fieldset.querySelectorAll('input[type="radio"]')) as HTMLInputElement[];

    expect(legend).toBeTruthy();
    expect(radios.length).toBe(3);
    expect(new Set(radios.map((radio) => radio.name)).size).toBe(1);
  });

  it('with no capacity selected preview stays permanent-only', () => {
    expect(component.selectedCapacity()).toBeNull();
    expect(component.capacityModifierText()).toBeNull();

    const expectedPrompt = generatePermanentPrompt(profile, content).prompt;
    expect(component.composedInstructionsText()).toBe(expectedPrompt);
    expect((fixture.nativeElement.querySelector('[data-testid="document-preview"]') as HTMLElement).textContent).toBe(expectedPrompt);
  });

  it('usual bandwidth persists and keeps preview permanent-only with explanatory note', async () => {
    await createComponentWithCapacity('usual');

    expect(component.selectedCapacity()).toBe('usual');
    expect(component.capacityModifierText()).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="capacity-usual-note"]')).toBeTruthy();

    const expectedPrompt = generatePermanentPrompt(profile, content).prompt;
    expect(component.composedInstructionsText()).toBe(expectedPrompt);
  });

  it('limited bandwidth composes permanent plus exact modifier with one blank line', () => {
    component.setCapacity('limited');
    fixture.detectChanges();

    const expectedPrompt = generatePermanentPrompt(profile, content).prompt;
    const limitedModifier = generateCapacityModifier('limited', content);
    const expected = composeInstructionsForCopy(expectedPrompt, limitedModifier);

    expect(component.composedInstructionsText()).toBe(expected);
    expect(expected).toContain('\n\n');
    expect(expected.endsWith('\n')).toBeFalse();
    expect(expected.split('\n\n').length).toBe(2);
    expect((fixture.nativeElement.querySelector('[data-testid="document-preview"]') as HTMLElement).textContent).toBe(expected);
  });

  it('very limited bandwidth composes permanent plus exact modifier with one blank line', () => {
    component.setCapacity('very-limited');
    fixture.detectChanges();

    const expectedPrompt = generatePermanentPrompt(profile, content).prompt;
    const modifier = generateCapacityModifier('very-limited', content);
    const expected = composeInstructionsForCopy(expectedPrompt, modifier);

    expect(component.composedInstructionsText()).toBe(expected);
    expect(expected).toContain('\n\n');
    expect(expected.endsWith('\n')).toBeFalse();
    expect((fixture.nativeElement.querySelector('[data-testid="document-preview"]') as HTMLElement).textContent).toBe(expected);
  });

  it('selecting a capacity calls setCapacity on the session store', () => {
    const setCapacitySpy = spyOn(sessionStore, 'setCapacity').and.callThrough();

    component.setCapacity('limited');

    expect(setCapacitySpy).toHaveBeenCalledWith('limited');
  });

  it('selected radio reflects hydrated store capacity', async () => {
    await createComponentWithCapacity('limited');

    const limited = fixture.nativeElement.querySelector('[data-testid="capacity-option-limited"]') as HTMLInputElement;
    const usual = fixture.nativeElement.querySelector('[data-testid="capacity-option-usual"]') as HTMLInputElement;

    expect(limited.checked).toBeTrue();
    expect(usual.checked).toBeFalse();
  });

  it('changing capacity does not alter permanent prompt text', () => {
    const before = component.promptText();

    component.setCapacity('limited');
    fixture.detectChanges();
    const afterLimited = component.promptText();

    component.setCapacity('very-limited');
    fixture.detectChanges();
    const afterVeryLimited = component.promptText();

    component.setCapacity('usual');
    fixture.detectChanges();
    const afterUsual = component.promptText();

    expect(afterLimited).toBe(before);
    expect(afterVeryLimited).toBe(before);
    expect(afterUsual).toBe(before);
  });

  it('capacity change updates preview and clears stale copy status', async () => {
    const writeText = jasmine.createSpy('writeText').and.resolveTo();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    component.setCapacity('limited');
    fixture.detectChanges();
    const previewAfterLimited = component.composedInstructionsText() as string;

    await component.copyInstructions();
    fixture.detectChanges();
    expect(component.copyStatus()).toBe('Instructions copied to clipboard.');

    component.setCapacity('very-limited');
    fixture.detectChanges();

    const previewAfterVeryLimited = component.composedInstructionsText() as string;
    expect(previewAfterVeryLimited).not.toBe(previewAfterLimited);
    expect(component.copyStatus()).toBe('');
  });

  it('preview exactly equals copy target for permanent-only case', async () => {
    const writeText = jasmine.createSpy('writeText').and.resolveTo();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText }
    });

    const preview = fixture.nativeElement.querySelector('[data-testid="document-preview"]') as HTMLElement;

    await component.copyInstructions();
    fixture.detectChanges();

    expect(writeText).toHaveBeenCalledOnceWith(preview.textContent as string);
    expect(component.copyStatus()).toContain('copied');
  });

  it('preview exactly equals copy target for limited composed case', async () => {
    const writeText = jasmine.createSpy('writeText').and.resolveTo();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    component.setCapacity('limited');
    fixture.detectChanges();

    const preview = fixture.nativeElement.querySelector('[data-testid="document-preview"]') as HTMLElement;

    await component.copyInstructions();
    fixture.detectChanges();

    expect(writeText).toHaveBeenCalledOnceWith(preview.textContent as string);
  });

  it('preview exactly equals copy target for very-limited composed case', async () => {
    const writeText = jasmine.createSpy('writeText').and.resolveTo();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    component.setCapacity('very-limited');
    fixture.detectChanges();

    const preview = fixture.nativeElement.querySelector('[data-testid="document-preview"]') as HTMLElement;

    await component.copyInstructions();
    fixture.detectChanges();

    expect(writeText).toHaveBeenCalledOnceWith(preview.textContent as string);
  });

  it('limited to very-limited replacement does not duplicate modifiers', () => {
    const limitedModifier = generateCapacityModifier('limited', content) as string;
    const veryLimitedModifier = generateCapacityModifier('very-limited', content) as string;

    component.setCapacity('limited');
    fixture.detectChanges();

    component.setCapacity('very-limited');
    fixture.detectChanges();

    const preview = component.composedInstructionsText() as string;
    expect(preview).toContain(veryLimitedModifier);
    expect(preview).not.toContain(`${limitedModifier}\n\n${veryLimitedModifier}`);
    expect(preview.includes(limitedModifier)).toBeFalse();
  });

  it('there is no second copy control in any capacity state', () => {
    const assertSingleCopyButton = () => {
      expect(fixture.nativeElement.querySelectorAll('[data-testid="copy-btn"]').length).toBe(1);
      expect(fixture.nativeElement.querySelector('[data-testid="capacity-copy-btn"]')).toBeNull();
    };

    assertSingleCopyButton();
    component.setCapacity('usual');
    fixture.detectChanges();
    assertSingleCopyButton();
    component.setCapacity('limited');
    fixture.detectChanges();
    assertSingleCopyButton();
    component.setCapacity('very-limited');
    fixture.detectChanges();
    assertSingleCopyButton();
  });

  it('shows copy failure guidance for the single combined preview', async () => {
    const writeText = jasmine.createSpy('writeText').and.rejectWith(new Error('blocked'));
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    await component.copyInstructions();
    fixture.detectChanges();

    expect(component.copyStatus()).toBe('Copy failed');
    const fallback = fixture.nativeElement.querySelector('[data-testid="copy-fallback"]') as HTMLElement;
    expect(fallback).toBeTruthy();
    expect(fallback.textContent).toContain('combined Instructions to copy block');
  });

  it('reload reproduces same composed preview for persisted capacity', async () => {
    await createComponentWithCapacity('limited');
    const firstPreview = component.composedInstructionsText();

    fixture = TestBed.createComponent(ResultComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.selectedCapacity()).toBe('limited');
    expect(component.composedInstructionsText()).toBe(firstPreview);
  });

  it('reload with very-limited keeps permanent prompt unchanged in composed preview', async () => {
    await createComponentWithCapacity('very-limited');

    const permanentPrompt = component.promptText();
    const veryLimitedModifier = generateCapacityModifier('very-limited', content);
    const expectedComposed = composeInstructionsForCopy(permanentPrompt as string, veryLimitedModifier);

    expect(component.composedInstructionsText()).toBe(expectedComposed);
    expect(component.promptText()).toBe(generatePermanentPrompt(profile, content).prompt);
  });

  it('returns to permanent-only preview when capacity changes from limited to usual', () => {
    const expectedPrompt = generatePermanentPrompt(profile, content).prompt;

    component.setCapacity('limited');
    fixture.detectChanges();
    expect(component.composedInstructionsText()).not.toBe(expectedPrompt);

    component.setCapacity('usual');
    fixture.detectChanges();
    expect(component.composedInstructionsText()).toBe(expectedPrompt);
  });

  it('startOver clears MVP session, including capacity, and routes home', () => {
    sessionStorage.setItem('unrelated-key', 'keep-me');
    component.setCapacity('limited');
    fixture.detectChanges();

    component.startOver();

    expect(sessionStore.session()).toBeNull();
    expect(sessionStore.capacity()).toBeNull();
    expect(sessionStorage.getItem('unrelated-key')).toBe('keep-me');
    expect(router.navigate).toHaveBeenCalledWith(['/']);
  });

  it('shows no feedback form links', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).not.toContain('forms.gle');
    expect(text).not.toContain('Share feedback');
  });

  it('includes visible explanation about permanent and temporary behavior', () => {
    const explainer = fixture.nativeElement.querySelector('[data-testid="workflow-explainer"]') as HTMLElement;
    const text = explainer.textContent ?? '';

    expect(text).toContain('five answers create reusable permanent instructions');
    expect(text).toContain('temporary for this AI conversation only');
    expect(text).toContain('does not change your saved permanent preferences');
  });
});
