-- Convites dos funcionários (etapa 5, PR 2b; decisão do Luis, 24/10/2026: convite por link para copiar).
--
-- O dono convida pelo painel. O servidor cria o login do funcionário (ainda sem senha), a pessoa em members e um
-- convite aqui. O link que o dono manda (ex.: pelo WhatsApp) leva um código aleatório; aqui fica só o resumo dele
-- (sha256), então quem lê esta tabela não consegue montar o link. O código vale 24 horas e uma vez só: ao aceitar, o
-- servidor apaga a linha na mesma operação em que confere o código. Um link novo para a mesma pessoa troca o código,
-- e o link antigo para de valer (uma linha por pessoa).
--
-- kind: 'invite' (a pessoa ainda não criou a senha) ou 'reset' (já criou e precisa de uma senha nova).

create table public.member_invites (
  member_id uuid primary key,
  company_id uuid not null,
  kind text not null check (kind in ('invite', 'reset')),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  -- O convite é sempre da mesma empresa da pessoa (chave estrangeira dupla, como nas outras tabelas).
  foreign key (member_id, company_id) references public.members (id, company_id) on delete cascade
);

create index member_invites_company_idx on public.member_invites (company_id);

alter table public.member_invites enable row level security;

revoke all on table public.member_invites from public, anon, authenticated, service_role;

-- O dono vê os convites da empresa (para mostrar "convite pendente" e até quando vale), mas nunca o resumo do código.
grant select (member_id, company_id, kind, expires_at, created_at) on table public.member_invites to authenticated;

create policy member_invites_select_by_owner on public.member_invites
  for select to authenticated
  using (company_id = (select private.current_company_id()) and (select private.current_member_is_owner()));

-- Só o servidor cria, troca e apaga convites (ninguém pela sessão).
grant select, insert, update, delete on table public.member_invites to service_role;
