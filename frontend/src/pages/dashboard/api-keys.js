import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import Sidebar from '../../components/Sidebar';
import { useAuth } from '../../contexts/AuthContext';
import { useSubscription } from '../../contexts/SubscriptionContext';

export default function ApiKeys() {
  const [keys, setKeys] = useState([]);
  const [provider, setProvider] = useState('openai');
  const [apiKey, setApiKey] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const { user, isAuthenticated, loading } = useAuth();
  const { getByokKeys, addByokKey, deleteByokKey } = useSubscription();
  const router = useRouter();

  // Redirect if not authenticated or not on Elite/Teams plan
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    } else if (!loading && isAuthenticated && user && 
               user.plan !== 'Elite' && user.plan !== 'Teams') {
      router.push('/dashboard/subscription');
    }
  }, [isAuthenticated, loading, router, user]);

  // Fetch API keys on mount
  useEffect(() => {
    if (isAuthenticated && (user?.plan === 'Elite' || user?.plan === 'Teams')) {
      fetchKeys();
    }
  }, [isAuthenticated, user]);

  const fetchKeys = async () => {
    try {
      const fetchedKeys = await getByokKeys();
      setKeys(fetchedKeys);
    } catch (err) {
      setError('Failed to fetch API keys');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!apiKey.trim()) {
      setError('Please enter an API key');
      return;
    }
    
    setError('');
    setSuccess('');
    setIsSubmitting(true);
    
    try {
      await addByokKey(provider, apiKey);
      setSuccess(`${provider.toUpperCase()} API key added successfully`);
      setApiKey('');
      fetchKeys();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add API key');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (keyProvider) => {
    if (!confirm(`Are you sure you want to delete your ${keyProvider.toUpperCase()} API key?`)) {
      return;
    }
    
    setError('');
    setSuccess('');
    
    try {
      await deleteByokKey(keyProvider);
      setSuccess(`${keyProvider.toUpperCase()} API key deleted successfully`);
      fetchKeys();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete API key');
    }
  };

  if (loading || !isAuthenticated || (user && user.plan !== 'Elite' && user.plan !== 'Teams')) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <Layout>
      <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
        <Sidebar />
        
        <div className="flex-1 flex flex-col overflow-hidden">
          <header className="bg-white dark:bg-gray-800 shadow">
            <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">API Keys (BYOK)</h1>
            </div>
          </header>
          
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
            <div className="max-w-3xl mx-auto">
              {error && (
                <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
                  <div className="flex">
                    <div className="ml-3">
                      <p className="text-sm text-red-700">{error}</p>
                    </div>
                  </div>
                </div>
              )}
              
              {success && (
                <div className="bg-green-50 border-l-4 border-green-400 p-4 mb-6">
                  <div className="flex">
                    <div className="ml-3">
                      <p className="text-sm text-green-700">{success}</p>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 mb-6">
                <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Bring Your Own API Keys</h2>
                <p className="text-gray-600 dark:text-gray-300 mb-4">
                  Add your own API keys to use with Fixy. Your keys are encrypted and stored securely.
                </p>
                
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label htmlFor="provider" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Provider
                    </label>
                    <select
                      id="provider"
                      value={provider}
                      onChange={(e) => setProvider(e.target.value)}
                      className="input"
                    >
                      <option value="openai">OpenAI (GPT-4o)</option>
                      <option value="anthropic">Anthropic (Claude)</option>
                      <option value="google">Google (Gemini)</option>
                    </select>
                  </div>
                  
                  <div>
                    <label htmlFor="apiKey" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      API Key
                    </label>
                    <input
                      id="apiKey"
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      className="input"
                      placeholder="Enter your API key"
                    />
                  </div>
                  
                  <div>
                    <button
                      type="submit"
                      disabled={isSubmitting || !apiKey.trim()}
                      className="btn btn-primary"
                    >
                      {isSubmitting ? 'Adding...' : 'Add API Key'}
                    </button>
                  </div>
                </form>
              </div>
              
              <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
                <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Your API Keys</h2>
                
                {keys.length === 0 ? (
                  <p className="text-gray-600 dark:text-gray-300">
                    You haven't added any API keys yet.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {keys.map((key) => (
                      <div 
                        key={key.provider}
                        className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-md"
                      >
                        <div>
                          <h3 className="font-medium text-gray-900 dark:text-white">
                            {key.provider.toUpperCase()}
                          </h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            Added on {new Date(key.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <button
                          onClick={() => handleDelete(key.provider)}
                          className="text-red-600 hover:text-red-800"
                        >
                          Delete
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </main>
        </div>
      </div>
    </Layout>
  );
}
