import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { Camera, ChevronDown, X, Save, Trash2, ArrowRight } from 'lucide-react';

export default function KpopCollection() {
  const [currentTab, setCurrentTab] = useState('wishlist');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [selectedMember, setSelectedMember] = useState('');
  const [cards, setCards] = useState([]);
  const [groupsData, setGroupsData] = useState({});
  const [loading, setLoading] = useState(false);

  // Estados do Modal
  const [editingCard, setEditingCard] = useState(null);
  const [tempDescription, setTempDescription] = useState('');
  const [moveToStatus, setMoveToStatus] = useState('');
  const [moveToGroup, setMoveToGroup] = useState('');
  const [moveToMember, setMoveToMember] = useState('');

  useEffect(() => {
    fetchGroups();
  }, []);

  useEffect(() => {
    fetchCollection();
  }, [currentTab, selectedGroup, selectedMember]);

  async function fetchGroups() {
    const { data: groups, error: groupsError } = await supabase
      .from('groups')
      .select('id, name, members(id, name)');
    console.log('Groups:', groups, 'Error:', groupsError);
    const groupsObj = {};
    groups?.forEach(g => {
      groupsObj[g.name] = g.members.map(m => m.name);
    });
    setGroupsData(groupsObj);
  }

  async function fetchCollection() {
    setLoading(true);
    
    // Se tiver grupo selecionado, busca pelo member_id
    if (selectedMember && selectedGroup) {
      // Primeiro busca o member_id
      const { data: memberData } = await supabase
        .from('members')
        .select('id, groups!inner(name)')
        .eq('name', selectedMember)
        .eq('groups.name', selectedGroup)
        .single();
      
      if (memberData) {
        const { data: collection, error: collectionError } = await supabase
          .from('collection')
          .select(`*, members (name, groups (name))`)
          .eq('status', currentTab)
          .eq('member_id', memberData.id)
          .order('image_url', { ascending: false, nullsFirst: false })
          .order('created_at', { ascending: true })
          .limit(5000);
        
        console.log('Collection (filtrada por membro):', collection?.length, 'Error:', collectionError);
        
        if (collection) {
          const formatted = collection.map(item => ({
            id: item.id,
            status: item.status,
            img: item.image_url,
            description: item.description,
            member: item.members?.name,
            group: item.members?.groups?.name
          }));
          setCards(formatted);
        }
      }
    } else {
      // Busca geral com limite
      const { data: collection, error: collectionError } = await supabase
        .from('collection')
        .select(`*, members (name, groups (name))`)
        .eq('status', currentTab)
        .order('created_at', { ascending: false })
        .limit(1000);
      
      console.log('Collection:', collection?.length, 'Error:', collectionError);

      if (collection) {
        const formatted = collection.map(item => ({
          id: item.id,
          status: item.status,
          img: item.image_url,
          description: item.description,
          member: item.members?.name,
          group: item.members?.groups?.name
        }));
        console.log('Grupos únicos nos cards:', [...new Set(formatted.map(c => c.group))]);
        setCards(formatted);
      }
    }
    setLoading(false);
  }

  // --- FUNÇÃO DE UPLOAD ---
  async function handleImageUpload(event, cardId) {
    const file = event.target.files[0];
    if (!file) return;

    setLoading(true);
    try {
      const fileName = `${Date.now()}_${file.name}`;

      // 1. Enviar arquivo
      const { error: uploadError } = await supabase.storage
        .from('cards')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // 2. Pegar link
      const { data: { publicUrl } } = supabase.storage
        .from('cards')
        .getPublicUrl(fileName);

      // 3. Salvar link no banco
      const { error: dbError } = await supabase
        .from('collection')
        .update({ image_url: publicUrl })
        .eq('id', cardId);

      if (dbError) throw dbError;

      // 4. Atualizar tela
      setCards(prev => prev.map(card =>
        card.id === cardId ? { ...card, img: publicUrl } : card
      ));
      alert("Foto salva com sucesso!");

    } catch (error) {
      console.error(error);
      alert("Erro ao salvar imagem. Verifique se o RLS da tabela collection está desativado.");
    } finally {
      setLoading(false);
    }
  }

  // --- FUNÇÃO DE DELETAR ---
  async function handleDeletePhoto() {
    if (!editingCard || !editingCard.img) return;

    const confirmDelete = window.confirm("Tem certeza que quer remover essa foto?");
    if (!confirmDelete) return;

    try {
      // 1. Tentar apagar do Storage (opcional, se falhar não tem problema grave)
      const fileName = editingCard.img.split('/cards/')[1];
      if (fileName) {
        await supabase.storage.from('cards').remove([fileName]);
      }

      // 2. Limpar do Banco
      const { error: dbError } = await supabase
        .from('collection')
        .update({ image_url: null })
        .eq('id', editingCard.id);

      if (dbError) throw dbError;

      // 3. Atualizar tela
      setCards(prev => prev.map(c =>
        c.id === editingCard.id ? { ...c, img: null } : c
      ));

      setEditingCard(null);
      alert("Foto removida!");

    } catch (error) {
      console.error(error);
      alert("Erro ao remover a foto.");
    }
  }

  // --- FUNÇÃO DE SALVAR LEGENDA ---
  async function saveDescription() {
    if (!editingCard) return;

    try {
      const { error } = await supabase
        .from('collection')
        .update({ description: tempDescription })
        .eq('id', editingCard.id);

      if (error) throw error;

      setCards(prev => prev.map(c =>
        c.id === editingCard.id ? { ...c, description: tempDescription } : c
      ));

      setEditingCard(null);
    } catch (error) {
      alert('Erro ao salvar legenda');
    }
  }

  // --- FUNÇÃO 5: MOVER CARD DE STATUS ---
  async function handleMoveStatus() {
    if (!editingCard || !moveToStatus) return;
    if (moveToStatus === editingCard.status) {
      alert('O card já está nesse status!');
      return;
    }

    const statusNames = {
      wishlist: 'Wishlist',
      on_the_way: 'A Caminho',
      owned: 'Minha Coleção',
      ceg: 'CEG'
    };

    if (!window.confirm(`Mover para "${statusNames[moveToStatus]}"?`)) return;

    try {
      const { error } = await supabase
        .from('collection')
        .update({ status: moveToStatus })
        .eq('id', editingCard.id);

      if (error) throw error;

      setCards(prev => prev.filter(c => c.id !== editingCard.id));
      setEditingCard(null);
      setMoveToStatus('');

    } catch (error) {
      console.error(error);
      alert("Erro ao mover o card.");
    }
  }

  // --- FUNÇÃO 6: MOVER CARD PARA OUTRO MEMBRO ---
  async function handleMoveMember() {
    if (!editingCard || !moveToGroup || !moveToMember) return;

    // Busca o member_id do membro selecionado
    const { data: memberData } = await supabase
      .from('members')
      .select('id, groups!inner(name)')
      .eq('name', moveToMember)
      .eq('groups.name', moveToGroup)
      .single();

    if (!memberData) {
      alert('Membro não encontrado!');
      return;
    }

    if (!window.confirm(`Mover para ${moveToMember} (${moveToGroup})?`)) return;

    try {
      const { error } = await supabase
        .from('collection')
        .update({ member_id: memberData.id })
        .eq('id', editingCard.id);

      if (error) throw error;

      // Atualiza na tela
      setCards(prev => prev.map(c =>
        c.id === editingCard.id ? { ...c, member: moveToMember, group: moveToGroup } : c
      ));
      
      setEditingCard(null);
      setMoveToGroup('');
      setMoveToMember('');
      alert('Card movido com sucesso!');

    } catch (error) {
      console.error(error);
      alert("Erro ao mover o card.");
    }
  }

  function openEditModal(card) {
    setEditingCard(card);
    setTempDescription(card.description || '');
    setMoveToStatus('');
    setMoveToGroup('');
    setMoveToMember('');
  }

  const filteredCards = cards.filter(card => {
    const matchGroup = selectedGroup ? card.group === selectedGroup : true;
    const matchMember = selectedMember ? card.member === selectedMember : true;
    return matchGroup && matchMember;
  });

  // Debug: ver grupos e membros únicos nos cards
  useEffect(() => {
    if (cards.length > 0) {
      console.log('Grupos únicos nos cards:', [...new Set(cards.map(c => c.group))]);
      console.log('Membros únicos nos cards:', [...new Set(cards.map(c => c.member))].slice(0, 20));
    }
  }, [cards]);

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans">
      {/* Abas */}
      <div className="flex justify-center space-x-8 mb-10 border-b border-gray-200 pb-4">
        {['wishlist', 'on_the_way', 'owned', 'ceg'].map((tab) => (
          <button key={tab} onClick={() => setCurrentTab(tab)} className={`text-lg font-medium capitalize pb-2 transition-colors ${currentTab === tab ? 'text-purple-600 border-b-2 border-purple-600' : 'text-gray-400 hover:text-gray-600'}`}>
            {tab.replace(/_/g, ' ').toUpperCase()}
          </button>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex gap-4 mb-8">
        <div className="relative">
          <select className="appearance-none bg-white border border-gray-300 rounded-lg py-2 px-4 pr-8 focus:outline-none focus:ring-2 focus:ring-purple-500" value={selectedGroup} onChange={(e) => { setSelectedGroup(e.target.value); setSelectedMember(''); }}>
            <option value="">Todos os Grupos</option>
            {Object.keys(groupsData).map(g => <option key={g} value={g}>{g}</option>)}
          </select>
          <ChevronDown className="absolute right-2 top-3 w-4 h-4 text-gray-500 pointer-events-none" />
        </div>
        <div className="relative">
          <select className="appearance-none bg-white border border-gray-300 rounded-lg py-2 px-4 pr-8 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50" value={selectedMember} onChange={(e) => setSelectedMember(e.target.value)} disabled={!selectedGroup}>
            <option value="">Todos os Membros</option>
            {selectedGroup && groupsData[selectedGroup]?.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <ChevronDown className="absolute right-2 top-3 w-4 h-4 text-gray-500 pointer-events-none" />
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-3 md:grid-cols-6 lg:grid-cols-7 gap-3">        {filteredCards.map((card) => (
        <div key={card.id} className="aspect-[2/3] bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col items-center justify-center p-2 relative group hover:shadow-md transition-shadow overflow-hidden">
          {card.img ? (
            <div onClick={() => openEditModal(card)} className="w-full h-full cursor-pointer relative">
              <img src={card.img} alt="Card" className="w-full h-full object-cover rounded" />
              {card.description && (
                <div className="absolute bottom-0 w-full bg-black/60 text-white text-[10px] p-1 text-center truncate">
                  {card.description}
                </div>
              )}
            </div>
          ) : (
            <label className="w-full h-full bg-gray-50 rounded flex flex-col items-center justify-center text-gray-400 gap-2 cursor-pointer hover:bg-gray-100 transition-colors">
              <Camera size={24} />
              <span className="text-xs font-medium text-gray-500">{card.member}</span>
              <span className="text-[10px] text-purple-600 font-bold mt-1 bg-purple-100 px-2 py-1 rounded">Add Foto</span>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(e, card.id)} disabled={loading} />
            </label>
          )}
        </div>
      ))}
      </div>

      {/* MODAL EDITAR / DELETAR */}
      {editingCard && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden relative animate-fade-in">
            <button onClick={() => setEditingCard(null)} className="absolute top-2 right-2 bg-gray-100 p-1 rounded-full hover:bg-gray-200 text-gray-600">
              <X size={20} />
            </button>

            <div className="h-64 bg-gray-100 flex items-center justify-center">
              <img src={editingCard.img} className="h-full object-contain" alt="Preview" />
            </div>

            <div className="p-4 space-y-4">
              <div>
                <h3 className="font-bold text-lg text-gray-800">{editingCard.member}</h3>
                <p className="text-sm text-purple-600">{editingCard.group}</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Legenda / Álbum</label>
                <input
                  type="text"
                  value={tempDescription}
                  onChange={(e) => setTempDescription(e.target.value)}
                  placeholder="Ex: Formula of Love - Scientist Ver."
                  className="w-full border border-gray-300 rounded p-2 text-sm focus:outline-none focus:border-purple-500"
                />
              </div>

              {/* BOTOES DE AÇÃO */}
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={handleDeletePhoto}
                  className="bg-red-100 text-red-600 p-2 rounded-lg hover:bg-red-200 transition-colors"
                  title="Excluir foto"
                >
                  <Trash2 size={20} />
                </button>

                {/* Seletor de status para mover */}
                <select
                  value={moveToStatus}
                  onChange={(e) => setMoveToStatus(e.target.value)}
                  className="border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-blue-500"
                >
                  <option value="">Mover para...</option>
                  <option value="wishlist">Wishlist</option>
                  <option value="on_the_way">A Caminho</option>
                  <option value="owned">Minha Coleção</option>
                  <option value="ceg">CEG</option>
                </select>

                {moveToStatus && (
                  <button
                    onClick={handleMoveStatus}
                    className="bg-blue-100 text-blue-600 p-2 rounded-lg hover:bg-blue-200 transition-colors flex items-center gap-1"
                    title="Confirmar movimento"
                  >
                    <ArrowRight size={20} />
                  </button>
                )}

                {/* Botão de SALVAR */}
                <button
                  onClick={saveDescription}
                  className="flex-1 bg-purple-600 text-white py-2 rounded-lg font-medium hover:bg-purple-700 flex items-center justify-center gap-2"
                >
                  <Save size={18} />
                  Salvar
                </button>
              </div>

              {/* MOVER PARA OUTRO MEMBRO */}
              <div className="border-t pt-3 mt-2">
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Mover para outro membro</label>
                <div className="flex gap-2 flex-wrap">
                  <select
                    value={moveToGroup}
                    onChange={(e) => { setMoveToGroup(e.target.value); setMoveToMember(''); }}
                    className="border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-green-500 flex-1"
                  >
                    <option value="">Grupo...</option>
                    {Object.keys(groupsData).map(g => <option key={g} value={g}>{g}</option>)}
                  </select>

                  <select
                    value={moveToMember}
                    onChange={(e) => setMoveToMember(e.target.value)}
                    disabled={!moveToGroup}
                    className="border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-green-500 flex-1 disabled:opacity-50"
                  >
                    <option value="">Membro...</option>
                    {moveToGroup && groupsData[moveToGroup]?.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>

                  {moveToMember && (
                    <button
                      onClick={handleMoveMember}
                      className="bg-green-100 text-green-600 p-2 rounded-lg hover:bg-green-200 transition-colors flex items-center gap-1"
                      title="Confirmar movimento"
                    >
                      <ArrowRight size={20} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

      )}
    </div>
  );
}