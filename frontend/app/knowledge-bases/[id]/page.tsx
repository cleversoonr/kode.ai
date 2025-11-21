"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  createTextDocument,
  createUrlDocument,
  getKnowledgeBase,
  listKnowledgeDocuments,
  reprocessKnowledgeDocument,
  updateKnowledgeBase,
  uploadKnowledgeDocument,
} from "@/services/knowledgeBaseService";
import { KnowledgeBase, KnowledgeDocument } from "@/types/knowledgeBase";
import {
  ArrowLeft,
  CloudUpload,
  FileText,
  Link2,
  Loader2,
  RefreshCw,
  Settings,
  Database,
  File as FileIcon,
} from "lucide-react";

export default function KnowledgeBaseDetailPage() {
  const params = useParams<{ id: string }>();
  const baseId = params?.id as string;
  const router = useRouter();
  const { toast } = useToast();

  const user =
    typeof window !== "undefined"
      ? JSON.parse(localStorage.getItem("user") || "{}")
      : {};
  const clientId = user?.client_id || "";

  const [knowledgeBase, setKnowledgeBase] = useState<KnowledgeBase | null>(null);
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("upload");
  const [uploading, setUploading] = useState(false);
  const [textPayload, setTextPayload] = useState({ title: "", content: "" });
  const [urlPayload, setUrlPayload] = useState({ url: "", description: "" });
  const [file, setFile] = useState<File | null>(null);
  const [fileDescription, setFileDescription] = useState("");
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [formValues, setFormValues] = useState({
    name: "",
    description: "",
    chunk_size: 512,
    chunk_overlap: 128,
    language: "",
    embedding_model: "",
  });

  useEffect(() => {
    if (!clientId || !baseId) return;
    void loadData();
  }, [clientId, baseId]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [baseResponse, docsResponse] = await Promise.all([
        getKnowledgeBase(clientId, baseId),
        listKnowledgeDocuments(clientId, baseId),
      ]);
      setKnowledgeBase(baseResponse.data);
      setDocuments(docsResponse.data);
      setFormValues({
        name: baseResponse.data.name,
        description: baseResponse.data.description || "",
        chunk_size: baseResponse.data.chunk_size,
        chunk_overlap: baseResponse.data.chunk_overlap,
        language: baseResponse.data.language || "",
        embedding_model: baseResponse.data.embedding_model || "",
      });
    } catch (error) {
      console.error("Error loading knowledge base", error);
      toast({ title: "Unable to load knowledge base", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!file) {
      toast({ title: "Select a file to upload", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      await uploadKnowledgeDocument(clientId, baseId, file, fileDescription);
      toast({ title: "Document queued for ingestion" });
      setFile(null);
      setFileDescription("");
      void loadData();
    } catch (error: any) {
      console.error("File upload error", error);
      toast({
        title: error?.response?.data?.detail || "Unable to upload document",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleTextSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!textPayload.content.trim()) {
      toast({ title: "Provide the content for the snippet", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      await createTextDocument(clientId, baseId, textPayload);
      toast({ title: "Snippet queued" });
      setTextPayload({ title: "", content: "" });
      void loadData();
    } catch (error) {
      console.error("Text ingestion error", error);
      toast({ title: "Unable to create snippet", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleUrlSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!urlPayload.url) {
      toast({ title: "Provide a valid URL", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      await createUrlDocument(clientId, baseId, urlPayload);
      toast({ title: "URL queued" });
      setUrlPayload({ url: "", description: "" });
      void loadData();
    } catch (error) {
      console.error("URL ingestion error", error);
      toast({ title: "Unable to ingest URL", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleReprocess = async (documentId: string) => {
    try {
      await reprocessKnowledgeDocument(clientId, documentId);
      toast({ title: "Reprocessing scheduled" });
      void loadData();
    } catch (error) {
      console.error("Reprocess error", error);
      toast({ title: "Unable to reprocess document", variant: "destructive" });
    }
  };

  const handleEditBase = async () => {
    if (!knowledgeBase) return;
    try {
      await updateKnowledgeBase(clientId, knowledgeBase.id, formValues);
      toast({ title: "Knowledge base updated" });
      setIsEditDialogOpen(false);
      void loadData();
    } catch (error) {
      console.error("Update error", error);
      toast({ title: "Unable to update base", variant: "destructive" });
    }
  };

  const statusBadge = (status: KnowledgeDocument["status"]) => {
    const variants = {
      pending: "text-yellow-300 bg-yellow-400/10 border-yellow-400/30",
      processing: "text-blue-300 bg-blue-400/10 border-blue-400/30",
      ready: "text-emerald-300 bg-emerald-400/10 border-emerald-400/30",
      error: "text-red-300 bg-red-400/10 border-red-400/30",
    } as const;

    return (
      <Badge variant="outline" className={variants[status] || variants.pending}>
        {status}
      </Badge>
    );
  };

  const lastUpdated = useMemo(() => {
    if (!knowledgeBase?.updated_at) return "Never";
    return new Date(knowledgeBase.updated_at).toLocaleString();
  }, [knowledgeBase]);

  if (isLoading || !knowledgeBase) {
    return (
      <div className="min-h-screen bg-[#111] text-white flex flex-col gap-4 p-8">
        <Button
          variant="ghost"
          className="w-fit text-neutral-400 hover:text-white"
          onClick={() => router.back()}
        >
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <div className="flex items-center gap-2 text-neutral-400">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading knowledge base
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#111] text-white p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Button
          variant="ghost"
          className="text-neutral-400 hover:text-white"
          onClick={() => router.back()}
        >
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-neutral-700">
            Updated {lastUpdated}
          </Badge>
          <Button
            variant="outline"
            className="border-neutral-700 text-white"
            onClick={() => setIsEditDialogOpen(true)}
          >
            <Settings className="h-4 w-4 mr-2" /> Edit base
          </Button>
        </div>
      </div>

      <Card className="bg-neutral-900/90 border border-neutral-800">
        <CardHeader>
          <CardTitle className="text-2xl font-semibold flex items-center gap-2">
            <Database className="h-5 w-5 text-emerald-400" />
            {knowledgeBase.name}
          </CardTitle>
          <p className="text-neutral-400 text-sm max-w-3xl">
            {knowledgeBase.description || "No description available"}
          </p>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <div>
            <p className="text-xs text-neutral-500">Language</p>
            <p className="text-neutral-200">{knowledgeBase.language || "auto"}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-500">Embedding model</p>
            <p className="text-neutral-200">
              {knowledgeBase.embedding_model || "inherit agent configuration"}
            </p>
          </div>
          <div>
            <p className="text-xs text-neutral-500">Chunk / Overlap</p>
            <p className="text-neutral-200">
              {knowledgeBase.chunk_size} tokens / {knowledgeBase.chunk_overlap}
            </p>
          </div>
          <div>
            <p className="text-xs text-neutral-500">Status</p>
            <Badge
              variant="outline"
              className={knowledgeBase.is_active ? "text-emerald-300" : "text-neutral-400"}
            >
              {knowledgeBase.is_active ? "Active" : "Archived"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[2fr,3fr]">
        <Card className="bg-neutral-900/80 border border-neutral-800">
          <CardHeader>
            <CardTitle>Ingestion</CardTitle>
            <p className="text-neutral-500 text-sm">
              Send content to this knowledge base using files, text snippets, or URLs.
            </p>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="bg-neutral-800/60 border border-neutral-700">
                <TabsTrigger value="upload" className="data-[state=active]:bg-neutral-900">
                  <CloudUpload className="h-4 w-4 mr-2" /> File
                </TabsTrigger>
                <TabsTrigger value="text" className="data-[state=active]:bg-neutral-900">
                  <FileText className="h-4 w-4 mr-2" /> Snippet
                </TabsTrigger>
                <TabsTrigger value="url" className="data-[state=active]:bg-neutral-900">
                  <Link2 className="h-4 w-4 mr-2" /> URL
                </TabsTrigger>
              </TabsList>

              <TabsContent value="upload" className="pt-4">
                <form className="space-y-4" onSubmit={handleFileUpload}>
                  <div className="space-y-1 text-sm">
                    <label className="text-neutral-300">File</label>
                    <Input
                      type="file"
                      accept=".pdf,.docx,.txt,.md"
                      className="bg-neutral-900 border-neutral-800"
                      onChange={(event) => setFile(event.target.files?.[0] || null)}
                    />
                  </div>
                  <div className="space-y-1 text-sm">
                    <label className="text-neutral-300">Description (optional)</label>
                    <Input
                      value={fileDescription}
                      onChange={(event) => setFileDescription(event.target.value)}
                      className="bg-neutral-900 border-neutral-800"
                    />
                  </div>
                  <Button
                    type="submit"
                    className="bg-emerald-500 hover:bg-emerald-600"
                    disabled={uploading}
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Uploading
                      </>
                    ) : (
                      "Upload"
                    )}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="text" className="pt-4">
                <form className="space-y-4" onSubmit={handleTextSubmit}>
                  <div className="space-y-1 text-sm">
                    <label className="text-neutral-300">Title</label>
                    <Input
                      value={textPayload.title}
                      onChange={(event) =>
                        setTextPayload((prev) => ({ ...prev, title: event.target.value }))
                      }
                      className="bg-neutral-900 border-neutral-800"
                    />
                  </div>
                  <div className="space-y-1 text-sm">
                    <label className="text-neutral-300">Content</label>
                    <Textarea
                      value={textPayload.content}
                      onChange={(event) =>
                        setTextPayload((prev) => ({ ...prev, content: event.target.value }))
                      }
                      rows={6}
                      className="bg-neutral-900 border-neutral-800"
                    />
                  </div>
                  <Button
                    type="submit"
                    className="bg-emerald-500 hover:bg-emerald-600"
                    disabled={uploading}
                  >
                    Submit
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="url" className="pt-4">
                <form className="space-y-4" onSubmit={handleUrlSubmit}>
                  <div className="space-y-1 text-sm">
                    <label className="text-neutral-300">URL</label>
                    <Input
                      type="url"
                      value={urlPayload.url}
                      onChange={(event) =>
                        setUrlPayload((prev) => ({ ...prev, url: event.target.value }))
                      }
                      placeholder="https://..."
                      className="bg-neutral-900 border-neutral-800"
                    />
                  </div>
                  <div className="space-y-1 text-sm">
                    <label className="text-neutral-300">Description (optional)</label>
                    <Textarea
                      value={urlPayload.description}
                      onChange={(event) =>
                        setUrlPayload((prev) => ({ ...prev, description: event.target.value }))
                      }
                      rows={4}
                      className="bg-neutral-900 border-neutral-800"
                    />
                  </div>
                  <Button
                    type="submit"
                    className="bg-emerald-500 hover:bg-emerald-600"
                    disabled={uploading}
                  >
                    Submit
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card className="bg-neutral-900/80 border border-neutral-800">
          <CardHeader>
            <CardTitle>Documents</CardTitle>
            <p className="text-neutral-500 text-sm">
              Uploaded files, snippets and URLs ingested into this knowledge base.
            </p>
          </CardHeader>
          <CardContent>
            {documents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed border-neutral-800 rounded-lg">
                <div className="p-3 rounded-full bg-neutral-800/70 mb-3">
                  <FileIcon className="h-5 w-5 text-neutral-400" />
                </div>
                <p className="text-neutral-400">No documents yet.</p>
                <p className="text-neutral-500 text-sm">Upload a file, snippet or URL to get started.</p>
              </div>
            ) : (
              <ScrollArea className="max-h-[420px]">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Updated</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {documents.map((document) => (
                      <TableRow key={document.id} className="hover:bg-neutral-900/60">
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium text-white">
                              {document.original_filename || document.source_url || document.source_type}
                            </span>
                            {document.error_message && (
                              <span className="text-xs text-red-400">{document.error_message}</span>
                            )}
                            {document.content_preview && (
                              <span className="text-xs text-neutral-500 line-clamp-1">
                                {document.content_preview}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="capitalize text-neutral-400">
                          {document.source_type}
                        </TableCell>
                        <TableCell>{statusBadge(document.status)}</TableCell>
                        <TableCell className="text-neutral-400">
                          {document.updated_at
                            ? new Date(document.updated_at).toLocaleString()
                            : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-neutral-400 hover:text-white"
                            onClick={() => handleReprocess(document.id)}
                          >
                            <RefreshCw className="h-4 w-4 mr-1" /> Reprocess
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="bg-neutral-900 border-neutral-800 text-white max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit knowledge base</DialogTitle>
            <DialogDescription className="text-neutral-400">
              Update chunking parameters and metadata applied to new documents.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1 text-sm">
                <label className="text-neutral-300">Name</label>
                <Input
                  value={formValues.name}
                  onChange={(event) =>
                    setFormValues((prev) => ({ ...prev, name: event.target.value }))
                  }
                  className="bg-neutral-900 border-neutral-800"
                />
              </div>
              <div className="space-y-1 text-sm">
                <label className="text-neutral-300">Language</label>
                <Input
                  value={formValues.language}
                  onChange={(event) =>
                    setFormValues((prev) => ({ ...prev, language: event.target.value }))
                  }
                  className="bg-neutral-900 border-neutral-800"
                />
              </div>
            </div>

            <div className="space-y-1 text-sm">
              <label className="text-neutral-300">Description</label>
              <Textarea
                value={formValues.description}
                onChange={(event) =>
                  setFormValues((prev) => ({ ...prev, description: event.target.value }))
                }
                rows={3}
                className="bg-neutral-900 border-neutral-800"
              />
            </div>

            <div className="space-y-1 text-sm">
              <label className="text-neutral-300">Embedding model</label>
              <Input
                value={formValues.embedding_model}
                onChange={(event) =>
                  setFormValues((prev) => ({ ...prev, embedding_model: event.target.value }))
                }
                className="bg-neutral-900 border-neutral-800"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1 text-sm">
                <label className="text-neutral-300">Chunk size</label>
                <Input
                  type="number"
                  min={64}
                  value={formValues.chunk_size}
                  onChange={(event) =>
                    setFormValues((prev) => ({ ...prev, chunk_size: Number(event.target.value) }))
                  }
                  className="bg-neutral-900 border-neutral-800"
                />
              </div>
              <div className="space-y-1 text-sm">
                <label className="text-neutral-300">Overlap</label>
                <Input
                  type="number"
                  min={0}
                  value={formValues.chunk_overlap}
                  onChange={(event) =>
                    setFormValues((prev) => ({ ...prev, chunk_overlap: Number(event.target.value) }))
                  }
                  className="bg-neutral-900 border-neutral-800"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              className="text-neutral-400 hover:text-white"
              onClick={() => setIsEditDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button className="bg-emerald-500 hover:bg-emerald-600" onClick={handleEditBase}>
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
