import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, UserPlus, MessageSquare, Search, AlertCircle, Trash2, 
  Scissors, LogOut, Mail, Lock, Loader2, RefreshCw, CheckSquare, 
  Square, TrendingUp, DollarSign, User as UserIcon
} from 'lucide-react';
import { format, differenceInDays, parseISO, startOfDay, subDays } from 'date-fns';
import { supabase } from './lib/supabase';

// Função auxiliar para organizar as classes CSS
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
    try {
      const { data } = await supabase.from('profiles').select('full_name').eq('id', userId).single();
      if (data) setUserName(data.full_name);
      else setIsProfileModalOpen(true);
    } catch (e) {
      setIsProfileModalOpen(true);
    }
  };

  const updateProfile = async () => {
    if (!userName || !session) return;
    const { error } = await supabase.from('profiles').upsert({ id: session.user.id, full_name: userName });
    if (!error) setIsProfileModalOpen(false);
  };

  const fetchClients = async () => {
    if (!session) return;
    const { data, error } = await supabase.from('clientes').select('*').order('last_visit', { ascending: false });
    if (!error && data) {
      setClients(data.map(c => ({
        ...c,
        services: c.services || [],
        price: Number(c.price) || 0
      })));
    }
  };

  useEffect(() => { fetchClients(); }, [session]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setLoginError('E-mail ou senha incorretos.');
    setIsLoggingIn(false);
  };

  const addClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !session) return;
    const { error } = await supabase.from('clientes').insert([{
      name: newName,
      phone: newPhone.replace(/\D/g, ''),
      last_visit: newDate,
      user_id: session.user.id,
      services: selectedServices,
      price: Number(newPrice) || 0
    }]);
    if (!error) {
      setIsModalOpen(false);
      setNewName(''); setNewPhone(''); setNewPrice(''); setSelectedServices([]);
      fetchClients();
    }
  };

  const deleteClients = async (ids: string[]) => {
    if (!window.confirm("Essa ação não pode ser desfeita. Deseja excluir?")) return;
    const { error } = await supabase.from('clientes').delete().in('id', ids);
    if (!error) {
      setIsSelectionMode(false);
      setSelectedClients([]);
      fetchClients();
    }
  };

  const refreshClientVisit = async (id: string) => {
    const today = new Date().toISOString().split('T')[0];
    const { error } = await supabase.from('clientes').update({ last_visit: today }).eq('id', id);
    if (!error) fetchClients();
  };

  const filteredClients = useMemo(() => {
    return clients.filter(c => (c.name || '').toLowerCase().includes(searchTerm.toLowerCase()));
  }, [clients, searchTerm]);

  const stats = useMemo(() => {
    const total = clients.length;
    const needsRecovery = clients.filter(c => differenceInDays(new Date(), parseISO(c.last_visit)) >= 20).length;
    const fidelity = total > 0 ? Math.round(((total - needsRecovery) / total) * 100) : 0;
    return { total, needsRecovery, fidelity };
  }, [clients]);

  const faturamento = useMemo(() => {
    const range = { 
      'today': startOfDay(new Date()), 
      'week': subDays(new Date(), 7), 
      'month': subDays(new Date(), 30), 
      'all': new Date(0) 
    }[filterPeriod] || new Date(0);
    return clients
      .filter(c => parseISO(c.last_visit) >= range)
      .reduce((acc, curr) => acc + (Number(curr.price) || 0), 0);
  }, [clients, filterPeriod]);

  if (authLoading) return <div className="min-h-screen bg-black flex items-center justify-center text-amber-500"><Loader2 className="animate-spin" /></div>;

  if (!session) return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="w-20 h-20 bg-amber-500 rounded-[2rem] flex items-center justify-center shadow-2xl mx-auto mb-6">
            <Scissors className="text-black w-10 h-10" />
          </div>
          <h1 className="text-4xl font-black tracking-tighter">BARBER <span className="text-amber-500">PRO</span></h1>
        </div>
        <form onSubmit={handleLogin} className="bg-zinc-900 p-8 rounded-[2rem] space-y-4 border border-white/5">
          {loginError && <p className="text-red-500 text-xs text-center">{loginError}</p>}
          <input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="E-mail" className="w-full bg-black border border-white/10 rounded-2xl p-4 outline-none focus:border-amber-500" />
          <input required type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Senha" className="w-full bg-black border border-white/10 rounded-2xl p-4 outline-none focus:border-amber-500" />
          <button className="w-full bg-amber-500 text-black py-4 rounded-2xl font-black">ENTRAR</button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans">
      <header className="border-b border-white/5 bg-zinc-900/80 backdrop-blur-md sticky top-0 z-30 px-6 h-20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center"><Scissors size={20} className="text-black" /></div>
          <div>
            <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest leading-none">Olá, {userName || 'Barbeiro'}!</p>
            <h1 className="text-xl font-black tracking-tighter">BARBER <span className="text-amber-500">PRO</span></h1>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setIsProfileModalOpen(true)} className="p-2 text-zinc-500 hover:text-amber-500 transition-colors"><UserIcon size={20} /></button>
          <button onClick={() => setIsSelectionMode(!isSelectionMode)} className={cn("px-4 py-2 rounded-full text-[10px] font-black transition-all", isSelectionMode ? "bg-amber-500 text-black" : "bg-zinc-800 text-zinc-500")}>
            {isSelectionMode ? "CONCLUIR" : "EXCLUIR VÁRIOS"}
          </button>
          <button onClick={() => setIsModalOpen(true)} className="bg-amber-500 text-black px-4 py-2 rounded-full font-black text-xs transition-all"><UserPlus size={16} /></button>
          <button onClick={() => supabase.auth.signOut()} className="text-zinc-600 hover:text-red-500 ml-2"><LogOut size={20} /></button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 py-8 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-zinc-900 border border-white/5 p-4 rounded-3xl">
            <p className="text-[10px] text-zinc-500 font-bold uppercase mb-1 tracking-widest">Total</p>
            <p className="text-2xl font-black leading-none">{stats.total}</p>
          </div>
          <div className="bg-zinc-900 border border-white/5 p-4 rounded-3xl text-red-500">
            <p className="text-[10px] font-bold uppercase mb-1 tracking-widest">Recuperar</p>
            <p className="text-2xl font-black leading-none">{stats.needsRecovery}</p>
          </div>
          <div className="bg-zinc-900 border border-white/5 p-4 rounded-3xl text-emerald-500">
            <p className="text-[10px] font-bold uppercase mb-1 tracking-widest">Fidelidade</p>
            <p className="text-2xl font-black leading-none">{stats.fidelity}%</p>
          </div>
          <div className="bg-zinc-900 border border-emerald-500/20 p-4 rounded-3xl text-emerald-500">
            <p className="text-[10px] font-bold uppercase mb-1 tracking-widest">Faturamento</p>
            <p className="text-2xl font-black leading-none">R$ {faturamento}</p>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2">
          {['today', 'week', 'month', 'all'].map(p => (
            <button key={p} onClick={() => setFilterPeriod(p)} className={cn("px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all border", filterPeriod === p ? "bg-amber-500 border-amber-500 text-black" : "bg-zinc-900 border-white/5 text-zinc-500")}>
              {p === 'today' ? 'Hoje' : p === 'week' ? '7 Dias' : p === 'month' ? '30 Dias' : 'Tudo'}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
          <input type="text" placeholder="Buscar barbeiro..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-zinc-900 border border-white/5 rounded-2xl pl-12 pr-4 py-4 focus:border-amber-500 outline-none transition-all" />
        </div>

        {isSelectionMode && selectedClients.length > 0 && (
          <button onClick={() => deleteClients(selectedClients)} className="w-full bg-red-600 text-white py-4 rounded-2xl font-black">EXCLUIR {selectedClients.length} SELECIONADOS</button>
        )}

        <div className="space-y-4">
          {filteredClients.map(c => {
            const days = differenceInDays(new Date(), parseISO(c.last_visit));
            const isSel = selectedClients.includes(c.id);
            return (
              <div key={c.id} className={cn("bg-zinc-900/50 border rounded-[2rem] p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all", isSel ? "border-amber-500" : "border-white/5")}>
                <div className="flex items-center gap-4">
                  {isSelectionMode && (
                    <button onClick={() => setSelectedClients(prev => isSel ? prev.filter(id => id !== c.id) : [...prev, c.id])}>
                      {isSel ? <CheckSquare className="text-amber-500" /> : <Square className="text-zinc-700" />}
                    </button>
                  )}
                  <div className="w-12 h-12 bg-amber-500/10 rounded-full flex items-center justify-center text-amber-500 font-black text-xl">{c.name?.[0]?.toUpperCase()}</div>
                  <div>
                    <p className="font-black text-lg tracking-tight">{c.name}</p>
                    <p className="text-[10px] text-zinc-600">{c.phone}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {c.services?.map((s: string) => <span key={s} className="text-[8px] font-black bg-zinc-800 text-zinc-500 px-2 py-0.5 rounded-full">{s}</span>)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between md:gap-12 bg-black/40 p-3 rounded-2xl border border-white/5">
                  <div className="text-center px-4">
                    <p className="text-[9px] font-black text-zinc-600 uppercase">Faturamento</p>
                    <p className="text-sm font-black text-emerald-500 tracking-tighter">R$ {c.price || 0}</p>
                  </div>
                  <div className="text-center border-l border-white/10 px-6">
                    <p className="text-[9px] font-black text-zinc-600 uppercase">Tempo</p>
                    <p className={cn("text-2xl font-black tracking-tighter", days >= 20 ? "text-red-500" : "text-amber-500")}>{days}d</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button onClick={() => refreshClientVisit(c.id)} className="flex-1 p-4 bg-emerald-500/10 text-emerald-500 rounded-2xl hover:bg-emerald-500/20"><RefreshCw size={20} /></button>
                  <a href={`https://wa.me/55${c.phone?.replace(/\D/g, '')}`} target="_blank" className="flex-1 p-4 bg-amber-500 text-black rounded-2xl hover:bg-amber-400 flex justify-center"><MessageSquare size={20} /></a>
                  <button onClick={() => deleteClients([c.id])} className="p-4 bg-zinc-800 text-zinc-500 rounded-2xl hover:text-red-500 transition-all"><Trash2 size={20} /></button>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Modal Perfil */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-6 backdrop-blur-md">
          <div className="bg-zinc-900 border border-white/10 w-full max-w-sm rounded-[2.5rem] p-8 text-center shadow-2xl">
            <h3 className="text-2xl font-black mb-2 tracking-tight">COMO SE CHAMA?</h3>
            <p className="text-zinc-500 text-[10px] mb-6 uppercase font-bold tracking-widest tracking-widest">Para sua dashboard</p>
            <input autoFocus placeholder="Ex: Wayne Barbeiro" value={userName} onChange={e => setUserName(e.target.value)} className="w-full bg-black border border-white/10 rounded-2xl p-4 mb-4 text-center font-bold outline-none focus:border-amber-500" />
            <button onClick={updateProfile} className="w-full bg-amber-500 text-black py-4 rounded-2xl font-black">SALVAR PERFIL</button>
          </div>
        </div>
      )}

      {/* Modal Cadastro */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-white/10 w-full max-w-md rounded-[3rem] p-8">
            <h3 className="text-2xl font-black mb-6 text-center italic tracking-tighter">NOVO <span className="text-amber-500">CLIENTE</span></h3>
            <form onSubmit={addClient} className="space-y-4">
              <input required placeholder="Nome Completo" value={newName} onChange={e => setNewName(e.target.value)} className="w-full bg-black/50 border border-white/10 rounded-2xl p-4 outline-none focus:border-amber-500" />
              <input required placeholder="WhatsApp (Ex: 4599887766)" value={newPhone} onChange={e => setNewPhone(e.target.value)} className="w-full bg-black/50 border border-white/10 rounded-2xl p-4 outline-none focus:border-amber-500" />
              <div className="grid grid-cols-2 gap-4">
                <input type="number" placeholder="Valor (R$)" value={newPrice} onChange={e => setNewPrice(e.target.value)} className="w-full bg-black/50 border border-white/10 rounded-2xl p-4 outline-none focus:border-amber-500" />
                <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} className="w-full bg-black/50 border border-white/10 rounded-2xl p-4 outline-none focus:border-amber-500" />
              </div>
              <div className="flex gap-2">
                {['Cabelo', 'Barba', 'Sobrancelha'].map(s => (
                  <button key={s} type="button" onClick={() => setSelectedServices(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])} className={cn("flex-1 py-3 rounded-xl text-[9px] font-black uppercase border transition-all", selectedServices.includes(s) ? "bg-amber-500 border-amber-500 text-black shadow-lg shadow-amber-500/20" : "bg-black border-white/10 text-zinc-600")}>
                    {s}
                  </button>
                ))}
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 bg-zinc-800 rounded-2xl font-black text-zinc-500 text-xs">CANCELAR</button>
                <button type="submit" className="flex-1 bg-amber-500 text-black py-4 rounded-2xl font-black">SALVAR</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
