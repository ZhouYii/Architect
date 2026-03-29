#!/usr/bin/env npx tsx
/**
 * architect-cli.ts — Node.js CLI for the Architect workspace.
 *
 * Usage:
 *   npx tsx architect-cli.ts <command> [subcommand] [args] [--format json]
 *
 * All commands support --format json for machine-readable output.
 * Reads .architect/ from the current working directory by default.
 * Use --workspace <path> to target a different directory.
 */

import path from 'path';
import { parseFormat, stripFormatArg } from './src/cli/output.js';
import { runStatus } from './src/cli/commands/status.js';
import { runTreeShow, runTreeList } from './src/cli/commands/tree.js';
import {
  runChangesetPropose,
  runChangesetFeedback,
  runChangesetPromote,
  runChangesetDismiss,
  runChangesetList,
} from './src/cli/commands/changeset.js';
import {
  runNodeAdd,
  runNodeModify,
  runNodeRemove,
  runNodeAccept,
  runNodeDismiss,
  runNodeReady,
  runNodeList,
} from './src/cli/commands/node.js';
import { runVersionCut } from './src/cli/commands/version.js';
import {
  runTrackCreate,
  runTrackSwitch,
  runTrackList,
  runTrackMerge,
} from './src/cli/commands/track.js';
import {
  runImplPlan,
  runImplStart,
  runImplStatus,
  runImplPause,
  runImplResume,
  runImplStop,
  runImplLog,
} from './src/cli/commands/impl.js';
import { runChat } from './src/cli/commands/chat.js';
import { runElaborate } from './src/cli/commands/elaborate.js';
import { runQueryNodes, runQueryContracts, runQueryDiff } from './src/cli/commands/query.js';

// ─── Help text ────────────────────────────────────────────────────────────────

const HELP = `
architect-cli — Architect workspace CLI

Usage:
  npx tsx architect-cli.ts <command> [subcommand] [args] [--format json]

Global flags:
  --workspace <path>   Base directory of the workspace (default: cwd)
  --format json        Output machine-readable JSON instead of text

Commands:
  status                              Show workspace status
  tree show [--path <id>]             Show canvas tree
  tree list [--depth N]               List all canvases
  changeset list [--status <s>]       List changesets
  changeset propose <file.yaml>       Propose a changeset from YAML file
  changeset feedback <id> <msg>       Add feedback to a changeset
  changeset promote <id>              Promote changeset to accepted
  changeset dismiss <id>              Dismiss changeset
  node list <canvas>                  List nodes in a canvas
  node add <canvas> <id> <yaml>       Add node to canvas
  node modify <canvas> <id> <yaml>    Modify node
  node remove <canvas> <id>           Remove node
  node accept <canvas> <id>           Accept proposed node
  node dismiss <canvas> <id>          Dismiss proposed node
  node ready <canvas> <id>            Mark node ready for implementation
  version cut                         Cut new major version
  track create <name>                 Create design track
  track switch <name>                 Switch to track
  track list                          List tracks
  track merge <name>                  Merge track to main
  impl plan [--from vX --to vY]       Plan implementation
  impl start [--autopilot]            Start execution
  impl status                         Show execution status
  impl pause                          Pause execution
  impl resume                         Resume execution
  impl stop                           Stop execution
  impl log <task-id>                  Show task log
  chat <message> [--provider <name>]  Chat with agent
  elaborate <intent>                  Elaborate design from intent
  query nodes [--status <s>]          Query design nodes
  query contracts                     Query contracts
  query diff                          Show current delta
`.trim();

// ─── Argument parsing helpers ─────────────────────────────────────────────────

function getFlag(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  if (idx !== -1 && idx + 1 < args.length) return args[idx + 1];
  const prefix = `${flag}=`;
  const found = args.find((a) => a.startsWith(prefix));
  return found ? found.slice(prefix.length) : undefined;
}

function hasFlag(args: string[], flag: string): boolean {
  return args.includes(flag);
}

