import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, UserPlus, MessageSquare, Calendar, Search, TrendingUp, 
  AlertCircle, Trash2, Scissors, LogOut, Mail, Lock, Loader2, 
  RefreshCw, CheckSquare, Square, DollarSign
} from 'lucide-react';
import { format, differenceInDays, parseISO, startOfDay, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from './lib/supabase';

interface Client {
  id: string;
  name: string;
  phone: string;
  lastVisit: string;
  createdAt: string;
  services?: string[];
  price?: number;
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
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  const fetchClients = async () => {
    if (!session) return;
    try {
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .order('last_visit', { ascending: false });

      if (!error && data) {
        setClients(data.map(c => ({
          id: c.id,
          name: c.name || 'Sem nome',
          phone: c.phone || '',
          lastVisit: c.last_visit || new Date().toISOString(),
          createdAt: c.created_at,
          services: c.services || [],
          price: Number(c.price) || 0
        })));
      }
    } catch (err) {
      console.error("Erro ao buscar dados:", err);
    }
  };

  useEffect(() => {
    fetchClients();
  }, [session]);

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
    if (!session || ids.length === 0) return;
    const msg = ids.length === 1 ? "Excluir cliente? Esta ação NÃO pode ser desfazer!" : `Excluir ${ids.length} clientes? Esta ação NÃO pode ser desfeita!`;
    if (!window.confirm(msg)) return;
    
    await supabase.from('clientes').delete().in('id', ids);
    setIsSelectionMode(false);
    setSelectedClients([]);
    fetchClients();
  };

  const refreshClientVisit = async (id: string) => {
    const today = new Date().toISOString().split('T')[0];
    const { error } = await supabase.from('clientes').update({ last_visit: today }).eq('id', id);
    if (!error) {
      // Pequeno delay para garantir que o banco processou antes de atualizar a tela
      setTimeout(fetchClients, 200);
    }
  };

  const filteredClients = useMemo(() => {
    return clients.filter(c => 
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      c.phone.includes(searchTerm)
    );
  }, [clients, searchTerm]);

  const faturamentoTotal = useMemo(() => {
    const now = new Date();
    const range = {
      'today': startOfDay(now),
      'week': subDays(now, 7),
      'month': subDays(now, 30),
      '3months': subDays(now, 90),
      'all': new Date(0)
    }[filterPeriod] || new Date(0);

    return clients
      .filter(c => parseISO(c.lastVisit) >= range)
      .reduce((acc, curr) => acc + (curr.price || 0), 0);
  }, [clients, filterPeriod]);

  if (authLoading) return <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center"><Loader2 className="text-amber-500 animate-spin w-10 h-10" /></div>;

  if (!session) return (
    <div className="min-h-screen bg-[#0a0a0a] text-stone-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <div className="w-20 h-20 bg-amber-500 rounded-3xl flex items-center justify-center shadow-2xl shadow-amber-500/20 mx-auto mb-6">
            <Scissors className="text-black w-10 h-10" />
          </div>
          <h1 className="text-4xl font-black tracking-tighter">Barber <span className="text-amber-500">Pro</span></h1>
          <p className="text-stone-500 mt-2 font-medium">Gestão Premium - Cascavel/PR</p>
        </div>

        <div className="bg-[#141414] border border-white/5 p-8 rounded-[2rem] shadow-2xl">
          <form onSubmit={handleLogin} className="space-y-5">
            {loginError && <div className="bg-red-500/10 border border-red-500/20 text-red-500 text-sm p-4 rounded-xl flex items-center gap-2"><AlertCircle size={16} />{loginError}</div>}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-stone-500 uppercase ml-1">E-mail</label>
              <input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="barbeiro@exemplo.com" className="w-full bg-stone-900 border border-white/5 rounded-2xl px-4 py-4 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all outline-none" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-stone-500 uppercase ml-1">Senha</label>
              <input required type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" className="w-full bg-stone-900 border border-white/5 rounded-2xl px-4 py-4 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all outline-none" />
            </div>
            <button disabled={isLoggingIn} className="w-full bg-amber-500 hover:bg-amber-400 text-black py-4 rounded-2xl font-black text-lg transition-all active:scale-95 flex items-center justify-center gap-2">
              {isLoggingIn ? <Loader2 className="animate-spin" /> : 'Acessar Painel'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-stone-100 font-sans selection:bg-amber-500/30">
      <header className="border-b border-white/5 bg-[#0f0f0f]/80 backdrop-blur-md sticky top-0 z-20 px-4 h-20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/20"><Scissors size={20} className="text-black" /></div>
          <h1 className="text-xl font-black tracking-tighter">Barber <span className="text-amber-500">Pro</span></h1>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          <button onClick={() => setIsSelectionMode(!isSelectionMode)} className={cn("px-4 py-2 rounded-full text-[10px] font-black uppercase transition-all", isSelectionMode ? "bg-amber-500 text-black" : "bg-stone-800 text-stone-400 border border-white/5")}>
            {isSelectionMode ? "Concluir" : "Excluir Vários"}
          </button>
          <button onClick={() => setIsModalOpen(true)} className="bg-amber-500 hover:bg-amber-400 text-black px-4 py-2 rounded-full font-black flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all active:scale-95 text-xs">
            <UserPlus size={16} /> <span className="hidden sm:inline">NOVO</span>
          </button>
          <button onClick={() => supabase.auth.signOut()} className="text-stone-500 hover:text-red-500 transition-colors"><LogOut size={20} /></button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 py-8 space-y-6">
        {/* Card de Faturamento */}
        <div className="bg-[#141414] border border-white/5 p-6 rounded-[2rem] shadow-xl overflow-hidden relative">
          <div className="absolute top-0 right-0 p-8 opacity-5"><DollarSign size={80} /></div>
          <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <p className="text-[10px] font-black text-stone-500 uppercase tracking-widest mb-1">Faturamento Estimado</p>
              <p className="text-5xl font-black text-emerald-500 tracking-tighter">R$ {faturamentoTotal.toLocaleString('pt-BR')}</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {['today', 'week', 'month', '3months', 'all'].map(p => (
                <button key={p} onClick={() => setFilterPeriod(p)} className={cn("px-3 py-2 rounded-xl text-[10px] font-black uppercase transition-all border", filterPeriod === p ? "bg-emerald-500 border-emerald-500 text-black" : "bg-stone-800 border-white/5 text-stone-500")}>
                  {p === 'today' ? 'Hoje' : p === 'week' ? '7 Dias' : p === 'month' ? 'Mês' : p === '3months' ? '90 Dias' : 'Tudo'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500 group-focus-within:text-amber-500 transition-colors" />
          <input type="text" placeholder="Buscar cliente por nome ou celular..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-[#141414] border border-white/5 rounded-2xl pl-12 pr-4 py-4 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all outline-none" />
        </div>

        {isSelectionMode && selectedClients.length > 0 && (
          <button onClick={() => deleteClients(selectedClients)} className="w-full bg-red-600 hover:bg-red-500 text-white py-4 rounded-2xl font-black flex items-center justify-center gap-2 shadow-xl shadow-red-600/20 animate-in slide-in-from-top-2">
            <Trash2 size={20} /> APAGAR {selectedClients.length} SELECIONADOS
          </button>
        )}

        <div className="space-y-3">
          {filteredClients.map(client => {
            const days = differenceInDays(new Date(), parseISO(client.lastVisit));
            const isSelected = selectedClients.includes(client.id);
            return (
              <div key={client.id} className={cn("bg-[#141414] border rounded-[1.5rem] p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all hover:bg-[#1a1a1a]", isSelected ? "border-amber-500 ring-1 ring-amber-500/50" : "border-white/5")}>
                <div className="flex items-center gap-4">
                  {isSelectionMode && (
                    <button onClick={() => setSelectedClients(prev => isSelected ? prev.filter(id => id !== client.id) : [...prev, client.id])} className="transition-transform active:scale-90">
                      {isSelected ? <CheckSquare size={24} className="text-amber-500" /> : <Square size={24} className="text-stone-700" />}
                    </button>
                  )}
                  <div className="w-12 h-12 bg-stone-800 rounded-full flex items-center justify-center text-amber-500 font-black text-xl shadow-inner">{client.name[0]?.toUpperCase()}</div>
                  <div>
                    <p className="font-black text-lg leading-tight">{client.name}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {client.services?.map(s => <span key={s} className="text-[8px] font-black bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded border border-amber-500/20 uppercase tracking-tighter">{s}</span>)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between md:gap-10 bg-black/30 p-3 rounded-2xl border border-white/5">
                  <div className="text-center">
                    <p className="text-[10px] font-black text-stone-600 uppercase tracking-widest">Faturamento</p>
                    <p className="text-sm font-black text-emerald-500">R$ {client.price}</p>
                  </div>
                  <div className="text-center border-l border-white/10 pl-8">
                    <p className="text-[10px] font-black text-stone-600 uppercase tracking-widest">Há</p>
                    <p className={cn("text-2xl font-black tracking-tighter", days >= 20 ? "text-red-500" : "text-amber-500")}>{days}d</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button onClick={() => refreshClientVisit(client.id)} className="flex-1 md:flex-none p-3.5 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-2xl hover:bg-emerald-500/20 transition-all flex items-center justify-center" title="Renovar"><RefreshCw size={20} /></button>
                  <a href={`https://wa.me/55${client.phone.replace(/\D/g, '')}`} target="_blank" className="flex-1 md:flex-none p-3.5 bg-amber-500 text-black rounded-2xl hover:bg-amber-400 transition-all flex items-center justify-center shadow-lg shadow-amber-500/10"><MessageSquare size={20} /></a>
                  <button onClick={() => deleteClients([client.id])} className="p-3.5 bg-stone-800 text-stone-500 rounded-2xl hover:text-red-500 transition-all"><Trash2 size={20} /></button>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Modal Cadastro */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#141414] border border-white/10 w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl scale-in-center">
            <h3 className="text-2xl font-black mb-6 text-white tracking-tight text-center underline decoration-amber-500 decoration-4">NOVO CLIENTE</h3>
            <form onSubmit={addClient} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-stone-500 uppercase ml-1">Nome</label>
                <input required placeholder="Ex: João Silva" value={newName} onChange={e => setNewName(e.target.value)} className="w-full bg-stone-900 border border-white/5 rounded-2xl p-4 outline-none focus:border-amber-500" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-stone-500 uppercase ml-1">WhatsApp</label>
                <input placeholder="Ex: 45999999999" value={newPhone} onChange={e => setNewPhone(e.target.value)} className="w-full bg-stone-900 border border-white/5 rounded-2xl p-4 outline-none focus:border-amber-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-stone-500 uppercase ml-1">Valor (R$)</label>
                  <input type="number" placeholder="50" value={newPrice} onChange={e => setNewPrice(e.target.value)} className="w-full bg-stone-900 border border-white/5 rounded-2xl p-4 outline-none focus:border-amber-500" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-stone-500 uppercase ml-1">Data</label>
                  <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} className="w-full bg-stone-900 border border-white/5 rounded-2xl p-4 outline-none focus:border-amber-500" />
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-[10px] font-black text-stone-500 uppercase ml-1">Serviços Prestados</label>
                <div className="grid grid-cols-3 gap-2">
                  {['Cabelo', 'Barba', 'Sobrancelha'].map(s => (
                    <button key={s} type="button" onClick={() => setSelectedServices(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])} className={cn("py-3 rounded-xl text-[10px] font-black uppercase border transition-all", selectedServices.includes(s) ? "bg-amber-500 border-amber-500 text-black shadow-lg shadow-amber-500/20" : "border-white/5 text-stone-600 bg-stone-900")}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 bg-stone-800 rounded-2xl font-black text-stone-400 hover:bg-stone-700 transition-all uppercase text-xs">Sair</button>
                <button type="submit" className="flex-1 bg-amber-500 text-black py-4 rounded-2xl font-black text-lg hover:bg-amber-400 transition-all uppercase tracking-tighter">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
