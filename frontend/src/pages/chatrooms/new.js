import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import Sidebar from '../../components/Sidebar';
import { useAuth } from '../../contexts/AuthContext';
import { useChat } from '../../contexts/ChatContext';

export default function NewChatroom() {
  const [title, setTitle] = useState('');
  const [type, setType] = useState('private');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  const { user, isAuthenticated, loading } = useAuth();
  const { createChatroom } = useChat();
  const router = useRouter();

  // Redirect if not authenticated
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, loading, router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      // Check if user can create group chatrooms (Teams plan only)
      if (type === 'group' && user?.plan !== 'Teams') {
        setError('Group chatrooms require the Teams plan. Please upgrade to create group chatrooms.');
        return;
      }

      const chatroom = await createChatroom(title, type);
      router.push(`/chatrooms/${chatroom.id}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create chatroom');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading || !isAuthenticated) {
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
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Create New Chatroom</h1>
            </div>
          </header>
          
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
            <div className="max-w-3xl mx-auto">
              <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
                {error && (
                  <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
                    <div className="flex">
                      <div className="ml-3">
                        <p className="text-sm text-red-700">{error}</p>
                      </div>
                    </div>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Chatroom Title
                    </label>
                    <div className="mt-1">
                      <input
                        id="title"
                        name="title"
                        type="text"
                        required
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="input"
                        placeholder="Enter a name for your chatroom"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Chatroom Type
                    </label>
                    <div className="mt-2 space-y-4">
                      <div className="flex items-center">
                        <input
                          id="private"
                          name="type"
                          type="radio"
                          value="private"
                          checked={type === 'private'}
                          onChange={() => setType('private')}
                          className="h-4 w-4 text-primary-600 focus:ring-primary-500"
                        />
                        <label htmlFor="private" className="ml-3 block text-sm font-medium text-gray-700 dark:text-gray-300">
                          Private (just you and AI agents)
                        </label>
                      </div>
                      <div className="flex items-center">
                        <input
                          id="group"
                          name="type"
                          type="radio"
                          value="group"
                          checked={type === 'group'}
                          onChange={() => setType('group')}
                          className="h-4 w-4 text-primary-600 focus:ring-primary-500"
                        />
                        <label htmlFor="group" className="ml-3 block text-sm font-medium text-gray-700 dark:text-gray-300">
                          Group (invite human teammates - Teams plan only)
                        </label>
                      </div>
                    </div>
                    {type === 'group' && user?.plan !== 'Teams' && (
                      <p className="mt-2 text-sm text-yellow-600">
                        Group chatrooms require the Teams plan. You'll need to upgrade to create this type of chatroom.
                      </p>
                    )}
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => router.push('/dashboard')}
                      className="btn btn-outline mr-3"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmitting || (type === 'group' && user?.plan !== 'Teams')}
                      className="btn btn-primary"
                    >
                      {isSubmitting ? 'Creating...' : 'Create Chatroom'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </main>
        </div>
      </div>
    </Layout>
  );
}
