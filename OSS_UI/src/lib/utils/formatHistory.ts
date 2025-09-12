// src/lib/utils/formatHistory.ts
const formatChatHistoryAsString = (history: any[]) => {
  return history
    .map((message) => {
      // Check if it's an AI message using the role property
      // Your frontend uses 'assistant' for AI messages and 'user' for user messages
      const isAI = message.role === 'assistant';
      return `${isAI ? 'AI' : 'User'}: ${message.content}`;
    })
    .join('\n');
};

export default formatChatHistoryAsString;