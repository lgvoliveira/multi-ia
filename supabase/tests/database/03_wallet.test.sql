-- Teste da carteira: reserva, cobrança pelo consumo real, fechamento, teto do mês e o extrato que não muda.
-- As funções do dinheiro são chamadas como o nosso servidor (service_role), que é quem as usa de verdade.
begin;
create extension if not exists pgtap with schema extensions;
select plan(30);

create schema tests;
create function tests.as_server() returns void language plpgsql as $$
begin
  perform set_config('role', 'service_role', true);
end;
$$;
grant usage on schema tests to service_role;
grant execute on all functions in schema tests to service_role;

-- Uma empresa com R$ 20,00. Pessoas: 1 dona, 2 funcionária com teto de R$ 10,00, 3 funcionário sem teto,
-- 4 funcionário desativado.
insert into public.companies (id, name) values ('0000000c-0000-4000-8000-000000000000', 'Carteira Ltda');

insert into public.members (id, company_id, name, email, role, monthly_budget_cents, status)
values
  ('50000000-0000-4000-8000-000000000001', '0000000c-0000-4000-8000-000000000000', 'Dona', 'dona@example.com',
    'owner', null, 'active'),
  ('50000000-0000-4000-8000-000000000002', '0000000c-0000-4000-8000-000000000000', 'Com teto', 'teto@example.com',
    'employee', 1000, 'active'),
  ('50000000-0000-4000-8000-000000000003', '0000000c-0000-4000-8000-000000000000', 'Sem teto', 'livre@example.com',
    'employee', null, 'active'),
  ('50000000-0000-4000-8000-000000000004', '0000000c-0000-4000-8000-000000000000', 'Saiu', 'saiu@example.com',
    'employee', null, 'disabled');

select is(private.wallet_topup('0000000c-0000-4000-8000-000000000000', 2000, 'Pix de teste'), 2000::bigint,
  'A recarga devolve o saldo novo');

-- ---------- Como o nosso servidor ----------
select tests.as_server();

select throws_ok($$ select private.wallet_topup('0000000c-0000-4000-8000-000000000000', 100000, 'x') $$, '42501',
  null, 'O servidor não consegue lançar recarga (F25)');
select throws_ok($$ select private.wallet_adjust('0000000c-0000-4000-8000-000000000000', 100000, 'x') $$, '42501',
  null, 'O servidor não consegue lançar ajuste');
select throws_ok(
  $$ insert into public.wallet_entries (company_id, kind, amount_cents, description)
     values ('0000000c-0000-4000-8000-000000000000', 'topup', 100000, 'x') $$,
  '42501', null, 'O servidor não grava direto no extrato');

select set_config('tests.hold_1',
  public.wallet_reserve('50000000-0000-4000-8000-000000000002', 500, '60000000-0000-4000-8000-000000000001')::text,
  true);
select isnt(current_setting('tests.hold_1'), '', 'Reserva de R$ 5,00 dentro do saldo e do teto');

select is(public.wallet_charge(current_setting('tests.hold_1')::uuid, 200, 'Criar um site · Chefe', 'claude'),
  300::bigint, 'Cobrar R$ 2,00 deixa R$ 3,00 da reserva');
select is(public.wallet_charge(current_setting('tests.hold_1')::uuid, 0, 'Criar um site · Revisor', 'gemini'),
  300::bigint, 'Cobrança zero não muda a reserva');
select is(public.wallet_charge(current_setting('tests.hold_1')::uuid, 400, 'Criar um site · Programador', 'gpt'),
  -100::bigint, 'O consumo real passa da estimativa: cobra assim mesmo e avisa que passou');
select results_eq(
  $$ select amount_cents, provider, run_id from public.wallet_entries where hold_id = current_setting('tests.hold_1')::uuid order by id $$,
  $$ values (-200::bigint, 'claude', '60000000-0000-4000-8000-000000000001'::uuid),
            (-400::bigint, 'gpt', '60000000-0000-4000-8000-000000000001'::uuid) $$,
  'Cada etapa cobrada vira uma linha no extrato, ligada à execução; a cobrança zero não vira linha'
);
select is(public.wallet_close_hold(current_setting('tests.hold_1')::uuid), 600::bigint,
  'Fechar a reserva devolve o total cobrado');
select is(public.wallet_close_hold(current_setting('tests.hold_1')::uuid), 600::bigint,
  'Fechar de novo não muda nada');
select throws_ok($$ select public.wallet_charge(current_setting('tests.hold_1')::uuid, 1, 'x') $$, 'P0001',
  'hold_closed', 'Não dá para cobrar numa reserva fechada');

