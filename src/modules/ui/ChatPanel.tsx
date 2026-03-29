// ─── Chat Panel ───────────────────────────────────────────────────────────────
// Per-canvas chat with LLM providers. Parses agent responses for changesets.

import { useState, useEffect, useRef } from 'react';
import { useDesignStore } from '../store/store.js';
import { selectCurrentCanvasId, selectCurrentCanvas } from '../store/selectors.js';
import { TOKENS } from '../../styles/theme.js';
import type { ChatMessage } from '../store/types.js';
import { getProvider, detectAvailableProviders, getAllProviders } from '../agent/registry.js';
import type { LLMProvider } from '../agent/provider.js';
import { ELABORATE_DESIGN_PROMPT, serializeCanvasContext } from '../agent/skills.js';
import { parseChangeset } from '../changesets/parser.js';

// ─── Message bubble ───────────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === 'user';
  const hasChangeset = !!msg.changeset_id;

  const setTab = useDesignStore((s) => s.setSidePanelTab);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isUser ? 'flex-end' : 'flex-start',
        marginBottom: 10,
      }}
    >
      <div
        style={{
          maxWidth: '88%',
          padding: '8px 12px',
          borderRadius: isUser ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
          background: isUser ? TOKENS.accentDim : `${TOKENS.statusAmber}18`,
          border: `1px solid ${isUser ? TOKENS.accent + '44' : TOKENS.statusAmber + '44'}`,
          fontSize: 12,
          color: TOKENS.textPrimary,
          lineHeight: 1.55,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {msg.content}
      </div>

      {hasChangeset && (
        <div
          style={{
            marginTop: 5,
            padding: '5px 10px',
            background: `${TOKENS.statusAmber}22`,
            border: `1px solid ${TOKENS.statusAmber}55`,
            borderRadius: 8,
            fontSize: 11,
            color: TOKENS.statusAmber,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
          onClick={() => setTab('changesets')}
          title="Open Changesets tab"
        >
          <span>≡</span>
          <span>Changeset proposed · Open in Changesets tab</span>
        </div>
      )}

      <div style={{ fontSize: 10, color: TOKENS.textGhost, marginTop: 3, paddingLeft: 2, paddingRight: 2 }}>
        {new Date(msg.timestamp).toLocaleTimeString()}
      </div>
    </div>
  );
}

// ─── Provider selector ────────────────────────────────────────────────────────

function ProviderSelector({
  selectedId,
  providers,
  onSelect,
}: {
  selectedId: string;
  providers: LLMProvider[];
  onSelect: (id: string) => void;
}) {
  return (
    <select
      value={selectedId}
      onChange={(e) => onSelect(e.target.value)}
      style={{
        background: TOKENS.bgSurfaceRaised,
        color: TOKENS.textSecondary,
        border: `1px solid ${TOKENS.border}`,
        borderRadius: 4,
        padding: '4px 8px',
        fontSize: 11,
        cursor: 'pointer',
        outline: 'none',
        flex: '0 0 auto',
      }}
    >
      {providers.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  );
}

// ─── Loading indicator ────────────────────────────────────────────────────────

function ThinkingIndicator() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 12,
        color: TOKENS.statusAmber,
        padding: '6px 12px',
        marginBottom: 8,
      }}
    >
      <span style={{ animation: 'pulseAmber 1.2s ease-in-out infinite' }}>◆</span>
      <span>Thinking…</span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ChatPanel() {
  const canvasId = useDesignStore(selectCurrentCanvasId);
  const canvas = useDesignStore(selectCurrentCanvas);
  const messages = useDesignStore((s) => s.chatMessagesByCanvas[canvasId] ?? []);
  const isLoading = useDesignStore((s) => s.chatLoadingByCanvas[canvasId] ?? false);
  const selectedProviderId = useDesignStore((s) => s.selectedProviderId);

  const addChatMessage = useDesignStore((s) => s.addChatMessage);
  const setChatLoading = useDesignStore((s) => s.setChatLoading);
  const addChangeset = useDesignStore((s) => s.addChangeset);
  const setSelectedProvider = useDesignStore((s) => s.setSelectedProvider);

  const [input, setInput] = useState('');
  const [providers, setProviders] = useState<LLMProvider[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Detect available providers on mount
  useEffect(() => {
    detectAvailableProviders().then((detected) => {
      setProviders(detected.length > 0 ? detected : getAllProviders());
      // Default to first available
      if (detected.length > 0 && selectedProviderId === 'mock') {
        setSelectedProvider(detected[0].id);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    setInput('');

    // Add user message
    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}-user`,
      role: 'user',
      content: trimmed,
      timestamp: new Date().toISOString(),
    };
    addChatMessage(canvasId, userMsg);
    setChatLoading(canvasId, true);

    try {
      // Get provider
      const provider = getProvider(selectedProviderId);
      if (!provider) throw new Error(`Provider '${selectedProviderId}' not found`);

      // Serialize current canvas as context
      const context = serializeCanvasContext(canvas);

      // Call provider
      const response = await provider.chat(trimmed, context, {
        systemPrompt: ELABORATE_DESIGN_PROMPT,
      });

      // Parse for changesets
      const changeset = parseChangeset(response, canvasId);
      let changesetId: string | undefined;

      if (changeset) {
        addChangeset(changeset);
        changesetId = changeset.id;
      }

      // Add agent message
      const agentMsg: ChatMessage = {
        id: `msg-${Date.now()}-agent`,
        role: 'agent',
        content: response,
        timestamp: new Date().toISOString(),
        changeset_id: changesetId,
      };
      addChatMessage(canvasId, agentMsg);
    } catch (err) {
      const errMsg: ChatMessage = {
        id: `msg-${Date.now()}-err`,
        role: 'agent',
        content: `Error: ${err instanceof Error ? err.message : String(err)}`,
        timestamp: new Date().toISOString(),
      };
      addChatMessage(canvasId, errMsg);
    } finally {
      setChatLoading(canvasId, false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        background: TOKENS.bgBase,
      }}
    >
      {/* Provider selector bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 12px',
          borderBottom: `1px solid ${TOKENS.border}`,
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 11, color: TOKENS.textTertiary, flex: 1 }}>Provider</span>
        <ProviderSelector
          selectedId={selectedProviderId}
          providers={providers}
          onSelect={setSelectedProvider}
        />
      </div>

      {/* Message list */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px 12px 4px 12px',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {messages.length === 0 && !isLoading && (
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: TOKENS.textTertiary,
              gap: 8,
            }}
          >
            <span style={{ fontSize: 24 }}>◆</span>
            <span style={{ fontSize: 13 }}>Chat with the design agent</span>
            <span
              style={{
                fontSize: 11,
                textAlign: 'center',
                color: TOKENS.textGhost,
                maxWidth: 220,
                lineHeight: 1.5,
              }}
            >
              Describe a change, ask a question, or say "elaborate this design" to get proposed nodes.
            </span>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} />
        ))}

        {isLoading && <ThinkingIndicator />}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div
        style={{
          padding: '8px 12px 12px',
          borderTop: `1px solid ${TOKENS.border}`,
          flexShrink: 0,
          display: 'flex',
          gap: 8,
          alignItems: 'flex-end',
        }}
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Describe a design change… (Enter to send, Shift+Enter for newline)"
          rows={3}
          disabled={isLoading}
          style={{
            flex: 1,
            resize: 'none',
            background: TOKENS.bgSurfaceRaised,
            color: TOKENS.textPrimary,
            border: `1px solid ${TOKENS.border}`,
            borderRadius: 6,
            padding: '8px 10px',
            fontSize: 12,
            lineHeight: 1.5,
            outline: 'none',
            opacity: isLoading ? 0.5 : 1,
          }}
        />
        <button
          onClick={() => void handleSend()}
          disabled={isLoading || input.trim() === ''}
          style={{
            padding: '8px 14px',
            background: isLoading || input.trim() === '' ? TOKENS.bgSurfaceRaised : TOKENS.accent,
            color: isLoading || input.trim() === '' ? TOKENS.textTertiary : '#fff',
            border: `1px solid ${TOKENS.border}`,
            borderRadius: 6,
            fontSize: 12,
            cursor: isLoading || input.trim() === '' ? 'not-allowed' : 'pointer',
            flexShrink: 0,
            alignSelf: 'flex-end',
            transition: 'background 120ms, color 120ms',
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}

