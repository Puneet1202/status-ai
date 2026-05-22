import React, { useState } from 'react';
import { useAppState } from '../lib/app-state';

interface SidebarProps {
  activeTab: 'enter' | 'check';
  setActiveTab: (tab: 'enter' | 'check') => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const { user, logout } = useAppState();
  const [isStatusOpen, setIsStatusOpen] = useState(true);

  return (
    <aside className="w-64 bg-[#0b1120] border-r border-slate-800 flex flex-col justify-between shrink-0 h-full text-slate-300 select-none">
      <div>
        {/* Logo Area */}
        <div className="p-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700 text-sm font-bold text-blue-400">
              K
            </div>
            <h1 className="text-base font-semibold text-slate-200">KEYSS Status</h1>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex flex-col gap-1 px-3 mt-4">
          <button className="w-full text-left px-3 py-2.5 rounded-md transition-colors hover:bg-slate-800/50 flex items-center gap-3 text-sm font-medium text-slate-400">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
            Dashboard
          </button>

          <div className="mt-2">
            <button 
              onClick={() => setIsStatusOpen(!isStatusOpen)}
              className="w-full text-left px-3 py-2 rounded-md transition-colors hover:bg-slate-800/50 flex items-center justify-between text-sm font-medium text-slate-200"
            >
              <div className="flex items-center gap-3">
                <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                Status
              </div>
              <svg className={`w-3.5 h-3.5 transition-transform ${isStatusOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>
            
            {isStatusOpen && (
              <div className="flex flex-col gap-1 mt-1 pl-9 pr-2">
                <button 
                  onClick={() => setActiveTab('enter')}
                  className={`w-full text-left px-3 py-2 rounded-md transition-colors text-sm font-medium flex items-center gap-2 ${activeTab === 'enter' ? 'bg-[#1e293b] text-slate-200' : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800/30'}`}
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  Enter Status
                </button>
                <button 
                  onClick={() => setActiveTab('check')}
                  className={`w-full text-left px-3 py-2 rounded-md transition-colors text-sm font-medium flex items-center gap-2 ${activeTab === 'check' ? 'bg-[#1e293b] text-slate-200' : 'text-slate-400 hover:text-slate-300 hover:bg-slate-800/30'}`}
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  Check Status
                </button>
              </div>
            )}
          </div>

          <button className="w-full text-left px-3 py-2.5 rounded-md transition-colors hover:bg-slate-800/50 flex items-center justify-between text-sm font-medium text-slate-400 mt-2">
            <div className="flex items-center gap-3">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              Leaves
            </div>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </button>
          <button className="w-full text-left px-3 py-2.5 rounded-md transition-colors hover:bg-slate-800/50 flex items-center gap-3 text-sm font-medium text-slate-400">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            Company Policy
          </button>
          <button className="w-full text-left px-3 py-2.5 rounded-md transition-colors hover:bg-slate-800/50 flex items-center justify-between text-sm font-medium text-slate-400">
             <div className="flex items-center gap-3">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
              Admin
            </div>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </button>
        </nav>
      </div>
      
      {/* Bottom Profile Area */}
      <div className="p-4 border-t border-slate-800/50">
        <div className="flex items-center justify-between group">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-blue-900/50 flex items-center justify-center text-blue-400 font-semibold text-sm border border-blue-800/50 shrink-0">
              {user?.name?.charAt(0).toUpperCase() || 'A'}
            </div>
            <div className="overflow-hidden">
              <div className="font-semibold text-slate-200 truncate capitalize text-sm">{user?.name || 'Aarav Rao'}</div>
              <div className="text-xs text-slate-400 truncate">{user?.email || 'aarav@keyss.io'}</div>
            </div>
          </div>
          <button 
            onClick={logout}
            className="p-2 text-slate-500 hover:text-slate-300 transition-colors rounded-md hover:bg-slate-800/50"
            title="Log out"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>
    </aside>
  );
};
