-- Teste das regras de acesso, com duas empresas de mentira (A e B).
-- Confere que uma empresa não enxerga nada da outra, que um funcionário não lê o que é do colega, e que o dono vê
-- o extrato, as pessoas e as entregas da empresa, mas não as execuções, conversas e tarefas dos funcionários
-- (decisão 2 do Luis, 24/10/2026).
begin;
create extension if not exists pgtap with schema extensions;
select plan(48);

-- "Entrar" como uma pessoa: o mesmo que o Supabase faz com a sessão de quem está logado.
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
grant usage on schema tests to anon, authenticated;
grant execute on all functions in schema tests to anon, authenticated;

-- Pessoas (ids fáceis de ler): 1x = empresa A, 2x = empresa B.
--   11 dona A · 12 funcionária A · 13 funcionário A · 14 funcionário A já desativado · 21 dono B
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
    '00000000-0000-4000-8000-000000000013', 'Func 2 A', 'func2.a@example.com', 'employee', 5000, 'active'),
  ('10000000-0000-4000-8000-000000000014', '0000000a-0000-4000-8000-000000000000',
    '00000000-0000-4000-8000-000000000014', 'Saiu A', 'saiu.a@example.com', 'employee', 5000, 'disabled'),
  ('10000000-0000-4000-8000-000000000021', '0000000b-0000-4000-8000-000000000000',
    '00000000-0000-4000-8000-000000000021', 'Dono B', 'dono.b@example.com', 'owner', null, 'active');

-- Dinheiro: recarga nas duas empresas e um gasto de cada funcionário.
select private.wallet_topup('0000000a-0000-4000-8000-000000000000', 10000, 'Pix A');
select private.wallet_topup('0000000b-0000-4000-8000-000000000000', 10000, 'Pix B');
select set_config('tests.hold_12', public.wallet_reserve('10000000-0000-4000-8000-000000000012', 500)::text, true);
select set_config('tests.hold_13', public.wallet_reserve('10000000-0000-4000-8000-000000000013', 300)::text, true);
select set_config('tests.hold_21', public.wallet_reserve('10000000-0000-4000-8000-000000000021', 100)::text, true);

-- Trabalho: uma execução, uma conversa e uma tarefa de cada um.
insert into public.runs (id, company_id, member_id, recipe_id, request, status, error)
values
  ('20000000-0000-4000-8000-000000000012', '0000000a-0000-4000-8000-000000000000',
    '10000000-0000-4000-8000-000000000012', 'create-site', 'Site da padaria', 'finished', '{"errorMessage": "x"}'),
  ('20000000-0000-4000-8000-000000000013', '0000000a-0000-4000-8000-000000000000',
    '10000000-0000-4000-8000-000000000013', 'create-site', 'Site do colega', 'running', null),
  ('20000000-0000-4000-8000-000000000021', '0000000b-0000-4000-8000-000000000000',
    '10000000-0000-4000-8000-000000000021', 'create-site', 'Site da empresa B', 'finished', null);

insert into public.run_events (run_id, company_id, event)
values
  ('20000000-0000-4000-8000-000000000012', '0000000a-0000-4000-8000-000000000000', '{"type": "run-started"}'),
  ('20000000-0000-4000-8000-000000000012', '0000000a-0000-4000-8000-000000000000', '{"type": "run-finished"}'),
  ('20000000-0000-4000-8000-000000000013', '0000000a-0000-4000-8000-000000000000', '{"type": "run-started"}');

select public.wallet_charge(current_setting('tests.hold_12')::uuid, 200, 'Criar um site · Programador', 'gpt',
  '20000000-0000-4000-8000-000000000012');
select public.wallet_charge(current_setting('tests.hold_13')::uuid, 100, 'Criar um site · Chefe', 'claude',
  '20000000-0000-4000-8000-000000000013');
select public.wallet_charge(current_setting('tests.hold_21')::uuid, 50, 'Criar um site · Chefe', 'claude',
  '20000000-0000-4000-8000-000000000021');

