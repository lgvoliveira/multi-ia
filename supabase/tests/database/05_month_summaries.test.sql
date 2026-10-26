-- Teste das contas do mês (parte 3d): o crédito da empresa, o gasto do mês por pessoa e por IA, e o extrato do mês com
-- cada receita numa linha só. Confere as somas e que cada um soma só o que pode ver: o dono, a empresa dele; o
-- funcionário, só o que é dele; ninguém, outra empresa.
begin;
create extension if not exists pgtap with schema extensions;
select plan(26);

create schema tests;
create function tests.login_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
end;
$$;
create function tests.login_as_anon() returns void language plpgsql as $$
begin
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '{"role": "anon"}', true);
end;
$$;
grant usage on schema tests to anon, authenticated, service_role;
grant execute on all functions in schema tests to anon, authenticated, service_role;

-- Pessoas: 11 dona A · 12 funcionária A · 13 funcionário A · 14 funcionário A desativado · 21 dono B
insert into auth.users (id, email)
values
  ('00000000-0000-4000-8000-000000000011', 'dona.a@example.com'),
  ('00000000-0000-4000-8000-000000000012', 'func1.a@example.com'),
  ('00000000-0000-4000-8000-000000000013', 'func2.a@example.com'),
  ('00000000-0000-4000-8000-000000000014', 'saiu.a@example.com'),
  ('00000000-0000-4000-8000-000000000021', 'dono.b@example.com');

insert into public.companies (id, name)
values
  ('0000000a-0000-4000-8000-000000000000', 'Empresa A'),
  ('0000000b-0000-4000-8000-000000000000', 'Empresa B');

insert into public.members (id, company_id, user_id, name, email, role, monthly_budget_cents, status)
values
  ('10000000-0000-4000-8000-000000000011', '0000000a-0000-4000-8000-000000000000',
    '00000000-0000-4000-8000-000000000011', 'Dona A', 'dona.a@example.com', 'owner', null, 'active'),
  ('10000000-0000-4000-8000-000000000012', '0000000a-0000-4000-8000-000000000000',
    '00000000-0000-4000-8000-000000000012', 'Func 1 A', 'func1.a@example.com', 'employee', 5000, 'active'),
  ('10000000-0000-4000-8000-000000000013', '0000000a-0000-4000-8000-000000000000',
    '00000000-0000-4000-8000-000000000013', 'Func 2 A', 'func2.a@example.com', 'employee', null, 'active'),
  ('10000000-0000-4000-8000-000000000014', '0000000a-0000-4000-8000-000000000000',
    '00000000-0000-4000-8000-000000000014', 'Saiu A', 'saiu.a@example.com', 'employee', null, 'disabled'),
  ('10000000-0000-4000-8000-000000000021', '0000000b-0000-4000-8000-000000000000',
    '00000000-0000-4000-8000-000000000021', 'Dono B', 'dono.b@example.com', 'owner', null, 'active');

-- ---------- O dinheiro do mês, lançado como o servidor lança ----------
-- Empresa A: R$ 100,00 de recarga e R$ 1,00 de ajuste da empresa (sem pessoa).
select private.wallet_topup('0000000a-0000-4000-8000-000000000000', 10000, 'Pix A');
select private.wallet_adjust('0000000a-0000-4000-8000-000000000000', 100, 'Bônus de boas-vindas');

-- Func 1: uma receita (R1) com três etapas, duas mensagens do chat (T1, T2) e uma devolução de 4 centavos.
select set_config('tests.h1',
  public.wallet_reserve('10000000-0000-4000-8000-000000000012', 100, '60000000-0000-4000-8000-0000000000a1')::text, true);
select public.wallet_charge(current_setting('tests.h1')::uuid, 10, 'Criar um site · Chefe', 'claude');
select public.wallet_charge(current_setting('tests.h1')::uuid, 20, 'Criar um site · Front-end', 'gpt');
select public.wallet_charge(current_setting('tests.h1')::uuid, 5, 'Criar um site · Revisor', 'gemini');
select public.wallet_close_hold(current_setting('tests.h1')::uuid);

