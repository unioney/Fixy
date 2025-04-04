import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import Sidebar from '../../components/Sidebar';
import MessageList from '../../components/MessageList';
import MessageInput from '../../components/MessageInput';
import AgentSelector from '../../components/AgentSelector';
import ParticipantsList from '../../components/ParticipantsList';
import { useAuth } from '../../contexts/AuthContext';
import { useChat } from '../../contexts/ChatContext';

export default function ChatroomPage() {
  const [showParticipants, setShowParticipants] = useState(false);
  const [showAgentSelector, setShowAgentSelector] = useState(false);
  const messagesEndRef = useRef(null);
  
  const { user, isAuthenticated, loading } = useAuth();
  const { 
    fetchChatroom, 
    currentChatroom, 
    fetchMessages, 
    messages, 
    sendMessage, 
    setTyping,
    agents,
    loading: chatLoading,
    error
  } = useChat();
  
  const router = useRouter();
  const { id } = router.query;

  // Redirect if not authenticated
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, loading, router]);

  // Fetch chatroom and messages when id is available
  useEffect(() => {
    if (isAuthenticated && id) {
      fetchChatroom(id).then(() => {
        fetchMessages(id);
      });
    }
  }, [isAuthenticated, id, fetchChatroom, fetchMessages]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (content) => {
    if (!content.trim()) return;
    
    try {
      await sendMessage(id, content);
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const handleAgentMessage = async (content, agentId) => {
    if (!content.trim() || !agentId) return;
    
    try {
      await sendMessage(id, content, agentId);
    } catch (error) {
      console.error('Failed to send message to agent:', error);
    }
  };

  const handleTyping = (isTyping) => {
    setTyping(id, isTyping);
  };

  if (loading || !isAuthenticated || chatLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
          <Sidebar />
          
          <div className="flex-1 flex flex-col overflow-hidden">
            <header className="bg-white dark:bg-gray-800 shadow">
              <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
                <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Error</h1>
              </div>
            </header>
            
            <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
              <div className="max-w-7xl mx-auto">
                <div className="bg-red-50 border-l-4 border-red-400 p-4">
                  <div className="flex">
                    <div className="ml-3">
                      <p className="text-sm text-red-700">{error}</p>
                      <p className="mt-2">
                        <button
                          onClick={() => router.push('/dashboard')}
                          className="text-red-700 font-medium underline"
                        >
                          Return to Dashboard
                        </button>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </main>
          </div>
        </div>
      </Layout>
    );
  }

  if (!currentChatroom) {
    return (
      <Layout>
        <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
          <Sidebar />
          
          <div className="flex-1 flex flex-col overflow-hidden">
            <header className="bg-white dark:bg-gray-800 shadow">
              <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
                <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Chatroom</h1>
              </div>
            </header>
            
            <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
              <div className="max-w-7xl mx-auto">
                <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 text-center">
                  <p className="text-gray-600 dark:text-gray-300">Chatroom not found.</p>
                  <button
                    onClick={() => router.push('/dashboard')}
                    className="mt-4 btn btn-primary"
                  >
                    Return to Dashboard
                  </button>
                </div>
              </div>
            </main>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex h-screen bg-gray-100 dark:bg-gray-900">
        <Sidebar />
        
        <div className="flex-1 flex flex-col overflow-hidden">
          <header className="bg-white dark:bg-gray-800 shadow">
            <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
              <div>
                <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{currentChatroom.title}</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {currentChatroom.type === 'private' ? 'Private Chatroom' : 'Group Chatroom'}
                </p>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => setShowAgentSelector(true)}
                  className="btn btn-outline"
                >
                  Add AI Agent
                </button>
                {currentChatroom.type === 'group' && (
                  <button
                    onClick={() => setShowParticipants(true)}
                    className="btn btn-outline"
                  >
                    Participants
                  </button>
                )}
              </div>
            </div>
          </header>
          
          <main className="flex-1 overflow-hidden flex flex-col bg-gray-50 dark:bg-gray-800">
            <div className="flex-1 overflow-y-auto p-4">
              <MessageList 
                messages={messages} 
                currentUser={user} 
                agents={agents} 
              />
              <div ref={messagesEndRef} />
            </div>
            
            <div className="p-4 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
              <MessageInput 
                onSendMessage={handleSendMessage} 
                onTyping={handleTyping}
                agents={agents}
                onAgentMessage={handleAgentMessage}
              />
            </div>
          </main>
        </div>
        
        {showParticipants && (
          <ParticipantsList 
            chatroom={currentChatroom} 
            onClose={() => setShowParticipants(false)} 
          />
        )}
        
        {showAgentSelector && (
          <AgentSelector 
            chatroomId={id} 
            onClose={() => setShowAgentSelector(false)} 
          />
        )}
      </div>
    </Layout>
  );
}
