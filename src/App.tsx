import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, UserPlus, MessageSquare, Search, AlertCircle, Trash2, 
  Scissors, LogOut, Loader2, RefreshCw, CheckSquare, 
  Square, User as UserIcon
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
    const { data, error } = await supabase.from('profiles').select('full_name').eq('id', userId).single();
    if (data && data.full_name) {
      setUserName(data.full_name);
      setIsProfileModalOpen(false);
    } else {
      setIsProfileModalOpen(true);
    }
  };

  const updateProfile = async () => {
    if (!userName.trim() || !session) return;
    // Força o Upsert (Inserir ou Atualizar)
    const { error } = await supabase.from('profiles').upsert({ 
      id: session.user.id, 
      full_name: userName.trim() 
    }, { onConflict: 'id' });
    
    if (!error) {
      setIsProfileModalOpen(false);
      // Pequeno delay para o banco processar
      setTimeout(() => fetchProfile(session.user.id), 500);
    } else {
      alert("Erro ao salvar. Tente novamente.");
    }
  };

  const fetchClients = async () => {
    if (!session) return;
    const { data, error } = await supabase.from('clientes').select('*').order('last_visit', { ascending: false });
    if (!error && data) {
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
    if (!window.confirm("Excluir selecionados?")) return;
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

  if (authLoading) return <div className="min-h-screen bg-black flex items-center justify-center"><Loader2 className="animate-spin text-amber-500" /></div>;

  if (!session) return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <form onSubmit={(e) => { e.preventDefault(); supabase.auth.signInWithPassword({ email, password }).catch(() => setLoginError('Erro')); }} className="bg-zinc-900 p-8 rounded-[2.5rem] w-full max-w-sm space-y-4 border border-white/5 shadow-2xl">
        <div className="w-16 h-16 bg-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-amber-500/20"><Scissors className="text-black" /></div>
        <h1 className="text-3xl font-black text-center text-white italic tracking-tighter">BARBER <span className="text-amber-500">PRO</span></h1>
        <input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="E-mail" className="w-full bg-black border border-white/10 rounded-2xl p-4 text-white outline-none focus:border-amber-500" />
        <input required type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Senha" className="w-full bg-black border border-white/10 rounded-2xl p-4 text-white outline-none focus:border-amber-500" />
        <button onClick={() => supabase.auth.signInWithPassword({email, password})} className="w-full bg-amber-500 text-black py-4 rounded-2xl font-black">ENTRAR</button>
      </form>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white pb-20">
      <header className="border-b border-white/5 bg-zinc-900/80 backdrop-blur-md sticky top-0 z-30 px-6 h-20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center"><Scissors size={20} className="text-black" /></div>
          <div>
            <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest leading-none">Olá, {userName || 'Barbeiro'}!</p>
            <h1 className="text-xl font-black tracking-tighter italic">BARBER <span className="text-amber-500">PRO</span></h1>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setIsSelectionMode(!isSelectionMode)} className={cn("p-2 rounded-lg transition-all", isSelectionMode ? "bg-amber-500 text-black" : "text-zinc-500")}><Trash2 size={20} /></button>
          <button onClick={() => setIsModalOpen(true)} className="bg-amber-500 text-black p-2 rounded-xl shadow-lg"><UserPlus size={20} /></button>
        </div>
      </header>

      <main className="p-4 space-y-6">
        {/* Dashboard Premium Style */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-zinc-900 border border-white/5 p-4 rounded-[2rem]">
            <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">Clientes</p>
            <p className="text-2xl font-black">{stats.total}</p>
          </div>
          <div className="bg-zinc-900 border border-white/5 p-4 rounded-[2rem]">
            <p className="text-[9px] text-red-500 font-bold uppercase tracking-widest">Recuperar</p>
            <p className="text-2xl font-black text-red-500">{stats.needsRecovery}</p>
          </div>
          <div className="bg-zinc-900 border border-white/5 p-4 rounded-[2rem]">
            <p className="text-[9px] text-emerald-500 font-bold uppercase tracking-widest">Fidelidade</p>
            <p className="text-2xl font-black text-emerald-500">{stats.fidelity}%</p>
          </div>
          <div className="bg-zinc-900 border border-emerald-500/20 p-4 rounded-[2rem]">
            <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">Ganhos</p>
            <p className="text-2xl font-black text-emerald-500">R$ {stats.faturamento}</p>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {['today', 'week', 'month'].map(p => (
            <button key={p} onClick={() => setFilterPeriod(p)} className={cn("px-4 py-2 rounded-full text-[10px] font-black uppercase border transition-all whitespace-nowrap", filterPeriod === p ? "bg-amber-500 border-amber-500 text-black" : "bg-zinc-900 border-white/5 text-zinc-500")}>
              {p === 'today' ? 'Hoje' : p === 'week' ? '7 Dias' : '30 Dias'}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
          <input type="text" placeholder="Buscar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-zinc-900 border border-white/5 rounded-2xl pl-12 pr-4 py-4 outline-none focus:border-amber-500" />
        </div>

        {isSelectionMode && selectedClients.length > 0 && (
          <button onClick={() => deleteClients(selectedClients)} className="w-full bg-red-600 text-white py-4 rounded-2xl font-black animate-pulse">APAGAR {selectedClients.length}</button>
        )}

        <div className="space-y-3">
          {clients.filter(c => (c.name || '').toLowerCase().includes(searchTerm.toLowerCase())).map(c => {
            const days = differenceInDays(new Date(), parseISO(c.last_visit));
            const isSel = selectedClients.includes(c.id);
            return (
              <div key={c.id} className={cn("bg-zinc-900/40 border rounded-[2rem] p-4 flex items-center justify-between transition-all", isSel ? "border-amber-500 ring-1 ring-amber-500" : "border-white/5")}>
                <div className="flex items-center gap-3">
                  {isSelectionMode ? (
                    <button onClick={() => setSelectedClients(prev => isSel ? prev.filter(id => id !== c.id) : [...prev, c.id])}>
                      {isSel ? <CheckSquare className="text-amber-500" /> : <Square className="text-zinc-700" />}
                    </button>
                  ) : (
                    <div className="w-10 h-10 bg-amber-500/10 rounded-full flex items-center justify-center text-amber-500 font-black">{c.name?.[0]}</div>
                  )}
                  <div>
                    <p className="font-black text-sm tracking-tight">{c.name}</p>
                    <p className="text-[10px] text-zinc-600 font-bold">R$ {c.price} • {c.services?.join(', ')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right mr-2">
                    <p className={cn("text-xl font-black tracking-tighter", days >= 20 ? "text-red-500" : "text-amber-500")}>{days}d</p>
                  </div>
                  <button onClick={() => refreshVisit(c.id)} className="p-3 bg-emerald-500/10 text-emerald-500 rounded-xl"><RefreshCw size={18} /></button>
                  <a href={`https://wa.me/55${c.phone}`} className="p-3 bg-amber-500 text-black rounded-xl"><MessageSquare size={18} /></a>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Modal Perfil (Ajustado para Salvar) */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-6 backdrop-blur-md">
          <div className="bg-zinc-900 border border-white/10 w-full max-w-sm rounded-[2.5rem] p-8 text-center">
            <h3 className="text-2xl font-black mb-2">SEU NOME</h3>
            <p className="text-zinc-500 text-[10px] mb-6 uppercase font-bold tracking-widest">Para personalizar a dashboard</p>
            <input autoFocus placeholder="Ex: Barbeiro" value={userName} onChange={e => setUserName(e.target.value)} className="w-full bg-black border border-white/10 rounded-2xl p-4 mb-4 text-center font-bold text-white outline-none focus:border-amber-500" />
            <button onClick={updateProfile} className="w-full bg-amber-500 text-black py-4 rounded-2xl font-black">SALVAR PERFIL</button>
          </div>
        </div>
      )}

      {/* Modal Cadastro (Premium) */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-white/10 w-full max-w-md rounded-[2.5rem] p-8">
            <h3 className="text-xl font-black mb-6 text-center italic">NOVO CLIENTE</h3>
            <form onSubmit={addClient} className="space-y-4">
              <input required placeholder="Nome" value={newName} onChange={e => setNewName(e.target.value)} className="w-full bg-black border border-white/10 rounded-xl p-4 outline-none focus:border-amber-500" />
              <input required placeholder="WhatsApp (DDD+Número)" value={newPhone} onChange={e => setNewPhone(e.target.value)} className="w-full bg-black border border-white/10 rounded-xl p-4 outline-none focus:border-amber-500" />
              <div className="grid grid-cols-2 gap-3">
                <input type="number" placeholder="Valor R$" value={newPrice} onChange={e => setNewPrice(e.target.value)} className="w-full bg-black border border-white/10 rounded-xl p-4 outline-none focus:border-amber-500" />
                <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} className="w-full bg-black border border-white/10 rounded-xl p-4 outline-none focus:border-amber-500" />
              </div>
              <div className="flex gap-2">
                {['Cabelo', 'Barba'].map(s => (
                  <button key={s} type="button" onClick={() => setSelectedServices(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])} className={cn("flex-1 py-3 rounded-xl text-[10px] font-black uppercase border", selectedServices.includes(s) ? "bg-amber-500 border-amber-500 text-black" : "bg-black border-white/10 text-zinc-600")}>{s}</button>
                ))}
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 text-zinc-500 font-black">SAIR</button>
                <button type="submit" className="flex-1 bg-amber-500 text-black py-4 rounded-xl font-black">SALVAR</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
