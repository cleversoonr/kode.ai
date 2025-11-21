# Guia de Arquitetura e Tecnologias — Kode AI

Documento de referência rápida para entender como o projeto está organizado, quais tecnologias utiliza e como as principais peças se conectam. Use-o em conjunto com o `README.md` para começar a desenvolver ou evoluir a plataforma.

## 1. Visão Geral

- **Produto**: plataforma para criação, orquestração e operação de agentes de IA focados em cenários corporativos (clientes, ferramentas MCP, workflows e compartilhamento).
- **Stack**: backend em FastAPI (+ Google Agent Development Kit como engine padrão), frontend em Next.js 15 com App Router e design system baseado em shadcn/ui + Tailwind.
- **Domínios principais**: clientes e usuários, agentes (LLM, sequenciais, paralelos, loops, A2A, LangGraph/workflow e task), APIs/MCP tools, sessões de chat e chaves de API seguras.
- **Canais de consumo**: painel web (`frontend/`), API REST, WebSocket para chat, SSE para streaming A2A e endpoints públicos `.well-known/agent.json`.

## 2. Tecnologias Principais

| Camada | Tecnologias | Uso |
| --- | --- | --- |
| **Backend** | Python 3.10, FastAPI, Uvicorn, SQLAlchemy 2, Alembic, Pydantic 2, python-jose, passlib/bcrypt | API REST, autenticação JWT, migrations e modelos relacionais. |
| **Motores de agentes** | [google-adk](https://google.github.io/adk-docs/), LiteLLM, LangGraph, CrewAI (opcional), a2a-sdk, MCP | Construção e execução de agentes, workflows customizados (`src/services/adk/*`), interoperabilidade A2A e integração com ferramentas MCP/Custom. |
| **Infra de dados** | PostgreSQL, Redis, Fernet crypto, SendGrid/SMTP, templates Jinja2 | Persistência de entidades, cache TTL/locks (`src/config/redis.py`), criptografia de chaves em `src/utils/crypto.py`, notificações. |
| **Observabilidade** | OpenTelemetry SDK + OTLP exporter, Langfuse, logging estruturado (`src/utils/logger.py`) | Traçar execuções, enviar spans para Langfuse (`src/utils/otel.py`) e manter logs rotacionados em `/logs`. |
| **Frontend** | Next.js 15 App Router, React 18, TypeScript 5, Tailwind, shadcn/ui, React Hook Form + Zod, @xyflow/react (React Flow), axios, next-runtime-env | UI responsiva para CRUD de agentes/clients/MCP, builder visual de workflows, chat em tempo real e documentação integrada. |
| **Ferramentas de dev** | Makefile, Docker/Docker Compose, pnpm, Black, Flake8, Pytest + pytest-asyncio | Automação de setup (`make install-dev`, `pnpm install`), formatação/lint e execução local em containers. |

## 3. Estrutura do Repositório

- `src/main.py`: inicializa FastAPI, registra middlewares, injeta routers de `src/api/*`, configura estáticos e OpenTelemetry.
- `src/api/`: rotas REST/WebSocket/SSE (`chat_routes`, `agent_routes`, `client_routes`, `a2a_routes`, etc.) com autenticação via `src/core/jwt_middleware.py`.
- `src/services/`: camada de negócio; concentra builders/runner de agentes (ADK e CrewAI), serviços para clientes, MCP servers, API keys, auditoria e envio de email.
- `src/models/models.py`: entidades SQLAlchemy (`Client`, `User`, `Agent`, `AgentFolder`, `MCPServer`, `Tool`, `ApiKey`, `AuditLog`, `Session`).
- `src/schemas/`: contratos Pydantic expostos na API (auth, agents, chat, etc.).
- `src/core/`: exceções e middlewares JWT.
- `src/config/`: configurações Pydantic (`settings.py`), conexão com Postgres (`database.py`) e Redis (`redis.py`).
- `src/utils/`: utilitários (criptografia, logger, discovery MCP, OpenTelemetry, cliente A2A, helpers de streaming).
- `scripts/`: seeders e executor (`scripts/run_seeders.py`) usados por `make seed-*`.
- `frontend/`: aplicação Next.js 15 (rotas em `app/`, serviços HTTP em `services/`, contexts para builder Drag-n-Drop, hooks de WebSocket em `hooks/use-agent-webSocket.ts`).
- `docs/`: documentação (este arquivo + `ANOTACOES.md`).

## 4. Backend — Arquitetura Lógica

### 4.1 Entrypoint e Roteamento
- `src/main.py` carrega configurações (`settings`), define CORS aberto para desenvolvimento e inclui routers com prefixo `/api/v1`.
- Rotas estão agrupadas por domínio (ex.: `agent_routes` lida com agentes, folders e API keys; `mcp_server_routes` cadastra servidores MCP; `chat_routes` entrega REST e WebSocket para conversas).
- WebSocket (`/api/v1/chat/ws/{agent_id}/{external_id}`) exige mensagem inicial com token JWT ou `api_key` configurada no agente.
- Endpoints A2A (`src/api/a2a_routes.py`) expõem métodos `message/send`, `message/stream` (SSE) e `/.well-known/agent.json`, seguindo a especificação oficial.

### 4.2 Serviços e Motores de Execução
- `src/services/service_providers.py` decide qual `session_service` usar (Google ADK `DatabaseSessionService` ou `CrewSessionService`) com base em `AI_ENGINE`.
- `AgentBuilder` (`src/services/adk/agent_builder.py`) monta agentes LLM ou compostos:
  - Carrega sub-agentes para ferramentas (`AgentTool`), conecta ferramentas customizadas (`custom_tools.py`), descobre MCP servers (`mcp_service.py`) e injeta instruções formatadas com contexto temporal.
  - Recupera API keys seguras via `src/services/apikey_service.py` (de/criptografadas por `src/utils/crypto.py`).
  - Inclui memória (`load_memory`) quando `config.load_memory` está habilitado.
- `AgentRunner` (`src/services/adk/agent_runner.py`) executa agentes ADK sincronos/streaming; equipe `src/services/crewai/agent_runner.py` espelha as operações quando `AI_ENGINE=crewai`.
- Agentes especiais ficam em `src/services/adk/custom_agents/`:
  - `workflow_agent.py`: usa LangGraph (`StateGraph`) para orquestrar nós (start, agentes, atrasos).
  - `a2a_agent.py`: implementação do protocolo Agent-to-Agent.
  - `task_agent.py`: executa instruções com validação estruturada (`src/schemas/agent_config.AgentTask`).
- Serviços auxiliares: `mcp_server_service` para CRUD + cache de ferramentas, `tool_service` para catálogos, `email_service` envia templates Jinja2 (`src/templates/emails`), `audit_service` registra ações em `AuditLog`.

### 4.3 Persistência e Segurança
- PostgreSQL: configurado via `POSTGRES_CONNECTION_STRING` (ver `.env` ou `src/config/settings.py`). Migrations ficam em `alembic/`.
- Redis: `src/config/redis.py` cria pools com prefixo de chave e TTL configuráveis (`REDIS_KEY_PREFIX`, `REDIS_TTL`). Usado para caches de ferramentas, locks temporários e suporte a sessões.
- API Keys: armazenadas em `api_keys.encrypted_key` usando Fernet; expostas para UI sem revelar o segredo.
- Autenticação: JWT `HS256` (`JWT_SECRET_KEY`, `JWT_EXPIRATION_TIME`), verificação de cliente (`verify_user_client`), limitação de tentativas (`MAX_LOGIN_ATTEMPTS`, `LOGIN_LOCKOUT_MINUTES`).
- Emails: `EMAIL_PROVIDER` seleciona SendGrid (`SENDGRID_API_KEY`) ou SMTP (`SMTP_*`). Templates residem em `src/templates/emails/`.
- Knowledge Base / RAG: tabelas `knowledge_bases`, `knowledge_documents`, `knowledge_chunks` (pgvector) e `knowledge_jobs`. A ingestão passa por `knowledge_base_service` e `knowledge_base_ingestion`, convertendo arquivos/snippets/URLs em chunks vetorizados.

### 4.4 Observabilidade e Logs
- `src/utils/logger.py` configura logging estruturado por módulo e grava em `logs/`.
- `src/utils/otel.init_otel()` liga o OTLP exporter usando `LANGFUSE_*` + `OTEL_EXPORTER_OTLP_ENDPOINT`, permitindo rastrear execuções no painel Langfuse.
- `Langfuse` também é referenciado em `.env` e `README.md` como destino padrão.

### 4.5 Scripts e Tarefas
- Makefile fornece comandos padronizados: `make venv`, `make install-dev`, `make alembic-upgrade`, `make seed-all`, `make run`, `make run-prod`, `make lint`, `make format`, `make docker-*`.
- `scripts/seeders/*` criam admin, cliente demo, MCP servers e tools. `scripts/run_seeders.py` respeita dependências e valida `.env`.
- Dockerfile instala Python 3.10 + Node.js 20, aplica migrations e roda seeders automaticamente antes do `uvicorn`. `docker-compose.yml` sobe API, Postgres e Redis com healthchecks e volumes nomeados.
- Documentação complementar: `docs/rag_knowledge_base_plan.md` (roadmap) e `docs/knowledge-base.md` (tutorial de ingestão).

## 5. Fluxos de Funcionamento

### 5.1 Execução de Chat via Painel
1. Usuário autentica-se no frontend, que grava JWT em cookies (`frontend/middleware.ts` protege rotas).
2. Na tela de chat (`frontend/app/chat`), a UI chama `frontend/services/api.ts`. Interceptores adicionam `Authorization` e tratam 401 executando `forceLogout`.
3. A requisição atinge `src/api/chat_routes.py`. `get_agent_by_api_key` aceita JWT ou `x-api-key` (para agentes compartilhados).
4. `run_agent_adk` seleciona builder, monta tools (custom/MCP/sub-agentes) e usa `session_service`, `artifacts_service` e `memory_service` definidos em `service_providers`.
5. Eventos de execução são enviados ao cliente via streaming (REST com chunks ou WebSocket). Observabilidade é enviada ao Langfuse.

### 5.2 Fluxo A2A / MCP
1. Consumidores externos chamam `/api/v1/a2a/message/send` com `x-api-key`.
2. `verify_api_key` busca o agente pelo JSONB `config->>'api_key'`.
3. `run_agent` produz `Task`/`Artifact` no formato oficial A2A e, se solicitado, `EventSourceResponse` transmite tokens em tempo real.
4. `.well-known/agent.json` é exposto a partir de `Agent.agent_card_url_property`, permitindo discovery por outras plataformas.
5. Ferramentas MCP são cadastradas via `src/api/mcp_server_routes.py` e consumidas pelo `MCPService` para conectar endpoints `studio`/`sse`.

### 5.3 Construção de Agentes e Workflows
1. Admin cria cliente e organiza agentes em pastas (`AgentFolder`) pela UI.
2. API keys de provedores LLM são cadastradas e criptografadas.
3. Agentes são configurados com tipo (`llm`, `sequential`, `parallel`, `loop`, `a2a`, `workflow`, `task`, `crew_ai`), ferramentas e sub-agentes. Config fica em `agents.config` (JSON).
4. Workflows utilizam builder visual (`frontend/app/agents` + ReactFlow) e são traduzidos em `flow_json` consumido por `WorkflowAgent`.
5. Seeds disponibilizam exemplos iniciais (admin, demo client, MCP servers e tools básicos).
6. Bases de conhecimento são vinculadas aos agentes na aba “Basic Information”, definindo `knowledge_base_ids`, `rag_top_k` e `rag_score_threshold`.

## 6. Frontend — Organização

### 6.1 Estrutura e Rotas
- App Router (`frontend/app/`) com layouts segmentados:
  - `/login`, `/logout`, `/security/*` para autenticação, verificação e reset de senha.
  - `/agents`, `/chat`, `/profile` voltados ao cliente; `/clients`, `/mcp-servers` exclusivos de admins (validado no `middleware.ts`).
  - `/shared-chat` permite chat público usando `shared_agent_api_key` em `localStorage`/`x-api-key`.
  - `/documentation` apresenta manuais internos usando markdown renderizado.

### 6.2 Estado, Contextos e Serviços
- HTTP centralizado em `frontend/services/api.ts` (axios + interceptors). Serviços específicos (`agentService`, `clientService`, `mcpServerService`, etc.) encapsulam endpoints REST.
- Contextos em `frontend/contexts/` (ex.: `DnDContext`, `NodeDataContext`) alimentam o builder de workflows/agents; hooks em `frontend/hooks/use-agent-webSocket.ts` encapsulam conexão WebSocket com a API.
- `next-runtime-env` (`frontend/lib/env.ts`) lê variáveis em runtime (útil para builds Docker) e define `NEXT_PUBLIC_API_URL`.

### 6.3 UI/UX
- Tailwind + shadcn/ui (`components.json`) fornecem componentes reutilizáveis (`frontend/components/ui`).
- `@xyflow/react` (React Flow) dá suporte a arrastar/soltar nós de workflow. Context menus, toasts (`sonner`), ícones (`lucide-react`) e gráficos (`recharts`) compõem o dashboard.
- Formulários usam React Hook Form + Zod para validar inputs antes de enviar ao backend.
- Módulo “Knowledge Bases” permite criar/editar bases, enviar arquivos/snippets/URLs e acompanhar status/reprocessamento.
- Chat exibe fontes citadas (“Sources referenced”) baseadas em `knowledge_references` devolvidas pela API.

## 7. Infraestrutura, Configuração e Operação

### 7.1 Variáveis de Ambiente (principais)
- Backend (`.env` na raiz): `POSTGRES_CONNECTION_STRING`, `REDIS_*`, `AI_ENGINE`, `JWT_SECRET_KEY`, `ENCRYPTION_KEY`, `EMAIL_PROVIDER`, `SENDGRID_API_KEY` ou credenciais SMTP, `LANGFUSE_*`, `OTEL_EXPORTER_OTLP_ENDPOINT`, `ADMIN_*` (seed), `APP_URL`.
- Frontend (`frontend/.env`): `NEXT_PUBLIC_API_URL` (padrão `http://localhost:8000`), podendo apontar para ambientes remotos.

### 7.2 Comandos úteis
```bash
make venv && source venv/bin/activate && make install-dev   # backend
make alembic-upgrade && make seed-all && make run           # aplica DB e roda API
cd frontend && pnpm install && pnpm dev                     # painel web
make docker-build && make docker-up                         # stack completa com Postgres/Redis
make docker-seed                                            # popula dados dentro do container
```

### 7.3 Deploy e Logs
- `docker-compose.yml` sobe `api`, `postgres` e `redis`, com volumes (nomes configuráveis via `POSTGRES_VOLUME_NAME`, `REDIS_VOLUME_NAME`).
- Logs da API são montados em `./logs`; assets (como `.well-known` gerados) ficam em `./static`.
- Healthchecks: API responde `GET /` com metadados; Compose verifica automaticamente (`curl -f http://localhost:8000/`).

### 7.4 Testes e Qualidade
- Tooling pronto para `pytest`/`pytest-asyncio` (`pyproject.toml`), embora a pasta `tests/` ainda esteja para ser criada.
- Lint/format com `make lint` (Flake8) e `make format` (Black).

## 8. Extensões e Boas Práticas

- **Novos agentes**: defina tipo + config em `Agent.config`. Para novos comportamentos, crie classes em `src/services/adk/custom_agents/` ou `src/services/crewai/` e exponha via `AgentBuilder`.
- **Integração com provedores**: salve chaves com `apikey_service.create_api_key` para garantir criptografia; nunca grave `config.api_key` em texto plano fora de ambientes de teste.
- **Ferramentas MCP**: aproveite o `config_type` (`studio` vs `sse`) e `environments` para múltiplos targets. Adicione scripts de descoberta em `src/utils/mcp_discovery.py` caso precise autodetectar capabilities.
- **Observabilidade**: mantenha `LANGFUSE_*` atualizados e valide spans em ambientes antes de releases. O `init_otel()` roda no startup da API, portanto variáveis ausentes podem bloquear métricas.
- **Frontend**: use os serviços em `frontend/services/*` em vez de chamar axios direto; o interceptor já trata expiração e shared chat. Para novos módulos, lembre-se de atualizar `middleware.ts` com permissões adequadas.
- **Deploy**: personalize `docker-compose.yml` apenas para variáveis; não modifique os comandos no Dockerfile que rodam migrations/seeders sem revisar os impactos em ambientes compartilhados.

---

Este documento deve ser atualizado sempre que surgir um novo componente relevante (ex.: novos motores, filas ou integrações externas). Mantê-lo junto ao código reduz o tempo de onboarding e ajuda no planejamento de evoluções.
