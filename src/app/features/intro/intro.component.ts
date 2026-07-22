import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { MvpSessionStore } from '../../core/mvp/mvp-session.store';

@Component({
  selector: 'app-intro',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div data-testid="view-intro">

      <section class="bg-white border-b border-gray-100 pt-10 pb-14 px-6">
        <div class="max-w-4xl mx-auto space-y-5 text-center">
          <h1 class="text-4xl font-extrabold text-gray-900 leading-tight tracking-tight">Work With Me</h1>
          <p class="text-lg text-gray-700 leading-relaxed">
            Answer five short questions and get reusable AI instructions that work across assistants.
          </p>
          <p class="text-sm text-gray-500">
            No account required. Active progress stays in this browser session.
          </p>

          @if (!hasProgress()) {
            <button
              data-testid="start-btn"
              (click)="start()"
              class="w-full sm:w-auto inline-block bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-xl text-base transition-colors shadow-sm">
              Start Work With Me
            </button>
          } @else {
            <div class="flex flex-col items-center gap-3">
              <button
                data-testid="resume-btn"
                (click)="resume()"
                class="w-full sm:w-auto inline-block bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-xl text-base transition-colors shadow-sm">
                Resume
              </button>
              <button
                data-testid="start-over-btn"
                (click)="startOver()"
                class="text-sm text-gray-600 hover:text-gray-800 underline">
                Start over
              </button>
            </div>
          }
        </div>
      </section>

      <section class="py-10 px-6 bg-gray-50 border-t border-gray-100">
        <div class="max-w-3xl mx-auto space-y-4">
          <h2 class="text-2xl font-bold text-gray-900">What your profile covers</h2>
          <ul class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-gray-700">
            <li class="bg-white border border-gray-200 rounded-lg px-4 py-3">Starting unclear or complex work</li>
            <li class="bg-white border border-gray-200 rounded-lg px-4 py-3">Managing information load</li>
            <li class="bg-white border border-gray-200 rounded-lg px-4 py-3">Making decisions</li>
            <li class="bg-white border border-gray-200 rounded-lg px-4 py-3">Handling side topics</li>
            <li class="bg-white border border-gray-200 rounded-lg px-4 py-3 sm:col-span-2">Returning after an interruption</li>
          </ul>
        </div>
      </section>

      <section class="py-10 px-6 bg-white border-t border-gray-100">
        <div class="max-w-3xl mx-auto text-center space-y-3">
          <p class="text-sm font-semibold text-gray-500 uppercase tracking-wide">Works with</p>
          <div class="flex flex-wrap justify-center gap-3 text-sm text-gray-700 font-medium">
            <span class="px-3 py-1.5 border border-gray-200 rounded-lg">Claude</span>
            <span class="px-3 py-1.5 border border-gray-200 rounded-lg">ChatGPT</span>
            <span class="px-3 py-1.5 border border-gray-200 rounded-lg">Gemini</span>
            <span class="px-3 py-1.5 border border-gray-200 rounded-lg">Copilot</span>
            <span class="px-3 py-1.5 border border-gray-200 rounded-lg">Other assistants</span>
          </div>
        </div>
      </section>

    </div>
  `
})
export class IntroComponent {
  private readonly sessionStore = inject(MvpSessionStore);
  private readonly router = inject(Router);

  readonly hasProgress = this.sessionStore.hasPermanentProgress;
  readonly hasCompleteProfile = this.sessionStore.hasCompletePermanentProfile;

  start(): void {
    this.sessionStore.startFresh();
    void this.router.navigate(['/setup']);
  }

  resume(): void {
    if (this.hasCompleteProfile()) {
      void this.router.navigate(['/result']);
      return;
    }

    void this.router.navigate(['/setup']);
  }

  startOver(): void {
    this.sessionStore.clear();
  }
}
