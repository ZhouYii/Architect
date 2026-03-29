/**
 * Level 2 — Visual Design Canvas internal interfaces.
 *
 * These types describe the data shapes flowing between the canvas's
 * sub-components: rendering, navigation, editing, state, and layout.
 */

/** The subset of store state that the diagram renderer subscribes to. */
export interface RendererSlice {
  /** Blocks visible on the currently active canvas. */
  components: import('../../types').Block[];
  /** Arrows between those blocks. */
  connections: import('../../types').Arrow[];
  /** Block positions keyed by block ID. */
  layout: import('../../types').CanvasLayout;
  /** Currently selected block, if any. */
  selectedBlockId: string | null;
  /** Currently selected arrow, if any. */
  selectedArrowId: string | null;
}

/** A position change produced by drag-drop or auto-layout. */
export interface PositionUpdate {
  blockId: string;
  position: { x: number; y: number };
}

/** Navigation action: which canvas to display and the breadcrumb trail. */
export interface NavigationTarget {
  canvasId: string;
  /** Full path from root to target, computed by walking parentId chain. */
  breadcrumb: Array<{ canvasId: string; label: string }>;
}

/** Property edit dispatched from the element editing panel. */
export interface PropertyEdit {
  entityType: 'block' | 'arrow';
  entityId: string;
  /** Partial update — only the changed fields. */
  updates: Record<string, unknown>;
}

/** The contract between the store and all subscribers. */
export interface StoreContract {
  /** Every mutation sets dirty=true, which triggers scheduled flush. */
  dirtyTracking: true;
  /** Selectors are fine-grained to prevent unnecessary re-renders. */
  selectorGranularity: 'per-field';
  /** State is immutable from the consumer's perspective (Immer). */
  immutabilityModel: 'structural-sharing-via-immer';
}
