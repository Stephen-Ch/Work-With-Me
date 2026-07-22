/**
 * V2 ResultComponent tests
 * @proves ResultComponent renders the instruction block, copies the exact visible text, shows usage guidance, and clears session state on start over
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { ResultComponent } from './result.component';
import { ContentService } from '../core/content/content.service';
import { SessionStore } from '../core/session/session.store';
import { V2Content, V2ContentState } from '../core/content/types';
import contentFixture from '../../assets/content/working-with-me.json';

class ContentServiceStub {
  private readonly _state = signal<V2ContentState>({
    content: contentFixture as V2Content,
    loading: false,
    error: null
  });

  readonly state = this._state.asReadonly();
  readonly loadContent = jasmine.createSpy('loadContent').and.resolveTo();
}

describe('ResultComponent (V2)', () => {
  let component: ResultComponent;
  let fixture: ComponentFixture<ResultComponent>;
  let router: Router;
  let sessionStore: SessionStore;

  beforeEach(async () => {
    sessionStorage.clear();

    await TestBed.configureTestingModule({
      imports: [ResultComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: ContentService, useClass: ContentServiceStub }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ResultComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    sessionStore = TestBed.inject(SessionStore);
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

  it('should render the instruction preview and primary copy action', () => {
    const preview = fixture.nativeElement.querySelector('[data-testid="document-preview"]');
    const btn = fixture.nativeElement.querySelector('[data-testid="copy-btn"]');

    expect(preview).toBeTruthy();
    expect(btn).toBeTruthy();
    expect(btn.textContent.trim()).toBe('Copy instructions');
    expect(fixture.nativeElement.querySelector('[data-testid="download-btn"]')).toBeNull();
  });

  it('should copy the exact displayed instruction block', async () => {
    const writeText = jasmine.createSpy('writeText').and.resolveTo();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText }
    });

    const preview = fixture.nativeElement.querySelector('[data-testid="document-preview"]') as HTMLElement;

    await component.copyToClipboard();

    expect(writeText).toHaveBeenCalledOnceWith(preview.textContent as string);
  });

  it('should show the four-step usage instructions', () => {
    const instructions = fixture.nativeElement.querySelector('[data-testid="usage-instructions"]') as HTMLElement;

    expect(instructions.textContent).toContain('Copy the instruction block');
    expect(instructions.textContent).toContain('Open a new AI conversation');
    expect(instructions.textContent).toContain('Paste the block first');
    expect(instructions.textContent).toContain('Write your actual request below it');
  });

  it('startOver should clear answers and navigate home', () => {
    sessionStore.recordAnswer('load-q1', 'A');

    component.startOver();

    expect(sessionStore.hasSavedProgress()).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/']);
  });
});
