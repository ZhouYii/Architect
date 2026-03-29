import type { CanvasNode, DesignNode } from './types.js';

// ─── Gacha-Service Canvas ─────────────────────────────────────────────────────

const gachaBlocks: DesignNode[] = [
  {
    id: 'banner-manager',
    kind: 'block',
    block_type: 'service',
    name: 'BannerManager',
    status: 'implemented',
    annotation: 'Manages active banners and their rate tables. Loads config from DB on startup.',
    has_children: false,
    contract: {
      invariants: [
        { id: 'inv-1', description: 'Active banner must have valid rate table', satisfied: true },
        { id: 'inv-2', description: 'Banner end_date must be in future', satisfied: true },
      ],
      test_cases: [
        { id: 'tc-1', name: 'test_banner_load', status: 'pass' },
        { id: 'tc-2', name: 'test_expired_banner', status: 'pass' },
        { id: 'tc-3', name: 'test_rate_integrity', status: 'pass' },
      ],
    },
    code_links: [{ file: 'src/gacha/banner_manager.py', line_start: 1, symbol: 'BannerManager' }],
    x: 100,
    y: 80,
  },
  {
    id: 'pull-executor',
    kind: 'block',
    block_type: 'service',
    name: 'PullExecutor',
    status: 'modified',
    annotation: 'Executes pull transactions atomically. Handles multi-pull batching.',
    has_children: false,
    agent_proposed: false,
    contract: {
      invariants: [
        { id: 'inv-3', description: 'Pull must be atomic — either all rewards granted or none', satisfied: true },
        { id: 'inv-4', description: 'Currency deduction happens before reward grant', satisfied: false },
      ],
      test_cases: [
        { id: 'tc-4', name: 'test_single_pull', status: 'pass' },
        { id: 'tc-5', name: 'test_ten_pull', status: 'fail' },
      ],
    },
    code_links: [{ file: 'src/gacha/pull_executor.py', line_start: 1, symbol: 'PullExecutor' }],
    x: 400,
    y: 80,
  },
  {
    id: 'rate-checker',
    kind: 'block',
    block_type: 'module',
    name: 'RateChecker',
    status: 'ready',
    annotation: 'Computes weighted random selection from rate tables. Supports soft and hard pity.',
    has_children: false,
    contract: {
      invariants: [
        { id: 'inv-5', description: 'Sum of all rates must equal 1.0', satisfied: true },
      ],
      test_cases: [
        { id: 'tc-6', name: 'test_rate_sum', status: 'pass' },
        { id: 'tc-7', name: 'test_pity_activation', status: 'pass' },
        { id: 'tc-8', name: 'test_distribution', status: 'skip' },
      ],
    },
    x: 700,
    y: 80,
  },
  {
    id: 'pity-calculator',
    kind: 'block',
    block_type: 'module',
    name: 'PityCalculator',
    status: 'proposed',
    annotation: 'Tracks soft/hard pity counters per player per banner. Proposed addition for v2 pity system.',
    has_children: false,
    agent_proposed: true,
    contract: {
      invariants: [
        { id: 'inv-6', description: 'Hard pity counter resets after guaranteed SSR', satisfied: false },
      ],
      test_cases: [],
    },
    x: 700,
    y: 320,
  },
  {
    id: 'inventory-service',
    kind: 'block',
    block_type: 'data-store',
    name: 'InventoryService',
    status: 'implemented',
    annotation: 'Player inventory CRUD. Backed by PostgreSQL. Emits inventory_changed events.',
    has_children: false,
    contract: {
      invariants: [
        { id: 'inv-7', description: 'Inventory quantities must be non-negative', satisfied: true },
      ],
      test_cases: [
        { id: 'tc-9', name: 'test_add_item', status: 'pass' },
        { id: 'tc-10', name: 'test_remove_item', status: 'pass' },
      ],
    },
    code_links: [{ file: 'src/inventory/service.py', symbol: 'InventoryService' }],
    x: 400,
    y: 320,
  },
  {
    id: 'player-session',
    kind: 'block',
    block_type: 'external',
    name: 'PlayerSession',
    status: 'clean',
    annotation: 'External auth/session service. Read-only from gacha context.',
    has_children: false,
    contract: {
      invariants: [],
      test_cases: [],
    },
    x: 100,
    y: 320,
  },
];