select set_config('tests.h2', public.wallet_reserve('10000000-0000-4000-8000-000000000012', 10, null,
  '70000000-0000-4000-8000-0000000000b1')::text, true);
select public.wallet_charge(current_setting('tests.h2')::uuid, 3, 'Tarefa rápida · Resposta', 'claude');
select public.wallet_close_hold(current_setting('tests.h2')::uuid);

select set_config('tests.h3', public.wallet_reserve('10000000-0000-4000-8000-000000000012', 10, null,
  '70000000-0000-4000-8000-0000000000b2')::text, true);
select public.wallet_charge(current_setting('tests.h3')::uuid, 2, 'Tarefa rápida · Documento', 'gpt');
select public.wallet_close_hold(current_setting('tests.h3')::uuid);

select private.wallet_adjust('0000000a-0000-4000-8000-000000000000', 4, 'Devolução: etapa com problema',
  '10000000-0000-4000-8000-000000000012');

-- Func 2: uma mensagem (T3) e uma receita em andamento (R2), com R$ 0,30 cobrados e R$ 0,70 ainda reservados.
select set_config('tests.h4', public.wallet_reserve('10000000-0000-4000-8000-000000000013', 10, null,
  '70000000-0000-4000-8000-0000000000b3')::text, true);
select public.wallet_charge(current_setting('tests.h4')::uuid, 7, 'Tarefa rápida · Resposta', 'gemini');
select public.wallet_close_hold(current_setting('tests.h4')::uuid);

select set_config('tests.h5',
  public.wallet_reserve('10000000-0000-4000-8000-000000000013', 100, '60000000-0000-4000-8000-0000000000a2')::text, true);
select public.wallet_charge(current_setting('tests.h5')::uuid, 30, 'Criar um site · Chefe', 'claude');

-- Uma reserva esquecida aberta, já vencida: não segura mais o saldo.
insert into public.wallet_holds (company_id, member_id, amount_cents, expires_at, created_at)
values ('0000000a-0000-4000-8000-000000000000', '10000000-0000-4000-8000-000000000013', 500,
  now() - interval '1 minute', now() - interval '2 hours');

-- Um gasto do mês passado da func 1 (R$ 9,00): entra no saldo, mas não no gasto deste mês.
insert into public.wallet_entries (company_id, kind, amount_cents, member_id, hold_id, description, created_at)
values ('0000000a-0000-4000-8000-000000000000', 'charge', -900, '10000000-0000-4000-8000-000000000012',
  current_setting('tests.h1')::uuid, 'Gasto do mês passado', private.month_start(now()) - interval '1 second');

-- Empresa B: R$ 50,00 e uma mensagem do dono.
select private.wallet_topup('0000000b-0000-4000-8000-000000000000', 5000, 'Pix B');
select set_config('tests.h6', public.wallet_reserve('10000000-0000-4000-8000-000000000021', 100, null,
  '70000000-0000-4000-8000-0000000000b4')::text, true);
select public.wallet_charge(current_setting('tests.h6')::uuid, 50, 'Tarefa rápida · Resposta', 'claude');
select public.wallet_close_hold(current_setting('tests.h6')::uuid);

-- Arquivos da func 1: uma entrega deste mês, uma do mês passado e um anexo (anexo não é entrega).
insert into public.files (company_id, member_id, kind, name, storage_path, created_at)
values
  ('0000000a-0000-4000-8000-000000000000', '10000000-0000-4000-8000-000000000012', 'delivery', 'site.html',
    '0000000a-0000-4000-8000-000000000000/12/site.html', now()),
  ('0000000a-0000-4000-8000-000000000000', '10000000-0000-4000-8000-000000000012', 'delivery', 'antigo.pdf',
    '0000000a-0000-4000-8000-000000000000/12/antigo.pdf', private.month_start(now()) - interval '1 day'),
  ('0000000a-0000-4000-8000-000000000000', '10000000-0000-4000-8000-000000000012', 'upload', 'planilha.csv',
    '0000000a-0000-4000-8000-000000000000/12/planilha.csv', now());

