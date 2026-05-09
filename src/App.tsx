import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  UserPlus, 
  MessageSquare, 
  Calendar, 
  Search, 
  TrendingUp, 
  AlertCircle, 
  Trash2,
  ExternalLink,
  Scissors,
  LogOut,
  Mail,
  Lock,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { format, differenceInDays, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { supabase } from './lib/supabase';

// Utility for Tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Client {
  id: string;
  name: string;
  phone: string;
  lastVisit: string;
  createdAt: string;
}

const RECOVERY_THRESHOLD_DAYS = 20;

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [clients, setClients] = useState<Client[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newDate, setNewDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [clientToDelete, setClientToDelete] = useState<string | null>(null);
  
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;

    const fetchClients = async () => {
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .order('last_visit', { ascending: false });

      if (!error && data) {
        setClients(data.map(c => ({
          id: c.id,
          name: c.name,
          phone: c.phone,
          lastVisit: c.last_visit,
          createdAt: c.created_at
        })));
      }
    };

    fetchClients();

    const channel = supabase
      .channel('db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clientes' }, () => {
        fetchClients();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [session]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setLoginError('E-mail ou senha incorretos.');
    setIsLoggingIn(false);
  };

  const handleLogout = async () => { await supabase.auth.signOut(); };

  const addClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newPhone || !session) return;

    const newClient = {
      name: newName,
      phone: newPhone.replace(/\D/g, ''),
      last_visit: newDate,
      user_id: session.user.id
    };

    const { data, error } = await supabase.from('clientes').insert([newClient]).select();

    if (!error && data) {
      setNewName('');
      setNewPhone('');
      setNewDate(format(new Date(), 'yyyy-MM-dd'));
      setIsModalOpen(false);
    } else {
      alert("Erro ao salvar no banco.");
    }
  };

  const deleteClient = async (id: string) => {
    if (!session) return;
    await supabase.from('clientes').delete().eq('id', id);
    setClientToDelete(null);
  };

  const refreshClientVisit = async (id: string) => {
    const today = new Date().toISOString().split('T')[0];
    await supabase.from('clientes').update({ last_visit: today }).eq('id', id);
  };

  const filteredClients = useMemo(() => {
    return clients.filter(client => 
      client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.phone.includes(searchTerm)
    );
  }, [clients, searchTerm]);

  const stats = useMemo(() => {
    const total = clients.length;
    const needsRecovery = clients.filter(c => {
      const days = differenceInDays(new Date(), parseISO(c.lastVisit));
      return days >= RECOVERY_THRESHOLD_DAYS;
    }).length;
    return { total, needsRecovery };
  }, [clients]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-stone-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-8">
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-amber-500 rounded-2xl flex items-center justify-center shadow-2xl shadow-amber-500/20 mb-6">
              <Scissors className="text-black w-8 h-8" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Recuperador <span className="text-amber-500">Barber Pro</span></h1>
            <p className="text-stone-500 mt-2">Cascavel, PR - Gestão Premium</p>
          </div>

          <div className="bg-[#141414] border border-white/5 p-8 rounded-3xl shadow-xl">
            <form onSubmit={handleLogin} className="space-y-6">
              {loginError && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-500 text-sm p-4 rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {loginError}
                </div>
              )}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-stone-500 uppercase ml-1">E-mail</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
                  <input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" className="w-full bg-stone-900 border border-white/5 rounded-xl pl-11 pr-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500/50 transition-all" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-stone-500 uppercase ml-1">Senha</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
                  <input required type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" className="w-full bg-stone-900 border border-white/5 rounded-xl pl-11 pr-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500/50 transition-all" />
                </div>
              </div>
              <button disabled={isLoggingIn} type="submit" className="w-full bg-amber-500 hover:bg-amber-400 text-black py-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2">
                {isLoggingIn ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Entrar na Dashboard'}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-stone-100 font-sans">
      <header className="border-b border-white/5 bg-[#0f0f0f]/80 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-500 rounded-lg flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Scissors className="text-black w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold tracking-tight hidden sm:block">Barber <span className="text-amber-500">Pro</span></h1>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-black px-4 py-2 rounded-full font-bold transition-all text-sm">
              <UserPlus className="w-4 h-4" />
              <span className="hidden sm:inline">Novo Cliente</span>
            </button>
            <button onClick={handleLogout} className="p-2 text-stone-500 hover:text-red-500 transition-colors"><LogOut className="w-5 h-5" /></button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="bg-[#141414] border border-white/5 p-4 rounded-2xl">
            <span className="text-[10px] font-medium text-stone-500 uppercase block mb-1">Total</span>
            <p className="text-2xl font-bold">{stats.total}</p>
          </div>
          <div className="bg-[#141414] border border-white/5 p-4 rounded-2xl">
            <span className="text-[10px] font-medium text-stone-500 uppercase block mb-1 text-red-500">Recuperar</span>
            <p className="text-2xl font-bold text-red-500">{stats.needsRecovery}</p>
          </div>
          <div className="bg-[#141414] border border-white/5 p-4 rounded-2xl col-span-2 md:col-span-1">
            <span className="text-[10px] font-medium text-stone-500 uppercase block mb-1 text-emerald-500">Fidelidade</span>
            <p className="text-2xl font-bold text-emerald-500">{stats.total > 0 ? Math.round(((stats.total - stats.needsRecovery) / stats.total) * 100) : 0}%</p>
          </div>
        </div>

        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500 group-focus-within:text-amber-500 transition-colors" />
          <input type="text" placeholder="Buscar cliente..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="bg-[#141414] border border-white/5 rounded-2xl pl-11 pr-4 py-3.5 w-full focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500/50 transition-all" />
        </div>

        <div className="space-y-3">
          {filteredClients.map((client) => {
            const days = differenceInDays(new Date(), parseISO(client.lastVisit));
            const isOverdue = days >= RECOVERY_THRESHOLD_DAYS;
            return (
              <div key={client.id} className="bg-[#141414] border border-white/5 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 group hover:border-amber-500/30 transition-all">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-amber-500/10 rounded-full flex items-center justify-center text-amber-500 font-bold text-xl">{client.name[0].toUpperCase()}</div>
                  <div>
                    <h4 className="text-white font-bold leading-tight">{client.name}</h4>
                    <p className="text-xs text-stone-500">{client.phone}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between md:justify-center gap-8 px-2">
                  <div className="text-center">
                    <p className="text-[10px] uppercase text-stone-500 tracking-widest">Último Corte</p>
                    <p className="text-sm font-medium">{format(parseISO(client.lastVisit), "dd/MM/yy")}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] uppercase text-stone-500 tracking-widest">Tempo</p>
                    <p className={`text-lg font-black ${isOverdue ? 'text-red-500' : 'text-amber-500'}`}>{days} dias</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-3 md:pt-0 border-t border-white/5 md:border-0">
                  <button onClick={() => refreshClientVisit(client.id)} className="flex-1 md:flex-none p-3 bg-emerald-500/10 text-emerald-500 rounded-xl hover:bg-emerald-500/20 transition-all flex items-center justify-center" title="Zerar dias"><RefreshCw size={18} /></button>
                  <a href={`https://wa.me/55${client.phone}`} target="_blank" rel="noopener noreferrer" className="flex-1 md:flex-none p-3 bg-amber-500 text-black rounded-xl hover:bg-amber-400 transition-all flex items-center justify-center"><MessageSquare size={18} /></a>
                  <button onClick={() => setClientToDelete(client.id)} className="p-3 bg-stone-800 text-stone-500 rounded-xl hover:text-red-500 transition-all flex items-center justify-center"><Trash2 size={18} /></button>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* MODAL DE EXCLUIR */}
      {clientToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/90 backdrop-blur-sm">
          <div className="bg-[#141414] border border-white/10 p-6 rounded-3xl w-full max-w-sm text-center shadow-2xl animate-in zoom-in duration-200">
            <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mb-4 mx-auto"><Trash2 size={32} /></div>
            <h3 className="text-xl font-bold mb-2 text-white">Excluir Cliente?</h3>
            <p className="text-stone-500 text-sm mb-8">Essa ação é permanente e não poderá ser desfeita.</p>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setClientToDelete(null)} className="py-3.5 rounded-2xl bg-stone-800 font-bold hover:bg-stone-700 transition-all">Cancelar</button>
              <button onClick={() => deleteClient(clientToDelete)} className="py-3.5 rounded-2xl bg-red-600 text-white font-bold hover:bg-red-700 transition-all">Excluir</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NOVO CLIENTE */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <div className="bg-[#141414] border border-white/10 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl relative animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-white/5 bg-[#1a1a1a]">
              <h3 className="text-xl font-bold">Cadastrar Cliente</h3>
            </div>
            <form onSubmit={addClient} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-500 uppercase mb-1.5 ml-1">Nome</label>
                <input autoFocus required type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Ex: João Silva" className="w-full bg-stone-900 border border-white/5 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500/50 transition-all" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-500 uppercase mb-1.5 ml-1">WhatsApp</label>
                <input required type="tel" value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="Ex: 45999999999" className="w-full bg-stone-900 border border-white/5 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500/50 transition-all" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-500 uppercase mb-1.5 ml-1">Última Visita</label>
                <input required type="date" value={newDate} onChange={e => setNewDate(e.target.value)} className="w-full bg-stone-900 border border-white/5 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500/50 transition-all" />
              </div>
              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 rounded-xl border border-white/5 text-stone-400 font-bold hover:bg-white/5 transition-colors">Cancelar</button>
                <button type="submit" className="flex-1 bg-amber-500 hover:bg-amber-400 text-black py-3 rounded-xl font-bold transition-all">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
