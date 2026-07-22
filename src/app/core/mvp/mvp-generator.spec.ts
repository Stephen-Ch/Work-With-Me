import rawMvpContent from '../../../assets/content/mvp-content.json';
import { validateMvpContent } from './mvp-content.repository';
import {
  composeInstructionsForCopy,
  countWords,
  generateCapacityModifier,
  generatePermanentPrompt,
  MvpGenerationError,
  validateProfile,
} from './mvp-generator';
import { CapacityId, OptionCode, PermanentQuestionId, PermanentSelections } from './mvp.types';

const FORBIDDEN_TERMS = [
  'ADHD',
  'burnout',
  'neurotypical',
  'diagnosis',
  'diagnose',
  'diagnostic',
  'disorder',
  'impairment',
  'disability',
  'disabled',
  'medical condition',
  'mental health condition',
];

function toRegex(term: string): RegExp {
  return new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
}

function hasForbiddenTerms(text: string): string[] {
  return FORBIDDEN_TERMS.filter((term) => toRegex(term).test(text));
}

function loadContent() {
  const result = validateMvpContent(rawMvpContent);
  if (!result.valid || !result.value) {
    throw new Error(`Fixture validation failed: ${JSON.stringify(result.errors)}`);
  }
  return result.value;
}

function allProfiles(order: readonly PermanentQuestionId[]): PermanentSelections[] {
  const codes: OptionCode[] = ['A', 'B', 'C'];
  const profiles: PermanentSelections[] = [];

  const walk = (index: number, current: Partial<Record<PermanentQuestionId, OptionCode>>) => {
    if (index === order.length) {
      profiles.push(current as PermanentSelections);
      return;
    }

    const questionId = order[index];
    for (const code of codes) {
      walk(index + 1, { ...current, [questionId]: code });
    }
  };

  walk(0, {});
  return profiles;
}

function expectedSegmentsForProfile(
  profile: PermanentSelections,
  order: readonly PermanentQuestionId[],
  content: ReturnType<typeof loadContent>
): string[] {
  return [
    content.sharedOpening,
    ...order.map((questionId) => content.questions[questionId].options[profile[questionId]].moduleText),
    content.sharedClosing,
  ];
}

