import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { Camera, ChevronDown, ChevronRight, X, Trash2, ArrowRight, Heart, LogOut, Lock } from 'lucide-react';

export default function KpopCollection() {
  // --- ESTADOS DE AUTENTICAÇÃO ---
  const [session, setSession] = useState(() => {
    const saved = Object.keys(localStorage).find(key => key.startsWith('sb-') && key.endsWith('-auth-token'));
    return saved ? JSON.parse(localStorage.getItem(saved)) : null;
  });
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

  // Estado para controlar quais grupos estão abertos (dropdown) na barra lateral
  const [openGroups, setOpenGroups] = useState({});

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
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      if (currentSession) setSession(currentSession);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, currentSession) => {
      if (event === 'SIGNED_IN') {
        setSession(currentSession);
      } else if (event === 'SIGNED_OUT') {
        setSession(null);
        setCards([]);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session?.user?.id) {
      fetchGroups();
    }
  }, [session]);

  useEffect(() => {
    if (session?.user?.id) {
      fetchCollection();
    }
  }, [currentTab, selectedGroup, selectedMember]);

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
    setLoading(true);
    try {
      await supabase.auth.signOut();
      setSession(null);
      setCards([]);
      localStorage.clear();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
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
    if (!session?.user?.id) return;
    setLoading(true);
    try {
      let query = supabase
        .from('collection')
        .select(`*, members (name, groups (name))`)
        .eq('status', currentTab)
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
      } else if (selectedGroup) {
        const { data: membersInGroup } = await supabase
          .from('members')
          .select('id, groups!inner(name)')
          .eq('groups.name', selectedGroup);

        if (membersInGroup) {
          const ids = membersInGroup.map(m => m.id);
          query = query.in('member_id', ids);
        }
      }

      const { data: collection, error } = await query
        .order('image_url', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(3000);

      if (error) throw error;

      if (collection) {
        const formatted = collection.map(item => ({
          ...item,
          img: item.image_url,
          extra_images: item.extra_images || [],
          member: item.members?.name,
          group: item.members?.groups?.name,
          isFavorite: item.is_favorite
        }));
        setCards(formatted);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  async function handleImageUpload(event, cardId) {
    event.preventDefault();
    event.stopPropagation();

    const file = event.target.files[0];
    if (!file) return;

    setLoading(true);
    try {
      const fileName = `${session.user.id}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage.from('cards').upload(fileName, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('cards').getPublicUrl(fileName);
      const { error: dbError } = await supabase.from('collection').update({ image_url: publicUrl }).eq('id', cardId);
      if (dbError) throw dbError;

      setCards(prev => prev.map(card => card.id === cardId ? { ...card, img: publicUrl } : card));

      if (editingCard && editingCard.id === cardId) {
        setEditingCard(prev => ({ ...prev, img: publicUrl }));
      }
    } catch (error) {
      console.error(error);
      alert("Erro ao subir imagem: " + error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleExtraImagesUpload(event) {
    const files = Array.from(event.target.files || []);
    if (!files.length || !editingCard) return;

    setLoading(true);
    try {
      const uploadedUrls = [];

      for (const file of files) {
        const fileName = `${session.user.id}/extra_${Date.now()}_${Math.random().toString(36).slice(2)}_${file.name}`;
        const { error: uploadError } = await supabase.storage.from('cards').upload(fileName, file);
        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage.from('cards').getPublicUrl(fileName);
        uploadedUrls.push(publicUrl);
      }

      const updatedExtraPhotos = [...(editingCard.extra_images || []), ...uploadedUrls];

      const { error: dbError } = await supabase
        .from('collection')
        .update({ extra_images: updatedExtraPhotos })
        .eq('id', editingCard.id);

      if (dbError) throw dbError;

      setCards(prev => prev.map(card => card.id === editingCard.id ? { ...card, extra_images: updatedExtraPhotos } : card));
      setEditingCard(prev => ({ ...prev, extra_images: updatedExtraPhotos }));
      event.target.value = '';
    } catch (error) {
      console.error(error);
      alert("Erro ao enviar fotos extras: " + error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleBulkImageUpload(event) {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    const emptyCards = filteredCards.filter(card => !card.img);
    if (!emptyCards.length) {
      alert('Não há slots vazios para receber estas fotos.');
      event.target.value = '';
      return;
    }

    setLoading(true);
    try {
      const filesToUpload = files.slice(0, emptyCards.length);

      for (let index = 0; index < filesToUpload.length; index += 1) {
        const file = filesToUpload[index];
        const targetCard = emptyCards[index];
        const fileName = `${session.user.id}/bulk_${Date.now()}_${index}_${file.name}`;

        const { error: uploadError } = await supabase.storage.from('cards').upload(fileName, file);
        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage.from('cards').getPublicUrl(fileName);
        const { error: dbError } = await supabase.from('collection').update({ image_url: publicUrl }).eq('id', targetCard.id);
        if (dbError) throw dbError;

        setCards(prev => prev.map(card => card.id === targetCard.id ? { ...card, img: publicUrl } : card));

        if (editingCard && editingCard.id === targetCard.id) {
          setEditingCard(prev => ({ ...prev, img: publicUrl }));
        }
      }

      event.target.value = '';
    } catch (error) {
      console.error(error);
      alert('Erro ao enviar imagens: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeletePhoto() {
    if (!editingCard || !editingCard.img) return;
    if (!window.confirm("Remover foto?")) return;

    setLoading(true);
    try {
      const fileName = editingCard.img.split('/cards/')[1];
      if (fileName) {
        const { error: storageError } = await supabase.storage.from('cards').remove([fileName]);
        if (storageError) console.error("Aviso no Storage:", storageError);
      }

      const { error: dbError } = await supabase.from('collection').update({ image_url: null }).eq('id', editingCard.id);
      if (dbError) throw dbError;

      setCards(prev => prev.map(c => c.id === editingCard.id ? { ...c, img: null } : c));
      setEditingCard(null);
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

  const toggleGroupDropdown = (groupName) => {
    setOpenGroups(prev => ({
      ...prev,
      [groupName]: !prev[groupName]
    }));
  };

  const filteredCards = cards
    .filter(card => (selectedGroup ? card.group === selectedGroup : true) && (selectedMember ? card.member === selectedMember : true))
    .sort((a, b) => Number(b.isFavorite) - Number(a.isFavorite));

  // --- TELA DE LOGIN ---
  if (!session) {
    return (
      <div className="min-h-screen bg-[#086c79] flex items-center justify-center p-4 font-sans">
        <div className="bg-white p-8 rounded-xl shadow-md border max-w-sm w-full space-y-6">
          <div className="flex flex-col items-center space-y-2">
            <div className="bg-[#282828] p-3 rounded-full text-white">
              <Lock size={32} />
            </div>
            <h2 className="text-2xl font-bold text-gray-800">Minha Coleção K-Pop</h2>
            <p className="text-gray-400 text-sm text-center">Faça login ou crie uma conta para gerenciar seus Photocards.</p>
          </div>

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
              <button type="submit" onClick={(e) => handleLogin(e)} disabled={authLoading} className="flex-1 bg-purple-600 text-white p-2 rounded-lg font-bold text-sm hover:bg-purple-700 transition-colors disabled:opacity-50">
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

  // --- TELA PRINCIPAL (COM AS CORES ATUALIZADAS) ---
  return (
    <div className="min-h-screen bg-[#b8b0b0] p-4 md:p-8 font-sans flex flex-col"> {/* COR DE FUNDO GERAL MUDADA PARA #806c79 */}

      {/* Topbar com botão de Logout */}


      {/* CONTAINER PRINCIPAL EM GRID */}
      <div className="flex flex-col md:flex-row gap-6 items-start flex-1">

        {/* 1ª DIV: BARRA LATERAL - MUDADA PARA A COR DE FUNDO #4a3f4b */}
        <div className="w-full md:w-64 bg-[#282828] rounded-xl shadow-sm border border-[#282828] p-4 self-stretch min-h-[300px]">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-[#282828]">
            <h3 className="font-bold text-white text-sm tracking-wide uppercase">▼ Groups</h3>
            {(selectedGroup || selectedMember) && (
              <button
                onClick={() => { setSelectedGroup(''); setSelectedMember(''); }}
                className="text-xs text-purple-300 hover:underline font-medium"
              >
                Limpar Filtro
              </button>
            )}
          </div>

          <div className="space-y-1">
            {Object.keys(groupsData)
              .filter(group => group !== 'Geral' && group !== 'A Organizar')
              .map((group) => {
                const isGroupOpen = !!openGroups[group];
                const isGroupSelected = selectedGroup === group;

                return (
                  <div key={group} className="rounded-lg overflow-hidden">
                    {/* Botão do Grupo */}
                    <button
                      onClick={() => {
                        toggleGroupDropdown(group);
                        setSelectedGroup(group);
                        setSelectedMember('');
                      }}
                      className={`w-full flex items-center justify-between p-2 text-sm font-medium transition-colors rounded-md text-left ${isGroupSelected
                          ? 'bg-[#5e5160] text-purple-200 font-semibold border-l-4 border-purple-400 pl-1'
                          : 'text-gray-200 hover:bg-[#484048]'
                        }`}
                    >
                      <span className="flex items-center gap-2">
                        {isGroupOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        {group}
                      </span>
                    </button>

                    {/* Dropdown de Membros deste Grupo */}
                    {isGroupOpen && (
                      <div className="pl-6 pr-2 py-1 space-y-1 bg-[#413742] rounded-b-md border-l-2 border-purple-400 ml-3 mt-1">
                        <button
                          onClick={() => setSelectedMember('')}
                          className={`w-full text-left text-xs p-1.5 rounded transition-colors ${isGroupSelected && !selectedMember
                              ? 'text-purple-300 font-bold'
                              : 'text-gray-300 hover:text-white'
                            }`}
                        >
                          • Todos os membros
                        </button>

                        {groupsData[group]?.map((member) => {
                          const isMemberSelected = selectedMember === member;
                          return (
                            <button
                              key={member}
                              onClick={() => {
                                setSelectedGroup(group);
                                setSelectedMember(member);
                              }}
                              className={`w-full text-left text-xs p-1.5 rounded transition-colors block ${isMemberSelected
                                  ? 'bg-[#5e5160] text-purple-200 font-bold'
                                  : 'text-gray-300 hover:text-white hover:bg-[#4d414e]'
                                }`}
                            >
                              • {member}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
          <div className="flex justify-between items-center mb-6 p-4 rounded-xl ">
            <button onClick={handleLogout} className="ml-auto flex items-center gap-2 text-sm text-white px-3 py-1.5 rounded-lg font-medium transition-colors">          <LogOut size={16} /> Sair
            </button>
          </div>
        </div>

        {/* 2ª DIV: ÁREA DE CONTEÚDO PRINCIPAL (BRANCA PARA DESTAQUE DOS CARDS) */}
        <div className="flex-1 bg-[#e5dee1] rounded-xl shadow-sm border p-6 w-full self-stretch flex flex-col">

          {/* MENU DE ABAS SUPERIOR */}
{/* MENU DE ABAS SUPERIOR */}
          <div className="flex justify-start space-x-6 mb-6 pb-2 overflow-x-auto whitespace-nowrap scrollbar-none">
            {[
              { id: 'wishlist', label: 'Wishlist' },
              { id: 'on_the_way', label: 'OTW' },
              { id: 'owned', label: 'Owned' },
              { id: 'ceg', label: 'CEGs' },
              { id: 'album_wishlist', label: 'Wishlist Álbuns' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setCurrentTab(tab.id)}
                className={`text-base font-semibold pb-2 transition-colors px-1 ${
                  currentTab === tab.id
                    ? 'border-b-2 border-purple-600 text-purple-600 font-bold'
                    : 'text-gray-400 border-transparent hover:text-gray-600'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* BOTÃO PARA ABRIR PÁGINA SEPARADA DA CEG */}
          {currentTab === 'ceg' && (
            <div className="flex justify-end mb-4">
              <a 
                href="/cegs" 
                target="_blank" 
                className="bg-[#282828] text-white px-4 py-1.5 rounded-lg text-xs font-bold transition-colors hover:bg-black"
              >
                ABRIR PÁGINA DE CEGS
              </a>
            </div>
          )}

          {/* BOTÃO PARA ABRIR PÁGINA SEPARADA DA WISHLIST DE ÁLBUNS */}
          {currentTab === 'album_wishlist' && (
            <div className="flex justify-end mb-4">
              <a 
                href="/album-wishlist" 
                target="_blank" 
                className="bg-[#282828] text-white px-4 py-1.5 rounded-lg text-xs font-bold transition-colors hover:bg-black"
              >
                ABRIR PÁGINA DE WISHLIST
              </a>
            </div>
          )}

          {/* BOTÃO DE UPLOAD EM LOTE PARA SLOTS VAZIOS */}
          {filteredCards.some(card => !card.img) && (
            <div className="flex justify-end mb-4">
              <label className="cursor-pointer bg-gradient-to-r from-violet-600 to-purple-600 text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wide shadow-md hover:from-violet-700 hover:to-purple-700 transition-all">
                + adicionar várias
                <input type="file" accept="image/*" multiple className="hidden" onChange={handleBulkImageUpload} />
              </label>
            </div>
          )}

          {/* GRID DE PHOTOCARDS */}
          <div className="flex-1">
            {loading ? (
              <div className="text-center py-10 text-gray-400 text-sm">Carregando itens...</div>
            ) : filteredCards.length === 0 ? (
              <div className="text-center py-10 text-gray-400 text-sm rounded-xl">
                Nenhum photocard encontrado para os filtros selecionados nesta aba.
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3">
                {filteredCards.map((card) => (
                  <div key={card.id} className="aspect-[2/3] bg-gray-50 rounded-lg shadow-sm p-1 relative group overflow-hidden hover:border-purple-300 transition-all">
                    {card.isFavorite && (
                      <div className="absolute top-1 right-1 z-10 bg-pink-500 rounded-full p-1 shadow-sm">
                        <Heart size={10} fill="white" className="text-white" />
                      </div>
                    )}
                    {card.img ? (
                      <div onClick={() => openEditModal(card)} className="w-full h-full cursor-pointer relative">
                        <img src={card.img} className="w-full h-full object-cover rounded" alt="" />
                        {card.description && (
                          <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] p-1 text-center truncate rounded-b">
                            {card.description}
                          </div>
                        )}
                      </div>
                    ) : (
                      <label className="w-full h-full flex flex-col items-center justify-center text-gray-400 cursor-pointer hover:bg-gray-100 transition-colors rounded">
                        <Camera size={20} />
                        <span className="text-[10px] mt-1">Add Foto</span>
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, card.id)} />
                      </label>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>

      {/* MODAL DE EDIÇÃO */}
      {editingCard && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl w-full max-w-sm overflow-hidden relative p-4 space-y-4 max-h-[90vh] overflow-y-auto shadow-xl">
            <button onClick={() => setEditingCard(null)} className="absolute top-2 right-2 text-gray-400 hover:text-gray-600"><X size={24} /></button>
            <img src={editingCard.img} className="h-48 w-full object-contain mx-auto rounded-lg bg-gray-50" />



            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Descrição / Álbum</label>
                <input type="text" value={tempDescription} onChange={(e) => setTempDescription(e.target.value)} className="w-full border p-2 rounded text-sm" placeholder="Ex: Feel Special Holo" />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Pagamento</label>
                  <select value={tempStatusPagamento} onChange={(e) => setTempStatusPagamento(e.target.value)} className="w-full border p-2 rounded text-xs bg-white">
                    <option value="pendente">Pendente</option><option value="pago">Pago</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Valor Item</label>
                  <input type="number" value={tempValor} onChange={(e) => setTempValor(e.target.value)} className="w-full border p-2 rounded text-xs" placeholder="R$ 0,00" />
                </div>
              </div>

              <div className="bg-[#282828] p-3 rounded-lg space-y-2 border-purple-100">
                <span className="block text-[10px] font-bold text-purple-300 uppercase tracking-wider">Taxas & Fretes</span>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex gap-1">
                    <input type="number" value={tempTaxa} onChange={(e) => setTempTaxa(e.target.value)} className="w-full border p-1 rounded text-xs bg-white" placeholder="Taxa 1" />
                    <select value={tempStatusTaxa1} onChange={(e) => setTempStatusTaxa1(e.target.value)} className="border rounded text-[10px] bg-white">
                      <option value="pendente">P</option><option value="pago">OK</option>
                    </select>
                  </div>
                  <div className="flex gap-1">
                    <input type="number" value={temptaxa2} onChange={(e) => setTemptaxa2(e.target.value)} className="w-full border p-1 rounded text-xs bg-white" placeholder="Taxa 2" />
                    <select value={tempStatusTaxa2} onChange={(e) => setTempStatusTaxa2(e.target.value)} className="border rounded text-[10px] bg-white">
                      <option value="pendente">P</option><option value="pago">OK</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex gap-1">
                    <input type="number" value={tempFrete} onChange={(e) => setTempFrete(e.target.value)} className="w-full border p-1 rounded text-xs bg-white" placeholder="Frete 1" />
                    <select value={tempStatusFrete1} onChange={(e) => setTempStatusFrete1(e.target.value)} className="border rounded text-[10px] bg-white">
                      <option value="pendente">P</option><option value="pago">OK</option>
                    </select>
                  </div>
                  <div className="flex gap-1">
                    <input type="number" value={tempfrete2} onChange={(e) => setTempfrete2(e.target.value)} className="w-full border p-1 rounded text-xs bg-white" placeholder="Frete 2" />
                    <select value={tempStatusFrete2} onChange={(e) => setTempStatusFrete2(e.target.value)} className="border rounded text-[10px] bg-white">
                      <option value="pendente">P</option><option value="pago">OK</option>
                    </select>
                  </div>
                </div>
                <input type="text" value={tempNomeCeg} onChange={(e) => setTempNomeCeg(e.target.value)} className="w-full border p-2 rounded text-xs bg-white" placeholder="ID ou Código da CEG" />
              </div>

              <button onClick={saveDescription} className="w-full bg-[#282828] hover:bg-purple-700 text-white p-2.5 rounded-lg font-bold flex items-center justify-center gap-2 transition-colors shadow-sm">
                SALVAR <ArrowRight size={16} />
              </button>
            </div>

            <div className="flex gap-2 pt-2 border-t">
              <button onClick={handleToggleFavorite} className={`flex-1 p-2 rounded flex justify-center transition-colors ${editingCard.isFavorite ? 'bg-pink-500 text-white' : 'bg-pink-100 text-pink-600 hover:bg-pink-200'}`}><Heart size={20} fill={editingCard.isFavorite ? 'white' : 'none'} /></button>
              <button onClick={handleDeletePhoto} className="flex-1 bg-red-100 text-red-600 p-2 rounded flex justify-center hover:bg-red-200 transition-colors"><Trash2 size={20} /></button>
            </div>

            <div className="space-y-1.5 pt-2 border-t">
              <label className="block text-[10px] font-bold text-gray-500 uppercase">Mover de Categoria</label>
              <div className="flex gap-2">
                <select value={moveToStatus} onChange={(e) => setMoveToStatus(e.target.value)} className="flex-1 border rounded p-1.5 text-sm bg-white">
                  <option value="">Mover para...</option>
                  <option value="wishlist">Wishlist</option>
                  <option value="on_the_way">A Caminho (OTW)</option>
                  <option value="owned">Coleção (Owned)</option>
                  <option value="ceg">CEG</option>
                  <option value="album_wishlist">Wishlist Álbuns</option>
                </select>
                <button onClick={handleMoveStatus} className="bg-blue-600 hover:bg-blue-700 text-white px-3 rounded transition-colors"><ArrowRight size={16} /></button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}