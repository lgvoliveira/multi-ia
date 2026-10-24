-- Empresa de exemplo, só para o banco LOCAL (supabase start / supabase db reset) e para as checagens do GitHub.
-- O banco de verdade nunca recebe este arquivo: a ligação com o GitHub não roda o seed na produção.
--
-- Logins de teste (senha de todos: senha-local-123, que só existe neste banco local):
--   marina@example.com  dona
--   ana@example.com     funcionária, teto de R$ 50,00 por mês
--   bruno@example.com   funcionário, teto de R$ 30,00 por mês

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
select
  '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
  extensions.crypt('senha-local-123', extensions.gen_salt('bf')), now(),
  '{"provider": "email", "providers": ["email"]}', '{}', now(), now(),
  '', '', '', ''
from (values
  ('a0000000-0000-4000-8000-000000000001'::uuid, 'marina@example.com'),
  ('a0000000-0000-4000-8000-000000000002'::uuid, 'ana@example.com'),
  ('a0000000-0000-4000-8000-000000000003'::uuid, 'bruno@example.com')
) as u (id, email);

insert into auth.identities (user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
select u.id, u.id::text, 'email', jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  now(), now(), now()
from auth.users u
where u.id in (
  'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002',
  'a0000000-0000-4000-8000-000000000003'
);

insert into public.companies (id, name)
values ('c0000000-0000-4000-8000-000000000001', 'Agência Exemplo');

insert into public.members (id, company_id, user_id, name, email, role, monthly_budget_cents)
values
  ('b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000001', 'Marina Souza', 'marina@example.com', 'owner', null),
  ('b0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000002', 'Ana Lima', 'ana@example.com', 'employee', 5000),
  ('b0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000001',
    'a0000000-0000-4000-8000-000000000003', 'Bruno Costa', 'bruno@example.com', 'employee', 3000);

-- R$ 200,00 de crédito, como se o Pix tivesse chegado.
select private.wallet_topup('c0000000-0000-4000-8000-000000000001', 20000, 'Recarga de exemplo');
