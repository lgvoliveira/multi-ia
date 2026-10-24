-- O trabalho de cada funcionário: receitas próprias, execuções de receita, conversas, tarefas e arquivos.
--
-- Quem vê o quê (decisão 2 do Luis, 24/10/2026): cada pessoa vê o próprio trabalho. O dono NÃO lê pedidos, respostas
-- nem conversas dos funcionários; ele acompanha pelo extrato (quem, quando, receita ou IA, custo) e pelas entregas.
-- O funcionário pode apagar o próprio trabalho (LGPD); a linha de gasto no extrato continua.
--
-- Execuções e tarefas são gravadas só pelo servidor, que leva o trabalho das IAs adiante e cobra.
-- Pela sessão de quem está logado dá para ler e apagar o que é seu, e escrever só conversas e receitas próprias.

-- Atualiza updated_at sozinho a cada mudança.
create function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Receitas próprias, no mesmo formato das prontas (que continuam no código, em lib/recipes/).
-- O servidor confere o formato de novo antes de rodar: pela sessão dá para gravar sem passar pelas nossas telas.
create table public.custom_recipes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null default private.current_company_id()
    references public.companies (id) on delete restrict,
  member_id uuid not null default private.current_member_id(),
  name text not null check (char_length(name) between 1 and 120),
  -- private: só quem criou; company: a empresa toda.
  visibility text not null default 'private' check (visibility in ('private', 'company')),
  definition jsonb not null check (jsonb_typeof(definition) = 'object' and octet_length(definition::text) <= 65536),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (member_id, company_id) references public.members (id, company_id) on delete restrict
);

create index custom_recipes_company_idx on public.custom_recipes (company_id);

create trigger custom_recipes_touch before update on public.custom_recipes
  for each row execute function private.touch_updated_at();

-- Cada execução de receita. O motor guarda aqui o estado para continuar de onde parou.
create table public.runs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete restrict,
  member_id uuid not null,
  -- A receita pronta (ex.: create-site) ou, numa receita própria, o id dela no momento da execução.
  recipe_id text not null check (char_length(recipe_id) between 1 and 100),
  custom_recipe_id uuid references public.custom_recipes (id) on delete set null,
  request text not null,
  team jsonb not null default '{}',
  plan jsonb not null default '[]',
  status text not null default 'queued'
    check (status in ('queued', 'running', 'paused', 'finished', 'failed', 'cancelled')),
  cursor jsonb not null default '{}',
  outputs jsonb not null default '{}',
  results jsonb not null default '[]',
  result text,
  duration_ms integer check (duration_ms >= 0),
  estimate_cents bigint check (estimate_cents >= 0),
  -- Só interno (a sessão não lê estas três colunas): erro técnico e o controle de quem está rodando a execução.
  error jsonb,
  lease_until timestamptz,
  attempt integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz,
  foreign key (member_id, company_id) references public.members (id, company_id) on delete restrict,
  unique (id, company_id)
);

create index runs_member_idx on public.runs (member_id, created_at desc);
create index runs_unfinished_idx on public.runs (status) where status in ('queued', 'running');

create trigger runs_touch before update on public.runs
  for each row execute function private.touch_updated_at();

-- A narração ao vivo de cada execução (o que aparece nos cartões enquanto as IAs trabalham). Só eventos públicos.
create table public.run_events (
  id bigint generated always as identity primary key,
  run_id uuid not null,
  company_id uuid not null,
  event jsonb not null,
  created_at timestamptz not null default now(),
  foreign key (run_id, company_id) references public.runs (id, company_id) on delete cascade
);

create index run_events_run_idx on public.run_events (run_id, id);

-- As conversas da tarefa rápida.
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null default private.current_company_id()
    references public.companies (id) on delete restrict,
  member_id uuid not null default private.current_member_id(),
  title text not null default 'Nova conversa' check (char_length(title) between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (member_id, company_id) references public.members (id, company_id) on delete restrict,
  unique (id, company_id)
);

create index conversations_member_idx on public.conversations (member_id, updated_at desc);

create trigger conversations_touch before update on public.conversations
  for each row execute function private.touch_updated_at();

-- Cada pedido da tarefa rápida. Guarda o que a plataforma recomendou e o que o funcionário escolheu de fato,
-- para medir quantas vezes as pessoas trocam a recomendação (F03).
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete restrict,
  member_id uuid not null,
  conversation_id uuid,
  prompt text not null,
  answer text,
  -- O que a plataforma fez: responder, imagem, documento, gráfico...
  action text not null check (char_length(action) between 1 and 40),
  status text not null default 'running' check (status in ('running', 'finished', 'failed')),
  recommended_provider text check (recommended_provider in ('claude', 'gpt', 'gemini')),
  recommended_tier text check (recommended_tier in ('economico', 'padrao', 'potente')),
  recommended_effort text check (recommended_effort in ('low', 'medium', 'high')),
  chosen_provider text not null check (chosen_provider in ('claude', 'gpt', 'gemini')),
  chosen_tier text not null check (chosen_tier in ('economico', 'padrao', 'potente')),
  chosen_effort text not null check (chosen_effort in ('low', 'medium', 'high')),
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  foreign key (member_id, company_id) references public.members (id, company_id) on delete restrict,
  foreign key (conversation_id, company_id) references public.conversations (id, company_id) on delete cascade
);

create index tasks_member_idx on public.tasks (member_id, created_at desc);
create index tasks_conversation_idx on public.tasks (conversation_id, created_at);

