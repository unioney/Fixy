import '../styles/globals.css';
import { AuthProvider } from '../contexts/AuthContext';
import { ChatProvider } from '../contexts/ChatContext';
import { SubscriptionProvider } from '../contexts/SubscriptionContext';
import Head from 'next/head';

function MyApp({ Component, pageProps }) {
  return (
    <AuthProvider>
      <SubscriptionProvider>
        <ChatProvider>
          <Head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
            <meta name="description" content="Fixy - Real-time group chat system with AI agents" />
            <meta name="theme-color" content="#0ea5e9" />
            <link rel="manifest" href="/manifest.json" />
            <link rel="icon" href="/favicon.ico" />
            <title>Fixy</title>
          </Head>
          <Component {...pageProps} />
        </ChatProvider>
      </SubscriptionProvider>
    </AuthProvider>
  );
}

export default MyApp;