insert into public.conversations (id, company_id, member_id, title)
values
  ('30000000-0000-4000-8000-000000000012', '0000000a-0000-4000-8000-000000000000',
    '10000000-0000-4000-8000-000000000012', 'Conversa da func 1'),
  ('30000000-0000-4000-8000-000000000013', '0000000a-0000-4000-8000-000000000000',
    '10000000-0000-4000-8000-000000000013', 'Conversa do func 2'),
  ('30000000-0000-4000-8000-000000000021', '0000000b-0000-4000-8000-000000000000',
    '10000000-0000-4000-8000-000000000021', 'Conversa do dono B');

insert into public.tasks (id, company_id, member_id, conversation_id, prompt, answer, action, status,
  chosen_provider, chosen_tier, chosen_effort)
values
  ('40000000-0000-4000-8000-000000000012', '0000000a-0000-4000-8000-000000000000',
    '10000000-0000-4000-8000-000000000012', '30000000-0000-4000-8000-000000000012', 'Pedido da func 1', 'Resposta',
    'responder', 'finished', 'claude', 'padrao', 'medium'),
  ('40000000-0000-4000-8000-000000000013', '0000000a-0000-4000-8000-000000000000',
    '10000000-0000-4000-8000-000000000013', '30000000-0000-4000-8000-000000000013', 'Pedido do func 2', 'Resposta',
    'responder', 'finished', 'gpt', 'economico', 'low');

insert into public.files (company_id, member_id, kind, name, storage_path)
values
  ('0000000a-0000-4000-8000-000000000000', '10000000-0000-4000-8000-000000000012', 'upload', 'planilha.xlsx',
    '0000000a-0000-4000-8000-000000000000/12/planilha.xlsx'),
  ('0000000a-0000-4000-8000-000000000000', '10000000-0000-4000-8000-000000000012', 'delivery', 'relatorio.pdf',
    '0000000a-0000-4000-8000-000000000000/12/relatorio.pdf'),
  ('0000000a-0000-4000-8000-000000000000', '10000000-0000-4000-8000-000000000013', 'delivery', 'proposta.docx',
    '0000000a-0000-4000-8000-000000000000/13/proposta.docx'),
  ('0000000b-0000-4000-8000-000000000000', '10000000-0000-4000-8000-000000000021', 'delivery', 'b.pdf',
    '0000000b-0000-4000-8000-000000000000/21/b.pdf');

insert into public.custom_recipes (company_id, member_id, name, visibility, definition)
values
  ('0000000a-0000-4000-8000-000000000000', '10000000-0000-4000-8000-000000000012', 'Só da func 1', 'private', '{}'),
  ('0000000a-0000-4000-8000-000000000000', '10000000-0000-4000-8000-000000000013', 'Só do func 2', 'private', '{}'),
  ('0000000a-0000-4000-8000-000000000000', '10000000-0000-4000-8000-000000000013', 'Da empresa A', 'company', '{}'),
  ('0000000b-0000-4000-8000-000000000000', '10000000-0000-4000-8000-000000000021', 'Da empresa B', 'company', '{}');

insert into public.ai_calls (company_id, member_id, provider, model, status)
values ('0000000a-0000-4000-8000-000000000000', '10000000-0000-4000-8000-000000000012', 'gpt', 'gpt-x', 'ok');

-- ---------- Funcionária 1 da empresa A ----------
select tests.login_as('00000000-0000-4000-8000-000000000012');

select results_eq($$ select name from public.companies $$, $$ values ('Empresa A') $$,
  'Funcionária vê só a própria empresa');
select results_eq($$ select name from public.members $$, $$ values ('Func 1 A') $$,
  'Funcionária vê só o próprio cadastro, não os colegas');
select results_eq($$ select description from public.wallet_entries $$, $$ values ('Criar um site · Programador') $$,
  'Funcionária vê só os próprios gastos no extrato (nem os do colega, nem as recargas)');
select is((select count(*)::int from public.wallet_holds), 1, 'Funcionária vê só as próprias reservas');
select results_eq($$ select request from public.runs $$, $$ values ('Site da padaria') $$,
  'Funcionária vê só as próprias execuções');
select is((select count(*)::int from public.run_events), 2, 'Funcionária vê só a narração das próprias execuções');
select results_eq($$ select title from public.conversations $$, $$ values ('Conversa da func 1') $$,
  'Funcionária vê só as próprias conversas');
