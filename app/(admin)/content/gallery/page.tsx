"use client";
import { useState, useEffect } from "react";
import { collection, getDocs, addDoc, deleteDoc, updateDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Trash2, Edit2, Plus, Image as ImageIcon, Video, Youtube } from "lucide-react";

export default function GalleryPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ title: "", mediaType: "image", mediaUrl: "" });

  useEffect(() => { fetchItems(); }, []);
  const fetchItems = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "gallery_items"));
      setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a: any, b: any) => b.createdAt - a.createdAt));
    } finally { setLoading(false); }
  };

  const handleSave = async (e: any) => {
    e.preventDefault();
    if (editingId) {
      await updateDoc(doc(db, "gallery_items", editingId), formData);
    } else {
      await addDoc(collection(db, "gallery_items"), { ...formData, createdAt: Date.now() });
    }
    setIsModalOpen(false);
    fetchItems();
  };

  const handleDelete = async (id: string) => {
    if (confirm("Delete this media?")) {
      await deleteDoc(doc(db, "gallery_items", id));
      fetchItems();
    }
  };

  return (
    <div className="flex flex-col h-full font-inter">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-3xl font-montserrat font-bold text-[#0F172A] tracking-tight">Gallery</h2>
        <button onClick={() => { setFormData({title:"", mediaType:"image", mediaUrl:""}); setEditingId(null); setIsModalOpen(true); }} className="bg-[#F59E0B] text-white px-6 h-14 rounded-[18px] font-semibold flex items-center gap-2 hover:scale-[1.03] shadow-[0_10px_40px_rgba(245,158,11,0.3)] transition-all">
          <Plus className="h-5 w-5" /> Add Media
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 overflow-y-auto pb-8">
        {items.map(item => (
          <div key={item.id} className="bg-white/55 backdrop-blur-[24px] border border-white/35 rounded-[28px] overflow-hidden shadow-[0_10px_40px_rgba(15,23,42,0.08)] hover:-translate-y-2 hover:shadow-[0_25px_60px_rgba(15,23,42,0.16)] transition-all duration-300">
            <div className="h-48 bg-slate-100 flex items-center justify-center overflow-hidden relative">
              {item.mediaType === 'image' ? <img src={item.mediaUrl} className="w-full h-full object-cover" /> : <div className="text-slate-400 font-bold uppercase tracking-widest flex items-center gap-2">{item.mediaType === 'youtube' ? <Youtube className="w-6 h-6"/> : <Video className="w-6 h-6"/>} {item.mediaType}</div>}
            </div>
            <div className="p-6">
              <h3 className="font-bold text-[#0F172A] text-lg mb-4 truncate">{item.title}</h3>
              <div className="flex items-center gap-3">
                <button onClick={() => { setFormData({title:item.title, mediaType:item.mediaType, mediaUrl:item.mediaUrl}); setEditingId(item.id); setIsModalOpen(true); }} className="text-blue-500 hover:text-blue-700 text-sm font-bold uppercase tracking-wider flex items-center gap-1"><Edit2 className="w-4 h-4"/> Edit</button>
                <button onClick={() => handleDelete(item.id)} className="text-red-500 hover:text-red-700 text-sm font-bold uppercase tracking-wider flex items-center gap-1"><Trash2 className="w-4 h-4"/> Delete</button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#020617]/40 backdrop-blur-sm p-4">
          <form onSubmit={handleSave} className="bg-white/95 backdrop-blur-3xl border border-white/40 p-8 rounded-[32px] w-full max-w-lg shadow-[0_25px_60px_rgba(0,0,0,0.45)]">
            <h3 className="text-2xl font-bold font-montserrat tracking-tight mb-6">{editingId ? 'Edit' : 'Add'} Media</h3>
            <div className="space-y-4">
              <div><label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Title</label><input required className="w-full bg-slate-50 border border-slate-200 rounded-[18px] p-4 text-[#0F172A] outline-none focus:ring-2 focus:ring-blue-500 transition-all" value={formData.title} onChange={e=>setFormData({...formData, title:e.target.value})} /></div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Type</label>
                <select className="w-full bg-slate-50 border border-slate-200 rounded-[18px] p-4 text-[#0F172A] outline-none focus:ring-2 focus:ring-blue-500 transition-all" value={formData.mediaType} onChange={e=>setFormData({...formData, mediaType:e.target.value})}>
                  <option value="image">Image</option><option value="youtube">YouTube</option><option value="video">Video</option>
                </select>
              </div>
              <div><label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Media URL</label><input required type="url" className="w-full bg-slate-50 border border-slate-200 rounded-[18px] p-4 text-[#0F172A] outline-none focus:ring-2 focus:ring-blue-500 transition-all" value={formData.mediaUrl} onChange={e=>setFormData({...formData, mediaUrl:e.target.value})} /></div>
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