/**
 * architect changeset propose / feedback / promote / dismiss
 */

import fs from 'fs';
import path from 'path';
import * as YAML from 'yaml';
import { loadChangesetsCli } from '../workspace.js';
import { output, type OutputFormat } from '../output.js';

function changesDir(basePath: string, folder: string): string {
  return path.join(basePath, '.architect', 'changes', folder);
}

function findChangesetFile(
  basePath: string,
  id: string
): { file: string; folder: string } | null {
  for (const folder of ['pending', 'accepted', 'dismissed']) {
    const dir = changesDir(basePath, folder);
    if (!fs.existsSync(dir)) continue;
    for (const entry of fs.readdirSync(dir)) {
      if (entry.endsWith('.yaml') && entry.includes(id)) {
        return { file: path.join(dir, entry), folder };
      }
    }
  }
  return null;
}

export function runChangesetPropose(
  basePath: string,
  format: OutputFormat,
  yamlFile: string
): void {
  if (!fs.existsSync(yamlFile)) {
    console.error(`File not found: ${yamlFile}`);
    process.exit(1);
  }

  const content = fs.readFileSync(yamlFile, 'utf-8');
  let parsed: Record<string, unknown> = {};
  try {
    parsed = YAML.parse(content) as Record<string, unknown>;
  } catch (err) {
    console.error(`Invalid YAML: ${String(err)}`);
    process.exit(1);
  }

  const id =
    (parsed['id'] as string | undefined) ??
    `id_${Date.now()}`;
  const now = new Date().toISOString();
  const csObj = { ...parsed, id, status: 'pending', timestamp: now };
  const csYaml = YAML.stringify(csObj);

  const pendingDir = changesDir(basePath, 'pending');
  fs.mkdirSync(pendingDir, { recursive: true });

  const existing = fs.existsSync(pendingDir) ? fs.readdirSync(pendingDir) : [];
  const seq = String(existing.length + 1).padStart(3, '0');
  const fileName = `${seq}-${id}.yaml`;
  const outPath = path.join(pendingDir, fileName);
  fs.writeFileSync(outPath, csYaml);

  const data = { id, file: outPath, status: 'pending' };
  if (format === 'json') {
    output(data, format);
    return;
  }
  console.log(`Proposed changeset: ${id}`);
  console.log(`Written to: ${outPath}`);
}

export function runChangesetFeedback(
  basePath: string,
  format: OutputFormat,
  id: string,
  message: string
): void {
  const found = findChangesetFile(basePath, id);
  if (!found) {
    console.error(`Changeset '${id}' not found`);
    process.exit(1);
  }

  const content = fs.readFileSync(found.file, 'utf-8');
  let parsed: Record<string, unknown> = {};
  try {
    parsed = YAML.parse(content) as Record<string, unknown>;
  } catch (err) {
    console.error(`Failed to parse changeset: ${String(err)}`);
    process.exit(1);
  }

  const existing = (parsed['feedback'] as string[] | undefined) ?? [];
  const updated = {
    ...parsed,
    feedback: [...existing, { timestamp: new Date().toISOString(), message }],
  };
  fs.writeFileSync(found.file, YAML.stringify(updated));

  const data = { id, feedback_count: updated.feedback.length };
  if (format === 'json') {
    output(data, format);
    return;
  }
  console.log(`Feedback added to changeset ${id}`);
}

export function runChangesetPromote(
  basePath: string,
  format: OutputFormat,
  id: string
): void {
  _moveChangeset(basePath, id, 'accepted', format);
}

export function runChangesetDismiss(
  basePath: string,
  format: OutputFormat,
  id: string
): void {
  _moveChangeset(basePath, id, 'dismissed', format);
}

function _moveChangeset(
  basePath: string,
  id: string,
  targetFolder: string,
  format: OutputFormat
): void {
  const found = findChangesetFile(basePath, id);
  if (!found) {
    console.error(`Changeset '${id}' not found`);
    process.exit(1);
  }

  if (found.folder === targetFolder) {
    if (format !== 'json') {
      console.log(`Changeset ${id} is already ${targetFolder}`);
    } else {
      output({ id, status: targetFolder }, format);
    }
    return;
  }

  const targetDir = changesDir(basePath, targetFolder);
  fs.mkdirSync(targetDir, { recursive: true });

  // Update status field in the YAML
  const content = fs.readFileSync(found.file, 'utf-8');
  let parsed: Record<string, unknown>;
  try {
    parsed = YAML.parse(content) as Record<string, unknown>;
  } catch {
    parsed = {};
  }
  const updated = { ...parsed, status: targetFolder };
  const fileName = path.basename(found.file);
  const destPath = path.join(targetDir, fileName);
  fs.writeFileSync(destPath, YAML.stringify(updated));

  if (destPath !== found.file) {
    fs.unlinkSync(found.file);
  }

  const data = { id, status: targetFolder, file: destPath };
  if (format === 'json') {
    output(data, format);
    return;
  }
  console.log(`Changeset ${id} → ${targetFolder}`);
}

export function runChangesetList(
  basePath: string,
  format: OutputFormat,
  statusFilter?: string
): void {
  let changesets = loadChangesetsCli(basePath);
  if (statusFilter) {
    changesets = changesets.filter((c) => c.folder === statusFilter);
  }

  if (format === 'json') {
    output(changesets, format);
    return;
  }

  if (changesets.length === 0) {
    console.log('No changesets found');
    return;
  }

  for (const cs of changesets) {
    const desc = String(cs.description ?? '').split('\n')[0].slice(0, 60);
    console.log(`[${cs.folder.toUpperCase().padEnd(8)}] ${cs.id}  ${desc}`);
  }
}
