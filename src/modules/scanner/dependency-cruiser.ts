// ─── Dependency Cruiser Scanner Plugin ───────────────────────────────────────
//
// Invokes `npx dependency-cruiser --output-type json <path>` via the Tauri
// `invoke_cli` command and parses the result into a CodeGraph.

import { invoke } from '@tauri-apps/api/core';
import type { ScannerPlugin } from './types.js';
import type { CodeGraph, CodeGraphEdge, CodeGraphNode } from '../store/types.js';

// ─── Tauri IPC types ──────────────────────────────────────────────────────────

interface CliResult {
  exit_code: number;
  stdout: string;
  stderr: string;
}

// ─── dependency-cruiser JSON shape (subset we care about) ─────────────────────

interface DcModule {
  source: string;
  dependencies: DcDependency[];
}

interface DcDependency {
  resolved: string;
  dependencyTypes?: string[];
}

interface DcOutput {
  modules?: DcModule[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function emptyGraph(): CodeGraph {
  return { nodes: [], edges: [], scanned_at: new Date().toISOString() };
}

/**
 * Derive a simple "module" type from the file extension so the canvas can
 * choose an appropriate icon.
 */
function nodeTypeFromPath(filePath: string): CodeGraphNode['type'] {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'ts' || ext === 'tsx' || ext === 'js' || ext === 'jsx') return 'module';
  if (ext === 'css' || ext === 'scss' || ext === 'less') return 'file';
  return 'file';
}

// ─── Plugin ───────────────────────────────────────────────────────────────────

export const dependencyCruiserPlugin: ScannerPlugin = {
  id: 'dependency-cruiser',
  name: 'Dependency Cruiser',

  async canHandle(projectPath: string): Promise<boolean> {
    // Applicable when a package.json exists in the project root.
    try {
      const result = await invoke<CliResult>('invoke_cli', {
        program: 'node',
        args: ['-e', 'require("fs").accessSync(process.argv[1])', `${projectPath}/package.json`],
        cwd: projectPath,
      });
      return result.exit_code === 0;
    } catch {
      // On any error (e.g. Tauri not available in tests) return true as best guess
      return true;
    }
  },

  async scan(projectPath: string): Promise<CodeGraph> {
    let result: CliResult;

    try {
      result = await invoke<CliResult>('invoke_cli', {
        program: 'npx',
        args: [
          '--yes',
          'dependency-cruiser',
          '--output-type', 'json',
          '--exclude', 'node_modules',
          '.',
        ],
        cwd: projectPath,
      });
    } catch (err) {
      console.warn('[dependency-cruiser] invoke_cli threw:', err);
      return emptyGraph();
    }

    if (result.exit_code !== 0) {
      console.warn(
        `[dependency-cruiser] exited with code ${result.exit_code}.\n` +
        result.stderr.slice(0, 400),
      );
      return emptyGraph();
    }

    return parseDcOutput(result.stdout);
  },
};

// ─── Parser ───────────────────────────────────────────────────────────────────

function parseDcOutput(raw: string): CodeGraph {
  let parsed: DcOutput;

  try {
    parsed = JSON.parse(raw) as DcOutput;
  } catch {
    console.warn('[dependency-cruiser] failed to parse JSON output');
    return { nodes: [], edges: [], scanned_at: new Date().toISOString() };
  }

  const modules = parsed.modules ?? [];
  const nodeMap = new Map<string, CodeGraphNode>();
  const edges: CodeGraphEdge[] = [];

  for (const mod of modules) {
    if (!nodeMap.has(mod.source)) {
      nodeMap.set(mod.source, {
        id: mod.source,
        type: nodeTypeFromPath(mod.source),
        name: mod.source.split('/').pop() ?? mod.source,
        path: mod.source,
      });
    }

    for (const dep of mod.dependencies) {
      const target = dep.resolved;
      if (!nodeMap.has(target)) {
        nodeMap.set(target, {
          id: target,
          type: nodeTypeFromPath(target),
          name: target.split('/').pop() ?? target,
          path: target,
        });
      }

      edges.push({
        source: mod.source,
        target,
        relationship: 'imports',
      });
    }
  }

  return {
    nodes: Array.from(nodeMap.values()),
    edges,
    scanned_at: new Date().toISOString(),
  };
}
