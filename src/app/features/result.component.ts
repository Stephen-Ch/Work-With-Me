import { Component, inject, computed, signal, ChangeDetectionStrategy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ContentService } from '../core/content/content.service';
import { SessionStore } from '../core/session/session.store';
import { scoreSetup } from '../core/engine/scoring.engine';
import { generateDocument } from '../core/engine/document.generator';

function track(event: string): void {
  if (typeof window !== 'undefined' && (window as any).plausible) {
    (window as any).plausible(event);
  }
}

@Component({
  selector: 'app-result',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
    <div class="max-w-2xl mx-auto p-6 space-y-6" data-testid="view-result">

      <header class="text-center space-y-2">
          <h2 class="text-2xl font-bold text-gray-900">Your instruction block is ready</h2>
        <p class="text-gray-600 text-sm">
          Copy this short block, start a new AI conversation, paste it first, and put your real request underneath it.
        </p>
      </header>

      <!-- Primary actions -->
      <div class="flex flex-col sm:flex-row gap-3">
        <button
          data-testid="copy-btn"
          (click)="copyToClipboard()"
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

      <ol
        data-testid="usage-instructions"
        class="bg-blue-50 border border-blue-100 rounded-lg px-5 py-4 text-sm text-blue-950 space-y-2 list-decimal list-inside">
        <li>Copy the instruction block.</li>
        <li>Open a new AI conversation.</li>
        <li>Paste the block first.</li>
        <li>Write your actual request below it and continue normally.</li>
      </ol>

      <!-- Instruction block preview -->
      <div class="border border-gray-200 rounded-lg overflow-hidden">
        <div class="bg-gray-100 px-4 py-2 text-xs text-gray-500 font-semibold border-b border-gray-200">
          Instruction block
        </div>
        <pre
          data-testid="document-preview"
          class="p-4 text-sm text-gray-800 whitespace-pre-wrap font-mono overflow-x-auto leading-relaxed">{{ document() }}</pre>
      </div>

      <!-- Feedback link -->
      <div class="bg-blue-50 border border-blue-100 rounded-lg px-4 py-4 text-sm text-center space-y-1">
        <p class="font-semibold text-blue-900">Used your instructions? Tell us what happened.</p>
        <p class="text-blue-700 text-xs">Anonymous · Takes 3 minutes · Helps us improve</p>
        <a
          href="https://forms.gle/LEPLwyKgqQpZ6ga17"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-block mt-2 px-5 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors text-sm">
          Share feedback
        </a>
      </div>

    </div>
  `
})
export class ResultComponent implements OnInit {
  private sessionStore = inject(SessionStore);
  private contentService = inject(ContentService);
  private router = inject(Router);

  copyLabel = signal('Copy instructions');

  document = computed(() => {
    const content = this.contentService.state().content;
    const answers = this.sessionStore.answers();

    if (!content) return 'Loading…';

    const result = scoreSetup(answers, content.controls);
    return generateDocument(result, content);
  });

  constructor() {
    // Fire once when the result screen loads with a valid document
    track('assessment_completed');
  }

  ngOnInit(): void {
    if (!this.contentService.state().content) {
      void this.contentService.loadContent();
    }
  }

  async copyToClipboard(): Promise<void> {
    const text = this.document();
    try {
      await navigator.clipboard.writeText(text);
      track('document_copied');
      this.copyLabel.set('Copied!');
      setTimeout(() => this.copyLabel.set('Copy instructions'), 2500);
    } catch {
      this.copyLabel.set('Copy failed — select text manually');
    }
  }

  startOver(): void {
    this.sessionStore.startFresh();
    this.router.navigate(['/']);
  }
}
