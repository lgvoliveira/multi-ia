-- A carteira da empresa, como um extrato.
--
-- Cada movimento é uma linha de wallet_entries que nunca é apagada nem editada: recarga (+), gasto (-) ou
-- ajuste (+/-). O saldo é a soma das linhas. Antes de uma execução ou tarefa, uma reserva (wallet_holds) separa o
-- valor estimado; cada etapa concluída vira uma linha de gasto; no fim a reserva fecha e o que sobrou volta a ficar
-- disponível sozinho, porque nunca saiu do extrato.
--
-- O dinheiro só se mexe pelas funções abaixo, que travam a carteira da empresa enquanto conferem e lançam. Assim
-- dois pedidos ao mesmo tempo não gastam o mesmo real (F24). Nem o nosso servidor grava direto nestas tabelas.
--   wallet_reserve, wallet_charge, wallet_close_hold  o servidor chama (chave-mestra)
--   private.wallet_topup, private.wallet_adjust       só pelo painel do Supabase, depois de receber o Pix (F25)
-- Valores em centavos de real.

create table public.wallet_holds (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete restrict,
  member_id uuid not null,
  -- Valor reservado e quanto dele já foi cobrado. A cobrança pode passar do reservado: o consumo da IA já
  -- aconteceu e a plataforma não absorve a diferença. Quem confere antes da próxima etapa é o servidor.
  amount_cents bigint not null check (amount_cents >= 0),
  charged_cents bigint not null default 0 check (charged_cents >= 0),
  status text not null default 'open' check (status in ('open', 'closed')),
  run_id uuid,
  task_id uuid,
  -- Reserva esquecida aberta (servidor caiu) deixa de segurar o saldo depois deste horário.
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  foreign key (member_id, company_id) references public.members (id, company_id) on delete restrict,
  check ((status = 'closed') = (closed_at is not null))
);

create index wallet_holds_open_company_idx on public.wallet_holds (company_id) where status = 'open';
create index wallet_holds_open_member_idx on public.wallet_holds (member_id) where status = 'open';

create table public.wallet_entries (
  id bigint generated always as identity primary key,
  company_id uuid not null references public.companies (id) on delete restrict,
  kind text not null check (kind in ('topup', 'charge', 'adjustment')),
  amount_cents bigint not null,
  -- Quem gastou (vazio nas recargas e nos ajustes da empresa).
  member_id uuid,
  hold_id uuid references public.wallet_holds (id) on delete restrict,
  -- De onde veio o gasto. Sem chave estrangeira de propósito: quem apaga uma execução ou tarefa (LGPD) apaga o
  -- conteúdo, mas a linha "gastou R$ X em tal dia" fica, porque é registro financeiro da empresa.
  run_id uuid,
  task_id uuid,
  provider text check (provider in ('claude', 'gpt', 'gemini')),
  -- Escrita pelo servidor, nunca com o pedido do funcionário: "Criar um site · Programador", "Pix de 24/10".
  -- É o que o dono lê para saber o que cada um fez (decisão 2 do Luis, 24/10/2026).
  description text not null check (char_length(description) between 1 and 200),
  created_at timestamptz not null default now(),
  foreign key (member_id, company_id) references public.members (id, company_id) on delete restrict,
  check (
    (kind = 'topup' and amount_cents > 0 and member_id is null and hold_id is null)
    or (kind = 'charge' and amount_cents < 0 and member_id is not null and hold_id is not null)
    or (kind = 'adjustment' and amount_cents <> 0 and hold_id is null)
  )
);

create index wallet_entries_company_idx on public.wallet_entries (company_id, created_at);
create index wallet_entries_member_idx on public.wallet_entries (member_id, created_at);
create index wallet_entries_hold_idx on public.wallet_entries (hold_id);

-- O extrato só aceita linhas novas. Para corrigir um lançamento, lança-se um ajuste.
create function private.forbid_wallet_entry_changes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'wallet_entries_append_only'
    using hint = 'O extrato não pode ser editado nem apagado. Para corrigir, lance um ajuste (private.wallet_adjust).';
end;
$$;

create trigger wallet_entries_no_update_delete
  before update or delete on public.wallet_entries
  for each row execute function private.forbid_wallet_entry_changes();

create trigger wallet_entries_no_truncate
  before truncate on public.wallet_entries
  for each statement execute function private.forbid_wallet_entry_changes();

