import {
  MvpContentRepository,
  MvpContentValidationError,
  validateMvpContent,
} from './mvp-content.repository';
import { ValidatedMvpContent } from './mvp.types';

import rawMvpContent from '../../../assets/content/mvp-content.json';

describe('validateMvpContent', () => {
  it('accepts locked authored content', () => {
    const result = validateMvpContent(rawMvpContent);

    expect(result.valid).toBeTrue();
    expect(result.errors).toEqual([]);
    expect(result.value).not.toBeNull();

    const content = result.value as ValidatedMvpContent;
    expect(content.schemaVersion).toBe('mvp-content.v1');
    expect(content.questionOrder.length).toBe(5);
    expect(Object.keys(content.permanentOptions).length).toBe(15);
  });

  it('fails closed when required question is missing', () => {
    const clone = structuredClone(rawMvpContent) as {
      questions: Array<{ id: string }>;
    };
    clone.questions = clone.questions.filter((q) => q.id !== 'decision-support');

    const result = validateMvpContent(clone);

    expect(result.valid).toBeFalse();
    expect(result.value).toBeNull();
    expect(result.errors.some((e) => e.message.includes('Missing question definition for decision-support.'))).toBeTrue();
  });

  it('fails closed when option module text deviates from locked catalog text', () => {
    const clone = structuredClone(rawMvpContent) as {
      questions: Array<{ id: string; options: Array<{ code: string; moduleText: string }> }>;
    };
    const q1 = clone.questions.find((q) => q.id === 'starting-work');
    if (!q1) {
      throw new Error('Fixture corruption: missing starting-work question');
    }
    const q1a = q1.options.find((o) => o.code === 'A');
    if (!q1a) {
      throw new Error('Fixture corruption: missing starting-work A option');
    }
    q1a.moduleText = 'Give one clear first step.';

    const result = validateMvpContent(clone);

    expect(result.valid).toBeFalse();
    expect(result.value).toBeNull();
    expect(result.errors.some((e) => e.path.includes('moduleText'))).toBeTrue();
  });

  it('fails closed when usual capacity has a modifier', () => {
    const clone = structuredClone(rawMvpContent) as {
      capacities: Array<{ id: string; modifier: string | null }>;
    };
    const usual = clone.capacities.find((c) => c.id === 'usual');
    if (!usual) {
      throw new Error('Fixture corruption: missing usual capacity');
    }
    usual.modifier = 'This should not exist.';

    const result = validateMvpContent(clone);

    expect(result.valid).toBeFalse();
    expect(result.value).toBeNull();
    expect(result.errors.some((e) => e.message.includes('Usual bandwidth must map to no modifier.'))).toBeTrue();
  });
});

describe('MvpContentRepository', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns validated content on success', async () => {
    (globalThis.fetch as unknown) = jasmine
      .createSpy('fetch')
      .and.resolveTo({ ok: true, json: async () => structuredClone(rawMvpContent) });

    const repository = new MvpContentRepository();
    const content = await repository.load();

    expect(content.questionOrder).toEqual([
      'starting-work',
      'information-load',
      'decision-support',
      'side-topics',
      'interruption-recovery',
    ]);
  });

  it('throws validation error on invalid content', async () => {
    const invalid = structuredClone(rawMvpContent) as { schemaVersion: string };
    invalid.schemaVersion = 'bad-schema';

    (globalThis.fetch as unknown) = jasmine
      .createSpy('fetch')
      .and.resolveTo({ ok: true, json: async () => invalid });

    const repository = new MvpContentRepository();

    await expectAsync(repository.load()).toBeRejectedWithError(MvpContentValidationError);
  });

  it('throws on non-ok response', async () => {
    (globalThis.fetch as unknown) = jasmine
      .createSpy('fetch')
      .and.resolveTo({ ok: false, status: 500, statusText: 'Server Error' });

    const repository = new MvpContentRepository();

    await expectAsync(repository.load()).toBeRejectedWithError('HTTP 500: Server Error');
  });
});
