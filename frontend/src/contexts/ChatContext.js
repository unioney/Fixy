import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const ChatContext = createContext();

export const ChatProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [socket, setSocket] = useState(null);
  const [chatrooms, setChatrooms] = useState([]);
  const [currentChatroom, setCurrentChatroom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [typingUsers, setTypingUsers] = useState({});
  const [agents, setAgents] = useState([]);
  const [availableModels, setAvailableModels] = useState([]);

  // Initialize socket connection
  useEffect(() => {
    if (isAuthenticated && user) {
      const token = localStorage.getItem('token');
      const newSocket = io(process.env.NEXT_PUBLIC_SOCKET_URL, {
        auth: { token }
      });

      newSocket.on('connect', () => {
        console.log('Socket connected');
      });

      newSocket.on('error', (error) => {
        console.error('Socket error:', error);
      });

      newSocket.on('new-message', (message) => {
        setMessages(prev => [...prev, message]);
      });

      newSocket.on('typing', ({ chatroomId, user, isTyping }) => {
        if (chatroomId === currentChatroom?.id) {
          setTypingUsers(prev => ({
            ...prev,
            [user.id]: isTyping ? user : null
          }));
        }
      });

      newSocket.on('ai-thinking', ({ chatroomId, agentId }) => {
        // Handle AI thinking state
        const agent = agents.find(a => a.id === agentId);
        if (agent && chatroomId === currentChatroom?.id) {
          setTypingUsers(prev => ({
            ...prev,
            [agentId]: { id: agentId, name: agent.name, isAI: true }
          }));
        }
      });

      setSocket(newSocket);

      return () => {
        newSocket.disconnect();
      };
    }
  }, [isAuthenticated, user, currentChatroom?.id, agents]);

  // Fetch chatrooms
  const fetchChatrooms = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/chatrooms`);
      setChatrooms(response.data.chatrooms);
      return response.data.chatrooms;
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to fetch chatrooms');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Fetch single chatroom
  const fetchChatroom = async (chatroomId) => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/chatrooms/${chatroomId}`);
      setCurrentChatroom(response.data.chatroom);
      setAgents(response.data.chatroom.agents || []);
      
      // Join chatroom via socket
      if (socket) {
        socket.emit('join-chatroom', chatroomId);
      }
      
      return response.data.chatroom;
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to fetch chatroom');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Fetch messages
  const fetchMessages = async (chatroomId, limit = 50, before = null) => {
    try {
      setLoading(true);
      setError(null);
      let url = `${process.env.NEXT_PUBLIC_API_URL}/api/messages/${chatroomId}?limit=${limit}`;
      if (before) {
        url += `&before=${before}`;
      }
      const response = await axios.get(url);
      setMessages(response.data.messages);
      return response.data.messages;
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to fetch messages');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Send message
  const sendMessage = async (chatroomId, content, agentId = null) => {
    try {
      setError(null);
      
      // Emit via socket for real-time
      if (socket) {
        socket.emit('new-message', { chatroomId, content, agentId });
      }
      
      // Also send via API for persistence
      const response = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/api/messages/${chatroomId}`, {
        content,
        agentId
      });
      
      return response.data;
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to send message');
      throw error;
    }
  };

  // Set typing indicator
  const setTyping = (chatroomId, isTyping) => {
    if (socket) {
      socket.emit('typing', { chatroomId, isTyping });
    }
  };

  // Create chatroom
  const createChatroom = async (title, type) => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/api/chatrooms`, {
        title,
        type
      });
      setChatrooms(prev => [...prev, response.data.chatroom]);
      return response.data.chatroom;
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to create chatroom');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Update chatroom
  const updateChatroom = async (chatroomId, title) => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.put(`${process.env.NEXT_PUBLIC_API_URL}/api/chatrooms/${chatroomId}`, {
        title
      });
      setChatrooms(prev => prev.map(chatroom => 
        chatroom.id === chatroomId ? response.data.chatroom : chatroom
      ));
      if (currentChatroom?.id === chatroomId) {
        setCurrentChatroom(response.data.chatroom);
      }
      return response.data.chatroom;
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to update chatroom');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Delete chatroom
  const deleteChatroom = async (chatroomId) => {
    try {
      setLoading(true);
      setError(null);
      await axios.delete(`${process.env.NEXT_PUBLIC_API_URL}/api/chatrooms/${chatroomId}`);
      setChatrooms(prev => prev.filter(chatroom => chatroom.id !== chatroomId));
      if (currentChatroom?.id === chatroomId) {
        setCurrentChatroom(null);
        setMessages([]);
      }
      return true;
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to delete chatroom');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Add participant to chatroom
  const addParticipant = async (chatroomId, email) => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/api/chatrooms/${chatroomId}/participants`, {
        email
      });
      return response.data;
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to add participant');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Remove participant from chatroom
  const removeParticipant = async (chatroomId, participantId) => {
    try {
      setLoading(true);
      setError(null);
      await axios.delete(`${process.env.NEXT_PUBLIC_API_URL}/api/chatrooms/${chatroomId}/participants`, {
        data: { participantId }
      });
      if (currentChatroom?.id === chatroomId) {
        // Update participants list
        setCurrentChatroom(prev => ({
          ...prev,
          participants: prev.participants.filter(p => p.id !== participantId)
        }));
      }
      return true;
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to remove participant');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Fetch available AI models
  const fetchAvailableModels = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/agents/models`);
      setAvailableModels(response.data.models);
      return response.data.models;
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to fetch AI models');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Add AI agent to chatroom
  const addAgent = async (chatroomId, name, modelId, config = {}) => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/api/agents/chatroom/${chatroomId}`, {
        name,
        modelId,
        config
      });
      setAgents(prev => [...prev, response.data.agent]);
      return response.data.agent;
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to add AI agent');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Remove AI agent from chatroom
  const removeAgent = async (agentId) => {
    try {
      setLoading(true);
      setError(null);
      await axios.delete(`${process.env.NEXT_PUBLIC_API_URL}/api/agents/${agentId}`);
      setAgents(prev => prev.filter(agent => agent.id !== agentId));
      return true;
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to remove AI agent');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return (
    <ChatContext.Provider
      value={{
        chatrooms,
        currentChatroom,
        messages,
        loading,
        error,
        typingUsers,
        agents,
        availableModels,
        fetchChatrooms,
        fetchChatroom,
        fetchMessages,
        sendMessage,
        setTyping,
        createChatroom,
        updateChatroom,
        deleteChatroom,
        addParticipant,
        removeParticipant,
        fetchAvailableModels,
        addAgent,
        removeAgent
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => useContext(ChatContext);