describe('mvp-generator', () => {
  it('validates profile with structured result fields', () => {
    const content = loadContent();

    const valid = validateProfile(
      {
        'starting-work': 'A',
        'information-load': 'B',
        'decision-support': 'C',
        'side-topics': 'A',
        'interruption-recovery': 'B',
      },
      content
    );

    expect(valid.valid).toBeTrue();
    expect(valid.missingQuestionIds).toEqual([]);
    expect(valid.unknownQuestionIds).toEqual([]);
    expect(valid.unknownOptionCodes).toEqual([]);
  });

  it('detects missing and unknown question ids plus invalid option codes', () => {
    const content = loadContent();

    const result = validateProfile(
      {
        'starting-work': 'A',
        'information-load': 'B',
        'decision-support': 'Z',
        'unexpected-question': 'A',
      },
      content
    );

    expect(result.valid).toBeFalse();
    expect(result.missingQuestionIds).toEqual(['side-topics', 'interruption-recovery']);
    expect(result.unknownQuestionIds).toEqual(['unexpected-question']);
    expect(result.unknownOptionCodes).toEqual(['decision-support:Z']);
  });

  it('treats malformed selection containers as invalid runtime input', () => {
    const content = loadContent();
    const malformedInputs: unknown[] = [null, undefined, 42, true, 'abc', ['A', 'B'], () => ({})];

    for (const malformed of malformedInputs) {
      const result = validateProfile(malformed, content);
      expect(result.valid).withContext(String(malformed)).toBeFalse();
      expect(result.missingQuestionIds).toEqual(content.questionOrder);
    }
  });

  it('assembles deterministic prompt result with exact three-line formatting', () => {
    const content = loadContent();
    const profile: PermanentSelections = {
      'starting-work': 'B',
      'information-load': 'B',
      'decision-support': 'B',
      'side-topics': 'B',
      'interruption-recovery': 'B',
    };

    const result = generatePermanentPrompt(profile, content) as unknown as {
      prompt: string;
      segments: readonly string[];
      wordCount: number;
      targetRangeStatus: 'below-target' | 'within-target' | 'above-target';
    };

    const expectedSegments = expectedSegmentsForProfile(profile, content.questionOrder, content);
    const expectedPrompt = `${expectedSegments[0]}\n${expectedSegments.slice(1, 6).join(' ')}\n${expectedSegments[6]}`;

    expect(Array.isArray(result.segments)).toBeTrue();
    expect(result.segments.length).toBe(7);
    expect(result.segments).toEqual(expectedSegments);
    expect(result.prompt).toBe(expectedPrompt);
    expect(result.prompt.startsWith(' ')).toBeFalse();
    expect(result.prompt.endsWith(' ')).toBeFalse();
    expect(result.prompt.includes('\n\n')).toBeFalse();

    const lines = result.prompt.split('\n');
    expect(lines.length).toBe(3);
    expect(lines[0]).toBe(content.sharedOpening);
    expect(lines[1]).toBe(expectedSegments.slice(1, 6).join(' '));
    expect(lines[2]).toBe(content.sharedClosing);
    expect(lines[1].includes('  ')).toBeFalse();

    expect(result.wordCount).toBe(countWords(result.prompt));
    expect(result.targetRangeStatus).toBe('within-target');
  });

  it('returns null or exact authored capacity modifier strings', () => {
    const content = loadContent();

    expect(generateCapacityModifier('usual', content)).toBeNull();
    expect(generateCapacityModifier('limited', content)).toBe(
      'For this session, keep responses compact and practical. Give the smallest useful answer first, trim optional detail, and expand only if I ask.'
    );
    expect(generateCapacityModifier('very-limited', content)).toBe(
      'For this session, use essentials-only responses. Give one actionable step at a time, avoid extra options by default, and add depth only if I request it.'
    );
  });

  it('composes copy instructions with exact separator behavior', () => {
    const permanentPrompt = 'line one\nline two\nline three';
    const limitedModifier =
      'For this session, keep responses compact and practical. Give the smallest useful answer first, trim optional detail, and expand only if I ask.';
    const veryLimitedModifier =
      'For this session, use essentials-only responses. Give one actionable step at a time, avoid extra options by default, and add depth only if I request it.';

    expect(composeInstructionsForCopy(permanentPrompt, null)).toBe(permanentPrompt);
    expect(composeInstructionsForCopy(permanentPrompt, '')).toBe(permanentPrompt);

    const limitedComposed = composeInstructionsForCopy(permanentPrompt, limitedModifier);
    expect(limitedComposed).toBe(`${permanentPrompt}\n\n${limitedModifier}`);
    expect(limitedComposed.endsWith('\n')).toBeFalse();
    expect(limitedComposed.split(limitedModifier).length - 1).toBe(1);

    const veryLimitedComposed = composeInstructionsForCopy(permanentPrompt, veryLimitedModifier);
    expect(veryLimitedComposed).toBe(`${permanentPrompt}\n\n${veryLimitedModifier}`);
    expect(veryLimitedComposed.endsWith('\n')).toBeFalse();

    expect(permanentPrompt).toBe('line one\nline two\nline three');
  });

  it('counts words canonically for edge cases', () => {
    expect(countWords('')).toBe(0);
    expect(countWords('   \t\n   ')).toBe(0);
    expect(countWords('normal sentence')).toBe(2);
    expect(countWords('many   spaces   here')).toBe(3);
    expect(countWords('tabs\tbetween\ttokens')).toBe(3);
    expect(countWords('newlines\nbetween\nwords')).toBe(3);
    expect(countWords('...')).toBe(1);
    expect(countWords('alpha — omega')).toBe(3);
  });

  it('throws when permanent prompt exceeds hard maximum', () => {
    const content = loadContent();
    const longContent = {
      ...content,
      sharedOpening: `${content.sharedOpening} ${new Array(200).fill('x').join(' ')}`,
    };

    const profile: PermanentSelections = {
      'starting-work': 'A',
      'information-load': 'A',
      'decision-support': 'A',
      'side-topics': 'A',
      'interruption-recovery': 'A',
    };

    expect(() => generatePermanentPrompt(profile, longContent)).toThrowError(MvpGenerationError);
  });

  it('exhaustively validates all 243 permanent profiles', () => {
    const content = loadContent();
    const profiles = allProfiles(content.questionOrder);

    expect(profiles.length).toBe(243);

    let minWords = Number.POSITIVE_INFINITY;
    let maxWords = Number.NEGATIVE_INFINITY;
    let belowTarget = 0;
    let aboveTarget = 0;

    for (const profile of profiles) {
      const validation = validateProfile(profile, content);
      expect(validation.valid).toBeTrue();
      expect(validation.missingQuestionIds).toEqual([]);
      expect(validation.unknownQuestionIds).toEqual([]);
      expect(validation.unknownOptionCodes).toEqual([]);

      const result = generatePermanentPrompt(profile, content);
      const expectedSegments = expectedSegmentsForProfile(profile, content.questionOrder, content);
      const expectedPrompt = `${expectedSegments[0]}\n${expectedSegments.slice(1, 6).join(' ')}\n${expectedSegments[6]}`;

      minWords = Math.min(minWords, result.wordCount);
      maxWords = Math.max(maxWords, result.wordCount);

      if (result.wordCount < 90) {
        belowTarget += 1;
      }
      if (result.wordCount > 140) {
        aboveTarget += 1;
      }

      expect(result.segments.length).toBe(7);
      expect(result.segments).toEqual(expectedSegments);
      expect(result.prompt).toBe(expectedPrompt);
      expect(result.prompt.split('\n').length).toBe(3);
      expect(result.prompt).not.toContain('\n\n');
      expect(result.prompt.startsWith(' ')).toBeFalse();
      expect(result.prompt.endsWith(' ')).toBeFalse();
      expect(countWords(result.prompt)).toBe(result.wordCount);
      expect(result.wordCount).withContext(result.prompt).toBeLessThanOrEqual(180);
      expect(hasForbiddenTerms(result.prompt)).withContext(result.prompt).toEqual([]);

      if (profile['starting-work'] === 'C' && profile['information-load'] === 'C') {
        expect(result.prompt).toContain('Give the broader picture first, then recommend where to start.');
        expect(result.prompt).toContain('Provide fuller context in a clear, scannable structure.');
      }

      const expectedStatus =
        result.wordCount < 90
          ? 'below-target'
          : result.wordCount > 140
            ? 'above-target'
            : 'within-target';
      expect(result.targetRangeStatus).toBe(expectedStatus);
    }

    console.info(
      `[MVP] permanent profiles stats: total=${profiles.length}, minWords=${minWords}, maxWords=${maxWords}, below90=${belowTarget}, above140=${aboveTarget}`
    );

    expect(minWords).toBeGreaterThan(0);
    expect(maxWords).toBeLessThanOrEqual(180);
  });

  it('exhaustively validates all 729 profile-capacity combinations', () => {
    const content = loadContent();
    const profiles = allProfiles(content.questionOrder);
    const capacities: CapacityId[] = ['usual', 'limited', 'very-limited'];

    let combinations = 0;

    for (const profile of profiles) {
      const baseResult = generatePermanentPrompt(profile, content);
      expect(hasForbiddenTerms(baseResult.prompt)).toEqual([]);

      for (const capacityId of capacities) {
        combinations += 1;

        const rerender = generatePermanentPrompt(profile, content);
        expect(rerender.prompt).toBe(baseResult.prompt);
        expect(rerender.wordCount).toBe(baseResult.wordCount);
        expect(rerender.targetRangeStatus).toBe(baseResult.targetRangeStatus);
        expect(rerender.segments).toEqual(baseResult.segments);

        const modifier = generateCapacityModifier(capacityId, content);
        const composed = composeInstructionsForCopy(baseResult.prompt, modifier);

        if (capacityId === 'usual') {
          expect(modifier).toBeNull();
          expect(composed).toBe(baseResult.prompt);
          continue;
        }

        const forbidden = hasForbiddenTerms(modifier as string);
        expect(forbidden).withContext(`${capacityId} | ${modifier as string}`).toEqual([]);

        const words = countWords(modifier as string);
        expect(words).withContext(`${capacityId} modifier word count`).toBeGreaterThanOrEqual(20);
        expect(words).withContext(`${capacityId} modifier word count`).toBeLessThanOrEqual(40);

        expect(composed).toBe(`${baseResult.prompt}\n\n${modifier as string}`);
        expect(composed.startsWith(baseResult.prompt)).toBeTrue();
        expect(composed.endsWith(modifier as string)).toBeTrue();
        expect(composed.endsWith('\n')).toBeFalse();
      }

      expect(composeInstructionsForCopy(baseResult.prompt, null)).toBe(baseResult.prompt);
    }

    console.info(`[MVP] profile-capacity combinations validated: total=${combinations}`);

    expect(combinations).toBe(729);
  });
});
