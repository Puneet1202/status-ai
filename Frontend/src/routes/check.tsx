// FILE: Frontend/src/routes/check-status.tsx
// KAAM: Premium Telemetry Grid with Flawless Layout Spacing & Zero Content Clipping

import React, { useState, useEffect } from 'react';
import { useAppState } from '../lib/app-state';
import { Filter, ChevronDown, Download } from 'lucide-react';

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
  employee_name?: string;
}

export const CheckStatus: React.FC = () => {
  const { user, token } = useAppState();
  
  const [logs, setLogs] = useState<TimesheetLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(true);

  const [filterName, setFilterName] = useState('All employees');
  const [filterClient, setFilterClient] = useState('All clients');
  const [dateRange, setDateRange] = useState<'today' | 'yesterday' | 'week' | 'month' | 'custom'>('week');
  
  const getTodayDateStr = () => new Date().toISOString().split('T')[0];
  const [dateFrom, setDateFrom] = useState(getTodayDateStr());
  const [dateTo, setDateTo] = useState(getTodayDateStr());

  useEffect(() => {
    const today = new Date();
    if (dateRange === 'today') {
      setDateFrom(today.toISOString().split('T')[0]);
      setDateTo(today.toISOString().split('T')[0]);
    } else if (dateRange === 'yesterday') {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      setDateFrom(yesterday.toISOString().split('T')[0]);
      setDateTo(yesterday.toISOString().split('T')[0]);
    } else if (dateRange === 'week') {
      const lastWeek = new Date(today);
      lastWeek.setDate(lastWeek.getDate() - 7);
      setDateFrom(lastWeek.toISOString().split('T')[0]);
      setDateTo(today.toISOString().split('T')[0]);
    } else if (dateRange === 'month') {
      const startMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      setDateFrom(startMonth.toISOString().split('T')[0]);
      setDateTo(today.toISOString().split('T')[0]);
    }
  }, [dateRange]);

  const fetchTelemetryLogs = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (user?.role === 'employee') {
        queryParams.append('employeeName', user.name);
      } else if (filterName !== 'All employees') {
        queryParams.append('employeeName', filterName);
      }
      if (filterClient !== 'All clients') queryParams.append('clientName', filterClient);
      if (dateFrom) queryParams.append('dateFrom', dateFrom);
      if (dateTo) queryParams.append('dateTo', dateTo);

      const res = await fetch(`http://localhost:8787/api/timesheet/admin/all-logs?${queryParams.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setLogs(data.telemetry_logs || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTelemetryLogs();
  }, [dateFrom, dateTo, filterName, filterClient]);

  const calculatedTotalHours = logs.reduce((acc, log) => acc + Number(log.duration_hours || 0), 0);

  const parseCompoundProjectString = (compoundStr: string | undefined) => {
    if (!compoundStr) return { client: 'General Context', project: 'Internal Sprint' };
    if (compoundStr.includes(' › ')) {
      const parts = compoundStr.split(' › ');
      return { client: parts[0], project: parts[1] };
    }
    return { client: 'Key Software Services', project: compoundStr };
  };

  return (
    // FIX: Removed strict viewport height lock. Using normal overflow-y-auto on page for full visibility
    <div className="max-w-7xl mx-auto p-4 lg:p-6 space-y-5 text-slate-100 min-h-screen pb-12">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3 border-b border-slate-800/60 pb-4">
        <div>
          <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">TELEMETRY SYSTEM MONITOR</h3>
          <h2 className="text-xl font-bold text-white tracking-tight">Check Sprint Logs</h2>
          <p className="text-slate-400 text-xs mt-0.5">Relational analytical cross-examination of employee status packets.</p>
        </div>
        <button className="flex items-center gap-2 bg-[#0f172a] hover:bg-slate-800 border border-slate-800 text-slate-300 px-3 py-2 rounded-full text-[11px] font-bold uppercase tracking-wider transition-all">
          <Download size={12} /> Export Company CSV
        </button>
      </div>

      {/* Filter Board Panel */}
      <div className="bg-[#020617] border border-slate-800 rounded-xl overflow-hidden shadow-lg">
        <button 
          onClick={() => setIsFilterOpen(!isFilterOpen)} 
          className="w-full flex justify-between items-center p-4 bg-[#0f172a]/30 hover:bg-[#0f172a]/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-blue-400" />
            <span className="text-xs font-bold text-slate-200 tracking-wide">Search Operators Filter Panel</span>
          </div>
          <ChevronDown size={16} className={`text-slate-500 transition-transform duration-300 ${isFilterOpen ? 'rotate-180' : ''}`} />
        </button>

        {isFilterOpen && (
          <div className="p-5 border-t border-slate-900/60 bg-[#020617] space-y-4">
            <div className="flex flex-wrap gap-2 bg-[#0f172a]/30 p-1 rounded-lg border border-slate-900 inline-flex">
              {(['today', 'yesterday', 'week', 'month'] as const).map((preset) => (
                <button
                  key={preset}
                  onClick={() => setDateRange(preset)}
                  className={`px-3 py-1 rounded-md text-[11px] font-semibold capitalize transition-all ${dateRange === preset ? 'bg-slate-800 text-white border border-slate-700/60' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  {preset === 'week' ? 'This Week' : preset === 'month' ? 'This Month' : preset}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Date Bound: From</label>
                <input type="date" value={dateFrom} onChange={e => {setDateFrom(e.target.value); setDateRange('custom');}} className="w-full bg-[#0f172a] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none [color-scheme:dark]" />
              </div>
              
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Date Bound: To</label>
                <input type="date" value={dateTo} onChange={e => {setDateTo(e.target.value); setDateRange('custom');}} className="w-full bg-[#0f172a] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none [color-scheme:dark]" />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Employee Roster</label>
                <select disabled={user?.role === 'employee'} value={user?.role === 'employee' ? user.name : filterName} onChange={e => setFilterName(e.target.value)} className="w-full bg-[#0f172a] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none appearance-none disabled:opacity-60">
                  {user?.role === 'employee' ? (
                    <option value={user.name}>{user.name}</option>
                  ) : (
                    <>
                      <option value="All employees">All Corporate Employees</option>
                      <option value="Puneet Kumar">Puneet Kumar</option>
                      <option value="Simran Kaur">Simran Kaur</option>
                    </>
                  )}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Client Portfolio</label>
                <select value={filterClient} onChange={e => setFilterClient(e.target.value)} className="w-full bg-[#0f172a] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none appearance-none">
                  <option value="All clients">All Registered Clients</option>
                  <option value="Key Software Services Pvt Ltd">Key Software Services Pvt Ltd</option>
                  <option value="Acme Holdings">Acme Holdings</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Counters Metadata */}
      <div className="flex justify-between items-center bg-[#0f172a]/20 border border-slate-900 p-3 rounded-xl px-4 text-[11px] font-bold text-slate-400 uppercase">
        <span>Query Resolution Matrix: <span className="text-blue-400 font-mono ml-0.5">{logs.length} Blocks</span></span>
        <span>Aggregated Telemetry Time: <span className="text-emerald-400 font-mono ml-0.5">{calculatedTotalHours.toFixed(1)} Hours</span></span>
      </div>

      {/* FIX: Removed inner scroll limits. Let the responsive container stretch naturally inside the page flow */}
      <div className="border border-slate-800 rounded-xl bg-[#020617] shadow-xl overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-[#0f172a]/50 text-slate-400 border-b border-slate-800/80 font-bold text-[10px] uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3">Client Portfolio</th>
                <th className="px-5 py-3">Sprint Project</th>
                <th className="px-5 py-3">Engineer Identity</th>
                <th className="px-5 py-3">Module Component</th>
                <th className="px-5 py-3 max-w-xs">Task Contribution Description</th>
                <th className="px-5 py-3">Calendar Date</th>
                <th className="px-5 py-3">Continuous Interval</th>
                <th className="px-5 py-3 text-right pr-6">Logged Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900/40 font-medium text-slate-300">
              {loading ? (
                <tr><td colSpan={8} className="px-5 py-8 text-center text-slate-500 italic">Synchronizing logs from D1 cluster engine...</td></tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={8} className="px-5 py-8 text-center text-slate-500 italic">No active status entries captured matching filters parameters bounds.</td></tr>
              ) : (
                logs.map((log, index) => {
                  const resolvedFields = parseCompoundProjectString(log.project_name);
                  return (
                    <tr key={log.id || index} className="hover:bg-slate-900/30 transition-colors">
                      <td className="px-5 py-3.5 font-bold text-slate-200">{resolvedFields.client}</td>
                      <td className="px-5 py-3.5 text-blue-400 font-semibold">{resolvedFields.project}</td>
                      <td className="px-5 py-3.5 font-bold text-slate-100">{log.employee_name || 'Puneet Kumar'}</td>
                      <td className="px-5 py-3.5 text-slate-400 font-mono">{log.module_name || 'General Task'}</td>
                      <td className="px-5 py-3.5 max-w-xs truncate font-normal" title={log.task_description}>{log.task_description}</td>
                      <td className="px-5 py-3.5 text-slate-400 font-mono">{log.entry_date}</td>
                      <td className="px-5 py-3.5 text-slate-400 font-mono text-[11px]">{log.start_time} → {log.end_time}</td>
                      <td className="px-5 py-3.5 text-right pr-6">
                        <span className="bg-emerald-950/40 text-emerald-400 border border-emerald-900/40 px-2 py-0.5 rounded font-bold font-mono">
                          {Number(log.duration_hours || 0).toFixed(1)}h
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};