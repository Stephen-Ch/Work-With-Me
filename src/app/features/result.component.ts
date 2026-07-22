import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  composeInstructionsForCopy,
  generateCapacityModifier,
  generatePermanentPrompt,
} from '../core/mvp/mvp-generator';
import { MvpContentService } from '../core/mvp/mvp-content.service';
import { MvpSessionStore } from '../core/mvp/mvp-session.store';
import { isMvpResultEligible } from '../core/mvp/mvp-result.guard';
import { CapacityId } from '../core/mvp/mvp.types';

const COPY_BUTTON_LABEL = 'Copy instructions';
const PERMANENT_COPY_FAILURE = 'Copy failed';

const CAPACITY_QUESTION = 'How much bandwidth do you have right now?';

const CAPACITY_ORDER: readonly CapacityId[] = ['usual', 'limited', 'very-limited'];

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
          <p class="text-gray-600 text-sm" data-testid="workflow-explainer">
            Your five answers create reusable permanent instructions. The final paragraph, when shown, is temporary for this AI conversation only. Changing bandwidth does not change your saved permanent preferences.
          </p>
        </header>

        <section class="border border-gray-200 rounded-xl p-4 space-y-4" data-testid="capacity-section">
          <div class="space-y-1">
            <h3 class="text-lg font-semibold text-gray-900">Temporary session modifier (optional)</h3>
            <p class="text-sm text-gray-600">
              Select your current bandwidth to optionally append a temporary final paragraph to the copy block below.
            </p>
          </div>

          @if (capacityChoices(); as choices) {
            <fieldset data-testid="capacity-fieldset" class="space-y-3">
              <legend class="text-sm font-semibold text-gray-900">{{ capacityQuestion }}</legend>

              @for (choice of choices; track choice.id) {
                <label class="flex items-start gap-3 rounded-lg border border-gray-200 px-3 py-3 hover:border-blue-400 cursor-pointer">
                  <input
                    type="radio"
                    name="capacity"
                    [value]="choice.id"
                    [checked]="selectedCapacity() === choice.id"
                    (change)="setCapacity(choice.id)"
                    [attr.data-testid]="'capacity-option-' + choice.id"
                    class="mt-0.5 h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500" />
                  <span class="text-sm text-gray-800">{{ choice.label }}</span>
                </label>
              }
            </fieldset>

            @if (selectedCapacity() === 'usual') {
              <p class="text-sm text-gray-700" data-testid="capacity-usual-note">
                Usual bandwidth selected. No temporary modifier is needed.
              </p>
            }
          }
        </section>

        <div class="flex flex-col sm:flex-row gap-3">
          <button
            data-testid="copy-btn"
            (click)="copyInstructions()"
            class="flex-1 py-3 px-5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors">
            {{ copyButtonLabel }}
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
            Instructions to copy
          </div>
          <pre
            data-testid="document-preview"
            class="p-4 text-sm text-gray-800 whitespace-pre-wrap font-mono overflow-x-auto leading-relaxed">{{ composedInstructionsText() }}</pre>
        </div>

        @if (copyStatus() === copyFailureText) {
          <p class="text-sm text-amber-700" data-testid="copy-fallback">
            Copy failed. Select the combined Instructions to copy block manually and copy with your keyboard.
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
  readonly selectedCapacity = this.sessionStore.capacity;

  readonly copyButtonLabel = COPY_BUTTON_LABEL;
  readonly copyFailureText = PERMANENT_COPY_FAILURE;
  readonly copyStatus = signal('');

  readonly capacityQuestion = CAPACITY_QUESTION;

  readonly capacityChoices = computed(() => {
    const content = this.content();
    if (!content) {
      return null;
    }

    return CAPACITY_ORDER.map((capacityId) => ({
      id: content.capacities[capacityId].id,
      label: content.capacities[capacityId].label,
    }));
  });

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

  readonly capacityModifierText = computed(() => {
    const content = this.content();
    const capacityId = this.selectedCapacity();
    if (!content || capacityId === null) {
      return null;
    }

    try {
      return generateCapacityModifier(capacityId, content);
    } catch {
      return null;
    }
  });

  readonly composedInstructionsText = computed(() => {
    const prompt = this.promptText();
    if (!prompt) {
      return null;
    }

    return composeInstructionsForCopy(prompt, this.capacityModifierText());
  });

  ngOnInit(): void {
    void this.initialize();
  }

  async copyInstructions(): Promise<void> {
    const text = this.composedInstructionsText();
    if (!text) {
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      this.copyStatus.set('Instructions copied to clipboard.');
    } catch {
      this.copyStatus.set(PERMANENT_COPY_FAILURE);
    }
  }

  setCapacity(capacityId: CapacityId): void {
    this.sessionStore.setCapacity(capacityId);
    this.copyStatus.set('');
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
