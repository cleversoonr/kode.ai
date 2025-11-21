/*
┌──────────────────────────────────────────────────────────────────────────────┐
│ @author: Davidson Gomes                                                      │
│ @file: /types/knowledgeBase.ts                                               │
│ Developed by: Davidson Gomes                                                 │
│ Creation date: May 13, 2025                                                  │
│ Contact: contato@evolution-api.com                                           │
├──────────────────────────────────────────────────────────────────────────────┤
│ @copyright © Evolution API 2025. All rights reserved.                        │
│ Licensed under the Apache License, Version 2.0                               │
│                                                                              │
│ You may not use this file except in compliance with the License.             │
│ You may obtain a copy of the License at                                      │
│                                                                              │
│    http://www.apache.org/licenses/LICENSE-2.0                                │
│                                                                              │
│ Unless required by applicable law or agreed to in writing, software          │
│ distributed under the License is distributed on an "AS IS" BASIS,            │
│ WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.     │
│ See the License for the specific language governing permissions and          │
│ limitations under the License.                                               │
├──────────────────────────────────────────────────────────────────────────────┤
│ @important                                                                   │
│ For any future changes to the code in this file, it is recommended to        │
│ include, together with the modification, the information of the developer    │
│ who changed it and the date of modification.                                 │
└──────────────────────────────────────────────────────────────────────────────┘
*/

export type KnowledgeSourceType = "upload" | "url" | "text";

export interface KnowledgeBaseConfig {
  knowledge_base_ids?: string[];
  knowledge_base_context?: string;
  rag_top_k?: number;
  rag_score_threshold?: number;
  load_memory?: boolean;
  tools?: any[];
  mcp_servers?: any[];
  custom_mcp_servers?: any[];
  custom_tools?: any;
  sub_agents?: string[];
  agent_tools?: string[];
  max_iterations?: number;
  workflow?: any;
  tasks?: any[];
}

export interface KnowledgeBase {
  id: string;
  client_id: string;
  name: string;
  description?: string | null;
  language?: string | null;
  embedding_model?: string | null;
  chunk_size: number;
  chunk_overlap: number;
  is_active: boolean;
  config: Record<string, any>;
  created_by?: string | null;
  updated_by?: string | null;
  created_at: string;
  updated_at?: string | null;
}

export interface KnowledgeBasePayload {
  name: string;
  description?: string;
  language?: string;
  embedding_model?: string;
  chunk_size?: number;
  chunk_overlap?: number;
  config?: Record<string, any>;
}

export interface KnowledgeDocument {
  id: string;
  knowledge_base_id: string;
  client_id: string;
  source_type: KnowledgeSourceType;
  original_filename?: string | null;
  source_url?: string | null;
  mime_type?: string | null;
  storage_path?: string | null;
  checksum?: string | null;
  content_preview?: string | null;
  extra_metadata: Record<string, any>;
  status: "pending" | "processing" | "ready" | "error";
  error_message?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at: string;
  updated_at?: string | null;
  processing_started_at?: string | null;
  processing_finished_at?: string | null;
}

export interface KnowledgeDocumentTextPayload {
  title?: string;
  content: string;
}

export interface KnowledgeDocumentUrlPayload {
  url: string;
  description?: string;
}

export interface KnowledgeReference {
  document_id?: string;
  knowledge_base_id?: string;
  source?: string;
  chunk_index?: number;
  score?: number;
  metadata?: Record<string, any>;
}
