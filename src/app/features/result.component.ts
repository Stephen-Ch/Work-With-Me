import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { generatePermanentPrompt } from '../core/mvp/mvp-generator';
import { MvpContentService } from '../core/mvp/mvp-content.service';
import { MvpSessionStore } from '../core/mvp/mvp-session.store';
import { isMvpResultEligible } from '../core/mvp/mvp-result.guard';

const COPY_IDLE = 'Copy permanent prompt';
const COPY_SUCCESS = 'Copied';
const COPY_FAILURE = 'Copy failed';

@Component({
  selector: 'app-result',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
    <div class="max-w-2xl mx-auto p-6 space-y-6" data-testid="view-result">

      @if (loading()) {
        <p class="text-gray-500 text-center py-12" data-testid="loading-state">Loading your prompt…</p>
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
      } @else if (promptText(); as prompt) {
        <header class="text-center space-y-2">
          <h2 class="text-2xl font-bold text-gray-900">Your permanent instructions are ready</h2>
          <p class="text-gray-600 text-sm">Copy this exactly, then paste it at the top of a new AI conversation.</p>
        </header>

        <div class="flex flex-col sm:flex-row gap-3">
          <button
            data-testid="copy-btn"
            (click)="copyPermanentPrompt()"
            class="flex-1 py-3 px-5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors">
            {{ copyLabel() }}
          </button>
          <button
            data-testid="start-over-btn"
            (click)="startOver()"
            class="flex-1 py-3 px-5 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors">
            Start Over
          </button>
        </div>

        <p class="text-sm text-gray-700" data-testid="copy-status" aria-live="polite">{{ copyStatus() }}</p>

        <div class="border border-gray-200 rounded-lg overflow-hidden">
          <div class="bg-gray-100 px-4 py-2 text-xs text-gray-500 font-semibold border-b border-gray-200">
            Permanent prompt
          </div>
          <pre
            data-testid="document-preview"
            class="p-4 text-sm text-gray-800 whitespace-pre-wrap font-mono overflow-x-auto leading-relaxed">{{ prompt }}</pre>
        </div>

        @if (copyStatus() === copyFailureText) {
          <p class="text-sm text-amber-700" data-testid="copy-fallback">
            Copy failed. Select the prompt text manually and copy with your keyboard.
          </p>
        }
      }
    </div>
  `
})
export class ResultComponent implements OnInit {
  private readonly sessionStore = inject(MvpSessionStore);
  private readonly contentService = inject(MvpContentService);
  private readonly router = inject(Router);

  readonly loading = this.contentService.loading;
  readonly error = this.contentService.error;
  readonly content = this.contentService.content;
  readonly selections = this.sessionStore.permanentSelections;

  readonly copyFailureText = COPY_FAILURE;
  readonly copyLabel = signal(COPY_IDLE);
  readonly copyStatus = signal('');

  readonly promptText = computed(() => {
    const content = this.content();
    if (!content || !isMvpResultEligible(this.selections())) {
      return null;
    }

    try {
      return generatePermanentPrompt(this.selections(), content).prompt;
    } catch {
      return null;
    }
  });

  ngOnInit(): void {
    void this.initialize();
  }

  async copyPermanentPrompt(): Promise<void> {
    const text = this.promptText();
    if (!text) {
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      this.copyLabel.set(COPY_SUCCESS);
      this.copyStatus.set('Permanent prompt copied to clipboard.');
    } catch {
      this.copyLabel.set(COPY_FAILURE);
      this.copyStatus.set(COPY_FAILURE);
    }
  }

  startOver(): void {
    this.sessionStore.clear();
    void this.router.navigate(['/']);
  }

  retry(): void {
    void this.initialize();
  }

  private async initialize(): Promise<void> {
    await this.contentService.loadContent();

    if (!isMvpResultEligible(this.selections())) {
      void this.router.navigate(['/setup']);
    }
  }
}
