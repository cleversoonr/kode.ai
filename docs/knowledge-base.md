# Knowledge Base & RAG Guide

Documentação prática para criar, alimentar e consumir bases de conhecimento dentro do Kode AI. Use este guia junto ao `README.md` e `docs/ARQUITETURA.md` para entender o fluxo ponta a ponta.

## 1. Pré-requisitos

- Banco com extensão `pgvector` habilitada (`alembic upgrade head` cuida disso).
- Variáveis `.env` configuradas: `EMBEDDING_MODEL`, `EMBEDDING_API_KEY`, `KNOWLEDGE_STORAGE_PATH`, `MAX_UPLOAD_SIZE_MB`, etc.
- Dependências instaladas (`pip install -e .`) e frontend atualizado (`pnpm install`).

## 2. Criando Bases de Conhecimento

1. Acesse `/knowledge-bases` no painel.
2. Clique em **New Base** e informe nome, idioma, modelo de embedding, chunk size e overlap.
3. Após criar, selecione **Manage** para abrir a tela de detalhes.

## 3. Ingestão de Conteúdo

### 3.1 Upload de arquivos
- Aceita PDF, DOCX, TXT e MD (limite controlado por `MAX_UPLOAD_SIZE_MB`).
- Cada upload gera um documento `pending` e dispara o job de ingestão.

### 3.2 Snippets de texto
- Aba **Snippet** permite inserir texto livre (ex.: FAQs). O conteúdo é salvo em disco e vetorizado como qualquer outro documento.

### 3.3 URLs
- Aba **URL** captura páginas públicas. O backend baixa o HTML, remove scripts e extrai o texto. Ideal para docs corporativos ou blogs.

### 3.4 Acompanhando status
- Na tabela “Documents” é possível acompanhar `pending → processing → ready`. Em caso de erro, clique em **Reprocess** para tentar novamente.

## 4. Ligando Bases aos Agentes

1. Abra `/agents`, clique em **New Agent** (ou edite um existente).
2. Na aba **Basic Information** há o seletor “Knowledge Bases”: escolha uma ou mais bases.
3. Ajuste `Context top-K` e `Score threshold` conforme o grau de recall desejado (defaults: 5 / 0.35).
4. Salve o agente — qualquer chat com ele agora recuperará contexto automaticamente.

## 5. Experiência no Chat

- Durante o chat (`/chat`), cada resposta retorna `knowledge_references` com os documentos que embasaram a decisão.
- A UI exibe a seção “Sources referenced” com nome da base, chunk e links quando disponíveis.

## 6. Observabilidade e Troubleshooting

- Logs de ingestão ficam em `knowledge_jobs.logs` e no console da API.
- Utilize Langfuse/OTel para inspecionar spans das execuções — cada turno carrega o atributo `knowledge_references`.
- Para limpar uma base, delete via UI ou acione `DELETE /api/v1/knowledge-bases/{id}`; os chunks são removidos automaticamente.

## 7. Próximos Passos

- Automatize backups do diretório `static/knowledge` e das tabelas `knowledge_*`.
- Considere mover a ingestão para um worker dedicado (Celery/RQ) quando o volume crescer.
- Ajuste `EMBEDDING_MODEL` conforme o provedor (OpenAI, Gemini, etc.) e monitore custos.

Mantendo esta disciplina, o Kode AI oferece um RAG completo e auditável, com UX alinhada ao painel existente.
