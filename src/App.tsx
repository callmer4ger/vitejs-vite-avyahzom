import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, UserPlus, MessageSquare, Search, Trash2, 
  Scissors, LogOut, Loader2, RefreshCw, CheckSquare, 
  Square, User as UserIcon, TrendingUp, Wallet, 
  ChevronDown, AlertCircle, FolderClock, Flame
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
  
  const [allRecords, setAllRecords] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isRenewModalOpen, setIsRenewModalOpen] = useState(false);
  const [isHistoryView, setIsHistoryView] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPeriod, setFilterPeriod] = useState('month');
  
  const [editingClient, setEditingClient] = useState<any>(null);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [newDate, setNewDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedPhones, setSelectedPhones] = useState<string[]>([]);
  const [phonesToDelete, setPhonesToDelete] = useState<string[]>([]);

  const professionalTitle = useMemo(() => {
    if (!userName) return 'Barbeiro';
    const name = userName.trim().split(' ')[0].toLowerCase();
    const fem = ['scarlett', 'fran', 'franciele', 'francielle', 'francine', 'beatriz', 'raquel', 'helen', 'iris', 'elis', 'vivian', 'ruth', 'ester', 'judite', 'miriam', 'sueli', 'cleide', 'solange', 'ivone', 'ariel', 'michele', 'beatriz'];
    return (name.endsWith('a') || name.endsWith('elle') || name.startsWith('franci') || fem.includes(name)) ? 'Barbeira' : 'Barbeiro';
  }, [userName]);

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
    else { setIsProfileModalOpen(true); }
  };

  const updateProfile = async () => {
    if (!userName.trim() || !session) return;
    await supabase.from('profiles').upsert({ id: session.user.id, full_name: userName.trim() });
    setIsProfileModalOpen(false);
  };

  const fetchClients = async () => {
    if (!session) return;
    const { data } = await supabase.from('clientes').select('*').order('last_visit', { ascending: false });
    if (data) setAllRecords(data.map(c => ({ ...c, price: Number(c.price) || 0, services: c.services || [] })));
  };

  useEffect(() => { fetchClients(); }, [session]);

  const saveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    const phone = newPhone.replace(/\D/g, '');
    
    // Lógica de Nome Anterior
    let prevName = null;
    if (editingClient && editingClient.name !== newName) {
      prevName = editingClient.name;
    }

    const payload = {
      name: newName,
      phone: phone,
      last_visit: newDate,
      user_id: session.user.id,
      services: selectedServices,
      price: Number(newPrice) || 0,
      previous_name: prevName
    };

    const { error } = (isRenewModalOpen) 
      ? await supabase.from('clientes').insert([payload]) // Cria novo registro para histórico
      : editingClient 
        ? await supabase.from('clientes').update(payload).eq('id', editingClient.id)
        : await supabase.from('clientes').insert([payload]);

    if (!error) {
      setIsModalOpen(false);
      setIsRenewModalOpen(false);
      setEditingClient(null);
      resetForm();
      fetchClients();
    }
  };

  const executeDelete = async () => {
    // Ao apagar do dashboard, apagamos TODOS os registros desse telefone para não voltarem da pasta
    const { error } = await supabase.from('clientes').delete().in('phone', phonesToDelete);
    if (!error) {
      setIsDeleteModalOpen(false);
      setIsSelectionMode(false);
      setSelectedPhones([]);
      fetchClients();
    }
  };

  const resetForm = () => {
    setNewName(''); setNewPhone(''); setNewPrice(''); setSelectedServices([]);
    setNewDate(format(new Date(), 'yyyy-MM-dd'));
  };

  const openRenewModal = (client: any) => {
    setEditingClient(client);
    setNewName(client.name);
    setNewPhone(client.phone); // Mantém o número original
    setNewPrice(client.price.toString());
    setSelectedServices(client.services);
    setNewDate(format(new Date(), 'yyyy-MM-dd'));
    setIsRenewModalOpen(true);
  };

  const { dashboardList, historyList, streaks } = useMemo(() => {
    const sorted = [...allRecords].sort((a, b) => parseISO(b.last_visit).getTime() - parseISO(a.last_visit).getTime());
    const latestMap = new Map();
    const history: any[] = [];
    const counts: Record<string, number> = {};

    sorted.forEach(record => {
      counts[record.phone] = (counts[record.phone] || 0) + 1;
      if (!latestMap.has(record.phone)) {
        latestMap.set(record.phone, record);
      } else {
        history.push(record);
      }
    });

    return { dashboardList: Array.from(latestMap.values()), historyList: history, streaks: counts };
  }, [allRecords]);

  const stats = useMemo(() => {
    const range = { 'today': startOfDay(new Date()), 'week': subDays(new Date(), 7), 'month': subDays(new Date(), 30), '90days': subDays(new Date(), 90), 'all': new Date(0) }[filterPeriod] || new Date(0);
    const periodRecords = allRecords.filter(c => parseISO(c.last_visit) >= range);
    const faturamento = periodRecords.reduce((acc, curr) => acc + (Number(curr.price) || 0), 0);
    const needsRecovery = dashboardList.filter(c => differenceInDays(new Date(), parseISO(c.last_visit)) >= 20).length;
    return { total: dashboardList.length, needsRecovery, faturamento, fidelity: dashboardList.length > 0 ? Math.round(((dashboardList.length - needsRecovery) / dashboardList.length) * 100) : 0 };
  }, [allRecords, dashboardList, filterPeriod]);

  const getStreakColor = (count: number) => {
    if (count < 10) return 'text-white';
    if (count < 20) return 'text-yellow-400 drop-shadow-[0_0_5px_rgba(250,204,21,1)]';
    if (count < 30) return 'text-[#00ff41] drop-shadow-[0_0_8px_rgba(0,255,65,1)]'; // Verde Matrix
    if (count < 40) return 'text-[#00f3ff] drop-shadow-[0_0_8px_rgba(0,243,255,1)]'; // Azul Neon
    if (count < 50) return 'text-[#ff00ff] drop-shadow-[0_0_8px_rgba(255,0,255,1)]'; // Rosa Neon
    return 'animate-text-rainbow font-black';
  };

  if (authLoading) return <div className="min-h-screen bg-[#050505] flex items-center justify-center text-amber-500 font-black italic text-2xl animate-pulse tracking-tighter">BARBER PRO</div>;

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-amber-500/30 overflow-x-hidden">
      <style>{`
        @keyframes text-rainbow {
          0% { color: #ff0000; text-shadow: 0 0 10px #ff0000; }
          25% { color: #00ff00; text-shadow: 0 0 10px #00ff00; }
          50% { color: #0000ff; text-shadow: 0 0 10px #0000ff; }
          75% { color: #ff00ff; text-shadow: 0 0 10px #ff00ff; }
          100% { color: #ff0000; text-shadow: 0 0 10px #ff0000; }
        }
        .animate-text-rainbow { animation: text-rainbow 2s linear infinite; }
      `}</style>

      <header className="sticky top-0 z-40 px-6 h-24 flex items-center justify-between bg-[#050505]/90 backdrop-blur-2xl border-b border-white/5">
        <div className="flex items-center gap-4">
          <button onClick={() => setIsProfileModalOpen(true)} className="w-12 h-12 bg-zinc-900 border border-white/10 rounded-2xl flex items-center justify-center text-zinc-400 hover:text-amber-500 transition-all"><UserIcon size={20} /></button>
          <div>
            <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest leading-none mb-1">{professionalTitle}: {userName || '...'}</p>
            <h1 className="text-lg font-black tracking-tighter italic leading-none">{isHistoryView ? 'PASTA: RENOVADOS' : 'DASHBOARD PREMIUM'}</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setIsHistoryView(!isHistoryView)} className={cn("p-3 rounded-xl transition-all shadow-lg", isHistoryView ? "bg-amber-500 text-black" : "bg-zinc-900 text-zinc-500")}>
            <FolderClock size={20} />
          </button>
          <button onClick={() => { resetForm(); setEditingClient(null); setIsModalOpen(true); }} className="bg-amber-500 text-black p-3 rounded-xl shadow-lg active:scale-95 transition-all"><UserPlus size={20} /></button>
          <button onClick={() => supabase.auth.signOut()} className="p-3 text-zinc-700 hover:text-red-500 transition-colors"><LogOut size={20} /></button>
        </div>
      </header>

      <main className="p-6 max-w-2xl mx-auto space-y-8 pb-32">
        {!isHistoryView && (
          <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-4 duration-700">
            <div className="col-span-2 bg-gradient-to-br from-zinc-900 to-black border border-white/5 p-6 rounded-[2.5rem] relative overflow-hidden shadow-2xl">
              <div className="absolute top-0 right-0 p-6 opacity-10"><TrendingUp size={60} /></div>
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-2">Taxa de Retenção</p>
              <div className="flex items-end gap-3">
                <p className="text-6xl font-black text-amber-500 tracking-tighter">{stats.fidelity}%</p>
                <p className="text-zinc-500 text-xs mb-2 font-bold italic decoration-amber-500 underline">Fidelidade Pro</p>
              </div>
            </div>
            <div className="bg-zinc-900/50 border border-white/5 p-5 rounded-[2rem] shadow-xl">
              <p className="text-[9px] text-red-500 font-black uppercase tracking-widest mb-1">Recuperar</p>
              <p className="text-3xl font-black text-red-500">{stats.needsRecovery}</p>
            </div>
            <div className="bg-zinc-900/50 border border-white/5 p-5 rounded-[2rem] shadow-xl">
              <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest mb-1">Ganhos</p>
              <p className="text-2xl font-black text-emerald-500 tracking-tighter italic">R$ {stats.faturamento}</p>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 group">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 group-focus-within:text-amber-500 transition-all" />
            <input type="text" placeholder="Localizar cliente..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-zinc-900/50 border border-white/5 rounded-2xl pl-14 pr-6 py-4 outline-none focus:border-amber-500/30 text-sm font-medium" />
          </div>
          <div className="relative">
            <select value={filterPeriod} onChange={(e) => setFilterPeriod(e.target.value)} className="appearance-none bg-zinc-900 border border-white/10 rounded-2xl px-6 py-4 pr-12 text-[10px] font-black uppercase tracking-widest outline-none focus:border-amber-500/50 w-full sm:w-auto cursor-pointer">
              <option value="today">Hoje</option>
              <option value="week">7 Dias</option>
              <option value="month">30 Dias</option>
              <option value="90days">90 Dias</option>
              <option value="all">Todo Período</option>
            </select>
            <ChevronDown size={14} className="absolute right-5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between px-2 text-zinc-600">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em]">{isHistoryView ? 'Histórico de Atendimentos' : 'Clientes em Atividade'}</h3>
            <button onClick={() => setIsSelectionMode(!isSelectionMode)} className="text-[9px] font-black uppercase tracking-widest hover:text-amber-500 transition-all">
              {isSelectionMode ? "Concluir" : "Excluir Vários"}
            </button>
          </div>

          {(isHistoryView ? historyList : dashboardList)
            .filter(c => (c.name || '').toLowerCase().includes(searchTerm.toLowerCase()))
            .map(c => {
              const streak = streaks[c.phone] || 1;
              const days = differenceInDays(startOfDay(new Date()), parseISO(c.last_visit));
              const isSel = selectedPhones.includes(c.phone);
              return (
                <div key={c.id} className={cn("bg-zinc-900/30 border rounded-[2.5rem] p-5 flex items-center justify-between transition-all group", isSel ? "border-amber-500 bg-amber-500/5" : "border-white/5")}>
                  <div className="flex items-center gap-4">
                    {isSelectionMode ? (
                      <button onClick={() => setSelectedPhones(prev => isSel ? prev.filter(p => p !== c.phone) : [...prev, c.phone])}>
                        {isSel ? <div className="w-6 h-6 bg-amber-500 rounded-lg flex items-center justify-center"><CheckSquare size={14} className="text-black" /></div> : <div className="w-6 h-6 border-2 border-zinc-800 rounded-lg" />}
                      </button>
                    ) : (
                      <div className="relative">
                        <div className="w-12 h-12 bg-zinc-800 border border-white/5 rounded-2xl flex items-center justify-center text-amber-500 font-black text-lg">{c.name?.[0]?.toUpperCase()}</div>
                        <div className={cn("absolute -top-2 -right-2 flex items-center gap-0.5 bg-black/80 px-2 py-0.5 rounded-full border border-white/10 text-[10px] font-black shadow-xl", getStreakColor(streak))}>
                          <Flame size={10} className="fill-current" /> {streak}
                        </div>
                      </div>
                    )}
                    <div>
                      <p className="font-black text-base tracking-tight text-white/90 leading-none">
                        {c.name} {c.previous_name && <span className="text-[10px] text-zinc-600 block italic font-medium">(anteriormente {c.previous_name})</span>}
                      </p>
                      <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-tighter mt-1.5">R$ {c.price} • {c.services?.join(' + ') || 'Corte'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className={cn("text-2xl font-black tracking-tighter leading-none", days >= 20 ? "text-red-500" : "text-amber-500")}>{days}d</p>
                      <p className="text-[8px] text-zinc-700 font-black uppercase mt-1">Atraso</p>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {!isHistoryView && <button onClick={() => openRenewModal(c)} className="p-3 bg-emerald-500/10 text-emerald-500 rounded-xl hover:bg-emerald-500/20 transition-all"><RefreshCw size={16} /></button>}
                      <a href={`https://wa.me/55${c.phone}`} target="_blank" rel="noopener noreferrer" className="p-3 bg-amber-500 text-black rounded-xl hover:scale-110 transition-all shadow-lg shadow-amber-500/10"><MessageSquare size={16} /></a>
                      <button onClick={() => { setPhonesToDelete([c.phone]); setIsDeleteModalOpen(true); }} className="p-3 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500/20 transition-all"><Trash2 size={16} /></button>
                    </div>
                  </div>
                </div>
              );
            })}
        </div>

        {isSelectionMode && selectedPhones.length > 0 && (
          <div className="fixed bottom-8 left-0 right-0 px-6 z-50 flex justify-center">
            <button onClick={() => { setPhonesToDelete(selectedPhones); setIsDeleteModalOpen(true); }} className="max-w-md w-full bg-red-600 text-white py-5 rounded-[2.5rem] font-black uppercase tracking-widest text-[10px] shadow-2xl animate-bounce">Apagar {selectedPhones.length} Selecionados</button>
          </div>
        )}
      </main>

      {/* MODAL: RENOVAR ATENDIMENTO */}
      {isRenewModalOpen && (
        <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-6 backdrop-blur-2xl overflow-y-auto no-scrollbar">
          <div className="bg-zinc-900 border border-white/10 w-full max-w-md rounded-[3rem] p-10 shadow-3xl my-auto text-white">
             <div className="w-16 h-16 bg-emerald-500/10 text-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-6"><RefreshCw size={32} /></div>
             <h3 className="text-2xl font-black mb-1 text-center tracking-tight uppercase">Renovação de Cliente</h3>
             <p className="text-zinc-500 text-[10px] text-center mb-8 uppercase font-bold tracking-widest leading-tight">O registro atual irá para a pasta "Renovados"</p>
             
             <form onSubmit={saveClient} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-zinc-600 uppercase ml-2 tracking-widest">Nome (Alterável)</label>
                  <input required value={newName} onChange={e => setNewName(e.target.value)} className="w-full bg-black border border-white/10 rounded-2xl p-4 outline-none focus:border-amber-500 transition-all font-bold text-white" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-zinc-600 uppercase ml-2 tracking-widest">Número (Travado)</label>
                  <input readOnly value={newPhone} className="w-full bg-zinc-800/50 border border-white/5 rounded-2xl p-4 outline-none text-zinc-500 font-bold" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-1">
                      <label className="text-[9px] font-black text-zinc-600 uppercase ml-2 tracking-widest">Valor R$</label>
                      <input type="number" value={newPrice} onChange={e => setNewPrice(e.target.value)} className="w-full bg-black border border-white/10 rounded-2xl p-4 outline-none focus:border-amber-500 font-black text-emerald-500 transition-all" />
                   </div>
                   <div className="space-y-1">
                      <label className="text-[9px] font-black text-zinc-600 uppercase ml-2 tracking-widest italic text-amber-500">Data (Mini Calendário)</label>
                      <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} className="w-full bg-black border border-white/10 rounded-2xl p-4 outline-none focus:border-amber-500 text-xs text-white" />
                   </div>
                </div>
                <div className="space-y-2">
                   <label className="text-[9px] font-black text-zinc-600 uppercase ml-2 tracking-widest">Serviços da Vez</label>
                   <div className="flex gap-2">
                    {['Cabelo', 'Barba', 'Sobrancelha'].map(s => (
                      <button key={s} type="button" onClick={() => setSelectedServices(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])} className={cn("flex-1 py-3 rounded-xl text-[9px] font-black uppercase border transition-all", selectedServices.includes(s) ? "bg-amber-500 border-amber-500 text-black shadow-lg shadow-amber-500/20" : "bg-black border-white/10 text-zinc-600")}>{s}</button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-4 pt-6">
                  <button type="button" onClick={() => setIsRenewModalOpen(false)} className="flex-1 py-4 text-zinc-600 font-black uppercase text-[10px]">Sair</button>
                  <button type="submit" className="flex-1 bg-emerald-500 text-black py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg active:scale-95 transition-all">Zerar Dias</button>
                </div>
             </form>
          </div>
        </div>
      )}

      {/* MODAL: EXCLUIR CLIENTE (EMBUTIDO) */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-black/95 z-[60] flex items-center justify-center p-6 backdrop-blur-2xl">
          <div className="bg-zinc-900 border border-red-500/20 w-full max-w-sm rounded-[3rem] p-10 text-center shadow-2xl animate-in zoom-in duration-200 text-white">
             <div className="w-20 h-20 bg-red-500/10 text-red-500 rounded-[2rem] flex items-center justify-center mx-auto mb-6"><Trash2 size={40} /></div>
             <h3 className="text-2xl font-black mb-2 tracking-tighter uppercase italic">Limpar Registro?</h3>
             <p className="text-zinc-500 text-[10px] mb-8 uppercase font-bold tracking-widest leading-relaxed">Você está apagando o cliente e TODO o histórico dele.<br/><span className="text-red-500/50 font-black">Isso limpará as estatísticas permanentemente.</span></p>
             <div className="flex flex-col gap-3">
               <button onClick={executeDelete} className="w-full bg-red-600 text-white py-5 rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg">Confirmar Exclusão</button>
               <button onClick={() => setIsDeleteModalOpen(false)} className="w-full py-4 text-zinc-600 font-black uppercase text-[10px]">Cancelar</button>
             </div>
          </div>
        </div>
      )}

      {/* MODAL: NOVO CLIENTE */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-6 backdrop-blur-md overflow-y-auto no-scrollbar">
          <div className="bg-zinc-900 border border-white/5 w-full max-w-md rounded-[3rem] p-10 shadow-2xl my-auto text-white">
            <h3 className="text-2xl font-black mb-8 text-center italic tracking-tighter uppercase">NOVO <span className="text-amber-500 text-3xl">CLIENTE</span></h3>
            <form onSubmit={saveClient} className="space-y-5">
              <div className="space-y-1">
                <label className="text-[9px] font-black text-zinc-600 uppercase ml-2 tracking-widest">Nome</label>
                <input required placeholder="Nome Completo" value={newName} onChange={e => setNewName(e.target.value)} className="w-full bg-black border border-white/10 rounded-2xl p-5 outline-none focus:border-amber-500 transition-all font-bold text-white" />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-zinc-600 uppercase ml-2 tracking-widest">Número</label>
                <input required placeholder="Formato (459999-9999)" value={newPhone} onChange={e => setNewPhone(e.target.value)} className="w-full bg-black border border-white/10 rounded-2xl p-5 outline-none focus:border-amber-500 transition-all text-white" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-zinc-600 uppercase ml-2 tracking-widest">Valor R$</label>
                  <input type="number" placeholder="50" value={newPrice} onChange={e => setNewPrice(e.target.value)} className="w-full bg-black border border-white/10 rounded-2xl p-5 outline-none focus:border-amber-500 font-black text-emerald-500" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-zinc-600 uppercase ml-2 tracking-widest italic text-amber-500">Data (Mini Calendário)</label>
                  <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} className="w-full bg-black border border-white/10 rounded-2xl p-5 outline-none focus:border-amber-500 text-xs text-white" />
                </div>
              </div>
              <div className="flex gap-2">
                {['Cabelo', 'Barba', 'Sobrancelha'].map(s => (
                  <button key={s} type="button" onClick={() => setSelectedServices(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])} className={cn("flex-1 py-4 rounded-2xl text-[9px] font-black uppercase border transition-all", selectedServices.includes(s) ? "bg-amber-500 border-amber-500 text-black shadow-lg shadow-amber-500/20" : "bg-black border-white/10 text-zinc-600")}>{s}</button>
                ))}
              </div>
              <div className="flex gap-4 pt-6">
                <button type="button" onClick={() => { setIsModalOpen(false); setEditingClient(null); }} className="flex-1 py-5 text-zinc-600 font-black uppercase text-[10px]">Cancelar</button>
                <button type="submit" className="flex-1 bg-amber-500 text-black py-5 rounded-[1.5rem] font-black uppercase text-[10px] active:scale-95 shadow-xl shadow-amber-500/10">Salvar Atendimento</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: PERFIL */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-8 backdrop-blur-2xl">
          <div className="bg-zinc-900 border border-white/10 w-full max-w-sm rounded-[3rem] p-10 text-center shadow-3xl text-white">
            <h3 className="text-2xl font-black mb-2 tracking-tight uppercase italic tracking-widest">Configuração de Perfil</h3>
            <p className="text-zinc-500 text-[10px] mb-8 uppercase font-bold tracking-widest">Defina seu nome profissional</p>
            <input autoFocus placeholder="Ex: Barbeiro" value={userName} onChange={e => setUserName(e.target.value)} className="w-full bg-black border border-white/10 rounded-2xl p-5 mb-6 text-center font-bold text-white outline-none focus:border-amber-500 transition-all" />
            <button onClick={updateProfile} className="w-full bg-amber-500 text-black py-5 rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 shadow-lg shadow-amber-500/20">Confirmar</button>
          </div>
        </div>
      )}
    </div>
  );
}
