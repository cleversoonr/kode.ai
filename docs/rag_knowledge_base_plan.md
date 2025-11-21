# Plano de Implementação — Módulo de Bases de Conhecimento (RAG)

Documento de planejamento para adicionar um módulo completo de Base de Conhecimento capaz de ingerir arquivos (PDF, DOCX, TXT, Markdown), texto livre e links, gerar vetores e permitir que agentes selecionem quais bases utilizar durante a execução. O plano está dividido em etapas sequenciais cobrindo backend, frontend e aspectos operacionais.

---

## 1. Objetivos do Módulo
- Permitir que cada cliente crie múltiplas bases de conhecimento independentes.
- Suportar diferentes tipos de fontes (upload de arquivos, texto manual, captura de páginas web).
- Armazenar chunks vetorizados e metadados com rastreabilidade (documento, versão, fonte).
- Habilitar seleção de bases na configuração de agentes e injetar contexto durante o fluxo de execução (RAG).
- Manter controles de acesso por cliente, auditoria e observabilidade.

---

## 2. Arquitetura Geral Proposta
1. **Persistência**: adicionar tabelas relacionais:
   - `knowledge_bases` (pertence a um cliente).
   - `knowledge_documents` (registros de uploads/links/textos).
   - `knowledge_chunks` (texto processado e hash/embedding metadata).
   - `knowledge_jobs` (fila/status de processamento por documento).
2. **Armazenamento vetorial**:
   - Preferência por **pgvector** dentro do PostgreSQL existente para evitar dependências extras. Alternativa: integrar com serviços externos (Pinecone, Qdrant). Decidir via `VECTOR_STORE_PROVIDER`.
   - Criar camada `src/services/vector_store/*` com interface e implementações (pgvector, http/external).
3. **Ingestão**:
   - `src/services/knowledge_base/ingestion.py` responsável por:
     - Extrair texto de PDF/DOCX/MD usando libs (p.ex. `pypdf`, `python-docx`, `markdown`).
     - Normalizar textos e dividir em chunks configuráveis (ex.: 512 tokens com overlap 128).
     - Gerar embeddings com LiteLLM (mesmo provedor das LLMs) ou modelo dedicado (`EMBEDDING_MODEL`/`EMBEDDING_API_KEY`).
     - Salvar chunks + embeddings no vetor store e status na tabela.
   - Uso de **background tasks**:
     - Fase 1: utilizar `FastAPI BackgroundTasks`/`asyncio.create_task` enquanto o volume é pequeno.
     - Fase 2: preparar worker separado (ex.: `rq`/`celery`) para escalar; incluir no roadmap mas não bloquear MVP.
4. **Serviço de consulta RAG**:
   - `KnowledgeBaseRetriever` (novo serviço) com métodos:
     - `query(base_ids, prompt, top_k, filters)` → retorna lista de chunks + metadata.
   - Integrar `AgentBuilder` para carregar selecionadas em `agent.config["knowledge_base_ids"]`.
5. **Frontend + UX**:
   - Nova seção "Bases de conhecimento" (rotas `/knowledge-bases` e `/knowledge-bases/[id]`).
   - Flow de criação/edição, upload múltiplo (drag & drop), listagem de documentos com status, reprocessamento, visualização de chunks.
   - Em edição de agente: componente multi-select (com busca) para vincular bases.
6. **Infraestrutura**:
   - Migrar banco para ter extensão `pgvector`.
   - Armazenar arquivos no disco (`/static/knowledge/CLIENT_ID/...`) ou provider S3 compatível. Registrar caminho/URL no documento.
   - Variáveis `.env`: `VECTOR_STORE_PROVIDER`, `PGVECTOR_DIMENSION`, `EMBEDDING_MODEL`, `EMBEDDING_API_KEY`, `MAX_CHUNK_TOKENS`, `CHUNK_OVERLAP`, `MAX_UPLOAD_MB`.

---

## 3. Etapas Detalhadas

### Etapa 1 — Preparação do Ambiente
1. **Banco de dados**:
   - Habilitar extensão `pgvector` nas migrations (`op.execute("CREATE EXTENSION IF NOT EXISTS vector")`).
   - Adicionar scripts para instalar extensão em Docker/Postgres local.
