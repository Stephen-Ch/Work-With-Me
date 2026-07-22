import {
  CapacityId,
  OptionCode,
  PermanentQuestionId,
  PermanentSelections,
  ValidatedMvpContent,
} from './mvp.types';

const MAX_PERMANENT_WORDS = 180;
const TARGET_MIN_WORDS = 90;
const TARGET_MAX_WORDS = 140;

const VALID_OPTION_CODES: readonly OptionCode[] = ['A', 'B', 'C'];

export interface ProfileValidationResult {
  readonly valid: boolean;
  readonly missingQuestionIds: readonly PermanentQuestionId[];
  readonly unknownQuestionIds: readonly string[];
  readonly unknownOptionCodes: readonly string[];
}

export interface PermanentPromptResult {
  readonly prompt: string;
  readonly segments: readonly string[];
  readonly wordCount: number;
  readonly targetRangeStatus:
    | 'below-target'
    | 'within-target'
    | 'above-target';
}

export class MvpGenerationError extends Error {}

function normalizeForExactDuplicateCheck(text: string): string {
  return text.trim().replace(/\s+/g, ' ');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toOptionCodeString(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (value === null) {
    return '<null>';
  }
  if (Array.isArray(value)) {
    return '<array>';
  }
  return `<${typeof value}>`;
}

function isOptionCode(value: unknown): value is OptionCode {
  return typeof value === 'string' && VALID_OPTION_CODES.includes(value as OptionCode);
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return 0;
  }

  return trimmed.split(/\s+/).length;
}

export function validateProfile(
  selections: unknown,
  content: ValidatedMvpContent
): ProfileValidationResult {
  const missing = new Set<PermanentQuestionId>(content.questionOrder);
  const unknownQuestionIds: string[] = [];
  const unknownOptionCodes: string[] = [];

  if (!isRecord(selections)) {
    return {
      valid: false,
      missingQuestionIds: [...missing],
      unknownQuestionIds,
      unknownOptionCodes,
    };
  }

  for (const [questionId, optionCode] of Object.entries(selections)) {
    if (!content.questionOrder.includes(questionId as PermanentQuestionId)) {
      unknownQuestionIds.push(questionId);
      continue;
    }

    missing.delete(questionId as PermanentQuestionId);

    if (!isOptionCode(optionCode)) {
      unknownOptionCodes.push(`${questionId}:${toOptionCodeString(optionCode)}`);
      continue;
    }

    const option = content.questions[questionId as PermanentQuestionId].options[optionCode];
    if (!option) {
      unknownOptionCodes.push(`${questionId}:${optionCode}`);
    }
  }

  const missingQuestionIds = [...missing];

  return {
    valid:
      missingQuestionIds.length === 0 &&
      unknownQuestionIds.length === 0 &&
      unknownOptionCodes.length === 0,
    missingQuestionIds,
    unknownQuestionIds,
    unknownOptionCodes,
  };
}

function toRangeStatus(wordCount: number): PermanentPromptResult['targetRangeStatus'] {
  if (wordCount < TARGET_MIN_WORDS) {
    return 'below-target';
  }
  if (wordCount > TARGET_MAX_WORDS) {
    return 'above-target';
  }
  return 'within-target';
}

export function generatePermanentPrompt(
  selections: unknown,
  content: ValidatedMvpContent
): PermanentPromptResult {
  const profileValidation = validateProfile(selections, content);
  if (!profileValidation.valid) {
    throw new MvpGenerationError(
      [
        profileValidation.missingQuestionIds.length > 0
          ? `Missing: ${profileValidation.missingQuestionIds.join(', ')}`
          : null,
        profileValidation.unknownQuestionIds.length > 0
          ? `Unknown questions: ${profileValidation.unknownQuestionIds.join(', ')}`
          : null,
        profileValidation.unknownOptionCodes.length > 0
          ? `Unknown options: ${profileValidation.unknownOptionCodes.join(', ')}`
          : null,
      ]
        .filter((v): v is string => Boolean(v))
        .join(' | ')
    );
  }

  const assembled: string[] = [content.sharedOpening];
  for (const questionId of content.questionOrder) {
    const code = (selections as PermanentSelections)[questionId];
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

  if (deduplicated.length < 3) {
    throw new MvpGenerationError('Permanent prompt assembly failed due to insufficient segments.');
  }

  const opening = deduplicated[0];
  const closing = deduplicated[deduplicated.length - 1];
  const middleModules = deduplicated.slice(1, deduplicated.length - 1);
  const prompt = `${opening}\n${middleModules.join(' ')}\n${closing}`;
  const words = countWords(prompt);

  if (words > MAX_PERMANENT_WORDS) {
    throw new MvpGenerationError(
      `Permanent prompt exceeds maximum word count (${words} > ${MAX_PERMANENT_WORDS}).`
    );
  }

  return {
    prompt,
    segments: deduplicated,
    wordCount: words,
    targetRangeStatus: toRangeStatus(words),
  };
}

export function generateCapacityModifier(
  capacityId: CapacityId,
  content: ValidatedMvpContent
): string | null {
  const capacity = content.capacities[capacityId];
  if (!capacity) {
    throw new MvpGenerationError(`Unknown capacity ID: ${capacityId}`);
  }

  return capacity.modifier;
}
