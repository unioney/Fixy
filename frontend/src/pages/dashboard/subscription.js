import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import Sidebar from '../../components/Sidebar';
import { useAuth } from '../../contexts/AuthContext';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { loadStripe } from '@stripe/stripe-js';

export default function Subscription() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const { user, isAuthenticated, loading } = useAuth();
  const { 
    credits, 
    createSubscription, 
    cancelSubscription, 
    createPortalSession,
    loading: subscriptionLoading 
  } = useSubscription();
  
  const router = useRouter();

  // Redirect if not authenticated
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, loading, router]);

  // Handle payment success/cancel from URL query
  useEffect(() => {
    if (router.query.payment === 'success') {
      setSuccess('Payment successful! Your subscription has been updated.');
    } else if (router.query.payment === 'canceled') {
      setError('Payment was canceled. Please try again if you want to upgrade.');
    }
  }, [router.query]);

  const plans = [
    {
      id: 'trial',
      name: 'Trial',
      price: 'Free',
      features: [
        'Basic AI models only',
        '50 AI credits per month',
        'No team collaboration',
        'No BYOK support'
      ],
      priceId: null,
      current: user?.plan === 'Trial'
    },
    {
      id: 'pro',
      name: 'Pro',
      price: '$9.99/month',
      features: [
        'Standard AI models',
        '500 AI credits per month',
        'No team collaboration',
        'No BYOK support'
      ],
      priceId: process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID,
      current: user?.plan === 'Pro'
    },
    {
      id: 'elite',
      name: 'Elite',
      price: '$29.99/month',
      features: [
        'All AI models',
        '2000 AI credits per month',
        'No team collaboration',
        'BYOK support'
      ],
      priceId: process.env.NEXT_PUBLIC_STRIPE_ELITE_PRICE_ID,
      current: user?.plan === 'Elite'
    },
    {
      id: 'teams',
      name: 'Teams',
      price: '$99.99/month',
      features: [
        'All AI models',
        '5000 AI credits per month',
        'Team collaboration',
        'BYOK support'
      ],
      priceId: process.env.NEXT_PUBLIC_STRIPE_TEAMS_PRICE_ID,
      current: user?.plan === 'Teams'
    }
  ];

  const handleSubscribe = async (priceId) => {
    setIsLoading(true);
    setError('');
    setSuccess('');
    
    try {
      const { clientSecret } = await createSubscription(priceId);
      
      const stripe = await loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
      
      if (stripe) {
        const result = await stripe.confirmCardPayment(clientSecret);
        
        if (result.error) {
          throw new Error(result.error.message);
        }
        
        if (result.paymentIntent.status === 'succeeded') {
          setSuccess('Payment successful! Your subscription has been updated.');
          // Refresh the page after a short delay
          setTimeout(() => {
            window.location.reload();
          }, 2000);
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to process subscription');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!confirm('Are you sure you want to cancel your subscription? You will lose access to premium features at the end of your billing period.')) {
      return;
    }
    
    setIsLoading(true);
    setError('');
    setSuccess('');
    
    try {
      await cancelSubscription();
      setSuccess('Your subscription has been canceled. You will have access until the end of your billing period.');
      // Refresh the page after a short delay
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (err) {
      setError(err.message || 'Failed to cancel subscription');
    } finally {
      setIsLoading(false);
    }
  };

  const handleManageSubscription = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      const { url } = await createPortalSession();
      window.location.href = url;
    } catch (err) {
      setError(err.message || 'Failed to open customer portal');
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
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Subscription</h1>
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
              
              <div className="mb-8">
                <h2 className="text-xl font-medium text-gray-900 dark:text-white mb-4">Current Plan</h2>
                <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                        {user?.plan} Plan
                      </h3>
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        {credits ? (
                          <>
                            You have used <span className="font-medium">{credits.used}</span> of your <span className="font-medium">{credits.limit}</span> credits this month.
                          </>
                        ) : (
                          'Loading credit information...'
                        )}
                      </p>
                      {user?.stripe_subscription_id && (
                        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                          Your subscription renews automatically.
                        </p>
                      )}
                    </div>
                    
                    <div className="mt-4 md:mt-0 space-y-2 md:space-y-0 md:space-x-2 flex flex-col md:flex-row">
                      {user?.stripe_subscription_id && (
                        <>
                          <button
                            onClick={handleManageSubscription}
                            disabled={isLoading}
                            className="btn btn-outline"
                          >
                            Manage Payment
                          </button>
                          <button
                            onClick={handleCancelSubscription}
                            disabled={isLoading}
                            className="btn btn-outline text-red-600 border-red-600 hover:bg-red-50"
                          >
                            Cancel Subscription
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              
              <div>
                <h2 className="text-xl font-medium text-gray-900 dark:text-white mb-4">Available Plans</h2>
                <div className="grid gap-6 lg:grid-cols-4 md:grid-cols-2">
                  {plans.map((plan) => (
                    <div 
                      key={plan.id}
                      className={`bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden ${
                        plan.current ? 'ring-2 ring-primary-500' : ''
                      }`}
                    >
                      <div className="p-6">
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white">{plan.name}</h3>
                        <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">{plan.price}</p>
                        <ul className="mt-4 space-y-2">
                          {plan.features.map((feature, index) => (
                            <li key={index} className="flex items-start">
                              <svg className="h-5 w-5 text-green-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              <span className="text-sm text-gray-700 dark:text-gray-300">{feature}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      
                      <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700">
                        {plan.current ? (
                          <button
                            disabled
                            className="w-full btn bg-gray-300 text-gray-700 cursor-not-allowed"
                          >
                            Current Plan
                          </button>
                        ) : plan.id === 'trial' ? (
                          <button
                            disabled
                            className="w-full btn bg-gray-300 text-gray-700 cursor-not-allowed"
                          >
                            Free Plan
                          </button>
                        ) : (
                          <button
                            onClick={() => handleSubscribe(plan.priceId)}
                            disabled={isLoading}
                            className="w-full btn btn-primary"
                          >
                            {isLoading ? 'Processing...' : `Upgrade to ${plan.name}`}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </Layout>
  );
}
