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
  ListChecks,
  CheckSquare // ⭐ NAYA ICON: Selected task dikhane ke liye
} from 'lucide-react';
import { API_BASE_URL } from '../lib/api';

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
  const [activeContext, setActiveContext] = useState(null); // ⭐ NAYA STATE STRUCTURE: { id, name, tasks: [] }
  const [showContextDropdown, setShowContextDropdown] = useState(false);
  const [filteredProjects, setFilteredProjects] = useState([]);

  // --- Naye Task Popup ke States ---
  const [showTaskDropdown, setShowTaskDropdown] = useState(false);
  const [availableTasks, setAvailableTasks] = useState([]);
  const [isFetchingTasks, setIsFetchingTasks] = useState(false);

  // ⭐ SUPER FAST CACHE FIX
  const taskCache = useRef({});

  const [pendingAction, setPendingAction] = useState(null);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  // --- Transient toast (e.g. "select a project first") — auto-clears ---
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const flashToast = (msg) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1800);
  };

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isLoading]);

  useEffect(() => {
    try {
      localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(messages.slice(-MAX_PERSISTED_MESSAGES)));
    } catch { }
  }, [messages]);

  const clearChat = () => {
    setMessages([]);
    setPendingAction(null);
    try { localStorage.removeItem(CHAT_HISTORY_KEY); } catch { }
  };

  useEffect(() => {
    const token = localStorage.getItem('keyss_token');
    if (!token) return;

    fetch(API_BASE_URL + '/api/timesheet/projects', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(res => {
      if (!res.ok) throw new Error('Failed to fetch projects');
      return res.json();
    })
    .then(data => {
      const projs = data.projects || [];
      setProjects(projs);
      setFilteredProjects(projs);

      // 🔥 PRE-WARM: fetch every project's tasks in the background so the task
      // dropdown opens INSTANTLY on first select (no per-project network wait).
      // Falls back to on-demand fetch in selectContext if a select beats this.
      projs.forEach(p => {
        if (taskCache.current[p.id]) return;
        fetch(`${API_BASE_URL}/api/timesheet/projects/${p.id}/tasks`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
          .then(r => r.json())
          .then(d => { if (d?.success) taskCache.current[p.id] = d.tasks || []; })
          .catch(() => {});
      });
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

    // Emptying the input only closes the dropdowns — the selected project/tasks
    // stay (sticky) so a follow-up like "9 to 11" still has its context.
    if (val.trim() === '') {
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
      const filtered = projects.filter(p => p.name.toLowerCase().includes(query));
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
    
    // Project select hone par text append hoga
    const updatedTextBeforeCursor = words.join(' ') + (words.length > 0 ? ' ' : '') + `${projectName}: `;
    const newText = updatedTextBeforeCursor + textAfterCursor;

    setInputValue(newText);
    
    // ⭐ NAYA LOGIC: 'tasks: []' ki ek khali array add kardi multi-select ke liye
    setActiveContext({ id: projectId, name: projectName, tasks: [] }); 
    setShowContextDropdown(false);
    setShowTaskDropdown(true);

    if (taskCache.current[projectId]) {
      setAvailableTasks(taskCache.current[projectId]);
      setIsFetchingTasks(false);
    } else {
      setIsFetchingTasks(true);
      try {
        const token = localStorage.getItem('keyss_token');
        const response = await fetch(`${API_BASE_URL}/api/timesheet/projects/${projectId}/tasks`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        
        if(data.success) {
          setAvailableTasks(data.tasks);
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

  // ⭐ NAYA FUNCTION: Toggle Tasks For Multi-Select (Bina Textbox ganda kiye)
  const toggleTask = (taskName) => {
    const textarea = inputRef.current;
    
    setActiveContext(prev => {
      if (!prev) return prev;
      const currentTasks = prev.tasks || [];
      
      // Agar pehle se selected hai, toh hata do (Toggle OFF)
      if (currentTasks.includes(taskName)) {
        return { ...prev, tasks: currentTasks.filter(t => t !== taskName) };
      } 
      // Agar nahi hai, toh array mein add kar do (Toggle ON)
      else {
        return { ...prev, tasks: [...currentTasks, taskName] };
      }
    });

    // Hum yahan popup band NAHI kar rahe hain taaki user aur bhi task tick kar sake.
    // Fokus wapas input par daal dete hain silently.
    if (textarea) setTimeout(() => textarea.focus(), 10);
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    // Work-logging needs a project AND — if that project has predefined tasks —
    // at least one ticked task. Greetings/queries (no time pattern) pass freely.
    // Projects with NO predefined tasks (e.g. Internal Tools) are exempt from the
    // task check, otherwise they could never be logged.
    const looksLikeLog = /\d{1,2}\s*(?::\d{2}|[-–—]|→|to\b|am\b|pm\b|baje)/i.test(inputValue);
    if (looksLikeLog) {
      if (!activeContext) {
        flashToast("Select a project first — type '@'");
        return;
      }
      const projHasTasks = (taskCache.current[activeContext.id] || availableTasks || []).length > 0;
      const noTaskPicked = !activeContext.tasks || activeContext.tasks.length === 0;
      if (projHasTasks && noTaskPicked) {
        flashToast("Select at least one task");
        return;
      }
    }

    // Clean project name + ticked tasks are sent SEPARATELY to the backend.
    // (A combined "Name [Tasks: ...]" string as selectedProject would corrupt
    // project resolution — the backend would create a project named like that.)
    const projName = activeContext ? activeContext.name : null;
    const projTasks = activeContext?.tasks?.length ? activeContext.tasks : [];

    // Combined string is ONLY for the chat bubble label (display).
    let finalContextPayload = projName;
    if (projTasks.length > 0) {
      finalContextPayload = `${projName} [Tasks: ${projTasks.join(' | ')}]`;
    }

    const userPayload = {
      id: Date.now(),
      role: 'user',
      content: inputValue,
      context: finalContextPayload,  
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userPayload]);
    setInputValue('');
    setIsLoading(true);
    // Project (+tasks) stay STICKY across messages so multi-turn logging works
    // ("today dashboard work" → "9 to 11"). User switches via @ or the pill's X.
    setShowContextDropdown(false);
    setShowTaskDropdown(false);

    if (inputRef.current) inputRef.current.style.height = 'auto';

    const history = messages.slice(-10).map(m => ({ role: m.role, content: m.content }));
    const controller = new AbortController();
    const abortTimer = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(`${API_BASE_URL}/api/timesheet/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('keyss_token')}`
        },
        body: JSON.stringify({
          message: userPayload.content,
          history,
          pendingAction,
          selectedProject: projName,      // clean project name → project_id
          selectedTasks: projTasks        // ticked tasks → module_name
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
        content: aborted ? "Request timed out. Please try again." : "Telemetry processing failed. Ensure your backend is operational.",
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
                <button onClick={clearChat} title="Clear chat" className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-red-300"><Trash2 size={18} /></button>
              )}
              <button onClick={() => setIsOpen(false)} className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100"><X size={20} /></button>
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
                  <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm select-text ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : msg.error ? 'bg-red-500/10 border border-red-500/20 text-red-200 rounded-tl-none' : 'bg-slate-900 border border-slate-800 text-slate-300 rounded-tl-none'}`}>
                    {msg.context && (
                      <div className="mb-1.5 inline-flex items-center gap-1 rounded-md bg-black/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-300 select-text">
                        {msg.context}
                      </div>
                    )}
                    <div className="whitespace-pre-wrap leading-relaxed select-text cursor-text">{msg.content}</div>
                  </div>
                  <span className="mt-1.5 text-[10px] text-slate-600 px-1 uppercase">{msg.timestamp}</span>
                </div>
              ))
            )}
            
            {isLoading && (
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 border border-slate-800"><Loader2 size={16} className="animate-spin text-indigo-500" /></div>
                <div className="flex gap-1">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-700"></span>
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-700 [animation-delay:0.2s]"></span>
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-700 [animation-delay:0.4s]"></span>
                </div>
              </div>
            )}
          </div>

          <div className="relative border-t border-slate-800 bg-slate-900/50 p-4 backdrop-blur-md shrink-0">

            {/* Transient hint (e.g. select a project before logging work) */}
            {toast && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-30 flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-red-500/90 px-3 py-1.5 text-xs font-medium text-white shadow-lg ring-1 ring-red-400/40">
                <X size={12} /> {toast}
              </div>
            )}

            {showContextDropdown && (
              <div className="absolute bottom-full left-4 right-4 mb-2 max-h-48 overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 shadow-2xl scrollbar-thin">
                <div className="bg-slate-800/50 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-500 sticky top-0 flex justify-between">
                  <span>Select Project Context</span>
                  <button onClick={() => setShowContextDropdown(false)}><X size={12} className="text-slate-400 hover:text-white" /></button>
                </div>
                {filteredProjects.length > 0 ? (
                  filteredProjects.map(project => (
                    <button key={project.id} type="button" onClick={() => selectContext(project.id, project.name)} className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-indigo-600/10 hover:text-white border-b border-slate-800/50 last:border-0">
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

            {/* ⭐ TASK DROPDOWN WITH MULTI-SELECT VISUALS */}
            {showTaskDropdown && (
              <div className="absolute bottom-full left-4 right-4 mb-2 max-h-48 overflow-y-auto rounded-xl border border-emerald-700/50 bg-slate-900 shadow-[0_0_20px_rgba(16,185,129,0.15)] scrollbar-thin">
                <div className="bg-emerald-900/30 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-emerald-400 sticky top-0 flex justify-between items-center border-b border-emerald-800/30">
                  <span>Select Tasks for {activeContext?.name}</span>
                  <button onClick={() => setShowTaskDropdown(false)}><X size={12} className="text-emerald-400 hover:text-emerald-200" /></button>
                </div>
                
                {isFetchingTasks ? (
                  <div className="p-5 flex justify-center items-center gap-2 text-xs text-slate-400"><Loader2 size={16} className="animate-spin text-emerald-500" />Fetching synced tasks...</div>
                ) : availableTasks.length > 0 ? (
                  availableTasks.map(task => {
                    // Check if task is currently selected
                    const isSelected = activeContext?.tasks?.includes(task.task_name);
                    
                    return (
                      <button
                        key={task.id}
                        type="button"
                        onClick={() => toggleTask(task.task_name)}
                        className={`flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition-colors border-b border-slate-800/50 last:border-0 group ${
                          isSelected ? 'bg-emerald-600/20 text-emerald-100' : 'hover:bg-emerald-600/10 hover:text-white'
                        }`}
                      >
                        <span className={isSelected ? 'text-emerald-400' : 'text-emerald-500 group-hover:text-emerald-400'}>
                          {isSelected ? <CheckSquare size={14} /> : <ListChecks size={14} />}
                        </span>
                        <div className="flex flex-col">
                          <span className="font-medium">{task.task_name}</span>
                        </div>
                      </button>
                    )
                  })
                ) : (
                  <div className="p-4 text-xs text-slate-500 italic text-center">No specific tasks defined for this project.</div>
                )}
              </div>
            )}

            <form onSubmit={handleSubmit} className="relative flex flex-col gap-2 max-h-[180px] overflow-y-auto style-scrollbar-none">
              
              {/* ⭐ UPGRADED BADGE WITH MULTI-SELECT DISPLAY & HORIZONTAL SCROLL */}
             {/* ⭐ UPGRADED BADGE WITH INDIVIDUAL TASK PILLS & HORIZONTAL SCROLL */}
              {activeContext && (
                <div className="flex shrink-0 items-center gap-2 w-full overflow-x-auto style-scrollbar-none pb-1">
                  
                  {/* 1. PROJECT PILL (Yeh udane par sab udd jayega) */}
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/10 px-3 py-1.5 text-[11px] font-medium text-indigo-400 ring-1 ring-inset ring-indigo-500/20 whitespace-nowrap">
                    <Database size={12} className="text-indigo-500" />
                    {activeContext.name}
                    <button 
                      type="button" 
                      onClick={() => setActiveContext(null)} 
                      className="ml-1 rounded-full hover:bg-indigo-500/20 p-0.5 hover:text-white shrink-0 transition-colors"
                    >
                      <X size={12} />
                    </button>
                  </span>

                  {/* 2. INDIVIDUAL TASK PILLS (Har task ka apna alag badge) */}
                  {activeContext.tasks?.map((taskName) => (
                    <span 
                      key={taskName} 
                      className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1.5 text-[11px] font-medium text-emerald-400 ring-1 ring-inset ring-emerald-500/20 whitespace-nowrap"
                    >
                      <ListChecks size={12} className="text-emerald-500" />
                      {taskName}
                      <button 
                        type="button" 
                        // ⭐ ASLI JADU YAHAN HAI: Sirf is task ko toggle (remove) karega
                        onClick={() => toggleTask(taskName)} 
                        className="ml-1 rounded-full hover:bg-emerald-500/20 p-0.5 hover:text-white shrink-0 transition-colors"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                  
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
                  style={{ height: 'auto', maxHeight: '120px', overflowY: 'auto' }}
                  className="w-full resize-none bg-transparent py-3 pl-4 pr-12 text-sm text-slate-200 outline-none disabled:opacity-50 style-scrollbar-none"
                />
                
                <div className="absolute right-2 bottom-1.5 flex items-center justify-center">
                  <button type="submit" disabled={!inputValue.trim() || isLoading} className="rounded-lg bg-indigo-600 p-2 text-white transition-all hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600">
                    <Send size={18} />
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end px-1 shrink-0">
                <span className="text-[10px] text-slate-600">Press <kbd className="rounded border border-slate-700 px-1 font-sans">Enter</kbd> to submit</span>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}