2. **Configurações**:
   - Atualizar `src/config/settings.py` com novas envs (`VECTOR_STORE_PROVIDER`, `EMBEDDING_MODEL`, etc.).
   - Ajustar `README.md`/`.env.example` e `docs/ARQUITETURA.md` para documentar requisitos.

### Etapa 2 — Modelagem de Dados
Criar migrations e models SQLAlchemy:
- `KnowledgeBase`: id, client_id, name, description, languages, embedding_model, chunk_size, overlap, is_active, created_at/updated_at.
- `KnowledgeDocument`: base_id, source_type (`upload`, `url`, `text`), original_filename/url, content_preview, status (`pending`, `processing`, `ready`, `error`), error_message, storage_path, checksum, created_by, processing_started_at/finished_at.
- `KnowledgeChunk`: document_id, base_id, chunk_index, content, embedding (vetor `vector`), metadata (JSON com página, url, heading), created_at.
- `KnowledgeJob`: document_id, job_type (`ingest`, `reprocess`), status, logs (JSON), attempts, queued_at/finished_at.
- Criar relacionamentos com `Client` e `User`, mais cascata adequada.

### Etapa 3 — Camada de Serviços Backend
1. **Vector Store Interface** (`src/services/vector_store/base.py`):
   - Métodos: `upsert_chunks`, `delete_chunks`, `search(base_ids, query_embedding, top_k, filters)`.
2. **Implementação pgvector** (`vector_store/pgvector.py`):
   - Usar SQLAlchemy + `sqlalchemy.dialects.postgresql import ARRAY`.
   - Consultas com `embedding <=> :query_embedding`.
3. **Ingestão de arquivos**:
   - Utilitários de parsing em `src/utils/ingestion/` (pdf/text/url).
   - Serviço `KnowledgeIngestionService`:
     - Salvar arquivo temporariamente (`static/knowledge/temp`).
     - Criar registro `KnowledgeDocument` com status `pending`.
     - Background task processa: extrai texto, gera chunks, embeddings, salva no vetor store e atualiza status.
   - Manter logs detalhados (em `KnowledgeJob.logs`) para apoiar troubleshooting.
4. **Consulta RAG**:
   - `KnowledgeRetrieverService.get_context(agent, user_query)`:
     - Ler IDs configurados no agente.
     - Gerar embedding da pergunta.
     - Buscar `top_k` documentos por base (com `score_threshold` e `filters`).
     - Retornar texto formatado + metadata para o prompt.
   - Ajustar `AgentBuilder._create_llm_agent` para anexar instruções/chunks:
     - Antes da execução, recuperar contextos e inserir seções no prompt (`<knowledge_base_context>`).
     - Garantir que a busca só aconteça quando `agent.config["knowledge_base_ids"]` estiver preenchido.

### Etapa 4 — API e Rotas Backend
Criar novo módulo `src/api/knowledge_routes.py` e serviços correspondentes:
1. **Rotas**:
   - `POST /knowledge-bases/` (criar base).
   - `GET /knowledge-bases/` (listar por cliente).
   - `GET /knowledge-bases/{id}` (detalhe + métricas).
   - `PATCH /knowledge-bases/{id}` (editar config).
   - `DELETE /knowledge-bases/{id}` (soft delete, verificar se há agentes usando).
   - `POST /knowledge-bases/{id}/documents` (upload/URL/text).
   - `GET /knowledge-bases/{id}/documents` (listar com status e filtros).
   - `GET /knowledge-documents/{id}` (detalhe + chunks).
   - `POST /knowledge-documents/{id}/reprocess`.
   - `DELETE /knowledge-documents/{id}`.
   - `GET /knowledge-bases/{id}/stats` (total chunks, tokens, tamanho).
2. **Autorização**:
   - Reutilizar `verify_user_client` e `x-client-id`.
   - Logs em `AuditLog`.
3. **Uploads**:
   - Utilizar `FastAPI UploadFile`. Configurar limites (ex.: 20 MB) via `MAX_UPLOAD_SIZE_MB`.
   - Para URLs: validação do domínio e download assíncrono com timeout.
4. **Integração com agentes**:
   - Atualizar `AgentSchema` para incluir `knowledge_base_ids: List[UUID]`.
   - Permitir filtrar `Agent` por base.