-- Primeiro instante do mês de p_at no horário de Brasília. O teto do funcionário conta a partir daqui.
create function private.month_start(p_at timestamptz)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select date_trunc('month', p_at at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo'
$$;

-- O que ainda falta cobrar das reservas abertas e não vencidas.
create function private.open_holds_remaining_cents(p_company_id uuid, p_member_id uuid default null)
returns bigint
language sql
stable
set search_path = ''
as $$
  select coalesce(sum(greatest(h.amount_cents - h.charged_cents, 0)), 0)::bigint
  from public.wallet_holds h
  where h.company_id = p_company_id
    and (p_member_id is null or h.member_id = p_member_id)
    and h.status = 'open'
    and h.expires_at > now()
$$;

-- Saldo disponível: o extrato inteiro menos o que está reservado.
create function private.company_available_cents(p_company_id uuid)
returns bigint
language sql
stable
set search_path = ''
as $$
  select
    coalesce((select sum(e.amount_cents) from public.wallet_entries e where e.company_id = p_company_id), 0)::bigint
    - private.open_holds_remaining_cents(p_company_id)
$$;

-- Quanto o funcionário já usou do teto neste mês: gastos e ajustes dele desde o dia 1º, mais o que está reservado.
create function private.member_month_used_cents(p_company_id uuid, p_member_id uuid)
returns bigint
language sql
stable
set search_path = ''
as $$
  select
    coalesce((
      select -sum(e.amount_cents)
      from public.wallet_entries e
      where e.member_id = p_member_id
        and e.kind in ('charge', 'adjustment')
        and e.created_at >= private.month_start(now())
    ), 0)::bigint
    + private.open_holds_remaining_cents(p_company_id, p_member_id)
$$;

-- Trava a carteira da empresa até o fim da transação. Outras funções de dinheiro da mesma empresa esperam.
create function private.lock_wallet(p_company_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform 1 from public.companies c where c.id = p_company_id for update;
  if not found then
    raise exception 'company_not_found';
  end if;
end;
$$;

-- Reserva o valor estimado antes de uma execução ou tarefa. Confere, numa operação só, se o funcionário está ativo,
-- se a empresa tem saldo e se ele não passa do teto do mês. Devolve o id da reserva.
create function public.wallet_reserve(
  p_member_id uuid,
  p_amount_cents bigint,
  p_run_id uuid default null,
  p_task_id uuid default null,
  p_ttl interval default interval '1 hour'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company_id uuid;
  v_member public.members%rowtype;
  v_hold_id uuid;
begin
  if p_amount_cents is null or p_amount_cents < 0 then
    raise exception 'invalid_amount';
  end if;
  if p_ttl is null or p_ttl <= interval '0' or p_ttl > interval '1 day' then
    raise exception 'invalid_ttl';
  end if;

  select m.company_id into v_company_id from public.members m where m.id = p_member_id;
  if not found then
    raise exception 'member_not_found';
  end if;

  perform private.lock_wallet(v_company_id);

  -- Lido de novo depois da trava, para valer o teto e a situação deste instante.
  select * into v_member from public.members m where m.id = p_member_id;
  if v_member.status <> 'active' then
    raise exception 'member_inactive' using hint = 'Esta pessoa foi desativada pela empresa.';
  end if;

  if private.company_available_cents(v_company_id) < p_amount_cents then
    raise exception 'insufficient_balance' using hint = 'A empresa não tem saldo para esta reserva.';
  end if;

  if v_member.monthly_budget_cents is not null
    and private.member_month_used_cents(v_company_id, v_member.id) + p_amount_cents > v_member.monthly_budget_cents
  then
    raise exception 'monthly_budget_exceeded' using hint = 'Esta reserva passaria do teto do mês da pessoa.';
  end if;

  insert into public.wallet_holds (company_id, member_id, amount_cents, run_id, task_id, expires_at)
  values (v_company_id, v_member.id, p_amount_cents, p_run_id, p_task_id, now() + p_ttl)
  returning id into v_hold_id;

  return v_hold_id;
end;
$$;

-- Cobra o consumo real de uma etapa ou tarefa concluída, dentro de uma reserva aberta. Cobrança zero não vira
-- linha. Devolve quanto ainda sobra da reserva; negativo quer dizer que o custo já passou da estimativa.
create function public.wallet_charge(
  p_hold_id uuid,
  p_amount_cents bigint,
  p_description text,
  p_provider text default null,
  p_run_id uuid default null,
  p_task_id uuid default null
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company_id uuid;
  v_hold public.wallet_holds%rowtype;
begin
  if p_amount_cents is null or p_amount_cents < 0 then
    raise exception 'invalid_amount';
  end if;

  select h.company_id into v_company_id from public.wallet_holds h where h.id = p_hold_id;
  if not found then
    raise exception 'hold_not_found';
  end if;

  perform private.lock_wallet(v_company_id);

  select * into v_hold from public.wallet_holds h where h.id = p_hold_id;
  if v_hold.status <> 'open' then
    raise exception 'hold_closed';
  end if;

  if p_amount_cents > 0 then
    insert into public.wallet_entries
      (company_id, kind, amount_cents, member_id, hold_id, run_id, task_id, provider, description)
    values (
      v_hold.company_id, 'charge', -p_amount_cents, v_hold.member_id, v_hold.id,
      coalesce(p_run_id, v_hold.run_id), coalesce(p_task_id, v_hold.task_id), p_provider, p_description
    );

    update public.wallet_holds h set charged_cents = h.charged_cents + p_amount_cents where h.id = v_hold.id;
  end if;

  return v_hold.amount_cents - v_hold.charged_cents - p_amount_cents;
end;
$$;

-- Fecha a reserva: o que não foi cobrado volta a ficar disponível. Fechar de novo não faz nada.
-- Devolve o total cobrado nela.
create function public.wallet_close_hold(p_hold_id uuid)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_company_id uuid;
  v_charged bigint;
begin
  select h.company_id into v_company_id from public.wallet_holds h where h.id = p_hold_id;
  if not found then
    raise exception 'hold_not_found';
  end if;

  perform private.lock_wallet(v_company_id);

  update public.wallet_holds h
  set status = 'closed', closed_at = now()
  where h.id = p_hold_id and h.status = 'open';

  select h.charged_cents into v_charged from public.wallet_holds h where h.id = p_hold_id;
  return v_charged;
end;
$$;

-- Recarga, depois de receber o Pix. Só pelo painel do Supabase (editor de SQL), nunca pelas telas nem pelo
-- servidor (F25). Exemplo: select private.wallet_topup('<id da empresa>', 20000, 'Pix de 24/10');
-- Devolve o saldo novo.
create function private.wallet_topup(p_company_id uuid, p_amount_cents bigint, p_description text)
returns bigint
language plpgsql
set search_path = ''
as $$
begin
  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'invalid_amount';
  end if;

  perform private.lock_wallet(p_company_id);

  insert into public.wallet_entries (company_id, kind, amount_cents, description)
  values (p_company_id, 'topup', p_amount_cents, p_description);

  return (select sum(e.amount_cents) from public.wallet_entries e where e.company_id = p_company_id)::bigint;
end;
$$;

-- Ajuste (+ devolve, - cobra), para corrigir um lançamento. Com p_member_id, conta no teto do mês da pessoa.
-- Mesmas regras da recarga: só pelo painel do Supabase. Devolve o saldo novo.
create function private.wallet_adjust(
  p_company_id uuid,
  p_amount_cents bigint,
  p_description text,
  p_member_id uuid default null
)
returns bigint
language plpgsql
set search_path = ''
as $$
begin
  if p_amount_cents is null or p_amount_cents = 0 then
    raise exception 'invalid_amount';
  end if;

  perform private.lock_wallet(p_company_id);

  insert into public.wallet_entries (company_id, kind, amount_cents, member_id, description)
  values (p_company_id, 'adjustment', p_amount_cents, p_member_id, p_description);

  return (select sum(e.amount_cents) from public.wallet_entries e where e.company_id = p_company_id)::bigint;
end;
$$;

-- Quem pode chamar cada função. No esquema public, o Supabase daria acesso a todos os papéis; aqui, só o servidor.
revoke execute on function
  public.wallet_reserve(uuid, bigint, uuid, uuid, interval),
  public.wallet_charge(uuid, bigint, text, text, uuid, uuid),
  public.wallet_close_hold(uuid)
from public, anon, authenticated;

grant execute on function
  public.wallet_reserve(uuid, bigint, uuid, uuid, interval),
  public.wallet_charge(uuid, bigint, text, text, uuid, uuid),
  public.wallet_close_hold(uuid)
to service_role;

-- As funções internas, a recarga e o ajuste ficam só para o dono do banco (o painel do Supabase).
revoke execute on all functions in schema private from public;

-- Regras de acesso: o funcionário vê só os próprios gastos e reservas; o dono vê tudo da empresa.
alter table public.wallet_holds enable row level security;
alter table public.wallet_entries enable row level security;

revoke all on table public.wallet_holds, public.wallet_entries from public, anon, authenticated, service_role;
grant select on table public.wallet_holds, public.wallet_entries to authenticated, service_role;

create policy wallet_holds_select on public.wallet_holds
  for select to authenticated
  using (
    company_id = (select private.current_company_id())
    and (member_id = (select private.current_member_id()) or (select private.current_member_is_owner()))
  );

create policy wallet_entries_select on public.wallet_entries
  for select to authenticated
  using (
    company_id = (select private.current_company_id())
    and (member_id = (select private.current_member_id()) or (select private.current_member_is_owner()))
  );
