import { useDesignStore, genId } from '../store';
import { flush } from './flush';
import { getProvider } from './llm/registry';
import { buildCanvasContext, REVIEW_SYSTEM_PROMPT } from './llm/prompts';
import { extractACPProposals } from './acp';

export async function sendChatMessage(canvasId: string, prompt: string) {
  const store = useDesignStore.getState();
  const activeLLM = store.activeLLMProvider;
  if (!activeLLM) {
    store.addChatMessageToCanvas(canvasId, {
      id: genId(), role: 'assistant',
      content: 'No LLM provider selected. Choose one from the dropdown above.',
      timestamp: new Date().toISOString(),
    });
    return;
  }

  const provider = getProvider(activeLLM);
  if (!provider) {
    store.addChatMessageToCanvas(canvasId, {
      id: genId(), role: 'assistant',
      content: `Provider "${activeLLM}" not found.`,
      timestamp: new Date().toISOString(),
    });
    return;
  }

  // User sending a message clears unread (they've engaged with this canvas)
  store.clearUnread(canvasId);

  // Add user message
  store.addChatMessageToCanvas(canvasId, {
    id: genId(), role: 'user', content: prompt,
    timestamp: new Date().toISOString(),
  });

  // Flush to disk before LLM call
  await flush();

  const canvas = store.nodes[canvasId];
  const context = canvas
    ? buildCanvasContext(canvas, store.workspacePath ?? '.', store.version, store.lastCheckpoint)
    : undefined;

  store.setChatLoading(canvasId, true);

  const msgId = genId();
  store.addChatMessageToCanvas(canvasId, {
    id: msgId, role: 'assistant', content: '',
    timestamp: new Date().toISOString(),
  });

  let fullResponse = '';
  try {
    fullResponse = await provider.chatStream(prompt, context, (chunk) => {
      fullResponse += chunk;
      store.updateChatMessageInCanvas(canvasId, msgId, { content: fullResponse });
    }, { systemPrompt: REVIEW_SYSTEM_PROMPT });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    fullResponse = `Error: ${errMsg}`;
    if (errMsg.includes('spawn') || errMsg.includes('Failed')) {
      fullResponse += '\n\nMake sure the CLI tool is installed and on your PATH.';
    }
  }

  store.updateChatMessageInCanvas(canvasId, msgId, { content: fullResponse });

  const proposals = extractACPProposals(fullResponse);
  if (proposals.length > 0) {
    store.updateChatMessageInCanvas(canvasId, msgId, { proposals });
    for (const acp of proposals) store.addPendingACP(acp);
  }

  store.setChatLoading(canvasId, false);
}
