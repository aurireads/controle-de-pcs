import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { Camera, ChevronDown, X, Trash2, ArrowRight, Heart, LogOut, Lock } from 'lucide-react';

export default function KpopCollection() {
  // --- ESTADOS DE AUTENTICAÇÃO ---
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // --- ESTADOS JÁ EXISTENTES ---
  const [currentTab, setCurrentTab] = useState('wishlist');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [selectedMember, setSelectedMember] = useState('');
  const [cards, setCards] = useState([]);
  const [groupsData, setGroupsData] = useState({});
  const [loading, setLoading] = useState(false);

  // Estados do Modal
  const [editingCard, setEditingCard] = useState(null);
  const [tempDescription, setTempDescription] = useState('');
  const [tempStatusPagamento, setTempStatusPagamento] = useState('pendente');
  const [tempValor, setTempValor] = useState('');
  const [tempTaxa, setTempTaxa] = useState('');
  const [temptaxa2, setTemptaxa2] = useState('');
  const [tempFrete, setTempFrete] = useState('');
  const [tempfrete2, setTempfrete2] = useState('');
  const [tempStatusTaxa1, setTempStatusTaxa1] = useState('pendente');
  const [tempStatusTaxa2, setTempStatusTaxa2] = useState('pendente');
  const [tempStatusFrete1, setTempStatusFrete1] = useState('pendente');
  const [tempStatusFrete2, setTempStatusFrete2] = useState('pendente');
  const [tempNomeCeg, setTempNomeCeg] = useState('');

  const [moveToStatus, setMoveToStatus] = useState('');
  const [moveToGroup, setMoveToGroup] = useState('');
  const [moveToMember, setMoveToMember] = useState('');

  // --- CONTROLE DE SESSÃO DO USUÁRIO ---
  useEffect(() => {
    // Pega a sessão atual ao montar o componente
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    // Escuta mudanças no estado de auth (login/logout)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) {
      fetchGroups();
    }
  }, [session]);

  useEffect(() => {
    if (session) {
      fetchCollection();
    }
  }, [currentTab, selectedGroup, selectedMember, session]);

  // --- FUNÇÕES DE AUTENTICAÇÃO ---
  async function handleLogin(e) {
    e.preventDefault();
    setAuthLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert('Erro ao fazer login: ' + error.message);
    setAuthLoading(false);
  }

  async function handleSignUp(e) {
    e.preventDefault();
    setAuthLoading(true);
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) alert('Erro ao cadastrar: ' + error.message);
    else alert('Cadastro realizado! Se o Supabase exigir, confirme o e-mail.');
    setAuthLoading(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setCards([]);
  }

  // --- FUNÇÕES DA COLEÇÃO ---
  async function fetchGroups() {
    const { data: groups } = await supabase
      .from('groups')
      .select('id, name, members(id, name)');

    const groupsObj = {};
    groups?.forEach(g => {
      groupsObj[g.name] = g.members.map(m => m.name);
    });
    setGroupsData(groupsObj);
  }

  async function fetchCollection() {
    setLoading(true);
    let query = supabase
      .from('collection')
      .select(`*, members (name, groups (name))`)
      .eq('status', currentTab)
      // FILTRA APENAS OS CARDS DO USUÁRIO LOGADO:
      .eq('user_id', session.user.id); 

    if (selectedMember && selectedGroup) {
      const { data: memberData } = await supabase
        .from('members')
        .select('id, groups!inner(name)')
        .eq('name', selectedMember)
        .eq('groups.name', selectedGroup)
        .single();

      if (memberData) {
        query = query.eq('member_id', memberData.id);
      }
    }

    const { data: collection } = await query
      .order('image_url', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(1000);

    if (collection) {
      const formatted = collection.map(item => ({
        ...item,
        img: item.image_url,
        member: item.members?.name,
        group: item.members?.groups?.name,
        isFavorite: item.is_favorite
      }));
      setCards(formatted);
    }
    setLoading(false);
  }

async function handleImageUpload(event, cardId) {
    // 1. IMPORTANTE: Para o comportamento padrão do navegador do tablet na hora
    event.preventDefault();
    event.stopPropagation();

    const file = event.target.files[0];
    if (!file) return;
    
    setLoading(true);
    try {
      const fileName = `${session.user.id}/${Date.now()}_${file.name}`;
      
      // Envia para o storage
      const { error: uploadError } = await supabase.storage.from('cards').upload(fileName, file);
      if (uploadError) throw uploadError;
      
      // Pega a URL pública
      const { data: { publicUrl } } = supabase.storage.from('cards').getPublicUrl(fileName);
      
      // Atualiza o banco de dados
      const { error: dbError } = await supabase.from('collection').update({ image_url: publicUrl }).eq('id', cardId);
      if (dbError) throw dbError;
      
      // Atualiza o estado local de forma segura
      setCards(prev => prev.map(card => card.id === cardId ? { ...card, img: publicUrl } : card));
      
      if (editingCard && editingCard.id === cardId) {
        setEditingCard(prev => ({ ...prev, img: publicUrl }));
      }

      alert("Foto adicionada com sucesso!");
    } catch (error) {
      console.error(error);
      alert("Erro ao subir imagem: " + error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeletePhoto() {
    if (!editingCard || !editingCard.img) return;
    if (!window.confirm("Remover foto?")) return;
    
    setLoading(true); // Ativa o loading para bloquear interações repetidas
    try {
      // Pega o nome do arquivo corretamente removendo a URL base do bucket
      const fileName = editingCard.img.split('/cards/')[1];
      
      if (fileName) {
        const { error: storageError } = await supabase.storage.from('cards').remove([fileName]);
        if (storageError) console.error("Aviso no Storage (pode ser que a imagem não existia lá):", storageError);
      }
      
      const { error: dbError } = await supabase.from('collection').update({ image_url: null }).eq('id', editingCard.id);
      if (dbError) throw dbError;
      
      setCards(prev => prev.map(c => c.id === editingCard.id ? { ...c, img: null } : c));
      setEditingCard(null); // Fecha o modal para resetar o fluxo
    } catch (error) {
      console.error("Erro ao deletar:", error);
      alert("Erro ao remover a foto.");
    } finally {
      setLoading(false);
    }
  }
  async function saveDescription() {
    if (!editingCard) return;
    try {
      const updateData = {
        description: tempDescription,
        status_pagamento: tempStatusPagamento,
        valor_item: tempValor === '' ? null : tempValor,
        taxa: tempTaxa === '' ? null : tempTaxa,
        taxa2: temptaxa2 === '' ? null : temptaxa2,
        frete: tempFrete === '' ? null : tempFrete,
        frete2: tempfrete2 === '' ? null : tempfrete2,
        status_taxa1: tempStatusTaxa1,
        status_taxa2: tempStatusTaxa2,
        status_frete1: tempStatusFrete1,
        status_frete2: tempStatusFrete2,
        nome_ceg: tempNomeCeg
      };

      const { error } = await supabase.from('collection').update(updateData).eq('id', editingCard.id);
      if (error) throw error;

      setCards(prev => prev.map(c => c.id === editingCard.id ? { ...c, ...updateData } : c));
      setEditingCard(null);
    } catch (error) {
      console.error(error);
    }
  }

  async function handleMoveStatus() {
    if (!editingCard || !moveToStatus) return;
    try {
      await supabase.from('collection').update({ status: moveToStatus }).eq('id', editingCard.id);
      setCards(prev => prev.filter(c => c.id !== editingCard.id));
      setEditingCard(null);
    } catch (error) {
      console.error(error);
    }
  }

  async function handleToggleFavorite() {
    if (!editingCard) return;
    const nextFav = !editingCard.isFavorite;
    try {
      await supabase.from('collection').update({ is_favorite: nextFav }).eq('id', editingCard.id);
      setCards(prev => prev.map(c => c.id === editingCard.id ? { ...c, isFavorite: nextFav } : c));
      setEditingCard({ ...editingCard, isFavorite: nextFav });
    } catch (error) {
      console.error(error);
    }
  }

  function openEditModal(card) {
    setEditingCard(card);
    setTempDescription(card.description || '');
    setTempStatusPagamento(card.status_pagamento || 'pendente');
    setTempValor(card.valor_item || '');
    setTempTaxa(card.taxa || '');
    setTemptaxa2(card.taxa2 || '');
    setTempFrete(card.frete || '');
    setTempfrete2(card.frete2 || '');
    setTempStatusTaxa1(card.status_taxa1 || 'pendente');
    setTempStatusTaxa2(card.status_taxa2 || 'pendente');
    setTempStatusFrete1(card.status_frete1 || 'pendente');
    setTempStatusFrete2(card.status_frete2 || 'pendente');
    setTempNomeCeg(card.nome_ceg || '');
    setMoveToStatus('');
    setMoveToGroup('');
    setMoveToMember('');
  }

  const filteredCards = cards
    .filter(card => (selectedGroup ? card.group === selectedGroup : true) && (selectedMember ? card.member === selectedMember : true))
    .sort((a, b) => Number(b.isFavorite) - Number(a.isFavorite));

  // --- TELA DE LOGIN (BARREIRA CASO NÃO ESTEJA LOGADO) ---
// --- TELA DE LOGIN (BARREIRA CASO NÃO ESTEJA LOGADO) ---
  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 font-sans">
        <div className="bg-white p-8 rounded-xl shadow-md border max-w-sm w-full space-y-6">
          <div className="flex flex-col items-center space-y-2">
            <div className="bg-purple-100 p-3 rounded-full text-purple-600">
              <Lock size={32} />
            </div>
            <h2 className="text-2xl font-bold text-gray-800">Minha Coleção K-Pop</h2>
            <p className="text-gray-400 text-sm text-center">Faça login ou crie uma conta para gerenciar seus Photocards.</p>
          </div>

          {/* O FORMULÁRIO CORRIGIDO FICA AQUI EMBAIXO: */}
          <form onSubmit={(e) => e.preventDefault()} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">E-mail</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full border p-2 rounded text-sm focus:outline-purple-600" placeholder="seu@email.com" required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Senha</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full border p-2 rounded text-sm focus:outline-purple-600" placeholder="••••••••" required />
            </div>

            <div className="flex gap-2 pt-2">
              <button type="button" onClick={(e) => handleLogin(e)} disabled={authLoading} className="flex-1 bg-purple-600 text-white p-2 rounded-lg font-bold text-sm hover:bg-purple-700 transition-colors disabled:opacity-50">
                {authLoading ? 'Entrando...' : 'Entrar'}
              </button>
              <button type="button" onClick={(e) => handleSignUp(e)} disabled={authLoading} className="flex-1 bg-gray-100 text-gray-700 p-2 rounded-lg font-bold text-sm hover:bg-gray-200 transition-colors disabled:opacity-50">
                Cadastrar
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }
  // --- TELA PRINCIPAL (SÓ APARECE SE ESTIVER LOGADO) ---
  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans">
      {/* Topbar com botão de Logout */}
      <div className="flex justify-between items-center mb-6">
        <span className="text-xs text-gray-500 font-medium">Logado como: <strong className="text-gray-700">{session.user.email}</strong></span>
        <button onClick={handleLogout} className="flex items-center gap-2 text-sm text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg font-medium transition-colors">
          <LogOut size={16} /> Sair
        </button>
      </div>

      <div className="flex justify-center space-x-8 mb-10 border-b pb-4">
        {['wishlist', 'on_the_way', 'owned', 'ceg'].map((tab) => (
          <button key={tab} onClick={() => setCurrentTab(tab)} className={`text-lg font-medium capitalize pb-2 transition-colors ${currentTab === tab ? 'text-purple-600 border-b-2 border-purple-600' : 'text-gray-400'}`}>
            {tab.replace(/_/g, ' ').toUpperCase()}
          </button>
        ))}
      </div>

      <div className="flex gap-4 mb-8">
        <select className="bg-white border rounded-lg py-2 px-4 pr-8" value={selectedGroup} onChange={(e) => { setSelectedGroup(e.target.value); setSelectedMember(''); }}>
          <option value="">Todos os Grupos</option>
          {Object.keys(groupsData).map(g => <option key={g} value={g}>{g}</option>)}
        </select>
        <select className="bg-white border rounded-lg py-2 px-4 pr-8" value={selectedMember} onChange={(e) => setSelectedMember(e.target.value)} disabled={!selectedGroup}>
          <option value="">Todos os Membros</option>
          {selectedGroup && groupsData[selectedGroup]?.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      {currentTab === 'ceg' && (
        <div className="flex justify-end mb-6">
          <a href="/cegs" target="_blank" className="bg-purple-600 text-white px-4 py-2 rounded-lg font-bold">ABRIR PÁGINA DE CEGS</a>
        </div>
      )}

      {loading ? (
        <div className="text-center py-10 text-gray-500">Carregando itens...</div>
      ) : (
        <div className="grid grid-cols-3 md:grid-cols-6 lg:grid-cols-7 gap-3">
          {filteredCards.map((card) => (
            <div key={card.id} className="aspect-[2/3] bg-white rounded-lg shadow-sm border p-2 relative group overflow-hidden">
              {card.isFavorite && <div className="absolute top-1 right-1 z-10 bg-pink-500 rounded-full p-1"><Heart size={12} fill="white" className="text-white" /></div>}
              {card.img ? (
                <div onClick={() => openEditModal(card)} className="w-full h-full cursor-pointer">
                  <img src={card.img} className="w-full h-full object-cover rounded" />
                  {card.description && <div className="absolute bottom-0 w-full bg-black/60 text-white text-[10px] p-1 text-center truncate">{card.description}</div>}
                </div>
              ) : (
                <label className="w-full h-full flex flex-col items-center justify-center text-gray-400 cursor-pointer">
                  <Camera size={24} />
                  <input type="file" className="hidden" onChange={(e) => handleImageUpload(e, card.id)} />
                </label>
              )}
            </div>
          ))}
        </div>
      )}

      {/* MODAL DE EDIÇÃO (Mantido igual) */}
      {editingCard && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-sm overflow-hidden relative p-4 space-y-4 max-h-[90vh] overflow-y-auto">
            <button onClick={() => setEditingCard(null)} className="absolute top-2 right-2 text-gray-400"><X size={24} /></button>
            <img src={editingCard.img} className="h-48 w-full object-contain mx-auto" />
            
            <div className="space-y-3">
              <input type="text" value={tempDescription} onChange={(e) => setTempDescription(e.target.value)} className="w-full border p-2 rounded text-sm" placeholder="Descrição/Álbum" />
              
              <div className="grid grid-cols-2 gap-2">
                <select value={tempStatusPagamento} onChange={(e) => setTempStatusPagamento(e.target.value)} className="border p-2 rounded text-xs">
                  <option value="pendente">Pendente</option><option value="pago">Pago</option>
                </select>
                <input type="number" value={tempValor} onChange={(e) => setTempValor(e.target.value)} className="border p-2 rounded text-xs" placeholder="Valor Item" />
              </div>

              <div className="bg-purple-50 p-3 rounded-lg space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex gap-1">
                    <input type="number" value={tempTaxa} onChange={(e) => setTempTaxa(e.target.value)} className="w-full border p-1 rounded text-xs" placeholder="Taxa 1" />
                    <select value={tempStatusTaxa1} onChange={(e) => setTempStatusTaxa1(e.target.value)} className="border rounded text-[10px]">
                      <option value="pendente">P</option><option value="pago">OK</option>
                    </select>
                  </div>
                  <div className="flex gap-1">
                    <input type="number" value={temptaxa2} onChange={(e) => setTemptaxa2(e.target.value)} className="w-full border p-1 rounded text-xs" placeholder="Taxa 2" />
                    <select value={tempStatusTaxa2} onChange={(e) => setTempStatusTaxa2(e.target.value)} className="border rounded text-[10px]">
                      <option value="pendente">P</option><option value="pago">OK</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex gap-1">
                    <input type="number" value={tempFrete} onChange={(e) => setTempFrete(e.target.value)} className="w-full border p-1 rounded text-xs" placeholder="Frete 1" />
                    <select value={tempStatusFrete1} onChange={(e) => setTempStatusFrete1(e.target.value)} className="border rounded text-[10px]">
                      <option value="pendente">P</option><option value="pago">OK</option>
                    </select>
                  </div>
                  <div className="flex gap-1">
                    <input type="number" value={tempfrete2} onChange={(e) => setTempfrete2(e.target.value)} className="w-full border p-1 rounded text-xs" placeholder="Frete 2" />
                    <select value={tempStatusFrete2} onChange={(e) => setTempStatusFrete2(e.target.value)} className="border rounded text-[10px]">
                      <option value="pendente">P</option><option value="pago">OK</option>
                    </select>
                  </div>
                </div>
                <input type="text" value={tempNomeCeg} onChange={(e) => setTempNomeCeg(e.target.value)} className="w-full border p-2 rounded text-xs" placeholder="ID da CEG" />
              </div>

              <button onClick={saveDescription} className="w-full bg-purple-600 text-white p-2 rounded-lg font-bold flex items-center justify-center gap-2">
                SALVAR <ArrowRight size={16}/>
              </button>
            </div>

            <div className="flex gap-2 pt-2 border-t">
              <button onClick={handleToggleFavorite} className={`flex-1 p-2 rounded ${editingCard.isFavorite ? 'bg-pink-500 text-white' : 'bg-pink-100 text-pink-600'}`}><Heart size={20} fill={editingCard.isFavorite ? 'white' : 'none'} /></button>
              <button onClick={handleDeletePhoto} className="flex-1 bg-red-100 text-red-600 p-2 rounded"><Trash2 size={20} /></button>
            </div>

            <div className="space-y-2 pt-2">
              <label className="block text-[10px] font-bold text-gray-500 uppercase">Trocar Status</label>
              <div className="flex gap-2">
                <select value={moveToStatus} onChange={(e) => setMoveToStatus(e.target.value)} className="flex-1 border rounded p-1 text-sm">
                  <option value="">Mover...</option>
                  <option value="wishlist">Wishlist</option><option value="on_the_way">A Caminho</option><option value="owned">Coleção</option><option value="ceg">CEG</option>
                </select>
                <button onClick={handleMoveStatus} className="bg-blue-600 text-white px-3 rounded"><ArrowRight size={16}/></button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}