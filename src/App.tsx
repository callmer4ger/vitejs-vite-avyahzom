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

  const fetchClients = async () => {
    if (!session) return;
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

  useEffect(() => {
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
      fetchClients(); 
    } else {
      alert("Erro ao salvar.");
    }
  };

  const deleteClient = async (id: string) => {
    if (!session) return;
    const { error } = await supabase.from('clientes').delete().eq('id', id);
    if (!error) {
      setClientToDelete(null);
      fetchClients();
    }
  };

  const refreshClientVisit = async (id: string) => {
    const today = new Date().toISOString().split('T')[0];
    const { error } = await supabase
      .from('clientes')
      .update({ last_visit: today })
      .eq('id', id);
    
    if (!error) {
      fetchClients(); 
    } else {
      alert("Erro ao renovar.");
    }
  };

  const filteredClients = useMemo(() => {
    return clients.filter(client => 
      client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      client.phone.includes(searchTerm)
    ).sort((a, b) => new Date(b.lastVisit).getTime() - new Date(a.lastVisit).getTime());
  }, [clients, searchTerm]);

  const stats = useMemo(() => {
    const total = clients.length;
    const needsRecovery = clients.filter(c => {
      const days = differenceInDays(new Date(), parseISO(c.lastVisit));
      return days >= RECOVERY_THRESHOLD_DAYS;
    }).length;
    return { total, needsRecovery };
  }, [clients]);

  const getWhatsAppLink = (client: Client) => {
    const message = encodeURIComponent(`Olá ${client.name}! Tudo bem? Notei que faz um tempinho que você não passa aqui na barbearia. Que tal agendarmos um horário? ✂️💈`);
    return `https://wa.me/55${client.phone.replace(/\D/g, '')}?text=${message}`;
  };

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
            <div className="w-16 h-16 bg-amber-500 rounded-2xl flex items-center justify-center mb-6">
              <Scissors className="text-black w-8 h-8" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Recuperador <span className="text-amber-500">Barber Pro</span></h1>
          </div>
          <div className="bg-[#141414] border border-white/5 p-8 rounded-3xl">
            <form onSubmit={handleLogin} className="space-y-6">
              <input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="E-mail" className="w-full bg-stone-900 border border-white/5 rounded-xl px-4 py-3.5" />
              <input required type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Senha" className="w-full bg-stone-900 border border-white/5 rounded-xl px-4 py-3.5" />
              <button type="submit" className="w-full bg-amber-500 text-black py-4 rounded-xl font-bold">Entrar</button>
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
          <h1 className="text-xl font-bold tracking-tight">Barber <span className="text-amber-500">Pro</span></h1>
          <div className="flex items-center gap-4">
            <button onClick={() => setIsModalOpen(true)} className="bg-amber-500 text-black px-4 py-2 rounded-full font-bold flex items-center gap-2">
              <UserPlus size={18} /> <span className="hidden sm:inline">Novo Cliente</span>
            </button>
            <button onClick={handleLogout} className="text-stone-500"><LogOut size={20} /></button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-[#141414] border border-white/5 p-6 rounded-2xl">
            <p className="text-xs text-stone-500 uppercase mb-2">Total</p>
            <p className="text-3xl font-bold">{stats.total}</p>
          </div>
          <div className="bg-[#141414] border border-white/5 p-6 rounded-2xl">
            <p className="text-xs text-stone-500 uppercase mb-2 text-red-500">Recuperar</p>
            <p className="text-3xl font-bold text-red-500">{stats.needsRecovery}</p>
          </div>
          <div className="bg-[#141414] border border-white/5 p-6 rounded-2xl">
            <p className="text-xs text-stone-500 uppercase mb-2 text-emerald-500">Fidelidade</p>
            <p className="text-3xl font-bold text-emerald-500">{stats.total > 0 ? Math.round(((stats.total - stats.needsRecovery) / stats.total) * 100) : 0}%</p>
          </div>
        </div>

        <div className="bg-[#141414] border border-white/5 rounded-2xl">
          <div className="p-6 border-b border-white/5 flex flex-col md:flex-row justify-between gap-4">
            <h2 className="text-lg font-semibold flex items-center gap-2"><Users className="text-amber-500" /> Clientes</h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
              <input type="text" placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="bg-stone-900 border border-white/5 rounded-xl pl-10 pr-4 py-2 w-full md:w-64 focus:outline-none" />
            </div>
          </div>

          <div className="overflow-hidden">
            {/* LISTA COMPACTA PARA CELULAR E TABELA PARA PC */}
            <div className="grid grid-cols-1 divide-y divide-white/5">
              {filteredClients.map((client) => {
                const days = differenceInDays(new Date(), parseISO(client.lastVisit));
                const isOverdue = days >= RECOVERY_THRESHOLD_DAYS;
                return (
                  <div key={client.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-white/[0.02]">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-amber-500/10 rounded-full flex items-center justify-center text-amber-500 font-bold">{client.name[0].toUpperCase()}</div>
                      <div>
                        <p className="font-medium text-stone-200">{client.name}</p>
                        <p className="text-xs text-stone-500">{client.phone}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between md:gap-12 px-2 md:px-0">
                      <div className="md:text-center">
                        <p className="text-[10px] text-stone-500 uppercase">Último Corte</p>
                        <p className="text-sm">{format(parseISO(client.lastVisit), "dd/MM/yy")}</p>
                      </div>
                      <div className="text-right md:text-center">
                        <p className="text-[10px] text-stone-500 uppercase">Sem cortar há</p>
                        <p className={`text-lg font-black ${isOverdue ? 'text-red-500' : 'text-amber-500'}`}>{days} dias</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-3 md:pt-0 border-t border-white/5 md:border-0">
                      <button onClick={() => refreshClientVisit(client.id)} className="flex-1 md:flex-none p-2.5 bg-green-500/10 text-green-500 border border-green-500/20 rounded-xl flex items-center justify-center"><RefreshCw size={18} /></button>
                      <a href={getWhatsAppLink(client)} target="_blank" rel="noopener noreferrer" className="flex-1 md:flex-none p-2.5 bg-amber-500 text-black rounded-xl flex items-center justify-center"><MessageSquare size={18} /></a>
                      <button onClick={() => setClientToDelete(client.id)} className="p-2.5 bg-stone-800 text-stone-500 rounded-xl"><Trash2 size={18} /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </main>

      {/* MODAL EXCLUIR */}
      {clientToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/90">
          <div className="bg-[#141414] border border-white/10 p-6 rounded-3xl w-full max-w-sm text-center">
            <h3 className="text-xl font-bold text-white mb-4">Excluir Cliente?</h3>
            <div className="flex gap-3">
              <button onClick={() => setClientToDelete(null)} className="flex-1 py-3 bg-stone-800 rounded-xl font-bold">Voltar</button>
              <button onClick={() => deleteClient(clientToDelete)} className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold">Excluir</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NOVO CLIENTE */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
          <div className="bg-[#141414] border border-white/10 w-full max-w-md rounded-3xl p-6">
            <h3 className="text-xl font-bold mb-4">Cadastrar Cliente</h3>
            <form onSubmit={addClient} className="space-y-4">
              <input required type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nome" className="w-full bg-stone-900 border border-white/5 rounded-xl px-4 py-3" />
              <input required type="tel" value={newPhone} onChange={e => setNewPhone(e.target.value)} placeholder="WhatsApp" className="w-full bg-stone-900 border border-white/5 rounded-xl px-4 py-3" />
              <input required type="date" value={newDate} onChange={e => setNewDate(e.target.value)} className="w-full bg-stone-900 border border-white/5 rounded-xl px-4 py-3" />
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-3 border border-white/5 rounded-xl font-bold">Cancelar</button>
                <button type="submit" className="flex-1 bg-amber-500 text-black py-3 rounded-xl font-bold">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
