import { useState, useEffect } from 'react';
import { useDesignStore } from '../store';
import { ChatPanel } from './ChatPanel';
import { ContractDashboard } from './ContractDashboard';
import { listVersions, restoreVersion } from '../lib/workspace';
import { diffWorkspaces } from '../lib/diff';
import { createEmptyContract } from '../lib/contracts';
import type { ContractSet, ContractEntry, TestCase, ArrowType, ArrowInterface, BlockType, Status } from '../types';
import { genId } from '../store';

type Tab = 'details' | 'interfaces' | 'notes' | 'contracts' | 'chat' | 'versions' | 'dashboard';

export function SidePanel() {
  const [activeTab, setActiveTab] = useState<Tab>('details');
  const [panelWidth, setPanelWidth] = useState(380);
  const [dragging, setDragging] = useState(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(true);
  };

  useEffect(() => {
    if (!dragging) return;
    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = window.innerWidth - e.clientX;
      setPanelWidth(Math.max(280, Math.min(700, newWidth)));
    };
    const handleMouseUp = () => setDragging(false);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging]);
  const [versions, setVersions] = useState<string[]>([]);
  const selectedBlockId = useDesignStore((s) => s.selectedBlockId);
  const selectedArrowId = useDesignStore((s) => s.selectedArrowId);
  const currentPath = useDesignStore((s) => s.currentPath);
  const nodes = useDesignStore((s) => s.nodes);
  const updateBlock = useDesignStore((s) => s.updateBlock);
  const workspacePath = useDesignStore((s) => s.workspacePath);
  const setShowMergeReview = useDesignStore((s) => s.setShowMergeReview);
  const setDiffEntries = useDesignStore((s) => s.setDiffEntries);
  const removeArrow = useDesignStore((s) => s.removeArrow);
  const updateArrow = useDesignStore((s) => s.updateArrow);
  const createChildCanvas = useDesignStore((s) => s.createChildCanvas);
  const navigateTo = useDesignStore((s) => s.navigateTo);

  const canvas = nodes[currentPath];
  const selectedBlock = canvas?.components.find((b) => b.id === selectedBlockId);
  const selectedArrow = canvas?.connections.find((a) => a.id === selectedArrowId);

  const tabs: Tab[] = ['details', 'interfaces', 'notes', 'contracts', 'chat', 'versions', 'dashboard'];

  // Load versions when switching to versions tab
  useEffect(() => {
    if (activeTab === 'versions' && workspacePath) {
      listVersions(workspacePath).then(setVersions);
    }
  }, [activeTab, workspacePath]);

  const handleRestore = async (ver: number) => {
    if (!workspacePath) return;
    if (confirm(`Restore to v${ver}? Current unsaved changes will be lost.`)) {
      await restoreVersion(workspacePath, ver);
    }
  };

  const handleCompare = async () => {
    // Placeholder: compare current vs empty (real diff requires loading archive)
    // This triggers the merge review UI
    const entries = diffWorkspaces({}, nodes);
    setDiffEntries(entries);
    setShowMergeReview(true);
  };

  // Contract helpers
  const contracts: ContractSet = selectedBlock?.contract ?? createEmptyContract();

  const updateContracts = (updated: ContractSet) => {
    if (!selectedBlock) return;
    updateBlock(selectedBlock.id, { contract: updated });
  };

  const addInvariant = () => {
    const entry: ContractEntry = { id: genId(), description: '', status: 'draft' };
    updateContracts({
      ...contracts,
      invariants: [...contracts.invariants, entry],
    });
  };

  const updateInvariant = (idx: number, value: string) => {
    const inv = [...contracts.invariants];
    inv[idx] = { ...inv[idx], description: value };
    updateContracts({ ...contracts, invariants: inv });
  };

  const removeInvariant = (idx: number) => {
    updateContracts({
      ...contracts,
      invariants: contracts.invariants.filter((_, i) => i !== idx),
    });
  };

  const addPrecondition = () => {
    const entry: ContractEntry = { id: genId(), description: '', status: 'draft' };
    updateContracts({
      ...contracts,
      preconditions: [...contracts.preconditions, entry],
    });
  };

  const updatePrecondition = (idx: number, value: string) => {
    const pre = [...contracts.preconditions];
    pre[idx] = { ...pre[idx], description: value };
    updateContracts({ ...contracts, preconditions: pre });
  };

  const removePrecondition = (idx: number) => {
    updateContracts({
      ...contracts,
      preconditions: contracts.preconditions.filter((_, i) => i !== idx),
    });
  };

  const addPostcondition = () => {
    const entry: ContractEntry = { id: genId(), description: '', status: 'draft' };
    updateContracts({
      ...contracts,
      postconditions: [...contracts.postconditions, entry],
    });
  };

  const updatePostcondition = (idx: number, value: string) => {
    const post = [...contracts.postconditions];
    post[idx] = { ...post[idx], description: value };
    updateContracts({ ...contracts, postconditions: post });
  };

  const removePostcondition = (idx: number) => {
    updateContracts({
      ...contracts,
      postconditions: contracts.postconditions.filter((_, i) => i !== idx),
    });
  };

  const addTestCase = () => {
    const tc: TestCase = {
      id: genId(),
      name: 'New test',
      inputs: {},
      expectedOutputs: {},
    };
    updateContracts({
      ...contracts,
      test_cases: [...contracts.test_cases, tc],
    });
  };

  const removeTestCase = (idx: number) => {
    updateContracts({
      ...contracts,
      test_cases: contracts.test_cases.filter((_, i) => i !== idx),
    });
  };

  return (
    <div className="side-panel" style={{ width: panelWidth }}>
      <div className="resize-handle" onMouseDown={handleMouseDown} />
      <div className="side-panel-tabs">
        {tabs.map((tab) => (
          <button
            key={tab}
            className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      <div className="side-panel-content">
        {activeTab === 'details' && (
          <div className="panel-section">
            {selectedBlock ? (
              <>
                <h3>Block: {selectedBlock.label}</h3>
                <label className="field-label">
                  Label
                  <input
                    type="text"
                    className="field-input"
                    value={selectedBlock.label}
                    onChange={(e) =>
                      updateBlock(selectedBlock.id, { label: e.target.value })
                    }
                  />
                </label>
                <label className="field-label">
                  Type
                  <select
                    className="field-input"
                    value={selectedBlock.type ?? ''}
                    onChange={(e) =>
                      updateBlock(selectedBlock.id, { type: (e.target.value || undefined) as BlockType | undefined })
                    }
                  >
                    <option value="">--</option>
                    <option value="service">service</option>
                    <option value="module">module</option>
                    <option value="class">class</option>
                    <option value="function">function</option>
                    <option value="data-store">data-store</option>
                    <option value="external">external</option>
                    <option value="queue">queue</option>
                    <option value="config">config</option>
                  </select>
                </label>
                <label className="field-label">
                  Status
                  <select
                    className="field-input"
                    value={selectedBlock.status ?? ''}
                    onChange={(e) =>
                      updateBlock(selectedBlock.id, { status: (e.target.value || undefined) as Status | undefined })
                    }
                  >
                    <option value="">--</option>
                    <option value="draft">draft</option>
                    <option value="approved">approved</option>
                    <option value="implementing">implementing</option>
                    <option value="done">done</option>
                    <option value="deprecated">deprecated</option>
                  </select>
                </label>
                <label className="field-label">
                  Annotation
                  <textarea
                    className="field-textarea"
                    value={selectedBlock.annotation ?? ''}
                    onChange={(e) =>
                      updateBlock(selectedBlock.id, { annotation: e.target.value })
                    }
                  />
                </label>
                <div className="port-list">
                  <h4>Ports ({selectedBlock.ports.length})</h4>
                  {selectedBlock.ports.map((p) => (
                    <div key={p.id} className="port-item">
                      <span className={`port-dir port-dir-${p.direction}`}>
                        {p.direction}
                      </span>
                      <span>{p.label}</span>
                    </div>
                  ))}
                </div>
                {!selectedBlock.hasChildren && (
                  <button
                    className="toolbar-btn"
                    style={{ marginTop: 12 }}
                    onClick={() => {
                      createChildCanvas(currentPath, selectedBlock.id);
                      navigateTo(selectedBlock.id);
                    }}
                  >
                    Decompose into child canvas
                  </button>
                )}
                {selectedBlock.hasChildren && (
                  <button
                    className="toolbar-btn toolbar-btn-primary"
                    style={{ marginTop: 12 }}
                    onClick={() => navigateTo(selectedBlock.id)}
                  >
                    Enter child canvas
                  </button>
                )}
              </>
            ) : selectedArrow ? (
              <>
                <h3>Arrow: {selectedArrow.label || `${selectedArrow.from} \u2192 ${selectedArrow.to}`}</h3>
                <div className="field-label">
                  <span>From</span>
                  <span className="field-input" style={{ background: 'var(--bg)' }}>
                    {canvas?.components.find((b) => b.id === selectedArrow.from)?.label ?? selectedArrow.from}
                  </span>
                </div>
                <div className="field-label">
                  <span>To</span>
                  <span className="field-input" style={{ background: 'var(--bg)' }}>
                    {canvas?.components.find((b) => b.id === selectedArrow.to)?.label ?? selectedArrow.to}
                  </span>
                </div>
                <label className="field-label">
                  Label
                  <input
                    type="text"
                    className="field-input"
                    value={selectedArrow.label ?? ''}
                    onChange={(e) =>
                      updateArrow(selectedArrow.id, { label: e.target.value })
                    }
                  />
                </label>
                <label className="field-label">
                  Type
                  <select
                    className="field-input"
                    value={selectedArrow.type ?? ''}
                    onChange={(e) =>
                      updateArrow(selectedArrow.id, {
                        type: (e.target.value || undefined) as ArrowType | undefined,
                      })
                    }
                  >
                    <option value="">--</option>
                    <option value="calls">calls</option>
                    <option value="reads">reads</option>
                    <option value="writes">writes</option>
                    <option value="publishes">publishes</option>
                    <option value="subscribes">subscribes</option>
                    <option value="depends">depends</option>
                  </select>
                </label>

                <h4 style={{ marginTop: 12 }}>Interface</h4>
                <label className="field-label">
                  Request
                  <textarea
                    className="field-textarea"
                    value={selectedArrow.interface?.request ?? ''}
                    onChange={(e) => {
                      const iface: ArrowInterface = { ...selectedArrow.interface, request: e.target.value };
                      updateArrow(selectedArrow.id, { interface: iface });
                    }}
                    placeholder="e.g. { userId: string, amount: number }"
                  />
                </label>
                <label className="field-label">
                  Response
                  <textarea
                    className="field-textarea"
                    value={selectedArrow.interface?.response ?? ''}
                    onChange={(e) => {
                      const iface: ArrowInterface = { ...selectedArrow.interface, response: e.target.value };
                      updateArrow(selectedArrow.id, { interface: iface });
                    }}
                    placeholder="e.g. { success: boolean, data: Item[] }"
                  />
                </label>
                <label className="field-label" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <input
                    type="checkbox"
                    checked={selectedArrow.interface?.async ?? false}
                    onChange={(e) => {
                      const iface: ArrowInterface = { ...selectedArrow.interface, async: e.target.checked };
                      updateArrow(selectedArrow.id, { interface: iface });
                    }}
                  />
                  Async
                </label>
                <label className="field-label">
                  Error Handling
                  <select
                    className="field-input"
                    value={selectedArrow.interface?.error_handling ?? ''}
                    onChange={(e) => {
                      const iface: ArrowInterface = {
                        ...selectedArrow.interface,
                        error_handling: (e.target.value || undefined) as ArrowInterface['error_handling'],
                      };
                      updateArrow(selectedArrow.id, { interface: iface });
                    }}
                  >
                    <option value="">--</option>
                    <option value="throw">throw</option>
                    <option value="rollback">rollback</option>
                    <option value="retry">retry</option>
                    <option value="ignore">ignore</option>
                  </select>
                </label>
                <label className="field-label">
                  Protocol
                  <select
                    className="field-input"
                    value={selectedArrow.interface?.protocol ?? ''}
                    onChange={(e) => {
                      const iface: ArrowInterface = {
                        ...selectedArrow.interface,
                        protocol: (e.target.value || undefined) as ArrowInterface['protocol'],
                      };
                      updateArrow(selectedArrow.id, { interface: iface });
                    }}
                  >
                    <option value="">--</option>
                    <option value="rpc">rpc</option>
                    <option value="event">event</option>
                    <option value="stream">stream</option>
                    <option value="http">http</option>
                  </select>
                </label>

                <button
                  className="toolbar-btn"
                  style={{ marginTop: 12, color: 'var(--danger)' }}
                  onClick={() => removeArrow(selectedArrow.id)}
                >
                  Delete Arrow
                </button>
              </>
            ) : (
              <div className="panel-empty">
                <p>Select a block or arrow to view details</p>
                <p className="hint">
                  Canvas: <strong>{canvas?.label}</strong>
                </p>
                <p className="hint">
                  {canvas?.components.length} blocks, {canvas?.connections.length} connections
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'interfaces' && (
          <div className="panel-section">
            {selectedBlock ? (
              <>
                <h3>Interfaces: {selectedBlock.label}</h3>
                <textarea
                  className="code-editor"
                  value={selectedBlock.interfacesContent ?? '// TypeScript interfaces\n'}
                  onChange={(e) =>
                    updateBlock(selectedBlock.id, {
                      interfacesContent: e.target.value,
                    })
                  }
                  spellCheck={false}
                />
              </>
            ) : (
              <div className="panel-empty">Select a block to edit interfaces</div>
            )}
          </div>
        )}

        {activeTab === 'notes' && (
          <div className="panel-section">
            {selectedBlock ? (
              <>
                <h3>Notes: {selectedBlock.label}</h3>
                <textarea
                  className="notes-editor"
                  value={selectedBlock.notesContent ?? ''}
                  onChange={(e) =>
                    updateBlock(selectedBlock.id, {
                      notesContent: e.target.value,
                    })
                  }
                  placeholder="Design notes, decisions, rationale..."
                />
              </>
            ) : (
              <div className="panel-empty">Select a block to edit notes</div>
            )}
          </div>
        )}

        {activeTab === 'contracts' && (
          <div className="panel-section">
            {selectedBlock ? (
              <>
                <h3>Contracts: {selectedBlock.label}</h3>
                <h4>Invariants</h4>
                {contracts.invariants.map((inv, i) => (
                  <div key={inv.id} className="contract-row">
                    <input
                      type="text"
                      className="field-input"
                      value={inv.description}
                      onChange={(e) => updateInvariant(i, e.target.value)}
                      placeholder="e.g. response_time < 200ms"
                    />
                    <button className="contract-remove" onClick={() => removeInvariant(i)}>x</button>
                  </div>
                ))}
                <button className="toolbar-btn" onClick={addInvariant} style={{ marginTop: 6 }}>
                  + Invariant
                </button>

                <h4 style={{ marginTop: 12 }}>Preconditions</h4>
                {contracts.preconditions.map((pre, i) => (
                  <div key={pre.id} className="contract-row">
                    <input
                      type="text"
                      className="field-input"
                      value={pre.description}
                      onChange={(e) => updatePrecondition(i, e.target.value)}
                      placeholder="e.g. user must be authenticated"
                    />
                    <button className="contract-remove" onClick={() => removePrecondition(i)}>x</button>
                  </div>
                ))}
                <button className="toolbar-btn" onClick={addPrecondition} style={{ marginTop: 6 }}>
                  + Precondition
                </button>

                <h4 style={{ marginTop: 12 }}>Postconditions</h4>
                {contracts.postconditions.map((post, i) => (
                  <div key={post.id} className="contract-row">
                    <input
                      type="text"
                      className="field-input"
                      value={post.description}
                      onChange={(e) => updatePostcondition(i, e.target.value)}
                      placeholder="e.g. data is persisted to store"
                    />
                    <button className="contract-remove" onClick={() => removePostcondition(i)}>x</button>
                  </div>
                ))}
                <button className="toolbar-btn" onClick={addPostcondition} style={{ marginTop: 6 }}>
                  + Postcondition
                </button>

                <h4 style={{ marginTop: 12 }}>Test Cases</h4>
                {contracts.test_cases.map((tc, i) => (
                  <div key={tc.id} className="contract-row">
                    <span className="hint">{tc.name}</span>
                    <button className="contract-remove" onClick={() => removeTestCase(i)}>x</button>
                  </div>
                ))}
                <button className="toolbar-btn" onClick={addTestCase} style={{ marginTop: 6 }}>
                  + Test Case
                </button>
              </>
            ) : (
              <div className="panel-empty">Select a block to edit contracts</div>
            )}
          </div>
        )}

        {activeTab === 'chat' && <ChatPanel />}

        {activeTab === 'versions' && (
          <div className="panel-section">
            <h3>Version History</h3>
            <button className="toolbar-btn" onClick={handleCompare} style={{ marginBottom: 10 }}>
              Compare with last major
            </button>
            {versions.length === 0 ? (
              <p className="hint">No snapshots yet. Click "Export Snapshot" to create one.</p>
            ) : (
              <div className="version-list">
                {versions.map((v) => {
                  const match = v.match(/v(\d+)/);
                  const num = match ? parseInt(match[1]) : 0;
                  return (
                    <div key={v} className="version-item">
                      <span>v{num}.0</span>
                      <button
                        className="toolbar-btn"
                        onClick={() => handleRestore(num)}
                      >
                        Restore
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'dashboard' && <ContractDashboard />}
      </div>
    </div>
  );
}
