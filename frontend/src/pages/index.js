import { useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useAuth } from '../contexts/AuthContext';

export default function Home() {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, loading, router]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-500 to-primary-700 flex flex-col justify-center items-center px-4">
      <div className="max-w-4xl w-full text-center">
        <h1 className="text-4xl md:text-6xl font-bold text-white mb-6">
          Welcome to Fixy
        </h1>
        <p className="text-xl md:text-2xl text-white mb-12">
          Real-time group chat with AI agents and human teammates
        </p>
        
        <div className="flex flex-col sm:flex-row justify-center gap-4 mb-12">
          <Link href="/login" className="btn bg-white text-primary-700 hover:bg-gray-100 text-lg px-8 py-3 rounded-lg font-medium">
            Login
          </Link>
          <Link href="/register" className="btn bg-secondary-600 text-white hover:bg-secondary-700 text-lg px-8 py-3 rounded-lg font-medium">
            Sign Up
          </Link>
        </div>
        
        <div className="grid md:grid-cols-3 gap-8 text-left">
          <div className="bg-white bg-opacity-10 p-6 rounded-lg">
            <h3 className="text-xl font-semibold text-white mb-3">Multiple AI Models</h3>
            <p className="text-white text-opacity-90">
              Integrate GPT-4o, Claude, Gemini and other AI models directly in your conversations.
            </p>
          </div>
          
          <div className="bg-white bg-opacity-10 p-6 rounded-lg">
            <h3 className="text-xl font-semibold text-white mb-3">Real-time Collaboration</h3>
            <p className="text-white text-opacity-90">
              Chat with both AI agents and human teammates in a seamless, real-time interface.
            </p>
          </div>
          
          <div className="bg-white bg-opacity-10 p-6 rounded-lg">
            <h3 className="text-xl font-semibold text-white mb-3">Flexible Plans</h3>
            <p className="text-white text-opacity-90">
              Choose from Trial, Pro, Elite, or Teams plans to fit your specific needs.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
