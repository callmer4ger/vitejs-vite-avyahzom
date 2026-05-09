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
    if (data?.full_name) setUserName(data.full_name);
    else setIsProfileModalOpen(true);
  };

  const updateProfile = async () => {
    if (!userName.trim() || !session) return;
    const { error } = await supabase.from('profiles').upsert({ id: session.user.id, full_name: userName });
    if (!error) {
      setIsProfileModalOpen(false);
      fetchProfile(session.user.id);
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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setLoginError('Erro no login.');
  };

  const faturamento = useMemo(() => {
    const range = { 'today': startOfDay(new Date()), 'week': subDays(new Date(), 7), 'month': subDays(new Date(), 30) }[filterPeriod] || new Date(0);
    return clients.filter(c => c.last_visit && parseISO(c.last_visit) >= range).reduce((acc, curr) => acc + (Number(curr.price) || 0), 0);
  }, [clients, filterPeriod]);

  if (authLoading) return <div className="min-h-screen bg-black flex items-center justify-center"><Loader2 className="animate-spin text-amber-500" /></div>;

  if (!session) return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <form onSubmit={handleLogin} className="bg-zinc-900 p-8 rounded-[2rem] w-full max-w-sm space-y-4 border border-white/5 shadow-2xl">
        <h1 className="text-3xl font-black text-center text-white italic">BARBER <span className="text-amber-500">PRO</span></h1>
        {loginError && <p className="text-red-500 text-xs text-center">{loginError}</p>}
        <input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="E-mail" className="w-full bg-black border border-white/10 rounded-2xl p-4 text-white outline-none focus:border-amber-500" />
        <input required type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Senha" className="w-full bg-black border border-white/10 rounded-2xl p-4 text-white outline-none focus:border-amber-500" />
        <button className="w-full bg-amber-500 text-black py-4 rounded-2xl font-black hover:bg-amber-400 transition-all">ENTRAR</button>
      </form>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <header className="border-b border-white/5 bg-zinc-900/80 backdrop-blur-md sticky top-0 z-30 px-6 h-20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/20"><Scissors size={20} className="text-black" /></div>
          <div>
            <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest leading-none">Olá, {userName || 'Barbeiro'}!</p>
            <h1 className="text-xl font-black tracking-tighter italic">BARBER <span className="text-amber-500">PRO</span></h1>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setIsProfileModalOpen(true)} className="p-2 text-zinc-500 hover:text-amber-500"><UserIcon size={20} /></button>
          <button onClick={() => setIsModalOpen(true)} className="bg-amber-500 text-black px-4 py-2 rounded-full font-black text-xs hover:scale-105 transition-all"><UserPlus size={16} /></button>
          <button onClick={() => supabase.auth.signOut()} className="text-zinc-600 hover:text-red-500 ml-2"><LogOut size={20} /></button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 py-8 space-y-6">
        <div className="bg-zinc-900 border border-white/5 p-6 rounded-3xl">
          <p className="text-[10px] text-zinc-500 font-bold uppercase mb-1 tracking-widest">Faturamento ({filterPeriod})</p>
          <p className="text-4xl font-black text-emerald-500">R$ {faturamento}</p>
        </div>
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
          <input type="text" placeholder="Buscar cliente..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-zinc-900 border border-white/5 rounded-2xl pl-12 pr-4 py-4 outline-none focus:border-amber-500 transition-all" />
        </div>
        <div className="space-y-4">
          {clients.filter(c => (c.name || '').toLowerCase().includes(searchTerm.toLowerCase())).map(c => {
            const days = differenceInDays(new Date(), parseISO(c.last_visit));
            return (
              <div key={c.id} className="bg-zinc-900/50 border border-white/5 rounded-[2rem] p-5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-amber-500/10 rounded-full flex items-center justify-center text-amber-500 font-black text-xl">{c.name?.[0]?.toUpperCase()}</div>
                  <div>
                    <p className="font-black text-lg tracking-tight">{c.name}</p>
                    <p className="text-[10px] text-zinc-600">R$ {c.price || 0}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={cn("text-2xl font-black tracking-tighter", days >= 20 ? "text-red-500" : "text-amber-500")}>{days}d</p>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {isProfileModalOpen && (
        <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-6 backdrop-blur-md">
          <div className="bg-zinc-900 border border-white/10 w-full max-w-sm rounded-[2.5rem] p-8 text-center shadow-2xl">
            <h3 className="text-2xl font-black mb-2 tracking-tight">COMO SE CHAMA?</h3>
            <p className="text-zinc-500 text-[10px] mb-6 uppercase font-bold tracking-widest">Para sua dashboard</p>
            <input autoFocus placeholder="Ex: Barbeiro" value={userName} onChange={e => setUserName(e.target.value)} className="w-full bg-black border border-white/10 rounded-2xl p-4 mb-4 text-center font-bold text-white outline-none focus:border-amber-500" />
            <button onClick={updateProfile} className="w-full bg-amber-500 text-black py-4 rounded-2xl font-black hover:bg-amber-400 transition-all">SALVAR PERFIL</button>
          </div>
        </div>
      )}
    </div>
  );
}
