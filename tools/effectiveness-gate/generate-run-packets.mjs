#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';

const RUN_ID = 'wwm-effectiveness-v2-2026-07';
const PROTOCOL_VERSION = 'mvp-effectiveness-gate-v2';
const FIXED_SEED = 20260722;
const PLATFORMS = ['chatgpt', 'claude'];
const ROOT = process.cwd();

const RUN_ROOT = path.join(ROOT, 'docs', 'validation', 'runs', RUN_ID);
const PACKETS_ROOT = path.join(RUN_ROOT, 'packets');
const RAW_ROOT = path.join(RUN_ROOT, 'raw');
const SCORING_ROOT = path.join(RUN_ROOT, 'scoring');
const ANALYSIS_ROOT = path.join(RUN_ROOT, 'analysis');
const LOCAL_ROOT = path.join(ROOT, '.local', 'effectiveness-gate');
const ANSWER_KEY_PATH = path.join(LOCAL_ROOT, `${RUN_ID}-answer-key.json`);

const CASES_PATH = path.join(ROOT, 'tools', 'effectiveness-gate', 'cases.json');
const CONDITIONS_PATH = path.join(ROOT, 'tools', 'effectiveness-gate', 'conditions.json');
const CONTENT_PATH = path.join(ROOT, 'src', 'assets', 'content', 'mvp-content.json');

const PROFILE_ID_TO_QUESTION_IDS = {
  Q1: 'starting-work',
  Q2: 'information-load',
  Q3: 'decision-support',
  Q4: 'side-topics',
  Q5: 'interruption-recovery',
};

const CAPACITY_TO_ID = {
  none: null,
  limited: 'limited',
  'very-limited': 'very-limited',
};

const CASE_PLAN = {
  C01: { profileId: 'A', capacity: 'none' },
  C02: { profileId: 'A', capacity: 'limited' },
  C03: { profileId: 'C', capacity: 'none' },
  C04: { profileId: 'B', capacity: 'limited' },
  C05: { profileId: 'B', capacity: 'none' },
  C06: { profileId: 'C', capacity: 'very-limited' },
  C07: { profileId: 'A', capacity: 'very-limited' },
  C08: { profileId: 'C', capacity: 'none' },
};

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeText(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value, 'utf8');
}

