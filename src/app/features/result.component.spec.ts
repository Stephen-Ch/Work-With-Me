/**
 * MVP ResultComponent tests.
 * @proves deterministic permanent prompt behavior and optional temporary capacity modifier flow.
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { ResultComponent } from './result.component';
import { MvpContentService, MvpContentState } from '../core/mvp/mvp-content.service';
import { MvpSessionStore, MVP_SESSION_NOW, MVP_SESSION_STORAGE_KEY } from '../core/mvp/mvp-session.store';
import { validateMvpContent } from '../core/mvp/mvp-content.repository';
import rawMvpContent from '../../assets/content/mvp-content.json';
import { generateCapacityModifier, generatePermanentPrompt } from '../core/mvp/mvp-generator';
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
    expect(btn.textContent.trim()).toBe('Copy permanent prompt');
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

  it('with no capacity selected shows no modifier preview and no temporary copy action', () => {
    expect(component.selectedCapacity()).toBeNull();
    expect(component.capacityModifierText()).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="capacity-modifier-preview"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="capacity-copy-btn"]')).toBeNull();
  });

  it('usual bandwidth persists but shows no modifier preview and no temporary copy action', async () => {
    await createComponentWithCapacity('usual');

    expect(component.selectedCapacity()).toBe('usual');
    expect(component.capacityModifierText()).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="capacity-usual-note"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[data-testid="capacity-modifier-preview"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="capacity-copy-btn"]')).toBeNull();
  });

  it('limited bandwidth shows exact authored modifier', () => {
    component.setCapacity('limited');
    fixture.detectChanges();

    expect(component.capacityModifierText()).toBe(generateCapacityModifier('limited', content));
    const preview = fixture.nativeElement.querySelector('[data-testid="capacity-modifier-preview"]') as HTMLElement;
    expect(preview.textContent?.trim()).toBe(
      'For this session, keep responses compact and practical. Give the smallest useful answer first, trim optional detail, and expand only if I ask.'
    );
  });

  it('very limited bandwidth shows exact authored modifier', () => {
    component.setCapacity('very-limited');
    fixture.detectChanges();

    expect(component.capacityModifierText()).toBe(generateCapacityModifier('very-limited', content));
    const preview = fixture.nativeElement.querySelector('[data-testid="capacity-modifier-preview"]') as HTMLElement;
    expect(preview.textContent?.trim()).toBe(
      'For this session, use essentials-only responses. Give one actionable step at a time, avoid extra options by default, and add depth only if I request it.'
    );
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

  it('renders separate permanent and temporary copy controls and statuses', () => {
    component.setCapacity('limited');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="copy-btn"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[data-testid="copy-status"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[data-testid="capacity-copy-btn"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[data-testid="capacity-copy-status"]')).toBeTruthy();
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

  it('copies the exact displayed temporary modifier and reports success', async () => {
    component.setCapacity('limited');
    fixture.detectChanges();

    const writeText = jasmine.createSpy('writeText').and.resolveTo();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    const preview = fixture.nativeElement.querySelector('[data-testid="capacity-modifier-preview"]') as HTMLElement;

    await component.copyCapacityModifier();
    fixture.detectChanges();

    expect(writeText).toHaveBeenCalledOnceWith(preview.textContent as string);
    expect(component.temporaryCopyStatus()).toBe('Temporary modifier copied to clipboard.');
  });

  it('shows temporary modifier copy failure guidance without affecting permanent copy status', async () => {
    component.setCapacity('very-limited');
    fixture.detectChanges();

    const writeText = jasmine.createSpy('writeText').and.rejectWith(new Error('blocked'));
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    await component.copyCapacityModifier();
    fixture.detectChanges();

    expect(component.temporaryCopyStatus()).toBe('Copy failed');
    expect(fixture.nativeElement.querySelector('[data-testid="capacity-copy-fallback"]')).toBeTruthy();
    expect(component.copyStatus()).toBe('');
  });

  it('does not show temporary copy control when no capacity is selected', () => {
    expect(component.selectedCapacity()).toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="capacity-copy-btn"]')).toBeNull();
  });

  it('does not show temporary copy control for usual bandwidth', async () => {
    await createComponentWithCapacity('usual');

    expect(fixture.nativeElement.querySelector('[data-testid="capacity-copy-btn"]')).toBeNull();
  });

  it('startOver clears MVP session and routes home', () => {
    sessionStorage.setItem('unrelated-key', 'keep-me');
    component.setCapacity('limited');
    fixture.detectChanges();

    component.startOver();

    expect(sessionStore.session()).toBeNull();
    expect(sessionStorage.getItem('unrelated-key')).toBe('keep-me');
    expect(router.navigate).toHaveBeenCalledWith(['/']);
  });

  it('persists selected capacity through recreated component/store hydration', async () => {
    component.setCapacity('very-limited');
    fixture.detectChanges();

    await createComponentWithCapacity('very-limited');

    expect(component.selectedCapacity()).toBe('very-limited');
    expect(component.capacityModifierText()).toBe(
      'For this session, use essentials-only responses. Give one actionable step at a time, avoid extra options by default, and add depth only if I request it.'
    );
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

  it('does not render feedback form', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).not.toContain('forms.gle');
    expect(text).not.toContain('Share feedback');
  });
});
