import rawMvpContent from '../../../assets/content/mvp-content.json';
import { validateMvpContent } from './mvp-content.repository';
import {
  countWords,
  generateCapacityModifier,
  generatePermanentPrompt,
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

describe('mvp-generator', () => {
  it('validates profile completeness and option codes', () => {
    const content = loadContent();

    const invalid = validateProfile(
      {
        'starting-work': 'A',
        'information-load': 'B',
        'decision-support': 'C',
      },
      content
    );

    expect(invalid.valid).toBeFalse();
    expect(invalid.errors.length).toBe(2);

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
    expect(valid.errors).toEqual([]);
  });

  it('assembles a deterministic permanent prompt in fixed order', () => {
    const content = loadContent();
    const profile: PermanentSelections = {
      'starting-work': 'B',
      'information-load': 'B',
      'decision-support': 'B',
      'side-topics': 'B',
      'interruption-recovery': 'B',
    };

    const prompt = generatePermanentPrompt(profile, content);

    const expected = [
      content.sharedOpening,
      'Break the work into a short ordered plan with concrete actions.',
      'Start with a short summary, then add only the detail needed to act.',
      'Compare the main options and tradeoffs concisely before concluding.',
      'Briefly park useful side topics, then return to the current task.',
      'Give a brief recap, then provide the next step.',
      content.sharedClosing,
    ].join('\n');

    expect(prompt).toBe(expected);
    expect(countWords(prompt)).toBe(countWords(expected));
  });

  it('returns exact capacity modifier strings', () => {
    const content = loadContent();

    expect(generateCapacityModifier('usual', content)).toBe('');
    expect(generateCapacityModifier('limited', content)).toBe(
      'For this session, keep responses compact and practical. Give the smallest useful answer first, trim optional detail, and expand only if I ask.'
    );
    expect(generateCapacityModifier('very-limited', content)).toBe(
      'For this session, use essentials-only responses. Give one actionable step at a time, avoid extra options by default, and add depth only if I request it.'
    );
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

      const prompt = generatePermanentPrompt(profile, content);
      const words = countWords(prompt);

      minWords = Math.min(minWords, words);
      maxWords = Math.max(maxWords, words);

      if (words < 90) {
        belowTarget += 1;
      }
      if (words > 140) {
        aboveTarget += 1;
      }

      expect(words).withContext(prompt).toBeLessThanOrEqual(180);
      expect(hasForbiddenTerms(prompt)).withContext(prompt).toEqual([]);

      const lines = prompt.split('\n');
      expect(lines[0]).toBe(content.sharedOpening);
      expect(lines[lines.length - 1]).toBe(content.sharedClosing);
      expect(lines.length).toBe(7);
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
      const prompt = generatePermanentPrompt(profile, content);
      expect(hasForbiddenTerms(prompt)).toEqual([]);

      for (const capacityId of capacities) {
        combinations += 1;
        const modifier = generateCapacityModifier(capacityId, content);
        const forbidden = hasForbiddenTerms(modifier);
        expect(forbidden).withContext(`${capacityId} | ${modifier}`).toEqual([]);

        if (capacityId === 'usual') {
          expect(modifier).toBe('');
          continue;
        }

        const words = countWords(modifier);
        expect(words).withContext(`${capacityId} modifier word count`).toBeGreaterThanOrEqual(20);
        expect(words).withContext(`${capacityId} modifier word count`).toBeLessThanOrEqual(40);
      }
    }

    console.info(`[MVP] profile-capacity combinations validated: total=${combinations}`);

    expect(combinations).toBe(729);
  });
});