-- Contas da empresa A:
--   saldo     10000 + 100 - (10 + 20 + 5) - 3 - 2 + 4 - 7 - 30 - 900 = 9127
--   reservado 100 - 30 = 70 (a reserva vencida não conta)
--   gasto do mês das pessoas: func 1 = 35 + 3 + 2 - 4 = 36; func 2 = 7 + 30 = 37; total 73

-- ---------- Como a dona da empresa A ----------
select tests.login_as('00000000-0000-4000-8000-000000000011');

select results_eq(
  $$ select balance_cents, reserved_cents, month_spent_cents from public.company_credit() $$,
  $$ values (9127::bigint, 70::bigint, 73::bigint) $$,
  'A dona vê o saldo (o extrato inteiro), o reservado agora e o gasto das pessoas neste mês'
);

select results_eq(
  $$ select provider, spent_cents from public.company_month_by_provider() $$,
  $$ values ('claude'::text, 43::bigint), ('gemini', 12), ('gpt', 22), (null, -4) $$,
  'O gasto do mês por IA, com os ajustes numa linha sem IA'
);

select is(
  (select sum(spent_cents) from public.company_month_by_provider()),
  (select month_spent_cents from public.company_credit())::numeric,
  'A soma por IA bate com o gasto do mês da empresa'
);

select results_eq(
  $$ select member_id, spent_cents, reserved_cents, quick_tasks, recipes, deliveries
     from public.member_month_summary() order by member_id $$,
  $$ values
       ('10000000-0000-4000-8000-000000000011'::uuid, 0::bigint, 0::bigint, 0, 0, 0),
       ('10000000-0000-4000-8000-000000000012'::uuid, 36::bigint, 0::bigint, 2, 1, 1),
       ('10000000-0000-4000-8000-000000000013'::uuid, 37::bigint, 70::bigint, 1, 1, 0),
       ('10000000-0000-4000-8000-000000000014'::uuid, 0::bigint, 0::bigint, 0, 0, 0) $$,
  'O mês de cada pessoa: gasto, reservado, mensagens, receitas e entregas (o mês passado e os anexos ficam de fora)'
);

select is(
  (select sum(spent_cents) from public.member_month_summary()),
  (select month_spent_cents from public.company_credit())::numeric,
  'A soma do gasto das pessoas bate com o gasto do mês da empresa'
);

select results_eq(
  $$ select spent_cents from public.member_month_summary('10000000-0000-4000-8000-000000000013') $$,
  $$ values (37::bigint) $$,
  'Com uma pessoa escolhida, só ela'
);

select results_eq(
  $$ select count(*)::integer, sum(amount_cents)::bigint from public.month_statement() $$,
  $$ values (8, 10027::bigint) $$,
  'O extrato do mês da empresa: a recarga, o ajuste, cada receita numa linha e cada mensagem numa linha'
);

select results_eq(
  $$ select kind, member_id, description, providers, amount_cents from public.month_statement()
     where run_id = '60000000-0000-4000-8000-0000000000a1' $$,
  $$ values ('charge'::text, '10000000-0000-4000-8000-000000000012'::uuid, 'Criar um site'::text,
       '{claude,gemini,gpt}'::text[], -35::bigint) $$,
  'Uma receita vira uma linha só: o nome da receita, as IAs que trabalharam e o total das etapas'
);

select results_eq(
  $$ select kind, task_id, description, providers, amount_cents from public.month_statement()
     where task_id = '70000000-0000-4000-8000-0000000000b2' $$,
  $$ values ('charge'::text, '70000000-0000-4000-8000-0000000000b2'::uuid, 'Tarefa rápida · Documento'::text,
       '{gpt}'::text[], -2::bigint) $$,
  'Uma mensagem do chat vem como está, com a IA que respondeu'
);

