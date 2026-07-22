export type PermanentQuestionId =
  | 'starting-work'
  | 'information-load'
  | 'decision-support'
  | 'side-topics'
  | 'interruption-recovery';

export type OptionCode = 'A' | 'B' | 'C';

export type CapacityId =
  | 'usual'
  | 'limited'
  | 'very-limited';

export type PermanentOptionId =
  | 'starting-work:A'
  | 'starting-work:B'
  | 'starting-work:C'
  | 'information-load:A'
  | 'information-load:B'
  | 'information-load:C'
  | 'decision-support:A'
  | 'decision-support:B'
  | 'decision-support:C'
  | 'side-topics:A'
  | 'side-topics:B'
  | 'side-topics:C'
  | 'interruption-recovery:A'
  | 'interruption-recovery:B'
  | 'interruption-recovery:C';

export interface PermanentSelections {
  'starting-work': OptionCode;
  'information-load': OptionCode;
  'decision-support': OptionCode;
  'side-topics': OptionCode;
  'interruption-recovery': OptionCode;
}

export interface MvpQuestionOptionDefinition {
  readonly code: OptionCode;
  readonly optionId: PermanentOptionId;
  readonly answerText: string;
  readonly moduleText: string;
}

export interface MvpQuestionDefinition {
  readonly id: PermanentQuestionId;
  readonly title: string;
  readonly prompt: string;
  readonly options: Readonly<Record<OptionCode, MvpQuestionOptionDefinition>>;
}

export interface MvpCapacityDefinition {
  readonly id: CapacityId;
  readonly label: string;
  readonly modifier: string | null;
}

export interface ValidatedMvpContent {
  readonly schemaVersion: 'mvp-content.v1';
  readonly sharedOpening: string;
  readonly sharedClosing: string;
  readonly questionOrder: readonly PermanentQuestionId[];
  readonly questions: Readonly<Record<PermanentQuestionId, MvpQuestionDefinition>>;
  readonly permanentOptions: Readonly<Record<PermanentOptionId, MvpQuestionOptionDefinition>>;
  readonly capacities: Readonly<Record<CapacityId, MvpCapacityDefinition>>;
}

export interface StructuralValidationError {
  readonly path: string;
  readonly code:
    | 'type'
    | 'missing'
    | 'unknown'
    | 'duplicate'
    | 'value'
    | 'count'
    | 'exact-mismatch';
  readonly message: string;
}

export interface ValidationResult<T> {
  readonly valid: boolean;
  readonly errors: readonly StructuralValidationError[];
  readonly value: T | null;
}
