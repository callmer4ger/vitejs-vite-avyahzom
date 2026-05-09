import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, UserPlus, MessageSquare, Search, Trash2, 
  Scissors, LogOut, Loader2, RefreshCw, CheckSquare, 
  Square, User as UserIcon, TrendingUp, Wallet, 
  ChevronDown, AlertCircle, FolderClock, Flame, Trophy, BarChart3, X
} from 'lucide-react';
import { format, differenceInDays, parseISO, startOfDay, subDays, isWithinInterval } from 'date-fns';
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
  const [isHistoryView, setIsHistoryView] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [delayFilter, setDelayFilter] = useState('all'); // Filtro de atraso
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
    if (data) setAllRecords(data.map(c => ({ ...c, price: Number(c.price) || 0, services: c.services || [], streak_count: c.streak_count || 1 })));
  };

  useEffect(() => { if (session) fetchClients(); }, [session]);

  const saveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    const phone = newPhone.replace(/\D/g, '');
    let prevName = editingClient?.name || null;
    let nextStreak = 1;

    if (editingClient) {
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
      await fetchClients();
    }
  };

  const resetForm = () => {
    setNewName(''); setNewPhone(''); setNewPrice(''); setSelectedServices([]);
    setNewDate(format(new Date(), 'yyyy-MM-dd'));
  };

  const executeDelete = async () => {
    // APAGA TUDO: Dashboard + Pasta
    await supabase.from('clientes').delete().in('phone', phonesToDelete);
    setIsDeleteModalOpen(false); setIsSelectionMode(false); setSelectedPhones([]); setPhonesToDelete([]);
    await fetchClients();
  };

  const openRenewModal = (client: any) => {
    setEditingClient(client); setNewName(client.name); setNewPhone(client.phone);
    setNewPrice(client.price.toString()); setSelectedServices(client.services);
    setNewDate(format(new Date(), 'yyyy-MM-dd')); setIsRenewModalOpen(true);
  };

  // Separação de Dados
  const { dashboardList, historyList, rankingList } = useMemo(() => {
    const sorted = [...allRecords].sort((a, b) => parseISO(b.last_visit).getTime() - parseISO(a.last_visit).getTime());
    const latestMap = new Map();
    const history: any[] = [];
    const rankMap = new Map();

    sorted.forEach(r => {
      // Para o Dashboard (Apenas o mais recente)
      if (!latestMap.has(r.phone)) latestMap.set(r.phone, r);
      else history.push(r);

      // Para o Ranking
      const cur = rankMap.get(r.phone) || { name: r.name, phone: r.phone, spent: 0, streak: 0, cabelo: 0, barba: 0, sobrancelha: 0 };
      cur.spent += r.price;
      cur.streak = Math.max(cur.streak, r.streak_count);
      if (r.services.includes('Cabelo')) cur.cabelo++;
      if (r.services.includes('Barba')) cur.barba++;
      if (r.services.includes('Sobrancelha')) cur.sobrancelha++;
      rankMap.set(r.phone, cur);
    });

    const rankArray = Array.from(rankMap.values()).sort((a: any, b: any) => {
      if (rankingSort === 'streak') return b.streak - a.streak;
      if (rankingSort === 'spent') return b.spent - a.spent;
      return b[rankingSort] - a[rankingSort];
    });

    // Ordenar Dashboard por MAIOR ATRASO (Dias)
    const dashboardOrdered = Array.from(latestMap.values()).sort((a, b) => {
      return parseISO(a.last_visit).getTime() - parseISO(b.last_visit).getTime();
    });

    return { dashboardList: dashboardOrdered, historyList: history, rankingList: rankArray };
  }, [allRecords, rankingSort]);

  // Estatísticas e Gráfico de Faturamento
  const revenueStats = useMemo(() => {
    const today = startOfDay(new Date());
    const range = { 'today': today, 'week': subDays(today, 7), 'month': subDays(today, 30), 'all': new Date(0) }[faturamentoPeriod] || new Date(0);
    
    const filtered = allRecords.filter(r => parseISO(r.last_visit) >= range);
    const total = filtered.reduce((acc, cur) => acc + cur.price, 0);
    
    // Top Clientes que deram dinheiro
    const topSpenders = rankingList.sort((a, b) => b.spent - a.spent).slice(0, 5);

    return { total, topSpenders, count: filtered.length };
  }, [allRecords, faturamentoPeriod, rankingList]);

  const stats = useMemo(() => {
    const today = startOfDay(new Date());
    const needsRecovery = dashboardList.filter(c => differenceInDays(today, parseISO(c.last_visit)) >= 20).length;
    
    // Filtrar a lista da tela inicial pelo tempo de atraso
    const filteredDashboard = dashboardList.filter(c => {
      const days = differenceInDays(today, parseISO(c.last_visit));
      if (delayFilter === '20days') return days >= 20;
      if (delayFilter === '30days') return days >= 30;
      return true;
    });

    return { 
      list: filteredDashboard,
      needsRecovery, 
      fidelity: dashboardList.length > 0 ? Math.round(((dashboardList.length - needsRecovery) / dashboardList.length) * 100) : 0 
    };
  }, [dashboardList, delayFilter]);

  const getStreakColor = (count: number) => {
    if (count < 10) return 'text-white';
    if (count < 20) return 'text-yellow-400 drop-shadow-[0_0_5px_yellow]';
    if (count < 30) return 'text-[#00ff41] drop-shadow-[0_0_8px_#00ff41]';
    if (count < 40) return 'text-[#00f3ff] drop-shadow-[0_0_8px_#00f3ff]';
    if (count < 50) return 'text-[#ff00ff] drop-shadow-[0_0_8px_#ff00ff]';
    return 'animate-text-rainbow font-black';
  };

  if (authLoading) return <div className="min-h-screen bg-[#050505] flex items-center justify-center text-amber-500 font-black italic text-xl animate-pulse">BARBER PRO</div>;

  if (!session) return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6">
      <form onSubmit={async (e) => { e.preventDefault(); const {error} = await supabase.auth.signInWithPassword({email, password}); if(error) setLoginError('Erro no acesso'); }} className="bg-zinc-900/50 p-10 rounded-[3rem] border border-white/5 space-y-6 w-full max-w-sm shadow-2xl backdrop-blur-xl">
        <div className="w-20 h-20 bg-amber-500 rounded-[2rem] flex items-center justify-center mx-auto shadow-2xl"><Scissors className="text-black w-10 h-10" /></div>
        <h1 className="text-4xl font-black text-white italic tracking-tighter text-center">BARBER <span className="text-amber-500">PRO</span></h1>
        <input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="E-mail" className="w-full bg-black border border-white/10 rounded-2xl p-5 outline-none focus:border-amber-500 text-white" />
        <input required type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Senha" className="w-full bg-black border border-white/10 rounded-2xl p-5 outline-none focus:border-amber-500 text-white" />
        <button className="w-full bg-amber-500 text-black py-5 rounded-2xl font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all">Entrar</button>
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

      {/* HEADER PC & MOBILE */}
      <header className="sticky top-0 z-40 px-6 lg:px-20 h-24 flex items-center justify-between bg-[#050505]/95 backdrop-blur-3xl border-b border-white/5">
        <div className="flex items-center gap-4">
          <button onClick={() => setIsProfileModalOpen(true)} className="w-12 h-12 bg-zinc-900 border border-white/10 rounded-2xl flex items-center justify-center text-zinc-400 hover:text-amber-500 transition-all shadow-inner"><UserIcon size={20} /></button>
          <div>
            <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest leading-none mb-1">Olá, {userName.split(' ')[0]}!</p>
            <h1 className="text-xl lg:text-3xl font-black tracking-tighter italic leading-none">{isHistoryView ? 'PASTA RENOVADOS' : 'PAINEL ELITE'}</h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setIsRankingOpen(true)} className="p-3 bg-zinc-900 border border-white/5 text-amber-500 rounded-xl hover:bg-amber-500 hover:text-black transition-all shadow-lg"><Trophy size={20} /></button>
          <button onClick={() => setIsFaturamentoOpen(true)} className="p-3 bg-zinc-900 border border-white/5 text-emerald-500 rounded-xl hover:bg-emerald-500 hover:text-black transition-all shadow-lg"><BarChart3 size={20} /></button>
          <button onClick={() => setIsHistoryView(!isHistoryView)} className={cn("p-3 rounded-xl border border-white/5 transition-all", isHistoryView ? "bg-amber-500 text-black" : "bg-zinc-900 text-zinc-500")}><FolderClock size={20} /></button>
          <button onClick={() => { resetForm(); setIsModalOpen(true); }} className="bg-amber-500 text-black px-6 py-3 rounded-2xl font-black text-xs hover:scale-105 active:scale-95 transition-all shadow-xl flex items-center gap-2"><UserPlus size={18} /> <span className="hidden lg:inline">CADASTRAR</span></button>
          <button onClick={() => supabase.auth.signOut()} className="p-3 text-zinc-700 hover:text-red-500 transition-colors"><LogOut size={20} /></button>
        </div>
      </header>

      <main className="p-6 lg:p-20 max-w-[1600px] mx-auto space-y-10 pb-40">
        {!isHistoryView && (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-top-4 duration-700">
            <div className="col-span-2 lg:col-span-1 bg-gradient-to-br from-zinc-900 to-black border border-white/10 p-8 rounded-[3rem] relative overflow-hidden shadow-2xl">
              <TrendingUp className="absolute top-0 right-0 p-8 opacity-5" size={100} />
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em] mb-3">Retenção Geral</p>
              <p className="text-7xl font-black text-amber-500 tracking-tighter">{stats.fidelity}%</p>
            </div>
            <div className="bg-zinc-900/40 border border-white/5 p-8 rounded-[2.5rem] shadow-xl flex flex-col justify-center">
              <p className="text-[10px] text-red-500 font-black uppercase tracking-widest mb-2">Recuperar (20d+)</p>
              <p className="text-6xl font-black text-red-500 tracking-tighter">{stats.needsRecovery}</p>
            </div>
            <div className="bg-zinc-900/40 border border-white/5 p-8 rounded-[2.5rem] shadow-xl flex flex-col justify-center">
              <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest mb-2">Total de Clientes</p>
              <p className="text-6xl font-black text-white tracking-tighter">{dashboardList.length}</p>
            </div>
          </div>
        )}

        {/* BUSCA E FILTRO DE ATRASO */}
        <div className="flex flex-col lg:flex-row gap-6 items-center">
          <div className="relative flex-1 group w-full">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600 group-focus-within:text-amber-500 transition-all" />
            <input type="text" placeholder="Localizar cliente..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-zinc-900/40 border border-white/10 rounded-3xl pl-16 pr-8 py-5 outline-none focus:border-amber-500/40 text-lg font-medium text-white shadow-inner" />
          </div>
          <div className="relative w-full lg:w-auto">
            <select value={delayFilter} onChange={(e) => setDelayFilter(e.target.value)} className="appearance-none bg-zinc-900 border border-white/10 rounded-3xl px-10 py-5 pr-16 text-[11px] font-black uppercase tracking-widest outline-none focus:border-amber-500/50 w-full lg:w-auto cursor-pointer shadow-xl text-white">
              <option value="all">Ver Todos os Clientes</option>
              <option value="20days">Ausentes há +20 dias</option>
              <option value="30days">Ausentes há +30 dias</option>
            </select>
            <ChevronDown size={16} className="absolute right-8 top-1/2 -translate-y-1/2 text-zinc-500" />
          </div>
        </div>

        {/* GRID DE CARDS (PC: 3 Colunas) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {(isHistoryView ? historyList : stats.list)
            .filter(c => (c.name || '').toLowerCase().includes(searchTerm.toLowerCase()))
            .map(c => {
              const days = differenceInDays(startOfDay(new Date()), parseISO(c.last_visit));
              const isSel = selectedPhones.includes(c.phone);
              return (
                <div key={c.id} className={cn("bg-zinc-900/30 border rounded-[3rem] p-7 flex flex-col justify-between transition-all hover:bg-zinc-900/50", isSel ? "border-amber-500 bg-amber-500/5" : "border-white/5")}>
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex items-center gap-5">
                      {isSelectionMode ? (
                        <button onClick={() => setSelectedPhones(p => isSel ? p.filter(x => x !== c.phone) : [...p, c.phone])}>
                          {isSel ? <div className="w-8 h-8 bg-amber-500 rounded-xl flex items-center justify-center text-black"><CheckSquare size={18} /></div> : <div className="w-8 h-8 border-2 border-zinc-800 rounded-xl" />}
                        </button>
                      ) : (
                        <div className="relative">
                          <div className="w-16 h-16 bg-gradient-to-br from-zinc-800 to-zinc-900 rounded-2xl flex items-center justify-center text-amber-500 font-black text-2xl border border-white/10">{c.name?.[0]?.toUpperCase()}</div>
                          {c.streak_count >= 2 && !isHistoryView && (
                            <div className={cn("absolute -top-3 -right-3 flex items-center gap-1 bg-black px-2.5 py-1 rounded-full border border-white/20 text-[11px] font-black shadow-2xl", getStreakColor(c.streak_count))}>
                              <Flame size={12} className="fill-current" /> {c.streak_count}
                            </div>
                          )}
                        </div>
                      )}
                      <div>
                        <p className="font-black text-xl text-white/95 leading-none">{c.name}</p>
                        {c.previous_name && <span className="text-[10px] text-zinc-500 block italic font-bold mt-1">Anteriormente {c.previous_name}</span>}
                        <p className="text-[11px] text-zinc-500 font-black uppercase tracking-widest mt-2">R$ {c.price} • {c.services?.join(' + ')}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={cn("text-3xl font-black tracking-tighter leading-none", days >= 20 ? "text-red-500" : "text-amber-500")}>{days}d</p>
                      <p className="text-[9px] text-zinc-700 font-black uppercase mt-1">Atraso</p>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-6 border-t border-white/5">
                    {!isHistoryView && (
                      <button onClick={() => openRenewModal(c)} className="flex-1 py-4 bg-emerald-500/10 text-emerald-500 rounded-2xl hover:bg-emerald-500 hover:text-black transition-all flex justify-center items-center gap-2 font-black text-[10px] uppercase tracking-widest"><RefreshCw size={18} /> Renovar</button>
                    )}
                    <a href={`https://wa.me/55${c.phone}`} target="_blank" className={cn("flex-1 py-4 rounded-2xl transition-all flex justify-center items-center gap-2 font-black text-[10px] uppercase tracking-widest shadow-lg", days >= 20 ? "bg-amber-500 text-black" : "border-2 border-amber-500 text-amber-500")}>
                      <MessageSquare size={18} /> Chamar
                    </a>
                    <button onClick={() => { setPhonesToDelete([c.phone]); setIsDeleteModalOpen(true); }} className="p-4 bg-red-500/10 text-red-500 rounded-2xl hover:bg-red-500 hover:text-white transition-all"><Trash2 size={18} /></button>
                  </div>
                </div>
              );
            })}
        </div>
      </main>

      {/* MODAL: RELATÓRIO FINANCEIRO (FATURAMENTO) */}
      {isFaturamentoOpen && (
        <div className="fixed inset-0 bg-black/98 z-[75] flex items-center justify-center p-6 backdrop-blur-3xl">
          <div className="bg-zinc-900 border border-white/5 w-full max-w-4xl rounded-[3rem] p-10 lg:p-16 shadow-2xl text-white relative overflow-y-auto max-h-[90vh] no-scrollbar">
            <button onClick={() => setIsFaturamentoOpen(false)} className="absolute top-8 right-8 text-zinc-500 hover:text-white"><X size={32} /></button>
            
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 mb-12">
              <div>
                <h3 className="text-4xl font-black italic tracking-tighter uppercase mb-2 text-emerald-500">Fluxo de Caixa</h3>
                <p className="text-zinc-500 text-sm font-black uppercase tracking-widest">Controle total dos seus ganhos</p>
              </div>
              <div className="relative">
                <select value={faturamentoPeriod} onChange={(e) => setFaturamentoPeriod(e.target.value)} className="appearance-none bg-black border border-white/10 rounded-2xl px-10 py-5 pr-16 text-[12px] font-black uppercase tracking-widest outline-none focus:border-emerald-500 text-white cursor-pointer shadow-xl">
                  <option value="today">Hoje</option>
                  <option value="week">Últimos 7 dias</option>
                  <option value="month">Últimos 30 dias</option>
                  <option value="all">Todo o Histórico</option>
                </select>
                <ChevronDown size={16} className="absolute right-8 top-1/2 -translate-y-1/2 text-emerald-500" />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
              <div className="space-y-8">
                <div className="bg-black/40 border border-white/5 p-10 rounded-[2.5rem]">
                  <p className="text-zinc-500 text-xs font-black uppercase tracking-widest mb-2">Faturamento do Período</p>
                  <p className="text-7xl font-black text-white tracking-tighter">R$ {revenueStats.total}</p>
                  <p className="text-emerald-500 text-[10px] font-black uppercase mt-4">{revenueStats.count} Atendimentos Realizados</p>
                </div>
                
                {/* Gráfico Simples de Barras em CSS */}
                <div className="bg-black/20 p-8 rounded-[2rem] border border-white/5">
                   <p className="text-zinc-600 text-[10px] font-black uppercase mb-6">Média Visual de Ganhos</p>
                   <div className="flex items-end justify-between h-32 gap-3">
                      {[40, 70, 50, 90, 60, 100, 80].map((h, i) => (
                        <div key={i} className="flex-1 bg-emerald-500/20 rounded-t-lg transition-all hover:bg-emerald-500" style={{ height: `${h}%` }}></div>
                      ))}
                   </div>
                </div>
              </div>

              <div>
                <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-6">Maiores Investidores (Top 5)</h4>
                <div className="space-y-4">
                  {revenueStats.topSpenders.map((client, idx) => (
                    <div key={idx} className="bg-black/30 border border-white/5 rounded-3xl p-6 flex items-center justify-between">
                       <div className="flex items-center gap-5">
                          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-black">{idx + 1}º</div>
                          <div>
                            <p className="font-black text-lg">{client.name}</p>
                            <p className="text-[10px] text-zinc-600 uppercase font-black">{client.phone}</p>
                          </div>
                       </div>
                       <p className="text-2xl font-black text-white tracking-tighter">R$ {client.spent}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: RANKING ELITE (Com Gaveta/Dropdown) */}
      {isRankingOpen && (
        <div className="fixed inset-0 bg-black/95 z-[70] flex items-center justify-center p-6 backdrop-blur-3xl">
          <div className="bg-zinc-900 border border-white/5 w-full max-w-2xl rounded-[3rem] p-10 shadow-2xl text-white relative">
             <button onClick={() => setIsRankingOpen(false)} className="absolute top-8 right-8 text-zinc-500 hover:text-white"><X size={24} /></button>
             <div className="flex items-center gap-5 mb-10">
                <div className="w-16 h-16 bg-amber-500 text-black rounded-2xl flex items-center justify-center shadow-2xl"><Trophy size={32} /></div>
                <h3 className="text-3xl font-black italic tracking-tighter uppercase">Ranking de Elite</h3>
             </div>

             <div className="mb-8">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-2 block">Critério de Classificação:</label>
                <div className="relative">
                  <select value={rankingSort} onChange={(e) => setRankingSort(e.target.value as any)} className="w-full bg-black border border-white/10 rounded-2xl px-6 py-5 appearance-none outline-none focus:border-amber-500 font-black uppercase text-xs tracking-widest text-white">
                    <option value="streak">🔥 Maior Sequência (Streak)</option>
                    <option value="spent">💰 Maior Investimento (R$)</option>
                    <option value="cabelo">✂️ Fanáticos por Cabelo</option>
                    <option value="barba">🧔 Fanáticos por Barba</option>
                    <option value="sobrancelha">✨ Sobrancelhas Feitas</option>
                  </select>
                  <ChevronDown size={16} className="absolute right-6 top-1/2 -translate-y-1/2 text-amber-500" />
                </div>
             </div>

             <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-3 no-scrollbar">
                {rankingList.map((client: any, idx) => (
                  <div key={client.phone} className="bg-black/30 border border-white/5 rounded-3xl p-6 flex items-center justify-between">
                     <div className="flex items-center gap-5">
                        <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center font-black", idx === 0 ? "bg-amber-500 text-black shadow-[0_0_20px_orange]" : "bg-zinc-800 text-zinc-500")}>
                          {idx + 1}º
                        </div>
                        <p className="font-black text-lg">{client.name}</p>
                     </div>
                     <div className="text-right">
                        <p className="text-2xl font-black text-amber-500 tracking-tighter">
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
          <div className="bg-zinc-900 border border-white/10 w-full max-w-md rounded-[3rem] p-10 shadow-3xl my-auto text-white">
             <div className="w-16 h-16 bg-emerald-500/10 text-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-6"><RefreshCw size={32} /></div>
             <h3 className="text-2xl font-black mb-1 text-center tracking-tight uppercase tracking-tighter">Renovar Atendimento</h3>
             <p className="text-zinc-500 text-[10px] text-center mb-8 uppercase font-bold tracking-widest">Sequência de Corte #{ (editingClient?.streak_count || 1) + 1 }</p>
             <form onSubmit={saveClient} className="space-y-4">
                <input required value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nome" className="w-full bg-black border border-white/10 rounded-2xl p-4 outline-none focus:border-amber-500 font-bold text-white shadow-inner" />
                <input required value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="Número WhatsApp" className="w-full bg-black border border-white/10 rounded-2xl p-4 outline-none focus:border-amber-500 text-white" />
                <div className="grid grid-cols-2 gap-4">
                   <input type="number" value={newPrice} onChange={e => setNewPrice(e.target.value)} placeholder="R$" className="w-full bg-black border border-white/10 rounded-2xl p-4 outline-none focus:border-amber-500 font-black text-emerald-500" />
                   <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} className="w-full bg-black border border-white/10 rounded-2xl p-4 outline-none focus:border-amber-500 text-xs text-white" />
                </div>
                <div className="flex gap-2">
                  {['Cabelo', 'Barba', 'Sobrancelha'].map(s => (
                    <button key={s} type="button" onClick={() => setSelectedServices(p => p.includes(s) ? p.filter(x => x !== s) : [...p, s])} className={cn("flex-1 py-3 rounded-xl text-[10px] font-black uppercase border transition-all", selectedServices.includes(s) ? "bg-amber-500 border-amber-500 text-black shadow-lg" : "bg-black border-white/10 text-zinc-600")}>{s}</button>
                  ))}
                </div>
                <div className="flex gap-4 pt-6">
                  <button type="button" onClick={() => { setIsRenewModalOpen(false); setEditingClient(null); }} className="flex-1 py-4 text-zinc-600 font-black uppercase text-[10px]">Sair</button>
                  <button type="submit" className="flex-1 bg-emerald-500 text-black py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl active:scale-95 transition-all">Zerar Dias</button>
                </div>
             </form>
          </div>
        </div>
      )}

      {/* MODAL: NOVO CLIENTE */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-6 backdrop-blur-md overflow-y-auto no-scrollbar">
          <div className="bg-zinc-900 border border-white/5 w-full max-w-md rounded-[3rem] p-10 shadow-2xl my-auto text-white">
            <h3 className="text-2xl font-black mb-8 text-center italic tracking-tighter uppercase tracking-[0.1em]">NOVO <span className="text-amber-500 text-3xl font-black">CLIENTE</span></h3>
            <form onSubmit={saveClient} className="space-y-5">
              <input required placeholder="Nome Completo" value={newName} onChange={e => setNewName(e.target.value)} className="w-full bg-black border border-white/10 rounded-2xl p-5 outline-none focus:border-amber-500 font-bold text-white shadow-xl" />
              <input required placeholder="WhatsApp (DDD + Número)" value={newPhone} onChange={e => setNewPhone(e.target.value)} className="w-full bg-black border border-white/10 rounded-2xl p-5 outline-none focus:border-amber-500 text-white" />
              <div className="grid grid-cols-2 gap-4">
                <input type="number" placeholder="Valor R$" value={newPrice} onChange={e => setNewPrice(e.target.value)} className="w-full bg-black border border-white/10 rounded-2xl p-5 outline-none focus:border-amber-500 font-black text-emerald-500" />
                <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} className="w-full bg-black border border-white/10 rounded-2xl p-5 outline-none focus:border-amber-500 text-xs text-white" />
              </div>
              <div className="flex gap-2">
                {['Cabelo', 'Barba', 'Sobrancelha'].map(s => (
                  <button key={s} type="button" onClick={() => setSelectedServices(p => p.includes(s) ? p.filter(x => x !== s) : [...p, s])} className={cn("flex-1 py-4 rounded-2xl text-[9px] font-black uppercase border transition-all", selectedServices.includes(s) ? "bg-amber-500 border-amber-500 text-black" : "bg-black border-white/10 text-zinc-600")}>{s}</button>
                ))}
              </div>
              <div className="flex gap-4 pt-6">
                <button type="button" onClick={() => { setIsModalOpen(false); setEditingClient(null); }} className="flex-1 py-5 text-zinc-600 font-black uppercase text-[10px]">Cancelar</button>
                <button type="submit" className="flex-1 bg-amber-500 text-black py-5 rounded-2xl font-black uppercase text-[10px] shadow-2xl active:scale-95 transition-all">Salvar Cliente</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EXCLUIR DEFINITIVO */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-black/95 z-[80] flex items-center justify-center p-6 backdrop-blur-2xl text-white">
          <div className="bg-zinc-900 border border-red-500/20 w-full max-w-sm rounded-[3rem] p-10 text-center shadow-2xl animate-in zoom-in duration-200">
             <div className="w-20 h-20 bg-red-500/10 text-red-500 rounded-[2rem] flex items-center justify-center mx-auto mb-6"><Trash2 size={40} /></div>
             <h3 className="text-2xl font-black mb-2 tracking-tighter uppercase italic">Apagar Para Sempre?</h3>
             <p className="text-zinc-500 text-[10px] mb-8 uppercase font-bold tracking-widest leading-relaxed">Isso removerá o cliente da tela inicial, da pasta de históricos e de todas as estatísticas de faturamento e ranking.<br/><span className="text-red-500 font-black">NÃO HÁ VOLTA.</span></p>
             <div className="flex flex-col gap-3">
               <button onClick={executeDelete} className="w-full bg-red-600 text-white py-5 rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg">Confirmar e Apagar</button>
               <button onClick={() => setIsDeleteModalOpen(false)} className="w-full py-4 text-zinc-600 font-black uppercase text-[10px]">Cancelar</button>
             </div>
          </div>
        </div>
      )}

      {/* MODAL: PERFIL */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-8 backdrop-blur-2xl text-white">
          <div className="bg-zinc-900 border border-white/10 w-full max-w-sm rounded-[3rem] p-10 text-center shadow-3xl">
            <h3 className="text-2xl font-black mb-2 tracking-tight uppercase italic tracking-widest">Acesso ao Painel</h3>
            <input autoFocus placeholder="Seu Nome" value={userName} onChange={e => setUserName(e.target.value)} className="w-full bg-black border border-white/10 rounded-2xl p-5 mb-6 text-center font-bold text-white outline-none focus:border-amber-500 transition-all" />
            <button onClick={updateProfile} className="w-full bg-amber-500 text-black py-5 rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 transition-all shadow-lg">Confirmar</button>
          </div>
        </div>
      )}
    </div>
  );
}
