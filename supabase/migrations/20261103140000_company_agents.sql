-- Agentes prontos da EMPRESA (Fase 2): o dono cria assistentes de IA próprios da empresa, que aparecem na prateleira do
-- funcionário junto com os de fábrica. Diferente dos de fábrica (persona no código, lib/ock/agent-persona.ts), aqui a
-- persona e o conhecimento vêm escritos pelo dono e ficam no banco.
--
-- Quem lê, pela sessão, vê só as colunas de VITRINE (nome, função, chamada, perguntas de partida) — nunca a persona nem
-- o conhecimento, que são a "instrução da IA" (como as outras instruções, lib/ock/quick-task.ts): essas só o servidor lê,
-- pela chave-mestra, na hora de responder. Só o dono cria e apaga, e sempre pelo servidor (nunca pela sessão).

create table public.company_agents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  role text not null check (char_length(role) between 1 and 60),
  -- A linha do cartão (vitrine).
  tagline text not null check (char_length(tagline) between 1 and 160),
  -- Como o agente deve agir (instrução da IA) e o que ele sempre deve saber da empresa (opcional). SÓ do servidor.
  persona text not null check (char_length(persona) between 1 and 4000),
  knowledge text check (knowledge is null or char_length(knowledge) <= 8000),
  -- Perguntas de partida (vitrine), no máximo 6.
  starters text[] not null default '{}' check (array_length(starters, 1) is null or array_length(starters, 1) <= 6),
  created_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (id, company_id)
);

create index company_agents_company_idx on public.company_agents (company_id, created_at desc);

alter table public.company_agents enable row level security;

revoke all on table public.company_agents from public, anon, authenticated, service_role;

-- Pela sessão, qualquer pessoa da empresa vê a VITRINE dos agentes dela (para a prateleira). Nunca persona nem conhecimento.
grant select (id, company_id, name, role, tagline, starters, created_at) on table public.company_agents to authenticated;

create policy company_agents_select_own_company on public.company_agents
  for select to authenticated
  using (company_id = (select private.current_company_id()));

-- Criar e apagar é só pelo servidor (a action confere que quem pede é o dono da empresa). A empresa vem do login, não do
-- formulário. O servidor também lê a persona/conhecimento por aqui, na hora de responder.
grant select, insert, update, delete on table public.company_agents to service_role;
