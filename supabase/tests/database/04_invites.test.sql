-- Teste dos convites dos funcionários (migração member_invites), com duas empresas de mentira (A e B).
-- Confere que o dono vê os convites só da própria empresa e nunca o resumo do código, que ninguém pela sessão cria,
-- muda ou apaga convite, e que o servidor consegue gastar um convite uma vez só, dentro do prazo.
begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

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

-- Pessoas: 11 dona A · 12 funcionária A (convite novo) · 13 funcionário A (senha nova) · 21 dono B · 22 funcionária B
insert into auth.users (id, email)
values
  ('00000000-0000-4000-8000-000000000011', 'dona.a@example.com'),
  ('00000000-0000-4000-8000-000000000012', 'func1.a@example.com'),
  ('00000000-0000-4000-8000-000000000013', 'func2.a@example.com'),
  ('00000000-0000-4000-8000-000000000021', 'dono.b@example.com'),
  ('00000000-0000-4000-8000-000000000022', 'func1.b@example.com');

insert into public.companies (id, name)
values
  ('0000000a-0000-4000-8000-000000000000', 'Empresa A'),
  ('0000000b-0000-4000-8000-000000000000', 'Empresa B');

insert into public.members (id, company_id, user_id, name, email, role)
values
  ('10000000-0000-4000-8000-000000000011', '0000000a-0000-4000-8000-000000000000',
    '00000000-0000-4000-8000-000000000011', 'Dona A', 'dona.a@example.com', 'owner'),
  ('10000000-0000-4000-8000-000000000012', '0000000a-0000-4000-8000-000000000000',
    '00000000-0000-4000-8000-000000000012', 'Func 1 A', 'func1.a@example.com', 'employee'),
  ('10000000-0000-4000-8000-000000000013', '0000000a-0000-4000-8000-000000000000',
    '00000000-0000-4000-8000-000000000013', 'Func 2 A', 'func2.a@example.com', 'employee'),
  ('10000000-0000-4000-8000-000000000021', '0000000b-0000-4000-8000-000000000000',
    '00000000-0000-4000-8000-000000000021', 'Dono B', 'dono.b@example.com', 'owner'),
  ('10000000-0000-4000-8000-000000000022', '0000000b-0000-4000-8000-000000000000',
    '00000000-0000-4000-8000-000000000022', 'Func 1 B', 'func1.b@example.com', 'employee');

-- Resumos de código de mentira: 64 caracteres hexadecimais, um por convite.
insert into public.member_invites (member_id, company_id, kind, token_hash, expires_at)
values
  ('10000000-0000-4000-8000-000000000012', '0000000a-0000-4000-8000-000000000000', 'invite', repeat('a', 64),
    now() + interval '24 hours'),
  ('10000000-0000-4000-8000-000000000013', '0000000a-0000-4000-8000-000000000000', 'reset', repeat('b', 64),
    now() - interval '1 minute'),
  ('10000000-0000-4000-8000-000000000022', '0000000b-0000-4000-8000-000000000000', 'invite', repeat('c', 64),
    now() + interval '24 hours');

-- ---------- Permissões ----------
select ok(
  not has_column_privilege('authenticated', 'public.member_invites', 'token_hash', 'SELECT'),
  'Quem está logado nunca lê o resumo do código do convite'
);

select ok(
  not has_table_privilege('authenticated', 'public.member_invites', 'INSERT, UPDATE, DELETE, TRUNCATE')
    and not has_any_column_privilege('authenticated', 'public.member_invites', 'INSERT, UPDATE'),
  'Ninguém pela sessão cria, muda ou apaga convites'
);

select ok(
  has_table_privilege('service_role', 'public.member_invites', 'SELECT, INSERT, UPDATE, DELETE'),
  'O servidor cria, troca e apaga convites'
);

-- ---------- O que o banco recusa ----------
select throws_ok(
  $$ insert into public.member_invites (member_id, company_id, kind, token_hash, expires_at)
     values ('10000000-0000-4000-8000-000000000011', '0000000a-0000-4000-8000-000000000000', 'invite',
       'codigo-em-texto-puro', now()) $$,
  '23514', null, 'O banco só aceita o resumo do código (sha256), nunca o código em si'
);

