"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  createKnowledgeBase,
  deleteKnowledgeBase,
  listKnowledgeBases,
  updateKnowledgeBase,
} from "@/services/knowledgeBaseService";
import { KnowledgeBase, KnowledgeBasePayload } from "@/types/knowledgeBase";
import { Plus, Search, Book, Database, Library, Edit, Trash2, ArrowRight, Loader2 } from "lucide-react";

const defaultPayload: KnowledgeBasePayload = {
  name: "",
  description: "",
  language: "en",
  embedding_model: "gpt-4.1",
  chunk_size: 512,
  chunk_overlap: 128,
};

export default function KnowledgeBasesPage() {
  const router = useRouter();
  const { toast } = useToast();

  const user =
    typeof window !== "undefined"
      ? JSON.parse(localStorage.getItem("user") || "{}")
      : {};
  const clientId = user?.client_id || "";

  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [editingBase, setEditingBase] = useState<KnowledgeBase | null>(null);
  const [formValues, setFormValues] = useState<KnowledgeBasePayload>(defaultPayload);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedBase, setSelectedBase] = useState<KnowledgeBase | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [savingMessage, setSavingMessage] = useState("");

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(searchTerm), 400);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  useEffect(() => {
    if (!clientId) return;
    loadKnowledgeBases();
  }, [clientId, debouncedSearch]);

  const loadKnowledgeBases = async () => {
    setIsLoading(true);
    try {
      const response = await listKnowledgeBases(clientId, {
        search: debouncedSearch,
      });
      setKnowledgeBases(response.data);
    } catch (error) {
      console.error("Error loading knowledge bases", error);
      toast({
        title: "Failed to load knowledge bases",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const openCreateDialog = () => {
    setEditingBase(null);
    setFormValues(defaultPayload);
    setIsDialogOpen(true);
  };

  const openEditDialog = (knowledgeBase: KnowledgeBase) => {
    setEditingBase(knowledgeBase);
    setFormValues({
      name: knowledgeBase.name,
      description: knowledgeBase.description || "",
      language: knowledgeBase.language || "en",
      embedding_model: knowledgeBase.embedding_model || "gpt-4.1",
      chunk_size: knowledgeBase.chunk_size,
      chunk_overlap: knowledgeBase.chunk_overlap,
    });
    setIsDialogOpen(true);
  };

  const normalizeErrorMessage = (error: any) => {
    const detail = error?.response?.data?.detail;
    if (!detail) return "Unable to save knowledge base";
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      return detail
        .map((item) => item?.msg || (typeof item === "string" ? item : JSON.stringify(item)))
        .join(" • ");
    }
    if (typeof detail === "object") {
      return detail.message || detail.msg || JSON.stringify(detail);
    }
    return "Unable to save knowledge base";
  };

  const handleSave = async () => {
    if (!clientId) return;
    const trimmedName = formValues.name.trim();
    const chunkSize = Number(formValues.chunk_size);
    const chunkOverlap = Number(formValues.chunk_overlap);

    if (!trimmedName) {
      toast({
        title: "Name is required",
        variant: "destructive",
      });
      return;
    }

    if (!Number.isFinite(chunkSize) || chunkSize < 64 || chunkSize > 4096) {
      toast({
        title: "Chunk size must be between 64 and 4096",
        variant: "destructive",
      });
      return;
    }

    if (!Number.isFinite(chunkOverlap) || chunkOverlap < 0 || chunkOverlap > 2048) {
      toast({
        title: "Chunk overlap must be between 0 and 2048",
        variant: "destructive",
      });
      return;
    }

    const payload: KnowledgeBasePayload = {
      name: trimmedName,
      description: formValues.description?.trim() || undefined,
      language: formValues.language?.trim() || undefined,
      embedding_model: formValues.embedding_model?.trim() || undefined,
      chunk_size: chunkSize,
      chunk_overlap: chunkOverlap,
    };

    setIsSaving(true);
    setSavingMessage(editingBase ? "Updating knowledge base..." : "Creating knowledge base...");

    try {
      if (editingBase) {
        await updateKnowledgeBase(clientId, editingBase.id, payload);
        toast({ title: "Knowledge base updated" });
      } else {
        await createKnowledgeBase(clientId, payload);
        toast({ title: "Knowledge base created" });
      }
      setSavingMessage("Refreshing list...");
      setIsDialogOpen(false);
      setEditingBase(null);
      setFormValues(defaultPayload);
      loadKnowledgeBases();
    } catch (error: any) {
      console.error("Error saving knowledge base", error);
      toast({
        title: "Unable to save knowledge base",
        description: normalizeErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
      setSavingMessage("");
    }
  };

  const handleDelete = async () => {
    if (!clientId || !selectedBase) return;
    try {
      await deleteKnowledgeBase(clientId, selectedBase.id);
      toast({ title: "Knowledge base removed" });
      setIsDeleteOpen(false);
      setSelectedBase(null);
      loadKnowledgeBases();
    } catch (error) {
      console.error("Error deleting knowledge base", error);
      toast({
        title: "Unable to delete knowledge base",
        variant: "destructive",
      });
    }
  };

  const filteredBases = useMemo(() => {
    if (!debouncedSearch) return knowledgeBases;
    return knowledgeBases.filter((kb) =>
      kb.name.toLowerCase().includes(debouncedSearch.toLowerCase())
    );
  }, [knowledgeBases, debouncedSearch]);

  return (
    <div className="min-h-screen bg-[#111] text-white p-6 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Library className="h-6 w-6 text-emerald-400" />
            Knowledge Bases
          </h1>
          <p className="text-neutral-400 text-sm">
            Organize documents, links, and snippets that your agents can consult during conversations.
          </p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="h-4 w-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              placeholder="Search a knowledge base"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="pl-10 bg-neutral-900 border-neutral-800 text-white w-60"
            />
          </div>
          <Button
            onClick={openCreateDialog}
            className="bg-emerald-500 hover:bg-emerald-600 text-white"
          >
            <Plus className="h-4 w-4 mr-2" /> New Base
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Card
              key={index}
              className="bg-neutral-900/80 border border-neutral-800 shadow-lg"
            >
              <CardHeader>
                <Skeleton className="h-6 w-1/2 bg-neutral-800" />
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-4 w-full bg-neutral-800" />
                <Skeleton className="h-4 w-3/4 bg-neutral-800" />
                <Skeleton className="h-4 w-2/3 bg-neutral-800" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredBases.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-800 p-10 text-center bg-neutral-900/50">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
            <Book className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No knowledge bases found</h3>
          <p className="text-neutral-500 max-w-md mx-auto">
            Create your first knowledge base to centralize documents and references that agents can consult.
          </p>
          <Button
            className="mt-4 bg-emerald-500 text-white hover:bg-emerald-600"
            onClick={openCreateDialog}
          >
            Create knowledge base
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredBases.map((knowledgeBase) => (
            <Card
              key={knowledgeBase.id}
              className="bg-neutral-900/80 border border-neutral-800 shadow-lg hover:border-emerald-500/40 transition-colors flex flex-col"
            >
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Database className="h-4 w-4 text-emerald-400" />
                  <span>{knowledgeBase.name}</span>
                </CardTitle>
                <p className="text-sm text-neutral-400 line-clamp-2">
                  {knowledgeBase.description || "No description"}
                </p>
              </CardHeader>
              <CardContent className="space-y-4 flex-1">
                <div className="flex flex-wrap gap-2 text-xs text-neutral-400">
                  <Badge variant="outline" className="border-neutral-700 text-neutral-300">
                    Lang: {knowledgeBase.language || "auto"}
                  </Badge>
                  <Badge variant="outline" className="border-neutral-700 text-neutral-300">
                    Chunk: {knowledgeBase.chunk_size}
                  </Badge>
                  <Badge variant="outline" className="border-neutral-700 text-neutral-300">
                    Overlap: {knowledgeBase.chunk_overlap}
                  </Badge>
                </div>

                <div className="text-sm text-neutral-400">
                  <p>Embedding model</p>
                  <p className="text-neutral-200">
                    {knowledgeBase.embedding_model || "inherit from agent"}
                  </p>
                </div>

                <div className="flex gap-2 mt-auto">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="bg-neutral-800 border border-neutral-700 text-white hover:bg-neutral-700"
                    onClick={() => router.push(`/knowledge-bases/${knowledgeBase.id}`)}
                  >
                    <ArrowRight className="h-3.5 w-3.5 mr-1" /> Manage
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-neutral-400 hover:text-white"
                    onClick={() => openEditDialog(knowledgeBase)}
                  >
                    <Edit className="h-3.5 w-3.5 mr-1" /> Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-400 hover:text-red-200"
                    onClick={() => {
                      setSelectedBase(knowledgeBase);
                      setIsDeleteOpen(true);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-neutral-900 border-neutral-800 text-white max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editingBase ? "Edit knowledge base" : "New knowledge base"}
            </DialogTitle>
            <DialogDescription className="text-neutral-400">
              Give your knowledge base a clear name and description.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm text-neutral-300">Name</label>
                <Input
                  value={formValues.name}
                  disabled={isSaving}
                  onChange={(event) =>
                    setFormValues((prev) => ({ ...prev, name: event.target.value }))
                  }
                  className="bg-neutral-900 border-neutral-800"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm text-neutral-300">Language</label>
                <Input
                  value={formValues.language}
                  disabled={isSaving}
                  onChange={(event) =>
                    setFormValues((prev) => ({ ...prev, language: event.target.value }))
                  }
                  placeholder="en"
                  className="bg-neutral-900 border-neutral-800"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm text-neutral-300">Description</label>
              <Textarea
                value={formValues.description}
                disabled={isSaving}
                onChange={(event) =>
                  setFormValues((prev) => ({ ...prev, description: event.target.value }))
                }
                className="bg-neutral-900 border-neutral-800"
              />
            </div>
          </div>

          <DialogFooter className="pt-4 flex flex-col gap-3">
            {isSaving && (
              <div className="flex items-center gap-3 text-sm text-neutral-300 bg-neutral-800/60 border border-neutral-700 rounded-md px-3 py-2">
                <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
                <span>{savingMessage || "Processing..."}</span>
              </div>
            )}
            <div className="flex gap-2 justify-end">
            <Button
              variant="ghost"
              className="text-neutral-400 hover:text-white"
              onClick={() => setIsDialogOpen(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              className="bg-emerald-500 hover:bg-emerald-600"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {editingBase ? "Saving..." : "Creating..."}
                </span>
              ) : (
                editingBase ? "Save changes" : "Create"
              )}
            </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent className="bg-neutral-900 border-neutral-800 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete knowledge base?</AlertDialogTitle>
            <AlertDialogDescription className="text-neutral-400">
              This action will archive the base. Associated documents will no longer be available to agents.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-neutral-800 border-neutral-700 text-white hover:bg-neutral-700">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-500 hover:bg-red-600"
              onClick={handleDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
