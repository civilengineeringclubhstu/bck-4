"use client";
import { useState, useEffect } from "react";
import { collection, getDocs, addDoc, deleteDoc, updateDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Trash2, Edit2, Plus, Image as ImageIcon, Video, Youtube } from "lucide-react";

interface GalleryItem {
  type: string;
  url: string;
}

interface Gallery {
  id: string;
  title: string;
  items: GalleryItem[];
  createdAt: number;
}

export default function GalleryPage() {
  const [galleries, setGalleries] = useState<Gallery[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [items, setItems] = useState<GalleryItem[]>([]);

  useEffect(() => { fetchGalleries(); }, []);

  const fetchGalleries = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "gallery_items"));
      setGalleries(snap.docs.map(d => ({ id: d.id, ...d.data() } as Gallery)).sort((a, b) => b.createdAt - a.createdAt));
    } finally { setLoading(false); }
  };

  const handleSave = async (e: any) => {
    e.preventDefault();
    const data = { title, items };
    if (editingId) {
      await updateDoc(doc(db, "gallery_items", editingId), data);
    } else {
      await addDoc(collection(db, "gallery_items"), { ...data, createdAt: Date.now() });
    }
    setIsModalOpen(false);
    fetchGalleries();
  };

  const handleDelete = async (id: string) => {
    if (confirm("Delete this gallery?")) {
      await deleteDoc(doc(db, "gallery_items", id));
      fetchGalleries();
    }
  };

  const addItem = () => setItems([...items, { type: "image", url: "" }]);
  const updateItem = (index: number, field: string, val: string) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: val };
    setItems(newItems);
  };
  const removeItem = (index: number) => {
    const newItems = [...items];
    newItems.splice(index, 1);
    setItems(newItems);
  };

  return (
    <div className="flex flex-col h-full font-inter">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-3xl font-montserrat font-bold text-[#0F172A] tracking-tight">Gallery</h2>
        <button onClick={() => { setTitle(""); setItems([]); setEditingId(null); setIsModalOpen(true); }} className="bg-[#F59E0B] text-white px-6 h-14 rounded-[18px] font-semibold flex items-center gap-2 hover:scale-[1.03] shadow-[0_10px_40px_rgba(245,158,11,0.3)] transition-all">
          <Plus className="h-5 w-5" /> Add Gallery
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 overflow-y-auto pb-8">
        {galleries.map(gal => (
          <div key={gal.id} className="bg-white/55 backdrop-blur-[24px] border border-white/35 p-6 rounded-[28px] shadow-[0_10px_40px_rgba(15,23,42,0.08)] flex flex-col hover:-translate-y-2 hover:shadow-[0_25px_60px_rgba(15,23,42,0.16)] transition-all duration-300">
            <h3 className="font-bold text-[#0F172A] text-xl mb-2">{gal.title}</h3>
            <p className="text-sm text-slate-500 mb-4">{gal.items?.length || 0} media items</p>
            <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
              {gal.items?.map((it, i) => (
                <div key={i} className="w-16 h-16 rounded-xl bg-slate-100 flex-shrink-0 overflow-hidden flex items-center justify-center">
                  {it.type === 'image' ? <img src={it.url} className="w-full h-full object-cover" /> : <Video className="w-6 h-6 text-slate-400" />}
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3 mt-auto pt-4 border-t border-slate-100">
              <button onClick={() => { setTitle(gal.title); setItems(gal.items || []); setEditingId(gal.id); setIsModalOpen(true); }} className="text-blue-500 hover:text-blue-700 text-sm font-bold uppercase tracking-wider flex items-center gap-1"><Edit2 className="w-4 h-4"/> Edit</button>
              <button onClick={() => handleDelete(gal.id)} className="text-red-500 hover:text-red-700 text-sm font-bold uppercase tracking-wider flex items-center gap-1"><Trash2 className="w-4 h-4"/> Delete</button>
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#020617]/40 backdrop-blur-sm p-4 overflow-y-auto">
          <form onSubmit={handleSave} className="bg-white/95 backdrop-blur-3xl border border-white/40 p-8 rounded-[32px] w-full max-w-2xl shadow-[0_25px_60px_rgba(0,0,0,0.45)] my-8">
            <h3 className="text-2xl font-bold font-montserrat tracking-tight mb-6">{editingId ? 'Edit' : 'Add'} Gallery</h3>
            
            <div className="space-y-6">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Gallery Title</label>
                <input required className="w-full bg-slate-50 border border-slate-200 rounded-[18px] p-4 text-[#0F172A] outline-none focus:ring-2 focus:ring-blue-500 transition-all" value={title} onChange={e=>setTitle(e.target.value)} />
              </div>
              
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest">Media Items</label>
                  <button type="button" onClick={addItem} className="text-xs font-bold text-blue-600 uppercase tracking-wider flex items-center gap-1 hover:text-blue-800"><Plus className="w-3 h-3"/> Add Media</button>
                </div>
                <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                  {items.map((item, index) => (
                    <div key={index} className="flex gap-2 items-center bg-slate-50 p-3 rounded-[18px] border border-slate-200">
                      <select className="bg-white border border-slate-200 rounded-xl p-2 outline-none text-sm w-32" value={item.type} onChange={e=>updateItem(index, 'type', e.target.value)}>
                        <option value="image">Image</option>
                        <option value="video">Video</option>
                        <option value="youtube">YouTube</option>
                      </select>
                      <input required type="url" placeholder="URL" className="flex-1 bg-white border border-slate-200 rounded-xl p-2 outline-none text-sm" value={item.url} onChange={e=>updateItem(index, 'url', e.target.value)} />
                      <button type="button" onClick={() => removeItem(index)} className="text-red-400 hover:text-red-600 p-2"><Trash2 className="w-4 h-4"/></button>
                    </div>
                  ))}
                  {items.length === 0 && <p className="text-sm text-slate-400 italic py-2">No media added. Click "Add Media".</p>}
                </div>
              </div>
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
