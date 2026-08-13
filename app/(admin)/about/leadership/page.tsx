"use client";

import { useState, useEffect } from "react";
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Trash2, Edit2, Plus } from "lucide-react";
import Papa from "papaparse";

interface Leader {
  id: string;
  name: string;
  batch: string;
  designation: string;
  photoUrl: string;
  facebookUrl?: string;
  linkedinUrl?: string;
  email?: string;
  type: "executive" | "alumni" | "advisory" | "taskforce";
  createdAt: number;
}

export default function LeadershipPage() {
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: "",
    batch: "",
    designation: "",
    photoUrl: "",
    facebookUrl: "",
    linkedinUrl: "",
    email: "",
    type: "executive",
  });
  
  const [isUploadingCSV, setIsUploadingCSV] = useState(false);

  useEffect(() => {
    fetchLeaders();
  }, []);

  const fetchLeaders = async () => {
    try {
      const q = query(collection(db, "leadership_members"), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Leader));
      setLeaders(data);
      setError(null);
    } catch (err: any) {
      console.error("Error fetching leadership:", err);
      setError(err.message || "Failed to load leaders. Check database permissions.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Validation for batch
      if (formData.type !== "advisory" && isNaN(Number(formData.batch))) {
        alert("Batch must be a number unless type is Advisory.");
        return;
      }
      
      const payload = {
        ...formData,
        batch: formData.type === "advisory" ? "A" : formData.batch,
      };

      if (editingId) {
        await updateDoc(doc(db, "leadership", editingId), payload);
      } else {
        await addDoc(collection(db, "leadership_members"), {
          ...payload,
          createdAt: Date.now()
        });
      }
      setIsModalOpen(false);
      resetForm();
      fetchLeaders();
    } catch (err: any) {
      console.error("Error saving leader:", err);
      alert(err.message || "Failed to save leader. Check database permissions.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this member?")) return;
    try {
      await deleteDoc(doc(db, "leadership", id));
      fetchLeaders();
    } catch (err: any) {
      console.error("Error deleting leader:", err);
      alert(err.message || "Failed to delete leader. Check database permissions.");
    }
  };

  const openEditModal = (leader: Leader) => {
    setFormData({
      name: leader.name,
      batch: leader.batch === "A" ? "" : leader.batch,
      designation: leader.designation,
      photoUrl: leader.photoUrl || "",
      facebookUrl: leader.facebookUrl || "",
      linkedinUrl: leader.linkedinUrl || "",
      email: leader.email || "",
      type: leader.type || "executive",
    });
    setEditingId(leader.id);
    setIsModalOpen(true);
  };

  const resetForm = () => {
    setFormData({ name: "", batch: "", designation: "", photoUrl: "", facebookUrl: "", linkedinUrl: "", email: "", type: "executive" });
    setEditingId(null);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingCSV(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const promises = results.data.map((row: any) => {
            const rowType = row.type || "executive";
            return addDoc(collection(db, "leadership_members"), {
              name: row.name || "",
              batch: rowType === "advisory" ? "A" : (row.batch || ""),
              designation: row.designation || "",
              photoUrl: row.photoUrl || "",
              facebookUrl: row.facebookUrl || "",
              linkedinUrl: row.linkedinUrl || "",
              email: row.email || "",
              type: rowType,
              createdAt: Date.now()
            });
          });
          await Promise.all(promises);
          fetchLeaders();
          alert("CSV Uploaded Successfully!");
        } catch (err: any) {
          console.error("Error parsing CSV:", err);
          alert(err.message || "Failed to upload CSV. Check database permissions.");
        } finally {
          setIsUploadingCSV(false);
        }
      },
      error: (error) => {
        console.error("CSV Parse Error:", error);
        alert(error.message || "Failed to parse CSV file.");
        setIsUploadingCSV(false);
      }
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Centered Top Alignment per PRD */}
      <div className="flex flex-col items-center shrink-0 mb-4">
        <h2 className="text-xl font-bold text-slate-900 mb-2">Leadership</h2>
        
        <div className="flex flex-col items-center gap-3">
          <label className="bg-white px-4 py-2 border border-gray-200 rounded-lg shadow-sm text-xs font-bold text-slate-700 hover:bg-gray-50 cursor-pointer">
            {isUploadingCSV ? "Uploading..." : "Upload CSV"}
            <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} disabled={isUploadingCSV} />
          </label>
          <button
            type="button"
            onClick={() => { resetForm(); setIsModalOpen(true); }}
            className="inline-flex items-center gap-2 bg-blue-600 px-4 py-2 rounded-lg text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4 shrink-0" />
            Add Member
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative mb-4 shrink-0" role="alert">
          <strong className="font-bold">Database Error: </strong>
          <span className="block sm:inline">{error}</span>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col flex-1 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
          <h4 className="font-bold text-slate-700">Member Directory</h4>
        </div>
        <div className="overflow-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th className="px-6 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">Name</th>
                <th className="px-6 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">Type</th>
                <th className="px-6 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">Designation</th>
                <th className="px-6 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">Batch</th>
                <th className="px-6 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
                  {loading ? (
                    <tr><td colSpan={5} className="py-10 text-center text-gray-500 text-xs">Loading...</td></tr>
                  ) : leaders.length === 0 ? (
                    <tr><td colSpan={5} className="py-10 text-center text-gray-500 text-xs">No members found. Add one or upload CSV.</td></tr>
                  ) : (
                    leaders.map((leader) => (
                      <tr key={leader.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-3">
                          <div className="flex items-center">
                            <div className="h-8 w-8 flex-shrink-0">
                              {leader.photoUrl ? (
                                <img className="h-8 w-8 rounded-full object-cover" src={leader.photoUrl} alt="" />
                              ) : (
                                <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-xs font-bold">?</div>
                              )}
                            </div>
                            <div className="ml-3">
                              <div className="font-semibold text-sm">{leader.name}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-3">
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-bold capitalize">
                            {leader.type}
                          </span>
                        </td>
                        <td className="px-6 py-3 text-xs font-medium">{leader.designation}</td>
                        <td className="px-6 py-3 text-xs text-gray-500 font-mono">{leader.batch}</td>
                        <td className="px-6 py-3 text-right">
                          <button onClick={() => openEditModal(leader)} className="text-blue-500 hover:text-blue-700 transition-colors mr-3">
                            <Edit2 className="h-4 w-4 inline" />
                          </button>
                          <button onClick={() => handleDelete(leader.id)} className="text-red-500 hover:text-red-700 transition-colors">
                            <Trash2 className="h-4 w-4 inline" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 overflow-y-auto">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl shadow-xl my-8">
            <h3 className="text-lg font-medium text-gray-900 mb-4">{editingId ? "Edit Member" : "Add Member"}</h3>
            <form onSubmit={handleCreateOrUpdate} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Name</label>
                  <input required type="text" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Type</label>
                  <select className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value as any})}>
                    <option value="executive">Executive Committee</option>
                    <option value="alumni">Alumni</option>
                    <option value="advisory">Advisory</option>
                    <option value="taskforce">Taskforce</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Designation</label>
                  <input required type="text" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border" value={formData.designation} onChange={e => setFormData({...formData, designation: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Batch {formData.type === 'advisory' ? "(N/A)" : ""}</label>
                  <input required={formData.type !== 'advisory'} type={formData.type === 'advisory' ? "text" : "number"} disabled={formData.type === 'advisory'} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border disabled:bg-gray-100" value={formData.type === 'advisory' ? "A" : formData.batch} onChange={e => setFormData({...formData, batch: e.target.value})} />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700">Photo URL</label>
                  <input type="url" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border" value={formData.photoUrl} onChange={e => setFormData({...formData, photoUrl: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Facebook Link</label>
                  <input type="url" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border" value={formData.facebookUrl} onChange={e => setFormData({...formData, facebookUrl: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">LinkedIn Link</label>
                  <input type="url" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border" value={formData.linkedinUrl} onChange={e => setFormData({...formData, linkedinUrl: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Email Link/Address</label>
                  <input type="email" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2 border" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                </div>
              </div>
              <div className="mt-5 sm:mt-6 flex justify-end gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" className="inline-flex justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700">
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
