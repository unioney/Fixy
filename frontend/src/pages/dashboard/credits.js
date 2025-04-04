import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import Sidebar from '../../components/Sidebar';
import { useAuth } from '../../contexts/AuthContext';
import { useSubscription } from '../../contexts/SubscriptionContext';

export default function Credits() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedAmount, setSelectedAmount] = useState(10);
  
  const { user, isAuthenticated, loading } = useAuth();
  const { 
    credits, 
    transactions,
    fetchCredits,
    topUpCredits,
    loading: subscriptionLoading 
  } = useSubscription();
  
  const router = useRouter();

  // Redirect if not authenticated
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, loading, router]);

  // Fetch credits on mount
  useEffect(() => {
    if (isAuthenticated) {
      fetchCredits();
    }
  }, [isAuthenticated, fetchCredits]);

  // Handle payment success/cancel from URL query
  useEffect(() => {
    if (router.query.payment === 'success') {
      setSuccess('Payment successful! Your credits have been added.');
      fetchCredits();
    } else if (router.query.payment === 'canceled') {
      setError('Payment was canceled. Please try again if you want to purchase credits.');
    }
  }, [router.query, fetchCredits]);

  const handleTopUp = async () => {
    setIsLoading(true);
    setError('');
    setSuccess('');
    
    try {
      const { sessionId } = await topUpCredits(selectedAmount);
      
      // Redirect to Stripe Checkout
      const stripe = await loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
      if (stripe) {
        await stripe.redirectToCheckout({ sessionId });
      }
    } catch (err) {
      setError(err.message || 'Failed to process payment');
      setIsLoading(false);
    }
  };

  if (loading || !isAuthenticated || subscriptionLoading) {
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
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Credits</h1>
            </div>
          </header>
          
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
            <div className="max-w-7xl mx-auto">
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
              
              <div className="grid gap-6 md:grid-cols-2">
                <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
                  <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Credit Balance</h2>
                  
                  {credits ? (
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-gray-600 dark:text-gray-300">Used this month:</span>
                        <span className="font-medium text-gray-900 dark:text-white">{credits.used} credits</span>
                      </div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-gray-600 dark:text-gray-300">Monthly limit:</span>
                        <span className="font-medium text-gray-900 dark:text-white">{credits.limit} credits</span>
                      </div>
                      <div className="flex justify-between items-center mb-4">
                        <span className="text-gray-600 dark:text-gray-300">Remaining:</span>
                        <span className="font-medium text-gray-900 dark:text-white">{Math.max(0, credits.limit - credits.used)} credits</span>
                      </div>
                      
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 mb-4">
                        <div 
                          className="bg-primary-500 h-2.5 rounded-full" 
                          style={{ width: `${Math.min(100, (credits.used / credits.limit) * 100)}%` }}
                        ></div>
                      </div>
                      
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Credits reset on {new Date(credits.reset_date).toLocaleDateString()}.
                      </p>
                    </div>
                  ) : (
                    <p className="text-gray-600 dark:text-gray-300">Loading credit information...</p>
                  )}
                </div>
                
                <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
                  <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Purchase Additional Credits</h2>
                  
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Select amount to purchase:
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[10, 50, 100].map((amount) => (
                        <button
                          key={amount}
                          type="button"
                          onClick={() => setSelectedAmount(amount)}
                          className={`py-2 px-4 rounded-md text-center ${
                            selectedAmount === amount
                              ? 'bg-primary-100 dark:bg-primary-900 border-2 border-primary-500 text-primary-700 dark:text-primary-300'
                              : 'bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'
                          }`}
                        >
                          {amount} credits
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div className="mb-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-gray-600 dark:text-gray-300">Price:</span>
                      <span className="font-medium text-gray-900 dark:text-white">${(selectedAmount * 0.1).toFixed(2)}</span>
                    </div>
                  </div>
                  
                  <button
                    onClick={handleTopUp}
                    disabled={isLoading}
                    className="w-full btn btn-primary"
                  >
                    {isLoading ? 'Processing...' : 'Purchase Credits'}
                  </button>
                </div>
              </div>
              
              <div className="mt-8">
                <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Transaction History</h2>
                
                <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
                  {transactions && transactions.length > 0 ? (
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                      <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            Date
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            Type
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            Amount
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                            Description
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {transactions.map((transaction) => (
                          <tr key={transaction.id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                              {new Date(transaction.created_at).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                              {transaction.type}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                              {transaction.amount > 0 ? '+' : ''}{transaction.amount} credits
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                              {transaction.description}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="px-6 py-4 text-center text-gray-500 dark:text-gray-300">
                      No transactions found.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </Layout>
  );
}
