/**
 * V2 document generator for Work With Me.
 * Maps a SetupResult + V2Content → a personalized markdown document.
 *
 * Structure:
 *   1. Header
 *   2. Universal guardrails
 *   3. One prose block per control (output[setting])
 */

import { SetupResult, V2Content } from '../content/types';

export function generateDocument(result: SetupResult, content: V2Content): string {
  const lines: string[] = content.universalGuardrails
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);

  // One section per control, in content order
  for (const control of content.controls) {
    const controlResult = result.controls.find(r => r.controlId === control.id);
    if (!controlResult) continue;
    const block = control.output[controlResult.setting];
    if (block) {
      lines.push(block.trim());
    }
  }

  return lines.join('\n');
}
