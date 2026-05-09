import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, UserPlus, MessageSquare, Calendar, Search, TrendingUp, 
  AlertCircle, Trash2, Scissors, LogOut, Mail, Lock, Loader2, 
  RefreshCw, DollarSign, CheckSquare, Square, X
} from 'lucide-react';
import { format, differenceInDays, parseISO, isWithinInterval, subDays, startOfDay } from 'date-fns';
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
  
  const [clientToDelete, setClientToDelete] = useState<string | null>(null);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedClients, setSelectedClients] = useState<string[]>([]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));
    return () => subscription.unsubscribe();
  }, []);

  const fetchClients = async () => {
    if (!session) return;
    const { data, error } = await supabase.from('clientes').select('*').order('last_visit', { ascending: false });
    if (!error && data) {
      setClients(data.map(c => ({
        id: c.id, name: c.name, phone: c.phone, lastVisit: c.last_visit, 
        createdAt: c.created_at, services: c.services, price: Number(c.price) || 0
      })));
    }
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
    if (!newName || !session) return;
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
    if (!session || ids.length === 0) return;
    const confirmMsg = ids.length === 1 ? "Deseja excluir este cliente? Esta ação NÃO pode ser desfeita." : `Deseja excluir ${ids.length} clientes? Esta ação NÃO pode ser desfeita.`;
    if (!confirm(confirmMsg)) return;
    
    await supabase.from('clientes').delete().in('id', ids);
    setIsSelectionMode(false);
    setSelectedClients([]);
    fetchClients();
  };

  const refreshClientVisit = async (id: string) => {
    const today = new Date().toISOString().split('T')[0];
    const { error } = await supabase.from('clientes').update({ last_visit: today }).eq('id', id);
    if (!error) fetchClients();
  };

  const filteredClients = useMemo(() => {
    return clients.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()) || c.phone.includes(searchTerm));
  }, [clients, searchTerm]);

  const faturamento = useMemo(() => {
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

  if (authLoading) return <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center"><Loader2 className="text-amber-500 animate-spin" /></div>;

  if (!session) return (
    <div className="min-h-screen bg-[#0a0a0a] text-stone-100 flex items-center justify-center p-4">
      <div className="bg-[#141414] border border-white/5 p-8 rounded-3xl w-full max-w-md">
        <h1 className="text-2xl font-bold text-center mb-8">Barber <span className="text-amber-500">Pro</span> Login</h1>
        <form onSubmit={handleLogin} className="space-y-4">
          <input type="email" placeholder="E-mail" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-stone-900 border border-white/5 rounded-xl px-4 py-3" />
          <input type="password" placeholder="Senha" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-stone-900 border border-white/5 rounded-xl px-4 py-3" />
          <button className="w-full bg-amber-500 text-black py-3 rounded-xl font-bold">Entrar</button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-stone-100">
      <header className="border-b border-white/5 bg-[#0f0f0f] sticky top-0 z-10 p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <h1 className="font-bold text-xl">Barber <span className="text-amber-500">Pro</span></h1>
          <div className="flex gap-2">
            <button onClick={() => setIsSelectionMode(!isSelectionMode)} className={cn("px-4 py-2 rounded-full text-xs font-bold transition-all", isSelectionMode ? "bg-amber-500 text-black" : "bg-stone-800 text-stone-400")}>
              {isSelectionMode ? "Cancelar Seleção" : "Selecionar Vários"}
            </button>
            <button onClick={() => setIsModalOpen(true)} className="bg-amber-500 text-black px-4 py-2 rounded-full font-bold text-xs"><UserPlus size={16} /></button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 space-y-6">
        {/* Dashboard Financeira */}
        <div className="bg-[#141414] border border-white/5 p-6 rounded-2xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <p className="text-xs text-stone-500 uppercase">Faturamento no Período</p>
              <p className="text-3xl font-black text-emerald-500">R$ {faturamento.toLocaleString('pt-BR')}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {['today', 'week', 'month', '3months', 'all'].map(p => (
                <button key={p} onClick={() => setFilterPeriod(p)} className={cn("px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all", filterPeriod === p ? "bg-emerald-500 text-black" : "bg-stone-800 text-stone-500")}>
                  {p === 'today' ? 'Hoje' : p === 'week' ? '7 Dias' : p === 'month' ? 'Mês' : p === '3months' ? '3 Meses' : 'Tudo'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
          <input type="text" placeholder="Buscar cliente..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-[#141414] border border-white/5 rounded-xl pl-10 pr-4 py-3" />
        </div>

        {isSelectionMode && selectedClients.length > 0 && (
          <button onClick={() => deleteClients(selectedClients)} className="w-full bg-red-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2">
            <Trash2 size={18} /> Excluir {selectedClients.length} Selecionados
          </button>
        )}

        <div className="space-y-3">
          {filteredClients.map(client => {
            const days = differenceInDays(new Date(), parseISO(client.lastVisit));
            return (
              <div key={client.id} className={cn("bg-[#141414] border rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all", selectedClients.includes(client.id) ? "border-amber-500" : "border-white/5")}>
                <div className="flex items-center gap-4">
                  {isSelectionMode && (
                    <button onClick={() => setSelectedClients(prev => prev.includes(client.id) ? prev.filter(id => id !== client.id) : [...prev, client.id])}>
                      {selectedClients.includes(client.id) ? <CheckSquare className="text-amber-500" /> : <Square className="text-stone-600" />}
                    </button>
                  )}
                  <div className="w-10 h-10 bg-stone-800 rounded-full flex items-center justify-center text-amber-500 font-bold">{client.name[0]}</div>
                  <div>
                    <p className="font-bold">{client.name}</p>
                    <div className="flex gap-1">
                      {client.services?.map(s => <span key={s} className="text-[8px] bg-stone-800 px-1 rounded text-stone-400">{s}</span>)}
                    </div>
                  </div>
                </div>

                <div className="flex justify-between md:gap-8 bg-black/20 p-2 rounded-xl">
                  <div className="text-center">
                    <p className="text-[10px] text-stone-500 uppercase">Gasto Total</p>
                    <p className="text-sm font-bold text-emerald-500">R$ {client.price}</p>
                  </div>
                  <div className="text-center border-l border-white/5 pl-4">
                    <p className="text-[10px] text-stone-500 uppercase">Tempo</p>
                    <p className={cn("text-lg font-black", days >= 20 ? "text-red-500" : "text-amber-500")}>{days}d</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button onClick={() => refreshClientVisit(client.id)} className="flex-1 md:flex-none p-3 bg-green-500/10 text-green-500 rounded-xl"><RefreshCw size={18} /></button>
                  <a href={`https://wa.me/55${client.phone}`} className="flex-1 md:flex-none p-3 bg-amber-500 text-black rounded-xl flex items-center justify-center"><MessageSquare size={18} /></a>
                  <button onClick={() => deleteClients([client.id])} className="p-3 bg-stone-800 text-stone-500 rounded-xl"><Trash2 size={18} /></button>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Modal Cadastro */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
          <div className="bg-[#141414] border border-white/10 w-full max-w-md rounded-3xl p-6">
            <h3 className="text-xl font-bold mb-4">Novo Cliente</h3>
            <form onSubmit={addClient} className="space-y-4">
              <input required placeholder="Nome" value={newName} onChange={e => setNewName(e.target.value)} className="w-full bg-stone-900 border border-white/5 rounded-xl p-3" />
              <input placeholder="WhatsApp" value={newPhone} onChange={e => setNewPhone(e.target.value)} className="w-full bg-stone-900 border border-white/5 rounded-xl p-3" />
              <input type="number" placeholder="Valor do Serviço (R$)" value={newPrice} onChange={e => setNewPrice(e.target.value)} className="w-full bg-stone-900 border border-white/5 rounded-xl p-3" />
              
              <div className="flex gap-2 py-2">
                {['Cabelo', 'Barba', 'Sobrancelha'].map(s => (
                  <button key={s} type="button" onClick={() => setSelectedServices(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])} className={cn("flex-1 py-2 rounded-lg text-[10px] font-bold border transition-all", selectedServices.includes(s) ? "bg-amber-500 border-amber-500 text-black" : "border-white/5 text-stone-500")}>
                    {s}
                  </button>
                ))}
              </div>

              <div className="flex gap-3">
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
