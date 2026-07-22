import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MvpContentService } from '../core/mvp/mvp-content.service';
import { MvpSessionStore } from '../core/mvp/mvp-session.store';
import { isMvpResultEligible } from '../core/mvp/mvp-result.guard';
import { OptionCode, PermanentQuestionId, ValidatedMvpContent } from '../core/mvp/mvp.types';

interface MvpQuestionView {
  readonly id: PermanentQuestionId;
  readonly title: string;
  readonly prompt: string;
  readonly options: ReadonlyArray<{
    readonly code: OptionCode;
    readonly answerText: string;
  }>;
}

@Component({
  selector: 'app-setup',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
    <div class="max-w-2xl mx-auto p-6 flex flex-col gap-6" data-testid="view-setup">

      @if (loading()) {
        <p class="text-gray-500 text-center py-12" data-testid="loading-state">Loading questions…</p>
      } @else if (error()) {
        <div class="text-center py-12 space-y-3" data-testid="error-state" role="alert">
          <p class="text-red-600">{{ error() }}</p>
          <button
            data-testid="retry-btn"
            (click)="retry()"
            class="px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            Retry
          </button>
        </div>
      } @else if (currentQuestion(); as q) {

        <div class="space-y-1">
          <div class="flex justify-between text-xs text-gray-500" data-testid="progress-counter">
            <span class="font-medium text-gray-700">Question {{ currentIndex() + 1 }} of {{ totalQuestions() }}</span>
            <span>{{ progressPercent() }}%</span>
          </div>
          <div class="w-full bg-gray-200 rounded-full h-1.5">
            <div
              class="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
              [style.width.%]="progressPercent()">
            </div>
          </div>
        </div>

        <div class="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-6">
          <fieldset class="space-y-3" data-testid="question-fieldset">
            <legend class="text-lg text-gray-900 leading-relaxed font-semibold" data-testid="question-statement">
              {{ q.prompt }}
            </legend>

            @for (option of q.options; track option.code) {
              <label class="flex items-start gap-3 rounded-lg border border-gray-200 px-3 py-3 hover:border-blue-400 cursor-pointer">
                <input
                  type="radio"
                  [name]="q.id"
                  [value]="option.code"
                  [checked]="selectedOptionCode(q.id) === option.code"
                  (change)="recordSelection(q.id, option.code)"
                  [attr.data-testid]="'option-' + option.code"
                  class="mt-0.5 h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500" />
                <span class="text-sm text-gray-800 leading-snug">
                  <strong>{{ option.code }}</strong>
                  <span class="ml-2">{{ option.answerText }}</span>
                </span>
              </label>
            }
          </fieldset>
        </div>

        <div class="flex justify-between items-center">
          <button
            data-testid="back-btn"
            [disabled]="currentIndex() === 0"
            (click)="goBack()"
            class="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            ← Back
          </button>

          <button
            data-testid="next-btn"
            [disabled]="!canAdvance()"
            (click)="goForward()"
            class="px-6 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            {{ isLastQuestion() ? 'See My Prompt' : 'Next' }} →
          </button>
        </div>

      }
    </div>
  `
})
export class SetupComponent implements OnInit {
  private readonly contentService = inject(MvpContentService);
  private readonly sessionStore = inject(MvpSessionStore);
  private readonly router = inject(Router);

  readonly currentIndex = signal(0);

  readonly loading = this.contentService.loading;
  readonly error = this.contentService.error;
  readonly content = this.contentService.content;
  readonly selections = this.sessionStore.permanentSelections;

  readonly questions = computed(() => {
    const content = this.content();
    if (!content) {
      return [];
    }
    return content.questionOrder.map((questionId) => toQuestionView(content, questionId));
  });

  readonly totalQuestions = computed(() => this.questions().length);

  readonly currentQuestion = computed((): MvpQuestionView | null => {
    const questions = this.questions();
    const index = this.currentIndex();
    return questions[index] ?? null;
  });

  ngOnInit(): void {
    void this.initialize();
  }

  progressPercent(): number {
    const total = this.totalQuestions();
    if (total === 0) {
      return 0;
    }
    return Math.round(((this.currentIndex() + 1) / total) * 100);
  }

  selectedOptionCode(questionId: PermanentQuestionId): OptionCode | undefined {
    return this.selections()[questionId];
  }

  canAdvance(): boolean {
    const question = this.currentQuestion();
    if (!question) {
      return false;
    }
    return Boolean(this.selectedOptionCode(question.id));
  }

  isLastQuestion(): boolean {
    return this.currentIndex() === this.totalQuestions() - 1;
  }

  recordSelection(questionId: PermanentQuestionId, optionCode: OptionCode): void {
    this.sessionStore.recordPermanentAnswer(questionId, optionCode);
  }

  goForward(): void {
    if (!this.canAdvance()) {
      return;
    }

    if (this.isLastQuestion()) {
      if (isMvpResultEligible(this.selections())) {
        void this.router.navigate(['/result']);
      }
      return;
    }

    this.currentIndex.update((index) => index + 1);
  }

  goBack(): void {
    if (this.currentIndex() === 0) {
      return;
    }
    this.currentIndex.update((index) => index - 1);
  }

  retry(): void {
    void this.initialize();
  }

  private async initialize(): Promise<void> {
    await this.contentService.loadContent();

    const questions = this.questions();
    if (questions.length === 0) {
      return;
    }

    if (isMvpResultEligible(this.selections())) {
      void this.router.navigate(['/result']);
      return;
    }

    const firstUnanswered = questions.findIndex((question) => !this.selectedOptionCode(question.id));
    this.currentIndex.set(firstUnanswered === -1 ? questions.length - 1 : firstUnanswered);
  }
}

function toQuestionView(content: ValidatedMvpContent, questionId: PermanentQuestionId): MvpQuestionView {
  const question = content.questions[questionId];
  const optionCodes: readonly OptionCode[] = ['A', 'B', 'C'];

  return {
    id: question.id,
    title: question.title,
    prompt: question.prompt,
    options: optionCodes.map((code) => ({
      code,
      answerText: question.options[code].answerText,
    })),
  }
}
