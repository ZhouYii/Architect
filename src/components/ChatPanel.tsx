import { useState } from 'react';
import { useDesignStore } from '../store';
import { sendChatMessage } from '../lib/chat';
import { SuggestionCard } from './SuggestionCard';

export function ChatPanel() {
  const [input, setInput] = useState('');
  const canvasPath = useDesignStore((s) => s.currentPath);
  const allChat = useDesignStore((s) => s.chatMessagesByCanvas);
  const allLoading = useDesignStore((s) => s.chatLoadingByCanvas);
  const messages = allChat[canvasPath] ?? [];
  const isLoading = allLoading[canvasPath] ?? false;
  const activeLLMProvider = useDesignStore((s) => s.activeLLMProvider);
  const pendingACPs = useDesignStore((s) => s.pendingACPs);

  const handleSend = () => {
    if (!input.trim()) return;
    sendChatMessage(canvasPath, input.trim());
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="chat-panel">
      <div className="chat-provider-bar">
        <select
          className="field-input"
          value={activeLLMProvider ?? ''}
          onChange={(e) => useDesignStore.getState().setActiveLLMProvider(e.target.value || null)}
        >
          <option value="">No provider</option>
          <option value="claude-code">Claude Code</option>
          <option value="opencode">OpenCode</option>
          <option value="ollama">Ollama</option>
        </select>
      </div>
      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-empty">
            Ask the AI co-designer about your architecture.
            <br />
            Try: "What's missing?" or "Decompose this block"
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`chat-msg chat-msg-${msg.role}`}>
            <div className="chat-msg-role">{msg.role}</div>
            <div className="chat-msg-content">{msg.content}</div>
            {msg.proposals && msg.proposals.length > 0 && (
              <div className="chat-proposals-badge">
                {msg.proposals.length} suggestion{msg.proposals.length > 1 ? 's' : ''} parsed
              </div>
            )}
            {msg.proposals && msg.proposals.map((proposal) => {
              const current = pendingACPs.find((a) => a.id === proposal.id) ?? proposal;
              return current.status === 'pending' ? (
                <SuggestionCard key={proposal.id} acp={current} />
              ) : null;
            })}
          </div>
        ))}
      </div>
      <div className="chat-input-row">
        <textarea
          className="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about your design..."
          rows={2}
          disabled={isLoading}
        />
        <button
          className="chat-send-btn"
          onClick={handleSend}
          disabled={isLoading || !input.trim()}
        >
          Send
        </button>
      </div>
    </div>
  );
}
