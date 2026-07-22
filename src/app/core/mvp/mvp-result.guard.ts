import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { OptionCode, PermanentQuestionId, PermanentSelections } from './mvp.types';
import { MvpSessionStore } from './mvp-session.store';

const PERMANENT_QUESTION_IDS: readonly PermanentQuestionId[] = [
  'starting-work',
  'information-load',
  'decision-support',
  'side-topics',
  'interruption-recovery',
];

const OPTION_CODES: readonly OptionCode[] = ['A', 'B', 'C'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isOptionCode(value: unknown): value is OptionCode {
  return typeof value === 'string' && OPTION_CODES.includes(value as OptionCode);
}

export function isMvpResultEligible(selections: unknown): selections is PermanentSelections {
  if (!isRecord(selections)) {
    return false;
  }

  const keys = Object.keys(selections);
  if (keys.length !== PERMANENT_QUESTION_IDS.length) {
    return false;
  }

  const keySet = new Set(keys);
  for (const questionId of PERMANENT_QUESTION_IDS) {
    if (!keySet.has(questionId)) {
      return false;
    }
    if (!isOptionCode(selections[questionId])) {
      return false;
    }
  }

  return true;
}

export const mvpResultGuard: CanActivateFn = () => {
  const router = inject(Router);
  const store = inject(MvpSessionStore);

  return isMvpResultEligible(store.permanentSelections()) ? true : router.parseUrl('/setup');
};
