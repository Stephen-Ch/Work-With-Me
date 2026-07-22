import assert from 'node:assert/strict';
import test from 'node:test';
import {
  analyzeResults,
  countBullets,
  countNumberedSections,
  countQuestionMarks,
  countWords,
  createReviewPacket,
  seededShuffle,
} from './analyze-results.mjs';

function makeValidResults() {
  return {
    version: 'mvp-effectiveness-gate-v2',
    metadata: {
      runId: 'test-run',
      runDate: '2026-07-22',
      reviewer: 'tester',
      assistantPlatform: 'ChatGPT',
      modelName: 'test-model',
      webEnabled: false,
      toolsEnabled: false,
      activeSystemOrCustomInstructions: 'none',
    },
    cases: [
      {
        caseId: 'C01',
        profileId: 'A',
        capacity: 'none',
        labels: {
          A: 'WITHOUT',
          B: 'CURRENT',
          C: 'CANDIDATE_HARD_CAP',
        },
        responses: [
          {
            label: 'A',
            rawText: 'Start with one clear step.\n- Do X\n- Do Y',
            capRule: {
              maxWords: null,
              maxBullets: null,
              disallowNumberedMultiSection: false,
            },
            manual: {
              easierToActOn: 3,
              appropriateDetail: 3,
              followedPreference: 3,
              unnecessaryInterference: false,
              visibleImprovementOverWithout: false,
              notes: 'baseline',
            },
          },
          {
            label: 'B',
            rawText: 'Use this approach. I recommend option A.',
            capRule: {
              maxWords: null,
              maxBullets: null,
              disallowNumberedMultiSection: false,
            },
            manual: {
              easierToActOn: 4,
              appropriateDetail: 4,
              followedPreference: 4,
              unnecessaryInterference: false,
              visibleImprovementOverWithout: true,
              notes: 'better',
            },
          },
          {
            label: 'C',
            rawText: '- Step 1\n- Step 2',
            capRule: {
              maxWords: 100,
              maxBullets: 5,
              disallowNumberedMultiSection: true,
            },
            manual: {
              easierToActOn: 4,
              appropriateDetail: 4,
              followedPreference: 4,
              unnecessaryInterference: false,
              visibleImprovementOverWithout: true,
              notes: 'short',
            },
          },
        ],
      },
    ],
  };
}

test('countWords handles whitespace and tokens', () => {
  assert.equal(countWords(''), 0);
  assert.equal(countWords('  alpha   beta\n gamma  '), 3);
});

test('countBullets detects list bullets only', () => {
  const text = '- a\n* b\n• c\n1. not bullet';
  assert.equal(countBullets(text), 3);
});

test('countNumberedSections detects numbered lines', () => {
  const text = '1. one\n2) two\n- three';
  assert.equal(countNumberedSections(text), 2);
});

test('countQuestionMarks returns exact count', () => {
  assert.equal(countQuestionMarks('What? Why?'), 2);
  assert.equal(countQuestionMarks('No questions.'), 0);
});

test('analyzeResults fails on malformed input', () => {
  assert.throws(() => analyzeResults({}), /Unsupported results version/);
});

test('analyzeResults fails when manual fields are missing', () => {
  const bad = makeValidResults();
  delete bad.cases[0].responses[0].manual.followedPreference;
  assert.throws(() => analyzeResults(bad), /manual\.followedPreference/);
});

test('analyzeResults preserves raw response text', () => {
  const input = makeValidResults();
  const report = analyzeResults(input);
  assert.equal(report.perCase[0].responses[0].rawText, input.cases[0].responses[0].rawText);
});

test('seededShuffle is deterministic for same seed', () => {
  const values = ['WITHOUT', 'CURRENT', 'CANDIDATE_HARD_CAP'];
  const first = seededShuffle(values, 42);
  const second = seededShuffle(values, 42);
  assert.deepEqual(first, second);
});

test('createReviewPacket maps exactly three randomized labels', () => {
  const packet = createReviewPacket({
    casesData: {
      cases: [
        { id: 'C01', prompt: 'one' },
        { id: 'C02', prompt: 'two' },
      ],
    },
    conditionsData: {
      conditions: [
        { id: 'WITHOUT' },
        { id: 'CURRENT' },
        { id: 'CANDIDATE_HARD_CAP' },
      ],
    },
    seed: 99,
  });

  assert.equal(packet.runs.length, 2);
  for (const run of packet.runs) {
    assert.deepEqual(Object.keys(run.labels).sort(), ['A', 'B', 'C']);
  }
});

test('analyzer has no network dependency during analysis', () => {
  const input = makeValidResults();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => {
    throw new Error('network call should not happen');
  };

  try {
    const report = analyzeResults(input);
    assert.equal(report.aggregate.totalCases, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
