import { describe, it, expect } from 'vitest';
import { extractACPProposals, serializeACP } from '../lib/acp';

describe('extractACPProposals', () => {
  it('returns empty array for text without yaml blocks', () => {
    const result = extractACPProposals('This is just plain text with no suggestions.');
    expect(result).toEqual([]);
  });

  it('extracts a single ACP from yaml block', () => {
    const response = `Here's my suggestion:

\`\`\`yaml
kind: add_block
target_canvas: root
reason: "Missing a cache layer between server and database"
proposal:
  label: "Redis Cache"
  ports:
    - id: cache-in
      label: queries
      direction: entry
\`\`\`

This would improve latency.`;

    const result = extractACPProposals(response);
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('pending');
    expect(result[0].changes).toHaveLength(1);
    expect(result[0].changes[0].kind).toBe('add_block');
    expect(result[0].changes[0].target_canvas).toBe('root');
    expect(result[0].changes[0].reason).toContain('cache');
  });

  it('extracts add_component ACP', () => {
    const response = `
\`\`\`yaml
kind: add_component
target_canvas: server
reason: "Add a logger component to the server canvas"
proposal:
  label: Logger
  type: module
  ports:
    - id: log-entry
      label: log events
      direction: entry
\`\`\``;

    const result = extractACPProposals(response);
    expect(result).toHaveLength(1);
    expect(result[0].changes[0].kind).toBe('add_component');
  });

  it('extracts multiple ACPs from multiple yaml blocks', () => {
    const response = `Two suggestions:

\`\`\`yaml
kind: add_block
target_canvas: root
reason: "Add monitoring"
proposal:
  label: Prometheus
\`\`\`

And also:

\`\`\`yaml
kind: add_arrow
target_canvas: root
reason: "Connect monitoring to server"
proposal:
  from: prometheus
  to: game-server
\`\`\``;

    const result = extractACPProposals(response);
    expect(result).toHaveLength(2);
    expect(result[0].changes[0].kind).toBe('add_block');
    expect(result[1].changes[0].kind).toBe('add_arrow');
  });

  it('ignores invalid yaml blocks', () => {
    const response = `
\`\`\`yaml
this is not: valid: acp: format
  - missing required fields
\`\`\``;

    const result = extractACPProposals(response);
    expect(result).toEqual([]);
  });

  it('handles yaml with missing optional fields gracefully', () => {
    const response = `
\`\`\`yaml
kind: remove_block
target_canvas: server
target_id: old-service
reason: "No longer needed"
proposal: {}
\`\`\``;

    const result = extractACPProposals(response);
    expect(result).toHaveLength(1);
    expect(result[0].changes[0].kind).toBe('remove_block');
  });

  it('extracts decompose ACP', () => {
    const response = `
\`\`\`yaml
kind: decompose
target_canvas: root
target_id: monolith
reason: "Break monolith into microservices"
proposal:
  children:
    - label: Auth Service
    - label: User Service
    - label: Payment Service
\`\`\``;

    const result = extractACPProposals(response);
    expect(result).toHaveLength(1);
    expect(result[0].changes[0].kind).toBe('decompose');
    expect(result[0].changes[0].target_id).toBe('monolith');
  });

  it('extracts refine_arrow ACP', () => {
    const response = `
\`\`\`yaml
kind: refine_arrow
target_canvas: root
target_id: a1
reason: "Specify the interface contract for this connection"
proposal:
  type: calls
  interface:
    request: GetUserRequest
    response: UserDTO
    async: false
\`\`\``;

    const result = extractACPProposals(response);
    expect(result).toHaveLength(1);
    expect(result[0].changes[0].kind).toBe('refine_arrow');
    expect(result[0].changes[0].target_id).toBe('a1');
  });
});

describe('serializeACP', () => {
  it('produces valid YAML', () => {
    const acp = {
      id: 'test-1',
      description: 'Add cache',
      changes: [
        {
          kind: 'add_block' as const,
          target_canvas: 'root',
          reason: 'Performance',
          proposal: { label: 'Cache' },
        },
      ],
      status: 'accepted' as const,
      timestamp: '2026-03-28T12:00:00Z',
    };
    const yaml = serializeACP(acp);
    expect(yaml).toContain('id: test-1');
    expect(yaml).toContain('description: Add cache');
    expect(yaml).toContain('status: accepted');
  });
});
