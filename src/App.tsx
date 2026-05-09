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
      <form onSubmit={async (e) => { e.preventDefault(); await supabase.auth.signInWithPassword({email, password}); }} className="bg-zinc-900/40 p-10 rounded-[3rem] border border-white/5 space-y-6 w-full max-w-sm shadow-2xl backdrop-blur-xl">
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
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes text-rainbow { 0% { color: #ff0000; } 25% { color: #00ff00; } 50% { color: #0000ff; } 75% { color: #ff00ff; } 100% { color: #ff0000; } }
        .animate-text-rainbow { animation: text-rainbow 2s linear infinite; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .glass-card { background: rgba(24, 24, 27, 0.4); backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.05); transition: all 0.3s ease; }
      ` }} />

      <header className="sticky top-0 z-40 px-4 lg:px-20 h-16 lg:h-24 flex items-center justify-between bg-[#050505]/80 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center gap-3">
          <button onClick={() => setIsProfileModalOpen(true)} className="w-9 h-9 lg:w-12 lg:h-12 glass-card rounded-xl flex items-center justify-center text-zinc-400 hover:text-amber-500 transition-all"><UserIcon size={18} /></button>
          <div className="text-base lg:text-2xl font-black italic tracking-tighter truncate max-w-[150px]">Olá, {userName.split(' ')[0]}!</div>
        </div>
        <div className="flex items-center gap-1.5 lg:gap-4">
          <button onClick={() => setIsRankingOpen(true)} className="p-2 lg:p-4 glass-card text-amber-500 rounded-xl"><Trophy size={18} /></button>
          <button onClick={() => setIsFaturamentoOpen(true)} className="p-2 lg:p-4 glass-card text-emerald-500 rounded-xl"><BarChart3 size={18} /></button>
          <button onClick={() => setIsHistoryView(!isHistoryView)} className={cn("p-2 lg:p-4 rounded-xl border border-white/5 transition-all", isHistoryView ? "bg-amber-500 text-black shadow-amber-500/20" : "glass-card text-zinc-500")}><FolderClock size={18} /></button>
          <button onClick={() => { resetForm(); setIsModalOpen(true); }} className="bg-amber-500 text-black px-3 lg:px-8 py-2 lg:py-4 rounded-xl lg:rounded-2xl font-black text-[10px] lg:text-xs hover:scale-105 active:scale-95 transition-all shadow-lg flex items-center gap-1.5 uppercase tracking-widest"><UserPlus size={16} /> <span className="hidden lg:inline">CADASTRAR</span></button>
          <button onClick={() => setIsLogoutModalOpen(true)} className="p-2 text-zinc-700 hover:text-red-500 transition-colors"><LogOut size={18} /></button>
        </div>
      </header>

      <main className="p-4 lg:p-24 max-w-[1800px] mx-auto space-y-8 lg:space-y-12 pb-40 text-center">
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
          <div className="relative flex-1 group w-full text-left">
            <Search className="absolute left-4 lg:left-8 top-1/2 -translate-y-1/2 w-4 lg:w-6 h-4 lg:h-6 text-zinc-600 group-focus-within:text-amber-500 transition-all" />
            <input type="text" placeholder="Localizar cliente..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-zinc-900/30 border border-white/10 rounded-2xl lg:rounded-3xl pl-12 lg:pl-20 pr-6 lg:pr-10 py-3 lg:py-6 outline-none focus:border-amber-500/40 text-sm lg:text-xl font-medium text-white shadow-inner" />
          </div>
          <div className="relative w-full lg:w-auto min-w-[300px]">
            <select value={delayFilter} onChange={(e) => setDelayFilter(e.target.value)} className="appearance-none bg-zinc-900/50 border border-white/10 rounded-2xl px-6 py-3 lg:py-6 pr-12 text-[10px] lg:text-[12px] font-black uppercase tracking-widest outline-none focus:border-amber-500/50 w-full cursor-pointer text-white">
              <option value="all">Ver Todos</option><option value="20days">Ausentes +20 dias</option><option value="30days">Ausentes +30 dias</option>
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
              const whatsappMsg = encodeURIComponent(`Olá ${c.name.split(' ')[0]}! Tudo bem? Notei que faz um tempinho que você não passa aqui na barbearia para dar aquele talento. Que tal agendarmos um horário para essa semana? Estaremos te esperando!`);

              return (
                <div key={c.id} className={cn("glass-card rounded-[1.5rem] lg:rounded-[3rem] p-4 lg:p-8 flex flex-col justify-between transition-all", isSel ? "border-amber-500 bg-amber-500/5" : "")}>
                  <div className="flex items-start justify-between mb-4 lg:mb-8 text-left">
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
                    {!isHistoryView && <button onClick={() => openRenewModal(c)} className="flex-1 py-3 lg:py-5 bg-emerald-500/10 text-emerald-500 rounded-xl lg:rounded-2xl hover:bg-emerald-500 transition-all flex justify-center items-center gap-1.5 font-black text-[9px] uppercase"><RefreshCw size={16} /> Renovar</button>}
                    <a href={`https://wa.me/55${c.phone}?text=${whatsappMs
