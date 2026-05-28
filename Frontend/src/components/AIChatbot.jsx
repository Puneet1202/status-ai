import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, 
  X, 
  Send, 
  Database, 
  BarChart3, 
  ShieldCheck, 
  Cpu, 
  Terminal, 
  Sparkles, 
  Paperclip, 
  MoreHorizontal,
  ChevronRight,
  Loader2
} from 'lucide-react';

/**
 * AIChatbot.jsx
 * 
 * A premium, self-contained enterprise AI Chatbot component.
 * Features: 
 * - @Context mention system (Logs, Budgets, Database)
 * - Dynamic empty-state with quick-action chips
 * - Full Dark Slate/Indigo enterprise theme
 * - Integrated API handler for http://localhost:8787/api/chat
 */

const CONTEXT_OPTIONS = [
  { id: 'Logs', icon: <Terminal size={14} />, label: 'Sprint Logs & Metrics', color: 'text-blue-400' },
  { id: 'Budgets', icon: <BarChart3 size={14} />, label: 'Financial Thresholds', color: 'text-emerald-400' },
  { id: 'Database', icon: <Database size={14} />, label: 'Local/Cloud Tracking', color: 'text-purple-400' },
];

const QUICK_PROMPTS = [
  { label: "Analyze my sprint logs", context: "Logs" },
  { label: "Check budget thresholds", context: "Budgets" },
  { label: "Database sync status", context: "Database" },
];

