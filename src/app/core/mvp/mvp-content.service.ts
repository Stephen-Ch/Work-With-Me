import { Injectable, computed, signal } from '@angular/core';
import { MvpContentRepository } from './mvp-content.repository';
import { ValidatedMvpContent } from './mvp.types';

export interface MvpContentState {
  readonly content: ValidatedMvpContent | null;
  readonly loading: boolean;
  readonly error: string | null;
}

const UI_SAFE_LOAD_ERROR = 'Unable to load Work With Me content. Please retry.';

@Injectable({
  providedIn: 'root',
})
export class MvpContentService {
  private readonly _state = signal<MvpContentState>({
    content: null,
    loading: false,
    error: null,
  });

  private inFlightLoad: Promise<void> | null = null;

  readonly state = this._state.asReadonly();
  readonly content = computed(() => this._state().content);
  readonly loading = computed(() => this._state().loading);
  readonly error = computed(() => this._state().error);

  constructor(private readonly repository: MvpContentRepository) {}

  loadContent(): Promise<void> {
    const current = this._state();
    if (current.content) {
      return Promise.resolve();
    }

    if (this.inFlightLoad) {
      return this.inFlightLoad;
    }

    this._state.update((state) => ({ ...state, loading: true, error: null }));

    this.inFlightLoad = this.repository
      .load()
      .then((content) => {
        this._state.set({ content, loading: false, error: null });
      })
      .catch((error: unknown) => {
        void error;
        this._state.set({ content: null, loading: false, error: UI_SAFE_LOAD_ERROR });
      })
      .finally(() => {
        this.inFlightLoad = null;
      });

    return this.inFlightLoad;
  }

  async retry(): Promise<void> {
    this._state.update((state) => ({ ...state, error: null }));
    return this.loadContent();
  }
}
