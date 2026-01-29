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

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    // Busca grupos
    const { data: groups } = await supabase.from('groups').select('*, members(*)');
    const groupsObj = {};
    groups?.forEach(g => {
      groupsObj[g.name] = g.members.map(m => m.name);
    });
    setGroupsData(groupsObj);

    // Busca coleção
    const { data: collection } = await supabase
      .from('collection')
      .select(`*, members (name, groups (name))`)
      .order('created_at', { ascending: false });

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
    if (!editingCard) return;

    let nextStatus = '';
    let confirmMessage = '';

    // Define para onde o card vai
    if (editingCard.status === 'wishlist') {
      nextStatus = 'on_the_way';
      confirmMessage = "Oba! Comprou o card? Vou mover para 'A Caminho'.";
    } else if (editingCard.status === 'on_the_way') {
      nextStatus = 'owned';
      confirmMessage = "Chegou? Parabéns! Vou mover para 'Minha Coleção'.";
    } else {
      return; // Se já estiver em 'owned', não faz nada
    }

    if (!window.confirm(confirmMessage)) return;

    try {
      // 1. Atualiza no Banco
      const { error } = await supabase
        .from('collection')
        .update({ status: nextStatus })
        .eq('id', editingCard.id);

      if (error) throw error;

      // 2. Atualiza na Tela (O card vai sumir da aba atual)
      setCards(prev => prev.map(c =>
        c.id === editingCard.id ? { ...c, status: nextStatus } : c
      ));

      setEditingCard(null); // Fecha a janela

    } catch (error) {
      console.error(error);
      alert("Erro ao mover o card.");
    }
  }

  function openEditModal(card) {
    setEditingCard(card);
    setTempDescription(card.description || '');
  }

  const filteredCards = cards.filter(card => {
    const matchTab = card.status === currentTab;
    const matchGroup = selectedGroup ? card.group === selectedGroup : true;
    const matchMember = selectedMember ? card.member === selectedMember : true;
    return matchTab && matchGroup && matchMember;
  });

  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans">
      {/* Abas */}
      <div className="flex justify-center space-x-8 mb-10 border-b border-gray-200 pb-4">
        {['wishlist', 'on_the_way', 'owned'].map((tab) => (
          <button key={tab} onClick={() => setCurrentTab(tab)} className={`text-lg font-medium capitalize pb-2 transition-colors ${currentTab === tab ? 'text-purple-600 border-b-2 border-purple-600' : 'text-gray-400 hover:text-gray-600'}`}>
            {tab.replace(/_/g, ' ')}
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
              {/* BOTOES DE AÇÃO */}
              <div className="flex gap-2">
                <button
                  onClick={handleDeletePhoto}
                  className="bg-red-100 text-red-600 p-2 rounded-lg hover:bg-red-200 transition-colors"
                  title="Excluir foto"
                >
                  <Trash2 size={20} />
                </button>

                {/* Só mostra o botão MOVER se NÃO estiver na aba Owned */}
                {editingCard.status !== 'owned' && (
                  <button
                    onClick={handleMoveStatus}
                    className="bg-blue-100 text-blue-600 p-2 rounded-lg hover:bg-blue-200 transition-colors flex items-center gap-1"
                    title="Avançar para próxima etapa"
                  >
                    <span className="text-xs font-bold uppercase">Mover</span>
                    <ArrowRight size={20} />
                  </button>
                )}

                {/* Botão de SALVAR (Apenas um agora) */}
                <button
                  onClick={saveDescription}
                  className="flex-1 bg-purple-600 text-white py-2 rounded-lg font-medium hover:bg-purple-700 flex items-center justify-center gap-2"
                >
                  <Save size={18} />
                  Salvar
                </button>
              </div>
            </div>
          </div>
        </div>

      )}
    </div>
  );
}