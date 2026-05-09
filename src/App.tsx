import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, UserPlus, MessageSquare, Search, Trash2, 
  Scissors, LogOut, Loader2, RefreshCw, CheckSquare, 
  Square, User as UserIcon, TrendingUp, Wallet, 
  ChevronDown, AlertCircle, FolderClock, Flame, Trophy, Award, Filter
} from 'lucide-react';
import { format, differenceInDays, parseISO, startOfDay, subDays } from 'date-fns';
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
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isHistoryView, setIsHistoryView] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterPeriod, setFilterPeriod] = useState('month');
  const [rankingSort, setRankingSort] = useState<'streak' | 'spent' | 'cabelo' | 'barba' | 'sobrancelha'>('streak');

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
    let prevName = editingClient?.previous_name || null;
    let nextStreak = 1;

    if (editingClient) {
      // Se mudar o nome agora, o nome antigo do card atual vira o "previous_name"
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
      await fetchClients();
    }
  };

  const resetForm = () => {
    setNewName(''); setNewPhone(''); setNewPrice(''); setSelectedServices([]);
    setNewDate(format(new Date(), 'yyyy-MM-dd'));
  };

  const executeDelete = async () => {
    await supabase.from('clientes').delete().in('phone', phonesToDelete);
    setIsDeleteModalOpen(false); setIsSelectionMode(false); setSelectedPhones([]);
    await fetchClients();
  };

  const openRenewModal = (client: any) => {
    setEditingClient(client); setNewName(client.name); setNewPhone(client.phone);
    setNewPrice(client.price.toString()); setSelectedServices(client.services);
    setNewDate(format(new Date(), 'yyyy-MM-dd')); setIsRenewModalOpen(true);
  };

  const { dashboardList, historyList } = useMemo(() => {
    const sorted = [...allRecords].sort((a, b) => parseISO(b.last_visit).getTime() - parseISO(a.last_visit).getTime());
    const latestMap = new Map();
    const history: any[] = [];
    sorted.forEach(r => {
      if (!latestMap.has(r.phone)) latestMap.set(r.phone, r);
      else history.push(r);
    });
    return { dashboardList: Array.from(latestMap.values()), historyList: history };
  }, [allRecords]);

  const rankingList = useMemo(() => {
    const clientsMap = new Map();
    allRecords.forEach(r => {
      const current = clientsMap.get(r.phone) || { name: r.name, phone: r.phone, spent: 0, streak: 0, cabelo: 0, barba: 0, sobrancelha: 0 };
      current.spent += r.price;
      current.streak = Math.max(current.streak, r.streak_count);
      if (r.services.includes('Cabelo')) current.cabelo++;
      if (r.services.includes('Barba')) current.barba++;
      if (r.services.includes('Sobrancelha')) current.sobrancelha++;
      clientsMap.set(r.phone, current);
    });
    return Array.from(clientsMap.values()).sort((a: any, b: any) => {
      if (rankingSort === 'streak') return b.streak - a.streak;
      if (rankingSort === 'spent') return b.spent - a.spent;
      return b[rankingSort] - a[rankingSort];
    });
  }, [allRecords, rankingSort]);

  const stats = useMemo(() => {
    const range = { 'today': startOfDay(new Date()), 'week': subDays(new Date(), 7), 'month': subDays(new Date(), 30), 'all': new Date(0) }[filterPeriod] || new Date(0);
    const periodRecords = allRecords.filter(c => parseISO(c.last_visit) >= range);
    const faturamento = periodRecords.reduce((acc, curr) => acc + curr.price, 0);
    const needsRecovery = dashboardList.filter(c => differenceInDays(new Date(), parseISO(c.last_visit)) >= 20).length;
    return { total: dashboardList.length, needsRecovery, faturamento, fidelity: dashboardList.length > 0 ? Math.round(((dashboardList.length - needsRecovery) / dashboardList.length) * 100) : 0 };
  }, [allRecords, dashboardList, filterPeriod]);

  const getStreakColor = (count: number) => {
    if (count < 10) return 'text-white';
    if (count < 20) return 'text-yellow-400 drop-shadow-[0_0_5px_rgba(250,204,21,1)]';
    if (count < 30) return 'text-[#00ff41] drop-shadow-[0_0_8px_rgba(0,255,65,1)]';
    if (count < 40) return 'text-[#00f3ff] drop-shadow-[0_0_8px_rgba(0,243,255,1)]';
    if (count < 50) return 'text-[#ff00ff] drop-shadow-[0_0_8px_rgba(255,0,255,1)]';
    return 'animate-text-rainbow font-black';
  };

  if (authLoading) return <div className="min-h-screen bg-[#050505] flex items-center justify-center text-amber-500 font-black italic text-xl animate-pulse">BARBER PRO</div>;

  if (!session) return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6">
      <form onSubmit={async (e) => { e.preventDefault(); const {error} = await supabase.auth.signInWithPassword({email, password}); if(error) setLoginError('Login inválido'); }} className="bg-zinc-900/50 p-10 rounded-[3rem] border border-white/5 space-y-6 w-full max-w-sm shadow-2xl backdrop-blur-xl">
        <div className="w-20 h-20 bg-amber-500 rounded-[2rem] flex items-center justify-center mx-auto shadow-2xl"><Scissors className="text-black w-10 h-10" /></div>
        <h1 className="text-4xl font-black text-white italic tracking-tighter text-center">BARBER <span className="text-amber-500">PRO</span></h1>
        {loginError && <p className="text-red-500 text-[10px] text-center font-black uppercase tracking-widest">{loginError}</p>}
        <input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="E-mail" className="w-full bg-black border border-white/10 rounded-2xl p-5 outline-none focus:border-amber-500 text-white" />
        <input required type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Senha" className="w-full bg-black border border-white/10 rounded-2xl p-5 outline-none focus:border-amber-500 text-white" />
        <button className="w-full bg-amber-500 text-black py-5 rounded-2xl font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all">Acessar Painel</button>
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

      {/* HEADER PREMIUM */}
      <header className="sticky top-0 z-40 px-6 lg:px-16 h-24 flex items-center justify-between bg-[#050505]/95 backdrop-blur-3xl border-b border-white/5">
        <div className="flex items-center gap-4">
          <button onClick={() => setIsProfileModalOpen(true)} className="w-12 h-12 bg-zinc-900 border border-white/10 rounded-2xl flex items-center justify-center text-zinc-400 hover:text-amber-500 transition-all shadow-inner"><UserIcon size={20} /></button>
          <div>
            <p className="text-[10px] font-black text-amber-500 uppercase tracking-[0.2em] leading-none mb-1">Olá, {userName.split(' ')[0]}!</p>
            <h1 className="text-xl lg:text-3xl font-black tracking-tighter italic leading-none">{isHistoryView ? 'PASTA RENOVADOS' : 'PAINEL PREMIUM'}</h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setIsRankingOpen(true)} className="p-3 bg-zinc-900 border border-white/5 text-amber-500 rounded-xl hover:bg-amber-500 hover:text-black transition-all shadow-lg"><Trophy size={20} /></button>
          <button onClick={() => setIsHistoryView(!isHistoryView)} className={cn("p-3 rounded-xl border border-white/5 transition-all", isHistoryView ? "bg-amber-500 text-black shadow-amber-500/20" : "bg-zinc-900 text-zinc-500")}><FolderClock size={20} /></button>
          <button onClick={() => { resetForm(); setIsModalOpen(true); }} className="bg-amber-500 text-black px-6 py-3 rounded-2xl font-black text-xs hover:scale-105 active:scale-95 transition-all shadow-xl shadow-amber-500/10 flex items-center gap-2"><UserPlus size={18} /> <span className="hidden sm:inline">CADASTRAR</span></button>
          <button onClick={() => supabase.auth.signOut()} className="p-3 text-zinc-700 hover:text-red-500 transition-colors"><LogOut size={20} /></button>
        </div>
      </header>

      <main className="p-6 lg:p-16 max-w-[1400px] mx-auto space-y-10 pb-40">
        {!isHistoryView && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="col-span-2 bg-gradient-to-br from-zinc-900 to-black border border-white/10 p-8 rounded-[3rem] relative overflow-hidden shadow-2xl">
              <TrendingUp className="absolute top-0 right-0 p-8 opacity-5" size={120} />
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em] mb-3">Fidelidade dos Clientes</p>
              <div className="flex items-end gap-4">
                <p className="text-6xl lg:text-8xl font-black text-amber-500 tracking-tighter">{stats.fidelity}%</p>
                <p className="text-zinc-500 text-sm mb-3 font-black italic underline decoration-amber-500/40 tracking-widest uppercase">Performance</p>
              </div>
            </div>
            <div className="bg-zinc-900/40 border border-white/5 p-8 rounded-[2.5rem] shadow-xl flex flex-col justify-center backdrop-blur-md">
              <p className="text-[10px] text-red-500 font-black uppercase tracking-widest mb-2">Recuperar</p>
              <p className="text-4xl lg:text-6xl font-black text-red-500 tracking-tighter">{stats.needsRecovery}</p>
            </div>
            <div className="bg-zinc-900/40 border border-white/5 p-8 rounded-[2.5rem] shadow-xl flex flex-col justify-center backdrop-blur-md">
              <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest mb-2">Faturamento</p>
              <p className="text-3xl lg:text-5xl font-black text-emerald-500 tracking-tighter">R$ {stats.faturamento}</p>
            </div>
          </div>
        )}

        {/* BUSCA E FILTRO OTIMIZADO PARA PC */}
        <div className="flex flex-col lg:flex-row gap-6 items-center">
          <div className="relative flex-1 group w-full">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-600 group-focus-within:text-amber-500 transition-all" />
            <input type="text" placeholder="Localizar cliente..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-zinc-900/40 border border-white/10 rounded-3xl pl-16 pr-8 py-5 outline-none focus:border-amber-500/40 text-lg font-medium text-white shadow-inner" />
          </div>
          <div className="relative w-full lg:w-auto">
            <select value={filterPeriod} onChange={(e) => setFilterPeriod(e.target.value)} className="appearance-none bg-zinc-900 border border-white/10 rounded-3xl px-10 py-5 pr-16 text-[11px] font-black uppercase tracking-widest outline-none focus:border-amber-500/50 w-full lg:w-auto cursor-pointer shadow-xl">
              <option value="today">Período: Hoje</option>
              <option value="week">Período: 7 Dias</option>
              <option value="month">Período: 30 Dias</option>
              <option value="all">Todo o Período</option>
            </select>
            <ChevronDown size={16} className="absolute right-8 top-1/2 -translate-y-1/2 text-zinc-500" />
          </div>
        </div>

        {/* GRID DE CARDS (PC: 3 Colunas) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {(isHistoryView ? historyList : dashboardList)
            .filter(c => (c.name || '').toLowerCase().includes(searchTerm.toLowerCase()))
            .map(c => {
              const days = differenceInDays(startOfDay(new Date()), parseISO(c.last_visit));
              const isSel = selectedPhones.includes(c.phone);
              return (
                <div key={c.id} className={cn("bg-zinc-900/30 border rounded-[3rem] p-7 flex flex-col justify-between transition-all hover:bg-zinc-900/50 hover:border-white/10", isSel ? "border-amber-500 bg-amber-500/5 shadow-[0_0_30px_rgba(217,119,6,0.1)]" : "border-white/5")}>
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex items-center gap-5">
                      {isSelectionMode ? (
                        <button onClick={() => setSelectedPhones(p => isSel ? p.filter(x => x !== c.phone) : [...p, c.phone])}>
                          {isSel ? <div className="w-8 h-8 bg-amber-500 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/20"><CheckSquare size={18} className="text-black" /></div> : <div className="w-8 h-8 border-2 border-zinc-800 rounded-xl hover:border-amber-500/50 transition-colors" />}
                        </button>
                      ) : (
                        <div className="relative">
                          <div className="w-16 h-16 bg-gradient-to-br from-zinc-800 to-zinc-900 rounded-2xl flex items-center justify-center text-amber-500 font-black text-2xl border border-white/10 shadow-inner">{c.name?.[0]?.toUpperCase()}</div>
                          {c.streak_count >= 2 && !isHistoryView && (
                            <div className={cn("absolute -top-3 -right-3 flex items-center gap-1 bg-black px-2.5 py-1 rounded-full border border-white/20 text-[11px] font-black shadow-2xl", getStreakColor(c.streak_count))}>
                              <Flame size={12} className="fill-current" /> {c.streak_count}
                            </div>
                          )}
                        </div>
                      )}
                      <div>
                        <p className="font-black text-xl text-white/95 leading-none">{c.name}</p>
                        {c.previous_name && <span className="text-[10px] text-zinc-500 block italic font-bold mt-1 tracking-tight">Anteriormente {c.previous_name}</span>}
                        <p className="text-[11px] text-zinc-500 font-black uppercase tracking-widest mt-2">R$ {c.price} • {c.services?.join(' + ')}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={cn("text-3xl font-black tracking-tighter leading-none", days >= 20 ? "text-red-500" : "text-amber-500")}>{days}d</p>
                      <p className="text-[9px] text-zinc-700 font-black uppercase mt-1 tracking-widest">Atraso</p>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-6 border-t border-white/5">
                    {!isHistoryView && (
                      <button onClick={() => openRenewModal(c)} className="flex-1 py-4 bg-emerald-500/10 text-emerald-500 rounded-2xl hover:bg-emerald-500 hover:text-black transition-all flex justify-center items-center gap-2 font-black text-[10px] uppercase tracking-widest"><RefreshCw size={18} /> Renovar</button>
                    )}
                    <a href={`https://wa.me/55${c.phone}`} target="_blank" className="flex-1 py-4 bg-amber-500 text-black rounded-2xl hover:scale-[1.02] transition-all flex justify-center items-center gap-2 font-black text-[10px] uppercase tracking-widest shadow-lg shadow-amber-500/10"><MessageSquare size={18} /> WhatsApp</a>
                    <button onClick={() => { setPhonesToDelete([c.phone]); setIsDeleteModalOpen(true); }} className="p-4 bg-red-500/10 text-red-500 rounded-2xl hover:bg-red-500 hover:text-white transition-all"><Trash2 size={18} /></button>
                  </div>
                </div>
              );
            })}
        </div>
      </main>

      {/* MODO SELEÇÃO PC (FLUTUANTE) */}
      {isSelectionMode && selectedPhones.length > 0 && (
        <div className="fixed bottom-12 left-0 right-0 px-6 z-50 flex justify-center">
          <button onClick={() => { setPhonesToDelete(selectedPhones); setIsDeleteModalOpen(true); }} className="max-w-xl w-full bg-red-600 text-white py-6 rounded-[3rem] font-black uppercase tracking-[0.2em] text-xs shadow-[0_20px_50px_rgba(220,38,38,0.4)] animate-bounce">Apagar {selectedPhones.length} Registros e Históricos</button>
        </div>
      )}

      {/* MODAL: RANKING COM GAVETA (DROPDOWN) */}
      {isRankingOpen && (
        <div className="fixed inset-0 bg-black/95 z-[70] flex items-center justify-center p-6 backdrop-blur-3xl">
          <div className="bg-zinc-900 border border-white/5 w-full max-w-2xl rounded-[3rem] p-10 lg:p-14 shadow-2xl text-white">
             <div className="flex items-center justify-between mb-10">
                <div className="flex items-center gap-5">
                  <div className="w-16 h-16 bg-amber-500 text-black rounded-2xl flex items-center justify-center shadow-2xl"><Trophy size={32} /></div>
                  <h3 className="text-3xl font-black italic tracking-tighter uppercase">Elite da Barbearia</h3>
                </div>
                <button onClick={() => setIsRankingOpen(false)} className="p-3 bg-zinc-800 rounded-xl text-zinc-500 hover:text-white transition-colors">Fechar</button>
             </div>

             {/* GAVETA DE FILTRO (DROPDOWN) */}
             <div className="mb-8 space-y-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Ordenar Rank por:</label>
                <div className="relative">
                  <select 
                    value={rankingSort} 
                    onChange={(e) => setRankingSort(e.target.value as any)}
                    className="w-full bg-black border border-white/10 rounded-2xl px-6 py-5 pr-14 appearance-none outline-none focus:border-amber-500 font-black uppercase text-xs tracking-widest cursor-pointer"
                  >
                    <option value="streak">🔥 Sequência (Streak)</option>
                    <option value="spent">💰 Investimento Total</option>
                    <option value="cabelo">✂️ Serviços de Cabelo</option>
                    <option value="barba">🧔 Serviços de Barba</option>
                    <option value="sobrancelha">✨ Sobrancelhas</option>
                  </select>
                  <Filter size={16} className="absolute right-6 top-1/2 -translate-y-1/2 text-amber-500 pointer-events-none" />
                </div>
             </div>

             <div className="space-y-3 max-h-[45vh] overflow-y-auto pr-3 no-scrollbar">
                {rankingList.map((client: any, idx) => (
                  <div key={client.phone} className="bg-black/30 border border-white/5 rounded-3xl p-6 flex items-center justify-between">
                     <div className="flex items-center gap-5">
                        <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center font-black text-lg", idx === 0 ? "bg-amber-500 text-black shadow-[0_0_20px_rgba(234,179,8,0.3)]" : idx === 1 ? "bg-zinc-300 text-black" : idx === 2 ? "bg-amber-800 text-white" : "bg-zinc-800 text-zinc-600")}>
                          {idx + 1}º
                        </div>
                        <div>
                          <p className="font-black text-lg leading-none">{client.name}</p>
                          <p className="text-[10px] font-black text-zinc-600 uppercase mt-1 tracking-widest">WhatsApp: {client.phone}</p>
                        </div>
                     </div>
                     <div className="text-right">
                        <p className="text-2xl font-black text-amber-500 tracking-tighter">
                          {rankingSort === 'spent' ? `R$ ${client.spent}` : rankingSort === 'streak' ? `${client.streak}x` : `${client[rankingSort]}x`}
                        </p>
                        <p className="text-[9px] font-black text-zinc-700 uppercase tracking-widest">{rankingSort === 'spent' ? 'Gasto total' : 'Atendimentos'}</p>
                     </div>
                  </div>
                ))}
             </div>
          </div>
        </div>
      )}

      {/* MODAL: RENOVAR ATENDIMENTO */}
      {isRenewModalOpen && (
        <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-6 backdrop-blur-2xl">
          <div className="bg-zinc-900 border border-white/10 w-full max-w-md rounded-[3rem] p-10 shadow-3xl my-auto text-white">
             <div className="w-16 h-16 bg-emerald-500/10 text-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-6"><RefreshCw size={32} /></div>
             <h3 className="text-2xl font-black mb-1 text-center tracking-tight uppercase">Renovação de Elite</h3>
             <p className="text-zinc-500 text-[10px] text-center mb-8 uppercase font-bold tracking-widest leading-tight">Sequência de Corte #{ (editingClient?.streak_count || 1) + 1 }</p>
             
             <form onSubmit={saveClient} className="space-y-4">
                <input required value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nome do Cliente" className="w-full bg-black border border-white/10 rounded-2xl p-4 outline-none focus:border-amber-500 font-bold text-white shadow-inner" />
                <input required value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="Número WhatsApp" className="w-full bg-black border border-white/10 rounded-2xl p-4 outline-none focus:border-amber-500 text-white shadow-inner" />
                <div className="grid grid-cols-2 gap-4">
                   <input type="number" value={newPrice} onChange={e => setNewPrice(e.target.value)} placeholder="Valor R$" className="w-full bg-black border border-white/10 rounded-2xl p-4 outline-none focus:border-amber-500 font-black text-emerald-500" />
                   <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} className="w-full bg-black border border-white/10 rounded-2xl p-4 outline-none focus:border-amber-500 text-xs text-white" />
                </div>
                <div className="flex gap-2">
                  {['Cabelo', 'Barba', 'Sobrancelha'].map(s => (
                    <button key={s} type="button" onClick={() => setSelectedServices(p => p.includes(s) ? p.filter(x => x !== s) : [...p, s])} className={cn("flex-1 py-3 rounded-xl text-[10px] font-black uppercase border transition-all", selectedServices.includes(s) ? "bg-amber-500 border-amber-500 text-black shadow-lg shadow-amber-500/20" : "bg-black border-white/10 text-zinc-600")}>{s}</button>
                  ))}
                </div>
                <div className="flex gap-4 pt-6">
                  <button type="button" onClick={() => setIsRenewModalOpen(false)} className="flex-1 py-4 text-zinc-600 font-black uppercase text-[10px] tracking-widest">Sair</button>
                  <button type="submit" className="flex-1 bg-emerald-500 text-black py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-emerald-500/20 active:scale-95 transition-all">Zerar Dias</button>
                </div>
             </form>
          </div>
        </div>
      )}

      {/* MODAL: NOVO CLIENTE */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-6 backdrop-blur-md overflow-y-auto no-scrollbar">
          <div className="bg-zinc-900 border border-white/10 w-full max-w-md rounded-[3rem] p-10 shadow-2xl my-auto text-white">
            <h3 className="text-2xl font-black mb-8 text-center italic tracking-tighter uppercase tracking-[0.1em]">NOVO <span className="text-amber-500 text-3xl font-black">CLIENTE</span></h3>
            <form onSubmit={saveClient} className="space-y-5">
              <input required placeholder="Nome Completo" value={newName} onChange={e => setNewName(e.target.value)} className="w-full bg-black border border-white/10 rounded-2xl p-5 outline-none focus:border-amber-500 transition-all font-bold text-white" />
              <input required placeholder="Número WhatsApp (Ex: 459999-9999)" value={newPhone} onChange={e => setNewPhone(e.target.value)} className="w-full bg-black border border-white/10 rounded-2xl p-5 outline-none focus:border-amber-500 transition-all text-white" />
              <div className="grid grid-cols-2 gap-4">
                <input type="number" placeholder="Valor R$" value={newPrice} onChange={e => setNewPrice(e.target.value)} className="w-full bg-black border border-white/10 rounded-2xl p-5 outline-none focus:border-amber-500 font-black text-emerald-500" />
                <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} className="w-full bg-black border border-white/10 rounded-2xl p-5 outline-none focus:border-amber-500 transition-all text-xs text-white" />
              </div>
              <div className="flex gap-2">
                {['Cabelo', 'Barba', 'Sobrancelha'].map(s => (
                  <button key={s} type="button" onClick={() => setSelectedServices(p => p.includes(s) ? p.filter(x => x !== s) : [...p, s])} className={cn("flex-1 py-4 rounded-2xl text-[9px] font-black uppercase border transition-all", selectedServices.includes(s) ? "bg-amber-500 border-amber-500 text-black shadow-lg shadow-amber-500/20" : "bg-black border-white/10 text-zinc-600")}>{s}</button>
                ))}
              </div>
              <div className="flex gap-4 pt-6">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-5 text-zinc-600 font-black uppercase text-[10px] tracking-widest">Cancelar</button>
                <button type="submit" className="flex-1 bg-amber-500 text-black py-5 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-2xl active:scale-95 transition-all">Salvar Cliente</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EXCLUIR */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-black/95 z-[80] flex items-center justify-center p-6 backdrop-blur-2xl text-white">
          <div className="bg-zinc-900 border border-red-500/20 w-full max-w-sm rounded-[3rem] p-10 text-center shadow-2xl animate-in zoom-in duration-200">
             <div className="w-20 h-20 bg-red-500/10 text-red-500 rounded-[2rem] flex items-center justify-center mx-auto mb-6"><Trash2 size={40} /></div>
             <h3 className="text-2xl font-black mb-2 tracking-tighter uppercase italic">Apagar Definitivamente?</h3>
             <p className="text-zinc-500 text-[10px] mb-8 uppercase font-bold tracking-widest leading-relaxed">Você está apagando {phonesToDelete.length} cliente(s) e TODO o histórico de atendimentos.<br/><span className="text-red-500/50 font-black uppercase">Não há volta.</span></p>
             <div className="flex flex-col gap-3">
               <button onClick={executeDelete} className="w-full bg-red-600 text-white py-5 rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg active:scale-95 transition-all">Confirmar Exclusão</button>
               <button onClick={() => setIsDeleteModalOpen(false)} className="w-full py-4 text-zinc-600 font-black uppercase text-[10px]">Cancelar</button>
             </div>
          </div>
        </div>
      )}

      {/* MODAL: PERFIL */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-8 backdrop-blur-2xl text-white">
          <div className="bg-zinc-900 border border-white/10 w-full max-w-sm rounded-[3rem] p-10 text-center shadow-2xl">
            <h3 className="text-2xl font-black mb-2 tracking-tight uppercase italic tracking-widest">Acesso ao Painel</h3>
            <p className="text-zinc-500 text-[10px] mb-8 uppercase font-bold tracking-widest">Para personalizar seu Barber Pro</p>
            <input autoFocus placeholder="Seu Nome" value={userName} onChange={e => setUserName(e.target.value)} className="w-full bg-black border border-white/10 rounded-2xl p-5 mb-6 text-center font-bold text-white outline-none focus:border-amber-500 transition-all" />
            <button onClick={updateProfile} className="w-full bg-amber-500 text-black py-5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-amber-500/10 active:scale-95 transition-all">Confirmar Nome</button>
          </div>
        </div>
      )}
    </div>
  );
}
