/**
 * architect version cut — cut a new major version snapshot.
 *
 * CLI equivalent of the GUI cutVersion() flow:
 *   1. Compute a deterministic hash of tree/ files
 *   2. Create .architect/versions/v{N}.tar.gz  (or a JSON bundle fallback)
 *   3. Update workspace.yaml (version field)
 *   4. Reset status of all modified/implemented nodes → clean
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execFile } from 'child_process';
import * as YAML from 'yaml';
import { loadWorkspaceCli } from '../workspace.js';
import { output, type OutputFormat } from '../output.js';
import type { CanvasNode } from '../../modules/store/types.js';

// ─── Tree hash ────────────────────────────────────────────────────────────────

function hashTreeDir(treeDir: string): string {
  const h = crypto.createHash('sha256');
  if (!fs.existsSync(treeDir)) return h.digest('hex');

  function walk(dir: string): void {
    const entries = fs.readdirSync(dir).sort();
    for (const entry of entries) {
      const full = path.join(dir, entry);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) {
        walk(full);
      } else {
        h.update(entry);
        h.update(fs.readFileSync(full));
      }
    }
  }

  walk(treeDir);
  return h.digest('hex').slice(0, 16);
}

// ─── Archive creation ─────────────────────────────────────────────────────────

/**
 * Create a .tar.gz archive of `sourceDir` at `archivePath`.
 * Falls back to a JSON bundle if tar is unavailable (e.g. Windows without WSL).
 */
async function createArchive(archivePath: string, sourceDir: string): Promise<void> {
  const parentDir = path.dirname(sourceDir);
  const dirName = path.basename(sourceDir);

  return new Promise<void>((resolve) => {
    execFile(
      'tar',
      ['-czf', archivePath, '-C', parentDir, dirName],
      (err) => {
        if (!err) {
          resolve();
          return;
        }
        // Fallback: write a simple JSON bundle
        const bundle: Record<string, string> = {};

        function collect(dir: string, prefix: string): void {
          for (const entry of fs.readdirSync(dir)) {
            const full = path.join(dir, entry);
            const rel = `${prefix}/${entry}`;
            if (fs.statSync(full).isDirectory()) {
              collect(full, rel);
            } else {
              bundle[rel] = fs.readFileSync(full, 'base64');
            }
          }
        }

        collect(sourceDir, dirName);
        const fallbackPath = archivePath.replace(/\.tar\.gz$/, '.json');
        fs.writeFileSync(fallbackPath, JSON.stringify(bundle, null, 2));
        resolve();
      }
    );
  });
}

// ─── Reset dirty nodes ────────────────────────────────────────────────────────

type PlainObject = Record<string, unknown>;

function toSnake(obj: PlainObject): PlainObject {
  const out: PlainObject = {};
  for (const [k, v] of Object.entries(obj)) {
    const snakeKey = k === 'interfacesContent' ? 'interfaces_content' : k;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      out[snakeKey] = toSnake(v as PlainObject);
    } else if (Array.isArray(v)) {
      out[snakeKey] = (v as unknown[]).map((item) =>
        item !== null && typeof item === 'object' ? toSnake(item as PlainObject) : item
      );
    } else {
      out[snakeKey] = v;
    }
  }
  return out;
}

const RESETTABLE_STATUSES = new Set(['modified', 'implemented', 'running', 'failed']);

function resetDirtyNodes(canvas: CanvasNode): CanvasNode {
  return {
    ...canvas,
    components: (canvas.components ?? []).map((n) =>
      RESETTABLE_STATUSES.has(n.status) ? { ...n, status: 'clean' as const } : n
    ),
    connections: (canvas.connections ?? []).map((n) =>
      RESETTABLE_STATUSES.has(n.status) ? { ...n, status: 'clean' as const } : n
    ),
  };
}

// ─── Main command ─────────────────────────────────────────────────────────────

export async function runVersionCut(basePath: string, format: OutputFormat): Promise<void> {
  const ws = loadWorkspaceCli(basePath);
  const archDir = path.join(basePath, '.architect');

  // 1. Determine next major version
  const currentVersion = ws.config.version ?? '1.0';
  const currentMajor = parseInt(currentVersion.split('.')[0] ?? '1', 10);
  const nextMajor = currentMajor + 1;
  const newVersion = `${nextMajor}.0`;

  // 2. Compute tree hash
  const treeDir = path.join(archDir, 'tree');
  const hash = hashTreeDir(treeDir);

  // 3. Create archive
  const versionsDir = path.join(archDir, 'versions');
  fs.mkdirSync(versionsDir, { recursive: true });
  const archivePath = path.join(versionsDir, `v${nextMajor}.tar.gz`);
  await createArchive(archivePath, treeDir);

  // 4. Update workspace.yaml
  const wsYamlPath = path.join(archDir, 'workspace.yaml');
  const wsRaw = fs.readFileSync(wsYamlPath, 'utf-8');
  const wsObj = YAML.parse(wsRaw) as Record<string, unknown>;
  wsObj['version'] = newVersion;
  wsObj['created_at'] = new Date().toISOString();
  fs.writeFileSync(wsYamlPath, YAML.stringify(wsObj, { lineWidth: 0 }));

  // 5. Reset dirty nodes across all canvas files
  for (const [canvasId, canvas] of Object.entries(ws.canvases)) {
    const dirName = canvasId.replace(/[/\\]/g, '_');
    const nodeFile = path.join(treeDir, dirName, 'node.yaml');
    if (!fs.existsSync(nodeFile)) continue;
    const cleaned = resetDirtyNodes(canvas);
    const plain = toSnake(cleaned as unknown as PlainObject);
    fs.writeFileSync(nodeFile, YAML.stringify(plain, { lineWidth: 0 }));
  }

  const data = {
    previous_version: currentVersion,
    new_version: newVersion,
    tree_hash: hash,
    archive: archivePath,
  };

  if (format === 'json') {
    output(data, format);
    return;
  }

  console.log(`Cut version ${newVersion} (was ${currentVersion})`);
  console.log(`Hash:    ${hash}`);
  console.log(`Archive: ${archivePath}`);
}
