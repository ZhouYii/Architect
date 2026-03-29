/**
 * architect elaborate <intent>
 *
 * Sends a design-elaboration prompt to the configured LLM provider.
 * The system prompt instructs the agent to propose new blocks/arrows.
 */

import { runChat } from './chat.js';
import type { OutputFormat } from '../output.js';

const ELABORATE_SYSTEM_PROMPT = `You are an expert software architect. The user will describe a high-level design intent.
Your job is to elaborate it into concrete architecture blocks and connections.
Respond with a structured YAML changeset inside a \`\`\`yaml code fence, following this schema:

\`\`\`yaml
id: cs-<unique-id>
title: <short title>
agent: elaborate
nodes:
  - id: <node-id>
    kind: block
    block_type: <service|module|class|function|data-store|external|queue|config>
    name: <Name>
    status: proposed
    annotation: |
      <Description of what this block does>
    agent_proposed: true
\`\`\``;

export async function runElaborate(
  basePath: string,
  format: OutputFormat,
  intent: string
): Promise<void> {
  const fullMessage = `${ELABORATE_SYSTEM_PROMPT}\n\n[Intent]\n${intent}`;
  await runChat(basePath, format, fullMessage);
}
