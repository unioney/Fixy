import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthContext';
import Layout from '../components/Layout';
import Sidebar from '../components/Sidebar';
import ChatroomList from '../components/ChatroomList';
import { useChat } from '../contexts/ChatContext';

export default function Dashboard() {
  const { user, isAuthenticated, loading } = useAuth();
  const { fetchChatrooms, chatrooms, loading: chatroomsLoading } = useChat();
  const router = useRouter();

  // Redirect if not authenticated
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, loading, router]);

  // Fetch chatrooms on mount
  useEffect(() => {
    if (isAuthenticated) {
      fetchChatrooms();
    }
  }, [isAuthenticated, fetchChatrooms]);

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
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Dashboard</h1>
            </div>
          </header>
          
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
            <div className="max-w-7xl mx-auto">
              <div className="mb-8">
                <h2 className="text-xl font-medium text-gray-900 dark:text-white mb-4">Welcome, {user?.name || 'User'}</h2>
                <p className="text-gray-600 dark:text-gray-300">
                  You're currently on the <span className="font-medium">{user?.plan}</span> plan.
                </p>
              </div>
              
              <div className="mb-8">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-medium text-gray-900 dark:text-white">Your Chatrooms</h2>
                  <button 
                    onClick={() => router.push('/chatrooms/new')}
                    className="btn btn-primary"
                  >
                    New Chatroom
                  </button>
                </div>
                
                {chatroomsLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500"></div>
                  </div>
                ) : chatrooms.length > 0 ? (
                  <ChatroomList chatrooms={chatrooms} />
                ) : (
                  <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-center">
                    <p className="text-gray-600 dark:text-gray-300 mb-4">You don't have any chatrooms yet.</p>
                    <button 
                      onClick={() => router.push('/chatrooms/new')}
                      className="btn btn-primary"
                    >
                      Create your first chatroom
                    </button>
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