function removeFlags(args: string[], ...flags: string[]): string[] {
  const result: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (flags.includes(a)) {
      i++; // skip value
      continue;
    }
    if (flags.some((f) => a.startsWith(`${f}=`))) continue;
    result.push(a);
  }
  return result;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const rawArgs = process.argv.slice(2);

  if (rawArgs.length === 0 || rawArgs[0] === '--help' || rawArgs[0] === '-h') {
    console.log(HELP);
    return;
  }

  // Extract global --workspace flag
  const workspaceArg = getFlag(rawArgs, '--workspace');
  const basePath = workspaceArg
    ? path.resolve(workspaceArg)
    : process.cwd();

  // Strip global flags so subcommand parsers don't see them
  let args = removeFlags(rawArgs, '--workspace');
  const format = parseFormat(args);
  args = stripFormatArg(args);

  const [command, sub, ...rest] = args;

  try {
    switch (command) {
      // ── status ──────────────────────────────────────────────────────────────
      case 'status':
        runStatus(basePath, format);
        break;

      // ── tree ────────────────────────────────────────────────────────────────
      case 'tree': {
        switch (sub) {
          case 'show': {
            const canvasPath = getFlag(rest, '--path');
            runTreeShow(basePath, format, canvasPath);
            break;
          }
          case 'list': {
            const depthStr = getFlag(rest, '--depth');
            const depth = depthStr !== undefined ? parseInt(depthStr, 10) : undefined;
            runTreeList(basePath, format, depth);
            break;
          }
          default:
            console.error(`Unknown tree subcommand: ${sub ?? '(none)'}`);
            console.error('Available: tree show, tree list');
            process.exit(1);
        }
        break;
      }

      // ── changeset ───────────────────────────────────────────────────────────
      case 'changeset': {
        switch (sub) {
          case 'list': {
            const statusFilter = getFlag(rest, '--status');
            runChangesetList(basePath, format, statusFilter);
            break;
          }
          case 'propose': {
            const [file] = rest;
            if (!file) {
              console.error('Usage: changeset propose <file.yaml>');
              process.exit(1);
            }
            runChangesetPropose(basePath, format, path.resolve(file));
            break;
          }
          case 'feedback': {
            const [id, ...msgParts] = rest;
            const msg = msgParts.join(' ');
            if (!id || !msg) {
              console.error('Usage: changeset feedback <id> <message>');
              process.exit(1);
            }
            runChangesetFeedback(basePath, format, id, msg);
            break;
          }
          case 'promote': {
            const [id] = rest;
            if (!id) { console.error('Usage: changeset promote <id>'); process.exit(1); }
            runChangesetPromote(basePath, format, id);
            break;
          }
          case 'dismiss': {
            const [id] = rest;
            if (!id) { console.error('Usage: changeset dismiss <id>'); process.exit(1); }
            runChangesetDismiss(basePath, format, id);
            break;
          }
          default:
            console.error(`Unknown changeset subcommand: ${sub ?? '(none)'}`);
            process.exit(1);
        }
        break;
      }

      // ── node ─────────────────────────────────────────────────────────────────
      case 'node': {
        switch (sub) {
          case 'list': {
            const [canvasPath] = rest;
            if (!canvasPath) { console.error('Usage: node list <canvas>'); process.exit(1); }
            runNodeList(basePath, format, canvasPath);
            break;
          }
          case 'add': {
            const [canvasPath, nodeId, ...yamlParts] = rest;
            const yaml = yamlParts.join(' ');
            if (!canvasPath || !nodeId || !yaml) {
              console.error('Usage: node add <canvas> <id> <yaml>');
              process.exit(1);
            }
            runNodeAdd(basePath, format, canvasPath, nodeId, yaml);
            break;
          }
          case 'modify': {
            const [canvasPath, nodeId, ...yamlParts] = rest;
            const yaml = yamlParts.join(' ');
            if (!canvasPath || !nodeId || !yaml) {
              console.error('Usage: node modify <canvas> <id> <yaml>');
              process.exit(1);
            }
            runNodeModify(basePath, format, canvasPath, nodeId, yaml);
            break;
          }
          case 'remove': {
            const [canvasPath, nodeId] = rest;
            if (!canvasPath || !nodeId) {
              console.error('Usage: node remove <canvas> <id>');
              process.exit(1);
            }
            runNodeRemove(basePath, format, canvasPath, nodeId);
            break;
          }
          case 'accept': {
            const [canvasPath, nodeId] = rest;
            if (!canvasPath || !nodeId) {
              console.error('Usage: node accept <canvas> <id>');
              process.exit(1);
            }
            runNodeAccept(basePath, format, canvasPath, nodeId);
            break;
          }
          case 'dismiss': {
            const [canvasPath, nodeId] = rest;
            if (!canvasPath || !nodeId) {
              console.error('Usage: node dismiss <canvas> <id>');
              process.exit(1);
            }
            runNodeDismiss(basePath, format, canvasPath, nodeId);
            break;
          }
          case 'ready': {
            const [canvasPath, nodeId] = rest;
            if (!canvasPath || !nodeId) {
              console.error('Usage: node ready <canvas> <id>');
              process.exit(1);
            }
            runNodeReady(basePath, format, canvasPath, nodeId);
            break;
          }
          default:
            console.error(`Unknown node subcommand: ${sub ?? '(none)'}`);
            process.exit(1);
        }
        break;
      }

      // ── version ──────────────────────────────────────────────────────────────
      case 'version': {
        if (sub !== 'cut') {
          console.error(`Unknown version subcommand: ${sub ?? '(none)'}. Available: version cut`);
          process.exit(1);
        }
        await runVersionCut(basePath, format);
        break;
      }

      // ── track ────────────────────────────────────────────────────────────────
      case 'track': {
        switch (sub) {
          case 'create': {
            const [name] = rest;
            if (!name) { console.error('Usage: track create <name>'); process.exit(1); }
            runTrackCreate(basePath, format, name);
            break;
          }
          case 'switch': {
            const [name] = rest;
            if (!name) { console.error('Usage: track switch <name>'); process.exit(1); }
            runTrackSwitch(basePath, format, name);
            break;
          }
          case 'list':
            runTrackList(basePath, format);
            break;
          case 'merge': {
            const [name] = rest;
            if (!name) { console.error('Usage: track merge <name>'); process.exit(1); }
            runTrackMerge(basePath, format, name);
            break;
          }
          default:
            console.error(`Unknown track subcommand: ${sub ?? '(none)'}`);
            process.exit(1);
        }
        break;
      }

      // ── impl ─────────────────────────────────────────────────────────────────
      case 'impl': {
        switch (sub) {
          case 'plan': {
            const fromVer = getFlag(rest, '--from');
            const toVer = getFlag(rest, '--to');
            runImplPlan(basePath, format, fromVer, toVer);
            break;
          }
          case 'start':
            runImplStart(basePath, format, hasFlag(rest, '--autopilot'));
            break;
          case 'status':
            runImplStatus(basePath, format);
            break;
          case 'pause':
            runImplPause(basePath, format);
            break;
          case 'resume':
            runImplResume(basePath, format);
            break;
          case 'stop':
            runImplStop(basePath, format);
            break;
          case 'log': {
            const [taskId] = rest;
            if (!taskId) { console.error('Usage: impl log <task-id>'); process.exit(1); }
            runImplLog(basePath, format, taskId);
            break;
          }
          default:
            console.error(`Unknown impl subcommand: ${sub ?? '(none)'}`);
            process.exit(1);
        }
        break;
      }

      // ── chat ─────────────────────────────────────────────────────────────────
      case 'chat': {
        const providerHint = getFlag(args, '--provider');
        const cleanArgs = removeFlags(rest, '--provider');
        const message = [sub, ...cleanArgs].filter(Boolean).join(' ');
        if (!message) {
          console.error('Usage: chat <message> [--provider <name>]');
          process.exit(1);
        }
        await runChat(basePath, format, message, providerHint);
        break;
      }

      // ── elaborate ────────────────────────────────────────────────────────────
      case 'elaborate': {
        const intent = [sub, ...rest].filter(Boolean).join(' ');
        if (!intent) {
          console.error('Usage: elaborate <intent description>');
          process.exit(1);
        }
        await runElaborate(basePath, format, intent);
        break;
      }

      // ── query ────────────────────────────────────────────────────────────────
      case 'query': {
        switch (sub) {
          case 'nodes': {
            const statusFilter = getFlag(rest, '--status');
            runQueryNodes(basePath, format, statusFilter);
            break;
          }
          case 'contracts':
            runQueryContracts(basePath, format);
            break;
          case 'diff':
            runQueryDiff(basePath, format);
            break;
          default:
            console.error(`Unknown query subcommand: ${sub ?? '(none)'}. Available: nodes, contracts, diff`);
            process.exit(1);
        }
        break;
      }

      // ── unknown ───────────────────────────────────────────────────────────────
      default:
        console.error(`Unknown command: ${command}`);
        console.log('\n' + HELP);
        process.exit(1);
    }
  } catch (err: unknown) {
    if (format === 'json') {
      console.log(JSON.stringify({ error: String(err) }, null, 2));
    } else {
      console.error(`Error: ${String(err)}`);
    }
    process.exit(1);
  }
}

main().catch((err: unknown) => {
  console.error(String(err));
  process.exit(1);
});
