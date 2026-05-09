import React, { useState, useEffect, useMemo } from 'react';
import { 
  UserPlus, MessageSquare, Search, Trash2, 
  Scissors, LogOut, RefreshCw, CheckSquare, 
  Square, User as UserIcon, TrendingUp, Wallet, 
  ChevronDown, FolderClock, Flame, Trophy, BarChart3, X, Filter
} from 'lucide-react';
import { format, differenceInDays, parseISO, startOfDay, subDays, eachDayOfInterval, isSameDay } from 'date-fns';
import { supabase } from './lib/supabase';

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}

interface Client {
  id: string;
  name: string;
  phone: string;
  price: number;
  services: string[];
  last_visit: string;
  streak_count: number;
  previous_name?: string;
}

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [userName, setUserName] = useState('');
  const [loginError, setLoginError] = useState('');

  const [allRecords, setAllRecords] = useState<Client[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isRenewModalOpen, setIsRenewModalOpen] = useState(false);
  const [isRankingOpen, setIsRankingOpen] = useState(false);
  const [isFaturamentoOpen, setIsFaturamentoOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isHistoryView, setIsHistoryView] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [delayFilter, setDelayFilter] = useState('all');
  const [rankingSort, setRankingSort] = useState<'streak' | 'spent' | 'cabelo' | 'barba' | 'sobrancelha'>('streak');
  const [faturamentoPeriod, setFaturamentoPeriod] = useState('month');

  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [newDate, setNewDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedPhones, setSelectedPhones] = useState<string[]>([]);
  const [phonesToDelete, setPhonesToDelete] = useState<string[]>([]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
    });
    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase.from('profiles').select('full_name').eq('id', userId).maybeSingle();
    if (data?.full_name) { setUserName(data.full_name); setIsProfileModalOpen(false); }
    else setIsProfileModalOpen(true);
  };

  const updateProfile = async () => {
    if (!userName.trim() || !session) return;
    await supabase.from('profiles').upsert({ id: session.user.id, full_name: userName.trim() });
    setIsProfileModalOpen(false);
  };

  const fetchClients = async () => {
    if (!session) return;
    const { data, error } = await supabase.from('clientes').select('*').order('last_visit', { ascending: false });
    if (!error && data) {
      setAllRecords(data.map(c => ({ 
        ...c, 
        price: Number(c.price) || 0, 
        services: Array.isArray(c.services) ? c.services : [], 
        streak_count: Number(c.streak_count) || 1 
      })));
    }
  };

  useEffect(() => { if (session) fetchClients(); }, [session]);

  const saveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    const phone = newPhone.replace(/\D/g, '');
    let prevName = editingClient?.previous_name || null;
    let nextStreak = 1;

    if (editingClient) {
      if (editingClient.name !== newName) prevName = editingClient.name;
      if (isRenewModalOpen) nextStreak = (Number(editingClient.streak_count) || 1) + 1;
      else nextStreak = Number(editingClient.streak_count) || 1;
    }

    const payload = {
      name: newName, phone, last_visit: newDate,
      user_id: session.user.id, services: selectedServices,
      price: Number(newPrice) || 0, previous_name: prevName,
      streak_count: nextStreak
    };

    const { error } = (isRenewModalOpen) 
      ? await supabase.from('clientes').insert([payload])
      : editingClient ? await supabase.from('clientes').update(payload).eq('id', editingClient.id)
      : await supabase.from('clientes').insert([payload]);

    if (!error) {
      setIsModalOpen(false); setIsRenewModalOpen(false); setEditingClient(null); resetForm();
      fetchClients();
    }
  };

  const executeDelete = async () => {
    if (phonesToDelete.length === 0) return;
    await supabase.from('clientes').delete().in('phone', phonesToDelete);
    setAllRecords(prev => prev.filter(r => !phonesToDelete.includes(r.phone)));
    setIsDeleteModalOpen(false); setIsSelectionMode(false); setSelectedPhones([]); setPhonesToDelete([]);
  };

  const resetForm = () => {
    setNewName(''); setNewPhone(''); setNewPrice(''); setSelectedServices([]);
    setNewDate(format(new Date(), 'yyyy-MM-dd'));
  };

  const openRenewModal = (client: Client) => {
    setEditingClient(client); setNewName(client.name); setNewPhone(client.phone);
    setNewPrice(client.price.toString()); setSelectedServices(client.services);
    setNewDate(format(new Date(), 'yyyy-MM-dd')); setIsRenewModalOpen(true);
  };

  const { dashboardList, historyList, rankingList } = useMemo(() => {
    const sorted = [...allRecords].sort((a, b) => parseISO(b.last_visit).getTime() - parseISO(a.last_visit).getTime());
    const latestMap = new Map<string, Client>();
    const history: Client[] = [];
    const rankMap = new Map<string, any>();

    sorted.forEach(r => {
      if (!latestMap.has(r.phone)) latestMap.set(r.phone, r);
      else history.push(r);
      const cur = rankMap.get(r.phone) || { name: r.name, phone: r.phone, spent: 0, streak: 0, cabelo: 0, barba: 0, sobrancelha: 0 };
      cur.spent += r.price; cur.streak = Math.max(cur.streak, r.streak_count);
      if (r.services.includes('Cabelo')) cur.cabelo++;
      if (r.services.includes('Barba')) cur.barba++;
      if (r.services.includes('Sobrancelha')) cur.sobrancelha++;
      rankMap.set(r.phone, cur);
    });

    const dashboardOrdered = Array.from(latestMap.values()).sort((a, b) => parseISO(a.last_visit).getTime() - parseISO(b.last_visit).getTime());
    const rankArray = Array.from(rankMap.values()).sort((a, b) => {
      if (rankingSort === 'streak') return b.streak - a.streak;
      if (rankingSort === 'spent') return b.spent - a.spent;
      return b[rankingSort] - a[rankingSort];
    });
    return { dashboardList: dashboardOrdered, historyList: history, rankingList: rankArray };
  }, [allRecords, rankingSort]);

  const revenueChartData = useMemo(() => {
    const today = startOfDay(new Date());
    const daysCount = faturamentoPeriod === 'week' ? 7 : faturamentoPeriod === 'today' ? 1 : 30;
    const interval = eachDayOfInterval({ start: subDays(today, daysCount - 1), end: today });
    const points = interval.map(day => {
      const dailyTotal = allRecords.filter(r => isSameDay(parseISO(r.last_visit), day)).reduce((acc, cur) => acc + cur.price, 0);
      return { date: day, total: dailyTotal };
    });
    const maxVal = Math.max(...points.map(p => p.total), 1);
    const totalRevenue = points.reduce((acc, p) => acc + p.total, 0);
    return { points, maxVal, totalRevenue };
  }, [allRecords, faturamentoPeriod]);

  const stats = useMemo(() => {
    const today = startOfDay(new Date());
    const needsRecovery = dashboardList.filter(c => differenceInDays(today, parseISO(c.last_visit)) >= 20).length;
    const filteredDashboard = dashboardList.filter(c => {
      const days = differenceInDays(today, parseISO(c.last_visit));
      if (delayFilter === '20days') return days >= 20;
      if (delayFilter === '30days') return days >= 30;
      return true;
    });
    return { list: filteredDashboard, needsRecovery, fidelity: dashboardList.length > 0 ? Math.round(((dashboardList.length - needsRecovery) / dashboardList.length) * 100) : 0 };
  }, [dashboardList, delayFilter]);

  const getStreakColor = (count: number) => {
    if (count < 10) return 'text-white';
    if (count < 20) return 'text-yellow-400 drop-shadow-[0_0_5px_yellow]';
    if (count < 30) return 'text-[#00ff41] drop-shadow-[0_0_8px_#00ff41]';
    if (count < 40) return 'text-[#00f3ff] drop-shadow-[0_0_8px_#00f3ff]';
    if (count < 50) return 'text-[#ff00ff] drop-shadow-[0_0_8px_#ff00ff]';
    return 'animate-text-rainbow font-black';
  };

  if (authLoading) return <div className="min-h-screen bg-[#050505] flex items-center justify-center text-amber-500 animate-pulse text-2xl font-black italic">BARBER PRO</div>;

  if (!session) return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6">
      <form onSubmit={async (e) => { e.preventDefault(); const {error} = await supabase.auth.signInWithPassword({email, password}); if(error) setLoginError('Login inválido'); }} className="bg-zinc-900/40 p-8 lg:p-12 rounded-[2.5rem] border border-white/5 space-y-6 w-full max-w-sm shadow-2xl backdrop-blur-xl">
        <h1 className="text-3xl font-black text-white italic tracking-tighter text-center uppercase">BARBER <span className="text-amber-500">PRO</span></h1>
        {loginError && <p className="text-red-500 text-[10px] text-center font-black uppercase tracking-widest">{loginError}</p>}
        <input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="E-mail" className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 outline-none focus:border-amber-500 text-white" />
        <input required type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Senha" className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 outline-none focus:border-amber-500 text-white" />
        <button className="w-full bg-amber-500 text-black py-4 rounded-2xl font-black uppercase shadow-xl active:scale-95 transition-all">Entrar</button>
      </form>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-amber-500/30 overflow-x-hidden">
      <style>{`
        @keyframes text-rainbow { 0% { color: #ff0000; } 25% { color: #00ff00; } 50% { color: #0000ff; } 75% { color: #ff00ff; } 100% { color: #ff0000; } }
        .animate-text-rainbow { animation: text-rainbow 2s linear infinite; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .glass-card { background: rgba(24, 24, 27, 0.4); backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.05); transition: all 0.3s ease; }
      `}</style>

      <header className="sticky top-0 z-40 px-4 lg:px-20 h-16 lg:h-24 flex items-center justify-between bg-[#050505]/80 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center gap-3">
          <button onClick={() => setIsProfileModalOpen(true)} className="w-9 h-9 lg:w-12 lg:h-12 glass-card rounded-xl flex items-center justify-center text-zinc-400 hover:text-amber-500"><UserIcon size={18} /></button>
          <div className="text-base lg:text-2xl font-black italic tracking-tighter truncate max-w-[150px]">Olá, {userName.split(' ')[0]}!</div>
        </div>
        <div className="flex items-center gap-1.5 lg:gap-4">
          <button onClick={() => setIsRankingOpen(true)} className="p-2 lg:p-4 glass-card text-amber-500 rounded-xl"><Trophy size={18} /></button>
          <button onClick={() => setIsFaturamentoOpen(true)} className="p-2 lg:p-4 glass-card text-emerald-500 rounded-xl"><BarChart3 size={18} /></button>
          <button onClick={() => setIsHistoryView(!isHistoryView)} className={cn("p-2 lg:p-4 rounded-xl border border-white/5 transition-all", isHistoryView ? "bg-amber-500 text-black" : "glass-card text-zinc-500")}><FolderClock size={18} /></button>
          <button onClick={() => { resetForm(); setIsModalOpen(true); }} className="bg-amber-500 text-black px-3 lg:px-8 py-2 lg:py-4 rounded-xl lg:rounded-2xl font-black text-[10px] lg:text-xs hover:scale-105 active:scale-95 transition-all shadow-lg flex items-center gap-1.5 uppercase tracking-widest"><UserPlus size={16} /> <span className="hidden lg:inline">CADASTRAR</span></button>
          <button onClick={() => setIsLogoutModalOpen(true)} className="p-2 text-zinc-700 hover:text-red-500 transition-colors"><LogOut size={18} /></button>
        </div>
      </header>

      <main className="p-4 lg:p-24 max-w-[1800px] mx-auto space-y-8 lg:space-y-12 pb-40">
        {!isHistoryView && (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-8 animate-in fade-in slide-in-from-top-4 duration-700">
            <div className="col-span-2 lg:col-span-1 bg-gradient-to-br from-zinc-900 to-black border border-white/10 p-5 lg:p-10 rounded-[2rem] lg:rounded-[3rem] relative overflow-hidden shadow-2xl">
              <TrendingUp className="absolute top-0 right-0 p-4 opacity-5" size={80} />
              <p className="text-[9px] lg:text-[11px] font-black text-zinc-500 uppercase tracking-widest mb-1">Fidelidade</p>
              <p className="text-4xl lg:text-9xl font-black text-amber-500 tracking-tighter">{stats.fidelity}%</p>
            </div>
            <div className="glass-card p-5 lg:p-10 rounded-[1.5rem] flex flex-col justify-center">
              <p className="text-[9px] lg:text-[11px] text-red-500 font-black uppercase tracking-widest mb-1">Recuperar</p>
              <p className="text-3xl lg:text-7xl font-black text-red-500 tracking-tighter">{stats.needsRecovery}</p>
            </div>
            <div className="glass-card p-5 lg:p-10 rounded-[1.5rem] flex flex-col justify-center">
              <p className="text-[9px] lg:text-[11px] text-zinc-500 font-black uppercase tracking-widest mb-1">Clientes</p>
              <p className="text-3xl lg:text-7xl font-black text-white tracking-tighter">{dashboardList.length}</p>
            </div>
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-4 lg:gap-8 items-center">
          <div className="relative flex-1 group w-full">
            <Search className="absolute left-4 lg:left-8 top-1/2 -translate-y-1/2 w-4 lg:w-6 h-4 lg:h-6 text-zinc-600 group-focus-within:text-amber-500 transition-all" />
            <input type="text" placeholder="Localizar cliente..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-zinc-900/30 border border-white/10 rounded-2xl lg:rounded-3xl pl-12 lg:pl-20 pr-6 lg:pr-10 py-3 lg:py-6 outline-none focus:border-amber-500/40 text-sm lg:text-xl font-medium text-white" />
          </div>
          <div className="relative w-full lg:w-auto min-w-[300px]">
            <select value={delayFilter} onChange={(e) => setDelayFilter(e.target.value)} className="appearance-none bg-zinc-900/50 border border-white/10 rounded-2xl px-6 py-3 lg:py-6 pr-12 text-[10px] lg:text-[12px] font-black uppercase tracking-widest outline-none focus:border-amber-500/50 w-full cursor-pointer text-white">
              <option value="all">Ver Todos</option>
              <option value="20days">Ausentes +20 dias</option>
              <option value="30days">Ausentes +30 dias</option>
            </select>
            <ChevronDown size={16} className="absolute right-6 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-8">
          {(isHistoryView ? historyList : stats.list)
            .filter(c => (c.name || '').toLowerCase().includes(searchTerm.toLowerCase()))
            .map(c => {
              const days = differenceInDays(startOfDay(new Date()), parseISO(c.last_visit));
              const isSel = selectedPhones.includes(c.phone);
              const isAlert = days >= 20;

              return (
                <div key={c.id} className={cn("glass-card rounded-[1.5rem] lg:rounded-[3rem] p-4 lg:p-8 flex flex-col justify-between transition-all", isSel ? "border-amber-500 bg-amber-500/5" : "")}>
                  <div className="flex items-start justify-between mb-4 lg:mb-8">
                    <div className="flex items-center gap-3 lg:gap-6">
                      {isSelectionMode ? (
                        <button onClick={() => setSelectedPhones(p => isSel ? p.filter(x => x !== c.phone) : [...p, c.phone])}>
                          {isSel ? <div className="w-8 h-8 bg-amber-500 rounded-xl flex items-center justify-center text-black shadow-lg"><CheckSquare size={18} /></div> : <div className="w-8 h-8 border-2 border-zinc-800 rounded-lg hover:border-amber-500/50 transition-colors" />}
                        </button>
                      ) : (
                        <div className="relative">
                          <div className="w-12 h-12 lg:w-20 lg:h-20 bg-gradient-to-br from-zinc-800 to-zinc-900 border border-white/10 rounded-xl lg:rounded-2xl flex items-center justify-center text-amber-500 font-black text-lg lg:text-3xl shadow-inner">{c.name?.[0]?.toUpperCase()}</div>
                          {Number(c.streak_count) >= 2 && !isHistoryView && (
                            <div className={cn("absolute -top-2 -right-2 flex items-center gap-1 bg-black/90 px-2 py-1 rounded-full border border-white/20 text-[9px] lg:text-xs font-black shadow-2xl", getStreakColor(Number(c.streak_count)))}>
                              <Flame size={12} className="fill-current" /> {c.streak_count}
                            </div>
                          )}
                        </div>
                      )}
                      <div className="max-w-[150px] lg:max-w-none text-left">
                        <p className="font-black text-sm lg:text-2xl text-white/95 leading-none truncate">{c.name}</p>
                        {c.previous_name && c.previous_name !== c.name && (
                          <span className="text-[8px] lg:text-[10px] text-zinc-500 block italic font-bold mt-1 tracking-widest uppercase">Ant. {c.previous_name}</span>
                        )}
                        <p className="text-[10px] lg:text-[12px] text-zinc-500 font-black uppercase mt-1.5 lg:mt-3">R$ {c.price} • {c.services?.join(' + ')}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={cn("text-xl lg:text-4xl font-black tracking-tighter leading-none", isAlert ? "text-red-500" : "text-amber-500")}>{days}d</p>
                      <p className="text-[8px] lg:text-[10px] text-zinc-700 font-black uppercase mt-1">Atraso</p>
                    </div>
                  </div>

                  <div className="flex gap-2 lg:gap-4 pt-4 lg:pt-8 border-t border-white/5">
                    {!isHistoryView && (
                      <button onClick={() => openRenewModal(c)} className="flex-1 py-3 lg:py-5 bg-emerald-500/10 text-emerald-500 rounded-xl lg:rounded-2xl hover:bg-emerald-500 transition-all flex justify-center items-center gap-1.5 font-black text-[9px] uppercase"><RefreshCw size={16} /> Renovar</button>
                    )}
                    <a 
                      href={`https://wa.me/55${c.phone}?text=${encodeURIComponent(`Olá ${c.name.split(' ')[0]}! Tudo bem? Notei que faz um tempinho que você não passa aqui na barbearia para dar aquele talento. Que tal agendarmos um horário para essa semana? Estaremos te   const [isRenewModalOpen, setIsRenewModalOpen] = useState(false);
  const [isRankingOpen, setIsRankingOpen] = useState(false);
  const [isFaturamentoOpen, setIsFaturamentoOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isHistoryView, setIsHistoryView] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [delayFilter, setDelayFilter] = useState('all');
  const [rankingSort, setRankingSort] = useState<'streak' | 'spent' | 'cabelo' | 'barba' | 'sobrancelha'>('streak');
  const [faturamentoPeriod, setFaturamentoPeriod] = useState('month');

  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [newDate, setNewDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedPhones, setSelectedPhones] = useState<string[]>([]);
  const [phonesToDelete, setPhonesToDelete] = useState<string[]>([]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
    });
    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase.from('profiles').select('full_name').eq('id', userId).maybeSingle();
    if (data?.full_name) { setUserName(data.full_name); setIsProfileModalOpen(false); }
    else setIsProfileModalOpen(true);
  };

  const updateProfile = async () => {
    if (!userName.trim() || !session) return;
    await supabase.from('profiles').upsert({ id: session.user.id, full_name: userName.trim() });
    setIsProfileModalOpen(false);
  };

  const fetchClients = async () => {
    if (!session) return;
    const { data, error } = await supabase.from('clientes').select('*').order('last_visit', { ascending: false });
    if (!error && data) {
      setAllRecords(data.map(c => ({ 
        ...c, 
        price: Number(c.price) || 0, 
        services: Array.isArray(c.services) ? c.services : [], 
        streak_count: Number(c.streak_count) || 1 
      })));
    }
  };

  useEffect(() => { if (session) fetchClients(); }, [session]);

  const saveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    const phone = newPhone.replace(/\D/g, '');
    let prevName = editingClient?.name || null;
    let nextStreak = 1;

    if (editingClient) {
      if (editingClient.name === newName) prevName = editingClient.previous_name || null;
      if (isRenewModalOpen) nextStreak = (Number(editingClient.streak_count) || 1) + 1;
      else nextStreak = Number(editingClient.streak_count) || 1;
    }

    const payload = {
      name: newName, phone, last_visit: newDate,
      user_id: session.user.id, services: selectedServices,
      price: Number(newPrice) || 0, previous_name: prevName,
      streak_count: nextStreak
    };

    const { error } = (isRenewModalOpen) 
      ? await supabase.from('clientes').insert([payload])
      : editingClient ? await supabase.from('clientes').update(payload).eq('id', editingClient.id)
      : await supabase.from('clientes').insert([payload]);

    if (!error) {
      setIsModalOpen(false); setIsRenewModalOpen(false); setEditingClient(null); resetForm();
      fetchClients();
    }
  };

  const executeDelete = async () => {
    if (phonesToDelete.length === 0) return;
    await supabase.from('clientes').delete().in('phone', phonesToDelete);
    setAllRecords(prev => prev.filter(r => !phonesToDelete.includes(r.phone)));
    setIsDeleteModalOpen(false); setIsSelectionMode(false); setSelectedPhones([]); setPhonesToDelete([]);
  };

  const resetForm = () => {
    setNewName(''); setNewPhone(''); setNewPrice(''); setSelectedServices([]);
    setNewDate(format(new Date(), 'yyyy-MM-dd'));
  };

  const openRenewModal = (client: Client) => {
    setEditingClient(client); setNewName(client.name); setNewPhone(client.phone);
    setNewPrice(client.price.toString()); setSelectedServices(client.services);
    setNewDate(format(new Date(), 'yyyy-MM-dd')); setIsRenewModalOpen(true);
  };

  const { dashboardList, historyList, rankingList } = useMemo(() => {
    const sorted = [...allRecords].sort((a, b) => parseISO(b.last_visit).getTime() - parseISO(a.last_visit).getTime());
    const latestMap = new Map<string, Client>();
    const history: Client[] = [];
    const rankMap = new Map<string, any>();

    sorted.forEach(r => {
      if (!latestMap.has(r.phone)) latestMap.set(r.phone, r);
      else history.push(r);

      const cur = rankMap.get(r.phone) || { name: r.name, phone: r.phone, spent: 0, streak: 0, cabelo: 0, barba: 0, sobrancelha: 0 };
      cur.spent += r.price;
      cur.streak = Math.max(cur.streak, r.streak_count);
      if (r.services.includes('Cabelo')) cur.cabelo++;
      if (r.services.includes('Barba')) cur.barba++;
      if (r.services.includes('Sobrancelha')) cur.sobrancelha++;
      rankMap.set(r.phone, cur);
    });

    const dashboardOrdered = Array.from(latestMap.values()).sort((a, b) => parseISO(a.last_visit).getTime() - parseISO(b.last_visit).getTime());
    const rankArray = Array.from(rankMap.values()).sort((a, b) => {
      if (rankingSort === 'streak') return b.streak - a.streak;
      if (rankingSort === 'spent') return b.spent - a.spent;
      return b[rankingSort] - a[rankingSort];
    });

    return { dashboardList: dashboardOrdered, historyList: history, rankingList: rankArray };
  }, [allRecords, rankingSort]);

  const revenueChartData = useMemo(() => {
    const today = startOfDay(new Date());
    const daysCount = faturamentoPeriod === 'week' ? 7 : faturamentoPeriod === 'today' ? 1 : 30;
    const interval = eachDayOfInterval({ start: subDays(today, daysCount - 1), end: today });

    const points = interval.map(day => {
      const dailyTotal = allRecords.filter(r => isSameDay(parseISO(r.last_visit), day)).reduce((acc, cur) => acc + cur.price, 0);
      return { date: day, total: dailyTotal };
    });

    const maxVal = Math.max(...points.map(p => p.total), 1);
    const totalRevenue = points.reduce((acc, p) => acc + p.total, 0);
    return { points, maxVal, totalRevenue };
  }, [allRecords, faturamentoPeriod]);

  const stats = useMemo(() => {
    const today = startOfDay(new Date());
    const needsRecovery = dashboardList.filter(c => differenceInDays(today, parseISO(c.last_visit)) >= 20).length;
    const filteredDashboard = dashboardList.filter(c => {
      const days = differenceInDays(today, parseISO(c.last_visit));
      if (delayFilter === '20days') return days >= 20;
      if (delayFilter === '30days') return days >= 30;
      return true;
    });
    return { list: filteredDashboard, needsRecovery, fidelity: dashboardList.length > 0 ? Math.round(((dashboardList.length - needsRecovery) / dashboardList.length) * 100) : 0 };
  }, [dashboardList, delayFilter]);

  if (authLoading) return <div className="min-h-screen bg-[#050505] flex items-center justify-center text-amber-500 animate-pulse text-2xl font-black italic">BARBER PRO</div>;

  if (!session) return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6">
      <form onSubmit={async (e) => { e.preventDefault(); const {error} = await supabase.auth.signInWithPassword({email, password}); if(error) setLoginError('Login inválido'); }} className="bg-zinc-900/40 p-10 rounded-[3rem] border border-white/5 space-y-6 w-full max-w-sm shadow-2xl backdrop-blur-xl">
        <h1 className="text-3xl font-black text-white italic tracking-tighter text-center uppercase">BARBER <span className="text-amber-500">PRO</span></h1>
        {loginError && <p className="text-red-500 text-[10px] text-center font-black uppercase">{loginError}</p>}
        <input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="E-mail" className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 outline-none focus:border-amber-500 text-white" />
        <input required type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Senha" className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 outline-none focus:border-amber-500 text-white" />
        <button className="w-full bg-amber-500 text-black py-4 rounded-2xl font-black uppercase shadow-xl active:scale-95 transition-all">Entrar</button>
      </form>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-amber-500/30 overflow-x-hidden">
      <style>{`
        @keyframes text-rainbow { 0% { color: #ff0000; } 25% { color: #00ff00; } 50% { color: #0000ff; } 75% { color: #ff00ff; } 100% { color: #ff0000; } }
        .animate-text-rainbow { animation: text-rainbow 2s linear infinite; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .glass-card { background: rgba(24, 24, 27, 0.4); backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.05); transition: all 0.3s ease; }
      `}</style>

      <header className="sticky top-0 z-40 px-4 lg:px-20 h-16 lg:h-24 flex items-center justify-between bg-[#050505]/80 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center gap-3">
          <button onClick={() => setIsProfileModalOpen(true)} className="w-9 h-9 lg:w-12 lg:h-12 glass-card rounded-xl flex items-center justify-center text-zinc-400 hover:text-amber-500"><UserIcon size={18} /></button>
          <div className="text-base lg:text-2xl font-black italic tracking-tighter truncate max-w-[150px]">Olá, {userName.split(' ')[0]}!</div>
        </div>
        <div className="flex items-center gap-1.5 lg:gap-4">
          <button onClick={() => setIsRankingOpen(true)} className="p-2 lg:p-4 glass-card text-amber-500 rounded-xl"><Trophy size={18} /></button>
          <button onClick={() => setIsFaturamentoOpen(true)} className="p-2 lg:p-4 glass-card text-emerald-500 rounded-xl"><BarChart3 size={18} /></button>
          <button onClick={() => setIsHistoryView(!isHistoryView)} className={cn("p-2 lg:p-4 rounded-xl border border-white/5 transition-all", isHistoryView ? "bg-amber-500 text-black" : "glass-card text-zinc-500")}><FolderClock size={18} /></button>
          <button onClick={() => { resetForm(); setIsModalOpen(true); }} className="bg-amber-500 text-black px-3 lg:px-8 py-2 lg:py-4 rounded-xl lg:rounded-2xl font-black text-[10px] lg:text-xs hover:scale-105 active:scale-95 transition-all shadow-lg flex items-center gap-1.5 uppercase tracking-widest"><UserPlus size={16} /> <span className="hidden lg:inline">CADASTRAR</span></button>
          <button onClick={() => setIsLogoutModalOpen(true)} className="p-2 text-zinc-700 hover:text-red-500 transition-colors"><LogOut size={18} /></button>
        </div>
      </header>

      <main className="p-4 lg:p-24 max-w-[1800px] mx-auto space-y-8 lg:space-y-12 pb-40">
        {!isHistoryView && (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-8 animate-in fade-in slide-in-from-top-4 duration-700">
            <div className="col-span-2 lg:col-span-1 bg-gradient-to-br from-zinc-900 to-black border border-white/10 p-5 lg:p-10 rounded-[2rem] lg:rounded-[3rem] relative overflow-hidden shadow-2xl">
              <TrendingUp className="absolute top-0 right-0 p-4 opacity-5" size={80} />
              <p className="text-[9px] lg:text-[11px] font-black text-zinc-500 uppercase tracking-widest mb-1">Fidelidade</p>
              <p className="text-4xl lg:text-9xl font-black text-amber-500 tracking-tighter">{stats.fidelity}%</p>
            </div>
            <div className="glass-card p-5 lg:p-10 rounded-[1.5rem] flex flex-col justify-center">
              <p className="text-[9px] lg:text-[11px] text-red-500 font-black uppercase tracking-widest mb-1">Recuperar</p>
              <p className="text-3xl lg:text-7xl font-black text-red-500 tracking-tighter">{stats.needsRecovery}</p>
            </div>
            <div className="glass-card p-5 lg:p-10 rounded-[1.5rem] flex flex-col justify-center">
              <p className="text-[9px] lg:text-[11px] text-zinc-500 font-black uppercase tracking-widest mb-1">Clientes</p>
              <p className="text-3xl lg:text-7xl font-black text-white tracking-tighter">{dashboardList.length}</p>
            </div>
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-4 lg:gap-8 items-center">
          <div className="relative flex-1 group w-full">
            <Search className="absolute left-4 lg:left-8 top-1/2 -translate-y-1/2 w-4 lg:w-6 h-4 lg:h-6 text-zinc-600 group-focus-within:text-amber-500 transition-all" />
            <input type="text" placeholder="Localizar cliente..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-zinc-900/30 border border-white/10 rounded-2xl lg:rounded-3xl pl-12 lg:pl-20 pr-6 lg:pr-10 py-3 lg:py-6 outline-none focus:border-amber-500/40 text-sm lg:text-xl font-medium text-white shadow-inner" />
          </div>
          <div className="relative w-full lg:w-auto min-w-[300px]">
            <select value={delayFilter} onChange={(e) => setDelayFilter(e.target.value)} className="appearance-none bg-zinc-900/50 border border-white/10 rounded-2xl px-6 py-3 lg:py-6 pr-12 text-[10px] lg:text-[12px] font-black uppercase tracking-widest outline-none focus:border-amber-500/50 w-full cursor-pointer text-white">
              <option value="all">Ver Todos</option>
              <option value="20days">Ausentes +20 dias</option>
              <option value="30days">Ausentes +30 dias</option>
            </select>
            <ChevronDown size={16} className="absolute right-6 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-8">
          {(isHistoryView ? historyList : stats.list)
            .filter(c => (c.name || '').toLowerCase().includes(searchTerm.toLowerCase()))
            .map(c => {
              const days = differenceInDays(startOfDay(new Date()), parseISO(c.last_visit));
              const isSel = selectedPhones.includes(c.phone);
              const isAlert = days >= 20;

              return (
                <div key={c.id} className={cn("glass-card rounded-[1.5rem] lg:rounded-[3rem] p-4 lg:p-8 flex flex-col justify-between transition-all", isSel ? "border-amber-500 bg-amber-500/5" : "")}>
                  <div className="flex items-start justify-between mb-4 lg:mb-8">
                    <div className="flex items-center gap-3 lg:gap-6">
                      {isSelectionMode ? (
                        <button onClick={() => setSelectedPhones(p => isSel ? p.filter(x => x !== c.phone) : [...p, c.phone])}>
                          {isSel ? <div className="w-8 h-8 bg-amber-500 rounded-xl flex items-center justify-center text-black shadow-lg shadow-amber-500/20"><CheckSquare size={18} /></div> : <div className="w-8 h-8 border-2 border-zinc-800 rounded-lg hover:border-amber-500/50 transition-colors" />}
                        </button>
                      ) : (
                        <div className="relative">
                          <div className="w-12 h-12 lg:w-20 lg:h-20 bg-gradient-to-br from-zinc-800 to-zinc-900 border border-white/10 rounded-xl lg:rounded-2xl flex items-center justify-center text-amber-500 font-black text-lg lg:text-3xl shadow-inner">{c.name?.[0]?.toUpperCase()}</div>
                          {Number(c.streak_count) >= 2 && !isHistoryView && (
                            <div className={cn("absolute -top-2 -right-2 flex items-center gap-1 bg-black/90 px-2 py-1 rounded-full border border-white/20 text-[9px] lg:text-xs font-black shadow-2xl", 
                              c.streak_count < 10 ? 'text-white' : 
                              c.streak_count < 20 ? 'text-yellow-400' :
                              c.streak_count < 30 ? 'text-[#00ff41]' :
                              c.streak_count < 40 ? 'text-[#00f3ff]' :
                              c.streak_count < 50 ? 'text-[#ff00ff]' : 'animate-text-rainbow'
                            )}>
                              <Flame size={12} className="fill-current" /> {c.streak_count}
                            </div>
                          )}
                        </div>
                      )}
                      <div className="max-w-[150px] lg:max-w-none">
                        <p className="font-black text-sm lg:text-2xl text-white/95 leading-none truncate">{c.name}</p>
                        {c.previous_name && c.previous_name !== c.name && (
                          <span className="text-[8px] lg:text-[10px] text-zinc-500 block italic font-bold mt-1 tracking-widest uppercase">Ant. {c.previous_name}</span>
                        )}
                        <p className="text-[10px] lg:text-[12px] text-zinc-500 font-black uppercase mt-1.5 lg:mt-3">R$ {c.price} • {c.services?.join(' + ')}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={cn("text-xl lg:text-4xl font-black tracking-tighter leading-none", isAlert ? "text-red-500" : "text-amber-500")}>{days}d</p>
                      <p className="text-[8px] lg:text-[10px] text-zinc-700 font-black uppercase mt-1">Atraso</p>
                    </div>
                  </div>

                  <div className="flex gap-2 lg:gap-4 pt-4 lg:pt-8 border-t border-white/5">
                    {!isHistoryView && (
                      <button onClick={() => openRenewModal(c)} className="flex-1 py-3 lg:py-5 bg-emerald-500/10 text-emerald-500 rounded-xl lg:rounded-2xl hover:bg-emerald-500 transition-all flex justify-center items-center gap-1.5 font-black text-[9px] uppercase"><RefreshCw size={16} /> Renovar</button>
                    )}
                    <a 
                      href={`https://wa.me/55${c.phone}?text=${encodeURIComponent(`Olá ${c.name.split(' ')[0]}! Tudo bem? Notei que faz um tempinho que você não passa aqui na barbearia para dar aquele talento. Que tal agendarmos um horário para essa semana? Estaremos te esperando!`)}`} 
                      target="_blank"       if (session) fetchProfile(session.user.id);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
    });
    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase.from('profiles').select('full_name').eq('id', userId).maybeSingle();
    if (data?.full_name) { setUserName(data.full_name); setIsProfileModalOpen(false); }
    else setIsProfileModalOpen(true);
  };

  const updateProfile = async () => {
    if (!userName.trim() || !session) return;
    await supabase.from('profiles').upsert({ id: session.user.id, full_name: userName.trim() });
    setIsProfileModalOpen(false);
  };

  const fetchClients = async () => {
    if (!session) return;
    const { data, error } = await supabase.from('clientes').select('*').order('last_visit', { ascending: false });
    if (!error && data) {
      setAllRecords(data.map(c => ({ 
        ...c, 
        price: Number(c.price) || 0, 
        services: c.services || [], 
        streak_count: Number(c.streak_count) || 1 
      })));
    }
  };

  useEffect(() => { if (session) fetchClients(); }, [session]);

  const saveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    const phone = newPhone.replace(/\D/g, '');
    let prevName = editingClient?.name || null;
    let nextStreak = 1;

    if (editingClient) {
      if (isRenewModalOpen) nextStreak = (Number(editingClient.streak_count) || 1) + 1;
      else nextStreak = Number(editingClient.streak_count) || 1;
    }

    const payload = {
      name: newName, phone, last_visit: newDate,
      user_id: session.user.id, services: selectedServices,
      price: Number(newPrice) || 0, previous_name: prevName,
      streak_count: nextStreak
    };

    const { error } = (isRenewModalOpen) 
      ? await supabase.from('clientes').insert([payload])
      : editingClient ? await supabase.from('clientes').update(payload).eq('id', editingClient.id)
      : await supabase.from('clientes').insert([payload]);

    if (!error) {
      setIsModalOpen(false); setIsRenewModalOpen(false); setEditingClient(null); resetForm();
      fetchClients();
    }
  };

  const executeDelete = async () => {
    if (phonesToDelete.length === 0) return;
    await supabase.from('clientes').delete().in('phone', phonesToDelete);
    setAllRecords(prev => prev.filter(r => !phonesToDelete.includes(r.phone)));
    setIsDeleteModalOpen(false); setIsSelectionMode(false); setSelectedPhones([]); setPhonesToDelete([]);
  };

  const resetForm = () => {
    setNewName(''); setNewPhone(''); setNewPrice(''); setSelectedServices([]);
    setNewDate(format(new Date(), 'yyyy-MM-dd'));
  };

  const openRenewModal = (client: any) => {
    setEditingClient(client); setNewName(client.name); setNewPhone(client.phone);
    setNewPrice(client.price.toString()); setSelectedServices(client.services);
    setNewDate(format(new Date(), 'yyyy-MM-dd')); setIsRenewModalOpen(true);
  };

  const { dashboardList, historyList, rankingList } = useMemo(() => {
    const sorted = [...allRecords].sort((a, b) => parseISO(b.last_visit).getTime() - parseISO(a.last_visit).getTime());
    const latestMap = new Map();
    const history: any[] = [];
    const rankMap = new Map<string, RankClient>();

    sorted.forEach(r => {
      if (!latestMap.has(r.phone)) latestMap.set(r.phone, r);
      else history.push(r);

      const cur = rankMap.get(r.phone) || { name: r.name, phone: r.phone, spent: 0, streak: 0, cabelo: 0, barba: 0, sobrancelha: 0 };
      cur.spent += r.price;
      cur.streak = Math.max(cur.streak, r.streak_count);
      if (r.services.includes('Cabelo')) cur.cabelo++;
      if (r.services.includes('Barba')) cur.barba++;
      if (r.services.includes('Sobrancelha')) cur.sobrancelha++;
      rankMap.set(r.phone, cur);
    });

    const dashboardOrdered = Array.from(latestMap.values()).sort((a, b) => parseISO(a.last_visit).getTime() - parseISO(b.last_visit).getTime());
    
    const rankArray = Array.from(rankMap.values()).sort((a, b) => {
      if (rankingSort === 'streak') return b.streak - a.streak;
      if (rankingSort === 'spent') return b.spent - a.spent;
      return (b as any)[rankingSort] - (a as any)[rankingSort];
    });

    return { dashboardList: dashboardOrdered, historyList: history, rankingList: rankArray };
  }, [allRecords, rankingSort]);

  const revenueChartData = useMemo(() => {
    const today = startOfDay(new Date());
    const daysCount = faturamentoPeriod === 'week' ? 7 : faturamentoPeriod === 'today' ? 1 : 30;
    const interval = eachDayOfInterval({ start: subDays(today, daysCount - 1), end: today });

    const points = interval.map(day => {
      const dailyTotal = allRecords.filter(r => isSameDay(parseISO(r.last_visit), day)).reduce((acc, cur) => acc + cur.price, 0);
      return { date: day, total: dailyTotal };
    });

    const maxVal = Math.max(...points.map(p => p.total), 1);
    const totalRevenue = points.reduce((acc, p) => acc + p.total, 0);
    return { points, maxVal, totalRevenue };
  }, [allRecords, faturamentoPeriod]);

  const stats = useMemo(() => {
    const today = startOfDay(new Date());
    const needsRecovery = dashboardList.filter(c => differenceInDays(today, parseISO(c.last_visit)) >= 20).length;
    const filteredDashboard = dashboardList.filter(c => {
      const days = differenceInDays(today, parseISO(c.last_visit));
      if (delayFilter === '20days') return days >= 20;
      if (delayFilter === '30days') return days >= 30;
      return true;
    });
    return { list: filteredDashboard, needsRecovery, fidelity: dashboardList.length > 0 ? Math.round(((dashboardList.length - needsRecovery) / dashboardList.length) * 100) : 0 };
  }, [dashboardList, delayFilter]);

  const getStreakColor = (count: number) => {
    if (count < 10) return 'text-white';
    if (count < 20) return 'text-yellow-400 drop-shadow-[0_0_5px_yellow]';
    if (count < 30) return 'text-[#00ff41] drop-shadow-[0_0_8px_#00ff41]';
    if (count < 40) return 'text-[#00f3ff] drop-shadow-[0_0_8px_#00f3ff]';
    if (count < 50) return 'text-[#ff00ff] drop-shadow-[0_0_8px_#ff00ff]';
    return 'animate-text-rainbow font-black';
  };

  if (authLoading) return <div className="min-h-screen bg-[#050505] flex items-center justify-center text-amber-500 font-black italic animate-pulse text-2xl">BARBER PRO</div>;

  if (!session) return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6">
      <form onSubmit={async (e) => { e.preventDefault(); const {error} = await supabase.auth.signInWithPassword({email, password}); if(error) setLoginError('Login inválido'); }} className="bg-zinc-900/40 p-10 rounded-[3rem] border border-white/5 space-y-6 w-full max-w-sm shadow-2xl backdrop-blur-xl">
        <h1 className="text-4xl font-black text-white italic tracking-tighter text-center uppercase">BARBER <span className="text-amber-500">PRO</span></h1>
        {loginError && <p className="text-red-500 text-[10px] text-center font-black uppercase">{loginError}</p>}
        <input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="E-mail" className="w-full bg-black/40 border border-white/10 rounded-2xl p-5 outline-none focus:border-amber-500 text-white" />
        <input required type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Senha" className="w-full bg-black/40 border border-white/10 rounded-2xl p-5 outline-none focus:border-amber-500 text-white" />
        <button className="w-full bg-amber-500 text-black py-5 rounded-2xl font-black uppercase shadow-xl active:scale-95 transition-all">Entrar</button>
      </form>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-amber-500/30 overflow-x-hidden">
      <style>{`
        @keyframes text-rainbow { 0% { color: #ff0000; } 25% { color: #00ff00; } 50% { color: #0000ff; } 75% { color: #ff00ff; } 100% { color: #ff0000; } }
        .animate-text-rainbow { animation: text-rainbow 2s linear infinite; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .glass-card { background: rgba(24, 24, 27, 0.4); backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.05); transition: all 0.3s ease; }
      `}</style>

      <header className="sticky top-0 z-40 px-4 lg:px-20 h-16 lg:h-24 flex items-center justify-between bg-[#050505]/80 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center gap-3">
          <button onClick={() => setIsProfileModalOpen(true)} className="w-9 h-9 lg:w-12 lg:h-12 glass-card rounded-xl flex items-center justify-center text-zinc-400 hover:text-amber-500"><UserIcon size={18} /></button>
          <div className="text-base lg:text-2xl font-black italic tracking-tighter truncate max-w-[150px]">Olá, {userName.split(' ')[0]}!</div>
        </div>
        <div className="flex items-center gap-1.5 lg:gap-4">
          <button onClick={() => setIsRankingOpen(true)} className="p-2 lg:p-4 glass-card text-amber-500 rounded-xl"><Trophy size={18} /></button>
          <button onClick={() => setIsFaturamentoOpen(true)} className="p-2 lg:p-4 glass-card text-emerald-500 rounded-xl"><BarChart3 size={18} /></button>
          <button onClick={() => setIsHistoryView(!isHistoryView)} className={cn("p-2 lg:p-4 rounded-xl border border-white/5 transition-all", isHistoryView ? "bg-amber-500 text-black shadow-amber-500/20" : "glass-card text-zinc-500")}><FolderClock size={18} /></button>
          <button onClick={() => { resetForm(); setIsModalOpen(true); }} className="bg-amber-500 text-black px-3 lg:px-8 py-2 lg:py-4 rounded-xl font-black text-[10px] lg:text-xs hover:scale-105 active:scale-95 transition-all shadow-lg flex items-center gap-1.5 uppercase tracking-widest"><UserPlus size={16} /> <span className="hidden lg:inline">CADASTRAR</span></button>
          <button onClick={() => setIsLogoutModalOpen(true)} className="p-2 text-zinc-700 hover:text-red-500 transition-colors"><LogOut size={18} /></button>
        </div>
      </header>

      <main className="p-4 lg:p-24 max-w-[1800px] mx-auto space-y-8 lg:space-y-12 pb-40">
        {!isHistoryView && (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-8 animate-in fade-in slide-in-from-top-4 duration-700">
            <div className="col-span-2 lg:col-span-1 bg-gradient-to-br from-zinc-900 to-black border border-white/10 p-5 lg:p-10 rounded-[2rem] lg:rounded-[3rem] relative overflow-hidden shadow-2xl">
              <TrendingUp className="absolute top-0 right-0 p-4 opacity-5" size={80} />
              <p className="text-[9px] lg:text-[11px] font-black text-zinc-500 uppercase tracking-widest mb-1">Fidelidade</p>
              <p className="text-4xl lg:text-9xl font-black text-amber-500 tracking-tighter">{stats.fidelity}%</p>
            </div>
            <div className="glass-card p-5 lg:p-10 rounded-[1.5rem] flex flex-col justify-center">
              <p className="text-[9px] lg:text-[11px] text-red-500 font-black uppercase tracking-widest mb-1">Recuperar</p>
              <p className="text-3xl lg:text-7xl font-black text-red-500 tracking-tighter">{stats.needsRecovery}</p>
            </div>
            <div className="glass-card p-5 lg:p-10 rounded-[1.5rem] flex flex-col justify-center">
              <p className="text-[9px] lg:text-[11px] text-zinc-500 font-black uppercase tracking-widest mb-1">Clientes</p>
              <p className="text-3xl lg:text-7xl font-black text-white tracking-tighter">{dashboardList.length}</p>
            </div>
          </div>
        )}

        {/* BUSCA E FILTRO */}
        <div className="flex flex-col lg:flex-row gap-4 lg:gap-8 items-center">
          <div className="relative flex-1 group w-full">
            <Search className="absolute left-4 lg:left-8 top-1/2 -translate-y-1/2 w-4 lg:w-6 text-zinc-600 group-focus-within:text-amber-500 transition-all" />
            <input type="text" placeholder="Localizar cliente..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-zinc-900/30 border border-white/10 rounded-2xl lg:rounded-3xl pl-12 lg:pl-20 pr-6 py-3 lg:py-6 outline-none focus:border-amber-500/40 text-sm lg:text-xl font-medium text-white" />
          </div>
          <div className="relative w-full lg:w-auto min-w-[300px]">
            <select value={delayFilter} onChange={(e) => setDelayFilter(e.target.value)} className="appearance-none bg-zinc-900/50 border border-white/10 rounded-2xl px-6 py-3 lg:py-6 pr-12 text-[10px] lg:text-[12px] font-black uppercase tracking-widest outline-none focus:border-amber-500/50 w-full cursor-pointer text-white">
              <option value="all">Ver Todos</option>
              <option value="20days">Ausentes +20 dias</option>
              <option value="30days">Ausentes +30 dias</option>
            </select>
            <ChevronDown size={16} className="absolute right-6 top-1/2 -translate-y-1/2 text-zinc-500" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-8">
          {(isHistoryView ? historyList : stats.list)
            .filter(c => (c.name || '').toLowerCase().includes(searchTerm.toLowerCase()))
            .map(c => {
              const days = differenceInDays(startOfDay(new Date()), parseISO(c.last_visit));
              const isSel = selectedPhones.includes(c.phone);
              const isAlert = days >= 20;

              return (
                <div key={c.id} className={cn("glass-card rounded-[1.5rem] lg:rounded-[3rem] p-4 lg:p-8 flex flex-col justify-between transition-all", isSel ? "border-amber-500 bg-amber-500/5" : "")}>
                  <div className="flex items-start justify-between mb-4 lg:mb-8">
                    <div className="flex items-center gap-3 lg:gap-6">
                      {isSelectionMode ? (
                        <button onClick={() => setSelectedPhones(p => isSel ? p.filter(x => x !== c.phone) : [...p, c.phone])}>
                          {isSel ? <div className="w-8 h-8 bg-amber-500 rounded-xl flex items-center justify-center text-black shadow-lg"><CheckSquare size={18} /></div> : <div className="w-8 h-8 border-2 border-zinc-800 rounded-lg" />}
                        </button>
                      ) : (
                        <div className="relative">
                          <div className="w-12 h-12 lg:w-20 lg:h-20 bg-gradient-to-br from-zinc-800 to-zinc-900 border border-white/10 rounded-xl flex items-center justify-center text-amber-500 font-black text-lg lg:text-3xl">{c.name?.[0]?.toUpperCase()}</div>
                          {Number(c.streak_count) >= 2 && !isHistoryView && (
                            <div className={cn("absolute -top-2 -right-2 flex items-center gap-1 bg-black/90 px-2 py-1 rounded-full border border-white/20 text-[9px] lg:text-xs font-black shadow-2xl", getStreakColor(Number(c.streak_count)))}>
                              <Flame size={12} className="fill-current" /> {c.streak_count}
                            </div>
                          )}
                        </div>
                      )}
                      <div className="max-w-[150px] lg:max-w-none">
                        <p className="font-black text-sm lg:text-2xl text-white/95 leading-none truncate">{c.name}</p>
                        {c.previous_name && c.previous_name !== c.name && (
                          <span className="text-[8px] lg:text-[10px] text-zinc-500 block italic font-bold mt-1 tracking-widest uppercase">Ant. {c.previous_name}</span>
                        )}
                        <p className="text-[10px] lg:text-[12px] text-zinc-500 font-black uppercase mt-1.5 lg:mt-3">R$ {c.price} • {c.services?.join(' + ')}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={cn("text-xl lg:text-4xl font-black tracking-tighter leading-none", isAlert ? "text-red-500" : "text-amber-500")}>{days}d</p>
                      <p className="text-[8px] lg:text-[10px] text-zinc-700 font-black uppercase mt-1">Atraso</p>
                    </div>
                  </div>

                  <div className="flex gap-2 lg:gap-4 pt-4 lg:pt-8 border-t border-white/5">
                    {!isHistoryView && (
                      <button onClick={() => openRenewModal(c)} className="flex-1 py-3 lg:py-5 bg-emerald-500/10 text-emerald-500 rounded-xl lg:rounded-2xl hover:bg-emerald-500 transition-all flex justify-center items-center gap-1.5 font-black text-[9px] uppercase"><RefreshCw size={16} /> Renovar</button>
                    )}
                    <a 
                      href={`https://wa.me/55${c.phone}?text=${encodeURIComponent(`Olá ${c.name.split(' ')[0]}! Tudo bem? Notei que faz um tempinho que você não passa aqui na barbearia para dar aquele talento. Que tal agendarmos um horário para essa semana? Estaremos te esperando!`)}`} 
                      target="_blank" rel="noreferrer"
                      className={cn("flex-1 py-3 lg:py-5 rounded-xl lg:rounded-2xl transition-all flex justify-center items-center gap-1
  const [editingClient, setEditingClient] = useState<any>(null);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [newDate, setNewDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedPhones, setSelectedPhones] = useState<string[]>([]);
  const [phonesToDelete, setPhonesToDelete] = useState<string[]>([]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
    });
    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase.from('profiles').select('full_name').eq('id', userId).maybeSingle();
    if (data?.full_name) { setUserName(data.full_name); setIsProfileModalOpen(false); }
    else setIsProfileModalOpen(true);
  };

  const updateProfile = async () => {
    if (!userName.trim() || !session) return;
    await supabase.from('profiles').upsert({ id: session.user.id, full_name: userName.trim() });
    setIsProfileModalOpen(false);
  };

  const fetchClients = async () => {
    if (!session) return;
    const { data, error } = await supabase.from('clientes').select('*').order('last_visit', { ascending: false });
    if (!error && data) {
      setAllRecords(data.map(c => ({ 
        ...c, 
        price: Number(c.price) || 0, 
        services: c.services || [], 
        streak_count: c.streak_count || 1 
      })));
    }
  };

  useEffect(() => { if (session) fetchClients(); }, [session]);

  const saveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    const phone = newPhone.replace(/\D/g, '');
    let prevName = editingClient?.previous_name || null;
    let nextStreak = 1;

    if (editingClient) {
      if (editingClient.name !== newName) prevName = editingClient.name;
      if (isRenewModalOpen) nextStreak = (editingClient.streak_count || 1) + 1;
      else nextStreak = editingClient.streak_count;
    }

    const payload = {
      name: newName, phone, last_visit: newDate,
      user_id: session.user.id, services: selectedServices,
      price: Number(newPrice) || 0, previous_name: prevName,
      streak_count: nextStreak
    };

    const { error } = (isRenewModalOpen) 
      ? await supabase.from('clientes').insert([payload])
      : editingClient ? await supabase.from('clientes').update(payload).eq('id', editingClient.id)
      : await supabase.from('clientes').insert([payload]);

    if (!error) {
      setIsModalOpen(false); setIsRenewModalOpen(false); setEditingClient(null); resetForm();
      fetchClients();
    }
  };

  const executeDelete = async () => {
    if (phonesToDelete.length === 0) return;
    await supabase.from('clientes').delete().in('phone', phonesToDelete);
    setAllRecords(prev => prev.filter(r => !phonesToDelete.includes(r.phone)));
    setIsDeleteModalOpen(false); setIsSelectionMode(false); setSelectedPhones([]); setPhonesToDelete([]);
    fetchClients();
  };

  const resetForm = () => {
    setNewName(''); setNewPhone(''); setNewPrice(''); setSelectedServices([]);
    setNewDate(format(new Date(), 'yyyy-MM-dd'));
  };

  const openRenewModal = (client: any) => {
    setEditingClient(client); setNewName(client.name); setNewPhone(client.phone);
    setNewPrice(client.price.toString()); setSelectedServices(client.services);
    setNewDate(format(new Date(), 'yyyy-MM-dd')); setIsRenewModalOpen(true);
  };

  const { dashboardList, historyList, rankingList } = useMemo(() => {
    const sorted = [...allRecords].sort((a, b) => parseISO(b.last_visit).getTime() - parseISO(a.last_visit).getTime());
    const latestMap = new Map();
    const history: any[] = [];
    const rankMap = new Map();

    sorted.forEach(r => {
      if (!latestMap.has(r.phone)) latestMap.set(r.phone, r);
      else history.push(r);
      const cur = rankMap.get(r.phone) || { name: r.name, phone: r.phone, spent: 0, streak: 0, cabelo: 0, barba: 0, sobrancelha: 0 };
      cur.spent += r.price; cur.streak = Math.max(cur.streak, r.streak_count);
      if (r.services.includes('Cabelo')) cur.cabelo++;
      if (r.services.includes('Barba')) cur.barba++;
      if (r.services.includes('Sobrancelha')) cur.sobrancelha++;
      rankMap.set(r.phone, cur);
    });

    const dashboardOrdered = Array.from(latestMap.values()).sort((a, b) => parseISO(a.last_visit).getTime() - parseISO(b.last_visit).getTime());
    const rankArray = Array.from(rankMap.values()).sort((a: any, b: any) => {
      if (rankingSort === 'streak') return b.streak - a.streak;
      if (rankingSort === 'spent') return b.spent - a.spent;
      return b[rankingSort] - a[rankingSort];
    });
    return { dashboardList: dashboardOrdered, historyList: history, rankingList: rankArray };
  }, [allRecords, rankingSort]);

  const revenueChartData = useMemo(() => {
    const today = startOfDay(new Date());
    const daysCount = faturamentoPeriod === 'week' ? 7 : faturamentoPeriod === 'today' ? 1 : 30;
    const interval = eachDayOfInterval({ start: subDays(today, daysCount - 1), end: today });
    const points = interval.map(day => {
      const dailyTotal = allRecords.filter(r => isSameDay(parseISO(r.last_visit), day)).reduce((acc, cur) => acc + cur.price, 0);
      return { date: day, total: dailyTotal };
    });
    const maxVal = Math.max(...points.map(p => p.total), 1); // Garante que maxVal nunca seja 0
    const totalRevenue = points.reduce((acc, p) => acc + p.total, 0);
    return { points, maxVal, totalRevenue };
  }, [allRecords, faturamentoPeriod]);

  const stats = useMemo(() => {
    const today = startOfDay(new Date());
    const needsRecovery = dashboardList.filter(c => differenceInDays(today, parseISO(c.last_visit)) >= 20).length;
    const filteredDashboard = dashboardList.filter(c => {
      const days = differenceInDays(today, parseISO(c.last_visit));
      if (delayFilter === '20days') return days >= 20;
      if (delayFilter === '30days') return days >= 30;
      return true;
    });
    return { list: filteredDashboard, needsRecovery, fidelity: dashboardList.length > 0 ? Math.round(((dashboardList.length - needsRecovery) / dashboardList.length) * 100) : 0 };
  }, [dashboardList, delayFilter]);

  const getStreakColor = (count: number) => {
    if (count < 10) return 'text-white';
    if (count < 20) return 'text-yellow-400 drop-shadow-[0_0_5px_yellow]';
    if (count < 30) return 'text-[#00ff41] drop-shadow-[0_0_8px_#00ff41]';
    if (count < 40) return 'text-[#00f3ff] drop-shadow-[0_0_8px_#00f3ff]';
    if (count < 50) return 'text-[#ff00ff] drop-shadow-[0_0_8px_#ff00ff]';
    return 'animate-text-rainbow font-black';
  };

  if (authLoading) return <div className="min-h-screen bg-[#050505] flex items-center justify-center text-amber-500 font-black italic animate-pulse text-2xl">BARBER PRO</div>;

  if (!session) return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6">
      <form onSubmit={async (e) => { e.preventDefault(); const {error} = await supabase.auth.signInWithPassword({email, password}); if(error) setLoginError('Login inválido'); }} className="bg-zinc-900/40 p-10 rounded-[3rem] border border-white/5 space-y-6 w-full max-w-sm shadow-2xl backdrop-blur-xl">
        <h1 className="text-4xl font-black text-white italic tracking-tighter text-center uppercase">BARBER <span className="text-amber-500">PRO</span></h1>
        {loginError && <p className="text-red-500 text-[10px] text-center font-black uppercase tracking-widest">{loginError}</p>}
        <input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="E-mail" className="w-full bg-black/40 border border-white/10 rounded-2xl p-5 outline-none focus:border-amber-500 text-white" />
        <input required type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Senha" className="w-full bg-black/40 border border-white/10 rounded-2xl p-5 outline-none focus:border-amber-500 text-white" />
        <button className="w-full bg-amber-500 text-black py-5 rounded-2xl font-black uppercase shadow-xl active:scale-95 transition-all">Entrar</button>
      </form>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-amber-500/30 overflow-x-hidden">
      <style>{`
        @keyframes text-rainbow { 0% { color: #ff0000; } 25% { color: #00ff00; } 50% { color: #0000ff; } 75% { color: #ff00ff; } 100% { color: #ff0000; } }
        .animate-text-rainbow { animation: text-rainbow 2s linear infinite; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .glass-card { background: rgba(24, 24, 27, 0.4); backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.05); transition: all 0.3s ease; }
        .glass-card:hover { background: rgba(24, 24, 27, 0.6); border-color: rgba(255, 255, 255, 0.1); }
      `}</style>

      <header className="sticky top-0 z-40 px-4 lg:px-20 h-16 lg:h-24 flex items-center justify-between bg-[#050505]/80 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center gap-3">
          <button onClick={() => setIsProfileModalOpen(true)} className="w-9 h-9 lg:w-12 lg:h-12 glass-card rounded-xl flex items-center justify-center text-zinc-400 hover:text-amber-500 transition-all"><UserIcon size={18} /></button>
          <div className="text-base lg:text-2xl font-black italic tracking-tighter">Olá, {userName.split(' ')[0]}!</div>
        </div>
        <div className="flex items-center gap-1.5 lg:gap-4">
          <button onClick={() => setIsRankingOpen(true)} className="p-2 lg:p-4 glass-card text-amber-500 rounded-xl"><Trophy size={18} /></button>
          <button onClick={() => setIsFaturamentoOpen(true)} className="p-2 lg:p-4 glass-card text-emerald-500 rounded-xl"><BarChart3 size={18} /></button>
          <button onClick={() => setIsHistoryView(!isHistoryView)} className={cn("p-2 lg:p-4 rounded-xl border border-white/5 transition-all", isHistoryView ? "bg-amber-500 text-black shadow-amber-500/20" : "glass-card text-zinc-500")}><FolderClock size={18} /></button>
          <button onClick={() => { resetForm(); setIsModalOpen(true); }} className="bg-amber-500 text-black px-3 lg:px-8 py-2 lg:py-4 rounded-xl lg:rounded-2xl font-black text-[10px] lg:text-xs hover:scale-105 active:scale-95 transition-all shadow-lg flex items-center gap-1.5 uppercase tracking-widest"><UserPlus size={16} /> <span className="hidden lg:inline">CADASTRAR</span></button>
          <button onClick={() => setIsLogoutModalOpen(true)} className="p-2 text-zinc-700 hover:text-red-500 transition-colors"><LogOut size={18} /></button>
        </div>
      </header>

      <main className="p-4 lg:p-24 max-w-[1800px] mx-auto space-y-8 lg:space-y-12 pb-40">
        {!isHistoryView && (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-8 animate-in fade-in slide-in-from-top-4 duration-700">
            <div className="col-span-2 lg:col-span-1 bg-gradient-to-br from-zinc-900 to-black border border-white/10 p-5 lg:p-10 rounded-[2rem] lg:rounded-[3rem] relative overflow-hidden shadow-2xl">
              <TrendingUp className="absolute top-0 right-0 p-4 opacity-5" size={80} />
              <p className="text-[9px] lg:text-[11px] font-black text-zinc-500 uppercase tracking-widest mb-1 lg:mb-3">Fidelidade</p>
              <p className="text-4xl lg:text-9xl font-black text-amber-500 tracking-tighter">{stats.fidelity}%</p>
            </div>
            <div className="glass-card p-5 lg:p-10 rounded-[1.5rem] lg:rounded-[2.5rem] flex flex-col justify-center">
              <p className="text-[9px] lg:text-[11px] text-red-500 font-black uppercase tracking-widest mb-1">Recuperar</p>
              <p className="text-3xl lg:text-7xl font-black text-red-500 tracking-tighter">{stats.needsRecovery}</p>
            </div>
            <div className="glass-card p-5 lg:p-10 rounded-[1.5rem] lg:rounded-[2.5rem] flex flex-col justify-center">
              <p className="text-[9px] lg:text-[11px] text-zinc-500 font-black uppercase tracking-widest mb-1">Clientes</p>
              <p className="text-3xl lg:text-7xl font-black text-white tracking-tighter">{dashboardList.length}</p>
            </div>
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-4 lg:gap-8 items-center">
          <div className="relative flex-1 group w-full">
            <Search className="absolute left-4 lg:left-8 top-1/2 -translate-y-1/2 w-4 lg:w-6 h-4 lg:h-6 text-zinc-600 group-focus-within:text-amber-500 transition-all" />
            <input type="text" placeholder="Localizar cliente..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-zinc-900/30 border border-white/10 rounded-2xl lg:rounded-3xl pl-12 lg:pl-20 pr-6 lg:pr-10 py-3 lg:py-6 outline-none focus:border-amber-500/40 text-sm lg:text-xl font-medium text-white shadow-inner" />
          </div>
          <div className="relative w-full lg:w-auto min-w-[300px]">
            <select value={delayFilter} onChange={(e) => setDelayFilter(e.target.value)} className="appearance-none bg-zinc-900/50 border border-white/10 rounded-2xl px-6 lg:px-10 py-3 lg:py-6 pr-12 text-[10px] lg:text-[12px] font-black uppercase tracking-widest outline-none focus:border-amber-500/50 w-full cursor-pointer text-white">
              <option value="all">Ver Todos</option>
              <option value="20days">Ausentes +20 dias</option>
              <option value="30days">Ausentes +30 dias</option>
            </select>
            <ChevronDown size={16} className="absolute right-6 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-8">
          {(isHistoryView ? historyList : stats.list)
            .filter(c => (c.name || '').toLowerCase().includes(searchTerm.toLowerCase()))
            .map(c => {
              const days = differenceInDays(startOfDay(new Date()), parseISO(c.last_visit));
              const isSel = selectedPhones.includes(c.phone);
              const isAlert = days >= 20;

              return (
                <div key={c.id} className={cn("glass-card rounded-[1.5rem] lg:rounded-[3rem] p-4 lg:p-8 flex flex-col justify-between transition-all", isSel ? "border-amber-500 bg-amber-500/5" : "")}>
                  <div className="flex items-start justify-between mb-4 lg:mb-8">
                    <div className="flex items-center gap-3 lg:gap-6">
                      {isSelectionMode ? (
                        <button onClick={() => setSelectedPhones(p => isSel ? p.filter(x => x !== c.phone) : [...p, c.phone])}>
                          {isSel ? <div className="w-8 h-8 bg-amber-500 rounded-xl flex items-center justify-center text-black shadow-lg shadow-amber-500/20"><CheckSquare size={18} /></div> : <div className="w-8 h-8 border-2 border-zinc-800 rounded-lg hover:border-amber-500/50" />}
                        </button>
                      ) : (
                        <div className="relative">
                          <div className="w-12 h-12 lg:w-20 lg:h-20 bg-gradient-to-br from-zinc-800 to-zinc-900 border border-white/10 rounded-xl lg:rounded-2xl flex items-center justify-center text-amber-500 font-black text-lg lg:text-3xl shadow-inner">{c.name?.[0]?.toUpperCase()}</div>
                          {c.streak_count >= 2 && !isHistoryView && (
                            <div className={cn("absolute -top-2 -right-2 flex items-center gap-1 bg-black/90 px-2 py-1 rounded-full border border-white/20 text-[9px] lg:text-xs font-black shadow-2xl", getStreakColor(c.streak_count))}>
                              <Flame size={12} className="fill-current" /> {c.streak_count}
                            </div>
                          )}
                        </div>
                      )}
                      <div>
                        <p className="font-black text-sm lg:text-2xl text-white/95 leading-none truncate max-w-[120px] lg:max-w-none">{c.name}</p>
                        {c.previous_name && c.previous_name !== c.name && (
                          <span className="text-[8px] lg:text-[10px] text-zinc-500 block italic font-bold mt-1 tracking-widest uppercase">Anteriormente {c.previous_name}</span>
                        )}
                        <p className="text-[10px] lg:text-[12px] text-zinc-500 font-black uppercase mt-1.5 lg:mt-3">R$ {c.price} • {c.services?.join(' + ')}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={cn("text-xl lg:text-4xl font-black tracking-tighter leading-none", isAlert ? "text-red-500" : "text-amber-500")}>{days}d</p>
                      <p className="text-[8px] lg:text-[10px] text-zinc-700 font-black uppercase mt-1">Atraso</p>
                    </div>
                  </div>

                  <div className="flex gap-2 lg:gap-4 pt-4 lg:pt-8 border-t border-white/5">
                    {!isHistoryView && (
                      <button onClick={() => openRenewModal(c)} className="flex-1 py-3 lg:py-5 bg-emerald-500/10 text-emerald-500 rounded-xl lg:rounded-2xl hover:bg-emerald-500 hover:text-black transition-all flex justify-center items-center gap-1.5 lg:gap-2 font-black text-[9px] lg:text-[11px] uppercase"><RefreshCw size={16} /> Renovar</button>
                    )}
                    <a 
                      href={`https://wa.me/55${c.phone}?text=${encodeURIComponent(`Olá ${c.name.split(' ')[0]}! Tudo bem? Notei que faz um tempinho que você não passa aqui na barbearia para dar aquele talento. Que tal agendarmos um horário para essa semana? Estaremos t
  const [editingClient, setEditingClient] = useState<any>(null);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [newDate, setNewDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedPhones, setSelectedPhones] = useState<string[]>([]);
  const [phonesToDelete, setPhonesToDelete] = useState<string[]>([]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
    });
    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase.from('profiles').select('full_name').eq('id', userId).maybeSingle();
    if (data?.full_name) { setUserName(data.full_name); setIsProfileModalOpen(false); }
    else setIsProfileModalOpen(true);
  };

  const updateProfile = async () => {
    if (!userName.trim() || !session) return;
    await supabase.from('profiles').upsert({ id: session.user.id, full_name: userName.trim() });
    setIsProfileModalOpen(false);
  };

  const fetchClients = async () => {
    if (!session) return;
    const { data, error } = await supabase.from('clientes').select('*').order('last_visit', { ascending: false });
    if (!error) {
      setAllRecords(data.map(c => ({ 
        ...c, 
        price: Number(c.price) || 0, 
        services: c.services || [], 
        streak_count: c.streak_count || 1 
      })));
    }
  };

  useEffect(() => { if (session) fetchClients(); }, [session]);

  const saveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    const phone = newPhone.replace(/\D/g, '');
    let prevName = editingClient?.name || null;
    let nextStreak = 1;

    if (editingClient) {
      if (editingClient.name !== newName) prevName = editingClient.name;
      if (isRenewModalOpen) nextStreak = (editingClient.streak_count || 1) + 1;
      else nextStreak = editingClient.streak_count;
    }

    const payload = {
      name: newName, phone, last_visit: newDate,
      user_id: session.user.id, services: selectedServices,
      price: Number(newPrice) || 0, previous_name: prevName,
      streak_count: nextStreak
    };

    const { error } = (isRenewModalOpen) 
      ? await supabase.from('clientes').insert([payload])
      : editingClient ? await supabase.from('clientes').update(payload).eq('id', editingClient.id)
      : await supabase.from('clientes').insert([payload]);

    if (!error) {
      setIsModalOpen(false); setIsRenewModalOpen(false); setEditingClient(null); resetForm();
      fetchClients();
    }
  };

  const executeDelete = async () => {
    if (phonesToDelete.length === 0) return;
    await supabase.from('clientes').delete().in('phone', phonesToDelete);
    setAllRecords(prev => prev.filter(r => !phonesToDelete.includes(r.phone)));
    setIsDeleteModalOpen(false); setIsSelectionMode(false); setSelectedPhones([]); setPhonesToDelete([]);
    fetchClients();
  };

  const resetForm = () => {
    setNewName(''); setNewPhone(''); setNewPrice(''); setSelectedServices([]);
    setNewDate(format(new Date(), 'yyyy-MM-dd'));
  };

  const openRenewModal = (client: any) => {
    setEditingClient(client); setNewName(client.name); setNewPhone(client.phone);
    setNewPrice(client.price.toString()); setSelectedServices(client.services);
    setNewDate(format(new Date(), 'yyyy-MM-dd')); setIsRenewModalOpen(true);
  };

  const { dashboardList, historyList, rankingList } = useMemo(() => {
    const sorted = [...allRecords].sort((a, b) => parseISO(b.last_visit).getTime() - parseISO(a.last_visit).getTime());
    const latestMap = new Map();
    const history: any[] = [];
    const rankMap = new Map();

    sorted.forEach(r => {
      if (!latestMap.has(r.phone)) latestMap.set(r.phone, r);
      else history.push(r);
      const cur = rankMap.get(r.phone) || { name: r.name, phone: r.phone, spent: 0, streak: 0, cabelo: 0, barba: 0, sobrancelha: 0 };
      cur.spent += r.price; cur.streak = Math.max(cur.streak, r.streak_count);
      if (r.services.includes('Cabelo')) cur.cabelo++;
      if (r.services.includes('Barba')) cur.barba++;
      if (r.services.includes('Sobrancelha')) cur.sobrancelha++;
      rankMap.set(r.phone, cur);
    });

    const dashboardOrdered = Array.from(latestMap.values()).sort((a, b) => parseISO(a.last_visit).getTime() - parseISO(b.last_visit).getTime());
    const rankArray = Array.from(rankMap.values()).sort((a: any, b: any) => {
      if (rankingSort === 'streak') return b.streak - a.streak;
      if (rankingSort === 'spent') return b.spent - a.spent;
      return b[rankingSort] - a[rankingSort];
    });
    return { dashboardList: dashboardOrdered, historyList: history, rankingList: rankArray };
  }, [allRecords, rankingSort]);

  const revenueChartData = useMemo(() => {
    const today = startOfDay(new Date());
    const daysCount = faturamentoPeriod === 'week' ? 7 : faturamentoPeriod === 'today' ? 1 : 30;
    const interval = eachDayOfInterval({ start: subDays(today, daysCount - 1), end: today });
    const points = interval.map(day => {
      const dailyTotal = allRecords.filter(r => isSameDay(parseISO(r.last_visit), day)).reduce((acc, cur) => acc + cur.price, 0);
      return { date: day, total: dailyTotal };
    });
    const maxVal = Math.max(...points.map(p => p.total), 1);
    const totalRevenue = points.reduce((acc, p) => acc + p.total, 0);
    return { points, maxVal, totalRevenue };
  }, [allRecords, faturamentoPeriod]);

  const stats = useMemo(() => {
    const today = startOfDay(new Date());
    const needsRecovery = dashboardList.filter(c => differenceInDays(today, parseISO(c.last_visit)) >= 20).length;
    const filteredDashboard = dashboardList.filter(c => {
      const days = differenceInDays(today, parseISO(c.last_visit));
      if (delayFilter === '20days') return days >= 20;
      if (delayFilter === '30days') return days >= 30;
      return true;
    });
    return { list: filteredDashboard, needsRecovery, fidelity: dashboardList.length > 0 ? Math.round(((dashboardList.length - needsRecovery) / dashboardList.length) * 100) : 0 };
  }, [dashboardList, delayFilter]);

  const getStreakColor = (count: number) => {
    if (count < 10) return 'text-white';
    if (count < 20) return 'text-yellow-400 drop-shadow-[0_0_5px_yellow]';
    if (count < 30) return 'text-[#00ff41] drop-shadow-[0_0_8px_#00ff41]';
    if (count < 40) return 'text-[#00f3ff] drop-shadow-[0_0_8px_#00f3ff]';
    if (count < 50) return 'text-[#ff00ff] drop-shadow-[0_0_8px_#ff00ff]';
    return 'animate-text-rainbow font-black';
  };

  if (authLoading) return <div className="min-h-screen bg-[#050505] flex items-center justify-center text-amber-500 font-black italic animate-pulse text-xl">BARBER PRO</div>;

  if (!session) return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6">
      <form onSubmit={async (e) => { e.preventDefault(); await supabase.auth.signInWithPassword({email, password}); }} className="bg-zinc-900/40 p-8 lg:p-12 rounded-[2.5rem] border border-white/5 space-y-6 w-full max-w-sm shadow-2xl backdrop-blur-xl">
        <h1 className="text-3xl font-black text-white italic tracking-tighter text-center uppercase">BARBER <span className="text-amber-500">PRO</span></h1>
        <input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="E-mail" className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 outline-none focus:border-amber-500 text-white" />
        <input required type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Senha" className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 outline-none focus:border-amber-500 text-white" />
        <button className="w-full bg-amber-500 text-black py-4 rounded-2xl font-black uppercase shadow-xl active:scale-95 transition-all">Entrar</button>
      </form>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-amber-500/30 overflow-x-hidden">
      <style>{`
        @keyframes text-rainbow { 0% { color: #ff0000; } 25% { color: #00ff00; } 50% { color: #0000ff; } 75% { color: #ff00ff; } 100% { color: #ff0000; } }
        .animate-text-rainbow { animation: text-rainbow 2s linear infinite; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .glass-card { background: rgba(24, 24, 27, 0.4); backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.05); transition: all 0.3s ease; }
        .glass-card:hover { background: rgba(24, 24, 27, 0.6); border-color: rgba(255, 255, 255, 0.1); }
      `}</style>

      {/* HEADER COMPACTO */}
      <header className="sticky top-0 z-40 px-4 lg:px-20 h-16 lg:h-24 flex items-center justify-between bg-[#050505]/80 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center gap-3">
          <button onClick={() => setIsProfileModalOpen(true)} className="w-9 h-9 lg:w-12 lg:h-12 glass-card rounded-xl flex items-center justify-center text-zinc-400 hover:text-amber-500"><UserIcon size={18} /></button>
          <div className="text-base lg:text-2xl font-black italic tracking-tighter">Olá, {userName.split(' ')[0]}!</div>
        </div>
        <div className="flex items-center gap-1.5 lg:gap-4">
          <button onClick={() => setIsRankingOpen(true)} className="p-2 lg:p-4 glass-card text-amber-500 rounded-xl"><Trophy size={18} /></button>
          <button onClick={() => setIsFaturamentoOpen(true)} className="p-2 lg:p-4 glass-card text-emerald-500 rounded-xl"><BarChart3 size={18} /></button>
          <button onClick={() => setIsHistoryView(!isHistoryView)} className={cn("p-2 lg:p-4 rounded-xl border border-white/5 transition-all", isHistoryView ? "bg-amber-500 text-black shadow-amber-500/20" : "glass-card text-zinc-500")}><FolderClock size={18} /></button>
          <button onClick={() => { resetForm(); setIsModalOpen(true); }} className="bg-amber-500 text-black px-3 lg:px-8 py-2 lg:py-4 rounded-xl lg:rounded-2xl font-black text-[10px] lg:text-xs hover:scale-105 active:scale-95 transition-all shadow-lg flex items-center gap-1.5 uppercase tracking-widest"><UserPlus size={16} /> <span className="hidden lg:inline">CADASTRAR</span></button>
          <button onClick={() => setIsLogoutModalOpen(true)} className="p-2 text-zinc-700 hover:text-red-500 transition-colors"><LogOut size={18} /></button>
        </div>
      </header>

      <main className="p-4 lg:p-24 max-w-[1800px] mx-auto space-y-8 lg:space-y-12 pb-40">
        {!isHistoryView && (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-8 animate-in fade-in slide-in-from-top-4 duration-700">
            <div className="col-span-2 lg:col-span-1 bg-gradient-to-br from-zinc-900 to-black border border-white/10 p-5 lg:p-10 rounded-[2rem] lg:rounded-[3rem] relative overflow-hidden shadow-2xl">
              <TrendingUp className="absolute top-0 right-0 p-4 opacity-5" size={80} />
              <p className="text-[9px] lg:text-[11px] font-black text-zinc-500 uppercase tracking-widest mb-1 lg:mb-3">Fidelidade</p>
              <p className="text-4xl lg:text-9xl font-black text-amber-500 tracking-tighter">{stats.fidelity}%</p>
            </div>
            <div className="glass-card p-5 lg:p-10 rounded-[1.5rem] lg:rounded-[2.5rem] flex flex-col justify-center">
              <p className="text-[9px] lg:text-[11px] text-red-500 font-black uppercase tracking-widest mb-1">Recuperar</p>
              <p className="text-3xl lg:text-7xl font-black text-red-500 tracking-tighter">{stats.needsRecovery}</p>
            </div>
            <div className="glass-card p-5 lg:p-10 rounded-[1.5rem] lg:rounded-[2.5rem] flex flex-col justify-center">
              <p className="text-[9px] lg:text-[11px] text-zinc-500 font-black uppercase tracking-widest mb-1">Clientes</p>
              <p className="text-3xl lg:text-7xl font-black text-white tracking-tighter">{dashboardList.length}</p>
            </div>
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-4 lg:gap-8 items-center">
          <div className="relative flex-1 group w-full">
            <Search className="absolute left-4 lg:left-8 top-1/2 -translate-y-1/2 w-4 lg:w-6 h-4 lg:h-6 text-zinc-600 group-focus-within:text-amber-500 transition-all" />
            <input type="text" placeholder="Localizar cliente..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-zinc-900/30 border border-white/10 rounded-2xl lg:rounded-3xl pl-12 lg:pl-20 pr-6 lg:pr-10 py-3 lg:py-6 outline-none focus:border-amber-500/40 text-sm lg:text-xl font-medium text-white shadow-inner" />
          </div>
          <div className="relative w-full lg:w-auto min-w-[300px]">
            <select value={delayFilter} onChange={(e) => setDelayFilter(e.target.value)} className="appearance-none bg-zinc-900/50 border border-white/10 rounded-2xl px-6 lg:px-10 py-3 lg:py-6 pr-12 text-[10px] lg:text-[12px] font-black uppercase tracking-widest outline-none focus:border-amber-500/50 w-full cursor-pointer text-white">
              <option value="all">Ver Todos</option>
              <option value="20days">Ausentes +20 dias</option>
              <option value="30days">Ausentes +30 dias</option>
            </select>
            <ChevronDown size={16} className="absolute right-6 top-1/2 -translate-y-1/2 text-zinc-500" />
          </div>
        </div>

        {/* LISTAGEM SLIM MOBILE / GRID PC */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-8">
          {(isHistoryView ? historyList : stats.list)
            .filter(c => (c.name || '').toLowerCase().includes(searchTerm.toLowerCase()))
            .map(c => {
              const days = differenceInDays(startOfDay(new Date()), parseISO(c.last_visit));
              const isSel = selectedPhones.includes(c.phone);
              const isAlert = days >= 20;

              return (
                <div key={c.id} className={cn("glass-card rounded-[1.5rem] lg:rounded-[3rem] p-4 lg:p-8 flex flex-col justify-between transition-all", isSel ? "border-amber-500 bg-amber-500/5" : "")}>
                  <div className="flex items-start justify-between mb-4 lg:mb-8">
                    <div className="flex items-center gap-3 lg:gap-6">
                      {isSelectionMode ? (
                        <button onClick={() => setSelectedPhones(p => isSel ? p.filter(x => x !== c.phone) : [...p, c.phone])}>
                          {isSel ? <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center text-black"><CheckSquare size={18} /></div> : <div className="w-8 h-8 border-2 border-zinc-800 rounded-lg" />}
                        </button>
                      ) : (
                        <div className="relative">
                          <div className="w-12 h-12 lg:w-20 lg:h-20 bg-gradient-to-br from-zinc-800 to-zinc-900 border border-white/10 rounded-xl lg:rounded-2xl flex items-center justify-center text-amber-500 font-black text-lg lg:text-3xl shadow-inner">{c.name?.[0]?.toUpperCase()}</div>
                          {c.streak_count >= 2 && !isHistoryView && (
                            <div className={cn("absolute -top-2 -right-2 flex items-center gap-1 bg-black/90 px-2 py-1 rounded-full border border-white/20 text-[9px] lg:text-xs font-black shadow-2xl", getStreakColor(c.streak_count))}>
                              <Flame size={12} className="fill-current" /> {c.streak_count}
                            </div>
                          )}
                        </div>
                      )}
                      <div>
                        <p className="font-black text-sm lg:text-2xl text-white/95 leading-none">{c.name}</p>
                        {c.previous_name && c.previous_name !== c.name && (
                          <span className="text-[8px] lg:text-[10px] text-zinc-500 block italic font-bold mt-1 tracking-widest uppercase">Anteriormente {c.previous_name}</span>
                        )}
                        <p className="text-[10px] lg:text-[12px] text-zinc-500 font-black uppercase mt-1.5 lg:mt-3">R$ {c.price} • {c.services?.join(' + ')}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={cn("text-xl lg:text-4xl font-black tracking-tighter leading-none", isAlert ? "text-red-500" : "text-amber-500")}>{days}d</p>
                      <p className="text-[8px] lg:text-[10px] text-zinc-700 font-black uppercase mt-1">Atraso</p>
                    </div>
                  </div>

                  <div className="flex gap-2 lg:gap-4 pt-4 lg:pt-8 border-t border-white/5">
                    {!isHistoryView && (
                      <button onClick={() => openRenewModal(c)} className="flex-1 py-3 lg:py-5 bg-emerald-500/10 text-emerald-500 rounded-xl lg:rounded-2xl hover:bg-emerald-500 hover:text-black transition-all flex justify-center items-center gap-1.5 lg:gap-2 font-black text-[9px] lg:text-[11px] uppercase"><RefreshCw size={16} /> Renovar</button>
                    )}
                    <a 
                      href={`https://wa.me/55${c.phone}?text=${encodeURIComponent(`Olá ${c.name.split(' ')[0]}! Tudo bem? Notei que faz um tempinho que você não passa aqui na barbearia para dar aquele talento. Que tal agendarmos um horário para essa semana? Estaremos te esperando!`)}`} 
                      target="_blank" 
                      className={cn("flex-1 py-3 lg:py-5 rounded-xl lg:rounded-2xl transition-all flex justify-center items-center gap-1.5 lg:gap-2 font-black text-[9px] lg:text-[11px] uppercase", isAlert ? "bg-amber-500 text-import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, UserPlus, MessageSquare, Search, Trash2, 
  Scissors, LogOut, Loader2, RefreshCw, CheckSquare, 
  Square, User as UserIcon, TrendingUp, Wallet, 
  ChevronDown, AlertCircle, FolderClock, Flame, Trophy, BarChart3, X, Filter
} from 'lucide-react';
import { format, differenceInDays, parseISO, startOfDay, subDays, eachDayOfInterval, isSameDay } from 'date-fns';
import { supabase } from './lib/supabase';

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [userName, setUserName] = useState('');
  const [loginError, setLoginError] = useState('');

  const [allRecords, setAllRecords] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isRenewModalOpen, setIsRenewModalOpen] = useState(false);
  const [isRankingOpen, setIsRankingOpen] = useState(false);
  const [isFaturamentoOpen, setIsFaturamentoOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isHistoryView, setIsHistoryView] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [delayFilter, setDelayFilter] = useState('all');
  const [rankingSort, setRankingSort] = useState<'streak' | 'spent' | 'cabelo' | 'barba' | 'sobrancelha'>('streak');
  const [faturamentoPeriod, setFaturamentoPeriod] = useState('month');

  const [editingClient, setEditingClient] = useState<any>(null);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [newDate, setNewDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedPhones, setSelectedPhones] = useState<string[]>([]);
  const [phonesToDelete, setPhonesToDelete] = useState<string[]>([]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
    });
    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase.from('profiles').select('full_name').eq('id', userId).maybeSingle();
    if (data?.full_name) { setUserName(data.full_name); setIsProfileModalOpen(false); }
    else setIsProfileModalOpen(true);
  };

  const updateProfile = async () => {
    if (!userName.trim() || !session) return;
    await supabase.from('profiles').upsert({ id: session.user.id, full_name: userName.trim() });
    setIsProfileModalOpen(false);
  };

  const fetchClients = async () => {
    if (!session) return;
    const { data, error } = await supabase.from('clientes').select('*').order('last_visit', { ascending: false });
    if (!error) {
      setAllRecords(data.map(c => ({ 
        ...c, 
        price: Number(c.price) || 0, 
        services: c.services || [], 
        streak_count: c.streak_count || 1 
      })));
    }
  };

  useEffect(() => { if (session) fetchClients(); }, [session]);

  const saveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    const phone = newPhone.replace(/\D/g, '');
    let prevName = editingClient?.name || null;
    let nextStreak = 1;

    if (editingClient) {
      if (editingClient.name !== newName) prevName = editingClient.name;
      if (isRenewModalOpen) nextStreak = (editingClient.streak_count || 1) + 1;
      else nextStreak = editingClient.streak_count;
    }

    const payload = {
      name: newName, phone, last_visit: newDate,
      user_id: session.user.id, services: selectedServices,
      price: Number(newPrice) || 0, previous_name: prevName,
      streak_count: nextStreak
    };

    const { error } = (isRenewModalOpen) 
      ? await supabase.from('clientes').insert([payload])
      : editingClient ? await supabase.from('clientes').update(payload).eq('id', editingClient.id)
      : await supabase.from('clientes').insert([payload]);

    if (!error) {
      setIsModalOpen(false); setIsRenewModalOpen(false); setEditingClient(null); resetForm();
      fetchClients();
    }
  };

  const executeDelete = async () => {
    if (phonesToDelete.length === 0) return;
    await supabase.from('clientes').delete().in('phone', phonesToDelete);
    setAllRecords(prev => prev.filter(r => !phonesToDelete.includes(r.phone)));
    setIsDeleteModalOpen(false); setIsSelectionMode(false); setSelectedPhones([]); setPhonesToDelete([]);
    fetchClients();
  };

  const resetForm = () => {
    setNewName(''); setNewPhone(''); setNewPrice(''); setSelectedServices([]);
    setNewDate(format(new Date(), 'yyyy-MM-dd'));
  };

  const openRenewModal = (client: any) => {
    setEditingClient(client); setNewName(client.name); setNewPhone(client.phone);
    setNewPrice(client.price.toString()); setSelectedServices(client.services);
    setNewDate(format(new Date(), 'yyyy-MM-dd')); setIsRenewModalOpen(true);
  };

  const { dashboardList, historyList, rankingList } = useMemo(() => {
    const sorted = [...allRecords].sort((a, b) => parseISO(b.last_visit).getTime() - parseISO(a.last_visit).getTime());
    const latestMap = new Map();
    const history: any[] = [];
    const rankMap = new Map();

    sorted.forEach(r => {
      if (!latestMap.has(r.phone)) latestMap.set(r.phone, r);
      else history.push(r);
      const cur = rankMap.get(r.phone) || { name: r.name, phone: r.phone, spent: 0, streak: 0, cabelo: 0, barba: 0, sobrancelha: 0 };
      cur.spent += r.price; cur.streak = Math.max(cur.streak, r.streak_count);
      if (r.services.includes('Cabelo')) cur.cabelo++;
      if (r.services.includes('Barba')) cur.barba++;
      if (r.services.includes('Sobrancelha')) cur.sobrancelha++;
      rankMap.set(r.phone, cur);
    });

    const dashboardOrdered = Array.from(latestMap.values()).sort((a, b) => parseISO(a.last_visit).getTime() - parseISO(b.last_visit).getTime());
    const rankArray = Array.from(rankMap.values()).sort((a: any, b: any) => {
      if (rankingSort === 'streak') return b.streak - a.streak;
      if (rankingSort === 'spent') return b.spent - a.spent;
      return b[rankingSort] - a[rankingSort];
    });
    return { dashboardList: dashboardOrdered, historyList: history, rankingList: rankArray };
  }, [allRecords, rankingSort]);

  const revenueChartData = useMemo(() => {
    const today = startOfDay(new Date());
    const daysCount = faturamentoPeriod === 'week' ? 7 : faturamentoPeriod === 'today' ? 1 : 30;
    const interval = eachDayOfInterval({ start: subDays(today, daysCount - 1), end: today });
    const points = interval.map(day => {
      const dailyTotal = allRecords.filter(r => isSameDay(parseISO(r.last_visit), day)).reduce((acc, cur) => acc + cur.price, 0);
      return { date: day, total: dailyTotal };
    });
    const maxVal = Math.max(...points.map(p => p.total), 1);
    const totalRevenue = points.reduce((acc, p) => acc + p.total, 0);
    return { points, maxVal, totalRevenue };
  }, [allRecords, faturamentoPeriod]);

  const stats = useMemo(() => {
    const today = startOfDay(new Date());
    const needsRecovery = dashboardList.filter(c => differenceInDays(today, parseISO(c.last_visit)) >= 20).length;
    const filteredDashboard = dashboardList.filter(c => {
      const days = differenceInDays(today, parseISO(c.last_visit));
      if (delayFilter === '20days') return days >= 20;
      if (delayFilter === '30days') return days >= 30;
      return true;
    });
    return { list: filteredDashboard, needsRecovery, fidelity: dashboardList.length > 0 ? Math.round(((dashboardList.length - needsRecovery) / dashboardList.length) * 100) : 0 };
  }, [dashboardList, delayFilter]);

  const getStreakColor = (count: number) => {
    if (count < 10) return 'text-white';
    if (count < 20) return 'text-yellow-400 drop-shadow-[0_0_5px_yellow]';
    if (count < 30) return 'text-[#00ff41] drop-shadow-[0_0_8px_#00ff41]';
    if (count < 40) return 'text-[#00f3ff] drop-shadow-[0_0_8px_#00f3ff]';
    if (count < 50) return 'text-[#ff00ff] drop-shadow-[0_0_8px_#ff00ff]';
    return 'animate-text-rainbow font-black';
  };

  if (authLoading) return <div className="min-h-screen bg-[#050505] flex items-center justify-center text-amber-500 font-black italic animate-pulse text-xl">BARBER PRO</div>;

  if (!session) return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6">
      <form onSubmit={async (e) => { e.preventDefault(); await supabase.auth.signInWithPassword({email, password}); }} className="bg-zinc-900/40 p-8 lg:p-12 rounded-[2.5rem] border border-white/5 space-y-6 w-full max-w-sm shadow-2xl backdrop-blur-xl">
        <h1 className="text-3xl font-black text-white italic tracking-tighter text-center uppercase">BARBER <span className="text-amber-500">PRO</span></h1>
        <input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="E-mail" className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 outline-none focus:border-amber-500 text-white" />
        <input required type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Senha" className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 outline-none focus:border-amber-500 text-white" />
        <button className="w-full bg-amber-500 text-black py-4 rounded-2xl font-black uppercase shadow-xl active:scale-95 transition-all">Entrar</button>
      </form>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-amber-500/30 overflow-x-hidden">
      <style>{`
        @keyframes text-rainbow { 0% { color: #ff0000; } 25% { color: #00ff00; } 50% { color: #0000ff; } 75% { color: #ff00ff; } 100% { color: #ff0000; } }
        .animate-text-rainbow { animation: text-rainbow 2s linear infinite; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .glass-card { background: rgba(24, 24, 27, 0.4); backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.05); transition: all 0.3s ease; }
        .glass-card:hover { background: rgba(24, 24, 27, 0.6); border-color: rgba(255, 255, 255, 0.1); }
      `}</style>

      {/* HEADER COMPACTO */}
      <header className="sticky top-0 z-40 px-4 lg:px-20 h-16 lg:h-24 flex items-center justify-between bg-[#050505]/80 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center gap-3">
          <button onClick={() => setIsProfileModalOpen(true)} className="w-9 h-9 lg:w-12 lg:h-12 glass-card rounded-xl flex items-center justify-center text-zinc-400 hover:text-amber-500"><UserIcon size={18} /></button>
          <div className="text-base lg:text-2xl font-black italic tracking-tighter">Olá, {userName.split(' ')[0]}!</div>
        </div>
        <div className="flex items-center gap-1.5 lg:gap-4">
          <button onClick={() => setIsRankingOpen(true)} className="p-2 lg:p-4 glass-card text-amber-500 rounded-xl"><Trophy size={18} /></button>
          <button onClick={() => setIsFaturamentoOpen(true)} className="p-2 lg:p-4 glass-card text-emerald-500 rounded-xl"><BarChart3 size={18} /></button>
          <button onClick={() => setIsHistoryView(!isHistoryView)} className={cn("p-2 lg:p-4 rounded-xl border border-white/5 transition-all", isHistoryView ? "bg-amber-500 text-black shadow-amber-500/20" : "glass-card text-zinc-500")}><FolderClock size={18} /></button>
          <button onClick={() => { resetForm(); setIsModalOpen(true); }} className="bg-amber-500 text-black px-3 lg:px-8 py-2 lg:py-4 rounded-xl lg:rounded-2xl font-black text-[10px] lg:text-xs hover:scale-105 active:scale-95 transition-all shadow-lg flex items-center gap-1.5 uppercase tracking-widest"><UserPlus size={16} /> <span className="hidden lg:inline">CADASTRAR</span></button>
          <button onClick={() => setIsLogoutModalOpen(true)} className="p-2 text-zinc-700 hover:text-red-500 transition-colors"><LogOut size={18} /></button>
        </div>
      </header>

      <main className="p-4 lg:p-24 max-w-[1800px] mx-auto space-y-8 lg:space-y-12 pb-40">
        {!isHistoryView && (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-8 animate-in fade-in slide-in-from-top-4 duration-700">
            <div className="col-span-2 lg:col-span-1 bg-gradient-to-br from-zinc-900 to-black border border-white/10 p-5 lg:p-10 rounded-[2rem] lg:rounded-[3rem] relative overflow-hidden shadow-2xl">
              <TrendingUp className="absolute top-0 right-0 p-4 opacity-5" size={80} />
              <p className="text-[9px] lg:text-[11px] font-black text-zinc-500 uppercase tracking-widest mb-1 lg:mb-3">Fidelidade</p>
              <p className="text-4xl lg:text-9xl font-black text-amber-500 tracking-tighter">{stats.fidelity}%</p>
            </div>
            <div className="glass-card p-5 lg:p-10 rounded-[1.5rem] lg:rounded-[2.5rem] flex flex-col justify-center">
              <p className="text-[9px] lg:text-[11px] text-red-500 font-black uppercase tracking-widest mb-1">Recuperar</p>
              <p className="text-3xl lg:text-7xl font-black text-red-500 tracking-tighter">{stats.needsRecovery}</p>
            </div>
            <div className="glass-card p-5 lg:p-10 rounded-[1.5rem] lg:rounded-[2.5rem] flex flex-col justify-center">
              <p className="text-[9px] lg:text-[11px] text-zinc-500 font-black uppercase tracking-widest mb-1">Clientes</p>
              <p className="text-3xl lg:text-7xl font-black text-white tracking-tighter">{dashboardList.length}</p>
            </div>
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-4 lg:gap-8 items-center">
          <div className="relative flex-1 group w-full">
            <Search className="absolute left-4 lg:left-8 top-1/2 -translate-y-1/2 w-4 lg:w-6 h-4 lg:h-6 text-zinc-600 group-focus-within:text-amber-500 transition-all" />
            <input type="text" placeholder="Localizar cliente..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-zinc-900/30 border border-white/10 rounded-2xl lg:rounded-3xl pl-12 lg:pl-20 pr-6 lg:pr-10 py-3 lg:py-6 outline-none focus:border-amber-500/40 text-sm lg:text-xl font-medium text-white shadow-inner" />
          </div>
          <div className="relative w-full lg:w-auto min-w-[300px]">
            <select value={delayFilter} onChange={(e) => setDelayFilter(e.target.value)} className="appearance-none bg-zinc-900/50 border border-white/10 rounded-2xl px-6 lg:px-10 py-3 lg:py-6 pr-12 text-[10px] lg:text-[12px] font-black uppercase tracking-widest outline-none focus:border-amber-500/50 w-full cursor-pointer text-white">
              <option value="all">Ver Todos</option>
              <option value="20days">Ausentes +20 dias</option>
              <option value="30days">Ausentes +30 dias</option>
            </select>
            <ChevronDown size={16} className="absolute right-6 top-1/2 -translate-y-1/2 text-zinc-500" />
          </div>
        </div>

        {/* LISTAGEM SLIM MOBILE / GRID PC */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-8">
          {(isHistoryView ? historyList : stats.list)
            .filter(c => (c.name || '').toLowerCase().includes(searchTerm.toLowerCase()))
            .map(c => {
              const days = differenceInDays(startOfDay(new Date()), parseISO(c.last_visit));
              const isSel = selectedPhones.includes(c.phone);
              const isAlert = days >= 20;

              return (
                <div key={c.id} className={cn("glass-card rounded-[1.5rem] lg:rounded-[3rem] p-4 lg:p-8 flex flex-col justify-between transition-all", isSel ? "border-amber-500 bg-amber-500/5" : "")}>
                  <div className="flex items-start justify-between mb-4 lg:mb-8">
                    <div className="flex items-center gap-3 lg:gap-6">
                      {isSelectionMode ? (
                        <button onClick={() => setSelectedPhones(p => isSel ? p.filter(x => x !== c.phone) : [...p, c.phone])}>
                          {isSel ? <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center text-black"><CheckSquare size={18} /></div> : <div className="w-8 h-8 border-2 border-zinc-800 rounded-lg" />}
                        </button>
                      ) : (
                        <div className="relative">
                          <div className="w-12 h-12 lg:w-20 lg:h-20 bg-gradient-to-br from-zinc-800 to-zinc-900 border border-white/10 rounded-xl lg:rounded-2xl flex items-center justify-center text-amber-500 font-black text-lg lg:text-3xl shadow-inner">{c.name?.[0]?.toUpperCase()}</div>
                          {c.streak_count >= 2 && !isHistoryView && (
                            <div className={cn("absolute -top-2 -right-2 flex items-center gap-1 bg-black/90 px-2 py-1 rounded-full border border-white/20 text-[9px] lg:text-xs font-black shadow-2xl", getStreakColor(c.streak_count))}>
                              <Flame size={12} className="fill-current" /> {c.streak_count}
                            </div>
                          )}
                        </div>
                      )}
                      <div>
                        <p className="font-black text-sm lg:text-2xl text-white/95 leading-none">{c.name}</p>
                        {c.previous_name && c.previous_name !== c.name && (
                          <span className="text-[8px] lg:text-[10px] text-zinc-500 block italic font-bold mt-1 tracking-widest uppercase">Anteriormente {c.previous_name}</span>
                        )}
                        <p className="text-[10px] lg:text-[12px] text-zinc-500 font-black uppercase mt-1.5 lg:mt-3">R$ {c.price} • {c.services?.join(' + ')}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={cn("text-xl lg:text-4xl font-black tracking-tighter leading-none", isAlert ? "text-red-500" : "text-amber-500")}>{days}d</p>
                      <p className="text-[8px] lg:text-[10px] text-zinc-700 font-black uppercase mt-1">Atraso</p>
                    </div>
                  </div>

                  <div className="flex gap-2 lg:gap-4 pt-4 lg:pt-8 border-t border-white/5">
                    {!isHistoryView && (
                      <button onClick={() => openRenewModal(c)} className="flex-1 py-3 lg:py-5 bg-emerald-500/10 text-emerald-500 rounded-xl lg:rounded-2xl hover:bg-emerald-500 hover:text-black transition-all flex justify-center items-center gap-1.5 lg:gap-2 font-black text-[9px] lg:text-[11px] uppercase"><RefreshCw size={16} /> Renovar</button>
                    )}
                    <a 
                      href={`https://wa.me/55${c.phone}?text=${encodeURIComponent(`Olá ${c.name.split(' ')[0]}! Tudo bem? Notei que faz um tempinho que você não passa aqui na barbearia para dar aquele talento. Que tal agendarmos um horário para essa semana? Estaremos te esperando!`)}`} 
                      target="_blank" 
                      className={cn("flex-1 py-3 lg:py-5 rounded-xl lg:rounded-2xl transition-all flex justify-center items-center gap-1.5 lg:gap-2 font-black text-[9px] lg:text-[11px] uppercase", isAlert ? "bg-amber-500 text-10 rounded-2xl p-5 outline-none focus:border-amber-500 text-white" />
        <button className="w-full bg-amber-500 text-black py-5 rounded-2xl font-black uppercase shadow-xl active:scale-95 transition-all">Entrar</button>
      </form>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-amber-500/30 overflow-x-hidden">
      <style>{`
        @keyframes text-rainbow { 0% { color: #ff0000; } 25% { color: #00ff00; } 50% { color: #0000ff; } 75% { color: #ff00ff; } 100% { color: #ff0000; } }
        .animate-text-rainbow { animation: text-rainbow 2s linear infinite; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>

      <header className="sticky top-0 z-40 px-6 lg:px-20 h-24 flex items-center justify-between bg-[#050505]/95 backdrop-blur-3xl border-b border-white/5">
        <div className="flex items-center gap-4">
          <button onClick={() => setIsProfileModalOpen(true)} className="w-12 h-12 bg-zinc-900 border border-white/10 rounded-2xl flex items-center justify-center text-zinc-400 hover:text-amber-500 shadow-inner"><UserIcon size={20} /></button>
          <div className="hidden lg:block">
            <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest leading-none mb-1">Olá, {userName.split(' ')[0]}!</p>
            <h1 className="text-xl lg:text-3xl font-black tracking-tighter italic leading-none">{isHistoryView ? 'PASTA RENOVADOS' : 'DASHBOARD ELITE'}</h1>
          </div>
          <div className="lg:hidden text-lg font-black italic">Olá, {userName.split(' ')[0]}!</div>
        </div>
        <div className="flex items-center gap-2 lg:gap-4">
          <button onClick={() => setIsRankingOpen(true)} className="p-3 lg:p-4 bg-zinc-900 border border-white/5 text-amber-500 rounded-xl hover:bg-amber-500 hover:text-black shadow-lg transition-all"><Trophy size={20} /></button>
          <button onClick={() => setIsFaturamentoOpen(true)} className="p-3 lg:p-4 bg-zinc-900 border border-white/5 text-emerald-500 rounded-xl hover:bg-emerald-500 hover:text-black shadow-lg transition-all"><BarChart3 size={20} /></button>
          <button onClick={() => setIsHistoryView(!isHistoryView)} className={cn("p-3 lg:p-4 rounded-xl border border-white/5 transition-all", isHistoryView ? "bg-amber-500 text-black shadow-amber-500/20" : "bg-zinc-900 text-zinc-500")}><FolderClock size={20} /></button>
          <button onClick={() => { resetForm(); setIsModalOpen(true); }} className="bg-amber-500 text-black px-5 lg:px-8 py-3 lg:py-4 rounded-2xl font-black text-xs hover:scale-105 active:scale-95 transition-all shadow-xl flex items-center gap-2 uppercase"><UserPlus size={18} /> <span className="hidden lg:inline">CADASTRAR</span></button>
          <button onClick={() => supabase.auth.signOut()} className="p-3 text-zinc-700 hover:text-red-500 transition-colors"><LogOut size={20} /></button>
        </div>
      </header>

      <main className="p-6 lg:p-24 max-w-[1700px] mx-auto space-y-12 pb-40">
        {!isHistoryView && (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-top-4 duration-700">
            <div className="col-span-2 lg:col-span-1 bg-gradient-to-br from-zinc-900 to-black border border-white/10 p-10 rounded-[3rem] relative overflow-hidden shadow-2xl">
              <TrendingUp className="absolute top-0 right-0 p-8 opacity-5" size={120} />
              <p className="text-[11px] font-black text-zinc-500 uppercase tracking-[0.3em] mb-3">Taxa de Fidelidade</p>
              <p className="text-7xl lg:text-9xl font-black text-amber-500 tracking-tighter">{stats.fidelity}%</p>
            </div>
            <div className="bg-zinc-900/40 border border-white/5 p-10 rounded-[2.5rem] shadow-xl flex flex-col justify-center">
              <p className="text-[11px] text-red-500 font-black uppercase tracking-widest mb-2">Recuperar (20d+)</p>
              <p className="text-6xl lg:text-7xl font-black text-red-500 tracking-tighter">{stats.needsRecovery}</p>
            </div>
            <div className="bg-zinc-900/40 border border-white/5 p-10 rounded-[2.5rem] shadow-xl flex flex-col justify-center">
              <p className="text-[11px] text-zinc-500 font-black uppercase tracking-widest mb-2">Total de Clientes</p>
              <p className="text-6xl lg:text-7xl font-black text-white tracking-tighter">{dashboardList.length}</p>
            </div>
          </div>
        )}

        {/* BUSCA E FILTRO DE ATRASO (UX PC) */}
        <div className="flex flex-col lg:flex-row gap-8 items-center">
          <div className="relative flex-1 group w-full">
            <Search className="absolute left-8 top-1/2 -translate-y-1/2 w-6 h-6 text-zinc-600 group-focus-within:text-amber-500 transition-all" />
            <input type="text" placeholder="Localizar cliente pelo nome..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-zinc-900/40 border border-white/10 rounded-3xl pl-20 pr-10 py-6 outline-none focus:border-amber-500/40 text-xl font-medium text-white shadow-inner" />
          </div>
          <div className="relative w-full lg:w-auto min-w-[300px]">
            <select value={delayFilter} onChange={(e) => setDelayFilter(e.target.value)} className="appearance-none bg-zinc-900 border border-white/10 rounded-3xl px-10 py-6 pr-20 text-[11px] font-black uppercase tracking-widest outline-none focus:border-amber-500/50 w-full cursor-pointer shadow-xl text-white">
              <option value="all">Ver Todos os Clientes</option>
              <option value="20days">Sumidos há +20 dias</option>
              <option value="30days">Sumidos há +30 dias</option>
            </select>
            <ChevronDown size={18} className="absolute right-10 top-1/2 -translate-y-1/2 text-zinc-500" />
          </div>
        </div>

        {/* LISTAGEM MULTICOLUNA (3 COLUNAS PC) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {(isHistoryView ? historyList : stats.list)
            .filter(c => (c.name || '').toLowerCase().includes(searchTerm.toLowerCase()))
            .map(c => {
              const days = differenceInDays(startOfDay(new Date()), parseISO(c.last_visit));
              const isSel = selectedPhones.includes(c.phone);
              const isAlert = days >= 20;

              return (
                <div key={c.id} className={cn("bg-zinc-900/30 border rounded-[3rem] p-8 flex flex-col justify-between transition-all group hover:bg-zinc-900/60 hover:border-white/15", isSel ? "border-amber-500 bg-amber-500/5 shadow-[0_0_30px_rgba(217,119,6,0.15)]" : "border-white/5")}>
                  <div className="flex items-start justify-between mb-8">
                    <div className="flex items-center gap-6">
                      {isSelectionMode ? (
                        <button onClick={() => setSelectedPhones(p => isSel ? p.filter(x => x !== c.phone) : [...p, c.phone])}>
                          {isSel ? <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center text-black shadow-lg"><CheckSquare size={22} /></div> : <div className="w-10 h-10 border-2 border-zinc-800 rounded-xl hover:border-amber-500/50" />}
                        </button>
                      ) : (
                        <div className="relative">
                          <div className="w-20 h-20 bg-gradient-to-br from-zinc-800 to-zinc-900 rounded-2xl flex items-center justify-center text-amber-500 font-black text-3xl border border-white/10 shadow-inner">{c.name?.[0]?.toUpperCase()}</div>
                          {c.streak_count >= 2 && !isHistoryView && (
                            <div className={cn("absolute -top-3 -right-3 flex items-center gap-1.5 bg-black px-3 py-1.5 rounded-full border border-white/20 text-xs font-black shadow-2xl", getStreakColor(c.streak_count))}>
                              <Flame size={14} className="fill-current" /> {c.streak_count}
                            </div>
                          )}
                        </div>
                      )}
                      <div>
                        <p className="font-black text-2xl text-white/95 leading-none">{c.name}</p>
                        {/* MOSTRA APENAS SE FOR DIFERENTE */}
                        {c.previous_name && c.previous_name !== c.name && (
                          <span className="text-[10px] text-zinc-500 block italic font-bold mt-2 tracking-tight uppercase">Anteriormente {c.previous_name}</span>
                        )}
                        <p className="text-[12px] text-zinc-500 font-black uppercase tracking-widest mt-3">R$ {c.price} • {c.services?.join(' + ')}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={cn("text-4xl font-black tracking-tighter leading-none", isAlert ? "text-red-500" : "text-amber-500")}>{days}d</p>
                      <p className="text-[10px] text-zinc-700 font-black uppercase mt-1 tracking-widest">Atraso</p>
                    </div>
                  </div>

                  <div className="flex gap-4 pt-8 border-t border-white/5">
                    {!isHistoryView && (
                      <button onClick={() => openRenewModal(c)} className="flex-1 py-5 bg-emerald-500/10 text-emerald-500 rounded-2xl hover:bg-emerald-500 hover:text-black transition-all flex justify-center items-center gap-2 font-black text-[11px] uppercase tracking-[0.1em]"><RefreshCw size={20} /> Renovar</button>
                    )}
                    <a href={`https://wa.me/55${c.phone}`} target="_blank" className={cn("flex-1 py-5 rounded-2xl transition-all flex justify-center items-center gap-2 font-black text-[11px] uppercase tracking-[0.1em] shadow-lg", isAlert ? "bg-amber-500 text-black hover:bg-amber-400" : "border-2 border-amber-500/50 text-amber-500 hover:bg-amber-500 hover:text-black")}>
                      <MessageSquare size={20} /> Chamar
                    </a>
                    <button onClick={() => { setPhonesToDelete([c.phone]); setIsDeleteModalOpen(true); }} className="p-5 bg-red-500/10 text-red-500 rounded-2xl hover:bg-red-500 hover:text-white transition-all"><Trash2 size={20} /></button>
                  </div>
                </div>
              );
            })}
        </div>
      </main>

      {/* MODO SELEÇÃO MULTI-APAGAR */}
      {isSelectionMode && selectedPhones.length > 0 && (
        <div className="fixed bottom-12 left-0 right-0 px-6 z-50 flex justify-center">
          <button onClick={() => { setPhonesToDelete(selectedPhones); setIsDeleteModalOpen(true); }} className="max-w-2xl w-full bg-red-600 text-white py-7 rounded-[3rem] font-black uppercase tracking-[0.3em] text-xs shadow-[0_20px_60px_rgba(220,38,38,0.5)] animate-bounce">Apagar {selectedPhones.length} Registros e Históricos Completos</button>
        </div>
      )}

      {/* MODAL: RELATÓRIO FINANCEIRO COM GRÁFICO REAL */}
      {isFaturamentoOpen && (
        <div className="fixed inset-0 bg-black/98 z-[75] flex items-center justify-center p-6 backdrop-blur-3xl">
          <div className="bg-zinc-900 border border-white/10 w-full max-w-5xl rounded-[3rem] p-10 lg:p-20 shadow-2xl text-white relative overflow-y-auto max-h-[95vh] no-scrollbar">
            <button onClick={() => setIsFaturamentoOpen(false)} className="absolute top-10 right-10 text-zinc-500 hover:text-white"><X size={40} /></button>
            
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-10 mb-16">
              <div>
                <h3 className="text-5xl font-black italic tracking-tighter uppercase mb-2 text-emerald-500">Fluxo de Caixa</h3>
                <p className="text-zinc-500 text-sm font-black uppercase tracking-widest tracking-[0.2em]">Gestão de Lucros Barber Pro</p>
              </div>
              <div className="relative">
                <select value={faturamentoPeriod} onChange={(e) => setFaturamentoPeriod(e.target.value)} className="appearance-none bg-black border border-white/10 rounded-2xl px-10 py-6 pr-20 text-[12px] font-black uppercase tracking-widest outline-none focus:border-emerald-500 text-white cursor-pointer shadow-2xl">
                  <option value="today">Hoje</option>
                  <option value="week">Últimos 7 dias</option>
                  <option value="month">Últimos 30 dias</option>
                </select>
                <ChevronDown size={20} className="absolute right-10 top-1/2 -translate-y-1/2 text-emerald-500" />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
              <div className="space-y-10">
                <div className="bg-black/50 border border-white/5 p-12 rounded-[3rem] shadow-inner">
                  <p className="text-zinc-500 text-xs font-black uppercase tracking-widest mb-3">Receita Total do Período</p>
                  <p className="text-8xl font-black text-white tracking-tighter">R$ {revenueChartData.totalRevenue}</p>
                  <p className="text-emerald-500 text-[11px] font-black uppercase mt-6">{revenueChartData.points.length} dias analisados</p>
                </div>
                
                {/* GRÁFICO DE LINHA REAL (X/Y) */}
                <div className="bg-black/30 p-10 rounded-[2.5rem] border border-white/10 h-[300px] relative group">
                   <p className="text-zinc-600 text-[10px] font-black uppercase mb-10 tracking-widest">Gráfico de Performance (Linha)</p>
                   <div className="w-full h-[180px] relative">
                      <svg className="w-full h-full" preserveAspectRatio="none">
                         <defs>
                           <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
                             <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
                             <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                           </linearGradient>
                         </defs>
                         {/* Caminho da Linha */}
                         <path 
                           d={`M ${revenueChartData.points.map((p, i) => `${(i / (revenueChartData.points.length - 1)) * 100}% ${180 - (p.total / revenueChartData.maxVal) * 180}`).join(' L ')}`} 
                           fill="none" 
                           stroke="#10b981" 
                           strokeWidth="4" 
                           strokeLinecap="round"
                           className="drop-shadow-[0_0_10px_#10b981]"
                         />
                         {/* Área preenchida sob a linha */}
                         <path 
                           d={`M 0 180 L ${revenueChartData.points.map((p, i) => `${(i / (revenueChartData.points.length - 1)) * 100}% ${180 - (p.total / revenueChartData.maxVal) * 180}`).join(' L ')} L 100% 180 Z`} 
                           fill="url(#lineGrad)" 
                         />
                         {/* Pontos Interativos */}
                         {revenueChartData.points.map((p, i) => (
                           <circle 
                             key={i} 
                             cx={`${(i / (revenueChartData.points.length - 1)) * 100}%`} 
                             cy={`${180 - (p.total / revenueChartData.maxVal) * 180}`} 
                             r="4" 
                             fill="#fff" 
                             className="opacity-0 group-hover:opacity-100 transition-opacity"
                           />
                         ))}
                      </svg>
                   </div>
                   <div className="flex justify-between mt-6 text-[9px] font-black text-zinc-700 uppercase tracking-widest">
                      <span>{format(revenueChartData.points[0].date, 'dd MMM')}</span>
                      <span>Histórico Real</span>
                      <span>{format(revenueChartData.points[revenueChartData.points.length - 1].date, 'dd MMM')}</span>
                   </div>
                </div>
              </div>

              <div>
                <h4 className="text-[12px] font-black text-zinc-500 uppercase tracking-widest mb-8 flex items-center gap-3"><Trophy size={18} className="text-amber-500" /> Clientes VIP do Período</h4>
                <div className="space-y-4">
                  {revenueChartData.totalRevenue === 0 ? (
                    <p className="text-zinc-700 italic font-black uppercase text-xs">Nenhum ganho registrado neste intervalo.</p>
                  ) : (
                    rankingList.sort((a, b) => b.spent - a.spent).slice(0, 6).map((client, idx) => (
                      <div key={idx} className="bg-black/40 border border-white/10 rounded-[2rem] p-7 flex items-center justify-between transition-all hover:bg-black/60">
                         <div className="flex items-center gap-6">
                            <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl", idx === 0 ? "bg-amber-500 text-black shadow-lg" : "bg-zinc-800 text-zinc-600")}>{idx + 1}º</div>
                            <div>
                              <p className="font-black text-xl text-white">{client.name}</p>
                              <p className="text-[10px] text-zinc-600 uppercase font-black tracking-widest mt-1">{client.phone}</p>
                            </div>
                         </div>
                         <p className="text-3xl font-black text-emerald-500 tracking-tighter italic">R$ {client.spent}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: RANKING COM GAVETA (DROPDOWN) */}
      {isRankingOpen && (
        <div className="fixed inset-0 bg-black/95 z-[70] flex items-center justify-center p-6 backdrop-blur-3xl">
          <div className="bg-zinc-900 border border-white/10 w-full max-w-3xl rounded-[3rem] p-12 lg:p-16 shadow-2xl text-white relative">
             <button onClick={() => setIsRankingOpen(false)} className="absolute top-10 right-10 text-zinc-500 hover:text-white"><X size={32} /></button>
             <div className="flex items-center gap-6 mb-12">
                <div className="w-20 h-20 bg-amber-500 text-black rounded-3xl flex items-center justify-center shadow-2xl"><Trophy size={40} /></div>
                <h3 className="text-4xl font-black italic tracking-tighter uppercase">Elite da Barbearia</h3>
             </div>

             <div className="mb-10 group">
                <label className="text-[11px] font-black text-zinc-500 uppercase tracking-widest mb-3 block ml-2">Critério de Classificação:</label>
                <div className="relative">
                  <select value={rankingSort} onChange={(e) => setRankingSort(e.target.value as any)} className="w-full bg-black border border-white/10 rounded-2xl px-8 py-6 appearance-none outline-none focus:border-amber-500 font-black uppercase text-sm tracking-[0.2em] text-white cursor-pointer shadow-xl">
                    <option value="streak">🔥 Maior Sequência (Streak)</option>
                    <option value="spent">💰 Maior Investimento (R$)</option>
                    <option value="cabelo">✂️ Serviços de Cabelo</option>
                    <option value="barba">🧔 Serviços de Barba</option>
                    <option value="sobrancelha">✨ Sobrancelhas Feitas</option>
                  </select>
                  <Filter size={20} className="absolute right-8 top-1/2 -translate-y-1/2 text-amber-500 pointer-events-none" />
                </div>
             </div>

             <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-4 no-scrollbar">
                {rankingList.map((client: any, idx) => (
                  <div key={client.phone} className="bg-black/40 border border-white/5 rounded-[2rem] p-7 flex items-center justify-between transition-all hover:bg-black/60">
                     <div className="flex items-center gap-6">
                        <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl", idx === 0 ? "bg-amber-500 text-black shadow-[0_0_20px_orange]" : "bg-zinc-800 text-zinc-600")}>
                          {idx + 1}º
                        </div>
                        <p className="font-black text-2xl text-white/90">{client.name}</p>
                     </div>
                     <div className="text-right">
                        <p className="text-3xl font-black text-amber-500 tracking-tighter">
                          {rankingSort === 'spent' ? `R$ ${client.spent}` : `${client[rankingSort]}x`}
                        </p>
                     </div>
                  </div>
                ))}
             </div>
          </div>
        </div>
      )}

      {/* MODAL: RENOVAR / EDITAR (Zerar Dias) */}
      {isRenewModalOpen && (
        <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-6 backdrop-blur-2xl">
          <div className="bg-zinc-900 border border-white/10 w-full max-w-lg rounded-[3rem] p-12 lg:p-16 shadow-3xl my-auto text-white">
             <div className="w-20 h-20 bg-emerald-500/10 text-emerald-500 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-xl"><RefreshCw size={40} /></div>
             <h3 className="text-3xl font-black mb-2 text-center tracking-tighter uppercase">Renovar Atendimento</h3>
             <p className="text-zinc-500 text-[10px] text-center mb-10 uppercase font-black tracking-[0.3em]">Sequência de Corte #{ (editingClient?.streak_count || 1) + 1 }</p>
             
             <form onSubmit={saveClient} className="space-y-6">
                <input required value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nome do Cliente" className="w-full bg-black border border-white/10 rounded-2xl p-5 outline-none focus:border-amber-500 font-black text-white text-lg shadow-inner" />
                <input required value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="Número WhatsApp" className="w-full bg-black border border-white/10 rounded-2xl p-5 outline-none focus:border-amber-500 text-white text-lg shadow-inner" />
                <div className="grid grid-cols-2 gap-6">
                   <div className="space-y-2">
                     <label className="text-[10px] font-black text-zinc-600 uppercase ml-2">Valor R$</label>
                     <input type="number" value={newPrice} onChange={e => setNewPrice(e.target.value)} className="w-full bg-black border border-white/10 rounded-2xl p-5 outline-none focus:border-amber-500 font-black text-emerald-500 text-xl" />
                   </div>
                   <div className="space-y-2">
                     <label className="text-[10px] font-black text-zinc-600 uppercase ml-2">Data do Atendimento</label>
                     <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} className="w-full bg-black border border-white/10 rounded-2xl p-5 outline-none focus:border-amber-500 text-sm text-white" />
                   </div>
                </div>
                <div className="flex gap-2">
                  {['Cabelo', 'Barba', 'Sobrancelha'].map(s => (
                    <button key={s} type="button" onClick={() => setSelectedServices(p => p.includes(s) ? p.filter(x => x !== s) : [...p, s])} className={cn("flex-1 py-4 rounded-2xl text-[11px] font-black uppercase border transition-all", selectedServices.includes(s) ? "bg-amber-500 border-amber-500 text-black shadow-lg shadow-amber-500/20" : "bg-black border-white/10 text-zinc-600")}>{s}</button>
                  ))}
                </div>
                <div className="flex gap-4 pt-8">
                  <button type="button" onClick={() => { setIsRenewModalOpen(false); setEditingClient(null); }} className="flex-1 py-5 text-zinc-600 font-black uppercase text-[11px] tracking-widest">Sair</button>
                  <button type="submit" className="flex-1 bg-emerald-500 text-black py-5 rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl shadow-emerald-500/30 active:scale-95 transition-all">Confirmar Retorno</button>
                </div>
             </form>
          </div>
        </div>
      )}

      {/* MODAL: NOVO CLIENTE (LUXO) */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-6 backdrop-blur-md overflow-y-auto no-scrollbar">
          <div className="bg-zinc-900 border border-white/10 w-full max-w-xl rounded-[4rem] p-12 lg:p-20 shadow-2xl my-auto text-white">
            <h3 className="text-4xl font-black mb-12 text-center italic tracking-tighter uppercase tracking-[0.2em]">NOVO <span className="text-amber-500 text-5xl">CLIENTE</span></h3>
            <form onSubmit={saveClient} className="space-y-6">
              <input required placeholder="Nome Completo" value={newName} onChange={e => setNewName(e.target.value)} className="w-full bg-black border border-white/10 rounded-2xl p-6 outline-none focus:border-amber-500 font-black text-white text-xl shadow-inner" />
              <input required placeholder="WhatsApp (459999-9999)" value={newPhone} onChange={e => setNewPhone(e.target.value)} className="w-full bg-black border border-white/10 rounded-2xl p-6 outline-none focus:border-amber-500 text-white text-xl shadow-inner" />
              <div className="grid grid-cols-2 gap-6">
                <input type="number" placeholder="Valor R$" value={newPrice} onChange={e => setNewPrice(e.target.value)} className="w-full bg-black border border-white/10 rounded-2xl p-6 outline-none focus:border-amber-500 font-black text-emerald-500 text-xl" />
                <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} className="w-full bg-black border border-white/10 rounded-2xl p-6 outline-none focus:border-amber-500 text-sm text-white" />
              </div>
              <div className="flex gap-2">
                {['Cabelo', 'Barba', 'Sobrancelha'].map(s => (
                  <button key={s} type="button" onClick={() => setSelectedServices(p => p.includes(s) ? p.filter(x => x !== s) : [...p, s])} className={cn("flex-1 py-5 rounded-2xl text-[10px] font-black uppercase border transition-all", selectedServices.includes(s) ? "bg-amber-500 border-amber-500 text-black shadow-lg shadow-amber-500/20" : "bg-black border-white/10 text-zinc-600")}>{s}</button>
                ))}
              </div>
              <div className="flex gap-6 pt-10">
                <button type="button" onClick={() => { setIsModalOpen(false); setEditingClient(null); }} className="flex-1 py-6 text-zinc-600 font-black uppercase text-[11px] tracking-widest">Descartar</button>
                <button type="submit" className="flex-1 bg-amber-500 text-black py-6 rounded-[2rem] font-black uppercase text-[12px] tracking-[0.2em] shadow-[0_20px_50px_rgba(217,119,6,0.2)] active:scale-95 transition-all">Salvar Cliente</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EXCLUIR DEFINITIVO */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-black/95 z-[80] flex items-center justify-center p-6 backdrop-blur-2xl text-white">
          <div className="bg-zinc-900 border border-red-500/20 w-full max-w-md rounded-[3rem] p-12 lg:p-16 text-center shadow-2xl animate-in zoom-in duration-200">
             <div className="w-24 h-24 bg-red-500/10 text-red-500 rounded-3xl flex items-center justify-center mx-auto mb-10 shadow-lg"><Trash2 size={48} /></div>
             <h3 className="text-3xl font-black mb-4 tracking-tighter uppercase italic">Apagar Para Sempre?</h3>
             <p className="text-zinc-500 text-[11px] mb-12 uppercase font-bold tracking-widest leading-relaxed">Você está limpando {phonesToDelete.length} cliente(s) e toda a sequência de atendimentos deles.<br/><span className="text-red-500 font-black uppercase mt-2 block">NÃO HÁ VOLTA.</span></p>
             <div className="flex flex-col gap-4">
               <button onClick={executeDelete} className="w-full bg-red-600 text-white py-6 rounded-2xl font-black uppercase text-xs tracking-widest shadow-[0_10px_40px_rgba(220,38,38,0.3)] hover:bg-red-500 transition-all">Sim, Confirmar Exclusão</button>
               <button onClick={() => setIsDeleteModalOpen(false)} className="w-full py-5 text-zinc-600 font-black uppercase text-[11px] tracking-widest hover:text-white">Manter Registros</button>
             </div>
          </div>
        </div>
      )}

      {/* MODAL: PERFIL */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 bg-black/98 z-[90] flex items-center justify-center p-10 backdrop-blur-3xl text-white">
          <div className="bg-zinc-900 border border-white/10 w-full max-w-md rounded-[4rem] p-14 lg:p-20 text-center shadow-3xl">
            <h3 className="text-3xl font-black mb-4 tracking-tight uppercase italic tracking-[0.2em]">Quem está acessando?</h3>
            <p className="text-zinc-500 text-[11px] mb-12 uppercase font-black tracking-widest">Para personalizar seu Barber Pro</p>
            <input autoFocus placeholder="Seu Nome Profissional" value={userName} onChange={e => setUserName(e.target.value)} className="w-full bg-black border border-white/10 rounded-2xl p-6 mb-10 text-center font-black text-white text-xl outline-none focus:border-amber-500 transition-all shadow-inner" />
            <button onClick={updateProfile} className="w-full bg-amber-500 text-black py-6 rounded-2xl font-black text-[12px] uppercase tracking-[0.2em] shadow-xl shadow-amber-500/20 active:scale-95 transition-all">Começar Agora</button>
          </div>
        </div>
      )}
    </div>
  );
}