select results_eq(
  $$ select kind, member_id, description, amount_cents from public.month_statement() where kind = 'topup' $$,
  $$ values ('topup'::text, null::uuid, 'Pix A'::text, 10000::bigint) $$,
  'A recarga aparece no extrato do mês, sem pessoa'
);

select is_empty(
  $$ select 1 from public.month_statement() where description = 'Gasto do mês passado' $$,
  'O gasto do mês passado não aparece no extrato do mês'
);

select results_eq(
  $$ select count(*)::integer, sum(amount_cents)::bigint
     from public.month_statement('10000000-0000-4000-8000-000000000012') $$,
  $$ values (4, -36::bigint) $$,
  'O que a func 1 fez no mês: a receita, as duas mensagens e a devolução'
);

select results_eq(
  $$ select entry_id from public.month_statement(null, 2) $$,
  $$ select entry_id from public.month_statement() limit 2 $$,
  'Com limite, vêm só as linhas mais recentes'
);

-- ---------- Como a func 1 ----------
select tests.login_as('00000000-0000-4000-8000-000000000012');

select is_empty($$ select * from public.company_credit() $$, 'O funcionário não vê o saldo da empresa');
select is_empty($$ select * from public.company_month_by_provider() $$,
  'O funcionário não vê o gasto da empresa por IA');

select results_eq(
  $$ select member_id, spent_cents, quick_tasks, recipes, deliveries from public.member_month_summary() $$,
  $$ values ('10000000-0000-4000-8000-000000000012'::uuid, 36::bigint, 2, 1, 1) $$,
  'O funcionário soma só o próprio mês'
);

select is_empty($$ select * from public.member_month_summary('10000000-0000-4000-8000-000000000013') $$,
  'O funcionário não soma o mês do colega');

select results_eq(
  $$ select count(*)::integer, sum(amount_cents)::bigint from public.month_statement() $$,
  $$ values (4, -36::bigint) $$,
  'O extrato do funcionário tem só as linhas dele (sem a recarga nem o ajuste da empresa)'
);

select is_empty($$ select * from public.month_statement('10000000-0000-4000-8000-000000000013') $$,
  'O funcionário não lê o extrato do colega');

-- ---------- Como o dono da empresa B ----------
select tests.login_as('00000000-0000-4000-8000-000000000021');

select results_eq(
  $$ select balance_cents, reserved_cents, month_spent_cents from public.company_credit() $$,
  $$ values (4950::bigint, 0::bigint, 50::bigint) $$,
  'O dono de outra empresa vê só o crédito da empresa dele'
);

select is_empty($$ select * from public.member_month_summary('10000000-0000-4000-8000-000000000012') $$,
  'O dono de outra empresa não soma o mês de quem não é da empresa dele');

select is_empty($$ select * from public.month_statement('10000000-0000-4000-8000-000000000012') $$,
  'O dono de outra empresa não lê o extrato de quem não é da empresa dele');

-- ---------- Quem foi desativado ----------
select tests.login_as('00000000-0000-4000-8000-000000000014');

select ok(
  not exists (select 1 from public.member_month_summary())
    and not exists (select 1 from public.month_statement()),
  'Quem foi desativado não soma nada'
);

-- ---------- Sem login, e o servidor ----------
select tests.login_as_anon();

select throws_ok($$ select * from public.company_credit() $$, '42501', null,
  'Sem login, ninguém chama as contas do mês');
select throws_ok($$ select * from public.month_statement() $$, '42501', null,
  'Sem login, ninguém lê o extrato do mês');

reset role;
select set_config('role', 'service_role', true);

select throws_ok($$ select * from public.member_month_summary() $$, '42501', null,
  'O servidor (sem login) também não chama: as contas são só para quem está logado');

select * from finish();
rollback;
