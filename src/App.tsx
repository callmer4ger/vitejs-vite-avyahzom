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
    try {
      const { data } = await supabase.from('profiles').select('full_name').eq('id', userId).maybeSingle();
      if (data?.full_name) {
        setUserName(data.full_name);
        setIsProfileModalOpen(false);
      } else {
        setIsProfileModalOpen(true);
      }
    } catch (e) {
      setIsProfileModalOpen(true);
    }
  };

  const updateProfile = async () => {
    if (!userName.trim() || !session) return;
    
    // Agora salvando APENAS o nome para evitar erros de colunas extras
    const { error } = await supabase.from('profiles').upsert({ 
      id: session.user.id, 
      full_name: userName.trim()
    });

    if (error) {
      alert("Erro ao salvar: " + error.message);
    } else {
      setIsProfileModalOpen(false);
      setUserName(userName.trim());
    }
  };

  const fetchClients = async () => {
    if (!session) return;
    const { data } = await supabase.from('clientes').select('*').order('last_visit', { ascending: false });
    if (data) setClients(data.map(c => ({ ...c, services: c.services || [], price: Number(c.price) || 0 })));
  };

  useEffect(() => { fetchClients(); }, [session]);

  const addClient = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from('clientes').insert([{
      name: newName, phone: newPhone.replace(/\D/g, ''), last_visit: newDate,
      user_id: session.user.id, services: selectedServices, price: Number(newPrice) || 0
    }]);
    if (!error) { setIsModalOpen(false); fetchClients(); }
  };

  const stats = useMemo(() => {
    const total = clients.length;
    const needsRecovery = clients.filter(c => differenceInDays(new Date(), parseISO(c.last_visit || new Date().toISOString())) >= 20).length;
    const fidelity = total > 0 ? Math.round(((total - needsRecovery) / total) * 100) : 0;
    const range = { 'today': startOfDay(new Date()), 'week': subDays(new Date(), 7), 'month': subDays(new Date(), 30) }[filterPeriod] || new Date(0);
    const faturamento = clients.filter(c => parseISO(c.last_visit) >= range).reduce((acc, curr) => acc + (Number(curr.price) || 0), 0);
    return { total, needsRecovery, fidelity, faturamento };
  }, [clients, filterPeriod]);

  if (authLoading) return <div className="min-h-screen bg-[#050505] flex items-center justify-center"><Loader2 className="animate-spin text-amber-500" /></div>;

  if (!session) return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6 text-white font-sans">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <div className="w-16 h-16 bg-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-4"><Scissors className="text-black" /></div>
          <h1 className="text-3xl font-black italic tracking-tighter uppercase">BARBER <span className="text-amber-500">PRO</span></h1>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); supabase.auth.signInWithPassword({ email, password }); }} className="bg-zinc-900/50 p-8 rounded-[2rem] border border-white/5 space-y-4">
          <input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="E-mail" className="w-full bg-black border border-white/10 rounded-2xl p-4 outline-none focus:border-amber-500" />
          <input required type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Senha" className="w-full bg-black border border-white/10 rounded-2xl p-4 outline-none focus:border-amber-500" />
          <button className="w-full bg-amber-500 text-black py-4 rounded-2xl font-black uppercase">ENTRAR</button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <header className="sticky top-0 z-40 px-6 h-20 flex items-center justify-between bg-zinc-900/80 backdrop-blur-md border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center"><Scissors size={20} className="text-black" /></div>
          <div>
            <p className="text-[10px] font-black text-amber-500 uppercase leading-none">Olá, {userName || 'Barbeiro'}!</p>
            <h1 className="text-lg font-black tracking-tighter italic">BARBER <span className="text-amber-500">PRO</span></h1>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setIsSelectionMode(!isSelectionMode)} className={cn("p-2 rounded-lg", isSelectionMode ? "bg-amber-500 text-black" : "text-zinc-500")}><Trash2 size={20} /></button>
          <button onClick={() => setIsModalOpen(true)} className="bg-amber-500 text-black p-2 rounded-xl"><UserPlus size={20} /></button>
          <button onClick={() => setIsProfileModalOpen(true)} className="p-2 text-zinc-500"><UserIcon size={20} /></button>
          <button onClick={() => supabase.auth.signOut()} className="text-zinc-600 ml-2"><LogOut size={20} /></button>
        </div>
      </header>

      <main className="p-4 space-y-6 max-w-lg mx-auto">
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
            <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest text-emerald-500">Ganhos (R$)</p>
            <p className="text-2xl font-black text-emerald-500">{stats.faturamento}</p>
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
          <input type="text" placeholder="Buscar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-zinc-900 border border-white/5 rounded-2xl pl-12 pr-4 py-4 outline-none" />
        </div>

        <div className="space-y-3">
          {clients.filter(c => (c.name || '').toLowerCase().includes(searchTerm.toLowerCase())).map(c => {
            const days = differenceInDays(new Date(), parseISO(c.last_visit));
            const isSel = selectedClients.includes(c.id);
            return (
              <div key={c.id} className={cn("bg-zinc-900/40 border rounded-[2rem] p-4 flex items-center justify-between", isSel ? "border-amber-500" : "border-white/5")}>
                <div className="flex items-center gap-3">
                  {isSelectionMode ? (
                    <button onClick={() => setSelectedClients(prev => isSel ? prev.filter(id => id !== c.id) : [...prev, c.id])}>
                      {isSel ? <CheckSquare className="text-amber-500" /> : <Square className="text-zinc-700" />}
                    </button>
                  ) : (
                    <div className="w-10 h-10 bg-zinc-800 rounded-full flex items-center justify-center text-amber-500 font-black">{c.name?.[0]?.toUpperCase()}</div>
                  )}
                  <div>
                    <p className="font-black text-sm">{c.name}</p>
                    <p className="text-[10px] text-zinc-600 font-bold">R$ {c.price} • {c.services?.join(', ')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <p className={cn("text-xl font-black", days >= 20 ? "text-red-500" : "text-amber-500")}>{days}d</p>
                  <button onClick={() => refreshVisit(c.id)} className="p-3 bg-emerald-500/10 text-emerald-500 rounded-xl"><RefreshCw size={16} /></button>
                  <a href={`https://wa.me/55${c.phone}`} className="p-3 bg-amber-500 text-black rounded-xl"><MessageSquare size={16} /></a>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* MODAL DE PERFIL */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-8 backdrop-blur-md text-white">
          <div className="bg-zinc-900 border border-white/10 w-full max-w-sm rounded-[2.5rem] p-10 text-center shadow-2xl">
            <h3 className="text-2xl font-black mb-2 tracking-tight">SEU NOME</h3>
            <p className="text-zinc-500 text-[10px] mb-8 uppercase font-bold tracking-widest">Para personalizar sua dashboard</p>
            <input autoFocus placeholder="Ex: Barbeiro" value={userName} onChange={e => setUserName(e.target.value)} className="w-full bg-black border border-white/10 rounded-2xl p-5 mb-6 text-center font-bold outline-none focus:border-amber-500" />
            <button onClick={updateProfile} className="w-full bg-amber-500 text-black py-5 rounded-2xl font-black uppercase text-xs active:scale-95 transition-all">SALVAR PERFIL</button>
          </div>
        </div>
      )}

      {/* MODAL NOVO CLIENTE */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-white/10 w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl">
            <h3 className="text-xl font-black mb-6 text-center italic tracking-tighter">NOVO CLIENTE</h3>
            <form onSubmit={addClient} className="space-y-4">
              <input required placeholder="Nome" value={newName} onChange={e => setNewName(e.target.value)} className="w-full bg-black border border-white/10 rounded-xl p-4 outline-none focus:border-amber-500" />
              <input required placeholder="WhatsApp" value={newPhone} onChange={e => setNewPhone(e.target.value)} className="w-full bg-black border border-white/10 rounded-xl p-4 outline-none focus:border-amber-500" />
              <div className="grid grid-cols-2 gap-3">
                <input type="number" placeholder="Valor R$" value={newPrice} onChange={e => setNewPrice(e.target.value)} className="w-full bg-black border border-white/10 rounded-xl p-4 outline-none focus:border-amber-500" />
                <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} className="w-full bg-black border border-white/10 rounded-xl p-4 outline-none focus:border-amber-500 text-xs" />
              </div>
              <div className="flex gap-2">
                {['Cabelo', 'Barba', 'Sobrancelha'].map(s => (
                  <button key={s} type="button" onClick={() => setSelectedServices(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])} className={cn("flex-1 py-3 rounded-xl text-[9px] font-black uppercase border transition-all", selectedServices.includes(s) ? "bg-amber-500 border-amber-500 text-black" : "bg-black border-white/10 text-zinc-600")}>{s}</button>
                ))}
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 text-zinc-500 font-black uppercase text-xs">Sair</button>
                <button type="submit" className="flex-1 bg-amber-500 text-black py-4 rounded-xl font-black uppercase text-xs">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
