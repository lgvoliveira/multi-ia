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

-- Recarga de TESTE, só para a visão raio-x. Este seed roda só no banco LOCAL (supabase start / db reset) e nas
-- checagens do GitHub; a produção nunca o recebe, então esta função NÃO existe lá. É uma função à parte da recarga de
-- verdade (private.wallet_topup, que segue só pelo painel do Supabase — F25): é SECURITY DEFINER para conseguir lançar
-- a recarga, mas só o service_role a chama, e o servidor só a aciona na visão raio-x (lib/auth/demo.ts: OCK_DEMO_MODE=1
-- e fora de produção). Como não existe na produção, a F25 continua inteira lá. O nome começa com "demo_": o teste de
-- estrutura ignora as funções "demo_" do seed (nunca vão para a produção).
create or replace function public.demo_wallet_topup(p_company_id uuid, p_amount_cents bigint)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_amount_cents is null or p_amount_cents <= 0 or p_amount_cents > 100000000 then
    raise exception 'invalid_amount';
  end if;
  return private.wallet_topup(p_company_id, p_amount_cents, 'Recarga de teste (raio-x)');
end;
$$;

revoke execute on function public.demo_wallet_topup(uuid, bigint) from public, anon, authenticated;
grant execute on function public.demo_wallet_topup(uuid, bigint) to service_role;