const gachaArrows: DesignNode[] = [
  {
    id: 'arrow-pm-to-pe',
    kind: 'arrow',
    name: 'provides rates',
    status: 'clean',
    source: 'banner-manager',
    target: 'pull-executor',
    arrow_type: 'calls',
    label: 'getRateTable()',
    interface: {
      request_schema: '{ banner_id: string }',
      response_schema: 'RateTable',
      description: 'Fetches the active rate table for a banner',
    },
  },
  {
    id: 'arrow-pe-to-rc',
    kind: 'arrow',
    name: 'check rates',
    status: 'clean',
    source: 'pull-executor',
    target: 'rate-checker',
    arrow_type: 'calls',
    label: 'selectReward()',
    interface: {
      request_schema: '{ rate_table: RateTable, pity: PityState }',
      response_schema: 'Reward',
    },
  },
  {
    id: 'arrow-rc-to-pc',
    kind: 'arrow',
    name: 'pity state',
    status: 'proposed',
    source: 'rate-checker',
    target: 'pity-calculator',
    arrow_type: 'reads',
    label: 'getPity()',
    agent_proposed: true,
  },
  {
    id: 'arrow-pe-to-inv',
    kind: 'arrow',
    name: 'grant item',
    status: 'clean',
    source: 'pull-executor',
    target: 'inventory-service',
    arrow_type: 'writes',
    label: 'addItem()',
    interface: {
      request_schema: '{ player_id: string, item_id: string, qty: number }',
      response_schema: 'void',
    },
  },
  {
    id: 'arrow-ps-to-pe',
    kind: 'arrow',
    name: 'session auth',
    status: 'clean',
    source: 'player-session',
    target: 'pull-executor',
    arrow_type: 'depends',
    label: 'validateSession()',
  },
];

export const gachaCanvas: CanvasNode = {
  id: 'gacha-service',
  label: 'Gacha Service',
  components: gachaBlocks,
  connections: gachaArrows,
  narrative: 'Core gacha pull system. Players spend currency to receive randomized rewards governed by weighted rate tables and pity mechanics.',
  layout: { zoom: 1, pan_x: 0, pan_y: 0 },
};

// ─── Root Canvas ──────────────────────────────────────────────────────────────

const rootBlocks: DesignNode[] = [
  {
    id: 'game-server',
    kind: 'block',
    block_type: 'service',
    name: 'Game Server',
    status: 'modified',
    annotation: 'Core game backend. Contains gacha, inventory, matchmaking subsystems.',
    has_children: true,
    child_canvas_id: 'gacha-service',
    contract: {
      invariants: [],
      test_cases: [],
    },
    x: 200,
    y: 150,
  },
  {
    id: 'client-app',
    kind: 'block',
    block_type: 'external',
    name: 'Client App',
    status: 'clean',
    annotation: 'Unity mobile client. Connects via REST + WebSocket.',
    has_children: false,
    contract: {
      invariants: [],
      test_cases: [],
    },
    x: 500,
    y: 150,
  },
  {
    id: 'db-postgres',
    kind: 'block',
    block_type: 'data-store',
    name: 'PostgreSQL',
    status: 'clean',
    annotation: 'Primary datastore. Player profiles, inventory, transaction logs.',
    has_children: false,
    contract: {
      invariants: [],
      test_cases: [],
    },
    x: 200,
    y: 350,
  },
];

const rootArrows: DesignNode[] = [
  {
    id: 'arrow-client-server',
    kind: 'arrow',
    name: 'API',
    status: 'clean',
    source: 'client-app',
    target: 'game-server',
    arrow_type: 'calls',
    label: 'REST / WS',
  },
  {
    id: 'arrow-server-db',
    kind: 'arrow',
    name: 'persistence',
    status: 'clean',
    source: 'game-server',
    target: 'db-postgres',
    arrow_type: 'reads',
    label: 'SQL',
  },
];

export const rootCanvas: CanvasNode = {
  id: 'root',
  label: 'System Overview',
  components: rootBlocks,
  connections: rootArrows,
  layout: { zoom: 1, pan_x: 0, pan_y: 0 },
};

export const MOCK_CANVASES: Record<string, CanvasNode> = {
  root: rootCanvas,
  'gacha-service': gachaCanvas,
};