function sha256File(filePath) {
  const data = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(data).digest('hex');
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function seededShuffle(values, seed) {
  const out = [...values];
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

function toSelections(profileAnswers) {
  return {
    [PROFILE_ID_TO_QUESTION_IDS.Q1]: profileAnswers.Q1,
    [PROFILE_ID_TO_QUESTION_IDS.Q2]: profileAnswers.Q2,
    [PROFILE_ID_TO_QUESTION_IDS.Q3]: profileAnswers.Q3,
    [PROFILE_ID_TO_QUESTION_IDS.Q4]: profileAnswers.Q4,
    [PROFILE_ID_TO_QUESTION_IDS.Q5]: profileAnswers.Q5,
  };
}

function buildPermanentPrompt(content, selections, q2OverrideOrNull = null) {
  const orderedIds = content.questionOrder;
  const modules = orderedIds.map((questionId) => {
    const code = selections[questionId];
    const question = content.questions.find((q) => q.id === questionId);
    assert(question, `Missing question in content: ${questionId}`);
    const option = question.options.find((o) => o.code === code);
    assert(option, `Missing option ${code} for question ${questionId}`);
    const moduleText = option.moduleText;
    if (questionId === 'information-load' && q2OverrideOrNull !== null) {
      return q2OverrideOrNull;
    }
    return moduleText;
  });

  return `${content.sharedOpening}\n${modules.join(' ')}\n${content.sharedClosing}`;
}

function composeForCopy(permanentPrompt, capacityModifier) {
  if (!capacityModifier) {
    return permanentPrompt;
  }
  return `${permanentPrompt}\n\n${capacityModifier}`;
}

function getCapacityModifier(content, capacity) {
  if (capacity === 'none') {
    return null;
  }
  const id = CAPACITY_TO_ID[capacity];
  const capacityDef = content.capacities.find((c) => c.id === id);
  assert(capacityDef, `Missing capacity in content: ${id}`);
  return capacityDef.modifier;
}

function buildInstructionBlock(conditionId, context) {
  if (conditionId === 'WITHOUT') {
    return null;
  }

  const currentPrompt = buildPermanentPrompt(context.content, context.selections, null);
  const currentComposed = composeForCopy(currentPrompt, context.capacityModifier);

  if (conditionId === 'CURRENT') {
    return currentComposed;
  }

  if (conditionId === 'CANDIDATE_HARD_CAP') {
    const hasQ2A = context.profile.answers.Q2 === 'A';
    const q2Override = hasQ2A ? context.candidateWording : null;
    const candidatePrompt = buildPermanentPrompt(context.content, context.selections, q2Override);
    return composeForCopy(candidatePrompt, context.capacityModifier);
  }

  throw new Error(`Unknown condition: ${conditionId}`);
}

function ensureCleanRunDirs() {
  const dirs = [RUN_ROOT, LOCAL_ROOT];
  for (const dir of dirs) {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }

  fs.mkdirSync(RUN_ROOT, { recursive: true });
  fs.mkdirSync(PACKETS_ROOT, { recursive: true });
  fs.mkdirSync(RAW_ROOT, { recursive: true });
  fs.mkdirSync(SCORING_ROOT, { recursive: true });
  fs.mkdirSync(ANALYSIS_ROOT, { recursive: true });
  fs.mkdirSync(LOCAL_ROOT, { recursive: true });

  for (const platform of PLATFORMS) {
    fs.mkdirSync(path.join(PACKETS_ROOT, platform), { recursive: true });
    fs.mkdirSync(path.join(RAW_ROOT, platform), { recursive: true });
  }
}

function buildRunArtifacts() {
  const casesData = readJson(CASES_PATH);
  const conditionsData = readJson(CONDITIONS_PATH);
  const contentData = readJson(CONTENT_PATH);

  assert(casesData.version === PROTOCOL_VERSION, 'cases.json version mismatch');
  assert(conditionsData.version === PROTOCOL_VERSION, 'conditions.json version mismatch');
  assert(Array.isArray(casesData.cases) && casesData.cases.length === 8, 'Expected exactly 8 cases');
  assert(Array.isArray(conditionsData.conditions) && conditionsData.conditions.length === 3, 'Expected exactly 3 conditions');
  assert(Array.isArray(conditionsData.profiles) && conditionsData.profiles.length === 3, 'Expected exactly 3 profiles');

  const conditionIds = conditionsData.conditions.map((c) => c.id);
  const labels = ['A', 'B', 'C'];
  const candidate = conditionsData.conditions.find((c) => c.id === 'CANDIDATE_HARD_CAP');
  assert(candidate, 'Missing CANDIDATE_HARD_CAP condition');

  const profileById = new Map(conditionsData.profiles.map((p) => [p.id, p]));

  const packets = [];
  const answerKey = [];

  for (let platformIndex = 0; platformIndex < PLATFORMS.length; platformIndex += 1) {
    const platform = PLATFORMS[platformIndex];

    for (let caseIndex = 0; caseIndex < casesData.cases.length; caseIndex += 1) {
      const caseDef = casesData.cases[caseIndex];
      const plan = CASE_PLAN[caseDef.id];
      assert(plan, `Missing case plan for ${caseDef.id}`);

      const profile = profileById.get(plan.profileId);
      assert(profile, `Missing profile ${plan.profileId}`);

      const selections = toSelections(profile.answers);
      const capacityModifier = getCapacityModifier(contentData, plan.capacity);
      const context = {
        content: contentData,
        profile,
        selections,
        capacityModifier,
        candidateWording: candidate.candidateWording,
      };

      const shuffledConditions = seededShuffle(conditionIds, FIXED_SEED + platformIndex * 1000 + caseIndex);
      const labelToCondition = Object.fromEntries(labels.map((label, idx) => [label, shuffledConditions[idx]]));

      answerKey.push({
        platform,
        caseId: caseDef.id,
        labels: labelToCondition,
      });

      for (const label of labels) {
        const packetId = `${platform}-${caseDef.id}-${label}`;
        const rawFile = `${packetId}.md`;
        const conditionId = labelToCondition[label];
        const instructionBlock = buildInstructionBlock(conditionId, context);

        const packet = {
          runId: RUN_ID,
          protocolVersion: PROTOCOL_VERSION,
          packetId,
          platform,
          caseId: caseDef.id,
          caseTitle: caseDef.title,
          blindedLabel: label,
          profileId: plan.profileId,
          capacity: plan.capacity,
          messageOrder: instructionBlock === null
            ? [
                {
                  step: 1,
                  type: 'prompt',
                  text: caseDef.prompt,
                },
              ]
            : [
                {
                  step: 1,
                  type: 'instruction',
                  text: instructionBlock,
                },
                {
                  step: 2,
                  type: 'prompt',
                  text: caseDef.prompt,
                },
              ],
          destinationRawFile: path.join('docs', 'validation', 'runs', RUN_ID, 'raw', platform, rawFile).replaceAll('\\', '/'),
          collectionMetadataTemplate: {
            platform,
            modelLabel: '',
            localDateTime: '',
            packetId,
            caseId: caseDef.id,
            blindedLabel: label,
            webEnabled: 'yes/no',
            toolsEnabled: 'yes/no',
            memoryOrCustomInstructionsDisabled: 'yes/no/unknown',
            responseRegenerated: 'no',
            technicalError: 'yes/no',
            retryReference: '',
            collectorNotes: '',
          },
        };

        packets.push({ ...packet, _conditionId: conditionId, _prompt: caseDef.prompt, _instructionBlock: instructionBlock });

        const packetPath = path.join(PACKETS_ROOT, platform, `${packetId}.json`);
        writeJson(packetPath, packet);
      }
    }
  }

  return {
    packets,
    answerKey,
    candidateWording: candidate.candidateWording,
  };
}

function validatePackets({ packets, answerKey }) {
  assert(packets.length === 48, 'Expected exactly 48 packet runs.');

  const byPlatformCase = new Map();
  for (const packet of packets) {
    const key = `${packet.platform}::${packet.caseId}`;
    if (!byPlatformCase.has(key)) {
      byPlatformCase.set(key, []);
    }
    byPlatformCase.get(key).push(packet);
  }

  assert(byPlatformCase.size === 16, 'Expected 16 platform-case groups (8 cases x 2 platforms).');

  for (const [key, group] of byPlatformCase.entries()) {
    assert(group.length === 3, `Expected 3 packets for ${key}`);
    const labels = group.map((g) => g.blindedLabel).sort().join(',');
    assert(labels === 'A,B,C', `Expected A/B/C exactly once for ${key}`);

    const conditionIds = group.map((g) => g._conditionId).sort().join(',');
    assert(conditionIds === 'CANDIDATE_HARD_CAP,CURRENT,WITHOUT', `Expected each true condition once for ${key}`);

    const prompts = new Set(group.map((g) => g._prompt));
    assert(prompts.size === 1, `Prompt mismatch across conditions for ${key}`);

    const current = group.find((g) => g._conditionId === 'CURRENT');
    const candidate = group.find((g) => g._conditionId === 'CANDIDATE_HARD_CAP');
    const without = group.find((g) => g._conditionId === 'WITHOUT');

    assert(without._instructionBlock === null, `WITHOUT must contain no instruction block for ${key}`);

    if (group[0].profileId === 'A') {
      assert(current._instructionBlock !== candidate._instructionBlock, `Candidate must differ from current for profile A in ${key}`);
    } else {
      assert(current._instructionBlock === candidate._instructionBlock, `Candidate must match current when Q2-A is not active in ${key}`);
    }

    const hasConditionLeak = group.some((g) => /WITHOUT|CURRENT|CANDIDATE/i.test(g.packetId));
    assert(!hasConditionLeak, `Packet IDs must not reveal true condition for ${key}`);
  }

  const rawPaths = packets.map((p) => p.destinationRawFile);
  const duplicateRawPaths = rawPaths.filter((value, index) => rawPaths.indexOf(value) !== index);
  assert(duplicateRawPaths.length === 0, 'Raw output destination filenames must be unique.');

  const prefilledRaw = packets.filter((p) => fs.existsSync(path.join(ROOT, p.destinationRawFile)));
  assert(prefilledRaw.length === 0, 'No raw output files should exist before manual collection.');

  const keySummary = {
    entries: answerKey.length,
    platformCaseCount: byPlatformCase.size,
  };

  return keySummary;
}

function writeRunFiles({ packets, answerKey, candidateWording, validationSummary }) {
  const nowIso = new Date().toISOString();
  const commitSha = readExec('git rev-parse HEAD');

  const manifest = {
    runId: RUN_ID,
    protocolVersion: PROTOCOL_VERSION,
    gitCommitSha: commitSha,
    dateCreatedIso: nowIso,
    frozenBeforeCollection: true,
    fileSha256: {
      casesJson: sha256File(CASES_PATH),
      conditionsJson: sha256File(CONDITIONS_PATH),
      productionContentJson: sha256File(CONTENT_PATH),
    },
    exactCandidateWording: candidateWording,
    fixedRandomizationSeed: FIXED_SEED,
    intendedPlatforms: PLATFORMS,
    intendedModels: {
      chatgpt: '',
      claude: '',
    },
    expectedRawRunCount: 48,
    expectedScoringCount: {
      perResponseRecords: 48,
      perCaseComparisonRecords: 16,
    },
    passCriteriaReference: 'docs/validation/MVP-EFFECTIVENESS-GATE-V2.md#Pass Bar (predefined)',
    criteriaFrozenStatement: 'Cases, prompts, conditions, candidate wording, pass criteria, and seed were frozen before output collection.',
    constraints: {
      noProductionPromptMutation: true,
      noExternalApiCallsAdded: true,
      noSyntheticOutputs: true,
      noAnswerKeyInTrackedPath: true,
    },
    validationSummary,
  };

  writeJson(path.join(RUN_ROOT, 'RUN-MANIFEST.json'), manifest);

  const checklistLines = [];
  checklistLines.push('# Run Checklist');
  checklistLines.push('');
  checklistLines.push(`Run ID: ${RUN_ID}`);
  checklistLines.push('');
  checklistLines.push('Use one fresh conversation per packet.');
  checklistLines.push('');

  for (const platform of PLATFORMS) {
    checklistLines.push(`## ${platform.toUpperCase()} packet order`);
    const platformPackets = packets
      .filter((p) => p.platform === platform)
      .sort((a, b) => a.packetId.localeCompare(b.packetId));

    for (const packet of platformPackets) {
      checklistLines.push(`- [ ] ${packet.packetId} -> ${packet.destinationRawFile}`);
    }
    checklistLines.push('');
  }

  writeText(path.join(RUN_ROOT, 'RUN-CHECKLIST.md'), `${checklistLines.join('\n')}\n`);

  const instructions = `# Collection Instructions\n\nRun ID: ${RUN_ID}\n\n## Required environment\n- Use one consistent model version per platform run and record the exact displayed model label.\n- Use a fresh conversation for every packet.\n- Disable memory, custom instructions, personalization, tools, and web access where possible; record if unavailable.\n- Do not mention evaluation context to the assistant.\n- Do not regenerate for quality preference; first valid response only.\n\n## Message order\n- If packet step 1 is type instruction: send step 1, wait for acknowledgement/response, then send step 2 prompt.\n- If packet step 1 is type prompt: send it as the first message.\n- Preserve the evaluated answer exactly as returned to the case prompt.\n\n## Output preservation\n- Save evaluated output to the packet destination file as UTF-8 text/markdown.\n- Preserve refusals, tool offers, irrelevant text, errors, and formatting.\n- Do not edit wording, punctuation, markdown, or structure.\n\n## Required metadata per raw file\nInclude a metadata header with:\n- platform\n- exact model label\n- local date/time\n- packetId\n- caseId\n- blindedLabel\n- webEnabled yes/no\n- toolsEnabled yes/no\n- memoryOrCustomInstructionsDisabled yes/no/unknown\n- responseRegenerated (must be no unless technical retry)\n- technicalError yes/no\n- retryReference if applicable\n- collectorNotes (technical only)\n\n## Technical failure retries\nAllowed only for network/outage/empty/truncated/UI failure cases.\n- Keep failed attempt file.\n- Retry in a fresh conversation using same packet.\n- Label retry clearly; do not overwrite failed attempt.\n`;

  writeText(path.join(RUN_ROOT, 'COLLECTION-INSTRUCTIONS.md'), instructions);

  writeJson(path.join(ANALYSIS_ROOT, 'packet-validation.json'), {
    runId: RUN_ID,
    validatedAtIso: nowIso,
    checks: {
      expectedRunCount: 48,
      platformCaseGroups: 16,
      labelsPerGroup: 'A,B,C exactly once',
      trueConditionsPerGroup: 'WITHOUT,CURRENT,CANDIDATE_HARD_CAP exactly once',
      promptIdentityAcrossConditions: true,
      candidateDiffRule: 'diff only when profile uses Q2-A',
      withoutInstructionRule: true,
      noConditionLeakInPacketId: true,
      noPrefilledRawOutputs: true,
    },
    summary: validationSummary,
  });

  writeJson(ANSWER_KEY_PATH, {
    runId: RUN_ID,
    protocolVersion: PROTOCOL_VERSION,
    seed: FIXED_SEED,
    createdAtIso: nowIso,
    mapping: answerKey,
  });
}

function readExec(command) {
  return execSync(command, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();
}

function main() {
  ensureCleanRunDirs();
  const artifacts = buildRunArtifacts();
  const validationSummary = validatePackets(artifacts);
  writeRunFiles({ ...artifacts, validationSummary });

  console.log(`Generated run packets at: ${RUN_ROOT}`);
  console.log(`Hidden answer key path: ${ANSWER_KEY_PATH}`);
  console.log('Validation passed: all packet integrity checks succeeded.');
}

main();
