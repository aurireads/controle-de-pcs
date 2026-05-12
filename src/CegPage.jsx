import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { ArrowLeft, ExternalLink, X, Save } from 'lucide-react';

export default function CegPage() {
    const [cegs, setCegs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingItem, setEditingItem] = useState(null);

    const [editForm, setEditForm] = useState({
        status_pagamento: 'pendente',
        valor_item: '',
        taxa: '', status_taxa1: 'pendente',
        taxa2: '', status_taxa2: 'pendente',
        frete: '', status_frete1: 'pendente',
        frete2: '', status_frete2: 'pendente',
        description: '',
        nome_ceg: ''
    });

    useEffect(() => { fetchCegs(); }, []);

    async function fetchCegs() {
        setLoading(true);
        try {
            const { data } = await supabase.from('collection').select(`*, members(name, groups(name))`).eq('status', 'ceg').not('image_url', 'is', null).order('nome_ceg', { ascending: true });
            const uniques = (data || []).filter((item, i, self) => i === self.findIndex((t) => t.id === item.id));
            setCegs(uniques);
        } finally { setLoading(false); }
    }

    function handleEditClick(item) {
        setEditingItem(item);
        setEditForm({
            status_pagamento: item.status_pagamento || 'pendente',
            valor_item: item.valor_item || '',
            taxa: item.taxa || '', status_taxa1: item.status_taxa1 || 'pendente',
            taxa2: item.taxa2 || '', status_taxa2: item.status_taxa2 || 'pendente',
            frete: item.frete || '', status_frete1: item.status_frete1 || 'pendente',
            frete2: item.frete2 || '', status_frete2: item.status_frete2 || 'pendente',
            description: item.description || '',
            nome_ceg: item.nome_ceg || ''
        });
    }

async function handleSave() {
    try {
        // Criamos uma cópia dos dados para garantir que números vazios sejam nulos
        const dataToSave = {
            ...editForm,
            valor_item: editForm.valor_item === '' ? null : editForm.valor_item,
            taxa: editForm.taxa === '' ? null : editForm.taxa,
            taxa2: editForm.taxa2 === '' ? null : editForm.taxa2,
            frete: editForm.frete === '' ? null : editForm.frete,
            frete2: editForm.frete2 === '' ? null : editForm.frete2,
        };

        const { error } = await supabase.from('collection').update(dataToSave).eq('id', editingItem.id);
        if (error) throw error;
        
        setCegs(cegs.map(c => c.id === editingItem.id ? { ...c, ...dataToSave } : c));
        setEditingItem(null);
    } catch (err) { 
        console.error(err);
        alert("Erro ao salvar"); 
    }
}

    return (
        <div className="min-h-screen bg-white font-sans text-gray-900">
            <div className="border-b bg-white sticky top-0 z-10 p-6 shadow-sm flex items-center gap-4">
                <a href="/"><ArrowLeft size={24} /></a>
                <h1 className="text-2xl font-bold">Financeiro Detalhado</h1>
            </div>

            <div className="max-w-7xl mx-auto p-6">
                <div className="overflow-x-auto border rounded-xl shadow-sm">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-50 border-b text-[10px] uppercase text-gray-500 font-bold">
                            <tr>
                                <th className="p-4">Item</th>
                                <th className="p-4">Status Pagamentos</th>
                                <th className="p-4 text-right">Total Acumulado</th>
                                <th className="p-4 text-center">Ação</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {cegs.map((item, index) => {
                                const showHeader = index === 0 || item.nome_ceg !== cegs[index - 1].nome_ceg;
                                const total = (Number(item.valor_item)||0) + (Number(item.taxa)||0) + (Number(item.taxa2)||0) + (Number(item.frete)||0) + (Number(item.frete2)||0);
                                
                                const Badge = ({ status, label }) => (
                                    <div className="flex flex-col items-center">
                                        <span className="text-[8px] text-gray-400 font-bold">{label}</span>
                                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-black ${status === 'pago' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                            {status?.toUpperCase()}
                                        </span>
                                    </div>
                                );

                                return (
                                    <React.Fragment key={item.id}>
                                        {showHeader && (
                                            <tr className="bg-purple-50"><td colSpan="4" className="p-2 pl-4 text-[10px] font-black text-purple-600 uppercase tracking-widest">📦 {item.nome_ceg || 'Sem Identificador'}</td></tr>
                                        )}
                                        <tr className="hover:bg-gray-50">
                                            <td className="p-4 flex items-center gap-3">
                                                <img src={item.image_url} className="w-10 h-14 object-cover rounded" />
                                                <span className="font-medium text-xs">{item.description}</span>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex gap-3">
                                                    <Badge status={item.status_pagamento} label="ITEM" />
                                                    <Badge status={item.status_taxa1} label="TAXA 1" />
                                                    <Badge status={item.status_taxa2} label="TAXA 2" />
                                                    <Badge status={item.status_frete1} label="FRETE 1" />
                                                    <Badge status={item.status_frete2} label="FRETE 2" />
                                                </div>
                                            </td>
                                            <td className="p-4 text-right font-black text-sm text-purple-700">R$ {total.toFixed(2)}</td>
                                            <td className="p-4 text-center">
                                                <button onClick={() => handleEditClick(item)} className="text-gray-400 hover:text-purple-600"><ExternalLink size={18} /></button>
                                            </td>
                                        </tr>
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* MODAL */}
            {editingItem && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center border-b pb-2">
                            <h2 className="font-bold">Editar Financeiro</h2>
                            <button onClick={() => setEditingItem(null)}><X /></button>
                        </div>

                        {/* Campos de Input */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-2 bg-gray-50 p-2 rounded text-xs font-bold">Item & CEG</div>
                            <input type="text" value={editForm.description} onChange={e => setEditForm({...editForm, description: e.target.value})} className="border p-2 rounded text-sm" placeholder="Descrição" />
                            <input type="text" value={editForm.nome_ceg} onChange={e => setEditForm({...editForm, nome_ceg: e.target.value})} className="border p-2 rounded text-sm" placeholder="Nome da CEG" />
                            
                            <div className="col-span-2 bg-purple-50 p-2 rounded text-xs font-bold text-purple-600">Pagamento Principal</div>
                            <input type="number" value={editForm.valor_item} onChange={e => setEditForm({...editForm, valor_item: e.target.value})} className="border p-2 rounded text-sm" placeholder="Valor Item" />
                            <select value={editForm.status_pagamento} onChange={e => setEditForm({...editForm, status_pagamento: e.target.value})} className="border p-2 rounded text-sm">
                                <option value="pendente">Pendente</option><option value="pago">Pago</option>
                            </select>

                            {/* TAXAS */}
                            <div className="col-span-2 bg-green-50 p-2 rounded text-xs font-bold text-green-600">Taxas</div>
                            <div className="flex gap-2">
                                <input type="number" value={editForm.taxa} onChange={e => setEditForm({...editForm, taxa: e.target.value})} className="w-1/2 border p-2 rounded text-sm" placeholder="Taxa 1" />
                                <select value={editForm.status_taxa1} onChange={e => setEditForm({...editForm, status_taxa1: e.target.value})} className="w-1/2 border p-2 rounded text-xs">
                                    <option value="pendente">Pend.</option><option value="pago">Pago</option>
                                </select>
                            </div>
                            <div className="flex gap-2">
                                <input type="number" value={editForm.taxa2} onChange={e => setEditForm({...editForm, taxa2: e.target.value})} className="w-1/2 border p-2 rounded text-sm" placeholder="Taxa 2" />
                                <select value={editForm.status_taxa2} onChange={e => setEditForm({...editForm, status_taxa2: e.target.value})} className="w-1/2 border p-2 rounded text-xs">
                                    <option value="pendente">Pend.</option><option value="pago">Pago</option>
                                </select>
                            </div>

                            {/* FRETES */}
                            <div className="col-span-2 bg-blue-50 p-2 rounded text-xs font-bold text-blue-600">Fretes</div>
                            <div className="flex gap-2">
                                <input type="number" value={editForm.frete} onChange={e => setEditForm({...editForm, frete: e.target.value})} className="w-1/2 border p-2 rounded text-sm" placeholder="Frete 1" />
                                <select value={editForm.status_frete1} onChange={e => setEditForm({...editForm, status_frete1: e.target.value})} className="w-1/2 border p-2 rounded text-xs">
                                    <option value="pendente">Pend.</option><option value="pago">Pago</option>
                                </select>
                            </div>
                            <div className="flex gap-2">
                                <input type="number" value={editForm.frete2} onChange={e => setEditForm({...editForm, frete2: e.target.value})} className="w-1/2 border p-2 rounded text-sm" placeholder="Frete 2" />
                                <select value={editForm.status_frete2} onChange={e => setEditForm({...editForm, status_frete2: e.target.value})} className="w-1/2 border p-2 rounded text-xs">
                                    <option value="pendente">Pend.</option><option value="pago">Pago</option>
                                </select>
                            </div>
                        </div>

                        <button onClick={handleSave} className="w-full bg-black text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-gray-800 transition-all mt-4">
                            <Save size={18} /> Salvar Tudo
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}