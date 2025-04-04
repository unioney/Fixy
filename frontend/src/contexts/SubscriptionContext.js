import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';

const SubscriptionContext = createContext();

export const SubscriptionProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [credits, setCredits] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch credits when user is authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      fetchCredits();
    }
  }, [isAuthenticated, user]);

  // Fetch user credits
  const fetchCredits = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/credits`);
      setCredits(response.data.credits);
      setTransactions(response.data.transactions);
      return response.data;
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to fetch credits');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Top up credits
  const topUpCredits = async (amount) => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/api/credits/topup`, { amount });
      return response.data;
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to top up credits');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Create subscription
  const createSubscription = async (priceId) => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/api/stripe/create-subscription`, { priceId });
      return response.data;
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to create subscription');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Cancel subscription
  const cancelSubscription = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/api/stripe/cancel-subscription`);
      return response.data;
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to cancel subscription');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Create customer portal session
  const createPortalSession = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/api/stripe/create-portal-session`);
      return response.data;
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to create portal session');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Get BYOK keys
  const getByokKeys = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/api/byok`);
      return response.data.keys;
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to get API keys');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Add BYOK key
  const addByokKey = async (provider, apiKey) => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/api/byok`, { provider, apiKey });
      return response.data;
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to add API key');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Delete BYOK key
  const deleteByokKey = async (provider) => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.delete(`${process.env.NEXT_PUBLIC_API_URL}/api/byok/${provider}`);
      return response.data;
    } catch (error) {
      setError(error.response?.data?.message || 'Failed to delete API key');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return (
    <SubscriptionContext.Provider
      value={{
        credits,
        transactions,
        loading,
        error,
        fetchCredits,
        topUpCredits,
        createSubscription,
        cancelSubscription,
        createPortalSession,
        getByokKeys,
        addByokKey,
        deleteByokKey
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = () => useContext(SubscriptionContext);
