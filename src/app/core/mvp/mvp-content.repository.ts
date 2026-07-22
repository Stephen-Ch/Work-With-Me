import {
  CapacityId,
  MvpCapacityDefinition,
  MvpQuestionDefinition,
  MvpQuestionOptionDefinition,
  OptionCode,
  PermanentOptionId,
  PermanentQuestionId,
  StructuralValidationError,
  ValidatedMvpContent,
  ValidationResult,
} from './mvp.types';

const SCHEMA_VERSION = 'mvp-content.v1' as const;
export const MVP_CONTENT_URL = '/assets/content/mvp-content.json';

const QUESTION_ORDER: readonly PermanentQuestionId[] = [
  'starting-work',
  'information-load',
  'decision-support',
  'side-topics',
  'interruption-recovery',
];

const OPTION_CODES: readonly OptionCode[] = ['A', 'B', 'C'];
const CAPACITY_IDS: readonly CapacityId[] = ['usual', 'limited', 'very-limited'];

const EXPECTED_SHARED_OPENING =
  'Use these preferences when they are relevant. Answer normally when my request is already clear and specific.';

const EXPECTED_SHARED_CLOSING =
  'My explicit request overrides these defaults. When key information is missing, state a reasonable assumption and continue. Ask one question only when the answer would materially change the result.';

const EXPECTED_QUESTION_TEXT: Readonly<Record<PermanentQuestionId, { title: string; prompt: string; answers: Readonly<Record<OptionCode, string>>; modules: Readonly<Record<OptionCode, string>> }>> = {
  'starting-work': {
    title: 'Starting unclear or complex work',
    prompt: 'When a task feels unclear or complex, what helps most?',
    answers: {
      A: 'Give me one clear first step.',
      B: 'Break it into a short ordered plan.',
      C: 'Give me the broader picture, then recommend where to start.',
    },
    modules: {
      A: 'Give one clear first step before any deeper explanation.',
      B: 'Break the work into a short ordered plan with concrete actions.',
      C: 'Give the broader picture first, then recommend where to start.',
    },
  },
  'information-load': {
    title: 'Managing information load',
    prompt: 'When information is piling up, what should the assistant do?',
    answers: {
      A: 'Keep it brief and focus on the essentials.',
      B: 'Start with a summary, then add the detail I need.',
      C: 'Give me fuller context in a clear, scannable structure.',
    },
    modules: {
      A: 'Keep responses brief and focus on essentials unless I ask for more.',
      B: 'Start with a short summary, then add only the detail needed to act.',
      C: 'Provide fuller context in a clear, scannable structure.',
    },
  },
  'decision-support': {
    title: 'Making decisions',
    prompt: 'When several reasonable options exist, what should the assistant do?',
    answers: {
      A: 'Recommend one option and explain why.',
      B: 'Compare the main options and tradeoffs.',
      C: 'Ask one question first when missing information could change the recommendation.',
    },
    modules: {
      A: 'Recommend one option and explain why it is the best fit.',
      B: 'Compare the main options and tradeoffs concisely before concluding.',
      C: 'Ask one question first only when missing information could materially change the recommendation.',
    },
  },
  'side-topics': {
    title: 'Handling side topics',
    prompt: 'When a conversation branches into side topics, what should the assistant do?',
    answers: {
      A: 'Keep me on the current task and flag the drift.',
      B: 'Briefly park useful side topics, then return to the task.',
      C: 'Follow useful side topics unless I ask to return.',
    },
    modules: {
      A: 'Keep me on the current task and flag drift clearly.',
      B: 'Briefly park useful side topics, then return to the current task.',
      C: 'Follow useful side topics unless I ask to return to the main task.',
    },
  },
  'interruption-recovery': {
    title: 'Returning after an interruption',
    prompt: 'When I return after a break, what should the assistant do?',
    answers: {
      A: 'Continue from the last action with little or no recap.',
      B: 'Give me a brief recap, then the next step.',
      C: 'Reconstruct the key decisions, open questions, and next step.',
    },
    modules: {
      A: 'Continue from the last action with little or no recap.',
      B: 'Give a brief recap, then provide the next step.',
      C: 'Reconstruct key decisions, open questions, and the next step before continuing.',
    },
  },
};

const EXPECTED_CAPACITY: Readonly<Record<CapacityId, { label: string; modifier: string | null }>> = {
  usual: { label: 'Usual bandwidth', modifier: null },
  limited: {
    label: 'Limited bandwidth',
    modifier:
      'For this session, keep responses compact and practical. Give the smallest useful answer first, trim optional detail, and expand only if I ask.',
  },
  'very-limited': {
    label: 'Very limited bandwidth',
    modifier:
      'For this session, use essentials-only responses. Give one actionable step at a time, avoid extra options by default, and add depth only if I request it.',
  },
};

