-- Checagens da estrutura do banco. Valem também para as tabelas e funções que entrarem nas próximas migrações:
-- se alguém esquecer de ligar as regras de acesso ou abrir demais uma permissão, a checagem do PR fica vermelha.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

select is_empty(
  $$
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity
  $$,
  'Toda tabela do esquema public tem as regras de acesso (RLS) ligadas'
);

select is_empty(
  $$
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'f')
      and (
        has_table_privilege('anon', c.oid, 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER')
        or has_any_column_privilege('anon', c.oid, 'SELECT, INSERT, UPDATE, REFERENCES')
      )
  $$,
  'A chave pública sem login (anon) não tem acesso a nenhuma tabela'
);

-- Funções nossas (as de extensões, como o pgTAP, ficam de fora).
select is_empty(
  $$
    select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private')
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
      and has_function_privilege('anon', p.oid, 'EXECUTE')
  $$,
  'A chave pública sem login (anon) não chama nenhuma função nossa'
);

select results_eq(
  $$
    select p.proname::text collate "default" from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private')
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
      and has_function_privilege('authenticated', p.oid, 'EXECUTE')
    order by 1
  $$,
  $$
    values ('company_credit'), ('company_month_by_provider'), ('current_company_id'), ('current_member_id'),
      ('current_member_is_owner'), ('member_month_summary'), ('month_start'), ('month_statement')
  $$,
  'Quem está logado só chama as funções que dizem quem ele é e as contas do mês (que só somam o que ele pode ver)'
);

select ok(
  not exists (
    select 1 from pg_proc p
    where p.oid in (
      'public.company_credit()'::regprocedure, 'public.company_month_by_provider()'::regprocedure,
      'public.member_month_summary(uuid)'::regprocedure, 'public.month_statement(uuid, integer)'::regprocedure
    )
    and p.prosecdef
  ),
  'As contas do mês rodam com o login de quem chama, para as regras de acesso valerem dentro delas'
);

select results_eq(
  $$
    select p.proname::text collate "default" from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private')
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
      -- As funções "demo_*" são ajudas de teste criadas só no seed local (nunca na produção): a F25 vale para as de verdade.
      and p.proname not like 'demo\_%'
      and has_function_privilege('service_role', p.oid, 'EXECUTE')
    order by 1
  $$,
  $$
    values ('current_company_id'), ('current_member_id'), ('current_member_is_owner'),
      ('wallet_charge'), ('wallet_close_hold'), ('wallet_reserve')
  $$,
  'O servidor chama as funções de reservar, cobrar e fechar, mas não as de recarga e ajuste (F25)'
);

select ok(
  not has_table_privilege('authenticated', 'public.ai_calls', 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES')
    and not has_any_column_privilege('authenticated', 'public.ai_calls', 'SELECT, INSERT, UPDATE, REFERENCES'),
  'Ninguém logado lê a tabela interna ai_calls'
);

select ok(
  not has_table_privilege('service_role', 'public.ai_calls', 'UPDATE, DELETE, TRUNCATE'),
  'O registro interno ai_calls não pode ser mudado nem apagado pelo servidor'
);

select ok(
  not has_table_privilege('service_role', 'public.wallet_entries', 'INSERT, UPDATE, DELETE, TRUNCATE')
    and not has_table_privilege('service_role', 'public.wallet_holds', 'INSERT, UPDATE, DELETE, TRUNCATE')
    and not has_table_privilege('authenticated', 'public.wallet_entries', 'INSERT, UPDATE, DELETE, TRUNCATE')
    and not has_table_privilege('authenticated', 'public.wallet_holds', 'INSERT, UPDATE, DELETE, TRUNCATE')
    and not has_any_column_privilege('authenticated', 'public.wallet_entries', 'INSERT, UPDATE')
    and not has_any_column_privilege('service_role', 'public.wallet_entries', 'INSERT, UPDATE'),
  'Nem o servidor nem quem está logado grava direto no extrato ou nas reservas: só pelas funções'
);

select ok(
  not has_table_privilege('service_role', 'public.members', 'DELETE')
    and not has_table_privilege('authenticated', 'public.members', 'DELETE'),
  'Ninguém apaga uma pessoa da empresa: quem sai é desativado (F23)'
);

select ok(
  not has_column_privilege('authenticated', 'public.runs', 'error', 'SELECT')
    and not has_column_privilege('authenticated', 'public.runs', 'lease_until', 'SELECT')
    and not has_column_privilege('authenticated', 'public.runs', 'attempt', 'SELECT'),
  'Quem está logado não lê as colunas internas da execução (erro técnico e controle do servidor)'
);

select results_eq(
  $$ select public from storage.buckets where id = 'files' $$,
  $$ values (false) $$,
  'A pasta dos arquivos existe e não é pública'
);

select ok(
  (select c.relrowsecurity from pg_class c where c.oid = 'storage.objects'::regclass),
  'O conteúdo do Storage tem as regras de acesso ligadas'
);

-- Hoje nenhuma pasta do Storage tem regra de acesso: só o servidor mexe nos arquivos. Se um dia alguma pasta
-- precisar de regra própria, este teste muda junto, no mesmo PR.
select is_empty(
  $$ select policyname from pg_policies where schemaname = 'storage' and tablename = 'objects' $$,
  'Ninguém logado lê os arquivos direto do Storage (nenhuma regra libera)'
);

select * from finish();
rollback;
