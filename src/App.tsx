import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, UserPlus, MessageSquare, Search, AlertCircle, Trash2, 
  Scissors, LogOut, Mail, Lock, Loader2, RefreshCw, CheckSquare, 
  Square, TrendingUp, DollarSign, User as UserIcon
} from 'lucide-react';
import { format, differenceInDays, parseISO, startOfDay, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from './lib/supabase';

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [userName, setUserName] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [clients, setClients] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPeriod, setFilterPeriod] = useState('all');

  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [newDate, setNewDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedClients, setSelectedClients] = useState<string[]>([]);

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
    const { data } = await supabase.from('profiles').select('full_name').eq('id', userId).single();
    if (data) setUserName(data.full_name);
    else setIsProfileModalOpen(true); // Abre se for o primeiro login
  };

  const updateProfile = async () => {
    if (!userName || !session) return;
    const { error } = await supabase.from('profiles').upsert({ id: session.user.id, full_name: userName });
    if (!error) setIsProfileModalOpen(false);
  };

  import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, UserPlus, MessageSquare, Search, AlertCircle, Trash2, 
  Scissors, LogOut, Mail, Lock, Loader2, RefreshCw, CheckSquare, 
  Square, TrendingUp, DollarSign, User as UserIcon
} from 'lucide-react';
import { format, differenceInDays, parseISO, startOfDay, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from './lib/supabase';

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [userName, setUserName] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [clients, setClients] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPeriod, setFilterPeriod] = useState('all');

  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [newDate, setNewDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedClients, setSelectedClients] = useState<string[]>([]);

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
    const { data } = await supabase.from('profiles').select('full_name').eq('id', userId).single();
    if (data) setUserName(data.full_name);
    else setIsProfileModalOpen(true); // Abre se for o primeiro login
  };

  const updateProfile = async () => {
    if (!userName || !session) return;
    const { error } = await supabase.from('profiles').upsert({ id: session.user.id, full_name: userName });
    if (!error) setIsProfileModalOpen(false);
  };

  const fetchClients = async () => {
    if (!session) return;
    const { data } = await supabase.from('clientes').select('*').order('last_visit', { ascending: false });
    if (data) setClients(data);
  };

  useEffect(() => { fetchClients(); }, [session]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setLoginError('E-mail ou senha incorretos.');
    setIsLoggingIn(false);
  };

  const addClient = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from('clientes').insert([{
      name: newName, phone: newPhone.replace(/\D/g, ''), last_visit: newDate,
      user_id: session.user.id, services: selectedServices, price: Number(newPrice) || 0
    }]);
    if (!error) {
      setIsModalOpen(false);
      setNewName(''); setNewPhone(''); setNewPrice(''); setSelectedServices([]);
      fetchClients();
    }
  };

  const deleteClients = async (ids: string[]) => {
    if (!window.confirm("Essa ação não pode ser desfeita. Deseja excluir?")) return;
    await supabase.from('clientes').delete().in('id', ids);
    setIsSelectionMode(false);
    setSelectedClients([]);
    fetchClients();
  };

  const refreshClientVisit = async (id: string) => {
    const today = new Date().toISOString().split('T')[0];
    await supabase.from('clientes').update({ last_visit: today }).eq('id', id);
    setTimeout(fetchClients, 300);
  };

  const stats = useMemo(() => {
    const total = clients.length;
    const needsRecovery = clients.filter(c => differenceInDays(new Date(), parseISO(c.last_visit)) >= 20).length;
    const fidelity = total > 0 ? Math.round(((total - needsRecovery) / total) * 100) : 0;
    return { total, needsRecovery, fidelity };
  }, [clients]);

  const faturamento = useMemo(() => {
    const range = { 'today': startOfDay(new Date()), 'week': subDays(new Date(), 7), 'month': subDays(new Date(), 30), 'all': new Date(0) }[filterPeriod] || new Date(0);
    return clients.filter(c => parseISO(c.last_visit) >= range).reduce((acc, curr) => acc + (Number(curr.price) || 0), 0);
  }, [clients, filterPeriod]);

  if (authLoading) return <div className="min-h-screen bg-black flex items-center justify-center"><Loader2 className="text-amber-500 animate-spin w-10 h-10" /></div>;

  if (!session) return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="w-20 h-20 bg-amber-500 rounded-[2rem] flex items-center justify-center shadow-2xl shadow-amber-500/20 mx-auto mb-6">
            <Scissors className="text-black w-10 h-10" />
          </div>
          <h1 className="text-4xl font-black tracking-tighter italic">BARBER <span className="text-amber-500">PRO</span></h1>
          <p className="text-zinc-500 mt-2 font-medium">Gestão Premium Cascavel</p>
        </div>
        <form onSubmit={handleLogin} className="bg-zinc-900/50 border border-white/5 p-8 rounded-[2.5rem] space-y-4 shadow-2xl">
          {loginError && <div className="bg-red-500/10 text-red-500 p-4 rounded-xl text-xs flex items-center gap-2"><AlertCircle size={14}/> {loginError}</div>}
          <input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Seu e-mail" className="w-full bg-black/50 p-4 rounded-2xl border border-white/10 focus:border-amber-500 outline-none transition-all" />
          <input required type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Sua senha" className="w-full bg-black/50 p-4 rounded-2xl border border-white/10 focus:border-amber-500 outline-none transition-all" />
          <button className="w-full bg-amber-500 text-black py-4 rounded-2xl font-black text-lg hover:bg-amber-400 transition-all active:scale-95 shadow-xl shadow-amber-500/10">ENTRAR NO SISTEMA</button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white selection:bg-amber-500/30">
      <header className="border-b border-white/5 bg-zinc-900/80 backdrop-blur-md sticky top-0 z-30 px-6 h-20 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/20"><Scissors size={20} className="text-black" /></div>
          <div>
             <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest leading-none">Olá, {userName || 'Barbeiro'}!</p>
             <h1 className="text-xl font-black tracking-tighter">BARBER <span className="text-amber-500">PRO</span></h1>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setIsProfileModalOpen(true)} className="p-2 text-zinc-500 hover:text-amber-500 transition-colors"><UserIcon size={20} /></button>
          <button onClick={() => setIsSelectionMode(!isSelectionMode)} className={cn("px-4 py-2 rounded-full text-[10px] font-black transition-all", isSelectionMode ? "bg-amber-500 text-black" : "bg-zinc-800 text-zinc-500")}>
            {isSelectionMode ? "CANCELAR" : "SELECIONAR"}
          </button>
          <button onClick={() => setIsModalOpen(true)} className="bg-amber-500 text-black px-4 py-2 rounded-full font-black text-xs shadow-lg shadow-amber-500/10 hover:scale-105 transition-all"><UserPlus size={16} /></button>
          <button onClick={() => supabase.auth.signOut()} className="text-zinc-600 hover:text-red-500 ml-2"><LogOut size={20} /></button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 py-8 space-y-6">
        {/* Dashboard de Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-zinc-900 border border-white/5 p-4 rounded-3xl">
             <p className="text-[10px] text-zinc-500 font-bold uppercase mb-1">Total</p>
             <p className="text-2xl font-black">{stats.total}</p>
          </div>
          <div className="bg-zinc-900 border border-white/5 p-4 rounded-3xl">
             <p className="text-[10px] text-red-500 font-bold uppercase mb-1">Recuperar</p>
             <p className="text-2xl font-black text-red-500">{stats.needsRecovery}</p>
          </div>
          <div className="bg-zinc-900 border border-white/5 p-4 rounded-3xl">
             <p className="text-[10px] text-emerald-500 font-bold uppercase mb-1">Fidelidade</p>
             <p className="text-2xl font-black text-emerald-500">{stats.fidelity}%</p>
          </div>
          <div className="bg-zinc-900 border border-emerald-500/20 p-4 rounded-3xl shadow-lg shadow-emerald-500/5">
             <p className="text-[10px] text-zinc-500 font-bold uppercase mb-1">Faturamento ({filterPeriod})</p>
             <p className="text-2xl font-black text-emerald-500">R$ {faturamento}</p>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
          {['today', 'week', 'month', 'all'].map(p => (
            <button key={p} onClick={() => setFilterPeriod(p)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${filterPeriod === p ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' : 'bg-zinc-900 text-zinc-500 border border-white/5'}`}>
              {p === 'today' ? 'Hoje' : p === 'week' ? '7 Dias' : p === 'month' ? 'Mês' : 'Todo Período'}
            </button>
          ))}
        </div>

        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 group-focus-within:text-amber-500 transition-colors" />
          <input type="text" placeholder="Pesquisar barbeiro..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-zinc-900 border border-white/5 rounded-2xl pl-12 pr-4 py-4 focus:border-amber-500 outline-none shadow-xl transition-all" />
        </div>

        {isSelectionMode && selectedClients.length > 0 && (
          <button onClick={() => deleteClients(selectedClients)} className="w-full bg-red-600 hover:bg-red-500 text-white py-4 rounded-2xl font-black shadow-xl shadow-red-600/20 animate-in slide-in-from-top-2">
            EXCLUIR {selectedClients.length} SELECIONADOS
          </button>
        )}

        <div className="space-y-4">
          {filteredClients.map(c => {
            const days = differenceInDays(new Date(), parseISO(c.last_visit));
            const isSel = selectedClients.includes(c.id);
            return (
              <div key={c.id} className={`bg-zinc-900/50 border rounded-[2rem] p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all hover:bg-zinc-900 ${isSel ? 'border-amber-500 ring-1 ring-amber-500/50' : 'border-white/5'}`}>
                <div className="flex items-center gap-4">
                  {isSelectionMode && (
                    <button onClick={() => setSelectedClients(prev => isSel ? prev.filter(id => id !== c.id) : [...prev, c.id])}>
                      {isSel ? <CheckSquare className="text-amber-500" /> : <Square className="text-zinc-700" />}
                    </button>
                  )}
                  <div className="w-12 h-12 bg-amber-500/10 rounded-full flex items-center justify-center text-amber-500 font-black text-xl shadow-inner">{c.name?.[0]?.toUpperCase()}</div>
                  <div>
                    <p className="font-black text-lg tracking-tight">{c.name}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {c.services?.map((s: string) => <span key={s} className="text-[8px] font-black bg-zinc-800 text-zinc-500 px-2 py-0.5 rounded-full border border-white/5 uppercase">{s}</span>)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between md:gap-12 bg-black/40 p-3 rounded-2xl border border-white/5">
                  <div className="text-center">
                    <p className="text-[9px] font-black text-zinc-600 uppercase">Faturamento</p>
                    <p className="text-sm font-black text-emerald-500 tracking-tighter">R$ {c.price}</p>
                  </div>
                  <div className="text-center border-l border-white/10 pl-8">
                    <p className="text-[9px] font-black text-zinc-600 uppercase">Tempo</p>
                    <p className={`text-2xl font-black tracking-tighter ${days >= 20 ? 'text-red-500' : 'text-amber-500'}`}>{days}d</p>
                  </div>
                </div>

                <div className="flex gap-2 pt-3 md:pt-0 border-t border-white/5 md:border-0">
                  <button onClick={() => refreshClientVisit(c.id)} className="flex-1 md:flex-none p-4 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-2xl hover:bg-emerald-500/20 transition-all flex justify-center"><RefreshCw size={20} /></button>
                  <a href={`https://wa.me/55${c.phone.replace(/\D/g, '')}`} target="_blank" className="flex-1 md:flex-none p-4 bg-amber-500 text-black rounded-2xl hover:bg-amber-400 transition-all flex justify-center shadow-lg shadow-amber-500/10"><MessageSquare size={20} /></a>
                  <button onClick={() => deleteClients([c.id])} className="p-4 bg-zinc-800 text-zinc-500 rounded-2xl hover:text-red-500 transition-all"><Trash2 size={20} /></button>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* MODAL PERFIL / NOME */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-6 backdrop-blur-md">
          <div className="bg-zinc-900 border border-white/10 w-full max-w-sm rounded-[2.5rem] p-8 text-center shadow-2xl">
            <div className="w-16 h-16 bg-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-amber-500/20"><UserIcon className="text-black" /></div>
            <h3 className="text-2xl font-black mb-2 tracking-tight">COMO SE CHAMA?</h3>
            <p className="text-zinc-500 text-xs mb-6 uppercase font-bold tracking-widest">Para personalizar sua dashboard</p>
            <input autoFocus placeholder="Ex: Lucas Barbeiro" value={userName} onChange={e => setUserName(e.target.value)} className="w-full bg-black border border-white/10 rounded-2xl p-4 mb-4 outline-none focus:border-amber-500 transition-all text-center font-bold" />
            <button onClick={updateProfile} className="w-full bg-amber-500 text-black py-4 rounded-2xl font-black text-lg hover:bg-amber-400 transition-all">SALVAR PERFIL</button>
          </div>
        </div>
      )}

      {/* MODAL NOVO CLIENTE */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-zinc-900 border border-white/10 w-full max-w-md rounded-[3rem] p-8 shadow-2xl overflow-hidden relative">
            <h3 className="text-2xl font-black mb-6 text-center tracking-tighter italic">CADASTRAR <span className="text-amber-500">CLIENTE</span></h3>
            <form onSubmit={addClient} className="space-y-4">
              <input required placeholder="Nome Completo" value={newName} onChange={e => setNewName(e.target.value)} className="w-full bg-black/50 border border-white/10 rounded-2xl p-4 outline-none focus:border-amber-500 transition-all" />
              <div className="relative">
                <input required placeholder="Telefone (DDD + Número)" value={newPhone} onChange={e => setNewPhone(e.target.value)} className="w-full bg-black/50 border border-white/10 rounded-2xl p-4 outline-none focus:border-amber-500 transition-all" />
                <p className="text-[9px] text-zinc-600 mt-1 ml-2 uppercase font-bold tracking-tighter">Formato: 4599887766 (Sem espaços ou traços)</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <input type="number" placeholder="Valor (R$)" value={newPrice} onChange={e => setNewPrice(e.target.value)} className="w-full bg-black/50 border border-white/10 rounded-2xl p-4 outline-none focus:border-amber-500 transition-all" />
                <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} className="w-full bg-black/50 border border-white/10 rounded-2xl p-4 outline-none focus:border-amber-500 transition-all" />
              </div>
              <div className="flex gap-2">
                {['Cabelo', 'Barba', 'Sobrancelha'].map(s => (
                  <button key={s} type="button" onClick={() => setSelectedServices(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])} className={cn("flex-1 py-3 rounded-xl text-[9px] font-black uppercase border transition-all", selectedServices.includes(s) ? "bg-amber-500 border-amber-500 text-black" : "bg-black border-white/10 text-zinc-600")}>
                    {s}
                  </button>
                ))}
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 bg-zinc-800 rounded-2xl font-black text-zinc-500 text-xs">CANCELAR</button>
                <button type="submit" className="flex-1 bg-amber-500 text-black py-4 rounded-2xl font-black text-lg shadow-xl shadow-amber-500/20">SALVAR</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setLoginError('E-mail ou senha incorretos.');
    setIsLoggingIn(false);
  };

  const addClient = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from('clientes').insert([{
      name: newName, phone: newPhone.replace(/\D/g, ''), last_visit: newDate,
      user_id: session.user.id, services: selectedServices, price: Number(newPrice) || 0
    }]);
    if (!error) {
      setIsModalOpen(false);
      setNewName(''); setNewPhone(''); setNewPrice(''); setSelectedServices([]);
      fetchClients();
    }
  };

  const deleteClients = async (ids: string[]) => {
    if (!window.confirm("Essa ação não pode ser desfeita. Deseja excluir?")) return;
    await supabase.from('clientes').delete().in('id', ids);
    setIsSelectionMode(false);
    setSelectedClients([]);
    fetchClients();
  };

  const refreshClientVisit = async (id: string) => {
    const today = new Date().toISOString().split('T')[0];
    await supabase.from('clientes').update({ last_visit: today }).eq('id', id);
    setTimeout(fetchClients, 300);
  };

  const stats = useMemo(() => {
    const total = clients.length;
    const needsRecovery = clients.filter(c => differenceInDays(new Date(), parseISO(c.last_visit)) >= 20).length;
    const fidelity = total > 0 ? Math.round(((total - needsRecovery) / total) * 100) : 0;
    return { total, needsRecovery, fidelity };
  }, [clients]);

