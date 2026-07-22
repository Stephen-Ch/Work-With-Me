import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { generateCapacityModifier, generatePermanentPrompt } from '../core/mvp/mvp-generator';
import { MvpContentService } from '../core/mvp/mvp-content.service';
import { MvpSessionStore } from '../core/mvp/mvp-session.store';
import { isMvpResultEligible } from '../core/mvp/mvp-result.guard';
import { CapacityId } from '../core/mvp/mvp.types';

const PERMANENT_COPY_IDLE = 'Copy permanent prompt';
const PERMANENT_COPY_SUCCESS = 'Copied';
const PERMANENT_COPY_FAILURE = 'Copy failed';

const TEMPORARY_COPY_IDLE = 'Copy temporary modifier';
const TEMPORARY_COPY_SUCCESS = 'Copied';
const TEMPORARY_COPY_FAILURE = 'Copy failed';

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

        <section class="border border-gray-200 rounded-xl p-4 space-y-4" data-testid="capacity-section">
          <div class="space-y-1">
            <h3 class="text-lg font-semibold text-gray-900">Temporary session modifier (optional)</h3>
            <p class="text-sm text-gray-600">
              This does not change your permanent Work With Me instructions. Use it only for this AI conversation.
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
            } @else if (capacityModifierText(); as modifier) {
              <div class="space-y-3" data-testid="capacity-modifier-section">
                <div class="border border-gray-200 rounded-lg overflow-hidden">
                  <div class="bg-gray-100 px-4 py-2 text-xs text-gray-500 font-semibold border-b border-gray-200">
                    Temporary capacity modifier
                  </div>
                  <pre
                    data-testid="capacity-modifier-preview"
                    class="p-4 text-sm text-gray-800 whitespace-pre-wrap font-mono overflow-x-auto leading-relaxed">{{ modifier }}</pre>
                </div>

                <button
                  data-testid="capacity-copy-btn"
                  (click)="copyCapacityModifier()"
                  class="w-full sm:w-auto py-2.5 px-5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors">
                  {{ temporaryCopyLabel() }}
                </button>

                <p class="text-sm text-gray-700" data-testid="capacity-copy-status" aria-live="polite">
                  {{ temporaryCopyStatus() }}
                </p>

                @if (temporaryCopyStatus() === temporaryCopyFailureText) {
                  <p class="text-sm text-amber-700" data-testid="capacity-copy-fallback">
                    Copy failed. Select the temporary modifier text manually and copy with your keyboard.
                  </p>
                }
              </div>
            }
          }
        </section>
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

  readonly copyFailureText = PERMANENT_COPY_FAILURE;
  readonly copyLabel = signal(PERMANENT_COPY_IDLE);
  readonly copyStatus = signal('');

  readonly temporaryCopyFailureText = TEMPORARY_COPY_FAILURE;
  readonly temporaryCopyLabel = signal(TEMPORARY_COPY_IDLE);
  readonly temporaryCopyStatus = signal('');

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
      this.copyLabel.set(PERMANENT_COPY_SUCCESS);
      this.copyStatus.set('Permanent prompt copied to clipboard.');
    } catch {
      this.copyLabel.set(PERMANENT_COPY_FAILURE);
      this.copyStatus.set(PERMANENT_COPY_FAILURE);
    }
  }

  async copyCapacityModifier(): Promise<void> {
    const modifier = this.capacityModifierText();
    if (!modifier) {
      return;
    }

    try {
      await navigator.clipboard.writeText(modifier);
      this.temporaryCopyLabel.set(TEMPORARY_COPY_SUCCESS);
      this.temporaryCopyStatus.set('Temporary modifier copied to clipboard.');
    } catch {
      this.temporaryCopyLabel.set(TEMPORARY_COPY_FAILURE);
      this.temporaryCopyStatus.set(TEMPORARY_COPY_FAILURE);
    }
  }

  setCapacity(capacityId: CapacityId): void {
    this.sessionStore.setCapacity(capacityId);

    // Clear stale temporary copy state when the visible modifier changes.
    this.temporaryCopyLabel.set(TEMPORARY_COPY_IDLE);
    this.temporaryCopyStatus.set('');
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