### Etapa 5 — Ajustes no Fluxo de Execução (RAG)
1. **Agent Runner**:
   - Injetar etapa `prepare_rag_context` antes de criar o `LlmAgent`.
   - Expandir `Agent.config` com opções `rag_top_k`, `rag_score_threshold`, `rag_strategy (stuffing|map_reduce|refine)` para futura flexibilidade.
2. **Streaming**:
   - Durante execução, anexar ao log de eventos quais fontes foram usadas (enviar no payload do chat WebSocket/SSE).
   - Permitir que clientes no frontend visualizem referências durante o chat (exibir lista de documentos utilizados).

### Etapa 6 — Frontend
1. **Rotas e Navegação**:
   - Adicionar seção "Knowledge Bases" ao menu (condicional por papel e client/admin).
   - Rotas:
     - `/knowledge-bases`: tabela com nome, descrição, nº de docs/chunks, status.
     - `/knowledge-bases/new`: formulário com nome, idioma, modelo de embedding.
     - `/knowledge-bases/[id]`: abas ("Documentos", "Configurações", "Estatísticas").
2. **Uploads & Processamento**:
   - Componente de upload múltiplo (drag-and-drop), barra de progresso e status em tempo real via polling/WebSocket.
   - Form para adicionar URL e texto manual (com limite de caracteres).
   - Exibir timeline/log do processamento (usando dados de `KnowledgeJob`).
3. **Seleção em Agentes**:
   - Em `/agents/[id]/edit`: multiselect para vincular bases (chips/checkbox list).
   - Mostrar resumo do consumo (ex.: "3 bases selecionadas — 4k chunks").
4. **Chat UI**:
   - Quando o backend enviar referências no payload, renderizar "Fontes" em accordion com link para o documento original.
5. **State Management**:
   - Criar `knowledgeBaseService.ts` (listar bases, docs, uploads, reprocess) reutilizando `api.ts`.
   - Hooks para acompanhar progresso (`useKnowledgeJobStatus`).

### Etapa 7 — Arquitetura Física e DevOps
1. **Armazenamento de arquivos**:
   - Padrão local: `/static/knowledge/{client_id}/{knowledge_base_id}/{document_id}`.
   - Preparar abstração para `S3`/`GCS` via `STORAGE_PROVIDER`.
2. **Backups e retenção**:
   - Documentar necessidade de backup das tabelas e diretório de arquivos (Makefile alvo `backup-knowledge`).
3. **Monitoramento**:
   - Expor métricas (quantidade de chunks, tempo médio de ingestão) no logger + Langfuse.
4. **CI/CD**:
   - Adicionar testes automatizados para ingestion service e APIs.
   - Validar migrations e hooks no pipeline.

### Etapa 8 — Documentação e Onboarding
1. Atualizar `README.md`, `docs/ARQUITETURA.md` e `docs/ANOTACOES.md` com:
   - Instruções para instalar pgvector.
   - Novas variáveis `.env`.
   - Passo a passo para criar uma base e vincular a um agente.
2. Criar tutoriais simples em `docs/` (ex.: `knowledge-base.md`) explicando:
   - Upload de PDF.
   - Reprocessamento.
   - Configuração de RAG no agente.

---

## 4. Roadmap Faseado
1. **MVP (Sprints 1-2)**:
   - Estrutura de dados, APIs CRUD, ingestão básica (PDF/TXT) usando pgvector local.
   - Seleção de bases nos agentes e RAG simples (stuffing) com top_k fixo.
2. **Fase 2**:
   - Suporte a URLs, DOCX, Markdown.
   - Reprocessamento, logs detalhados, UI completa de status.
   - Referências no chat + export/visualização de chunks.
3. **Fase 3**:
   - Worker dedicado para ingestão.
   - Estratégias adicionais de RAG (map-reduce, citations).
   - Integração com provedores externos de vetor e armazenamento S3/GCS.

---

## 5. Considerações Técnicas
- **Segurança**: sanitizar uploads, limitar tipos, rodar antivírus se possível. Armazenar arquivos fora do path público ou gerar URLs assinadas.
- **Custos**: embeddings podem ser caros; registrar tokens consumidos por base e cliente para futuros billing/quotas.
- **Escalabilidade**: chunk table pode crescer rapidamente. Planejar partição por base ou retenção de versões.
- **LGPD**: avisar clientes sobre políticas de dados e disponibilizar botão para deleção completa da base.

---

