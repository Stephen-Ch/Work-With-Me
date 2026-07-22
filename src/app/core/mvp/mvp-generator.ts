import {
  CapacityId,
  OptionCode,
  PermanentQuestionId,
  PermanentSelections,
  ValidatedMvpContent,
} from './mvp.types';

const MAX_PERMANENT_WORDS = 180;

export interface ProfileValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

export class MvpGenerationError extends Error {}

function normalizeForExactDuplicateCheck(text: string): string {
  return text.trim().replace(/\s+/g, ' ');
}

export function countWords(text: string): number {
  const matches = text.match(/\b\S+\b/g);
  return matches ? matches.length : 0;
}

export function validateProfile(
  selections: Partial<Record<PermanentQuestionId, OptionCode>>,
  content: ValidatedMvpContent
): ProfileValidationResult {
  const errors: string[] = [];

  for (const questionId of content.questionOrder) {
    const selection = selections[questionId];
    if (!selection) {
      errors.push(`Missing selection for ${questionId}.`);
      continue;
    }

    if (!['A', 'B', 'C'].includes(selection)) {
      errors.push(`Invalid option code ${selection} for ${questionId}.`);
      continue;
    }

    const option = content.questions[questionId].options[selection as OptionCode];
    if (!option) {
      errors.push(`Unknown option ${questionId}:${selection}.`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function generatePermanentPrompt(
  selections: PermanentSelections,
  content: ValidatedMvpContent
): string {
  const profileValidation = validateProfile(selections, content);
  if (!profileValidation.valid) {
    throw new MvpGenerationError(profileValidation.errors.join(' | '));
  }

  const assembled: string[] = [content.sharedOpening];
  for (const questionId of content.questionOrder) {
    const code = selections[questionId];
    assembled.push(content.questions[questionId].options[code].moduleText);
  }
  assembled.push(content.sharedClosing);

  const deduplicated: string[] = [];
  const seen = new Set<string>();
  for (const line of assembled) {
    const normalized = normalizeForExactDuplicateCheck(line);
    if (seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    deduplicated.push(line);
  }

  const prompt = deduplicated.join('\n');
  const words = countWords(prompt);

  if (words > MAX_PERMANENT_WORDS) {
    throw new MvpGenerationError(
      `Permanent prompt exceeds maximum word count (${words} > ${MAX_PERMANENT_WORDS}).`
    );
  }

  return prompt;
}

export function generateCapacityModifier(
  capacityId: CapacityId,
  content: ValidatedMvpContent
): string {
  const capacity = content.capacities[capacityId];
  if (!capacity) {
    throw new MvpGenerationError(`Unknown capacity ID: ${capacityId}`);
  }

  return capacity.modifier ?? '';
}
