import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { MvpContentRepository } from './mvp-content.repository';
import { MvpContentService } from './mvp-content.service';
import { CapacityId, OptionCode, PermanentQuestionId, ValidatedMvpContent } from './mvp.types';

const QUESTION_ORDER: readonly PermanentQuestionId[] = [
  'starting-work',
  'information-load',
  'decision-support',
  'side-topics',
  'interruption-recovery',
];

const OPTION_CODES: readonly OptionCode[] = ['A', 'B', 'C'];
const CAPACITY_IDS: readonly CapacityId[] = ['usual', 'limited', 'very-limited'];

function makeValidatedContent(): ValidatedMvpContent {
  const questions = Object.fromEntries(
    QUESTION_ORDER.map((questionId) => [
      questionId,
      {
        id: questionId,
        title: `Title for ${questionId}`,
        prompt: `Prompt for ${questionId}`,
        options: Object.fromEntries(
          OPTION_CODES.map((code) => [
            code,
            {
              code,
              optionId: `${questionId}:${code}` as const,
              answerText: `Answer ${code} for ${questionId}`,
              moduleText: `Module ${code} for ${questionId}`,
            },
          ])
        ) as ValidatedMvpContent['questions'][PermanentQuestionId]['options'],
      },
    ])
  ) as ValidatedMvpContent['questions'];

  const permanentOptions = Object.fromEntries(
    QUESTION_ORDER.flatMap((questionId) =>
      OPTION_CODES.map((code) => [
        `${questionId}:${code}`,
        {
          code,
          optionId: `${questionId}:${code}` as const,
          answerText: `Answer ${code} for ${questionId}`,
          moduleText: `Module ${code} for ${questionId}`,
        },
      ])
    )
  ) as ValidatedMvpContent['permanentOptions'];

  const capacities = Object.fromEntries(
    CAPACITY_IDS.map((capacityId) => [
      capacityId,
      {
        id: capacityId,
        label: `Label ${capacityId}`,
        modifier: capacityId === 'usual' ? null : `Modifier ${capacityId}`,
      },
    ])
  ) as ValidatedMvpContent['capacities'];

  return {
    schemaVersion: 'mvp-content.v1',
    sharedOpening: 'Opening',
    sharedClosing: 'Closing',
    questionOrder: QUESTION_ORDER,
    questions,
    permanentOptions,
    capacities,
  };
}

describe('MvpContentService', () => {
  let service: MvpContentService;
  let repository: jasmine.SpyObj<MvpContentRepository>;

  beforeEach(() => {
    repository = jasmine.createSpyObj<MvpContentRepository>('MvpContentRepository', ['load']);

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        MvpContentService,
        { provide: MvpContentRepository, useValue: repository },
      ],
    });

    service = TestBed.inject(MvpContentService);
  });

  it('starts in an unloaded state', () => {
    expect(service.state()).toEqual({ content: null, loading: false, error: null });
    expect(service.content()).toBeNull();
    expect(service.loading()).toBeFalse();
    expect(service.error()).toBeNull();
  });

  it('loads and exposes validated content', async () => {
    const content = makeValidatedContent();
    repository.load.and.resolveTo(content);

    await service.loadContent();

    expect(repository.load).toHaveBeenCalledTimes(1);
    expect(service.state()).toEqual({ content, loading: false, error: null });
    expect(service.content()).toEqual(content);
  });

  it('sets a safe UI error when repository throws', async () => {
    repository.load.and.rejectWith(new Error('Network stack trace and details'));

    await service.loadContent();

    expect(service.loading()).toBeFalse();
    expect(service.content()).toBeNull();
    expect(service.error()).toBe('Unable to load Work With Me content. Please retry.');
  });

  it('sets a safe UI error when repository validation fails', async () => {
    repository.load.and.rejectWith(new Error('Invalid MVP content details that should not leak directly'));

    await service.loadContent();

    expect(service.error()).toBe('Unable to load Work With Me content. Please retry.');
  });

  it('supports retry after failure', async () => {
    const content = makeValidatedContent();
    repository.load.and.returnValues(
      Promise.reject(new Error('first failure')),
      Promise.resolve(content)
    );

    await service.loadContent();
    expect(service.error()).toBe('Unable to load Work With Me content. Please retry.');

    await service.retry();

    expect(repository.load).toHaveBeenCalledTimes(2);
    expect(service.content()).toEqual(content);
    expect(service.error()).toBeNull();
  });

  it('deduplicates concurrent load calls to one active request', async () => {
    const content = makeValidatedContent();
    let resolveLoad!: (value: ValidatedMvpContent) => void;
    const pendingLoad = new Promise<ValidatedMvpContent>((resolve) => {
      resolveLoad = resolve;
    });

    repository.load.and.returnValue(pendingLoad);

    const loadA = service.loadContent();
    const loadB = service.loadContent();

    expect(repository.load).toHaveBeenCalledTimes(1);
    expect(service.loading()).toBeTrue();

    resolveLoad(content);
    await Promise.all([loadA, loadB]);

    expect(service.content()).toEqual(content);
    expect(service.loading()).toBeFalse();
  });

  it('does not refetch after a successful load in the same app session', async () => {
    const content = makeValidatedContent();
    repository.load.and.resolveTo(content);

    await service.loadContent();
    await service.loadContent();

    expect(repository.load).toHaveBeenCalledTimes(1);
  });

  it('never falls back to inherited content when loading fails', async () => {
    repository.load.and.rejectWith(new Error('no content'));

    await service.loadContent();

    expect(service.content()).toBeNull();
    expect(service.error()).toBeTruthy();
    expect(repository.load).toHaveBeenCalledTimes(1);
  });

  it('keeps loading true until in-flight load settles', async () => {
    const content = makeValidatedContent();
    let resolveLoad!: (value: ValidatedMvpContent) => void;
    const pendingLoad = new Promise<ValidatedMvpContent>((resolve) => {
      resolveLoad = resolve;
    });

    repository.load.and.returnValue(pendingLoad);

    const pending = service.loadContent();
    expect(service.loading()).toBeTrue();

    resolveLoad(content);
    await pending;

    expect(service.loading()).toBeFalse();
  });
});
