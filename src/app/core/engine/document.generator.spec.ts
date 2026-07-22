import { generateDocument } from './document.generator';
import { ControlId, Setting, SetupResult, V2Content } from '../content/types';
import contentFixture from '../../../assets/content/working-with-me.json';

const content = contentFixture as V2Content;

function makeResult(settings: Record<ControlId, Setting>): SetupResult {
  return {
    generatedAt: '2026-07-20T00:00:00.000Z',
    controls: content.controls.map(control => ({
      controlId: control.id,
      setting: settings[control.id]
    }))
  };
}

function countWords(text: string): number {
  const matches = text.match(/\b\S+\b/g);
  return matches ? matches.length : 0;
}

describe('generateDocument', () => {
  it('includes exactly one selected instruction for each of the six controls', () => {
    const result = makeResult({
      load: 'A',
      scope: 'B',
      challenge: 'C',
      rigor: 'A',
      coachingThreshold: 'B',
      coachingDelivery: 'C'
    });

    const document = generateDocument(result, content);

    for (const control of content.controls) {
      const selectedSetting = result.controls.find(controlResult => controlResult.controlId === control.id)!.setting;
      expect(document).toContain(control.output[selectedSetting]);

      for (const setting of ['A', 'B', 'C'] as const) {
        if (setting !== selectedSetting) {
          expect(document).not.toContain(control.output[setting]);
        }
      }
    }
  });

  it('includes the required coaching guardrails and improvement list', () => {
    const document = generateDocument(makeResult({
      load: 'B',
      scope: 'B',
      challenge: 'B',
      rigor: 'B',
      coachingThreshold: 'B',
      coachingDelivery: 'B'
    }), content);

    expect(document).toContain('Answer normally when my request is already workable.');
    expect(document).toContain('Coach only when a missing detail would materially improve the result.');
    expect(document).toContain('an example, source material, audience, purpose, constraints, output format, task breakdown, assumptions, or a quick way to verify.');
  });

  it('does not include forbidden jargon', () => {
    const document = generateDocument(makeResult({
      load: 'A',
      scope: 'A',
      challenge: 'A',
      rigor: 'A',
      coachingThreshold: 'A',
      coachingDelivery: 'A'
    }), content).toLowerCase();

    expect(document).not.toMatch(/zero-shot|few-shot|rag|chain-of-thought/);
  });

  it('keeps representative profiles within the target line, word, and character ranges', () => {
    const profiles: Array<Record<ControlId, Setting>> = [
      { load: 'A', scope: 'A', challenge: 'A', rigor: 'A', coachingThreshold: 'A', coachingDelivery: 'A' },
      { load: 'B', scope: 'B', challenge: 'B', rigor: 'B', coachingThreshold: 'B', coachingDelivery: 'B' },
      { load: 'C', scope: 'C', challenge: 'C', rigor: 'C', coachingThreshold: 'C', coachingDelivery: 'C' }
    ];

    for (const profile of profiles) {
      const document = generateDocument(makeResult(profile), content);
      const lines = document.split('\n').filter(line => line.trim().length > 0);
      const words = countWords(document);

      expect(lines.length).toBeGreaterThanOrEqual(12);
      expect(lines.length).toBeLessThanOrEqual(16);
      expect(words).toBeGreaterThanOrEqual(150);
      expect(words).toBeLessThanOrEqual(220);
      expect(document.length).toBeLessThanOrEqual(1500);
    }
  });

  it('avoids contradictory delivery instructions in representative mixed profiles', () => {
    const mixedProfiles: Array<Record<ControlId, Setting>> = [
      { load: 'A', scope: 'C', challenge: 'B', rigor: 'C', coachingThreshold: 'B', coachingDelivery: 'A' },
      { load: 'C', scope: 'A', challenge: 'C', rigor: 'B', coachingThreshold: 'C', coachingDelivery: 'B' }
    ];

    for (const profile of mixedProfiles) {
      const document = generateDocument(makeResult(profile), content);

      expect(document).not.toMatch(/ask for the missing piece before answering\.[\s\S]*keep moving\./);
    }
  });
});