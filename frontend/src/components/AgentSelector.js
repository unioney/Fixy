import React, { useState, useEffect } from 'react';
import { useChat } from '../contexts/ChatContext';
import { useAuth } from '../contexts/AuthContext';

export default function AgentSelector({ chatroomId, onClose }) {
  const [name, setName] = useState('');
  const [selectedModel, setSelectedModel] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  const { user } = useAuth();
  const { fetchAvailableModels, availableModels, addAgent, loading } = useChat();

  useEffect(() => {
    fetchAvailableModels();
  }, [fetchAvailableModels]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!name.trim() || !selectedModel) {
      setError('Please provide a name and select a model');
      return;
    }
    
    setError('');
    setIsSubmitting(true);
    
    try {
      await addAgent(chatroomId, name, selectedModel.id);
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add AI agent');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Add AI Agent</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {error && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-4">
            <div className="flex">
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}
        
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Agent Name
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input"
              placeholder="e.g., Research Assistant"
              required
            />
          </div>
          
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Select AI Model
            </label>
            
            {loading ? (
              <div className="flex justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-primary-500"></div>
              </div>
            ) : (
              <div className="grid gap-3">
                {availableModels.map((model) => (
                  <div
                    key={model.id}
                    onClick={() => model.available && setSelectedModel(model)}
                    className={`
                      border rounded-lg p-3 cursor-pointer transition-colors
                      ${selectedModel?.id === model.id 
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900' 
                        : 'border-gray-300 dark:border-gray-600'}
                      ${!model.available && 'opacity-50 cursor-not-allowed'}
                    `}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="font-medium text-gray-900 dark:text-white">{model.name}</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{model.provider}</p>
                      </div>
                      
                      {model.credit_cost > 1 && (
                        <span className="text-xs px-2 py-1 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 rounded-full">
                          {model.credit_cost} credits per reply
                        </span>
                      )}
                      
                      {!model.available && model.reason === 'requires_elite_plan' && (
                        <span className="text-xs px-2 py-1 bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded-full">
                          Elite Plan
                        </span>
                      )}
                      
                      {!model.available && model.reason === 'requires_byok' && (
                        <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full">
                          Needs API Key
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {availableModels.some(model => !model.available) && (
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                Some models require the Elite plan or your own API key (BYOK).{' '}
                <a href="/dashboard/subscription" className="text-primary-600 hover:text-primary-500">
                  Upgrade your plan
                </a>
              </p>
            )}
          </div>
          
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-outline mr-3"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !selectedModel || !name.trim()}
              className="btn btn-primary"
            >
              {isSubmitting ? 'Adding...' : 'Add Agent'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