const faturamento = useMemo(() => {
    const now = new Date();
    const range = { 
      'today': startOfDay(now), 
      'week': subDays(now, 7), 
      'month': subDays(now, 30), 
      'all': new Date(0) 
    }[filterPeriod] || new Date(0);

    return clients
      .filter(c => c.last_visit && parseISO(c.last_visit) >= range)
      .reduce((acc, curr) => acc + (Number(curr.price) || 0), 0);
  }, [clients, filterPeriod]);

  if (authLoading) return <div className="min-h-screen bg-black flex items-center justify-center"><Loader2 className="text-amber-500 animate-spin w-10 h-10" /></div>;

  if (!session) return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="w-20 h-20 bg-amber-500 rounded-[2rem] flex items-center justify-center shadow-2xl shadow-amber-500/20 mx-auto mb-6">
            <Scissors className="text-black w-10 h-10" />
          </div>
          <h1 className="text-4xl font-black tracking-tighter italic">BARBER <span className="text-amber-500">PRO</span></h1>
          <p className="text-zinc-500 mt-2 font-medium">Gestão Premium Cascavel</p>
        </div>
        <form onSubmit={handleLogin} className="bg-zinc-900/50 border border-white/5 p-8 rounded-[2.5rem] space-y-4 shadow-2xl">
          {loginError && <div className="bg-red-500/10 text-red-500 p-4 rounded-xl text-xs flex items-center gap-2"><AlertCircle size={14}/> {loginError}</div>}
          <input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Seu e-mail" className="w-full bg-black/50 p-4 rounded-2xl border border-white/10 focus:border-amber-500 outline-none transition-all" />
          <input required type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Sua senha" className="w-full bg-black/50 p-4 rounded-2xl border border-white/10 focus:border-amber-500 outline-none transition-all" />
          <button className="w-full bg-amber-500 text-black py-4 rounded-2xl font-black text-lg hover:bg-amber-400 transition-all active:scale-95 shadow-xl shadow-amber-500/10">ENTRAR NO SISTEMA</button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white selection:bg-amber-500/30">
      <header className="border-b border-white/5 bg-zinc-900/80 backdrop-blur-md sticky top-0 z-30 px-6 h-20 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/20"><Scissors size={20} className="text-black" /></div>
          <div>
             <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest leading-none">Olá, {userName || 'Barbeiro'}!</p>
             <h1 className="text-xl font-black tracking-tighter">BARBER <span className="text-amber-500">PRO</span></h1>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setIsProfileModalOpen(true)} className="p-2 text-zinc-500 hover:text-amber-500 transition-colors"><UserIcon size={20} /></button>
          <button onClick={() => setIsSelectionMode(!isSelectionMode)} className={cn("px-4 py-2 rounded-full text-[10px] font-black transition-all", isSelectionMode ? "bg-amber-500 text-black" : "bg-zinc-800 text-zinc-500")}>
            {isSelectionMode ? "CANCELAR" : "SELECIONAR"}
          </button>
          <button onClick={() => setIsModalOpen(true)} className="bg-amber-500 text-black px-4 py-2 rounded-full font-black text-xs shadow-lg shadow-amber-500/10 hover:scale-105 transition-all"><UserPlus size={16} /></button>
          <button onClick={() => supabase.auth.signOut()} className="text-zinc-600 hover:text-red-500 ml-2"><LogOut size={20} /></button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 py-8 space-y-6">
        {/* Dashboard de Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-zinc-900 border border-white/5 p-4 rounded-3xl">
             <p className="text-[10px] text-zinc-500 font-bold uppercase mb-1">Total</p>
             <p className="text-2xl font-black">{stats.total}</p>
          </div>
          <div className="bg-zinc-900 border border-white/5 p-4 rounded-3xl">
             <p className="text-[10px] text-red-500 font-bold uppercase mb-1">Recuperar</p>
             <p className="text-2xl font-black text-red-500">{stats.needsRecovery}</p>
          </div>
          <div className="bg-zinc-900 border border-white/5 p-4 rounded-3xl">
             <p className="text-[10px] text-emerald-500 font-bold uppercase mb-1">Fidelidade</p>
             <p className="text-2xl font-black text-emerald-500">{stats.fidelity}%</p>
          </div>
          <div className="bg-zinc-900 border border-emerald-500/20 p-4 rounded-3xl shadow-lg shadow-emerald-500/5">
             <p className="text-[10px] text-zinc-500 font-bold uppercase mb-1">Faturamento ({filterPeriod})</p>
             <p className="text-2xl font-black text-emerald-500">R$ {faturamento}</p>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
          {['today', 'week', 'month', 'all'].map(p => (
            <button key={p} onClick={() => setFilterPeriod(p)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${filterPeriod === p ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20' : 'bg-zinc-900 text-zinc-500 border border-white/5'}`}>
              {p === 'today' ? 'Hoje' : p === 'week' ? '7 Dias' : p === 'month' ? 'Mês' : 'Todo Período'}
            </button>
          ))}
        </div>

        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 group-focus-within:text-amber-500 transition-colors" />
          <input type="text" placeholder="Pesquisar barbeiro..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-zinc-900 border border-white/5 rounded-2xl pl-12 pr-4 py-4 focus:border-amber-500 outline-none shadow-xl transition-all" />
        </div>

        {isSelectionMode && selectedClients.length > 0 && (
          <button onClick={() => deleteClients(selectedClients)} className="w-full bg-red-600 hover:bg-red-500 text-white py-4 rounded-2xl font-black shadow-xl shadow-red-600/20 animate-in slide-in-from-top-2">
            EXCLUIR {selectedClients.length} SELECIONADOS
          </button>
        )}

        <div className="space-y-4">
          {filteredClients.map(c => {
            const days = differenceInDays(new Date(), parseISO(c.last_visit));
            const isSel = selectedClients.includes(c.id);
            return (
              <div key={c.id} className={`bg-zinc-900/50 border rounded-[2rem] p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all hover:bg-zinc-900 ${isSel ? 'border-amber-500 ring-1 ring-amber-500/50' : 'border-white/5'}`}>
                <div className="flex items-center gap-4">
                  {isSelectionMode && (
                    <button onClick={() => setSelectedClients(prev => isSel ? prev.filter(id => id !== c.id) : [...prev, c.id])}>
                      {isSel ? <CheckSquare className="text-amber-500" /> : <Square className="text-zinc-700" />}
                    </button>
                  )}
                  <div className="w-12 h-12 bg-amber-500/10 rounded-full flex items-center justify-center text-amber-500 font-black text-xl shadow-inner">{c.name?.[0]?.toUpperCase()}</div>
                  <div>
                    <p className="font-black text-lg tracking-tight">{c.name}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {c.services?.map((s: string) => <span key={s} className="text-[8px] font-black bg-zinc-800 text-zinc-500 px-2 py-0.5 rounded-full border border-white/5 uppercase">{s}</span>)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between md:gap-12 bg-black/40 p-3 rounded-2xl border border-white/5">
                  <div className="text-center">
                    <p className="text-[9px] font-black text-zinc-600 uppercase">Faturamento</p>
                    <p className="text-sm font-black text-emerald-500 tracking-tighter">R$ {c.price}</p>
                  </div>
                  <div className="text-center border-l border-white/10 pl-8">
                    <p className="text-[9px] font-black text-zinc-600 uppercase">Tempo</p>
                    <p className={`text-2xl font-black tracking-tighter ${days >= 20 ? 'text-red-500' : 'text-amber-500'}`}>{days}d</p>
                  </div>
                </div>

                <div className="flex gap-2 pt-3 md:pt-0 border-t border-white/5 md:border-0">
                  <button onClick={() => refreshClientVisit(c.id)} className="flex-1 md:flex-none p-4 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-2xl hover:bg-emerald-500/20 transition-all flex justify-center"><RefreshCw size={20} /></button>
                  <a href={`https://wa.me/55${c.phone.replace(/\D/g, '')}`} target="_blank" className="flex-1 md:flex-none p-4 bg-amber-500 text-black rounded-2xl hover:bg-amber-400 transition-all flex justify-center shadow-lg shadow-amber-500/10"><MessageSquare size={20} /></a>
                  <button onClick={() => deleteClients([c.id])} className="p-4 bg-zinc-800 text-zinc-500 rounded-2xl hover:text-red-500 transition-all"><Trash2 size={20} /></button>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* MODAL PERFIL / NOME */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-6 backdrop-blur-md">
          <div className="bg-zinc-900 border border-white/10 w-full max-w-sm rounded-[2.5rem] p-8 text-center shadow-2xl">
            <div className="w-16 h-16 bg-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-amber-500/20"><UserIcon className="text-black" /></div>
            <h3 className="text-2xl font-black mb-2 tracking-tight">COMO SE CHAMA?</h3>
            <p className="text-zinc-500 text-xs mb-6 uppercase font-bold tracking-widest">Para personalizar sua dashboard</p>
            <input autoFocus placeholder="Ex: Lucas Barbeiro" value={userName} onChange={e => setUserName(e.target.value)} className="w-full bg-black border border-white/10 rounded-2xl p-4 mb-4 outline-none focus:border-amber-500 transition-all text-center font-bold" />
            <button onClick={updateProfile} className="w-full bg-amber-500 text-black py-4 rounded-2xl font-black text-lg hover:bg-amber-400 transition-all">SALVAR PERFIL</button>
          </div>
        </div>
      )}

      {/* MODAL NOVO CLIENTE */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-zinc-900 border border-white/10 w-full max-w-md rounded-[3rem] p-8 shadow-2xl overflow-hidden relative">
            <h3 className="text-2xl font-black mb-6 text-center tracking-tighter italic">CADASTRAR <span className="text-amber-500">CLIENTE</span></h3>
            <form onSubmit={addClient} className="space-y-4">
              <input required placeholder="Nome Completo" value={newName} onChange={e => setNewName(e.target.value)} className="w-full bg-black/50 border border-white/10 rounded-2xl p-4 outline-none focus:border-amber-500 transition-all" />
              <div className="relative">
                <input required placeholder="Telefone (DDD + Número)" value={newPhone} onChange={e => setNewPhone(e.target.value)} className="w-full bg-black/50 border border-white/10 rounded-2xl p-4 outline-none focus:border-amber-500 transition-all" />
                <p className="text-[9px] text-zinc-600 mt-1 ml-2 uppercase font-bold tracking-tighter">Formato: 4599887766 (Sem espaços ou traços)</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <input type="number" placeholder="Valor (R$)" value={newPrice} onChange={e => setNewPrice(e.target.value)} className="w-full bg-black/50 border border-white/10 rounded-2xl p-4 outline-none focus:border-amber-500 transition-all" />
                <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} className="w-full bg-black/50 border border-white/10 rounded-2xl p-4 outline-none focus:border-amber-500 transition-all" />
              </div>
              <div className="flex gap-2">
                {['Cabelo', 'Barba', 'Sobrancelha'].map(s => (
                  <button key={s} type="button" onClick={() => setSelectedServices(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])} className={cn("flex-1 py-3 rounded-xl text-[9px] font-black uppercase border transition-all", selectedServices.includes(s) ? "bg-amber-500 border-amber-500 text-black" : "bg-black border-white/10 text-zinc-600")}>
                    {s}
                  </button>
                ))}
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 bg-zinc-800 rounded-2xl font-black text-zinc-500 text-xs">CANCELAR</button>
                <button type="submit" className="flex-1 bg-amber-500 text-black py-4 rounded-2xl font-black text-lg shadow-xl shadow-amber-500/20">SALVAR</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
