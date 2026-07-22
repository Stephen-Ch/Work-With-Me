import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { ContentService } from '../core/content/content.service';
import { SessionStore } from '../core/session/session.store';
import { V2Content, V2ContentState } from '../core/content/types';
import { SetupComponent } from './setup.component';
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

describe('SetupComponent', () => {
  let component: SetupComponent;
  let fixture: ComponentFixture<SetupComponent>;
  let sessionStore: SessionStore;

  beforeEach(async () => {
    sessionStorage.clear();

    await TestBed.configureTestingModule({
      imports: [SetupComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: ContentService, useClass: ContentServiceStub }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(SetupComponent);
    component = fixture.componentInstance;
    sessionStore = TestBed.inject(SessionStore);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('loads exactly six questions from six controls', () => {
    expect(component.flatQuestions().length).toBe(6);
    expect(new Set(component.flatQuestions().map(question => question.controlName)).size).toBe(6);
  });

  it('shows the counter from 1 of 6 through 6 of 6', () => {
    for (let index = 1; index <= 6; index++) {
      expect(fixture.nativeElement.textContent).toContain(`${index} of 6`);

      if (index < 6) {
        const questionId = component.currentQuestion()!.questionId;
        component.selectAnswer(questionId, 'B');
        fixture.detectChanges();
        component.goForward();
        fixture.detectChanges();
      }
    }
  });

  it('shows valid A, B, and C options for every question', () => {
    for (let index = 0; index < 6; index++) {
      const optionA = fixture.nativeElement.querySelector('[data-testid="option-A"]') as HTMLButtonElement;
      const optionB = fixture.nativeElement.querySelector('[data-testid="option-B"]') as HTMLButtonElement;
      const optionC = fixture.nativeElement.querySelector('[data-testid="option-C"]') as HTMLButtonElement;

      expect(optionA.textContent?.trim().length).toBeGreaterThan(1);
      expect(optionB.textContent?.trim().length).toBeGreaterThan(1);
      expect(optionC.textContent?.trim().length).toBeGreaterThan(1);

      if (index < 5) {
        const questionId = component.currentQuestion()!.questionId;
        component.selectAnswer(questionId, 'A');
        fixture.detectChanges();
        component.goForward();
        fixture.detectChanges();
      }
    }
  });

  it('preserves answers when moving back and forward', () => {
    component.selectAnswer('load-q1', 'A');
    fixture.detectChanges();
    component.goForward();
    fixture.detectChanges();

    component.selectAnswer('scope-q1', 'C');
    fixture.detectChanges();
    component.goBack();
    fixture.detectChanges();

    const firstQuestionSelected = fixture.nativeElement.querySelector('[data-testid="option-A"]') as HTMLButtonElement;
    expect(sessionStore.answers()['load-q1']).toBe('A');
    expect(firstQuestionSelected.className).toContain('bg-blue-600');

    component.goForward();
    fixture.detectChanges();

    const secondQuestionSelected = fixture.nativeElement.querySelector('[data-testid="option-C"]') as HTMLButtonElement;
    expect(sessionStore.answers()['scope-q1']).toBe('C');
    expect(secondQuestionSelected.className).toContain('bg-blue-600');
  });

  it('resumes on the first unanswered question after leaving the questionnaire', async () => {
    sessionStore.recordAnswer('load-q1', 'A');
    sessionStore.recordAnswer('scope-q1', 'B');

    fixture = TestBed.createComponent(SetupComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.currentQuestion()?.questionId).toBe('challenge-q1');
    expect(fixture.nativeElement.textContent).toContain('3 of 6');
  });
});