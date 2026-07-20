import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { ArrowLeft, Camera, X, Plus, Trash2, Save, Image as ImageIcon, Sparkles } from 'lucide-react';

export default function AlbumWishlistPage() {
    const [cards, setCards] = useState([]);
    const [groupsData, setGroupsData] = useState({});
    const [selectedGroup, setSelectedGroup] = useState('');
    const [loading, setLoading] = useState(true);

    // Estados dos Modais e Seleções
    const [editingCard, setEditingCard] = useState(null);
    const [isAddingNew, setIsAddingNew] = useState(false);
    const [selectedOwner, setSelectedOwner] = useState('');

    // Formulários
    const [editForm, setEditForm] = useState({ description: '', nome_ceg: '' });

    useEffect(() => {
        fetchGroups();
        fetchWishlist();
    }, []);

    async function fetchGroups() {
        const { data: groups } = await supabase
            .from('groups')
            .select('id, name, members(id, name)');

        const groupsObj = {};

        // Filtramos para ignorar os grupos "Geral" e "A Organizar"
        groups
            ?.filter(g => g.name !== 'Geral' && g.name !== 'A Organizar')
            .forEach(g => {
                groupsObj[g.name] = g.members;
            });

        setGroupsData(groupsObj);
    }

    async function fetchWishlist() {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('collection')
                .select(`*, members(id, name, groups(id, name))`)
                .eq('status', 'album_wishlist')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setCards(data || []);
        } catch (err) {
            console.error("Erro ao buscar wishlist:", err);
        } finally {
            setLoading(false);
        }
    }

    // Criar Slot/Card em Branco
    async function handleCreateEmptyCard() {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return alert("Usuário não autenticado");

            let targetMemberId = null;

            if (selectedOwner.startsWith('group_')) {
                targetMemberId = selectedOwner.replace('group_', '');
            } else if (selectedOwner.startsWith('member_')) {
                targetMemberId = selectedOwner.replace('member_', '');
            }

            const newRow = {
                user_id: user.id,
                status: 'album_wishlist',
                description: editForm.description || 'CAIXINHA EUA #4',
                nome_ceg: editForm.nome_ceg || 'Geral',
                member_id: targetMemberId,
                extra_images: []
            };

            const { data, error } = await supabase
                .from('collection')
                .insert([newRow])
                .select(`*, members(id, name, groups(id, name))`);

            if (error) throw error;

            setCards([data[0], ...cards]);
            setIsAddingNew(false);
            setEditForm({ description: '', nome_ceg: '' });
            setSelectedOwner('');
        } catch (err) {
            console.error(err);
            alert("Erro ao adicionar card: " + err.message);
        }
    }

    // Upload da Foto Principal (pelo botão Add Foto do quadro)
    async function handleMainImageUpload(event, cardId) {
        const file = event.target.files[0];
        if (!file) return;

        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const fileName = `${user.id}/main_${Date.now()}_${file.name}`;

            const { error: uploadError } = await supabase.storage.from('cards').upload(fileName, file);
            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage.from('cards').getPublicUrl(fileName);

            const { error: dbError } = await supabase
                .from('collection')
                .update({ image_url: publicUrl })
                .eq('id', cardId);

            if (dbError) throw dbError;

            setCards(prev => prev.map(c => c.id === cardId ? { ...c, image_url: publicUrl } : c));
        } catch (err) {
            console.error(err);
            alert("Erro ao enviar imagem: " + err.message);
        } finally {
            setLoading(false);
        }
    }

    // Upload de Fotos Extras (no Modal do Card)
    async function handleExtraPhotoUpload(event) {
        const file = event.target.files[0];
        if (!file || !editingCard) return;

        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const fileName = `${user.id}/extra_${Date.now()}_${file.name}`;

            const { error: uploadError } = await supabase.storage.from('cards').upload(fileName, file);
            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage.from('cards').getPublicUrl(fileName);

            const updatedExtraPhotos = [...(editingCard.extra_images || []), publicUrl];

            const { error: dbError } = await supabase
                .from('collection')
                .update({ extra_images: updatedExtraPhotos })
                .eq('id', editingCard.id);

            if (dbError) throw dbError;

            setEditingCard({ ...editingCard, extra_images: updatedExtraPhotos });
            setCards(prev => prev.map(c => c.id === editingCard.id ? { ...c, extra_images: updatedExtraPhotos } : c));
        } catch (err) {
            console.error(err);
            alert("Erro ao enviar foto extra: " + err.message);
        } finally {
            setLoading(false);
        }
    }

    // Salvar Dados Editados
    async function handleSaveCard() {
        try {
            const { error } = await supabase
                .from('collection')
                .update({ description: editForm.description, nome_ceg: editForm.nome_ceg })
                .eq('id', editingCard.id);

            if (error) throw error;

            setCards(prev => prev.map(c => c.id === editingCard.id ? { ...c, ...editForm } : c));
            setEditingCard(null);
        } catch (err) {
            console.error(err);
            alert("Erro ao salvar alterações");
        }
    }

    // Deletar Card
    async function handleDeleteCard(cardId) {
        if (!window.confirm("Deseja apagar este quadro?")) return;
        try {
            const { error } = await supabase.from('collection').delete().eq('id', cardId);
            if (error) throw error;
            setCards(prev => prev.filter(c => c.id !== cardId));
            setEditingCard(null);
        } catch (err) {
            console.error(err);
            alert("Erro ao deletar");
        }
    }

    // Filtragem por Grupo Selecionado
    const filteredCards = cards.filter(card => {
        if (!selectedGroup) return true;
        return card.members?.groups?.name === selectedGroup;
    });

    return (
        <div className="min-h-screen bg-[#f8eef2] font-sans text-gray-800 pb-16">

            {/* BARRA SUPERIOR FIXA */}
            <div className="bg-white/90 backdrop-blur-md border-b border-pink-200 sticky top-0 z-20 px-6 py-3 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <a href="/" className="p-2 rounded-full hover:bg-pink-50 text-pink-500 transition-colors">
                        <ArrowLeft size={20} />
                    </a>
                    <h1 className="text-lg font-black text-pink-600 uppercase tracking-wider flex items-center gap-2">
                        <span>🎀</span> Album Wishlist
                    </h1>
                </div>

                <button
                    onClick={() => {
                        setEditForm({ description: '', nome_ceg: '' });
                        setSelectedOwner('');
                        setIsAddingNew(true);
                    }}
                    className="bg-pink-500 hover:bg-pink-600 text-white px-4 py-1.5 rounded-full text-xs font-bold transition-all shadow flex items-center gap-1.5 uppercase tracking-wider"
                >
                    <Plus size={16} /> Adicionar Quadro
                </button>
            </div>

            <div className="max-w-6xl mx-auto p-4 sm:p-8 space-y-6">

                {/* FILTROS POR GRUPO */}
                <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
                    <button
                        onClick={() => setSelectedGroup('')}
                        className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${selectedGroup === ''
                                ? 'bg-pink-500 text-white shadow'
                                : 'bg-white text-gray-600 hover:bg-pink-50 border border-pink-200'
                            }`}
                    >
                        ✨ Todos os Grupos
                    </button>
                    {Object.keys(groupsData).map(groupName => (
                        <button
                            key={groupName}
                            onClick={() => setSelectedGroup(groupName)}
                            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap ${selectedGroup === groupName
                                    ? 'bg-pink-500 text-white shadow'
                                    : 'bg-white text-gray-600 hover:bg-pink-50 border border-pink-200'
                                }`}
                        >
                            {groupName}
                        </button>
                    ))}
                </div>

                {/* BOARD PRINCIPAL DO TEMPLATE */}
                <div className="bg-white border-4 border-pink-300 rounded-[2.5rem] p-6 sm:p-8 shadow-xl relative min-h-[500px]">

                    {/* BANNER DE TÍTULO */}
                    <div className="text-center mb-8 border-b-2 border-dashed border-pink-200 pb-6">
                        <div className="inline-block bg-gradient-to-r from-pink-400 to-rose-400 text-white px-8 py-2 rounded-full shadow-md transform -rotate-1 mb-1">
                            <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-widest font-serif drop-shadow-sm">
                                {selectedGroup ? `${selectedGroup} Wishlist` : 'Album Wishlist'}
                            </h2>
                        </div>
                    </div>

                    {/* GRADE DE QUADROS (IDÊNTICA AO PRINT) */}
                    {loading ? (
                        <div className="text-center py-20 text-pink-400 font-bold flex flex-col items-center gap-2">
                            <Sparkles className="animate-spin text-pink-500" size={28} />
                            <span>Carregando quadros...</span>
                        </div>
                    ) : filteredCards.length === 0 ? (
                        <div className="text-center py-20 text-pink-300 font-medium text-sm flex flex-col items-center gap-2">
                            <Sparkles size={32} />
                            <span>Nenhum quadro criado para este filtro.</span>
                            <span className="text-xs text-pink-400">Clique no botão no topo para criar o primeiro!</span>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
                            {filteredCards.map((card) => {
                                const hasMainImage = !!card.image_url;

                                return (
                                    <div
                                        key={card.id}
                                        className="aspect-square bg-[#fdf8fa] rounded-2xl border-2 border-pink-100 hover:border-pink-300 shadow-xs relative overflow-hidden group hover:shadow-md transition-all flex flex-col items-center justify-center"
                                    >
                                        {hasMainImage ? (
                                            /* CARD COM FOTO PREENCHIDA */
                                            <div
                                                onClick={() => {
                                                    setEditingCard(card);
                                                    setEditForm({ description: card.description || '', nome_ceg: card.nome_ceg || '' });
                                                }}
                                                className="w-full h-full cursor-pointer relative"
                                            >
                                                <img
                                                    src={card.image_url}
                                                    alt=""
                                                    className="w-full h-full object-cover"
                                                />

                                                {/* TARJA ESCURA NO RODAPÉ DO CARD */}
                                                <div className="absolute bottom-1.5 left-1.5 right-1.5 bg-black/75 backdrop-blur-xs text-white text-[9px] font-bold px-2 py-1 rounded-md truncate text-center uppercase tracking-tight">
                                                    {card.description || 'CAIXINHA EUA #4'}
                                                </div>
                                            </div>
                                        ) : (
                                            /* SLOT EM BRANCO (ADD FOTO) */
                                            <label className="w-full h-full flex flex-col items-center justify-center text-pink-300 hover:text-pink-500 cursor-pointer hover:bg-pink-100/40 transition-colors p-4">
                                                <Camera size={26} strokeWidth={1.5} className="mb-1 text-pink-300" />
                                                <span className="text-xs font-bold tracking-tight text-pink-400">Add Foto</span>
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    className="hidden"
                                                    onChange={(e) => handleMainImageUpload(e, card.id)}
                                                />
                                            </label>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* MODAL CRIAR NOVO QUADRO */}
            {isAddingNew && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
                    <div className="bg-white border-2 border-pink-200 rounded-3xl shadow-2xl w-full max-w-sm p-6 space-y-4 relative">
                        <button onClick={() => setIsAddingNew(false)} className="absolute top-4 right-4 text-gray-400 hover:text-pink-500">
                            <X size={20} />
                        </button>

                        <h3 className="text-sm font-black text-pink-600 uppercase tracking-wider text-center">
                            Novo Quadro em Branco
                        </h3>

                        <div className="space-y-3 text-xs">
                            <div>
                                <label className="block font-bold text-gray-500 uppercase text-[10px] mb-1">Título do Card / Descrição</label>
                                <input
                                    type="text"
                                    value={editForm.description}
                                    onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                                    className="w-full border border-pink-200 p-2 rounded-xl text-sm focus:outline-pink-400"
                                    placeholder="Ex: CAIXINHA EUA #4"
                                />
                            </div>

                            <div>
                                <label className="block font-bold text-gray-500 uppercase text-[10px] mb-1">Nome da Era / Álbum (CEG)</label>
                                <input
                                    type="text"
                                    value={editForm.nome_ceg}
                                    onChange={e => setEditForm({ ...editForm, nome_ceg: e.target.value })}
                                    className="w-full border border-pink-200 p-2 rounded-xl text-sm focus:outline-pink-400"
                                    placeholder="Ex: Summer Magic, Chill Kill..."
                                />
                            </div>

                            <div>
                                <label className="block font-bold text-gray-500 uppercase text-[10px] mb-1">Membro ou Grupo</label>
                                <select
                                    value={selectedOwner}
                                    onChange={e => setSelectedOwner(e.target.value)}
                                    className="w-full border border-pink-200 p-2 rounded-xl text-sm bg-white focus:outline-pink-400"
                                >
                                    <option value="">Selecione um grupo ou membro...</option>
                                    {Object.entries(groupsData).map(([groupName, members]) => (
                                        <optgroup key={groupName} label={`── ${groupName} ──`}>
                                            {/* Opção para o Grupo Inteiro */}
                                            {members && members.length > 0 && (
                                                <option value={`group_${members[0].id}`} className="font-bold text-purple-700">
                                                    📦 {groupName} (Grupo Todos)
                                                </option>
                                            )}

                                            {/* Opções dos Membros Individuais */}
                                            {members?.map(m => (
                                                <option key={m.id} value={`member_${m.id}`}>
                                                    👤 {m.name}
                                                </option>
                                            ))}
                                        </optgroup>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <button
                            onClick={handleCreateEmptyCard}
                            className="w-full bg-pink-500 hover:bg-pink-600 text-white py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow text-xs uppercase tracking-wider mt-2"
                        >
                            <Plus size={16} /> Adicionar Quadro
                        </button>
                    </div>
                </div>
            )}

            {/* MODAL DETALHES DO CARD (COM FOTOS EXTRAS INTERNAS) */}
            {editingCard && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
                    <div className="bg-white border-2 border-pink-200 rounded-3xl shadow-2xl w-full max-w-md p-6 space-y-4 relative max-h-[90vh] overflow-y-auto">
                        <button onClick={() => setEditingCard(null)} className="absolute top-4 right-4 text-gray-400 hover:text-pink-500">
                            <X size={20} />
                        </button>

                        <h3 className="text-sm font-black text-pink-600 uppercase tracking-wider text-center">
                            Detalhes do Card
                        </h3>

                        {/* FOTO PRINCIPAL */}
                        <div className="w-full h-52 bg-pink-50/50 rounded-2xl overflow-hidden relative border border-pink-100 flex items-center justify-center">
                            <img src={editingCard.image_url} alt="" className="w-full h-full object-contain mx-auto" />
                        </div>

                        {/* GALERIA DE FOTOS INTERNAS/EXTRAS */}
                        <div className="space-y-2 pt-2 border-t border-pink-100">
                            <div className="flex justify-between items-center">
                                <span className="text-xs font-bold text-gray-700 uppercase flex items-center gap-1">
                                    <ImageIcon size={14} className="text-pink-500" /> Fotos Internas / Extras
                                </span>
                                <label className="text-[10px] font-bold text-pink-600 bg-pink-50 hover:bg-pink-100 px-2.5 py-1 rounded-lg cursor-pointer transition-colors border border-pink-200">
                                    + Add Foto Extra
                                    <input type="file" accept="image/*" className="hidden" onChange={handleExtraPhotoUpload} />
                                </label>
                            </div>

                            <div className="grid grid-cols-4 gap-2 pt-1">
                                {editingCard.extra_images && editingCard.extra_images.length > 0 ? (
                                    editingCard.extra_images.map((imgUrl, index) => (
                                        <a key={index} href={imgUrl} target="_blank" rel="noreferrer" className="aspect-square bg-pink-50 rounded-xl overflow-hidden border border-pink-100 hover:opacity-90">
                                            <img src={imgUrl} className="w-full h-full object-cover" alt="" />
                                        </a>
                                    ))
                                ) : (
                                    <div className="col-span-4 text-center py-4 text-xs text-pink-300 bg-pink-50/30 rounded-xl border border-dashed border-pink-200">
                                        Nenhuma foto interna adicionada.
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* CAMPOS DE EDIÇÃO */}
                        <div className="space-y-3 text-xs pt-2 border-t border-pink-100">
                            <div>
                                <label className="block font-bold text-gray-500 uppercase text-[10px] mb-1">Título do Card / Descrição</label>
                                <input
                                    type="text"
                                    value={editForm.description}
                                    onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                                    className="w-full border border-pink-200 p-2 rounded-xl text-sm focus:outline-pink-400"
                                />
                            </div>

                            <div>
                                <label className="block font-bold text-gray-500 uppercase text-[10px] mb-1">Era / Nome do Álbum (CEG)</label>
                                <input
                                    type="text"
                                    value={editForm.nome_ceg}
                                    onChange={e => setEditForm({ ...editForm, nome_ceg: e.target.value })}
                                    className="w-full border border-pink-200 p-2 rounded-xl text-sm focus:outline-pink-400"
                                />
                            </div>
                        </div>

                        {/* BOTÕES DE AÇÃO */}
                        <div className="flex gap-2 pt-2">
                            <button
                                onClick={handleSaveCard}
                                className="flex-1 bg-pink-500 hover:bg-pink-600 text-white py-2.5 rounded-xl font-bold text-xs uppercase flex items-center justify-center gap-1.5 shadow transition-all"
                            >
                                <Save size={16} /> Salvar Alterações
                            </button>

                            <button
                                onClick={() => handleDeleteCard(editingCard.id)}
                                className="bg-rose-50 hover:bg-rose-100 text-rose-600 p-2.5 rounded-xl border border-rose-200 transition-colors"
                                title="Apagar Quadro"
                            >
                                <Trash2 size={18} />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}