export default function AIChatbot() {
  // --- State Management ---
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeContext, setActiveContext] = useState(null);
  const [showContextDropdown, setShowContextDropdown] = useState(false);
  const [filteredContexts, setFilteredContexts] = useState(CONTEXT_OPTIONS);
  
  // --- Refs ---
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  // --- Auto-scroll Effect ---
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  // --- Input & Context Logic ---
  const handleInputChange = (e) => {
    const val = e.target.value;
    setInputValue(val);

    // Detect '@' trigger
    const lastChar = val.slice(-1);
    const words = val.split(' ');
    const lastWord = words[words.length - 1];

    if (lastWord.startsWith('@')) {
      const query = lastWord.slice(1).toLowerCase();
      const filtered = CONTEXT_OPTIONS.filter(opt => 
        opt.id.toLowerCase().includes(query)
      );
      setFilteredContexts(filtered);
      setShowContextDropdown(true);
    } else {
      setShowContextDropdown(false);
    }
  };

  const selectContext = (contextId) => {
    const words = inputValue.split(' ');
    words.pop(); // Remove the '@' or partial '@word'
    const newText = words.join(' ') + (words.length > 0 ? ' ' : '') + `@${contextId} `;
    
    setInputValue(newText);
    setActiveContext(contextId);
    setShowContextDropdown(false);
    inputRef.current?.focus();
  };

  const handleQuickPrompt = (prompt) => {
    setInputValue(prompt.label);
    setActiveContext(prompt.context);
    // Focus input to allow user to edit or just hit enter
    inputRef.current?.focus();
  };

  // --- API Submission Handler ---
  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const userMessage = {
      id: Date.now(),
      role: 'user',
      content: inputValue,
      context: activeContext,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
    setActiveContext(null);

    try {
      const response = await fetch('http://localhost:8787/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.content,
          activeContext: userMessage.context
        }),
      });

      if (!response.ok) throw new Error('Network response was not ok');
      
      const data = await response.json();
      
      const aiResponse = {
        id: Date.now() + 1,
        role: 'assistant',
        content: data.reply || "Context processed successfully. Systems within normal parameters.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages(prev => [...prev, aiResponse]);
    } catch (error) {
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: 'assistant',
        content: "I encountered a connection error. Please ensure the local DevOps API is running.",
        error: true,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 font-sans antialiased text-slate-200">
      {/* Floating Toggle Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="group relative flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-[0_0_20px_rgba(79,70,229,0.4)] transition-all hover:scale-105 hover:bg-indigo-500 active:scale-95"
        >
          <div className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
          </div>
          <Sparkles className="h-6 w-6 transition-transform group-hover:rotate-12" />
        </button>
      )}

      {/* Main Chat Window */}
      {isOpen && (
        <div className="flex flex-col overflow-hidden rounded-2xl border border-slate-800 bg-[#0f172a] shadow-2xl transition-all animate-in fade-in zoom-in-95 slide-in-from-bottom-10 
          w-[calc(100vw-2rem)] max-h-[calc(100vh-6rem)] sm:w-[440px] sm:h-[650px]">
          
          {/* Header */}
          <div className="flex items-center justify-between bg-slate-900/80 px-5 py-4 backdrop-blur-md border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 ring-1 ring-indigo-500/20">
                  <Cpu size={20} />
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-slate-900 bg-emerald-500 animate-pulse"></div>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-100">DevOps AI Assistant</h3>
                <p className="text-[11px] text-slate-400">System nodes online</p>
              </div>
            </div>
            <button 
              onClick={() => setIsOpen(false)}
              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100"
            >
              <X size={20} />
            </button>
          </div>

          {/* Messages Body */}
          <div 
            ref={scrollRef}
            className="flex-1 overflow-y-auto bg-[#0b0f19] p-5 space-y-6 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent"
          >
            {messages.length === 0 ? (
              /* Empty State UI */
              <div className="flex h-full flex-col items-center justify-center text-center animate-in fade-in duration-700">
                <div className="mb-4 rounded-full bg-slate-900 p-4 ring-1 ring-slate-800">
                  <ShieldCheck className="h-8 w-8 text-indigo-500" />
                </div>
                <h4 className="text-base font-medium text-slate-200">Enterprise Contextual AI</h4>
                <p className="mt-2 px-6 text-xs leading-relaxed text-slate-500">
                  I can analyze your infrastructure, logs, and billing. Use <span className="text-indigo-400 font-mono">@</span> to reference specific data scopes.
                </p>
                <div className="mt-8 grid w-full gap-2">
                  {QUICK_PROMPTS.map((prompt, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleQuickPrompt(prompt)}
                      className="group flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/50 p-3 text-left transition-all hover:border-indigo-500/50 hover:bg-indigo-500/5"
                    >
                      <span className="text-xs font-medium text-slate-300 group-hover:text-indigo-300">{prompt.label}</span>
                      <ChevronRight size={14} className="text-slate-600 group-hover:text-indigo-400" />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              /* Message List */
              messages.map((msg) => (
                <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                    msg.role === 'user' 
                      ? 'bg-indigo-600 text-white rounded-tr-none' 
                      : msg.error 
                        ? 'bg-red-500/10 border border-red-500/20 text-red-200 rounded-tl-none'
                        : 'bg-slate-900 border border-slate-800 text-slate-300 rounded-tl-none'
                  }`}>
                    {msg.context && (
                      <div className="mb-1.5 inline-flex items-center gap-1 rounded-md bg-black/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-200">
                        <Terminal size={10} /> {msg.context}
                      </div>
                    )}
                    <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                  </div>
                  <span className="mt-1.5 text-[10px] text-slate-600 uppercase tracking-tight px-1">
                    {msg.timestamp}
                  </span>
                </div>
              ))
            )}
            
            {/* Loading Indicator */}
            {isLoading && (
              <div className="flex items-center gap-3 animate-in fade-in">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 border border-slate-800">
                  <Loader2 size={16} className="animate-spin text-indigo-500" />
                </div>
                <div className="flex gap-1">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-700"></span>
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-700 [animation-delay:0.2s]"></span>
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-700 [animation-delay:0.4s]"></span>
                </div>
              </div>
            )}
          </div>

          {/* Input Footer Area */}
          <div className="relative border-t border-slate-800 bg-slate-900/50 p-4 backdrop-blur-md">
            
            {/* Context Dropdown Layer */}
            {showContextDropdown && (
              <div className="absolute bottom-full left-4 right-4 mb-2 overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl animate-in slide-in-from-bottom-2">
                <div className="bg-slate-800/50 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  Select Context Scope
                </div>
                {filteredContexts.length > 0 ? (
                  filteredContexts.map(ctx => (
                    <button
                      key={ctx.id}
                      onClick={() => selectContext(ctx.id)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-indigo-600/10 hover:text-white"
                    >
                      <span className={ctx.color}>{ctx.icon}</span>
                      <div className="flex flex-col">
                        <span className="font-medium">@{ctx.id}</span>
                        <span className="text-[11px] text-slate-500">{ctx.label}</span>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="p-3 text-xs text-slate-500 italic">No scope matches...</div>
                )}
              </div>
            )}

            <form onSubmit={handleSubmit} className="relative flex flex-col gap-2">
              {/* Context Tag Display */}
              {activeContext && (
                <div className="flex animate-in zoom-in-95">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/10 px-2.5 py-1 text-[11px] font-medium text-indigo-400 ring-1 ring-inset ring-indigo-500/20">
                    <Database size={12} /> @{activeContext}
                    <button onClick={() => setActiveContext(null)} className="ml-1 hover:text-white">
                      <X size={12} />
                    </button>
                  </span>
                </div>
              )}

              <div className="group relative flex items-center">
                <textarea
                  ref={inputRef}
                  rows={1}
                  value={inputValue}
                  onChange={handleInputChange}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit();
                    }
                  }}
                  placeholder={isLoading ? "Processing context..." : "Ask AI or type '@' for context..."}
                  disabled={isLoading}
                  className="w-full resize-none rounded-xl border border-slate-700 bg-[#0b0f19] py-3 pl-4 pr-12 text-sm text-slate-200 outline-none transition-all focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/10 disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={!inputValue.trim() || isLoading}
                  className="absolute right-2 top-1.5 rounded-lg bg-indigo-600 p-2 text-white transition-all hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600"
                >
                  <Send size={18} />
                </button>
              </div>

              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-3">
                  <button type="button" className="text-slate-500 hover:text-slate-300">
                    <Paperclip size={16} />
                  </button>
                  <button type="button" className="text-slate-500 hover:text-slate-300">
                    <MoreHorizontal size={16} />
                  </button>
                </div>
                <span className="text-[10px] text-slate-600">
                  Press <kbd className="rounded border border-slate-700 px-1 font-sans">Enter</kbd> to send
                </span>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}