select throws_ok($$ select public.wallet_reserve('50000000-0000-4000-8000-000000000002', 500) $$, 'P0001',
  'monthly_budget_exceeded', 'Com R$ 6,00 gastos no mês, uma reserva de R$ 5,00 passa do teto de R$ 10,00');
select set_config('tests.hold_2', public.wallet_reserve('50000000-0000-4000-8000-000000000002', 400)::text, true);
select isnt(current_setting('tests.hold_2'), '', 'Uma reserva que chega exatamente no teto passa');
select throws_ok($$ select public.wallet_reserve('50000000-0000-4000-8000-000000000002', 1) $$, 'P0001',
  'monthly_budget_exceeded', 'O que está reservado também conta no teto');

-- Saldo agora: R$ 20,00 - R$ 6,00 cobrados - R$ 4,00 reservados = R$ 10,00 disponíveis.
select throws_ok($$ select public.wallet_reserve('50000000-0000-4000-8000-000000000003', 1001) $$, 'P0001',
  'insufficient_balance', 'Sem saldo disponível, não reserva');
select set_config('tests.hold_3', public.wallet_reserve('50000000-0000-4000-8000-000000000003', 1000)::text, true);
select isnt(current_setting('tests.hold_3'), '', 'Reserva exatamente do saldo disponível passa');
select throws_ok($$ select public.wallet_reserve('50000000-0000-4000-8000-000000000001', 1) $$, 'P0001',
  'insufficient_balance', 'Com o saldo todo reservado, nem a dona reserva');
select lives_ok($$ select public.wallet_close_hold(current_setting('tests.hold_3')::uuid) $$,
  'Fechar uma reserva sem cobrança devolve tudo');
select lives_ok($$ select public.wallet_reserve('50000000-0000-4000-8000-000000000001', 1000) $$,
  'O que voltou da reserva fechada pode ser reservado de novo');

select throws_ok($$ select public.wallet_reserve('50000000-0000-4000-8000-000000000004', 1) $$, 'P0001',
  'member_inactive', 'Pessoa desativada não reserva');
select throws_ok($$ select public.wallet_reserve('50000000-0000-4000-8000-000000000003', -1) $$, 'P0001',
  'invalid_amount', 'Valor negativo não reserva');
select throws_ok($$ select public.wallet_charge(current_setting('tests.hold_2')::uuid, 1, 'x', 'outra-ia') $$,
  '23514', null, 'Cobrança com uma IA que não existe é recusada');

-- ---------- Como o dono do banco ----------
reset role;

select throws_ok($$ update public.wallet_entries set amount_cents = 0 $$, 'P0001', 'wallet_entries_append_only',
  'O extrato não pode ser editado');
select throws_ok($$ delete from public.wallet_entries $$, 'P0001', 'wallet_entries_append_only',
  'O extrato não pode ser apagado');
select throws_ok($$ truncate public.wallet_entries cascade $$, 'P0001', 'wallet_entries_append_only',
  'O extrato não pode ser esvaziado');

-- O teto renova no dia 1º, à meia-noite de Brasília (UTC-3).
select is(private.month_start('2026-11-01 02:59:59+00'), '2026-10-01 03:00:00+00'::timestamptz,
  'Às 23:59 de 31/10 em Brasília ainda é outubro');
select is(private.month_start('2026-11-01 03:00:00+00'), '2026-11-01 03:00:00+00'::timestamptz,
  'À meia-noite de 1º/11 em Brasília já é novembro');

-- Um gasto do mês passado não conta no teto deste mês (inserido à mão, com a data do mês anterior).
insert into public.wallet_entries (company_id, kind, amount_cents, member_id, hold_id, description, created_at)
values ('0000000c-0000-4000-8000-000000000000', 'charge', -900, '50000000-0000-4000-8000-000000000002',
  current_setting('tests.hold_1')::uuid, 'Gasto do mês passado', private.month_start(now()) - interval '1 second');
select is(private.member_month_used_cents('0000000c-0000-4000-8000-000000000000', '50000000-0000-4000-8000-000000000002'),
  1000::bigint, 'O teto do mês conta R$ 6,00 cobrados e R$ 4,00 reservados neste mês, não o gasto do mês passado');

-- Um ajuste de devolução para a pessoa libera o teto dela.
select private.wallet_adjust('0000000c-0000-4000-8000-000000000000', 300, 'Devolução: etapa com problema',
  '50000000-0000-4000-8000-000000000002');
select is(private.member_month_used_cents('0000000c-0000-4000-8000-000000000000', '50000000-0000-4000-8000-000000000002'),
  700::bigint, 'A devolução de R$ 3,00 libera o teto da pessoa');

select * from finish();
rollback;
