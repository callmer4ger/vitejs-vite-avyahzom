import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, UserPlus, MessageSquare, Search, Trash2, 
  Scissors, LogOut, Loader2, RefreshCw, CheckSquare, 
  Square, User as UserIcon, TrendingUp, Wallet
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
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPeriod, setFilterPeriod] = useState('month');
  
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
    const { data } = await supabase.from('profiles').select('full_name').eq('id', userId).maybeSingle();
    if (data?.full_name) {
      setUserName(data.full_name);
      setIsProfileModalOpen(false);
    } else {
      setIsProfileModalOpen(true);
    }
  };

  const updateProfile = async () => {
    if (!userName.trim() || !session) return;
    const { error } = await supabase.from('profiles').upsert({ 
      id: session.user.id, 
      full_name: userName.trim(),
      updated_at: new Date()
    });
    if (!error) {
      setIsProfileModalOpen(false);
      fetchProfile(session.user.id);
    }
  };

  const fetchClients = async () => {
    if (!session) return;
    const { data } = await supabase.from('clientes').select('*').order('last_visit', { ascending: false });
    if (data) {
      setClients(data.map(c => ({
        ...c,
        services: Array.isArray(c.services) ? c.services : [],
        price: Number(c.price) || 0
      })));
    }
  };

  useEffect(() => { fetchClients(); }, [session]);

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
    if (!window.confirm("Excluir definitivamente?")) return;
    const { error } = await supabase.from('clientes').delete().in('id', ids);
    if (!error) {
      setIsSelectionMode(false);
      setSelectedClients([]);
      fetchClients();
    }
  };

  const refreshVisit = async (id: string) => {
    const today = new Date().toISOString().split('T')[0];
    await supabase.from('clientes').update({ last_visit: today }).eq('id', id);
    fetchClients();
  };

  const stats = useMemo(() => {
    const total = clients.length;
    const needsRecovery = clients.filter(c => differenceInDays(new Date(), parseISO(c.last_visit)) >= 20).length;
    const fidelity = total > 0 ? Math.round(((total - needsRecovery) / total) * 100) : 0;
    const range = { 'today': startOfDay(new Date()), 'week': subDays(new Date(), 7), 'month': subDays(new Date(), 30) }[filterPeriod] || new Date(0);
    const faturamento = clients.filter(c => parseISO(c.last_visit) >= range).reduce((acc, curr) => acc + (Number(curr.price) || 0), 0);
    return { total, needsRecovery, fidelity, faturamento };
  }, [clients, filterPeriod]);

  if (authLoading) return <div className="min-h-screen bg-[#050505] flex items-center justify-center"><Loader2 className="animate-spin text-amber-500" size={40} /></div>;

  if (!session) return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <div className="w-20 h-20 bg-gradient-to-tr from-amber-600 to-amber-400 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(217,119,6,0.3)]">
            <Scissors className="text-black w-10 h-10" />
          </div>
          <h1 className="text-4xl font-black text-white italic tracking-tighter">BARBER <span className="text-amber-500">PRO</span></h1>
          <p className="text-zinc-500 text-xs mt-2 font-medium tracking-widest uppercase">Elegância & Gestão</p>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); supabase.auth.signInWithPassword({ email, password }); }} className="space-y-4">
          <input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="E-mail" className="w-full bg-zinc-900/50 border border-white/5 rounded-2xl p-5 text-white outline-none focus:border-amber-500/50 transition-all" />
          <input required type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Senha" className="w-full bg-zinc-900/50 border border-white/5 rounded-2xl p-5 text-white outline-none focus:border-amber-500/50 transition-all" />
          <button className="w-full bg-amber-500 text-black py-5 rounded-2xl font-black text-lg shadow-xl shadow-amber-500/10 active:scale-95 transition-all uppercase tracking-tight">Entrar no Sistema</button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050505] text-white pb-28 font-sans selection:bg-amber-500/30">
      <header className="sticky top-0 z-40 px-6 h-24 flex items-center justify-between bg-[#050505]/80 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-500 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/20"><Scissors size={24} className="text-black" /></div>
          <div>
            <p className="text-[10px] font-black text-amber-500/80 uppercase tracking-[0.2em] leading-none mb-1">Status: Online</p>
            <h1 className="text-xl font-black tracking-tighter italic leading-none">{userName || 'MEU PERFIL'}</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setIsSelectionMode(!isSelectionMode)} className={cn("p-3 rounded-xl transition-all", isSelectionMode ? "bg-red-500/10 text-red-500" : "bg-zinc-900 text-zinc-500")}><Trash2 size={20} /></button>
          <button onClick={() => setIsModalOpen(true)} className="bg-amber-500 text-black p-3 rounded-xl shadow-lg shadow-amber-500/20 active:scale-90 transition-all"><UserPlus size={20} /></button>
          <button onClick={() => supabase.auth.signOut()} className="p-3 text-zinc-600 hover:text-red-500 transition-colors"><LogOut size={20} /></button>
        </div>
      </header>

      <main className="p-6 space-y-8 max-w-lg mx-auto">
        {/* Dashboard Grid */}
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: 'Clientes', val: stats.total, color: 'text-white', icon: Users },
            { label: 'Recuperar', val: stats.needsRecovery, color: 'text-red-500', icon: AlertCircle },
            { label: 'Fidelidade', val: `${stats.fidelity}%`, color: 'text-amber-500', icon: TrendingUp },
            { label: 'Ganhos', val: `R$ ${stats.faturamento}`, color: 'text-emerald-500', icon: Wallet },
          ].map((item, i) => (
            <div key={i} className="bg-zinc-900/40 border border-white/5 p-5 rounded-[2.5rem] backdrop-blur-sm">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest">{item.label}</p>
                <item.icon size={12} className="text-zinc-700" />
              </div>
              <p className={cn("text-2xl font-black tracking-tighter", item.color)}>{item.val}</p>
            </div>
          ))}
        </div>

        {/* Filtros */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar py-2">
          {['today', 'week', 'month'].map(p => (
            <button key={p} onClick={() => setFilterPeriod(p)} className={cn("px-6 py-3 rounded-2xl text-[10px] font-black uppercase border transition-all whitespace-nowrap tracking-widest", filterPeriod === p ? "bg-amber-500 border-amber-500 text-black shadow-lg shadow-amber-500/20" : "bg-zinc-900 border-white/5 text-zinc-500")}>
              {p === 'today' ? 'Hoje' : p === 'week' ? '7 Dias' : '30 Dias'}
            </button>
          ))}
        </div>

        {/* Busca */}
        <div className="relative group">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 group-focus-within:text-amber-500 transition-colors" />
          <input type="text" placeholder="Localizar cliente..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-zinc-900/50 border border-white/5 rounded-[2rem] pl-14 pr-6 py-5 outline-none focus:border-amber-500/30 transition-all text-sm font-medium" />
        </div>

        {isSelectionMode && selectedClients.length > 0 && (
          <button onClick={() => deleteClients(selectedClients)} className="w-full bg-red-600/10 text-red-500 border border-red-500/20 py-5 rounded-[2rem] font-black uppercase tracking-widest text-xs animate-pulse">Confirmar Exclusão ({selectedClients.length})</button>
        )}

        {/* Lista */}
        <div className="space-y-4">
          {clients.filter(c => (c.name || '').toLowerCase().includes(searchTerm.toLowerCase())).map(c => {
            const days = differenceInDays(new Date(), parseISO(c.last_visit));
            const isSel = selectedClients.includes(c.id);
            return (
              <div key={c.id} className={cn("bg-zinc-900/30 border rounded-[2.5rem] p-6 flex items-center justify-between transition-all active:scale-[0.98]", isSel ? "border-amber-500 bg-amber-500/5 shadow-[0_0_20px_rgba(217,119,6,0.1)]" : "border-white/5")}>
                <div className="flex items-center gap-4">
                  {isSelectionMode ? (
                    <button onClick={() => setSelectedClients(prev => isSel ? prev.filter(id => id !== c.id) : [...prev, c.id])}>
                      {isSel ? <div className="w-6 h-6 bg-amber-500 rounded-lg flex items-center justify-center"><CheckSquare size={14} className="text-black" /></div> : <div className="w-6 h-6 border-2 border-zinc-800 rounded-lg" />}
                    </button>
                  ) : (
                    <div className="w-12 h-12 bg-gradient-to-br from-zinc-800 to-zinc-900 border border-white/5 rounded-2xl flex items-center justify-center text-amber-500 font-black text-lg">{c.name?.[0]}</div>
                  )}
                  <div>
                    <p className="font-black text-base tracking-tight text-white/90">{c.name}</p>
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-tighter">R$ {c.price} • {c.services?.join(' + ') || 'Corte'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className={cn("text-2xl font-black tracking-tighter leading-none", days >= 20 ? "text-red-500" : "text-amber-500")}>{days}d</p>
                    <p className="text-[8px] text-zinc-600 font-bold uppercase tracking-widest mt-1">Atraso</p>
                  </div>
                  <div className="flex flex-col gap-2">
                    <button onClick={() => refreshVisit(c.id)} className="p-3 bg-emerald-500/10 text-emerald-500 rounded-xl hover:bg-emerald-500/20 transition-all"><RefreshCw size={16} /></button>
                    <a href={`https://wa.me/55${c.phone}`} className="p-3 bg-amber-500 text-black rounded-xl hover:scale-105 transition-all"><MessageSquare size={16} /></a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Modal Perfil - Blindado */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-8 backdrop-blur-2xl">
          <div className="bg-zinc-900 border border-white/10 w-full max-w-sm rounded-[3rem] p-10 text-center shadow-3xl">
            <div className="w-20 h-20 bg-amber-500/10 rounded-3xl flex items-center justify-center mx-auto mb-6 text-amber-500"><UserIcon size={40} /></div>
            <h3 className="text-2xl font-black mb-2 tracking-tight">BEM-VINDO</h3>
            <p className="text-zinc-500 text-[10px] mb-8 uppercase font-bold tracking-widest">Identifique-se para começar</p>
            <input autoFocus placeholder="Ex: Barbeiro" value={userName} onChange={e => setUserName(e.target.value)} className="w-full bg-black border border-white/10 rounded-2xl p-5 mb-6 text-center font-bold text-white outline-none focus:border-amber-500 transition-all" />
            <button onClick={updateProfile} className="w-full bg-amber-500 text-black py-5 rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg shadow-amber-500/20 active:scale-95 transition-all">Começar Agora</button>
          </div>
        </div>
      )}

      {/* Modal Cadastro - Luxo */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-6 backdrop-blur-md">
          <div className="bg-zinc-900 border border-white/5 w-full max-w-md rounded-[3rem] p-10 shadow-2xl">
            <h3 className="text-2xl font-black mb-8 text-center italic tracking-tighter">NOVO <span className="text-amber-500 text-3xl">CLIENTE</span></h3>
            <form onSubmit={addClient} className="space-y-5">
              <input required placeholder="Nome do Cliente" value={newName} onChange={e => setNewName(e.target.value)} className="w-full bg-black border border-white/10 rounded-2xl p-5 outline-none focus:border-amber-500 transition-all" />
              <input required placeholder="WhatsApp (DDD + Número)" value={newPhone} onChange={e => setNewPhone(e.target.value)} className="w-full bg-black border border-white/10 rounded-2xl p-5 outline-none focus:border-amber-500 transition-all" />
              <div className="grid grid-cols-2 gap-4">
                <input type="number" placeholder="Valor R$" value={newPrice} onChange={e => setNewPrice(e.target.value)} className="w-full bg-black border border-white/10 rounded-2xl p-5 outline-none focus:border-amber-500" />
                <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} className="w-full bg-black border border-white/10 rounded-2xl p-5 outline-none focus:border-amber-500 text-xs" />
              </div>
              <div className="flex gap-2">
                {['Cabelo', 'Barba', 'Sobrancelha'].map(s => (
                  <button key={s} type="button" onClick={() => setSelectedServices(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])} className={cn("flex-1 py-4 rounded-2xl text-[9px] font-black uppercase border transition-all", selectedServices.includes(s) ? "bg-amber-500 border-amber-500 text-black shadow-lg shadow-amber-500/20" : "bg-black border-white/10 text-zinc-600")}>{s}</button>
                ))}
              </div>
              <div className="flex gap-4 pt-6">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-5 text-zinc-600 font-black uppercase text-[10px] tracking-widest">Descartar</button>
                <button type="submit" className="flex-1 bg-amber-500 text-black py-5 rounded-[1.5rem] font-black uppercase text-xs shadow-xl shadow-amber-500/10">Salvar Cliente</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
