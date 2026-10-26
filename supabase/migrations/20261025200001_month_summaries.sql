-- As contas do mês, feitas dentro do banco (etapa 5, parte 3d; issue #43): o crédito da empresa, o gasto do mês por
-- pessoa e por IA, e o extrato do mês com cada receita numa linha só.
--
-- Por que no banco: o Supabase devolve no máximo 1.000 linhas por pedido, e somar no nosso servidor as linhas que
-- chegam dava um total menor que o real depois disso (F48). Aqui a soma vê o extrato inteiro.
--
-- Quem vê o quê não muda: as funções rodam com o login de quem chama (security invoker), então as regras de acesso das
-- tabelas valem dentro delas. O funcionário só soma o que é dele; o dono soma a empresa toda; ninguém soma outra
-- empresa. O saldo e o reservado da empresa só o dono recebe. Nenhuma função lê pedido, resposta ou conversa: só o
-- extrato, as reservas, a equipe e as entregas, que o dono já podia ler (decisão 2 do Luis, 24/10/2026).
--
-- O mês conta como o teto: do dia 1º, à meia-noite de Brasília (private.month_start), até agora.

-- O início do mês é uma conta pura, sem dado nenhum: quem está logado passa a poder usá-la, nas funções abaixo.
grant execute on function private.month_start(timestamptz) to authenticated;

-- O crédito da empresa, para o alto do painel do dono. Só o dono recebe a linha; os outros, nenhuma.
--   balance_cents      o saldo: a soma do extrato inteiro (recargas, gastos e ajustes, de todos os meses)
--   reserved_cents     o que está separado agora para tarefas e receitas em andamento (reservas abertas e no prazo)
--   month_spent_cents  o gasto das pessoas neste mês (gastos e ajustes delas), a mesma conta do teto de cada uma
create function public.company_credit()
returns table (balance_cents bigint, reserved_cents bigint, month_spent_cents bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    coalesce((
      select sum(e.amount_cents) from public.wallet_entries e
      where e.company_id = (select private.current_company_id())
    ), 0)::bigint,
    coalesce((
      select sum(greatest(h.amount_cents - h.charged_cents, 0)) from public.wallet_holds h
      where h.company_id = (select private.current_company_id()) and h.status = 'open' and h.expires_at > now()
    ), 0)::bigint,
    coalesce((
      select -sum(e.amount_cents) from public.wallet_entries e
      where e.company_id = (select private.current_company_id())
        and e.member_id is not null
        and e.kind in ('charge', 'adjustment')
        and e.created_at >= private.month_start(now())
    ), 0)::bigint
  where (select private.current_member_is_owner())
$$;

-- O gasto da empresa neste mês dividido por IA. Os ajustes não têm IA: vêm numa linha com provider vazio. A soma das
-- linhas é o month_spent_cents de company_credit. Só o dono recebe linhas.
create function public.company_month_by_provider()
returns table (provider text, spent_cents bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select e.provider, -sum(e.amount_cents)::bigint
  from public.wallet_entries e
  where (select private.current_member_is_owner())
    and e.company_id = (select private.current_company_id())
    and e.member_id is not null
    and e.kind in ('charge', 'adjustment')
    and e.created_at >= private.month_start(now())
  group by e.provider
  order by e.provider nulls last
$$;

-- O mês de cada pessoa que quem chama enxerga: o dono, a equipe toda; o funcionário, só ele. Com p_member_id, só aquela
-- pessoa (se quem chama puder vê-la).
--   spent_cents     gastos e ajustes dela neste mês (o que conta no teto, fora o reservado)
--   reserved_cents  o que está separado agora para o que ela tem em andamento
--   quick_tasks     mensagens do chat cobradas neste mês
--   recipes         receitas que cobraram alguma etapa neste mês
--   deliveries      entregas (arquivos feitos pelas IAs) deste mês
create function public.member_month_summary(p_member_id uuid default null)
returns table (
  member_id uuid,
  spent_cents bigint,
  reserved_cents bigint,
  quick_tasks integer,
  recipes integer,
  deliveries integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    m.id,
    coalesce((
      select -sum(e.amount_cents) from public.wallet_entries e
      where e.member_id = m.id and e.kind in ('charge', 'adjustment') and e.created_at >= private.month_start(now())
    ), 0)::bigint,
    coalesce((
      select sum(greatest(h.amount_cents - h.charged_cents, 0)) from public.wallet_holds h
      where h.member_id = m.id and h.status = 'open' and h.expires_at > now()
    ), 0)::bigint,
    (
      select count(distinct e.task_id) from public.wallet_entries e
      where e.member_id = m.id and e.kind = 'charge' and e.created_at >= private.month_start(now())
    )::integer,
    (
      select count(distinct e.run_id) from public.wallet_entries e
      where e.member_id = m.id and e.kind = 'charge' and e.created_at >= private.month_start(now())
    )::integer,
    (
      select count(*) from public.files f
      where f.member_id = m.id and f.kind = 'delivery' and f.created_at >= private.month_start(now())
    )::integer
  from public.members m
  where m.company_id = (select private.current_company_id())
    and (p_member_id is null or m.id = p_member_id)
$$;

-- O extrato do mês, das linhas mais novas para as mais antigas, com cada execução de receita numa linha só: as etapas
-- somadas, com as IAs que trabalharam e a hora da última cobrança (decisão 2 da issue #43). A descrição da receita é a
-- parte antes de " · " ("Criar um site · Front-end" vira "Criar um site"), escrita pelo nosso servidor. As outras
-- linhas (recargas, mensagens do chat, ajustes) vêm como estão. Com p_member_id, só os gastos e ajustes daquela pessoa.
-- p_limit: quantas linhas, de 1 a 500. Para saber se há mais, peça uma a mais do que vai mostrar.
--   entry_id  o número da primeira linha do extrato do grupo; serve para identificar a linha na tela
--   amount_cents  como no extrato: recarga positiva, gasto negativo
create function public.month_statement(p_member_id uuid default null, p_limit integer default 200)
returns table (
  entry_id bigint,
  kind text,
  member_id uuid,
  run_id uuid,
  task_id uuid,
  description text,
  providers text[],
  amount_cents bigint,
  created_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  with month_entries as (
    select e.* from public.wallet_entries e
    where e.company_id = (select private.current_company_id())
      and e.created_at >= private.month_start(now())
      and (p_member_id is null or e.member_id = p_member_id)
  ),
  lines as (
    select
      min(e.id) as entry_id,
      'charge'::text as kind,
      e.member_id,
      e.run_id,
      null::uuid as task_id,
      split_part((array_agg(e.description order by e.id))[1], ' · ', 1) as description,
      coalesce(array_agg(distinct e.provider) filter (where e.provider is not null), '{}'::text[]) as providers,
      sum(e.amount_cents)::bigint as amount_cents,
      max(e.created_at) as created_at
    from month_entries e
    where e.kind = 'charge' and e.run_id is not null
    group by e.member_id, e.run_id
    union all
    select
      e.id, e.kind, e.member_id, e.run_id, e.task_id, e.description,
      case when e.provider is null then '{}'::text[] else array[e.provider] end,
      e.amount_cents, e.created_at
    from month_entries e
    where not (e.kind = 'charge' and e.run_id is not null)
  )
  select * from lines l
  order by l.created_at desc, l.entry_id desc
  limit least(greatest(coalesce(p_limit, 200), 1), 500)
$$;

-- Quem pode chamar: só quem está logado (as regras de acesso decidem o que cada um soma). Nem a chave pública sem
-- login nem o servidor: o servidor não tem login, então não teria empresa nenhuma para somar.
revoke execute on function
  public.company_credit(),
  public.company_month_by_provider(),
  public.member_month_summary(uuid),
  public.month_statement(uuid, integer)
from public, anon, service_role;

grant execute on function
  public.company_credit(),
  public.company_month_by_provider(),
  public.member_month_summary(uuid),
  public.month_statement(uuid, integer)
to authenticated;
