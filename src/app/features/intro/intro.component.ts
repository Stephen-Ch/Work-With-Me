import { Component, inject, computed, signal, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { SessionStore } from '../../core/session/session.store';

function track(event: string): void {
  if (typeof window !== 'undefined' && (window as any).plausible) {
    (window as any).plausible(event);
  }
}

@Component({
  selector: 'app-intro',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div data-testid="view-intro">

      <!-- Hero -->
      <section class="bg-white border-b border-gray-100 pt-8 pb-16 md:py-16 px-6">
        <div class="max-w-5xl mx-auto flex flex-col md:flex-row items-center gap-12">

          <!-- Text + CTA -->
          <div class="order-2 md:order-2 flex-1 space-y-6 text-center md:text-left">
            <h1 class="text-5xl font-extrabold text-gray-900 leading-tight tracking-tight">
              Work With Me.
            </h1>
            <p class="text-xl text-gray-500 italic leading-snug !mt-2">
              An early-stage internal AI-productivity prototype.
            </p>
            <p class="text-lg text-gray-600 leading-relaxed">
              It reuses the Angular foundation built for the separate Train-or-Be-Trained project while the new product identity is reset.
            </p>
            <p class="text-lg text-gray-700 font-medium">
              The questionnaire and generated instruction model are not yet implemented in this separation pass.
            </p>

            <div class="space-y-4">

              @if (!hasProgress()) {
                <label class="inline-flex items-center gap-3 text-sm text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    data-testid="age-gate"
                    [checked]="ageConfirmed()"
                    (change)="ageConfirmed.set(!ageConfirmed())"
                    class="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500">
                  I confirm I am 13 or older
                </label>
              }

              @if (hasProgress()) {
                <div class="space-y-2">
                  <button
                    data-testid="resume-btn"
                    (click)="resume()"
                    class="w-full sm:w-auto inline-block bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-10 rounded-xl text-lg transition-colors shadow-sm">
                    Resume Where I Left Off
                  </button>
                  <div>
                    <button
                      data-testid="start-fresh-btn"
                      (click)="startFresh()"
                      class="text-sm text-gray-500 hover:text-gray-700 underline">
                      Start over instead
                    </button>
                  </div>
                </div>
              } @else {
                <div>
                  <button
                    data-testid="start-btn"
                    [disabled]="!ageConfirmed()"
                    (click)="start()"
                    class="w-full sm:w-auto inline-block bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold py-4 px-10 rounded-xl text-lg transition-colors shadow-sm">
                    Start Work With Me
                  </button>
                  <p class="text-sm text-gray-400 mt-2">Saved only in this browser while you work. Works with any AI.</p>
                </div>
              }
            </div>
          </div>

          <!-- Hero image -->
          <div class="order-1 md:order-1 flex-shrink-0 w-full md:w-80 lg:w-96">
            <img
              src="assets/images/hero-focused-professional.jpg"
              alt="Focused professional working at a desk"
              class="w-full h-72 md:h-80 object-cover rounded-2xl shadow-md">
          </div>

        </div>
      </section>

      <!-- Project status -->
      <section class="py-10 px-6 bg-amber-50 border-y border-amber-100">
        <div class="max-w-3xl mx-auto bg-white border border-amber-200 rounded-xl p-6 md:p-8 shadow-sm">
          <h2 class="text-lg font-bold text-gray-900 mb-3">Project status</h2>
          <div class="space-y-3 text-sm text-gray-700 leading-relaxed">
            <p>
              This repository is an early-stage separation of the reusable application foundation into Work With Me.
            </p>
            <p>
              The underlying Angular implementation is being preserved while product identity is reset.
            </p>
            <p>
              The questionnaire and generated instructions will be revisited later.
            </p>
          </div>
        </div>
      </section>

      <!-- The problem -->
      <section class="py-14 px-6 bg-gray-50">
        <div class="max-w-5xl mx-auto flex flex-col md:flex-row items-center gap-10">

          <!-- Problem image -->
          <div class="order-2 md:order-2 flex-shrink-0 w-full md:w-80 lg:w-96 rounded-2xl overflow-hidden shadow-sm">
            <img
              src="assets/images/flow.png"
              alt="Abstract workflow diagram"
              class="w-full h-64 md:h-80 object-cover min-[566px]:max-[767px]:object-top md:object-right rounded-2xl">
          </div>

          <!-- Problem text -->
          <div class="order-1 md:order-1 flex-1 space-y-5">
            <h2 class="text-2xl font-bold text-gray-900">Your AI does not know your work style.</h2>
            <p class="text-gray-700 leading-relaxed">
              Every conversation starts from zero. It does not know when you want brevity,
              when you want pushback, or when a missing detail is worth calling out.
            </p>
            <p class="text-gray-700 leading-relaxed">
              Work With Me is being set up to make that context easier to reuse.
            </p>
          </div>

        </div>
      </section>

      <!-- How it works -->
      <section class="py-14 px-6 bg-white border-t border-gray-100">
        <div class="max-w-2xl mx-auto space-y-8">
          <h2 class="text-2xl font-bold text-gray-900">How it works</h2>
          <div class="space-y-6">
            <div class="flex gap-5">
              <span class="flex-shrink-0 w-9 h-9 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center">1</span>
              <div>
                <p class="font-semibold text-gray-900">Answer a short set of questions about how you work</p>
                <p class="text-sm text-gray-600 mt-1">The first pass will focus on practical work barriers and assistant instructions.</p>
              </div>
            </div>
            <div class="flex gap-5">
              <span class="flex-shrink-0 w-9 h-9 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center">2</span>
              <div>
                <p class="font-semibold text-gray-900">Copy your instruction block</p>
                <p class="text-sm text-gray-600 mt-1">The generated text is meant to be pasted into a new AI conversation.</p>
              </div>
            </div>
            <div class="flex gap-5">
              <span class="flex-shrink-0 w-9 h-9 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center">3</span>
              <div>
                <p class="font-semibold text-gray-900">Paste it first, then write your request below it</p>
                <p class="text-sm text-gray-600 mt-1">Your next AI conversation starts with usable context instead of guesswork.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- What it covers -->
      <section class="py-14 px-6 bg-gray-50 border-t border-gray-100">
        <div class="max-w-2xl mx-auto space-y-6">
          <h2 class="text-2xl font-bold text-gray-900">What Work With Me covers</h2>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            @for (item of dimensions; track item.label) {
              <div class="bg-white border border-gray-200 rounded-lg p-4">
                <p class="font-semibold text-gray-900 text-sm">{{ item.label }}</p>
                <p class="text-xs text-gray-500 mt-1">{{ item.description }}</p>
              </div>
            }
          </div>
        </div>
      </section>

      <!-- Works with -->
      <section class="py-12 px-6 bg-white border-t border-gray-100">
        <div class="max-w-2xl mx-auto text-center space-y-4">
          <p class="text-sm font-semibold text-gray-500 uppercase tracking-wide">Works with</p>
          <div class="flex flex-wrap justify-center gap-4 text-sm text-gray-700 font-medium">
            <span class="px-4 py-2 border border-gray-200 rounded-lg">Claude</span>
            <span class="px-4 py-2 border border-gray-200 rounded-lg">ChatGPT</span>
            <span class="px-4 py-2 border border-gray-200 rounded-lg">Gemini</span>
            <span class="px-4 py-2 border border-gray-200 rounded-lg">Copilot</span>
            <span class="px-4 py-2 border border-gray-200 rounded-lg">Other LLMs</span>
          </div>
        </div>
      </section>

      <!-- Bottom CTA -->
      <section class="py-14 px-6 bg-blue-600">
        <div class="max-w-2xl mx-auto text-center space-y-5">
          <h2 class="text-2xl font-bold text-white">Ready to set up Work With Me?</h2>
          <p class="text-blue-100 text-sm">
            Nothing stored — the whole thing runs in your browser.
            No account. No email required.
          </p>
          @if (!hasProgress()) {
            <label class="flex w-full items-center justify-center gap-3 text-sm text-blue-100 cursor-pointer">
              <input
                type="checkbox"
                data-testid="age-gate-footer"
                [checked]="ageConfirmed()"
                (change)="ageConfirmed.set(!ageConfirmed())"
                class="w-4 h-4 rounded border-blue-200 text-blue-600 focus:ring-blue-300">
              I confirm I am 13 or older
            </label>
          }
          <button
            [disabled]="!ageConfirmed() && !hasProgress()"
            (click)="start()"
            class="block w-full sm:w-auto mx-auto bg-white text-blue-700 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed font-bold py-4 px-10 rounded-xl text-lg transition-colors shadow-sm">
            Start Work With Me
          </button>
          @if (!ageConfirmed() && !hasProgress()) {
            <p class="text-blue-200 text-xs">Confirm you are 13 or older to continue.</p>
          }
        </div>
      </section>

    </div>
  `
})
export class IntroComponent {
  private sessionStore = inject(SessionStore);
  private router = inject(Router);

  hasProgress = computed(() => this.sessionStore.hasSavedProgress());
  ageConfirmed = signal(false);

  dimensions = [
    { label: 'Information Load', description: 'Whether you want one next step first or the fuller picture up front.' },
    { label: 'Scope Management', description: 'How actively the AI should help you stay on task.' },
    { label: 'Challenge Level', description: 'How directly the AI should push back on plans, risks, and contradictions.' },
    { label: 'Thinking Rigor', description: 'When the AI should clarify, surface assumptions, or move quickly.' },
    { label: 'Coaching Threshold', description: 'How often the AI should flag missing prompt details before answering.' },
    { label: 'Coaching Delivery', description: 'Whether prompt coaching should ask first, answer with an assumption, or stay brief.' },
  ];

  start(): void {
    track('assessment_started');
    this.sessionStore.startFresh();
    this.router.navigate(['/setup']);
  }

  resume(): void {
    this.router.navigate(['/setup']);
  }

  startFresh(): void {
    this.ageConfirmed.set(false);
    this.sessionStore.startFresh();
  }
}
