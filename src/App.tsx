import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, UserPlus, MessageSquare, Search, Trash2, 
  Scissors, LogOut, Loader2, RefreshCw, CheckSquare, 
  Square, User as UserIcon, TrendingUp, Wallet, 
  ChevronDown, AlertCircle, X
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
  
  const [clients, setClients] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isRenewModalOpen, setIsRenewModalOpen] = useState(false);
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
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [idsToDelete, setIdsToDelete] = useState<string[]>([]);

  const professionalTitle = useMemo(() => {
    if (!userName) return 'Barbeiro';
    const name = userName.trim().split(' ')[0].toLowerCase();
    const feminineExceptions = ['scarlett', 'fran', 'beatriz', 'raquel', 'helen', 'iris', 'elis', 'vivian', 'ruth', 'ester', 'judite', 'miriam', 'sueli', 'cleide', 'solange', 'ivone', 'ariel', 'michele'];
    const isFemininePattern = name.endsWith('a') || name.endsWith('elle') || name.endsWith('ele') || name.endsWith('ine') || name.startsWith('franci') || feminineExceptions.includes(name);
    return isFemininePattern ? 'Barbeira' : 'Barbeiro';
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
    try {
      const { data } = await supabase.from('profiles').select('full_name').eq('id', userId).maybeSingle();
      if (data?.full_name) { setUserName(data.full_name); setIsProfileModalOpen(false); }
      else { setIsProfileModalOpen(true); }
    } catch (e) { setIsProfileModalOpen(true); }
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
      setClients(data.map(c => ({
        ...c,
        last_visit: c.last_visit || new Date().toISOString(),
        services: Array.isArray(c.services) ? c.services : [],
        price: Number(c.price) || 0
      })));
    }
  };

  useEffect(() => { fetchClients(); }, [session]);

  const saveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: newName,
      phone: newPhone.replace(/\D/g, ''),
      last_visit: newDate,
      user_id: session.user.id,
      services: selectedServices,
      price: Number(newPrice) || 0
    };

    const { error } = editingClient 
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

  const confirmDelete = (ids: string[]) => {
    setIdsToDelete(ids);
    setIsDeleteModalOpen(true);
  };

  const executeDelete = async () => {
    if (idsToDelete.length === 0) return;
    const { error } = await supabase.from('clientes').delete().in('id', idsToDelete);
    if (!error) {
      setIsDeleteModalOpen(false);
      setIsSelectionMode(false);
      setSelectedClients([]);
      setIdsToDelete([]);
      fetchClients();
    }
  };

  const resetForm = () => {
    setNewName(''); setNewPhone(''); setNewPrice(''); setSelectedServices([]);
    setNewDate(format(new Date(), 'yyyy-MM-dd'));
  };

  const openRenewModal = (client: any) => {
    setEditingClient(client);
    setNewName(client.name || '');
    setNewPhone(client.phone || '');
    setNewPrice(client.price?.toString() || '0');
    setSelectedServices(client.services || []);
    setNewDate(format(new Date(), 'yyyy-MM-dd'));
    setIsRenewModalOpen(true);
  };

  const stats = useMemo(() => {
    const total = clients.length;
    const needsRecovery = clients.filter(c => differenceInDays(new Date(), parseISO(c.last_visit)) >= 20).length;
    const range = { 'today': startOfDay(new Date()), 'week': subDays(new Date(), 7), 'month': subDays(new Date(), 30), '90days': subDays(new Date(), 90), 'all': new Date(0) }[filterPeriod] || new Date(0);
    const faturamento = clients.filter(c => parseISO(c.last_visit) >= range).reduce((acc, curr) => acc + (Number(curr.price) || 0), 0);
    return { total, needsRecovery, faturamento, fidelity: total > 0 ? Math.round(((total - needsRecovery) / total) * 100) : 0 };
  }, [clients, filterPeriod]);

  if (authLoading) return <div className="min-h-screen bg-[#050505] flex items-center justify-center text-amber-500 font-black italic uppercase tracking-widest">BARBER PRO...</div>;

  if (!session) return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-10 text-white">
        <div className="text-center space-y-4">
          <div className="w-20 h-20 bg-amber-500 rounded-[2rem] flex items-center justify-center mx-auto shadow-lg shadow-amber-500/20"><Scissors className="text-black w-10 h-10" /></div>
          <h1 className="text-4xl font-black italic tracking-tighter uppercase">BARBER <span className="text-amber-500">PRO</span></h1>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); supabase.auth.signInWithPassword({ email, password }); }} className="bg-zinc-900 p-8 rounded-[2rem] border border-white/5 space-y-4 shadow-2xl">
          <input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="E-mail" className="w-full bg-black border border-white/10 rounded-2xl p-4 outline-none focus:border-amber-500" />
          <input required type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Senha" className="w-full bg-black border border-white/10 rounded-2xl p-4 outline-none focus:border-amber-500" />
          <button className="w-full bg-amber-500 text-black py-4 rounded-2xl font-black">ENTRAR</button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-amber-500/30">
      <header className="sticky top-0 z-40 px-6 h-24 flex items-center justify-between bg-[#050505]/90 backdrop-blur-2xl border-b border-white/5">
        <div className="flex items-center gap-4">
          <button onClick={() => setIsProfileModalOpen(true)} className="w-12 h-12 bg-zinc-900 border border-white/10 rounded-2xl flex items-center justify-center text-zinc-400 hover:text-amber-500 transition-all"><UserIcon size={20} /></button>
          <div>
            <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest leading-none mb-1">{professionalTitle}: {userName || '...'}</p>
            <h1 className="text-lg font-black tracking-tighter italic leading-none">DASHBOARD <span className="text-amber-500">PREMIUM</span></h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => { resetForm(); setEditingClient(null); setIsModalOpen(true); }} className="bg-amber-500 text-black px-5 py-3 rounded-2xl font-black text-xs flex items-center gap-2 shadow-lg shadow-amber-500/10 active:scale-95 transition-all"><UserPlus size={18} /> <span className="hidden sm:inline uppercase">Novo Cliente</span></button>
          <button onClick={() => supabase.auth.signOut()} className="p-3 text-zinc-700 hover:text-red-500 transition-colors"><LogOut size={20} /></button>
        </div>
      </header>

      <main className="p-6 max-w-2xl mx-auto space-y-8 pb-32">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 bg-gradient-to-br from-zinc-900 to-black border border-white/5 p-6 rounded-[2.5rem] relative overflow-hidden shadow-2xl">
            <div className="absolute top-0 right-0 p-6 opacity-10"><TrendingUp size={60} /></div>
            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-2">Taxa de Retenção</p>
            <div className="flex items-end gap-3">
              <p className="text-6xl font-black text-amber-500 tracking-tighter">{stats.fidelity}%</p>
              <p className="text-zinc-500 text-xs mb-2 font-bold italic">Fidelidade Pro</p>
            </div>
          </div>
          <div className="bg-zinc-900/50 border border-white/5 p-5 rounded-[2rem] flex flex-col justify-between">
            <p className="text-[9px] text-red-500 font-black uppercase tracking-widest mb-1">Recuperar</p>
            <p className="text-3xl font-black text-red-500">{stats.needsRecovery}</p>
          </div>
          <div className="bg-zinc-900/50 border border-white/5 p-5 rounded-[2rem] flex flex-col justify-between">
            <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest mb-1">Ganhos</p>
            <p className="text-2xl font-black text-emerald-500 tracking-tighter italic">R$ {stats.faturamento}</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 group">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 group-focus-within:text-amber-500 transition-colors" />
            <input type="text" placeholder="Localizar barbeiro..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-zinc-900/50 border border-white/5 rounded-2xl pl-14 pr-6 py-4 outline-none focus:border-amber-500/30 transition-all text-sm font-medium" />
          </div>
          <div className="relative">
            <select value={filterPeriod} onChange={(e) => setFilterPeriod(e.target.value)} className="appearance-none bg-zinc-900 border border-white/10 rounded-2xl px-6 py-4 pr-12 text-[10px] font-black uppercase tracking-widest outline-none focus:border-amber-500/50 w-full sm:w-auto">
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
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em]">Gestão de Retornos</h3>
            <button onClick={() => setIsSelectionMode(!isSelectionMode)} className="text-[9px] font-black uppercase tracking-widest hover:text-amber-500 transition-all">
              {isSelectionMode ? "Concluir" : "Excluir Vários"}
            </button>
          </div>

          {clients.filter(c => (c.name || '').toLowerCase().includes(searchTerm.toLowerCase())).map(c => {
            const days = differenceInDays(new Date(), parseISO(c.last_visit));
            const isSel = selectedClients.includes(c.id);
            return (
              <div key={c.id} className={cn("bg-zinc-900/30 border rounded-[2rem] p-5 flex items-center justify-between transition-all group", isSel ? "border-amber-500 bg-amber-500/5 shadow-[0_0_20px_rgba(217,119,6,0.1)]" : "border-white/5")}>
                <div className="flex items-center gap-4">
                  {isSelectionMode ? (
                    <button onClick={() => setSelectedClients(prev => isSel ? prev.filter(id => id !== c.id) : [...prev, c.id])}>
                      {isSel ? <div className="w-6 h-6 bg-amber-500 rounded-lg flex items-center justify-center"><CheckSquare size={14} className="text-black" /></div> : <div className="w-6 h-6 border-2 border-zinc-800 rounded-lg" />}
                    </button>
                  ) : (
                    <div className="w-12 h-12 bg-gradient-to-br from-zinc-800 to-zinc-900 border border-white/5 rounded-2xl flex items-center justify-center text-amber-500 font-black text-lg">{c.name?.[0]?.toUpperCase()}</div>
                  )}
                  <div>
                    <p className="font-black text-base tracking-tight text-white/90 leading-none">{c.name}</p>
                    <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-tighter mt-1.5">R$ {c.price} • {c.services?.join(' + ') || 'Atendimento'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className={cn("text-2xl font-black tracking-tighter leading-none", days >= 20 ? "text-red-500" : "text-amber-500")}>{days}d</p>
                    <p className="text-[8px] text-zinc-700 font-black uppercase mt-1">Atraso</p>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <button onClick={() => openRenewModal(c)} className="p-3 bg-emerald-500/10 text-emerald-500 rounded-xl hover:bg-emerald-500/20 transition-all shadow-sm"><RefreshCw size={16} /></button>
                    <a href={`https://wa.me/55${c.phone}`} target="_blank" rel="noopener noreferrer" className="p-3 bg-amber-500 text-black rounded-xl hover:scale-105 transition-all shadow-lg shadow-amber-500/10"><MessageSquare size={16} /></a>
                    <button onClick={() => confirmDelete([c.id])} className="p-3 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500/20 transition-all"><Trash2 size={16} /></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {isSelectionMode && selectedClients.length > 0 && (
          <div className="fixed bottom-8 left-0 right-0 px-6 z-50 flex justify-center">
            <button onClick={() => confirmDelete(selectedClients)} className="max-w-md w-full bg-red-600 text-white py-5 rounded-[2rem] font-black uppercase tracking-widest text-[10px] shadow-[0_10px_30px_rgba(220,38,38,0.3)] animate-bounce">Apagar Selecionados ({selectedClients.length})</button>
          </div>
        )}
      </main>

      {/* MODAL: RENOVAR / EDITAR (Zerar Dias) */}
      {isRenewModalOpen && (
        <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-6 backdrop-blur-2xl">
          <div className="bg-zinc-900 border border-white/10 w-full max-w-md rounded-[3rem] p-10 shadow-3xl">
             <div className="w-16 h-16 bg-emerald-500/10 text-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-6"><RefreshCw size={32} /></div>
             <h3 className="text-2xl font-black mb-1 text-center tracking-tight uppercase">Renovar Atendimento</h3>
             <p className="text-zinc-500 text-[10px] text-center mb-8 uppercase font-bold tracking-widest leading-tight">Zerar o tempo e atualizar os serviços</p>
             <form onSubmit={saveClient} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-zinc-600 uppercase ml-2 tracking-widest">Nome do Cliente</label>
                  <input required value={newName} onChange={e => setNewName(e.target.value)} className="w-full bg-black border border-white/10 rounded-2xl p-4 outline-none focus:border-amber-500 transition-all font-bold text-white" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-zinc-600 uppercase ml-2 tracking-widest">Número</label>
                  <input required value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="Formato (459999-9999)" className="w-full bg-black border border-white/10 rounded-2xl p-4 outline-none focus:border-amber-500 transition-all text-white" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-1">
                      <label className="text-[9px] font-black text-zinc-600 uppercase ml-2 tracking-widest">Valor R$</label>
                      <input type="number" value={newPrice} onChange={e => setNewPrice(e.target.value)} className="w-full bg-black border border-white/10 rounded-2xl p-4 outline-none focus:border-amber-500 transition-all font-black text-emerald-500" />
                   </div>
                   <div className="space-y-1">
                      <label className="text-[9px] font-black text-zinc-600 uppercase ml-2 tracking-widest italic">Data (Calendário)</label>
                      <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} className="w-full bg-black border border-white/10 rounded-2xl p-4 outline-none focus:border-amber-500 transition-all text-xs text-white" />
                   </div>
                </div>
                <div className="space-y-2">
                   <label className="text-[9px] font-black text-zinc-600 uppercase ml-2 tracking-widest">Serviços Realizados</label>
                   <div className="flex gap-2">
                    {['Cabelo', 'Barba', 'Sobrancelha'].map(s => (
                      <button key={s} type="button" onClick={() => setSelectedServices(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])} className={cn("flex-1 py-3 rounded-xl text-[9px] font-black uppercase border transition-all", selectedServices.includes(s) ? "bg-amber-500 border-amber-500 text-black shadow-lg shadow-amber-500/20" : "bg-black border-white/10 text-zinc-600")}>{s}</button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-4 pt-6">
                  <button type="button" onClick={() => { setIsRenewModalOpen(false); setEditingClient(null); }} className="flex-1 py-4 text-zinc-600 font-black uppercase text-[10px] tracking-[0.2em]">Sair</button>
                  <button type="submit" className="flex-1 bg-emerald-500 text-black py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-emerald-500/20">Zerar Dias</button>
                </div>
             </form>
          </div>
        </div>
      )}

      {/* MODAL: EXCLUIR (Confirmar Janela Embutida) */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-black/95 z-[60] flex items-center justify-center p-6 backdrop-blur-2xl">
          <div className="bg-zinc-900 border border-red-500/20 w-full max-w-sm rounded-[3rem] p-10 text-center shadow-[0_0_50px_rgba(220,38,38,0.15)] animate-in zoom-in duration-200">
             <div className="w-20 h-20 bg-red-500/10 text-red-500 rounded-[2rem] flex items-center justify-center mx-auto mb-6"><Trash2 size={40} /></div>
             <h3 className="text-2xl font-black mb-2 tracking-tighter uppercase italic">Confirmar Exclusão?</h3>
             <p className="text-zinc-500 text-[10px] mb-8 uppercase font-bold tracking-widest leading-relaxed">Essa ação é permanente e removerá {idsToDelete.length} cliente(s) do seu banco de dados. <br/><span className="text-red-500/50">Não há como desfazer.</span></p>
             <div className="flex flex-col gap-3">
               <button onClick={executeDelete} className="w-full bg-red-600 text-white py-5 rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg shadow-red-600/20">Sim, Excluir Agora</button>
               <button onClick={() => setIsDeleteModalOpen(false)} className="w-full py-4 text-zinc-600 font-black uppercase text-[10px] tracking-widest">Cancelar</button>
             </div>
          </div>
        </div>
      )}

      {/* MODAL: NOVO CLIENTE */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-6 backdrop-blur-md">
          <div className="bg-zinc-900 border border-white/5 w-full max-w-md rounded-[3rem] p-10 shadow-2xl">
            <h3 className="text-2xl font-black mb-8 text-center italic tracking-tighter uppercase tracking-[0.1em]">NOVO <span className="text-amber-500 text-3xl">CLIENTE</span></h3>
            <form onSubmit={saveClient} className="space-y-5">
              <div className="space-y-1">
                <label className="text-[9px] font-black text-zinc-600 uppercase ml-2 tracking-widest text-white">Nome</label>
                <input required placeholder="Nome Completo" value={newName} onChange={e => setNewName(e.target.value)} className="w-full bg-black border border-white/10 rounded-2xl p-5 outline-none focus:border-amber-500 transition-all font-bold text-white" />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-zinc-600 uppercase ml-2 tracking-widest text-white">Número</label>
                <input required placeholder="Formato (459999-9999)" value={newPhone} onChange={e => setNewPhone(e.target.value)} className="w-full bg-black border border-white/10 rounded-2xl p-5 outline-none focus:border-amber-500 transition-all text-white" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-zinc-600 uppercase ml-2 tracking-widest text-white">Valor R$</label>
                  <input type="number" placeholder="50" value={newPrice} onChange={e => setNewPrice(e.target.value)} className="w-full bg-black border border-white/10 rounded-2xl p-5 outline-none focus:border-amber-500 font-black text-emerald-500" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-zinc-600 uppercase ml-2 tracking-widest italic text-white">Data (Calendário)</label>
                  <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} className="w-full bg-black border border-white/10 rounded-2xl p-5 outline-none focus:border-amber-500 transition-all text-xs text-white" />
                </div>
              </div>
              <div className="space-y-2">
                  <label className="text-[9px] font-black text-zinc-600 uppercase ml-2 tracking-widest text-white">Serviços</label>
                  <div className="flex gap-2">
                    {['Cabelo', 'Barba', 'Sobrancelha'].map(s => (
                      <button key={s} type="button" onClick={() => setSelectedServices(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])} className={cn("flex-1 py-4 rounded-2xl text-[9px] font-black uppercase border transition-all", selectedServices.includes(s) ? "bg-amber-500 border-amber-500 text-black shadow-lg shadow-amber-500/20" : "bg-black border-white/10 text-zinc-600")}>{s}</button>
                    ))}
                  </div>
              </div>
              <div className="flex gap-4 pt-6">
                <button type="button" onClick={() => { setIsModalOpen(false); setEditingClient(null); }} className="flex-1 py-5 text-zinc-600 font-black uppercase text-[10px] tracking-[0.2em]">Cancelar</button>
                <button type="submit" className="flex-1 bg-amber-500 text-black py-5 rounded-[1.5rem] font-black uppercase text-[10px] tracking-widest shadow-xl shadow-amber-500/10 active:scale-95 transition-all">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: PERFIL */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-8 backdrop-blur-2xl">
          <div className="bg-zinc-900 border border-white/10 w-full max-w-sm rounded-[3rem] p-10 text-center shadow-3xl">
            <h3 className="text-2xl font-black mb-2 tracking-tight uppercase italic tracking-widest">Meu Perfil</h3>
            <p className="text-zinc-500 text-[10px] mb-8 uppercase font-bold tracking-widest">Identifique-se no sistema</p>
            <input autoFocus placeholder="Ex: Barbeiro" value={userName} onChange={e => setUserName(e.target.value)} className="w-full bg-black border border-white/10 rounded-2xl p-5 mb-6 text-center font-bold text-white outline-none focus:border-amber-500 transition-all" />
            <button onClick={updateProfile} className="w-full bg-amber-500 text-black py-5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-amber-500/20 active:scale-95 transition-all">Salvar Perfil</button>
          </div>
        </div>
      )}
    </div>
  );
}