select throws_ok(
  $$ insert into public.member_invites (member_id, company_id, kind, token_hash, expires_at)
     values ('10000000-0000-4000-8000-000000000012', '0000000a-0000-4000-8000-000000000000', 'invite',
       repeat('d', 64), now()) $$,
  '23505', null, 'Cada pessoa tem um convite de cada vez'
);

select throws_ok(
  $$ insert into public.member_invites (member_id, company_id, kind, token_hash, expires_at)
     values ('10000000-0000-4000-8000-000000000011', '0000000a-0000-4000-8000-000000000000', 'invite',
       repeat('a', 64), now()) $$,
  '23505', null, 'Dois convites nunca têm o mesmo código'
);

select throws_ok(
  $$ insert into public.member_invites (member_id, company_id, kind, token_hash, expires_at)
     values ('10000000-0000-4000-8000-000000000011', '0000000b-0000-4000-8000-000000000000', 'invite',
       repeat('e', 64), now()) $$,
  '23503', null, 'O convite é sempre da mesma empresa da pessoa'
);

select throws_ok(
  $$ insert into public.member_invites (member_id, company_id, kind, token_hash, expires_at)
     values ('10000000-0000-4000-8000-000000000011', '0000000a-0000-4000-8000-000000000000', 'admin',
       repeat('f', 64), now()) $$,
  '23514', null, 'O tipo do convite é invite ou reset'
);

-- ---------- Dona da empresa A ----------
select tests.login_as('00000000-0000-4000-8000-000000000011');

select results_eq(
  $$ select member_id, kind from public.member_invites order by kind $$,
  $$ values ('10000000-0000-4000-8000-000000000012'::uuid, 'invite'), ('10000000-0000-4000-8000-000000000013'::uuid, 'reset') $$,
  'Dona vê os convites da empresa dela, inclusive o vencido, e não os da outra empresa'
);
select throws_ok($$ select token_hash from public.member_invites $$, '42501', null,
  'Dona não lê o resumo do código');
select throws_ok(
  $$ update public.member_invites set expires_at = now() + interval '30 days'
     where member_id = '10000000-0000-4000-8000-000000000012' $$,
  '42501', null, 'Dona não estica o prazo de um convite'
);
select throws_ok($$ delete from public.member_invites $$, '42501', null, 'Dona não apaga convites direto no banco');
select throws_ok(
  $$ insert into public.member_invites (member_id, company_id, kind, token_hash, expires_at)
     values ('10000000-0000-4000-8000-000000000011', '0000000a-0000-4000-8000-000000000000', 'invite',
       repeat('9', 64), now()) $$,
  '42501', null, 'Dona não cria convite direto no banco'
);

-- ---------- Funcionária 1 da empresa A ----------
select tests.login_as('00000000-0000-4000-8000-000000000012');
select is((select count(*)::int from public.member_invites), 0, 'Funcionária não vê convite nenhum, nem o próprio');

-- ---------- Dono da empresa B ----------
select tests.login_as('00000000-0000-4000-8000-000000000021');
select results_eq($$ select member_id from public.member_invites $$,
  $$ values ('10000000-0000-4000-8000-000000000022'::uuid) $$, 'Dono da empresa B vê só os convites dele');

-- ---------- Sem login ----------
select tests.login_as_anon();
select throws_ok($$ select member_id from public.member_invites $$, '42501', null, 'Sem login não se lê convite');

-- ---------- O servidor aceitando um convite (como em lib/auth/invites.ts) ----------
reset role;
set local role service_role;

with consumed as (
  delete from public.member_invites where token_hash = repeat('a', 64) and expires_at > now() returning 1
)
select is(count(*)::int, 1, 'O servidor gasta um convite dentro do prazo') from consumed;

with consumed as (
  delete from public.member_invites where token_hash = repeat('a', 64) and expires_at > now() returning 1
)
select is(count(*)::int, 0, 'O mesmo convite não serve uma segunda vez') from consumed;

with consumed as (
  delete from public.member_invites where token_hash = repeat('b', 64) and expires_at > now() returning 1
)
select is(count(*)::int, 0, 'Convite vencido não é aceito') from consumed;

reset role;

select * from finish();
rollback;