-- Arquivos que o funcionário envia (upload) e entregas que as IAs produzem (delivery). O conteúdo fica na pasta
-- fechada "files" do Storage, no caminho <empresa>/<pessoa>/..., e só sai por link temporário gerado pelo servidor.
create table public.files (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete restrict,
  member_id uuid not null,
  kind text not null check (kind in ('upload', 'delivery')),
  name text not null check (char_length(name) between 1 and 255),
  storage_path text not null unique
    check (char_length(storage_path) between 1 and 1024 and split_part(storage_path, '/', 1) = company_id::text),
  mime_type text check (char_length(mime_type) <= 255),
  size_bytes bigint check (size_bytes >= 0),
  -- A entrega continua se a execução ou a tarefa de origem for apagada.
  run_id uuid references public.runs (id) on delete set null,
  task_id uuid references public.tasks (id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (member_id, company_id) references public.members (id, company_id) on delete restrict
);

create index files_company_idx on public.files (company_id, kind, created_at desc);
create index files_member_idx on public.files (member_id, created_at desc);

-- Regras de acesso.
alter table public.custom_recipes enable row level security;
alter table public.runs enable row level security;
alter table public.run_events enable row level security;
alter table public.conversations enable row level security;
alter table public.tasks enable row level security;
alter table public.files enable row level security;

revoke all on table public.custom_recipes, public.runs, public.run_events, public.conversations, public.tasks,
  public.files from public, anon, authenticated, service_role;

grant select, insert, update, delete on table public.custom_recipes, public.runs, public.conversations,
  public.tasks, public.files to service_role;
grant select, insert on table public.run_events to service_role;

-- Receitas próprias: cada um vê as suas e as da empresa. Quem criou muda e apaga; o dono também, nas da empresa.
-- Empresa e autor vêm sozinhos de quem está logado (a sessão não escolhe essas colunas).
grant select, delete on table public.custom_recipes to authenticated;
grant insert (name, visibility, definition), update (name, visibility, definition)
  on table public.custom_recipes to authenticated;

create policy custom_recipes_select on public.custom_recipes
  for select to authenticated
  using (
    company_id = (select private.current_company_id())
    and (member_id = (select private.current_member_id()) or visibility = 'company')
  );

create policy custom_recipes_insert on public.custom_recipes
  for insert to authenticated
  with check (
    company_id = (select private.current_company_id()) and member_id = (select private.current_member_id())
  );

create policy custom_recipes_update on public.custom_recipes
  for update to authenticated
  using (
    company_id = (select private.current_company_id())
    and (
      member_id = (select private.current_member_id())
      or (visibility = 'company' and (select private.current_member_is_owner()))
    )
  )
  with check (company_id = (select private.current_company_id()));

create policy custom_recipes_delete on public.custom_recipes
  for delete to authenticated
  using (
    company_id = (select private.current_company_id())
    and (
      member_id = (select private.current_member_id())
      or (visibility = 'company' and (select private.current_member_is_owner()))
    )
  );

-- Execuções: cada um lê as suas (menos as colunas internas) e apaga as que já pararam.
grant select (id, company_id, member_id, recipe_id, custom_recipe_id, request, team, plan, status, cursor, outputs,
  results, result, duration_ms, estimate_cents, created_at, updated_at, finished_at)
  on table public.runs to authenticated;
grant delete on table public.runs to authenticated;

create policy runs_select_own on public.runs
  for select to authenticated
  using (member_id = (select private.current_member_id()));

create policy runs_delete_own on public.runs
  for delete to authenticated
  using (
    member_id = (select private.current_member_id())
    and status in ('paused', 'finished', 'failed', 'cancelled')
  );

grant select on table public.run_events to authenticated;

create policy run_events_select_own on public.run_events
  for select to authenticated
  using (
    exists (
      select 1 from public.runs r
      where r.id = run_events.run_id and r.member_id = (select private.current_member_id())
    )
  );

-- Conversas: só de quem é. A sessão cria, renomeia e apaga.
grant select, delete on table public.conversations to authenticated;
grant insert (title), update (title) on table public.conversations to authenticated;

create policy conversations_select_own on public.conversations
  for select to authenticated
  using (member_id = (select private.current_member_id()));

create policy conversations_insert_own on public.conversations
  for insert to authenticated
  with check (
    company_id = (select private.current_company_id()) and member_id = (select private.current_member_id())
  );

create policy conversations_update_own on public.conversations
  for update to authenticated
  using (member_id = (select private.current_member_id()))
  with check (member_id = (select private.current_member_id()));

create policy conversations_delete_own on public.conversations
  for delete to authenticated
  using (member_id = (select private.current_member_id()));

-- Tarefas: só de quem é. A sessão lê e apaga; quem grava é o servidor.
grant select, delete on table public.tasks to authenticated;

create policy tasks_select_own on public.tasks
  for select to authenticated
  using (member_id = (select private.current_member_id()));

create policy tasks_delete_own on public.tasks
  for delete to authenticated
  using (member_id = (select private.current_member_id()));

-- Arquivos: cada um vê os seus; o dono vê também as entregas de todos da empresa (não os arquivos enviados).
-- Apagar pela sessão tira só o registro; o servidor apaga o conteúdo na pasta fechada.
grant select, delete on table public.files to authenticated;

create policy files_select on public.files
  for select to authenticated
  using (
    company_id = (select private.current_company_id())
    and (
      member_id = (select private.current_member_id())
      or (kind = 'delivery' and (select private.current_member_is_owner()))
    )
  );

create policy files_delete_own on public.files
  for delete to authenticated
  using (member_id = (select private.current_member_id()));

revoke execute on all functions in schema private from public;
