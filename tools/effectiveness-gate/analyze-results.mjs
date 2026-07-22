#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ACTIONABLE_START_VERBS = [
  'use',
  'start',
  'open',
  'run',
  'write',
  'check',
  'set',
  'create',
  'draft',
  'review',
  'ship',
  'fix',
  'implement',
  'begin',
  'do',
];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function parseArgs(argv) {
  const [mode, ...rest] = argv;
  const args = { mode, input: null, output: null, seed: 20260722 };

  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];
    if (token === '--input') {
      args.input = rest[i + 1] ?? null;
      i += 1;
      continue;
    }
    if (token === '--out') {
      args.output = rest[i + 1] ?? null;
      i += 1;
      continue;
    }
    if (token === '--seed') {
      const value = Number(rest[i + 1]);
      assert(Number.isInteger(value), 'Seed must be an integer.');
      args.seed = value;
      i += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${token}`);
  }

  return args;
}

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

function writeJson(filePath, data) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

export function countWords(text) {
  const trimmed = String(text ?? '').trim();
  if (!trimmed) {
    return 0;
  }
  return trimmed.split(/\s+/).length;
}

export function countChars(text) {
  return String(text ?? '').length;
}

export function countBullets(text) {
  const lines = String(text ?? '').split(/\r?\n/);
  return lines.filter((line) => /^\s*([-*•])\s+/.test(line.trimStart())).length;
}

export function countNumberedSections(text) {
  const lines = String(text ?? '').split(/\r?\n/);
  return lines.filter((line) => /^\s*\d+[.)]\s+/.test(line)).length;
}

export function countQuestionMarks(text) {
  const matches = String(text ?? '').match(/\?/g);
  return matches ? matches.length : 0;
}

export function startsWithActionableStep(text) {
  const lines = String(text ?? '').split(/\r?\n/);
  const first = lines.find((line) => line.trim().length > 0);
  if (!first) {
    return false;
  }

  const cleaned = first.trim().replace(/^[-*•]\s+/, '').replace(/^\d+[.)]\s+/, '');
  const firstWord = cleaned.split(/\s+/)[0]?.toLowerCase() ?? '';
  return ACTIONABLE_START_VERBS.includes(firstWord);
}

export function hasExplicitRecommendation(text) {
  return /\b(recommend|recommendation|i suggest|best option|you should)\b/i.test(String(text ?? ''));
}

export function hasExplicitAssumption(text) {
  return /\b(assum(e|ing|ption)|i\s+am\s+assuming|i'm\s+assuming|given\s+that)\b/i.test(String(text ?? ''));
}

export function hasMultiSectionFramework(text) {
  return countNumberedSections(text) >= 2;
}

export function seededShuffle(input, seed) {
  const out = [...input];
  let state = seed >>> 0;

  function rand() {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }

  return out;
}

function metricForResponse(response) {
  const rawText = String(response.rawText ?? '');
  const wordCount = countWords(rawText);
  const bulletCount = countBullets(rawText);
  const numberedSectionCount = countNumberedSections(rawText);
  const questionCount = countQuestionMarks(rawText);
  const capRule = response.capRule ?? {};
  const maxWords = Number.isFinite(capRule.maxWords) ? capRule.maxWords : null;
  const maxBullets = Number.isFinite(capRule.maxBullets) ? capRule.maxBullets : null;
  const disallowNumbered = capRule.disallowNumberedMultiSection === true;

  const exceedsWordCap = maxWords !== null ? wordCount > maxWords : false;
  const exceedsBulletCap = maxBullets !== null ? bulletCount > maxBullets : false;
  const numberedViolation = disallowNumbered ? numberedSectionCount > 0 : false;

  return {
    wordCount,
    charCount: countChars(rawText),
    bulletCount,
    numberedSectionCount,
    questionCount,
    startsWithActionableStep: startsWithActionableStep(rawText),
    recommendationExplicit: hasExplicitRecommendation(rawText),
    assumptionExplicit: hasExplicitAssumption(rawText),
    moreThanOneQuestion: questionCount > 1,
    multiSectionFramework: hasMultiSectionFramework(rawText),
    exceedsStatedCap: exceedsWordCap || exceedsBulletCap || numberedViolation,
    capViolationDetails: {
      exceedsWordCap,
      exceedsBulletCap,
      numberedViolation,
    },
  };
}

function validateManual(manual, context) {
  const requiredNumeric = ['easierToActOn', 'appropriateDetail', 'followedPreference'];
  for (const key of requiredNumeric) {
    const value = manual?.[key];
    assert(Number.isInteger(value) && value >= 1 && value <= 5, `${context}: manual.${key} must be an integer from 1 to 5.`);
  }

  const requiredBoolean = ['unnecessaryInterference', 'visibleImprovementOverWithout'];
  for (const key of requiredBoolean) {
    const value = manual?.[key];
    assert(typeof value === 'boolean', `${context}: manual.${key} must be boolean.`);
  }

  assert(typeof manual?.notes === 'string', `${context}: manual.notes must be a string.`);
}

function validateResultsInput(data) {
  assert(data && typeof data === 'object', 'Results root must be an object.');
  assert(data.version === 'mvp-effectiveness-gate-v2', 'Unsupported results version.');
  assert(Array.isArray(data.cases), 'Results must include cases array.');

  for (const [index, caseRun] of data.cases.entries()) {
    const context = `cases[${index}]`;
    assert(typeof caseRun.caseId === 'string' && caseRun.caseId.length > 0, `${context}: missing caseId.`);
    assert(Array.isArray(caseRun.responses) && caseRun.responses.length === 3, `${context}: responses must contain exactly three entries.`);

    for (const [responseIndex, response] of caseRun.responses.entries()) {
      const responseContext = `${context}.responses[${responseIndex}]`;
      assert(typeof response.label === 'string' && response.label.length > 0, `${responseContext}: label is required.`);
      assert(typeof response.rawText === 'string', `${responseContext}: rawText must be a string.`);
      validateManual(response.manual, responseContext);
    }
  }
}

export function createReviewPacket({ casesData, conditionsData, seed }) {
  const conditionIds = conditionsData.conditions.map((c) => c.id);
  const labels = ['A', 'B', 'C'];
  assert(conditionIds.length === labels.length, 'Conditions file must define exactly three conditions.');

  const runs = casesData.cases.map((caseDef, caseIndex) => {
    const shuffled = seededShuffle(conditionIds, seed + caseIndex);
    const labelMap = Object.fromEntries(labels.map((label, i) => [label, shuffled[i]]));

    return {
      caseId: caseDef.id,
      prompt: caseDef.prompt,
      labels: labelMap,
      reviewerWorksheet: labels.map((label) => ({
        label,
        rawText: '',
        manual: {
          easierToActOn: null,
          appropriateDetail: null,
          followedPreference: null,
          unnecessaryInterference: null,
          visibleImprovementOverWithout: null,
          notes: '',
        },
      })),
    };
  });

  return {
    version: 'mvp-effectiveness-gate-v2',
    generatedAtIso: new Date().toISOString(),
    seed,
    runs,
    answerKey: runs.map((r) => ({ caseId: r.caseId, labels: r.labels })),
  };
}

export function analyzeResults(data) {
  validateResultsInput(data);

  const perCase = data.cases.map((caseRun) => {
    const responses = caseRun.responses.map((response) => ({
      label: response.label,
      metrics: metricForResponse(response),
      manual: response.manual,
      rawText: response.rawText,
      conditionId: caseRun.labels?.[response.label] ?? null,
    }));

    return {
      caseId: caseRun.caseId,
      profileId: caseRun.profileId ?? null,
      capacity: caseRun.capacity ?? null,
      responses,
    };
  });

  const aggregate = {
    totalCases: perCase.length,
    totalResponses: perCase.reduce((sum, c) => sum + c.responses.length, 0),
    capViolations: 0,
    moreThanOneQuestionResponses: 0,
    averageManualScores: {
      easierToActOn: 0,
      appropriateDetail: 0,
      followedPreference: 0,
    },
    failures: [],
    ambiguous: [],
  };

  let scoreCount = 0;
  let scoreTotals = {
    easierToActOn: 0,
    appropriateDetail: 0,
    followedPreference: 0,
  };

  for (const caseSummary of perCase) {
    for (const response of caseSummary.responses) {
      const metrics = response.metrics;
      if (metrics.exceedsStatedCap) {
        aggregate.capViolations += 1;
        aggregate.failures.push(`${caseSummary.caseId}:${response.label}: cap violation`);
      }
      if (metrics.moreThanOneQuestion) {
        aggregate.moreThanOneQuestionResponses += 1;
      }

      scoreTotals.easierToActOn += response.manual.easierToActOn;
      scoreTotals.appropriateDetail += response.manual.appropriateDetail;
      scoreTotals.followedPreference += response.manual.followedPreference;
      scoreCount += 1;

      if (response.manual.unnecessaryInterference) {
        aggregate.failures.push(`${caseSummary.caseId}:${response.label}: unnecessary interference`);
      }

      if (!response.manual.visibleImprovementOverWithout && response.conditionId !== 'WITHOUT') {
        aggregate.ambiguous.push(`${caseSummary.caseId}:${response.label}: no visible improvement over WITHOUT`);
      }
    }
  }

  if (scoreCount > 0) {
    aggregate.averageManualScores = {
      easierToActOn: Number((scoreTotals.easierToActOn / scoreCount).toFixed(3)),
      appropriateDetail: Number((scoreTotals.appropriateDetail / scoreCount).toFixed(3)),
      followedPreference: Number((scoreTotals.followedPreference / scoreCount).toFixed(3)),
    };
  }

  return {
    version: 'mvp-effectiveness-gate-v2',
    generatedAtIso: new Date().toISOString(),
    metadata: data.metadata ?? null,
    perCase,
    aggregate,
    notes: [
      'No statistical significance is claimed by this report.',
      'Objective metrics include heuristics; manual review remains required.',
    ],
  };
}

function printSummary(report) {
  console.log('Effectiveness Gate Analysis Summary');
  console.log(`- Cases: ${report.aggregate.totalCases}`);
  console.log(`- Responses: ${report.aggregate.totalResponses}`);
  console.log(`- Cap violations: ${report.aggregate.capViolations}`);
  console.log(`- >1 question responses: ${report.aggregate.moreThanOneQuestionResponses}`);
  console.log(`- Avg easierToActOn: ${report.aggregate.averageManualScores.easierToActOn}`);
  console.log(`- Avg appropriateDetail: ${report.aggregate.averageManualScores.appropriateDetail}`);
  console.log(`- Avg followedPreference: ${report.aggregate.averageManualScores.followedPreference}`);
  console.log(`- Failures: ${report.aggregate.failures.length}`);
  console.log(`- Ambiguous: ${report.aggregate.ambiguous.length}`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.mode === 'prepare') {
    const casesPath = path.resolve('tools/effectiveness-gate/cases.json');
    const conditionsPath = path.resolve('tools/effectiveness-gate/conditions.json');
    const casesData = readJson(casesPath);
    const conditionsData = readJson(conditionsPath);
    const packet = createReviewPacket({ casesData, conditionsData, seed: args.seed });
    const outputPath = path.resolve(args.output ?? 'tools/effectiveness-gate/review-packet.json');
    writeJson(outputPath, packet);
    console.log(`Prepared review packet: ${outputPath}`);
    return;
  }

  if (args.mode === 'analyze') {
    const inputPath = path.resolve(args.input ?? 'tools/effectiveness-gate/results-template.json');
    const data = readJson(inputPath);
    const report = analyzeResults(data);
    printSummary(report);
    if (args.output) {
      const outputPath = path.resolve(args.output);
      writeJson(outputPath, report);
      console.log(`Wrote analysis report: ${outputPath}`);
    }
    return;
  }

  throw new Error('Usage: analyze-results.mjs <prepare|analyze> [--seed N] [--input file] [--out file]');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
