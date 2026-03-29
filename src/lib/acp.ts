import YAML from 'yaml';
import type { ACP, ACPChange } from '../types';
import { genId } from '../store';

/**
 * Extract ACP proposals from LLM free-text response.
 * Looks for ```yaml fenced blocks containing ACP-formatted YAML.
 */
export function extractACPProposals(response: string): ACP[] {
  const acps: ACP[] = [];
  const yamlBlocks = response.match(/```yaml\n([\s\S]*?)```/g);

  if (!yamlBlocks) return acps;

  for (const block of yamlBlocks) {
    const yamlContent = block.replace(/```yaml\n?/, '').replace(/```$/, '').trim();
    try {
      const parsed = YAML.parse(yamlContent);
      if (!parsed) continue;

      // Handle single change or array of changes
      const changes: ACPChange[] = Array.isArray(parsed) ? parsed : [parsed];

      const validChanges = changes.filter(
        (c) => c.kind && c.reason && c.target_canvas,
      );

      if (validChanges.length > 0) {
        acps.push({
          id: genId(),
          description: validChanges[0].reason,
          changes: validChanges,
          status: 'pending',
          timestamp: new Date().toISOString(),
        });
      }
    } catch {
      // Not valid YAML, skip
    }
  }

  return acps;
}

/**
 * Serialize an ACP to YAML for writing to disk.
 */
export function serializeACP(acp: ACP): string {
  return YAML.stringify({
    id: acp.id,
    description: acp.description,
    status: acp.status,
    timestamp: acp.timestamp,
    changes: acp.changes,
  });
}
