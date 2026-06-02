import React, { useState, useEffect, useRef } from 'react';
import { 
  X,
  Send,
  Database,
  Cpu,
  ShieldCheck,
  Sparkles,
  Loader2,
  Trash2,
  ListChecks 
} from 'lucide-react';

const CHAT_HISTORY_KEY = 'keyss_chat_history';
const MAX_PERSISTED_MESSAGES = 50; 

export default function AIChatbot() {
  // --- UI Layout Controllers ---
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState(() => {
    try {
      const saved = localStorage.getItem(CHAT_HISTORY_KEY);
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // --- Dynamic Projects Context Tracking ---
  const [projects, setProjects] = useState([]);
  const [activeContext, setActiveContext] = useState(null);
  const [showContextDropdown, setShowContextDropdown] = useState(false);
  const [filteredProjects, setFilteredProjects] = useState([]);

  // --- Naye Task Popup ke States ---
  const [showTaskDropdown, setShowTaskDropdown] = useState(false);
  const [availableTasks, setAvailableTasks] = useState([]);
  const [isFetchingTasks, setIsFetchingTasks] = useState(false);

  // ⭐ SUPER FAST CACHE FIX: Yeh tere browser ki local dictionary hai jo tasks yaad rakhegi
  const taskCache = useRef({});

  // --- Agent State ---
  const [pendingAction, setPendingAction] = useState(null);
  
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  useEffect(() => {
    try {
      localStorage.setItem(
        CHAT_HISTORY_KEY,
        JSON.stringify(messages.slice(-MAX_PERSISTED_MESSAGES))
      );
    } catch { }
  }, [messages]);

  const clearChat = () => {
    setMessages([]);
    setPendingAction(null);
    try {
      localStorage.removeItem(CHAT_HISTORY_KEY);
    } catch { }
  };

  // --- Fetch Dynamic Projects from DB ---
  useEffect(() => {
    const token = localStorage.getItem('keyss_token');
    if (!token) return;

    fetch('http://localhost:8787/api/timesheet/projects', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => {
      if (!res.ok) throw new Error('Failed to fetch projects');
      return res.json();
    })
    .then(data => {
      setProjects(data.projects || []);
      setFilteredProjects(data.projects || []);
    })
    .catch(err => console.error("Error loading chat contexts:", err));
  }, []);

  useEffect(() => {
    const textarea = inputRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [inputValue]);

  const handleInputChange = (e) => {
    const val = e.target.value;
    setInputValue(val);

    // Agar input box ekdum khali ho gaya hai (backspace se)
    if (val.trim() === '') {
      setActiveContext(null);       
      setShowContextDropdown(false); 
      setShowTaskDropdown(false);    
      return; 
    }

    const cursorPos = e.target.selectionStart; 
    const textBeforeCursor = val.slice(0, cursorPos);
    const words = textBeforeCursor.split(' ');
    const currentWord = words[words.length - 1]; 

    if (currentWord.startsWith('@')) {
      const query = currentWord.slice(1).toLowerCase();
      const filtered = projects.filter(p => 
        p.name.toLowerCase().includes(query)
      );
      setFilteredProjects(filtered);
      setShowContextDropdown(true);
      setShowTaskDropdown(false); 
    } else {
      setShowContextDropdown(false);
    }
  };

  const selectContext = async (projectId, projectName) => {
    const textarea = inputRef.current;
    if (!textarea) return;

    const cursorPos = textarea.selectionStart;
    const textBeforeCursor = inputValue.slice(0, cursorPos);
    const textAfterCursor = inputValue.slice(cursorPos);

    const words = textBeforeCursor.split(' ');
    words.pop(); 
    
    const updatedTextBeforeCursor = words.join(' ') + (words.length > 0 ? ' ' : '') + `${projectName}: `;
    const newText = updatedTextBeforeCursor + textAfterCursor;

    setInputValue(newText);
    setActiveContext({ id: projectId, name: projectName }); 
    setShowContextDropdown(false);

    setShowTaskDropdown(true);

    // ⭐ SUPER FAST CACHE FIX: Check karo ki kya data pehle se memory mein hai?
    if (taskCache.current[projectId]) {
      // Agar hai, toh instantly bina loader dikhaye render kar do (0ms delay)
      setAvailableTasks(taskCache.current[projectId]);
      setIsFetchingTasks(false);
    } else {
      // Agar nahi hai, tabhi internet par jao aur loader dikhao
      setIsFetchingTasks(true);
      try {
        const token = localStorage.getItem('keyss_token');
        const response = await fetch(`http://localhost:8787/api/timesheet/projects/${projectId}/tasks`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        
        if(data.success) {
          setAvailableTasks(data.tasks);
          // ⭐ DATA SAVE: Naye data ko local memory mein save kar lo agli baar ke liye
          taskCache.current[projectId] = data.tasks;
        } else {
          setAvailableTasks([]);
        }
      } catch (error) {
        console.error("D1 Task Fetch Error:", error);
        setAvailableTasks([]);
      } finally {
        setIsFetchingTasks(false);
      }
    }

    setTimeout(() => {
      textarea.focus();
      const newCursorPos = updatedTextBeforeCursor.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 10);
  };

  const selectTask = (taskName) => {
    const textarea = inputRef.current;
    if (!textarea) return;

    const newText = inputValue + taskName + " ";
    setInputValue(newText);
    
    setShowTaskDropdown(false); 

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newText.length, newText.length);
    }, 10);
  };

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
    setActiveContext(null); 
    
    setShowContextDropdown(false);
    setShowTaskDropdown(false);

    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }

    const history = messages
      .slice(-10)
      .map(m => ({ role: m.role, content: m.content }));

    const controller = new AbortController();
    const abortTimer = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch('http://localhost:8787/api/timesheet/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('keyss_token')}`
        },
        body: JSON.stringify({
          message: userPayload.content,
          history,                              
          pendingAction,                        
          selectedProject: userPayload.context
        }),
        signal: controller.signal,
      });

      if (!response.ok) throw new Error('Data payload tracking error');

      const data = await response.json();
      setPendingAction(data.pendingAction ?? null);

      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: 'assistant',
        content: data.reply || "Context analytics synced successfully within architecture parameters.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
    } catch (error) {
      const aborted = error?.name === 'AbortError';
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: 'assistant',
        content: aborted
          ? "Request timed out. Please try again."
          : "Telemetry processing failed. Ensure your Hono backend microservice is operational.",
        error: true,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
    } finally {
      clearTimeout(abortTimer);
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 font-sans antialiased text-slate-200">
      {!isOpen && (
        <button onClick={() => setIsOpen(true)} className="group relative flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-[0_0_20px_rgba(79,70,229,0.4)] transition-all hover:scale-105 hover:bg-indigo-500">
          <div className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
          </div>
          <Sparkles className="h-6 w-6 transition-transform group-hover:rotate-12" />
        </button>
      )}

      {isOpen && (
        <div className="flex flex-col overflow-hidden rounded-2xl border border-slate-800 bg-[#0f172a] shadow-2xl w-[calc(100vw-2rem)] max-h-[calc(100vh-6rem)] sm:w-[440px] sm:h-[650px]">
          
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
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button onClick={clearChat} title="Clear chat" className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-red-300">
                  <Trash2 size={18} />
                </button>
              )}
              <button onClick={() => setIsOpen(false)} className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100">
                <X size={20} />
              </button>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto bg-[#0b0f19] p-5 space-y-6 scrollbar-thin scrollbar-thumb-slate-800 select-text selection:bg-red-600 selection:text-white text-slate-300">
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
                  <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm select-text ${
                    msg.role === 'user'
                      ? 'bg-indigo-600 text-white rounded-tr-none'
                      : msg.error
                        ? 'bg-red-500/10 border border-red-500/20 text-red-200 rounded-tl-none'
                        : 'bg-slate-900 border border-slate-800 text-slate-300 rounded-tl-none'
                  }`}>
                    {msg.context && (
                      <div className="mb-1.5 inline-flex items-center gap-1 rounded-md bg-black/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-300 select-text">
                        {msg.context}
                      </div>
                    )}
                    <div className="whitespace-pre-wrap leading-relaxed select-text cursor-text">{msg.content}</div>
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

          <div className="relative border-t border-slate-800 bg-slate-900/50 p-4 backdrop-blur-md shrink-0">
            
            {/* Context Floating Dropdown Panel (PROJECTS) */}
            {showContextDropdown && (
              <div className="absolute bottom-full left-4 right-4 mb-2 max-h-48 overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 shadow-2xl scrollbar-thin">
                <div className="bg-slate-800/50 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-500 sticky top-0 flex justify-between">
                  <span>Select Project Context</span>
                  <button onClick={() => setShowContextDropdown(false)}>
                    <X size={12} className="text-slate-400 hover:text-white" />
                  </button>
                </div>
                {filteredProjects.length > 0 ? (
                  filteredProjects.map(project => (
                    <button
                      key={project.id}
                      type="button"
                      onClick={() => selectContext(project.id, project.name)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-indigo-600/10 hover:text-white border-b border-slate-800/50 last:border-0"
                    >
                      <span className="text-indigo-400"><Database size={14} /></span>
                      <div className="flex flex-col">
                        <span className="font-medium text-slate-200">@{project.name}</span>
                        <span className="text-[11px] text-slate-500">Project ID: {project.id}</span>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="p-3 text-xs text-slate-500 italic">No matching projects found...</div>
                )}
              </div>
            )}

            {/* Context Floating Dropdown Panel (TASKS) */}
            {showTaskDropdown && (
              <div className="absolute bottom-full left-4 right-4 mb-2 max-h-48 overflow-y-auto rounded-xl border border-emerald-700/50 bg-slate-900 shadow-[0_0_20px_rgba(16,185,129,0.15)] scrollbar-thin">
                <div className="bg-emerald-900/30 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-emerald-400 sticky top-0 flex justify-between items-center border-b border-emerald-800/30">
                  <span>Select Task for {activeContext?.name}</span>
                  <button onClick={() => setShowTaskDropdown(false)}>
                    <X size={12} className="text-emerald-400 hover:text-emerald-200" />
                  </button>
                </div>
                
                {isFetchingTasks ? (
                  <div className="p-5 flex justify-center items-center gap-2 text-xs text-slate-400">
                    <Loader2 size={16} className="animate-spin text-emerald-500" />
                    Fetching synced tasks...
                  </div>
                ) : availableTasks.length > 0 ? (
                  availableTasks.map(task => (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => selectTask(task.task_name)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-emerald-600/10 hover:text-white border-b border-slate-800/50 last:border-0 group"
                    >
                      <span className="text-emerald-500 group-hover:text-emerald-400"><ListChecks size={14} /></span>
                      <div className="flex flex-col">
                        <span className="font-medium text-slate-200">{task.task_name}</span>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="p-4 text-xs text-slate-500 italic text-center">No specific tasks defined for this project.</div>
                )}
              </div>
            )}

            <form onSubmit={handleSubmit} className="relative flex flex-col gap-2 max-h-[180px] overflow-y-auto style-scrollbar-none">
              {activeContext && (
                <div className="flex shrink-0">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/10 px-2.5 py-1 text-[11px] font-medium text-indigo-400 ring-1 ring-inset ring-indigo-500/20">
                    {activeContext.name}:
                    <button type="button" onClick={() => setActiveContext(null)} className="ml-1 hover:text-white">
                      <X size={12} />
                    </button>
                  </span>
                </div>
              )}

              <div className="relative flex items-end w-full bg-[#0b0f19] rounded-xl border border-slate-700 focus-within:border-indigo-500/50 focus-within:ring-4 focus-within:ring-indigo-500/10 min-h-[44px]">
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
                  style={{
                    height: 'auto',
                    maxHeight: '120px',
                    overflowY: 'auto', 
                  }}
                  className="w-full resize-none bg-transparent py-3 pl-4 pr-12 text-sm text-slate-200 outline-none disabled:opacity-50 style-scrollbar-none"
                />
                
                <div className="absolute right-2 bottom-1.5 flex items-center justify-center">
                  <button
                    type="submit"
                    disabled={!inputValue.trim() || isLoading}
                    className="rounded-lg bg-indigo-600 p-2 text-white transition-all hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600"
                  >
                    <Send size={18} />
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end px-1 shrink-0">
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