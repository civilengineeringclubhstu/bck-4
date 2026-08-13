"use client";

import { useState, useEffect } from "react";
import { collection, getDocs, addDoc, deleteDoc, updateDoc, doc, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Trash2, Edit2, Plus } from "lucide-react";

interface BlogPost {
  id: string;
  title: string;
  descriptionMarkdown: string;
  coverImageUrl: string;
  createdAt: number;
}

export default function BlogPage() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    title: "",
    descriptionMarkdown: "",
    coverImageUrl: "",
  });

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    try {
      const q = query(collection(db, "blogs"), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BlogPost));
      setPosts(data);
      setError(null);
    } catch (err: any) {
      console.error("Error fetching blogs:", err);
      setError(err.message || "Failed to load blogs. Check database permissions.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await updateDoc(doc(db, "blogs", editingId), formData);
      } else {
        await addDoc(collection(db, "blogs"), {
          ...formData,
          createdAt: Date.now()
        });
      }
      setIsModalOpen(false);
      resetForm();
      fetchPosts();
    } catch (err: any) {
      console.error("Error saving blog post:", err);
      alert(err.message || "Failed to save blog post. Check database permissions.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this blog post?")) return;
    try {
      await deleteDoc(doc(db, "blogs", id));
      fetchPosts();
    } catch (err: any) {
      console.error("Error deleting blog post:", err);
      alert(err.message || "Failed to delete blog post. Check database permissions.");
    }
  };

  const openEditModal = (post: BlogPost) => {
    setFormData({
      title: post.title,
      descriptionMarkdown: post.descriptionMarkdown,
      coverImageUrl: post.coverImageUrl || "",
    });
    setEditingId(post.id);
    setIsModalOpen(true);
  };

  const resetForm = () => {
    setFormData({ title: "", descriptionMarkdown: "", coverImageUrl: "" });
    setEditingId(null);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-col items-center shrink-0 mb-4">
        <h2 className="text-xl font-bold text-slate-900 mb-2">Blog</h2>
        <button
          onClick={() => { resetForm(); setIsModalOpen(true); }}
          className="inline-flex items-center gap-2 bg-blue-600 px-4 py-2 rounded-lg text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4 shrink-0" />
          Add Blog Post
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative mb-4 shrink-0" role="alert">
          <strong className="font-bold">Database Error: </strong>
          <span className="block sm:inline">{error}</span>
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 overflow-auto pb-8">
        {loading ? (
          <div className="col-span-full py-10 text-center text-gray-500">Loading posts...</div>
        ) : posts.length === 0 ? (
          <div className="col-span-full py-10 text-center text-gray-500">No blog posts found.</div>
        ) : (
          posts.map((post) => (
            <div key={post.id} className="flex flex-col overflow-hidden rounded-xl bg-white shadow-sm border border-gray-200">
              <div className="flex-shrink-0">
                {post.coverImageUrl ? (
                  <img className="h-48 w-full object-cover" src={post.coverImageUrl} alt="" />
                ) : (
                  <div className="h-48 w-full bg-gray-100 flex items-center justify-center text-gray-400 text-xs font-bold uppercase tracking-widest">No Image</div>
                )}
              </div>
              <div className="flex flex-1 flex-col justify-between p-5">
                <div className="flex-1">
                  <h3 className="text-lg font-black text-slate-800 line-clamp-1">{post.title}</h3>
                  <p className="mt-2 text-sm text-gray-500 line-clamp-2">
                    {(post.descriptionMarkdown || '').substring(0, 50)}{((post.descriptionMarkdown || '').length > 50) ? '...' : ''}
                  </p>
                </div>
                <div className="mt-4 flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                  <button onClick={() => openEditModal(post)} className="text-blue-500 hover:text-blue-700 flex items-center text-xs font-bold uppercase tracking-wider transition-colors">
                    <Edit2 className="h-3 w-3 mr-1" /> Edit
                  </button>
                  <button onClick={() => handleDelete(post.id)} className="text-red-500 hover:text-red-700 flex items-center text-xs font-bold uppercase tracking-wider transition-colors">
                    <Trash2 className="h-3 w-3 mr-1" /> Delete
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black bg-opacity-50 overflow-y-auto">
          <div className="bg-white rounded-xl p-6 w-full max-w-3xl shadow-xl my-8">
            <h3 className="text-lg font-bold text-slate-900 mb-6">{editingId ? "Edit Blog Post" : "Add Blog Post"}</h3>
            <form onSubmit={handleCreateOrUpdate} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Title</label>
                <input required type="text" className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm p-3 border" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Cover Image Link</label>
                <input type="url" className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm p-3 border" value={formData.coverImageUrl} onChange={e => setFormData({...formData, coverImageUrl: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Description (Markdown Supported)</label>
                <textarea required rows={12} className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm p-3 border font-mono" value={formData.descriptionMarkdown} onChange={e => setFormData({...formData, descriptionMarkdown: e.target.value})} placeholder="# Heading 1&#10;Write your content in markdown... Images can be embedded as ![alt](link)" />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="inline-flex justify-center rounded-lg border border-gray-300 bg-white px-6 py-2 text-sm font-bold text-slate-700 shadow-sm hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" className="inline-flex justify-center rounded-lg border border-transparent bg-blue-600 px-6 py-2 text-sm font-bold text-white shadow-sm hover:bg-blue-700">
                  {editingId ? "Save Changes" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
