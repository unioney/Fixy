import React from 'react';
import { formatDistanceToNow } from 'date-fns';

export default function MessageList({ messages, currentUser, agents }) {
  const getMessageSender = (message) => {
    if (message.is_ai) {
      return message.agent?.name || 'AI';
    } else {
      return message.sender?.name || 'User';
    }
  };

  const isCurrentUser = (message) => {
    return !message.is_ai && message.sender?.id === currentUser?.id;
  };

  const getAgentInfo = (agentId) => {
    return agents.find(agent => agent.id === agentId);
  };

  return (
    <div className="space-y-4">
      {messages.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500 dark:text-gray-400">No messages yet. Start the conversation!</p>
        </div>
      ) : (
        messages.map((message) => (
          <div 
            key={message.id} 
            className={`flex ${isCurrentUser(message) ? 'justify-end' : 'justify-start'}`}
          >
            <div 
              className={`max-w-3/4 rounded-lg px-4 py-2 ${
                isCurrentUser(message)
                  ? 'bg-primary-500 text-white'
                  : message.is_ai
                    ? 'bg-secondary-100 dark:bg-secondary-900 text-gray-800 dark:text-gray-200'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
              }`}
            >
              <div className="flex items-center mb-1">
                <span className="font-medium text-sm">
                  {getMessageSender(message)}
                </span>
                {message.is_ai && (
                  <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-secondary-200 dark:bg-secondary-800 text-secondary-800 dark:text-secondary-200">
                    {getAgentInfo(message.agent?.id)?.model_name || 'AI'}
                  </span>
                )}
                <span className="ml-2 text-xs opacity-70">
                  {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                </span>
              </div>
              <div className="whitespace-pre-wrap">{message.content}</div>
              {message.is_ai && message.credits_used > 0 && (
                <div className="mt-1 text-xs opacity-70 text-right">
                  {message.credits_used} credit{message.credits_used > 1 ? 's' : ''} used
                </div>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
