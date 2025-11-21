/*
┌──────────────────────────────────────────────────────────────────────────────┐
│ @author: Davidson Gomes                                                      │
│ @file: /services/knowledgeBaseService.ts                                     │
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
import api from "./api";
import {
  KnowledgeBase,
  KnowledgeBasePayload,
  KnowledgeDocument,
  KnowledgeDocumentTextPayload,
  KnowledgeDocumentUrlPayload,
} from "@/types/knowledgeBase";

const BASE_PATH = "/api/v1/knowledge-bases";

const withClientHeader = (clientId: string) => ({
  headers: {
    "x-client-id": clientId,
  },
});

export const listKnowledgeBases = (
  clientId: string,
  params?: { search?: string; skip?: number; limit?: number }
) => {
  const listPath = `${BASE_PATH}/`;
  const searchParams = new URLSearchParams();
  if (params?.search) searchParams.append("search", params.search);
  searchParams.append("skip", String(params?.skip ?? 0));
  searchParams.append("limit", String(params?.limit ?? 100));

  const query = searchParams.toString();
  const url = query ? `${listPath}?${query}` : listPath;
  return api.get<KnowledgeBase[]>(url, withClientHeader(clientId));
};

export const getKnowledgeBase = (clientId: string, id: string) =>
  api.get<KnowledgeBase>(`${BASE_PATH}/${id}`, withClientHeader(clientId));

export const createKnowledgeBase = (
  clientId: string,
  payload: KnowledgeBasePayload
) => api.post<KnowledgeBase>(`${BASE_PATH}/`, payload, withClientHeader(clientId));

export const updateKnowledgeBase = (
  clientId: string,
  id: string,
  payload: Partial<KnowledgeBasePayload>
) => api.patch<KnowledgeBase>(`${BASE_PATH}/${id}`, payload, withClientHeader(clientId));

export const deleteKnowledgeBase = (clientId: string, id: string) =>
  api.delete(`${BASE_PATH}/${id}`, withClientHeader(clientId));

export const listKnowledgeDocuments = (
  clientId: string,
  baseId: string,
  params?: { status?: string; skip?: number; limit?: number }
) => {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.append("status", params.status);
  searchParams.append("skip", String(params?.skip ?? 0));
  searchParams.append("limit", String(params?.limit ?? 100));

  const query = searchParams.toString();
  const url = query
    ? `${BASE_PATH}/${baseId}/documents?${query}`
    : `${BASE_PATH}/${baseId}/documents`;

  return api.get<KnowledgeDocument[]>(url, withClientHeader(clientId));
};

export const uploadKnowledgeDocument = (
  clientId: string,
  baseId: string,
  file: File,
  description?: string
) => {
  const formData = new FormData();
  formData.append("file", file);
  if (description) formData.append("description", description);

  return api.post<KnowledgeDocument>(
    `${BASE_PATH}/${baseId}/documents/upload`,
    formData,
    withClientHeader(clientId)
  );
};

export const createTextDocument = (
  clientId: string,
  baseId: string,
  payload: KnowledgeDocumentTextPayload
) =>
  api.post<KnowledgeDocument>(
    `${BASE_PATH}/${baseId}/documents/text`,
    payload,
    withClientHeader(clientId)
  );

export const createUrlDocument = (
  clientId: string,
  baseId: string,
  payload: KnowledgeDocumentUrlPayload
) =>
  api.post<KnowledgeDocument>(
    `${BASE_PATH}/${baseId}/documents/url`,
    payload,
    withClientHeader(clientId)
  );

export const getKnowledgeDocument = (
  clientId: string,
  documentId: string
) =>
  api.get<KnowledgeDocument>(
    `${BASE_PATH}/documents/${documentId}`,
    withClientHeader(clientId)
  );

export const reprocessKnowledgeDocument = (
  clientId: string,
  documentId: string
) =>
  api.post<KnowledgeDocument>(
    `${BASE_PATH}/documents/${documentId}/reprocess`,
    {},
    withClientHeader(clientId)
  );