select results_eq($$ select prompt from public.tasks $$, $$ values ('Pedido da func 1') $$,
  'Funcionária vê só as próprias tarefas');
select results_eq($$ select name from public.files order by name $$, $$ values ('planilha.xlsx'), ('relatorio.pdf') $$,
  'Funcionária vê só os próprios arquivos');
select results_eq($$ select name from public.custom_recipes order by name $$,
  $$ values ('Da empresa A'), ('Só da func 1') $$,
  'Funcionária vê as próprias receitas e as da empresa, não as particulares do colega nem as de outra empresa');

select throws_ok($$ select id from public.ai_calls $$, '42501', null, 'Funcionária não lê a tabela interna ai_calls');
select throws_ok($$ select error from public.runs $$, '42501', null,
  'Funcionária não lê o erro técnico da execução');

with changed as (
  update public.members set monthly_budget_cents = 999999
  where id = '10000000-0000-4000-8000-000000000012' returning 1
)
select is(count(*)::int, 0, 'Funcionária não muda o próprio teto') from changed;

select throws_ok($$ update public.members set role = 'owner' where id = '10000000-0000-4000-8000-000000000012' $$,
  '42501', null, 'Funcionária não muda o próprio papel');

select lives_ok($$ insert into public.conversations (title) values ('Conversa nova') $$,
  'Funcionária cria uma conversa');
select results_eq($$ select member_id, company_id from public.conversations where title = 'Conversa nova' $$,
  $$ values ('10000000-0000-4000-8000-000000000012'::uuid, '0000000a-0000-4000-8000-000000000000'::uuid) $$,
  'A conversa nova é dela e da empresa dela, sem ela precisar dizer');
select throws_ok(
  $$ insert into public.conversations (title, member_id) values ('Em nome do colega', '10000000-0000-4000-8000-000000000013') $$,
  '42501', null, 'Funcionária não cria conversa em nome do colega');
select throws_ok(
  $$ insert into public.custom_recipes (name, definition, company_id)
     values ('Na outra empresa', '{}', '0000000b-0000-4000-8000-000000000000') $$,
  '42501', null, 'Funcionária não cria receita em outra empresa');
select lives_ok($$ insert into public.custom_recipes (name, definition) values ('Receita nova', '{"steps": []}') $$,
  'Funcionária cria uma receita própria');

with changed as (
  update public.conversations set title = 'Invadida' where id = '30000000-0000-4000-8000-000000000013' returning 1
)
select is(count(*)::int, 0, 'Funcionária não renomeia a conversa do colega') from changed;

with removed as (delete from public.tasks where id = '40000000-0000-4000-8000-000000000013' returning 1)
select is(count(*)::int, 0, 'Funcionária não apaga a tarefa do colega') from removed;

with removed as (delete from public.files where member_id = '10000000-0000-4000-8000-000000000013' returning 1)
select is(count(*)::int, 0, 'Funcionária não apaga os arquivos do colega') from removed;

select throws_ok(
  $$ insert into public.wallet_entries (company_id, kind, amount_cents, description)
     values ('0000000a-0000-4000-8000-000000000000', 'topup', 100000, 'Crédito grátis') $$,
  '42501', null, 'Funcionária não lança crédito no extrato');
select throws_ok($$ select public.wallet_reserve('10000000-0000-4000-8000-000000000012', 1) $$, '42501', null,
  'Funcionária não chama a reserva direto');
select throws_ok($$ select private.wallet_topup('0000000a-0000-4000-8000-000000000000', 100000, 'x') $$, '42501',
  null, 'Funcionária não chama a recarga');

with removed as (delete from public.runs where id = '20000000-0000-4000-8000-000000000012' returning 1)
select is(count(*)::int, 1, 'Funcionária apaga a própria execução já terminada (LGPD)') from removed;

-- ---------- Dona da empresa A ----------
select tests.login_as('00000000-0000-4000-8000-000000000011');

