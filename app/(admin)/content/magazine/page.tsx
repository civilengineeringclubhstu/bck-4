"use client";
import { useState, useEffect } from "react";
import { collection, getDocs, addDoc, deleteDoc, updateDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Trash2, Edit2, Plus, BookOpen } from "lucide-react";

export default function MagazinePage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ title: "", coverImageUrl: "", pdfUrl: "" });

  useEffect(() => { fetchItems(); }, []);
  const fetchItems = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "magazines"));
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a: any, b: any) => b.createdAt - a.createdAt));
    } finally { setLoading(false); }
  };

  const handleSave = async (e: any) => {
    e.preventDefault();
    if (editingId) {
      await updateDoc(doc(db, "magazines", editingId), formData);
    } else {
      await addDoc(collection(db, "magazines"), { ...formData, createdAt: Date.now() });
    }
    setIsModalOpen(false);
    fetchItems();
  };

  return (
    <div className="flex flex-col h-full font-inter">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-3xl font-montserrat font-bold text-[#0F172A] tracking-tight">Magazine</h2>
        <button onClick={() => { setFormData({title:"", coverImageUrl:"", pdfUrl:""}); setEditingId(null); setIsModalOpen(true); }} className="bg-[#F59E0B] text-white px-6 h-14 rounded-[18px] font-semibold flex items-center gap-2 hover:scale-[1.03] shadow-[0_10px_40px_rgba(245,158,11,0.3)] transition-all">
          <Plus className="h-5 w-5" /> Add Magazine
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 overflow-y-auto pb-8">
        {items.map(item => (
          <div key={item.id} className="bg-white/55 backdrop-blur-[24px] border border-white/35 rounded-[28px] overflow-hidden shadow-[0_10px_40px_rgba(15,23,42,0.08)] hover:-translate-y-2 hover:shadow-[0_25px_60px_rgba(15,23,42,0.16)] transition-all p-6 flex flex-col justify-between">
            <div>
              <div className="h-40 w-full mb-6 rounded-[24px] bg-slate-100 overflow-hidden">
                {item.coverImageUrl ? <img src={item.coverImageUrl} className="w-full h-full object-cover opacity-60" /> : <div className="h-full flex justify-center items-center"><BookOpen className="text-slate-300 w-10 h-10"/></div>}
              </div>
              <h3 className="font-bold text-[#0F172A] text-xl mb-4 truncate">{item.title}</h3>
            </div>
            <div className="flex gap-4">
              <button onClick={() => { setFormData(item); setEditingId(item.id); setIsModalOpen(true); }} className="text-blue-500 hover:text-blue-700 text-sm font-bold uppercase"><Edit2 className="w-4 h-4 inline mr-1"/> Edit</button>
              <button onClick={() => { if(confirm("Delete?")) { deleteDoc(doc(db, "magazines", item.id)); fetchItems(); } }} className="text-red-500 hover:text-red-700 text-sm font-bold uppercase"><Trash2 className="w-4 h-4 inline mr-1"/> Delete</button>
            </div>
          </div>
        ))}
      </div>
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#020617]/40 backdrop-blur-sm p-4">
          <form onSubmit={handleSave} className="bg-white/95 backdrop-blur-3xl border border-white/40 p-8 rounded-[32px] w-full max-w-lg shadow-[0_25px_60px_rgba(0,0,0,0.45)]">
            <h3 className="text-2xl font-bold font-montserrat tracking-tight mb-6">{editingId ? 'Edit' : 'Add'} Magazine</h3>
            <div className="space-y-4">
              <div><label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Title</label><input required className="w-full bg-slate-50 border border-slate-200 rounded-[18px] p-4 text-[#0F172A] outline-none focus:ring-2 focus:ring-blue-500 transition-all" value={formData.title} onChange={e=>setFormData({...formData, title:e.target.value})} /></div>
              <div><label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Cover Image URL</label><input required type="url" className="w-full bg-slate-50 border border-slate-200 rounded-[18px] p-4 text-[#0F172A] outline-none focus:ring-2 focus:ring-blue-500 transition-all" value={formData.coverImageUrl} onChange={e=>setFormData({...formData, coverImageUrl:e.target.value})} /></div>
              <div><label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">PDF URL</label><input required type="url" className="w-full bg-slate-50 border border-slate-200 rounded-[18px] p-4 text-[#0F172A] outline-none focus:ring-2 focus:ring-blue-500 transition-all" value={formData.pdfUrl} onChange={e=>setFormData({...formData, pdfUrl:e.target.value})} /></div>
            </div>
            <div className="mt-8 flex gap-3">
              <button type="button" onClick={()=>setIsModalOpen(false)} className="flex-1 h-14 rounded-[18px] bg-white border border-slate-200 font-bold text-slate-600 hover:bg-slate-50 transition-all">Cancel</button>
              <button type="submit" className="flex-1 h-14 rounded-[18px] bg-[#F59E0B] font-bold text-white shadow-[0_10px_40px_rgba(245,158,11,0.3)] hover:scale-[1.02] transition-all">Save</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}