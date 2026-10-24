-- Empresas e pessoas.
--
-- Toda linha do banco pertence a uma empresa (company_id). As regras de acesso (RLS) deixam cada pessoa logada
-- ver só o que é da empresa dela. Login e senha ficam no Supabase Auth (auth.users); aqui só registramos a que
-- empresa cada login pertence e com qual papel.
--
-- Regra de todas as migrações: cada tabela liga o RLS e diz, com "grant", exatamente o que cada papel pode fazer.
--   anon           a chave pública sem login: nunca recebe acesso a tabela nenhuma
--   authenticated  quem está logado: só o que as regras de acesso deixarem
--   service_role   o nosso servidor (chave-mestra): passa por cima das regras, mas só faz o que recebeu aqui
-- O projeto foi criado sem acesso automático a tabelas novas; os "revoke" deixam isso explícito também no banco
-- local e nas checagens do GitHub.

-- Esquema fechado, fora da API: funções auxiliares que as regras de acesso usam.
create schema private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  created_at timestamptz not null default now()
);

create table public.members (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete restrict,
  -- O login no Supabase Auth. Fica vazio se o login for apagado: a pessoa continua no extrato (F23).
  -- No MVP, cada login pertence a uma empresa só (unique).
  user_id uuid unique references auth.users (id) on delete set null,
  name text not null check (char_length(name) between 1 and 120),
  email text not null check (char_length(email) between 3 and 254 and email = lower(email)),
  role text not null check (role in ('owner', 'employee')),
  -- Teto de gasto por mês, em centavos de real. Vazio = sem teto. Renova todo dia 1º (horário de Brasília).
  monthly_budget_cents bigint check (monthly_budget_cents >= 0),
  -- Quem sai da empresa é desativado, nunca apagado: perde o acesso na hora, mas o extrato guarda o que gastou.
  status text not null default 'active' check (status in ('active', 'disabled')),
  created_at timestamptz not null default now(),
  unique (company_id, email),
  -- Deixa as outras tabelas exigirem que a pessoa seja da mesma empresa da linha (chave estrangeira dupla).
  unique (id, company_id)
);

-- Quem está logado, visto pelo banco. Rodam como dono das tabelas (security definer) para as regras de acesso
-- poderem consultar members sem cair nas próprias regras. Pessoa desativada não tem empresa nem cadastro.
create function private.current_member_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.id from public.members m where m.user_id = (select auth.uid()) and m.status = 'active'
$$;

create function private.current_company_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.company_id from public.members m where m.user_id = (select auth.uid()) and m.status = 'active'
$$;

create function private.current_member_is_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select m.role = 'owner' from public.members m where m.user_id = (select auth.uid()) and m.status = 'active'),
    false
  )
$$;

revoke execute on all functions in schema private from public;
grant execute on function private.current_member_id(), private.current_company_id(),
  private.current_member_is_owner() to authenticated, service_role;

-- Regras de acesso. "(select ...)" faz o banco calcular a função uma vez por consulta, não uma vez por linha.
alter table public.companies enable row level security;
alter table public.members enable row level security;

revoke all on table public.companies, public.members from public, anon, authenticated, service_role;

grant select on table public.companies to authenticated;
grant select, insert on table public.companies to service_role;
grant update (name) on table public.companies to service_role;

create policy companies_select_own on public.companies
  for select to authenticated
  using (id = (select private.current_company_id()));

-- Funcionário vê só o próprio cadastro; o dono vê todos da empresa.
grant select on table public.members to authenticated;
-- O dono muda nome, teto e situação (ativo/desativado) dos funcionários. Papel, empresa e login não mudam por aqui.
grant update (name, monthly_budget_cents, status) on table public.members to authenticated;
-- O servidor cria as pessoas (no convite) e liga o login. Ninguém apaga (F23).
grant select, insert on table public.members to service_role;
grant update (user_id, name, email, role, monthly_budget_cents, status) on table public.members to service_role;

create policy members_select on public.members
  for select to authenticated
  using (
    company_id = (select private.current_company_id())
    and (id = (select private.current_member_id()) or (select private.current_member_is_owner()))
  );

create policy members_update_by_owner on public.members
  for update to authenticated
  using (
    company_id = (select private.current_company_id())
    and role = 'employee'
    and (select private.current_member_is_owner())
  )
  with check (company_id = (select private.current_company_id()) and role = 'employee');
