import { useState, type ReactNode } from 'react';
import { useDesignStore } from '../store';

export function TreeNavigator() {
  const nodes = useDesignStore((s) => s.nodes);
  const currentPath = useDesignStore((s) => s.currentPath);
  const navigateTo = useDesignStore((s) => s.navigateTo);
  const loadingMap = useDesignStore((s) => s.chatLoadingByCanvas);
  const unreadMap = useDesignStore((s) => s.chatUnreadByCanvas);
  // Start with all nodes expanded
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const all: Record<string, boolean> = {};
    for (const id of Object.keys(nodes)) all[id] = true;
    return all;
  });

  function toggleExpand(nodeId: string, e: React.MouseEvent) {
    e.stopPropagation();
    setExpanded((prev) => ({ ...prev, [nodeId]: !prev[nodeId] }));
  }

  function renderNode(nodeId: string, depth: number): ReactNode {
    const node = nodes[nodeId];
    if (!node) return null;
    const children = Object.values(nodes).filter((n) => n.parentId === nodeId);
    const hasChildren = children.length > 0;
    const isExpanded = expanded[nodeId] ?? false;
    const isActive = currentPath === nodeId;

    return (
      <div key={nodeId}>
        <button
          className={`tree-node ${isActive ? 'tree-node-active' : ''}`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => navigateTo(nodeId)}
        >
          {hasChildren ? (
            <span
              className={`tree-node-toggle ${isExpanded ? 'expanded' : ''}`}
              onClick={(e) => toggleExpand(nodeId, e)}
            >
              {isExpanded ? '\u25BE' : '\u25B8'}
            </span>
          ) : (
            <span className="tree-node-toggle leaf">{'\u2022'}</span>
          )}
          <span className="tree-node-label">{node.label}</span>
          <span className="tree-node-count">{node.components.length}</span>
          {loadingMap[nodeId] && <span className="activity-dot activity-loading" />}
          {!loadingMap[nodeId] && unreadMap[nodeId] && <span className="activity-dot activity-unread" />}
        </button>
        {hasChildren && isExpanded && (
          <div className="tree-node-children">
            {children.map((child) => renderNode(child.id, depth + 1))}
          </div>
        )}
      </div>
    );
  }

  const roots = Object.values(nodes).filter((n) => n.parentId === null);

  // Auto-expand path to current canvas
  const ensurePathExpanded = () => {
    let id: string | null = currentPath;
    const toExpand: Record<string, boolean> = {};
    while (id) {
      toExpand[id] = true;
      id = nodes[id]?.parentId ?? null;
    }
    const needsUpdate = Object.keys(toExpand).some((k) => !expanded[k]);
    if (needsUpdate) {
      setExpanded((prev) => ({ ...prev, ...toExpand }));
    }
  };
  // Run once on render if current path ancestors aren't expanded
  ensurePathExpanded();

  return (
    <div className="tree-navigator">
      <div className="tree-navigator-header">Design Tree</div>
      <div className="tree-navigator-content">
        {roots.map((root) => renderNode(root.id, 0))}
      </div>
    </div>
  );
}
