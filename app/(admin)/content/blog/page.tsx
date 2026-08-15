"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { 
  collection, 
  getDocs, 
  addDoc, 
  deleteDoc, 
  updateDoc, 
  doc, 
  query, 
  writeBatch 
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { 
  Trash2, 
  Edit2, 
  Plus, 
  Search, 
  CheckSquare, 
  Square, 
  MinusSquare, 
  Eye, 
  EyeOff, 
  Globe, 
  X, 
  FileText,
  AlertCircle,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  ArrowUpToLine,
  ArrowDownToLine,
  GripVertical,
  Check
} from "lucide-react";

interface BlogPost {
  id: string;
  title: string;
  descriptionMarkdown: string;
  coverImageUrl: string;
  displayInFrontend?: boolean;
  status?: "published" | "draft";
  order?: number;
  createdAt: number;
}

export default function BlogPage() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "visible" | "hidden">("all");
  
  // Selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [isReordering, setIsReordering] = useState(false);
  const [isReorderModalOpen, setIsReorderModalOpen] = useState(false);
  const [orderActionLoading, setOrderActionLoading] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    title: "",
    descriptionMarkdown: "",
    coverImageUrl: "",
    displayInFrontend: true,
    order: 1,
  });

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const q = query(collection(db, "blogs"));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(d => {
        const docData = d.data();
        return {
          id: d.id,
          title: docData.title || "",
          descriptionMarkdown: docData.descriptionMarkdown || "",
          coverImageUrl: docData.coverImageUrl || "",
          displayInFrontend: docData.displayInFrontend !== undefined ? Boolean(docData.displayInFrontend) : true,
          status: docData.status || (docData.displayInFrontend === false ? "draft" : "published"),
          order: typeof docData.order === "number" ? docData.order : (typeof docData.position === "number" ? docData.position : undefined),
          createdAt: docData.createdAt || 0,
        } as BlogPost;
      });

      // Sort by order ascending if specified, then createdAt descending
      data.sort((a, b) => {
        if (a.order !== undefined && b.order !== undefined) {
          return a.order - b.order;
        }
        if (a.order !== undefined) return -1;
        if (b.order !== undefined) return 1;
        return (b.createdAt || 0) - (a.createdAt || 0);
      });

      setPosts(data);
      setError(null);
    } catch (err: any) {
      console.error("Error fetching blogs:", err);
      setError(err.message || "Failed to load blogs. Check database permissions.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  // Persist reordered array to Firestore
  const persistOrder = async (updatedPosts: BlogPost[]) => {
    setIsReordering(true);
    try {
      const batch = writeBatch(db);
      updatedPosts.forEach((post, index) => {
        const newOrder = index + 1;
        batch.update(doc(db, "blogs", post.id), { 
          order: newOrder,
          position: newOrder 
        });
      });
      await batch.commit();
    } catch (err: any) {
      console.error("Error saving post order to Firestore:", err);
      alert("Failed to save new order to database: " + err.message);
      fetchPosts(); // Rollback
    } finally {
      setIsReordering(false);
      setOrderActionLoading(null);
    }
  };

  // Move a post up or down by 1 position
  const handleMovePost = async (postId: string, direction: "up" | "down", e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (isReordering) return;

    const currentIndex = posts.findIndex(p => p.id === postId);
    if (currentIndex === -1) return;

    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= posts.length) return;

    setOrderActionLoading(postId);

    const reordered = [...posts];
    const [movedPost] = reordered.splice(currentIndex, 1);
    reordered.splice(targetIndex, 0, movedPost);

    const normalized = reordered.map((p, idx) => ({ ...p, order: idx + 1 }));
    setPosts(normalized);

    await persistOrder(normalized);
  };

  // Move a post directly to Top (#1)
  const handleMoveToTop = async (postId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (isReordering) return;

    const currentIndex = posts.findIndex(p => p.id === postId);
    if (currentIndex <= 0) return;

    setOrderActionLoading(postId);

    const reordered = [...posts];
    const [movedPost] = reordered.splice(currentIndex, 1);
    reordered.unshift(movedPost);

    const normalized = reordered.map((p, idx) => ({ ...p, order: idx + 1 }));
    setPosts(normalized);

    await persistOrder(normalized);
  };

  // Move a post directly to Bottom (Last #)
  const handleMoveToBottom = async (postId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (isReordering) return;

    const currentIndex = posts.findIndex(p => p.id === postId);
    if (currentIndex === -1 || currentIndex === posts.length - 1) return;

    setOrderActionLoading(postId);

    const reordered = [...posts];
    const [movedPost] = reordered.splice(currentIndex, 1);
    reordered.push(movedPost);

    const normalized = reordered.map((p, idx) => ({ ...p, order: idx + 1 }));
    setPosts(normalized);

    await persistOrder(normalized);
  };

  // Set explicit custom position rank
  const handleSetCustomPosition = async (postId: string, targetRank: number) => {
    if (isNaN(targetRank) || targetRank < 1 || targetRank > posts.length) {
      alert(`Please enter a valid rank between 1 and ${posts.length}.`);
      return;
    }

    const currentIndex = posts.findIndex(p => p.id === postId);
    if (currentIndex === -1) return;
    const targetIndex = targetRank - 1;
    if (currentIndex === targetIndex) return;

    setOrderActionLoading(postId);

    const reordered = [...posts];
    const [movedPost] = reordered.splice(currentIndex, 1);
    reordered.splice(targetIndex, 0, movedPost);

    const normalized = reordered.map((p, idx) => ({ ...p, order: idx + 1 }));
    setPosts(normalized);

    await persistOrder(normalized);
  };

  // Filtered posts
  const filteredPosts = useMemo(() => {
    return posts.filter(post => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch = !q || 
        post.title.toLowerCase().includes(q) || 
        (post.descriptionMarkdown || "").toLowerCase().includes(q);
      
      const isVisible = post.displayInFrontend !== false;
      const matchStatus = 
        statusFilter === "all" || 
        (statusFilter === "visible" && isVisible) || 
        (statusFilter === "hidden" && !isVisible);

      return matchSearch && matchStatus;
    });
  }, [posts, searchQuery, statusFilter]);

  // Selection handlers
  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const visibleIds = useMemo(() => filteredPosts.map(p => p.id), [filteredPosts]);
  const isAllVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selectedIds.includes(id));
  const isSomeVisibleSelected = visibleIds.some(id => selectedIds.includes(id)) && !isAllVisibleSelected;

  const handleSelectAllToggle = () => {
    if (isAllVisibleSelected) {
      setSelectedIds(prev => prev.filter(id => !visibleIds.includes(id)));
    } else {
      setSelectedIds(prev => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  const handleClearSelection = () => {
    setSelectedIds([]);
  };

  // Toggle single item frontend display status
  const handleToggleDisplay = async (post: BlogPost, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const newDisplayState = !post.displayInFrontend;
    const newStatus = newDisplayState ? "published" : "draft";

    // Optimistic update
    setPosts(prev => prev.map(p => p.id === post.id ? { 
      ...p, 
      displayInFrontend: newDisplayState,
      status: newStatus
    } : p));

    try {
      await updateDoc(doc(db, "blogs", post.id), {
        displayInFrontend: newDisplayState,
        status: newStatus
      });
    } catch (err: any) {
      console.error("Error toggling display status:", err);
      alert("Failed to update frontend display status: " + err.message);
      fetchPosts(); // Rollback
    }
  };

  // Bulk Display in Frontend toggle
  const handleBulkToggleDisplay = async (display: boolean) => {
    if (selectedIds.length === 0) return;
    setBulkActionLoading(true);
    const newStatus = display ? "published" : "draft";

    try {
      const batch = writeBatch(db);
      selectedIds.forEach(id => {
        batch.update(doc(db, "blogs", id), {
          displayInFrontend: display,
          status: newStatus
        });
      });
      await batch.commit();

      // Optimistic update
      setPosts(prev => prev.map(p => selectedIds.includes(p.id) ? {
        ...p,
        displayInFrontend: display,
        status: newStatus
      } : p));

      alert(`${selectedIds.length} blog post(s) set to ${display ? "Display in Frontend" : "Hidden from Frontend"}.`);
    } catch (err: any) {
      console.error("Bulk toggle display error:", err);
      alert("Failed to update posts: " + err.message);
      fetchPosts();
    } finally {
      setBulkActionLoading(false);
    }
  };

  // Bulk Delete
  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Are you sure you want to permanently delete ${selectedIds.length} blog post(s)?`)) return;

    setBulkActionLoading(true);
    try {
      const batch = writeBatch(db);
      selectedIds.forEach(id => {
        batch.delete(doc(db, "blogs", id));
      });
      await batch.commit();

      setPosts(prev => prev.filter(p => !selectedIds.includes(p.id)));
      setSelectedIds([]);
      alert(`Successfully deleted ${selectedIds.length} blog post(s).`);
    } catch (err: any) {
      console.error("Bulk delete error:", err);
      alert("Failed to delete blog posts: " + err.message);
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleCreateOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = {
        title: formData.title.trim(),
        descriptionMarkdown: formData.descriptionMarkdown.trim(),
        coverImageUrl: formData.coverImageUrl.trim(),
        displayInFrontend: formData.displayInFrontend,
        status: formData.displayInFrontend ? "published" : "draft",
      };

      if (editingId) {
        payload.order = typeof formData.order === "number" ? formData.order : 1;
        payload.position = payload.order;
        await updateDoc(doc(db, "blogs", editingId), payload);
      } else {
        const nextOrder = posts.length + 1;
        payload.order = typeof formData.order === "number" ? formData.order : nextOrder;
        payload.position = payload.order;
        await addDoc(collection(db, "blogs"), {
          ...payload,
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
      setPosts(prev => prev.filter(p => p.id !== id));
      setSelectedIds(prev => prev.filter(item => item !== id));
    } catch (err: any) {
      console.error("Error deleting blog post:", err);
      alert(err.message || "Failed to delete blog post. Check database permissions.");
    }
  };

  const openEditModal = (post: BlogPost) => {
    const postIndex = posts.findIndex(p => p.id === post.id);
    setFormData({
      title: post.title,
      descriptionMarkdown: post.descriptionMarkdown,
      coverImageUrl: post.coverImageUrl || "",
      displayInFrontend: post.displayInFrontend !== false,
      order: post.order || (postIndex !== -1 ? postIndex + 1 : 1),
    });
    setEditingId(post.id);
    setIsModalOpen(true);
  };

  const resetForm = () => {
    setFormData({ 
      title: "", 
      descriptionMarkdown: "", 
      coverImageUrl: "",
      displayInFrontend: true,
      order: posts.length + 1
    });
    setEditingId(null);
  };

  return (
    <div className="flex flex-col h-full font-inter">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl sm:text-3xl font-bold font-montserrat text-[#0F172A] tracking-tight">
              Blog Posts
            </h2>
            <span className="px-2.5 py-1 text-xs font-bold bg-blue-50 text-blue-700 rounded-full border border-blue-100">
              {posts.length} Total
            </span>
            {isReordering && (
              <span className="px-2.5 py-1 text-xs font-bold bg-amber-50 text-amber-700 rounded-full border border-amber-200 animate-pulse flex items-center gap-1">
                <ArrowUpDown className="w-3 h-3 animate-spin" /> Saving Order...
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Manage articles, reorder post positions to change frontend display sequence, and control visibility.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => setIsReorderModalOpen(true)}
            disabled={posts.length <= 1}
            className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-4 py-3 rounded-[16px] text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all hover:scale-[1.02] disabled:opacity-50"
            title="Open Order Organizer to rearrange all blog posts"
          >
            <ArrowUpDown className="h-4 w-4 text-blue-600" />
            Reorder Posts
          </button>

          <button
            onClick={() => { resetForm(); setIsModalOpen(true); }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-[16px] text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all hover:scale-[1.02]"
          >
            <Plus className="h-4 w-4" />
            Add Blog Post
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-2xl mb-4 shrink-0 flex items-center gap-2 text-xs font-medium">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Filter and Control Bar */}
      <div className="bg-white/80 backdrop-blur-md border border-slate-200/80 p-3 sm:p-4 rounded-[20px] shadow-sm mb-6 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Select All Toggle Checkbox */}
          <button
            onClick={handleSelectAllToggle}
            disabled={visibleIds.length === 0}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
              isAllVisibleSelected
                ? "bg-blue-50 border-blue-200 text-blue-700"
                : isSomeVisibleSelected
                ? "bg-blue-50/50 border-blue-200 text-blue-600"
                : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
            }`}
            title="Toggle Select All in Current View"
          >
            {isAllVisibleSelected ? (
              <CheckSquare className="w-4 h-4 text-blue-600" />
            ) : isSomeVisibleSelected ? (
              <MinusSquare className="w-4 h-4 text-blue-600" />
            ) : (
              <Square className="w-4 h-4 text-slate-400" />
            )}
            <span>Select All ({visibleIds.length})</span>
          </button>

          {/* Search Input */}
          <div className="relative flex-1 min-w-[140px]">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search blogs by title or content..."
              className="w-full bg-slate-50 border border-slate-200/80 rounded-xl pl-9 pr-4 py-2 text-xs text-[#0F172A] outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Status Filter Chips */}
        <div className="flex items-center gap-1.5 self-start md:self-auto overflow-x-auto">
          <button
            onClick={() => setStatusFilter("all")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              statusFilter === "all"
                ? "bg-slate-900 text-white shadow-sm"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            All ({posts.length})
          </button>
          <button
            onClick={() => setStatusFilter("visible")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
              statusFilter === "visible"
                ? "bg-emerald-600 text-white shadow-sm"
                : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
            }`}
          >
            <Eye className="w-3 h-3" />
            Live ({posts.filter(p => p.displayInFrontend !== false).length})
          </button>
          <button
            onClick={() => setStatusFilter("hidden")}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
              statusFilter === "hidden"
                ? "bg-amber-600 text-white shadow-sm"
                : "bg-amber-50 text-amber-700 hover:bg-amber-100"
            }`}
          >
            <EyeOff className="w-3 h-3" />
            Hidden ({posts.filter(p => p.displayInFrontend === false).length})
          </button>
        </div>
      </div>

      {/* Bulk Action Bar (Floating when items are selected) */}
      {selectedIds.length > 0 && (
        <div className="bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-xl border border-slate-800 flex flex-wrap items-center justify-between gap-3 mb-6 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2">
            <span className="bg-blue-600 text-white text-xs font-bold px-2.5 py-0.5 rounded-full">
              {selectedIds.length}
            </span>
            <span className="text-xs font-bold text-slate-200">
              Selected Item{selectedIds.length > 1 ? "s" : ""}
            </span>
          </div>

          <div className="flex items-center flex-wrap gap-2">
            {/* Bulk Display in Frontend */}
            <button
              onClick={() => handleBulkToggleDisplay(true)}
              disabled={bulkActionLoading}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <Eye className="w-3.5 h-3.5" />
              Display in Frontend
            </button>

            {/* Bulk Hide from Frontend */}
            <button
              onClick={() => handleBulkToggleDisplay(false)}
              disabled={bulkActionLoading}
              className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <EyeOff className="w-3.5 h-3.5" />
              Hide from Frontend
            </button>

            {/* Bulk Delete */}
            <button
              onClick={handleBulkDelete}
              disabled={bulkActionLoading}
              className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </button>

            {/* Cancel / Clear Selection */}
            <button
              onClick={handleClearSelection}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              title="Clear selection"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Grid of Blog Posts */}
      <div className="flex-1 overflow-y-auto pb-12">
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-sm font-medium">Loading blog posts...</div>
        ) : filteredPosts.length === 0 ? (
          <div className="bg-white/60 backdrop-blur-md rounded-2xl border border-dashed border-slate-300 p-12 text-center">
            <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h4 className="text-sm font-bold text-slate-700">No blog posts found</h4>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              {searchQuery || statusFilter !== "all" 
                ? "Try adjusting your search query or filter." 
                : "Get started by publishing your first blog post using the button above."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPosts.map((post) => {
              const isSelected = selectedIds.includes(post.id);
              const isLive = post.displayInFrontend !== false;
              const globalIndex = posts.findIndex(p => p.id === post.id);
              const displayOrder = post.order !== undefined ? post.order : (globalIndex + 1);
              const isFirst = globalIndex === 0;
              const isLast = globalIndex === posts.length - 1;
              const isMoving = orderActionLoading === post.id;

              return (
                <div
                  key={post.id}
                  className={`bg-white/80 backdrop-blur-xl rounded-[24px] border transition-all duration-200 overflow-hidden flex flex-col group ${
                    isSelected 
                      ? "border-blue-500 ring-2 ring-blue-500/20 shadow-md bg-blue-50/20" 
                      : "border-slate-200/80 hover:border-slate-300 shadow-sm hover:shadow-md"
                  }`}
                >
                  {/* Top Cover Image Area */}
                  <div className="relative h-48 w-full bg-slate-100 overflow-hidden">
                    {post.coverImageUrl ? (
                      <img 
                        src={post.coverImageUrl} 
                        alt={post.title} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 gap-1 bg-slate-100">
                        <FileText className="w-8 h-8 text-slate-300" />
                        <span className="text-[10px] font-bold tracking-wider uppercase">No Cover Image</span>
                      </div>
                    )}

                    {/* Top Left: Checkbox and Position Badge */}
                    <div className="absolute top-3 left-3 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleToggleSelect(post.id)}
                        className={`w-8 h-8 rounded-xl flex items-center justify-center shadow-md backdrop-blur-md transition-all ${
                          isSelected
                            ? "bg-blue-600 text-white"
                            : "bg-white/90 text-slate-400 hover:text-slate-700 hover:bg-white"
                        }`}
                        title="Select post"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>

                      <span 
                        className="px-2.5 py-1 rounded-xl text-xs font-black tracking-wide bg-slate-900/85 text-white backdrop-blur-md shadow-md flex items-center gap-1 border border-white/20"
                        title={`Display Position #${displayOrder} in frontend`}
                      >
                        #{displayOrder}
                      </span>
                    </div>

                    {/* Top Right: Move Controls & Status Badge */}
                    <div className="absolute top-3 right-3 flex flex-col items-end gap-1.5">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider backdrop-blur-md shadow-sm flex items-center gap-1 ${
                        isLive
                          ? "bg-emerald-500/90 text-white"
                          : "bg-amber-500/90 text-white"
                      }`}>
                        {isLive ? <Globe className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                        {isLive ? "Live" : "Hidden"}
                      </span>

                      {/* Quick Move Up/Down Floating Pill */}
                      <div className="flex items-center bg-white/90 backdrop-blur-md rounded-xl p-0.5 shadow-md border border-slate-200/80">
                        <button
                          type="button"
                          disabled={isFirst || isReordering}
                          onClick={(e) => handleMovePost(post.id, "up", e)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-600 hover:bg-blue-50 hover:text-blue-600 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                          title="Move post UP (changes frontend order)"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={isLast || isReordering}
                          onClick={(e) => handleMovePost(post.id, "down", e)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-600 hover:bg-blue-50 hover:text-blue-600 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                          title="Move post DOWN (changes frontend order)"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Body Content */}
                  <div className="p-5 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                          Position Order #{displayOrder}
                        </span>
                        {isMoving && (
                          <span className="text-[10px] font-bold text-amber-600 animate-pulse">
                            Moving...
                          </span>
                        )}
                      </div>
                      <h3 className="font-bold text-base text-[#0F172A] line-clamp-1 group-hover:text-blue-600 transition-colors">
                        {post.title}
                      </h3>
                      <p className="text-xs text-slate-500 mt-2 line-clamp-2 leading-relaxed">
                        {post.descriptionMarkdown || "No description provided."}
                      </p>
                    </div>

                    {/* Position / Move Controls & Display Toggle */}
                    <div className="mt-5 pt-4 border-t border-slate-100 flex flex-col gap-3">
                      {/* Position Ranking Toolbar */}
                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/60 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                          <span className="text-xs font-bold text-slate-600">Order:</span>
                          <select
                            value={displayOrder}
                            disabled={isReordering}
                            onChange={(e) => handleSetCustomPosition(post.id, Number(e.target.value))}
                            className="bg-white border border-slate-200 text-xs font-bold text-slate-800 rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-blue-500"
                            title="Change position order"
                          >
                            {posts.map((_, idx) => (
                              <option key={idx + 1} value={idx + 1}>
                                #{idx + 1} {idx === 0 ? "(Top)" : idx === posts.length - 1 ? "(Bottom)" : ""}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={isFirst || isReordering}
                            onClick={(e) => handleMoveToTop(post.id, e)}
                            className="p-1 text-slate-500 hover:text-blue-600 hover:bg-white rounded-md transition-colors disabled:opacity-30 text-[10px] font-bold"
                            title="Move directly to Top (#1)"
                          >
                            <ArrowUpToLine className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={isFirst || isReordering}
                            onClick={(e) => handleMovePost(post.id, "up", e)}
                            className="p-1 text-slate-500 hover:text-blue-600 hover:bg-white rounded-md transition-colors disabled:opacity-30"
                            title="Move Up 1 position"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={isLast || isReordering}
                            onClick={(e) => handleMovePost(post.id, "down", e)}
                            className="p-1 text-slate-500 hover:text-blue-600 hover:bg-white rounded-md transition-colors disabled:opacity-30"
                            title="Move Down 1 position"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={isLast || isReordering}
                            onClick={(e) => handleMoveToBottom(post.id, e)}
                            className="p-1 text-slate-500 hover:text-blue-600 hover:bg-white rounded-md transition-colors disabled:opacity-30 text-[10px] font-bold"
                            title="Move directly to Bottom"
                          >
                            <ArrowDownToLine className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Display in Frontend Move/Toggle Switch */}
                      <div className="flex items-center justify-between bg-slate-50/80 p-2.5 rounded-xl border border-slate-200/60">
                        <div className="flex items-center gap-2">
                          <Globe className={`w-4 h-4 ${isLive ? "text-emerald-600" : "text-slate-400"}`} />
                          <span className="text-xs font-bold text-slate-700">Display in Frontend</span>
                        </div>

                        {/* Interactive Toggle Switch */}
                        <button
                          type="button"
                          role="switch"
                          aria-checked={isLive}
                          onClick={(e) => handleToggleDisplay(post, e)}
                          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
                            isLive ? "bg-emerald-500" : "bg-slate-300"
                          }`}
                          title={isLive ? "Currently visible in frontend (click to hide)" : "Currently hidden from frontend (click to display)"}
                        >
                          <span
                            aria-hidden="true"
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                              isLive ? "translate-x-5" : "translate-x-0"
                            }`}
                          />
                        </button>
                      </div>

                      {/* Card Action Buttons */}
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditModal(post)}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold text-blue-600 hover:bg-blue-50 flex items-center gap-1 transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" /> Edit
                        </button>
                        <button
                          onClick={() => handleDelete(post.id)}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold text-red-500 hover:bg-red-50 flex items-center gap-1 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Reorder Posts Organizer Modal */}
      {isReorderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[28px] p-6 sm:p-8 w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-xl font-bold font-montserrat text-[#0F172A] flex items-center gap-2">
                  <ArrowUpDown className="w-5 h-5 text-blue-600" />
                  Reorder Blog Posts
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Arrange posts in your preferred sequence. Changes sync immediately with Firestore and frontend views.
                </p>
              </div>
              <button
                onClick={() => setIsReorderModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* List of reorderable posts */}
            <div className="flex-1 overflow-y-auto py-4 space-y-2.5 pr-1">
              {posts.map((post, index) => {
                const isFirst = index === 0;
                const isLast = index === posts.length - 1;

                return (
                  <div
                    key={post.id}
                    className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-200/80 hover:bg-white hover:shadow-sm transition-all"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-slate-900 text-white text-xs font-black flex items-center justify-center shrink-0">
                        #{index + 1}
                      </div>

                      <div className="w-10 h-10 rounded-lg bg-slate-200 overflow-hidden shrink-0">
                        {post.coverImageUrl ? (
                          <img src={post.coverImageUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-400">
                            <FileText className="w-5 h-5" />
                          </div>
                        )}
                      </div>

                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-slate-900 truncate">
                          {post.title}
                        </h4>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            post.displayInFrontend !== false ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                          }`}>
                            {post.displayInFrontend !== false ? "Live" : "Hidden"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        disabled={isFirst || isReordering}
                        onClick={() => handleMoveToTop(post.id)}
                        className="p-2 rounded-xl text-slate-600 hover:bg-blue-50 hover:text-blue-600 disabled:opacity-20 text-xs font-bold"
                        title="Move to Top"
                      >
                        <ArrowUpToLine className="w-4 h-4" />
                      </button>
                      <button
                        disabled={isFirst || isReordering}
                        onClick={() => handleMovePost(post.id, "up")}
                        className="p-2 rounded-xl text-slate-600 hover:bg-blue-50 hover:text-blue-600 disabled:opacity-20 text-xs font-bold"
                        title="Move Up"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <button
                        disabled={isLast || isReordering}
                        onClick={() => handleMovePost(post.id, "down")}
                        className="p-2 rounded-xl text-slate-600 hover:bg-blue-50 hover:text-blue-600 disabled:opacity-20 text-xs font-bold"
                        title="Move Down"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>
                      <button
                        disabled={isLast || isReordering}
                        onClick={() => handleMoveToBottom(post.id)}
                        className="p-2 rounded-xl text-slate-600 hover:bg-blue-50 hover:text-blue-600 disabled:opacity-20 text-xs font-bold"
                        title="Move to Bottom"
                      >
                        <ArrowDownToLine className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                {isReordering ? "Saving updates to Firestore..." : "All positions are synchronized with database."}
              </span>
              <button
                type="button"
                onClick={() => setIsReorderModalOpen(false)}
                className="px-6 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Blog Post Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-[28px] p-6 sm:p-8 w-full max-w-3xl shadow-2xl my-8 border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
              <h3 className="text-xl font-bold font-montserrat text-[#0F172A]">
                {editingId ? "Edit Blog Post" : "Add New Blog Post"}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateOrUpdate} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                  Post Title *
                </label>
                <input
                  required
                  type="text"
                  placeholder="e.g. Advancements in Sustainable Concrete Mixes"
                  className="w-full rounded-[16px] border border-slate-200 bg-slate-50 p-3.5 text-sm text-[#0F172A] outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  value={formData.title}
                  onChange={e => setFormData({...formData, title: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                  Cover Image URL
                </label>
                <input
                  type="url"
                  placeholder="https://example.com/cover.jpg"
                  className="w-full rounded-[16px] border border-slate-200 bg-slate-50 p-3.5 text-sm text-[#0F172A] outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  value={formData.coverImageUrl}
                  onChange={e => setFormData({...formData, coverImageUrl: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                  Description / Content (Markdown Supported) *
                </label>
                <textarea
                  required
                  rows={10}
                  className="w-full rounded-[16px] border border-slate-200 bg-slate-50 p-3.5 text-sm font-mono text-[#0F172A] outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all leading-relaxed"
                  value={formData.descriptionMarkdown}
                  onChange={e => setFormData({...formData, descriptionMarkdown: e.target.value})}
                  placeholder="# Article Title&#10;&#10;Write content in markdown format..."
                />
              </div>

              {/* Order Position in Form */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 rounded-[20px] border border-slate-200">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Display Order / Position
                  </label>
                  <p className="text-[11px] text-slate-500 mb-2">
                    Set numerical rank (#1 shows at the very top of the frontend).
                  </p>
                  <input
                    type="number"
                    min={1}
                    value={formData.order}
                    onChange={e => setFormData({ ...formData, order: Math.max(1, parseInt(e.target.value) || 1) })}
                    className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-sm font-bold text-[#0F172A] outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Display in Frontend Toggle in Form */}
                <div className="bg-slate-50 p-4 rounded-[20px] border border-slate-200 flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Globe className="w-4 h-4 text-blue-600" />
                      Display in Frontend
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Toggle public visibility in the live website.
                    </p>
                  </div>

                  <button
                    type="button"
                    role="switch"
                    aria-checked={formData.displayInFrontend}
                    onClick={() => setFormData({ ...formData, displayInFrontend: !formData.displayInFrontend })}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
                      formData.displayInFrontend ? "bg-emerald-500" : "bg-slate-300"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                        formData.displayInFrontend ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-6 py-3 rounded-[16px] border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-3 rounded-[16px] bg-blue-600 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition-all hover:scale-[1.02]"
                >
                  {editingId ? "Save Changes" : "Create Blog Post"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