class ValidationCollector {
  readonly errors: StructuralValidationError[] = [];

  push(path: string, code: StructuralValidationError['code'], message: string): void {
    this.errors.push({ path, code, message });
  }

  result<T>(value: T | null): ValidationResult<T> {
    return {
      valid: this.errors.length === 0,
      errors: this.errors,
      value: this.errors.length === 0 ? value : null,
    };
  }
}

export class MvpContentValidationError extends Error {
  constructor(public readonly errors: readonly StructuralValidationError[]) {
    super('Invalid MVP content');
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function makeOptionId(questionId: PermanentQuestionId, code: OptionCode): PermanentOptionId {
  return `${questionId}:${code}` as PermanentOptionId;
}

export function validateMvpContent(raw: unknown): ValidationResult<ValidatedMvpContent> {
  const collector = new ValidationCollector();

  if (!isRecord(raw)) {
    collector.push('$', 'type', 'Root content must be an object.');
    return collector.result<ValidatedMvpContent>(null);
  }

  const schemaVersion = raw['schemaVersion'];
  const sharedOpening = raw['sharedOpening'];
  const sharedClosing = raw['sharedClosing'];
  const questionOrderRaw = raw['questionOrder'];
  const questionsRaw = raw['questions'];
  const capacitiesRaw = raw['capacities'];

  if (schemaVersion !== SCHEMA_VERSION) {
    collector.push('schemaVersion', 'exact-mismatch', `schemaVersion must be ${SCHEMA_VERSION}.`);
  }

  if (sharedOpening !== EXPECTED_SHARED_OPENING) {
    collector.push('sharedOpening', 'exact-mismatch', 'sharedOpening does not match locked text.');
  }

  if (sharedClosing !== EXPECTED_SHARED_CLOSING) {
    collector.push('sharedClosing', 'exact-mismatch', 'sharedClosing does not match locked text.');
  }

  if (!Array.isArray(questionOrderRaw)) {
    collector.push('questionOrder', 'type', 'questionOrder must be an array.');
  } else if (questionOrderRaw.length !== QUESTION_ORDER.length) {
    collector.push('questionOrder', 'count', 'questionOrder must contain exactly five question IDs.');
  }

  const questionOrder: PermanentQuestionId[] = [];
  if (Array.isArray(questionOrderRaw)) {
    questionOrderRaw.forEach((value, index) => {
      if (typeof value !== 'string') {
        collector.push(`questionOrder[${index}]`, 'type', 'questionOrder values must be strings.');
        return;
      }
      questionOrder.push(value as PermanentQuestionId);
      const expected = QUESTION_ORDER[index];
      if (value !== expected) {
        collector.push(`questionOrder[${index}]`, 'exact-mismatch', `questionOrder[${index}] must be ${expected}.`);
      }
      if (!QUESTION_ORDER.includes(value as PermanentQuestionId)) {
        collector.push(`questionOrder[${index}]`, 'unknown', `Unknown question ID ${value}.`);
      }
    });

    const seen = new Set<string>();
    for (const id of questionOrder) {
      if (seen.has(id)) {
        collector.push('questionOrder', 'duplicate', `Duplicate question ID ${id}.`);
      }
      seen.add(id);
    }

    for (const expectedId of QUESTION_ORDER) {
      if (!questionOrder.includes(expectedId)) {
        collector.push('questionOrder', 'missing', `Missing question ID ${expectedId}.`);
      }
    }
  }

  if (!Array.isArray(questionsRaw)) {
    collector.push('questions', 'type', 'questions must be an array.');
  }

  const questionsById = new Map<PermanentQuestionId, MvpQuestionDefinition>();
  const permanentOptionsById = new Map<PermanentOptionId, MvpQuestionOptionDefinition>();

  if (Array.isArray(questionsRaw)) {
    if (questionsRaw.length !== QUESTION_ORDER.length) {
      collector.push('questions', 'count', 'questions must contain exactly five question definitions.');
    }

    questionsRaw.forEach((rawQuestion, questionIndex) => {
      if (!isRecord(rawQuestion)) {
        collector.push(`questions[${questionIndex}]`, 'type', 'Question entry must be an object.');
        return;
      }

      const id = rawQuestion['id'];
      const title = rawQuestion['title'];
      const prompt = rawQuestion['prompt'];
      const options = rawQuestion['options'];

      if (typeof id !== 'string') {
        collector.push(`questions[${questionIndex}].id`, 'type', 'Question id must be a string.');
        return;
      }
      if (!QUESTION_ORDER.includes(id as PermanentQuestionId)) {
        collector.push(`questions[${questionIndex}].id`, 'unknown', `Unknown question ID ${id}.`);
        return;
      }

      const questionId = id as PermanentQuestionId;
      if (questionsById.has(questionId)) {
        collector.push(`questions[${questionIndex}].id`, 'duplicate', `Duplicate question ID ${questionId}.`);
        return;
      }

      const expectedQuestion = EXPECTED_QUESTION_TEXT[questionId];
      if (title !== expectedQuestion.title) {
        collector.push(`questions[${questionIndex}].title`, 'exact-mismatch', `Title for ${questionId} does not match locked text.`);
      }
      if (prompt !== expectedQuestion.prompt) {
        collector.push(`questions[${questionIndex}].prompt`, 'exact-mismatch', `Prompt for ${questionId} does not match locked text.`);
      }

      if (!Array.isArray(options)) {
        collector.push(`questions[${questionIndex}].options`, 'type', 'Question options must be an array.');
        return;
      }

      if (options.length !== OPTION_CODES.length) {
        collector.push(`questions[${questionIndex}].options`, 'count', 'Each question must define exactly three options.');
      }

      const byCode: Partial<Record<OptionCode, MvpQuestionOptionDefinition>> = {};
      const seenCodes = new Set<string>();

      options.forEach((rawOption, optionIndex) => {
        if (!isRecord(rawOption)) {
          collector.push(`questions[${questionIndex}].options[${optionIndex}]`, 'type', 'Option entry must be an object.');
          return;
        }

        const code = rawOption['code'];
        const optionId = rawOption['optionId'];
        const answerText = rawOption['answerText'];
        const moduleText = rawOption['moduleText'];

        if (typeof code !== 'string') {
          collector.push(`questions[${questionIndex}].options[${optionIndex}].code`, 'type', 'Option code must be a string.');
          return;
        }

        if (!OPTION_CODES.includes(code as OptionCode)) {
          collector.push(`questions[${questionIndex}].options[${optionIndex}].code`, 'unknown', `Unknown option code ${code}.`);
          return;
        }

        if (seenCodes.has(code)) {
          collector.push(`questions[${questionIndex}].options`, 'duplicate', `Duplicate option code ${code} for ${questionId}.`);
        }
        seenCodes.add(code);

        const optionCode = code as OptionCode;
        const expectedOptionId = makeOptionId(questionId, optionCode);
        if (optionId !== expectedOptionId) {
          collector.push(
            `questions[${questionIndex}].options[${optionIndex}].optionId`,
            'exact-mismatch',
            `Option ID for ${questionId} ${optionCode} must be ${expectedOptionId}.`
          );
        }

        if (answerText !== EXPECTED_QUESTION_TEXT[questionId].answers[optionCode]) {
          collector.push(
            `questions[${questionIndex}].options[${optionIndex}].answerText`,
            'exact-mismatch',
            `Answer text for ${questionId} ${optionCode} does not match locked text.`
          );
        }

        if (moduleText !== EXPECTED_QUESTION_TEXT[questionId].modules[optionCode]) {
          collector.push(
            `questions[${questionIndex}].options[${optionIndex}].moduleText`,
            'exact-mismatch',
            `Module text for ${questionId} ${optionCode} does not match locked text.`
          );
        }

        const typedOption: MvpQuestionOptionDefinition = {
          code: optionCode,
          optionId: expectedOptionId,
          answerText: typeof answerText === 'string' ? answerText : '',
          moduleText: typeof moduleText === 'string' ? moduleText : '',
        };

        if (permanentOptionsById.has(expectedOptionId)) {
          collector.push('questions.options.optionId', 'duplicate', `Duplicate permanent option ID ${expectedOptionId}.`);
        }
        permanentOptionsById.set(expectedOptionId, typedOption);
        byCode[optionCode] = typedOption;
      });

      for (const requiredCode of OPTION_CODES) {
        if (!seenCodes.has(requiredCode)) {
          collector.push(`questions[${questionIndex}].options`, 'missing', `Missing option code ${requiredCode} for ${questionId}.`);
        }
      }

      const typedQuestion: MvpQuestionDefinition = {
        id: questionId,
        title: typeof title === 'string' ? title : '',
        prompt: typeof prompt === 'string' ? prompt : '',
        options: byCode as Readonly<Record<OptionCode, MvpQuestionOptionDefinition>>,
      };

      questionsById.set(questionId, typedQuestion);
    });

    for (const expectedQuestionId of QUESTION_ORDER) {
      if (!questionsById.has(expectedQuestionId)) {
        collector.push('questions', 'missing', `Missing question definition for ${expectedQuestionId}.`);
      }
    }
  }

  if (permanentOptionsById.size !== 15) {
    collector.push('questions.options', 'count', 'Exactly 15 permanent option definitions are required.');
  }

  if (!Array.isArray(capacitiesRaw)) {
    collector.push('capacities', 'type', 'capacities must be an array.');
  }

  const capacitiesById = new Map<CapacityId, MvpCapacityDefinition>();
  if (Array.isArray(capacitiesRaw)) {
    if (capacitiesRaw.length !== CAPACITY_IDS.length) {
      collector.push('capacities', 'count', 'capacities must contain exactly three entries.');
    }

    capacitiesRaw.forEach((rawCapacity, index) => {
      if (!isRecord(rawCapacity)) {
        collector.push(`capacities[${index}]`, 'type', 'Capacity entry must be an object.');
        return;
      }

      const id = rawCapacity['id'];
      const label = rawCapacity['label'];
      const modifier = rawCapacity['modifier'];

      if (typeof id !== 'string') {
        collector.push(`capacities[${index}].id`, 'type', 'Capacity id must be a string.');
        return;
      }

      if (!CAPACITY_IDS.includes(id as CapacityId)) {
        collector.push(`capacities[${index}].id`, 'unknown', `Unknown capacity ID ${id}.`);
        return;
      }

      const capacityId = id as CapacityId;
      if (capacitiesById.has(capacityId)) {
        collector.push(`capacities[${index}].id`, 'duplicate', `Duplicate capacity ID ${capacityId}.`);
        return;
      }

      const expected = EXPECTED_CAPACITY[capacityId];
      if (label !== expected.label) {
        collector.push(`capacities[${index}].label`, 'exact-mismatch', `Capacity label for ${capacityId} does not match locked text.`);
      }

      if (capacityId === 'usual') {
        if (modifier !== null && modifier !== undefined) {
          collector.push(`capacities[${index}].modifier`, 'value', 'Usual bandwidth must map to no modifier.');
        }
      } else if (modifier !== expected.modifier) {
        collector.push(`capacities[${index}].modifier`, 'exact-mismatch', `Modifier for ${capacityId} does not match locked text.`);
      }

      capacitiesById.set(capacityId, {
        id: capacityId,
        label: typeof label === 'string' ? label : '',
        modifier: modifier === undefined ? null : (modifier as string | null),
      });
    });

    for (const requiredCapacityId of CAPACITY_IDS) {
      if (!capacitiesById.has(requiredCapacityId)) {
        collector.push('capacities', 'missing', `Missing capacity definition ${requiredCapacityId}.`);
      }
    }
  }

  if (collector.errors.length > 0) {
    return collector.result<ValidatedMvpContent>(null);
  }

  const questionRecord = Object.freeze(Object.fromEntries(QUESTION_ORDER.map((id) => [id, Object.freeze(questionsById.get(id)!)]))) as Readonly<
    Record<PermanentQuestionId, MvpQuestionDefinition>
  >;

  const permanentOptionsRecord = Object.freeze(
    Object.fromEntries(
      Object.values(questionRecord)
        .flatMap((q) => OPTION_CODES.map((code) => q.options[code]))
        .map((option) => [option.optionId, Object.freeze(option)])
    )
  ) as Readonly<Record<PermanentOptionId, MvpQuestionOptionDefinition>>;

  const capacitiesRecord = Object.freeze(
    Object.fromEntries(CAPACITY_IDS.map((id) => [id, Object.freeze(capacitiesById.get(id)!)]))
  ) as Readonly<Record<CapacityId, MvpCapacityDefinition>>;

  const value: ValidatedMvpContent = Object.freeze({
    schemaVersion: SCHEMA_VERSION,
    sharedOpening: EXPECTED_SHARED_OPENING,
    sharedClosing: EXPECTED_SHARED_CLOSING,
    questionOrder: Object.freeze([...QUESTION_ORDER]),
    questions: questionRecord,
    permanentOptions: permanentOptionsRecord,
    capacities: capacitiesRecord,
  });

  return collector.result(value);
}

export class MvpContentRepository {
  async load(): Promise<ValidatedMvpContent> {
    const response = await fetch(MVP_CONTENT_URL);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const raw: unknown = await response.json();
    const validation = validateMvpContent(raw);
    if (!validation.valid || !validation.value) {
      throw new MvpContentValidationError(validation.errors);
    }

    return validation.value;
  }
}
