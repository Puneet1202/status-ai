import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Send, 
  Folder, 
  Cpu, 
  ShieldCheck, 
  Sparkles, 
  Loader2
} from 'lucide-react';

export default function AIChatbot() {
  // --- UI Layout Controllers ---
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // --- Dynamic Projects Context Tracking (Problem 4 Fixed) ---
  const [projects, setProjects] = useState([]); 
  const [activeContext, setActiveContext] = useState(null); 
  const [showContextDropdown, setShowContextDropdown] = useState(false);
  const [filteredContexts, setFilteredContexts] = useState([]);
  
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  // Smooth UI Scrolling Engine
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  // --- Fetch Dynamic Projects from DB ---
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    fetch('http://localhost:8787/api/projects', {
      headers: { 
        'Authorization': `Bearer ${token}` 
      }
    })
    .then(res => {
      if (!res.ok) throw new Error('Failed to fetch projects');
      return res.json();
    })
    .then(data => {
      // Mapping database structure to UI options
      const mappedProjects = (data.projects || []).map(proj => ({
        id: proj.id,
        name: proj.name,
        label: `Project ID: ${proj.id}`
      }));
      setProjects(mappedProjects);
      setFilteredContexts(mappedProjects);
    })
    .catch(err => console.error("Error loading chat contexts:", err));
  }, []);

  // --- Core Tokenized Logic Wrapper ---
  const handleInputChange = (e) => {
    const val = e.target.value;
    setInputValue(val);

    const words = val.split(' ');
    const lastWord = words[words.length - 1];

    // Detect execution sequence token '@'
    if (lastWord.startsWith('@')) {
      const query = lastWord.slice(1).toLowerCase();
      const filtered = projects.filter(proj => 
        proj.name.toLowerCase().includes(query) || 
        String(proj.id).toLowerCase().includes(query)
      );
      setFilteredContexts(filtered);
      setShowContextDropdown(true);
    } else {
      setShowContextDropdown(false);
    }
  };

  const selectContext = (projectId, projectName) => {
    const words = inputValue.split(' ');
    words.pop(); // Clear out unparsed literal '@' segment
    const newText = words.join(' ') + (words.length > 0 ? ' ' : '') + `@${projectName} `;
    
    setInputValue(newText);
    setActiveContext({ id: projectId, name: projectName }); // Securely tracking object reference
    setShowContextDropdown(false);
    inputRef.current?.focus();
  };

  // --- Clean API Form Delivery Submission (Problem 1, 2, & 3 Fixed) ---
  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const userPayload = {
      id: Date.now(),
      role: 'user',
      content: inputValue,
      context: activeContext ? activeContext.name : null,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userPayload]);
    setInputValue('');
    setIsLoading(true);
    setActiveContext(null); // Flushing contextual channel frame

    try {
      // ✅ Problem 1: URL Fixed to '/api/timesheet/ai/chat'
      const response = await fetch('http://localhost:8787/api/timesheet/ai/chat', {
        method: 'POST',
        // ✅ Problem 3: Authorization Header Injected
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        // ✅ Problem 2: Body Structure Realigned
        body: JSON.stringify({
          message: userPayload.content,
          history: [],        
          pendingAction: null 
        }),
      });

      if (!response.ok) throw new Error('Data payload tracking error');
      
      const data = await response.json();
      
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: 'assistant',
        content: data.reply || "Context analytics synced successfully within architecture parameters.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
    } catch (error) {
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: 'assistant',
        content: "Telemetry processing failed. Ensure your Hono backend microservice is operational.",
        error: true,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 font-sans antialiased text-slate-200">
      {/* Floating Toggle Icon */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="group relative flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-[0_0_20px_rgba(79,70,229,0.4)] transition-all hover:scale-105 hover:bg-indigo-500"
        >
          <div className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
          </div>
          <Sparkles className="h-6 w-6 transition-transform group-hover:rotate-12" />
        </button>
      )}

      {/* Main Corporate Panel Container Layout */}
      {isOpen && (
        <div className="flex flex-col overflow-hidden rounded-2xl border border-slate-800 bg-[#0f172a] shadow-2xl w-[calc(100vw-2rem)] max-h-[calc(100vh-6rem)] sm:w-[440px] sm:h-[650px]">
          
          {/* Header Element Area */}
          <div className="flex items-center justify-between bg-slate-900/80 px-5 py-4 backdrop-blur-md border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 ring-1 ring-indigo-500/20">
                  <Cpu size={20} />
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-slate-900 bg-emerald-500 animate-pulse"></div>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-100">KEYSS AI System</h3>
                <p className="text-[11px] text-slate-400">Intelligence Node Active</p>
              </div>
            </div>
            <button 
              onClick={() => setIsOpen(false)}
              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100"
            >
              <X size={20} />
            </button>
          </div>

          {/* Chat Content Window Pane */}
          <div 
            ref={scrollRef}
            className="flex-1 overflow-y-auto bg-[#0b0f19] p-5 space-y-6 scrollbar-thin scrollbar-thumb-slate-800"
          >
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <div className="mb-4 rounded-full bg-slate-900 p-4 ring-1 ring-slate-800">
                  <ShieldCheck className="h-8 w-8 text-indigo-500" />
                </div>
                <h4 className="text-base font-medium text-slate-200">KEYSS Contextual Engine</h4>
                <p className="mt-2 px-6 text-xs leading-relaxed text-slate-500">
                  Ask queries by tagging target projects. Type <span className="text-indigo-400 font-mono font-bold">@</span> to filter analysis across active database structures.
                </p>
              </div>
            ) : (
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
                      <div className="mb-1.5 inline-flex items-center gap-1 rounded-md bg-black/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-300">
                        @{msg.context}
                      </div>
                    )}
                    <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                  </div>
                  <span className="mt-1.5 text-[10px] text-slate-600 px-1 uppercase">
                    {msg.timestamp}
                  </span>
                </div>
              ))
            )}
            
            {isLoading && (
              <div className="flex items-center gap-3">
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

          {/* Action Footer Entry Module */}
          <div className="relative border-t border-slate-800 bg-slate-900/50 p-4 backdrop-blur-md">
            
            {/* Context Floating Dropdown Panel */}
            {showContextDropdown && (
              <div className="absolute bottom-full left-4 right-4 mb-2 max-h-48 overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 shadow-2xl scrollbar-thin">
                <div className="bg-slate-800/50 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-500 sticky top-0">
                  Select Project Context
                </div>
                {filteredContexts.length > 0 ? (
                  filteredContexts.map(proj => (
                    <button
                      key={proj.id}
                      type="button"
                      onClick={() => selectContext(proj.id, proj.name)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-indigo-600/10 hover:text-white border-b border-slate-800/50 last:border-0"
                    >
                      <span className="text-purple-400"><Folder size={14} /></span>
                      <div className="flex flex-col">
                        <span className="font-medium text-slate-200">@{proj.name}</span>
                        <span className="text-[11px] text-slate-500">{proj.label}</span>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="p-3 text-xs text-slate-500 italic">No matching projects found...</div>
                )}
              </div>
            )}

            <form onSubmit={handleSubmit} className="relative flex flex-col gap-2">
              {/* Context Explicit Overlay Tag */}
              {activeContext && (
                <div className="flex">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/10 px-2.5 py-1 text-[11px] font-medium text-indigo-400 ring-1 ring-inset ring-indigo-500/20">
                    @{activeContext.name}
                    <button type="button" onClick={() => setActiveContext(null)} className="ml-1 hover:text-white">
                      <X size={12} />
                    </button>
                  </span>
                </div>
              )}

              <div className="relative flex items-center">
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
                  placeholder={isLoading ? "Processing dynamic query..." : "Type '@' to link a project context..."}
                  disabled={isLoading}
                  className="w-full resize-none rounded-xl border border-slate-700 bg-[#0b0f19] py-3 pl-4 pr-12 text-sm text-slate-200 outline-none focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/10 disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={!inputValue.trim() || isLoading}
                  className="absolute right-2 top-1.5 rounded-lg bg-indigo-600 p-2 text-white transition-all hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600"
                >
                  <Send size={18} />
                </button>
              </div>

              <div className="flex items-center justify-end px-1">
                <span className="text-[10px] text-slate-600">
                  Press <kbd className="rounded border border-slate-700 px-1 font-sans">Enter</kbd> to submit
                </span>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}