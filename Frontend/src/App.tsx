import React, { useState } from 'react';
import { AppStateProvider, useAppState } from './lib/app-state';
import { AuthScreen } from './routes/auth';
import { Sidebar } from './components/Sidebar';
import { EnterStatus } from './routes/enter';
import { CheckStatus } from './routes/check';
// 1. Import the AI Chatbot component here (adjust path if needed)
import AIChatbot from './components/AIChatbot';
import { API_BASE_URL } from './lib/api';

const AppLayout = () => {
  const { token } = useAppState();
  const [activeTab, setActiveTab] = useState<'enter' | 'check'>('enter');

  if (!token) {
    return <AuthScreen />;
  }
  
  return (
    <div className="min-h-screen bg-[#020617] flex text-slate-200 font-sans selection:bg-indigo-500/30 overflow-hidden">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      <main className="flex-1 h-screen overflow-y-auto bg-[#020617] p-8 lg:p-12 custom-scrollbar relative">
        {activeTab === 'enter' ? <EnterStatus /> : <CheckStatus />}
        
        {/* 2. Injected globally so it floats neatly over your views */}
        <AIChatbot apiBaseUrl={API_BASE_URL} />
      </main>
    </div>
  );
};

export const App = () => {
  return (
    <AppStateProvider>
      <AppLayout />
    </AppStateProvider>
  );
};

export default App;