// FILE: Frontend/src/routes/enter-status.tsx
// KAAM: Secure Status Entry + Live Record Deletion Engine

import React, { useState, useEffect } from 'react';
import { useAppState } from '../lib/app-state';
import { Clock, Briefcase, AlertTriangle, Send, Trash2 } from 'lucide-react';

interface TimesheetLog {
  id?: string;
  employee_id?: string;
  entry_date?: string;
  start_time?: string;
  end_time?: string;
  duration_hours?: number;
  module_name?: string;
  task_description?: string;
  project_name?: string;
}

export const EnterStatus: React.FC = () => {
  const { user, token } = useAppState();
  
  const [client, setClient] = useState('');
  const [project, setProject] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('11:00');
  const [module, setModule] = useState('');
  const [description, setDescription] = useState('');
  
  const [todaysLogs, setTodaysLogs] = useState<TimesheetLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [errorAlert, setErrorAlert] = useState('');

  const getLocalDateStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const handleStartTimeChange = (val: string) => {
    setStartTime(val);
    setErrorAlert('');
    if (!val) return;

    const [hours, minutes] = val.split(':').map(Number);
    let newHours = hours + 2;
    if (newHours >= 24) newHours -= 24;
    
    const calculatedEnd = `${String(newHours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    setEndTime(calculatedEnd);
  };

  const calculateDuration = (start: string, end: string): number => {
    if (!start || !end) return 0;
    const [startH, startM] = start.split(':').map(Number);
    const [endH, endM] = end.split(':').map(Number);
    let diff = (endH * 60 + endM) - (startH * 60 + startM);
    if (diff < 0) diff += 24 * 60; 
    return Number((diff / 60).toFixed(2));
  };

  const currentDuration = calculateDuration(startTime, endTime);
  const isExactlyTwoHours = currentDuration === 2.0;

  const isTimeSlotOverlapping = (): boolean => {
    return todaysLogs.some(log => {
      if (!log.start_time || !log.end_time) return false;
      
      const [lStartH, lStartM] = log.start_time.split(':').map(Number);
      const [lEndH, lEndM] = log.end_time.split(':').map(Number);
      const logStart = lStartH * 60 + lStartM;
      const logEnd = lEndH * 60 + lEndM;

      const [cStartH, cStartM] = startTime.split(':').map(Number);
      const [cEndH, cEndM] = endTime.split(':').map(Number);
      const currentStart = cStartH * 60 + cStartM;
      const currentEnd = cEndH * 60 + cEndM;

      return Math.max(logStart, currentStart) < Math.min(logEnd, currentEnd);
    });
  };

  const hasOverlap = isTimeSlotOverlapping();
  const targetDailyHours = 8.0;
  
  const totalLoggedToday = todaysLogs.reduce((sum, log) => sum + (log.duration_hours || 0), 0);
  const dailyPercentage = Math.min(100, Math.max(0, (totalLoggedToday / targetDailyHours) * 100));

  const fetchTodaysLogs = async () => {
    if (!token) return;
    try {
      const res = await fetch(`http://localhost:8787/api/timesheet/admin/all-logs`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const logs: TimesheetLog[] = data.telemetry_logs || [];
        const todayStr = getLocalDateStr();
        
        const filtered = logs.filter(l => l.entry_date === todayStr);
        filtered.sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
        setTodaysLogs(filtered);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // 🗑️ LIVE DELETE CONTROLLER HANDSHAKE
  const handleDeleteLog = async (id: string | undefined) => {
    if (!id || !token) return;
    if (!window.confirm("Are you sure you want to purge this status block entry?")) return;

    setDeletingId(id);
    setErrorAlert('');
    try {
      // Direct call to backend deletion pipeline
      const res = await fetch(`http://localhost:8787/api/timesheet/delete/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        // Success: Refresh telemetry track locally
        fetchTodaysLogs();
      } else {
        throw new Error('Deletion rejected by backend.');
      }
    } catch (err) {
      setErrorAlert('Failed to delete log entry from database cluster.');
    } finally {
      setDeletingId(null);
    }
  };

  useEffect(() => {
    fetchTodaysLogs();
  }, [token]);

  const handleSubmitStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorAlert('');

    if (!isExactlyTwoHours) {
      setErrorAlert('Block duration must be exact 2.0 hours.');
      return;
    }
    if (hasOverlap) {
      setErrorAlert('Exploit Blocked: This continuous time window has already been logged.');
      return;
    }

    setLoading(true);
    const payload = {
      entry_date: getLocalDateStr(),
      start_time: startTime,
      end_time: endTime,
      duration_hours: 2.0,
      module_name: module || 'General Sprint',
      task_description: description,
      project_name: `${client} › ${project}`
    };

    try {
      const res = await fetch('http://localhost:8787/api/timesheet/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      
      if (!res.ok) throw new Error('Transaction dropped.');
      setModule(''); setDescription('');
      fetchTodaysLogs();
    } catch (err) {
      setErrorAlert('Backend injection pipeline dropped packet transaction.');
    } finally {
      setLoading(false);
    }
  };

  const parseCompoundProjectString = (compoundStr: string | undefined) => {
    if (!compoundStr) return { client: 'General Context', project: 'Internal Sprint' };
    if (compoundStr.includes(' › ')) {
      const parts = compoundStr.split(' › ');
      return { client: parts[0], project: parts[1] };
    }
    return { client: 'Key Software Services', project: compoundStr };
  };

  const formatTimeTo12H = (militaryTime: string | undefined) => {
    if (!militaryTime) return '00:00 AM';
    const [hStr, mStr] = militaryTime.split(':');
    let hours = parseInt(hStr, 10);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${String(hours).padStart(2, '0')}:${mStr} ${ampm}`;
  };

  return (
    <div className="max-w-7xl mx-auto flex flex-col gap-4 p-4 lg:p-6 h-[calc(100vh-20px)] lg:h-[calc(100vh-40px)] overflow-hidden text-slate-100">
      
      {/* Header */}
      <div className="shrink-0">
        <div className="flex items-center gap-1.5 mb-0.5">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">KEYSS INFRASTRUCTURE PANEL</h3>
        </div>
        <h2 className="text-xl font-bold text-white tracking-tight">Daily Status Logging Studio</h2>
      </div>

      {/* Main split view container */}
      <div className="flex flex-col xl:flex-row gap-4 flex-1 min-h-0">
        
        {/* LEFT SIDE: Input Form */}
        <div className="flex-[1.8] bg-[#020617] border border-slate-800 rounded-2xl p-5 relative overflow-hidden flex flex-col justify-between min-h-0 shadow-2xl">
          <form onSubmit={handleSubmitStatus} className="space-y-4 flex flex-col justify-between h-full min-h-0 relative z-10">
            <div className="space-y-3 overflow-y-auto pr-1 custom-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Client Registry</label>
                  <select required value={client} onChange={e => setClient(e.target.value)} className="w-full bg-[#0f172a]/70 border border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-200 focus:ring-1 focus:ring-emerald-700 outline-none cursor-pointer">
                    <option value="">Select Client Properties...</option>
                    <option value="Key Software Services Pvt Ltd">Key Software Services Pvt Ltd</option>
                    <option value="Acme Holdings">Acme Holdings</option>
                  </select>
                </div>
                
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Project Track</label>
                  <select required value={project} onChange={e => setProject(e.target.value)} className="w-full bg-[#0f172a]/70 border border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-200 focus:ring-1 focus:ring-emerald-700 outline-none cursor-pointer">
                    <option value="">Select Target Sprint...</option>
                    <option value="Business Development">Business Development</option>
                    <option value="Internal Tools">Internal Tools</option>
                    <option value="Onboarding Portal">Onboarding Portal</option>
                  </select>
                </div>
              </div>
              
              {/* Hours Grid */}
              <div className="bg-[#0f172a]/40 border border-slate-800/60 rounded-xl p-4">
                 <div className="flex items-center gap-4 relative">
                   <div className="flex-1 space-y-1">
                     <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">START TIME (24H Format)</label>
                     <input type="time" required value={startTime} onChange={e => handleStartTimeChange(e.target.value)} className="w-full bg-[#020617] border border-slate-800 rounded-xl px-4 py-1.5 text-xs font-semibold text-slate-100 focus:ring-1 focus:ring-emerald-700 outline-none [color-scheme:dark]" />
                   </div>
                   
                   <div className="shrink-0 mt-4">
                     <div className={`shadow-md border px-3 py-1 rounded-full text-[11px] font-black ${(!isExactlyTwoHours || hasOverlap) ? 'bg-red-950/40 border-red-800/50 text-red-400' : 'bg-emerald-950/40 border-emerald-800/50 text-emerald-400'}`}>
                       {currentDuration.toFixed(1)}h
                     </div>
                   </div>

                   <div className="flex-1 space-y-1">
                     <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">AUTO END TIME</label>
                     <input type="time" disabled value={endTime} className="w-full bg-[#0f172a]/40 border border-slate-800/40 text-slate-400 rounded-xl px-4 py-1.5 text-xs font-semibold outline-none cursor-not-allowed opacity-80" />
                   </div>
                 </div>
                 
                 <div className="mt-4 flex items-center justify-between bg-[#020617]/40 border border-slate-800/40 rounded-lg p-2 px-3">
                      <div className='flex items-center gap-2'>
                          <div className="h-1 w-24 bg-slate-800/70 rounded-full overflow-hidden">
                              <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${dailyPercentage}%` }}></div>
                          </div>
                          <span className="text-xs font-black text-slate-300">{dailyPercentage.toFixed(0)}%</span>
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 tracking-wider">DAILY IMMUNITY BLOCK: {totalLoggedToday.toFixed(1)}h / {targetDailyHours.toFixed(1)}h</span>
                 </div>

                 {(errorAlert || hasOverlap) && (
                   <div className="mt-3 flex items-center gap-2 rounded-lg bg-red-950/30 border border-red-900/40 p-2.5 text-[10px] font-semibold text-red-300 animate-pulse">
                      <AlertTriangle size={12} className="shrink-0" /> 
                      {hasOverlap ? 'Security Alert: Overlapping timeline block logic collision detected!' : errorAlert}
                   </div>
                 )}
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Module Context (optional)</label>
                <input type="text" value={module} onChange={e => setModule(e.target.value)} placeholder="e.g. Auth Engine, Report Pipeline" className="w-full bg-[#0f172a]/70 border border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-200 focus:ring-1 focus:ring-emerald-700 outline-none placeholder:text-slate-600" />
              </div>
              
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Detailed Contribution Description</label>
                <textarea required value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="Describe specific technical feature builds, bugs eliminated, or infrastructure alignment details..." className="w-full bg-[#0f172a]/70 border border-slate-800 rounded-xl px-4 py-2.5 text-xs leading-relaxed text-slate-100 focus:ring-1 focus:ring-emerald-700 outline-none resize-none placeholder:text-slate-600 custom-scrollbar" />
              </div>
            </div>
            
            <div className="shrink-0 flex justify-end border-t border-slate-800/40 pt-3">
              <button type="submit" disabled={!isExactlyTwoHours || hasOverlap || loading} className={`flex items-center gap-2 h-9 px-6 rounded-full text-[11px] font-black uppercase tracking-wider transition duration-300 shadow-md ${(!isExactlyTwoHours || hasOverlap || loading) ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/30' : 'bg-gradient-to-r from-blue-600 to-blue-500 text-white hover:shadow-lg hover:shadow-blue-900/20'}`}>
                {loading ? <span className="w-3 h-3 border-2 border-slate-200 border-t-transparent rounded-full animate-spin"></span> : <Send size={12} />}
                {loading ? 'Committing...' : 'Commit Status Entry'}
              </button>
            </div>
          </form>
        </div>

        {/* RIGHT SIDE: Timeline List with Fixed Delete Triggers */}
        <div className="flex-[0.9] bg-[#020617] border border-slate-800 rounded-2xl p-4 flex flex-col min-h-0 shadow-2xl relative overflow-hidden xl:max-w-sm">
          <div className="relative z-10 flex flex-col h-full min-h-0">
            <div className="shrink-0 flex items-center justify-between mb-4 pb-2 border-b border-slate-800/60">
              <h3 className="text-sm font-bold text-white tracking-wide">Today's Sprint Logs</h3>
              <span className="text-[10px] font-black text-emerald-400 bg-emerald-950/40 border border-emerald-900/40 px-2.5 py-0.5 rounded-full">{todaysLogs.length} Blocks</span>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar relative pl-1 min-h-0">
                <div className="absolute top-0 bottom-0 left-[11px] w-px bg-slate-800/60 pointer-events-none"></div>
                
                {todaysLogs.length === 0 ? (
                  <div className="text-center text-slate-500 text-xs mt-12 font-medium italic">No rows committed for this current calendar date block.</div>
                ) : (
                  <div className="space-y-3.5">
                    {todaysLogs.map((log, idx) => {
                      const resolvedFields = parseCompoundProjectString(log.project_name);
                      return (
                        <div key={log.id || idx} className="relative pl-7 group">
                          <div className="absolute left-[3px] top-[14px] w-1.5 h-1.5 rounded-full bg-blue-500 ring-2 ring-[#020617] shadow-[0_0_6px_rgba(59,130,246,0.8)] z-10"></div>
                          
                          <div className="bg-[#0f172a]/50 border border-slate-800/60 p-3.5 rounded-xl border-l-2 border-l-blue-500 shadow-sm relative group">
                            
                            {/* 🗑️ FIXED TRASH/DELETE TRIGGER ACTION BUTTON */}
                            <button 
                              type="button"
                              disabled={deletingId === log.id}
                              onClick={() => handleDeleteLog(log.id)}
                              className="absolute top-2 right-2 text-slate-600 hover:text-red-400 transition-colors p-1 rounded-md hover:bg-red-950/20"
                              title="Purge status record"
                            >
                              {deletingId === log.id ? (
                                <span className="w-3 h-3 border-2 border-red-400 border-t-transparent rounded-full animate-spin inline-block"></span>
                              ) : (
                                <Trash2 size={13} />
                              )}
                            </button>

                            <div className="flex justify-between items-start gap-2 pr-4">
                              <div className="min-w-0 flex-1">
                                <h4 className="font-bold text-slate-200 text-xs truncate mb-0.5 capitalize">{resolvedFields.project}</h4>
                                <div className="text-[10px] font-medium text-slate-400 truncate mb-1">{resolvedFields.client}</div>
                                <p className="text-slate-300 text-[11px] leading-relaxed break-words line-clamp-2">{log.task_description}</p>
                                
                                <div className="text-[9px] font-black text-blue-400 mt-2 font-mono tracking-wide bg-[#020617] border border-slate-800/60 px-2 py-0.5 rounded inline-block">
                                   {formatTimeTo12H(log.start_time)} → {formatTimeTo12H(log.end_time)}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};