select is((select count(*)::int from public.members), 4, 'Dona vê todas as pessoas da empresa, inclusive quem saiu');
select is((select count(*)::int from public.members where company_id = '0000000b-0000-4000-8000-000000000000'), 0,
  'Dona não vê as pessoas da outra empresa');
select results_eq($$ select kind, amount_cents from public.wallet_entries order by id $$,
  $$ values ('topup', 10000::bigint), ('charge', -200::bigint), ('charge', -100::bigint) $$,
  'Dona vê o extrato inteiro da empresa, e só dela');
select is((select count(*)::int from public.runs), 0, 'Dona não lê as execuções dos funcionários');
select is((select count(*)::int from public.run_events), 0, 'Dona não lê a narração das execuções dos funcionários');
select is((select count(*)::int from public.conversations), 0, 'Dona não lê as conversas dos funcionários');
select is((select count(*)::int from public.tasks), 0, 'Dona não lê as tarefas (pedidos e respostas) dos funcionários');
select results_eq($$ select name from public.files order by name $$, $$ values ('proposta.docx'), ('relatorio.pdf') $$,
  'Dona vê as entregas de todos da empresa, mas não os arquivos que eles enviaram');
select results_eq($$ select name from public.custom_recipes order by name $$, $$ values ('Da empresa A') $$,
  'Dona vê as receitas da empresa, não as particulares');

with changed as (
  update public.members set monthly_budget_cents = 8000
  where id = '10000000-0000-4000-8000-000000000012' returning 1
)
select is(count(*)::int, 1, 'Dona muda o teto de uma funcionária') from changed;

with changed as (
  update public.members set monthly_budget_cents = 1 where id = '10000000-0000-4000-8000-000000000021' returning 1
)
select is(count(*)::int, 0, 'Dona não mexe em pessoa de outra empresa') from changed;

with changed as (
  update public.members set name = 'Outro nome' where id = '10000000-0000-4000-8000-000000000011' returning 1
)
select is(count(*)::int, 0, 'Dona não muda o próprio cadastro por aqui') from changed;

select throws_ok($$ select public.wallet_close_hold(current_setting('tests.hold_12')::uuid) $$, '42501', null,
  'Dona não mexe nas reservas');

with changed as (
  update public.members set status = 'disabled' where id = '10000000-0000-4000-8000-000000000013' returning 1
)
select is(count(*)::int, 1, 'Dona desativa um funcionário') from changed;

-- ---------- Funcionário desativado agora, e o que já tinha saído ----------
select tests.login_as('00000000-0000-4000-8000-000000000013');

select is(
  (select count(*)::int from public.companies) + (select count(*)::int from public.members)
    + (select count(*)::int from public.runs) + (select count(*)::int from public.conversations)
    + (select count(*)::int from public.wallet_entries) + (select count(*)::int from public.files),
  0,
  'Funcionário desativado perde o acesso na hora'
);

select tests.login_as('00000000-0000-4000-8000-000000000014');
select is((select count(*)::int from public.companies) + (select count(*)::int from public.members), 0,
  'Quem já tinha saído não vê nada');

-- ---------- Dono da empresa B ----------
select tests.login_as('00000000-0000-4000-8000-000000000021');

select results_eq($$ select name from public.members $$, $$ values ('Dono B') $$,
  'Dono da empresa B vê só as pessoas dele');
select is((select count(*)::int from public.wallet_entries where company_id = '0000000a-0000-4000-8000-000000000000'),
  0, 'Dono da empresa B não vê o extrato da empresa A');
select results_eq($$ select request from public.runs $$, $$ values ('Site da empresa B') $$,
  'Dono vê as próprias execuções');

-- ---------- Sem login (só a chave pública) ----------
select tests.login_as_anon();

select throws_ok($$ select id from public.companies $$, '42501', null, 'Sem login não se lê nenhuma empresa');
select throws_ok($$ select id from public.runs $$, '42501', null, 'Sem login não se lê nenhuma execução');

-- ---------- De volta ao dono do banco ----------
reset role;

select is(
  (select count(*)::int from public.wallet_entries where run_id = '20000000-0000-4000-8000-000000000012'),
  1,
  'Apagar a execução não apaga o gasto dela no extrato'
);

select * from finish();
rollback;
