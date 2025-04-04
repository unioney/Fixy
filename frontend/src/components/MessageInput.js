import React, { useState, useEffect } from 'react';

export default function MessageInput({ onSendMessage, onTyping, agents, onAgentMessage }) {
  const [message, setMessage] = useState('');
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [showAgentDropdown, setShowAgentDropdown] = useState(false);

  // Handle typing indicator
  useEffect(() => {
    if (message.trim()) {
      onTyping(true);
    }
    
    const timeout = setTimeout(() => {
      onTyping(false);
    }, 1000);
    
    return () => clearTimeout(timeout);
  }, [message, onTyping]);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!message.trim()) return;
    
    if (selectedAgent) {
      onAgentMessage(message, selectedAgent.id);
    } else {
      onSendMessage(message);
    }
    
    setMessage('');
    setSelectedAgent(null);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="relative">
      <div className="flex items-center">
        {agents.length > 0 && (
          <div className="relative mr-2">
            <button
              type="button"
              onClick={() => setShowAgentDropdown(!showAgentDropdown)}
              className="p-2 rounded-full text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 focus:outline-none"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </button>
            
            {showAgentDropdown && (
              <div className="absolute bottom-full left-0 mb-2 w-48 rounded-md shadow-lg bg-white dark:bg-gray-800 ring-1 ring-black ring-opacity-5 z-10">
                <div className="py-1">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedAgent(null);
                      setShowAgentDropdown(false);
                    }}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    No AI (send as yourself)
                  </button>
                  
                  {agents.map((agent) => (
                    <button
                      key={agent.id}
                      type="button"
                      onClick={() => {
                        setSelectedAgent(agent);
                        setShowAgentDropdown(false);
                      }}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      {agent.name} ({agent.model_name})
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        
        <div className="relative flex-1">
          {selectedAgent && (
            <div className="absolute -top-6 left-0 text-xs text-secondary-600 dark:text-secondary-400">
              Sending to: {selectedAgent.name} ({selectedAgent.model_name})
              <button
                type="button"
                onClick={() => setSelectedAgent(null)}
                className="ml-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                ×
              </button>
            </div>
          )}
          
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white resize-none"
            rows="2"
          />
        </div>
        
        <button
          type="submit"
          disabled={!message.trim()}
          className="ml-2 p-2 rounded-full bg-primary-500 text-white hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </div>
    </form>
  );
}
