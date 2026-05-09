import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, UserPlus, MessageSquare, Search, AlertCircle, Trash2, 
  Scissors, LogOut, Mail, Lock, Loader2, RefreshCw, CheckSquare, Square
} from 'lucide-react';
import { format, differenceInDays, parseISO, startOfDay, subDays } from 'date-fns';
import { supabase } from './lib/supabase';

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
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
    const { data, error } = await supabase.from('clientes').select('*').order('last_visit', { ascending: false });
    if (!error && data) setClients(data);
  };

  useEffect(() => { fetchClients(); }, [session]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setLoginError('Erro no login.');
    setIsLoggingIn(false);
  };

  const addClient = async (e: React.FormEvent) => {
    e.preventDefault();
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
    if (!window.confirm("Excluir permanente?")) return;
    await supabase.from('clientes').delete().in('id', ids);
    setIsSelectionMode(false);
    setSelectedClients([]);
    fetchClients();
  };

  const refreshClientVisit = async (id: string) => {
    const today = new Date().toISOString().split('T')[0];
    await supabase.from('clientes').update({ last_visit: today }).eq('id', id);
    fetchClients();
  };

  const filteredClients = useMemo(() => {
    return clients.filter(c => (c.name || '').toLowerCase().includes(searchTerm.toLowerCase()));
  }, [clients, searchTerm]);

  const faturamento = useMemo(() => {
    const now = new Date();
    const range = {
      'today': startOfDay(now),
      'week': subDays(now, 7),
      'month': subDays(now, 30),
      'all': new Date(0)
    }[filterPeriod] || new Date(0);
    return clients.filter(c => parseISO(c.last_visit) >= range).reduce((acc, curr) => acc + (Number(curr.price) || 0), 0);
  }, [clients, filterPeriod]);

  if (authLoading) return <div className="min-h-screen bg-black flex items-center justify-center text-amber-500">Carregando...</div>;

  if (!session) return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
      <form onSubmit={handleLogin} className="bg-zinc-900 p-8 rounded-3xl w-full max-w-sm space-y-4 border border-white/5">
        <h1 className="text-2xl font-bold text-center">Barber <span className="text-amber-500">Pro</span></h1>
        {loginError && <p className="text-red-500 text-xs text-center">{loginError}</p>}
        <input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="E-mail" className="w-full bg-black p-4 rounded-xl border border-white/10" />
        <input required type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Senha" className="w-full bg-black p-4 rounded-xl border border-white/10" />
        <button className="w-full bg-amber-500 text-black py-4 rounded-xl font-bold">Entrar</button>
      </form>
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="p-4 border-b border-white/5 flex justify-between items-center bg-zinc-900/50 sticky top-0 z-10">
        <h1 className="font-bold text-xl">Barber <span className="text-amber-500">Pro</span></h1>
        <div className="flex gap-2">
          <button onClick={() => setIsSelectionMode(!isSelectionMode)} className="text-[10px] bg-zinc-800 px-3 py-2 rounded-full">
            {isSelectionMode ? "Cancelar" : "Selecionar"}
          </button>
          <button onClick={() => setIsModalOpen(true)} className="bg-amber-500 text-black p-2 rounded-full"><UserPlus size={18} /></button>
          <button onClick={() => supabase.auth.signOut()}><LogOut size={18} /></button>
        </div>
      </header>

      <main className="p-4 max-w-4xl mx-auto space-y-6">
        <div className="bg-zinc-900 p-6 rounded-3xl border border-white/5">
          <p className="text-[10px] text-zinc-500 uppercase font-bold">Faturamento</p>
          <p className="text-4xl font-black text-emerald-500">R$ {faturamento}</p>
          <div className="flex gap-2 mt-4 overflow-x-auto">
            {['today', 'week', 'month', 'all'].map(p => (
              <button key={p} onClick={() => setFilterPeriod(p)} className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase ${filterPeriod === p ? 'bg-emerald-500 text-black' : 'bg-black text-zinc-500'}`}>
                {p === 'today' ? 'Hoje' : p === 'week' ? '7d' : p === 'month' ? '30d' : 'Tudo'}
              </button>
            ))}
          </div>
        </div>

        <input type="text" placeholder="Buscar..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-zinc-900 p-4 rounded-2xl border border-white/5" />

        {isSelectionMode && selectedClients.length > 0 && (
          <button onClick={() => deleteClients(selectedClients)} className="w-full bg-red-600 py-4 rounded-2xl font-bold">EXCLUIR {selectedClients.length}</button>
        )}

        <div className="space-y-3">
          {filteredClients.map(c => {
            const days = differenceInDays(new Date(), parseISO(c.last_visit));
            const isSel = selectedClients.includes(c.id);
            return (
              <div key={c.id} className={`bg-zinc-900 p-4 rounded-2xl border ${isSel ? 'border-amber-500' : 'border-white/5'} flex flex-col gap-4`}>
                <div className="flex items-center gap-3">
                  {isSelectionMode && (
                    <button onClick={() => setSelectedClients(prev => isSel ? prev.filter(id => id !== c.id) : [...prev, c.id])}>
                      {isSel ? <CheckSquare className="text-amber-500" /> : <Square />}
                    </button>
                  )}
                  <div className="w-10 h-10 bg-zinc-800 rounded-full flex items-center justify-center text-amber-500 font-bold">{c.name?.[0]}</div>
                  <div className="flex-1">
                    <p className="font-bold">{c.name}</p>
                    <p className="text-[10px] text-zinc-500">{c.services?.join(', ')}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-xl font-black ${days >= 20 ? 'text-red-500' : 'text-amber-500'}`}>{days}d</p>
                    <p className="text-[10px] text-emerald-500 font-bold">R$ {c.price || 0}</p>
                  </div>
                </div>
                <div className="flex gap-2 border-t border-white/5 pt-3">
                  <button onClick={() => refreshClientVisit(c.id)} className="flex-1 bg-emerald-500/10 text-emerald-500 p-3 rounded-xl flex justify-center"><RefreshCw size={18} /></button>
                  <a href={`https://wa.me/55${c.phone}`} className="flex-1 bg-amber-500 text-black p-3 rounded-xl flex justify-center"><MessageSquare size={18} /></a>
                  <button onClick={() => deleteClients([c.id])} className="p-3 bg-zinc-800 text-zinc-500 rounded-xl"><Trash2 size={18} /></button>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
          <form onSubmit={addClient} className="bg-zinc-900 p-6 rounded-3xl w-full max-w-sm space-y-4">
            <h3 className="font-bold">Novo Cliente</h3>
            <input required placeholder="Nome" value={newName} onChange={e => setNewName(e.target.value)} className="w-full bg-black p-3 rounded-xl border border-white/10" />
            <input placeholder="WhatsApp" value={newPhone} onChange={e => setNewPhone(e.target.value)} className="w-full bg-black p-3 rounded-xl border border-white/10" />
            <input type="number" placeholder="Valor R$" value={newPrice} onChange={e => setNewPrice(e.target.value)} className="w-full bg-black p-3 rounded-xl border border-white/10" />
            <div className="flex gap-2">
              {['Cabelo', 'Barba', 'Sobrancelha'].map(s => (
                <button key={s} type="button" onClick={() => setSelectedServices(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])} className={`flex-1 py-2 rounded-lg text-[10px] border ${selectedServices.includes(s) ? 'bg-amber-500 text-black' : 'border-white/10 text-zinc-500'}`}>{s}</button>
              ))}
            </div>
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 p-3 bg-zinc-800 rounded-xl">Sair</button>
              <button type="submit" className="flex-1 bg-amber-500 text-black p-3 rounded-xl font-bold">Salvar</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
