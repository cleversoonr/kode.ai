# PASSO A PASSO 
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"

- configurar env
make alembic-upgrade
make seed-all
make run

# frontend
pnpm install 
pnpm dev

# completo
Backend

Crie e ative um virtualenv: python -m venv .venv && source .venv/bin/activate.
Instale as dependências: pip install -e ".[dev]" (target do Makefile (lines 82-86)).
Copie um .env (não há exemplo na raiz; crie manualmente) com, no mínimo:
POSTGRES_CONNECTION_STRING=postgresql://postgres:root@localhost:5432/evo_ai
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET_KEY=uma_string_segura
ENCRYPTION_KEY=outra_string_segura
EMAIL_PROVIDER=sendgrid  # ou smtp
APP_URL=http://localhost:3000
Acrescente chaves de email, Langfuse ou A2A conforme precisar; todas as opções estão listadas em src/config/settings.py (lines 40-135).
Execute migrações: make alembic-upgrade para aplicar migrations/.
Popule dados básicos: make seed-all (usa os scripts em scripts/run_seeders.py e scripts/seeders/*.py).
Suba a API em modo dev: make run (comando definido em Makefile (line 20)).
Frontend

Entre em frontend/ e instale as dependências: pnpm install.
Copie .env do exemplo: cp .env.example .env; por padrão NEXT_PUBLIC_API_URL=http://localhost (line 8000) (frontend/.env.example (line 1)).
Rode o servidor de desenvolvimento: pnpm dev (porta 3000). Ajuste NEXT_PUBLIC_API_URL se a API estiver em outra origem.
Seeds e Credenciais

As credenciais padrão usadas pelos seeders vêm das variáveis ADMIN_EMAIL, ADMIN_INITIAL_PASSWORD, etc. em src/config/settings.py (lines 123-130); defina-as no .env se quiser controlar o que será criado.
Após make seed-all, confira o terminal para ver email/senha gerados; use-os no login inicial.

Knowledge Base / RAG

- Backend precisa das envs: EMBEDDING_MODEL, EMBEDDING_API_KEY, KNOWLEDGE_STORAGE_PATH, MAX_UPLOAD_SIZE_MB, VECTOR_STORE_PROVIDER=pgvector.
- Criar bases em /knowledge-bases, usar abas File/Snippet/URL para ingestão; o job aparece em knowledge_jobs e na tabela de documentos.
- Vincule as bases na aba Basic Information do agente e ajuste rag_top_k / rag_score_threshold.
- Chat mostra “Sources referenced” quando knowledge_references é retornado. Guia completo em docs/knowledge-base.md.

Docker (opcional)

Para testar sem instalar dependências locais, rode docker compose up -d na raiz; isso usa a imagem evoapicloud/evo-ai e sobe Postgres, Redis e API juntos (docker-compose.yml).
Para aplicar seeds nesse cenário, use docker compose exec api python -m scripts.run_seeders (atalho make docker-seed em Makefile (lines 68-69)).
Próximos Passos

Rodar pnpm lint e make lint antes de commits.
Configurar provedores externos (SendGrid/SMTP, Langfuse) quando for necessário.
Criar scripts de testes pytest e usá-los com pytest ou make (não há alvo pronto, mas o ambiente já instala pytest).
