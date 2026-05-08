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
  Loader2
} from 'lucide-react';
import { format, differenceInDays, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { supabase } from './supabase';

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

const STORAGE_KEY = 'barber_recover_clients';
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
  
  // Form State for new client
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newDate, setNewDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  // Auth Listener
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

  // Load client data
  useEffect(() => {
    if (session) {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          setClients(JSON.parse(saved));
        } catch (e) {
          console.error("Failed to load clients", e);
        }
      }
    }
  }, [session]);

  // Save client data
  useEffect(() => {
    if (session) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(clients));
    }
  }, [clients, session]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginError('');
    
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setLoginError('E-mail ou senha incorretos.');
    }
    setIsLoggingIn(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const addClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newPhone) return;

    const newClient: Client = {
      id: crypto.randomUUID(),
      name: newName,
      phone: newPhone.replace(/\D/g, ''),
      lastVisit: newDate,
      createdAt: new Date().toISOString()
    };

    setClients([newClient, ...clients]);
    setNewName('');
    setNewPhone('');
    setNewDate(format(new Date(), 'yyyy-MM-dd'));
    setIsModalOpen(false);
  };

  const deleteClient = (id: string) => {
    if (confirm('Tem certeza que deseja excluir este cliente?')) {
      setClients(clients.filter(c => c.id !== id));
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
    const message = encodeURIComponent(`Olá ${client.name}! Tudo bem? Notei que faz um tempinho que você não passa aqui na barbearia para dar aquele talento. Que tal agendarmos um horário para essa semana? Estaremos te esperando! ✂️💈`);
    return `https://wa.me/55${client.phone}?text=${message}`;
  };

  const getClientStatus = (lastVisit: string) => {
    const days = differenceInDays(new Date(), parseISO(lastVisit));
    if (days >= RECOVERY_THRESHOLD_DAYS) {
      return { 
        label: 'Recuperar', 
        color: 'text-red-500 bg-red-500/10 border-red-500/20',
        icon: <AlertCircle className="w-4 h-4" />,
        isOverdue: true,
        days
      };
    }
    return { 
      label: 'Em dia', 
      color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
      icon: <TrendingUp className="w-4 h-4" />,
      isOverdue: false,
      days
    };
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
            <div className="w-16 h-16 bg-amber-500 rounded-2xl flex items-center justify-center shadow-2xl shadow-amber-500/20 mb-6">
              <Scissors className="text-black w-8 h-8" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Recuperador <span className="text-amber-500">Barber Pro</span></h1>
            <p className="text-stone-500 mt-2">Acesse sua conta para gerenciar seus clientes.</p>
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
                  <input 
                    required
                    type="email" 
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    className="w-full bg-stone-900 border border-white/5 rounded-xl pl-11 pr-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500/50 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-stone-500 uppercase ml-1">Senha</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
                  <input 
                    required
                    type="password" 
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-stone-900 border border-white/5 rounded-xl pl-11 pr-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500/50 transition-all"
                  />
                </div>
              </div>

              <button 
                disabled={isLoggingIn}
                type="submit" 
                className="w-full bg-amber-500 hover:bg-amber-400 disabled:bg-amber-800 disabled:text-stone-500 text-black py-4 rounded-xl font-bold transition-all active:scale-[0.98] shadow-lg shadow-amber-500/10 flex items-center justify-center gap-2"
              >
                {isLoggingIn ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Entrar na Dashboard'}
              </button>
            </form>
          </div>
          
          <p className="text-center text-sm text-stone-600">
            Ainda não tem conta? <span className="text-amber-500 cursor-help underline decoration-amber-500/30">Fale com o suporte</span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-stone-100 font-sans selection:bg-amber-500/30">
      {/* Header */}
      <header className="border-b border-white/5 bg-[#0f0f0f]/80 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-500 rounded-lg flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Scissors className="text-black w-6 h-6" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-xl font-bold tracking-tight">Recuperador <span className="text-amber-500">Barber Pro</span></h1>
              <p className="text-xs text-stone-500 uppercase tracking-widest font-semibold">Dashboard do Barbeiro</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-4">
            <button 
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-black px-4 py-2 rounded-full font-bold transition-all active:scale-95 shadow-lg shadow-amber-500/10 text-sm"
            >
              <UserPlus className="w-4 h-4" />
              <span className="hidden sm:inline">Novo Cliente</span>
            </button>
            <button 
              onClick={handleLogout}
              className="p-2 text-stone-500 hover:text-red-500 transition-colors"
              title="Sair"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-[#141414] border border-white/5 p-6 rounded-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-stone-800 rounded-lg">
                <Users className="w-5 h-5 text-stone-400" />
              </div>
              <span className="text-xs font-medium text-stone-500 uppercase">Total de Clientes</span>
            </div>
            <p className="text-3xl font-bold">{stats.total}</p>
          </div>

          <div className="bg-[#141414] border border-white/5 p-6 rounded-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/5 -mr-8 -mt-8 rounded-full blur-3xl group-hover:bg-red-500/10 transition-colors" />
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-red-500/10 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-500" />
              </div>
              <span className="text-xs font-medium text-stone-500 uppercase">Precisam de Atenção</span>
            </div>
            <p className="text-3xl font-bold text-red-500">{stats.needsRecovery}</p>
            <p className="text-sm text-stone-500 mt-1">Há mais de {RECOVERY_THRESHOLD_DAYS} dias sem voltar</p>
          </div>

          <div className="bg-[#141414] border border-white/5 p-6 rounded-2xl md:col-span-2 lg:col-span-1">
             <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-emerald-500/10 rounded-lg">
                <TrendingUp className="w-5 h-5 text-emerald-500" />
              </div>
              <span className="text-xs font-medium text-stone-500 uppercase">Status Geral</span>
            </div>
            <p className="text-3xl font-bold">
              {stats.total > 0 ? Math.round(((stats.total - stats.needsRecovery) / stats.total) * 100) : 0}%
            </p>
            <p className="text-sm text-stone-500 mt-1">Taxa de fidelização atual</p>
          </div>
        </div>

        {/* Client List Section */}
        <div className="bg-[#141414] border border-white/5 rounded-2xl overflow-hidden">
          <div className="p-6 border-b border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Calendar className="w-5 h-5 text-amber-500" />
              Gestão de Retornos
            </h2>
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500 group-focus-within:text-amber-500 transition-colors" />
              <input 
                type="text" 
                placeholder="Buscar cliente..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-stone-900 border border-white/5 rounded-xl pl-10 pr-4 py-2 w-full md:w-64 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500/50 transition-all"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-stone-900/50 text-stone-500 text-xs uppercase tracking-wider">
                  <th className="px-6 py-4 font-semibold">Cliente</th>
                  <th className="px-6 py-4 font-semibold">Último Corte</th>
                  <th className="px-6 py-4 font-semibold">Tempo Decorrido</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredClients.map((client) => {
                  const status = getClientStatus(client.lastVisit);
                  return (
                    <tr key={client.id} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-medium text-stone-200 group-hover:text-amber-500 transition-colors">{client.name}</p>
                          <p className="text-xs text-stone-500">{client.phone}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-stone-400">
                        {format(parseISO(client.lastVisit), "dd 'de' MMM, yyyy", { locale: ptBR })}
                      </td>
                      <td className="px-6 py-4 text-sm text-stone-400">
                        {status.days} {status.days === 1 ? 'dia' : 'dias'}
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border",
                          status.color
                        )}>
                          {status.icon}
                          {status.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <a 
                            href={getWhatsAppLink(client)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={cn(
                              "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95",
                              status.isOverdue 
                                ? "bg-red-500 text-white hover:bg-red-600 shadow-lg shadow-red-500/20" 
                                : "bg-stone-800 text-stone-400 hover:bg-stone-700"
                            )}
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span className="hidden xs:inline">WhatsApp</span>
                            <ExternalLink className="w-3 h-3 opacity-50" />
                          </a>
                          <button 
                            onClick={() => deleteClient(client.id)}
                            className="p-1.5 text-stone-600 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredClients.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-stone-500 italic">
                      {searchTerm ? 'Nenhum cliente encontrado para sua busca.' : 'Nenhum cliente cadastrado ainda.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-4 py-12 border-t border-white/5">
        <div className="flex flex-col items-center gap-4 text-stone-600 text-sm">
          <p>© {new Date().getFullYear()} Recuperador Barber Pro. Sistema Premium de Gestão.</p>
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500" /> Logado como {session.user.email}</span>
            <span className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-amber-500" /> Local Storage habilitado</span>
          </div>
        </div>
      </footer>

      {/* Modal / Sidebar Form overlay */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
          <div className="bg-[#141414] border border-white/10 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl relative animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-white/5 bg-[#1a1a1a]">
              <h3 className="text-xl font-bold">Cadastrar Cliente</h3>
              <p className="text-sm text-stone-500">Adicione um novo cliente à sua base de dados.</p>
            </div>
            <form onSubmit={addClient} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-500 uppercase mb-1.5 ml-1">Nome Completo</label>
                <input 
                  autoFocus
                  required
                  type="text" 
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="Ex: João Silva"
                  className="w-full bg-stone-900 border border-white/5 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500/50 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-500 uppercase mb-1.5 ml-1">WhatsApp (com DDD)</label>
                <input 
                  required
                  type="tel" 
                  value={newPhone}
                  onChange={e => setNewPhone(e.target.value)}
                  placeholder="Ex: 11999999999"
                  className="w-full bg-stone-900 border border-white/5 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500/50 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-500 uppercase mb-1.5 ml-1">Data do Último Corte</label>
                <input 
                  required
                  type="date" 
                  value={newDate}
                  onChange={e => setNewDate(e.target.value)}
                  className="w-full bg-stone-900 border border-white/5 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500/50 transition-all"
                />
              </div>
              <div className="pt-4 flex gap-3">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-3 rounded-xl border border-white/5 text-stone-400 font-bold hover:bg-white/5 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="flex-1 bg-amber-500 hover:bg-amber-400 text-black px-4 py-3 rounded-xl font-bold transition-all active:scale-95 shadow-lg shadow-amber-500/10"
                >
                  Salvar Cliente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
