-- Uso interno: toda chamada a uma IA, inclusive as que falharam. Base para preço e margem (F04, F26).
-- Nenhuma regra de acesso libera a leitura: só o nosso servidor grava e lê. Nem o dono nem o funcionário enxergam.

create table public.ai_calls (
  id bigint generated always as identity primary key,
  company_id uuid not null references public.companies (id) on delete restrict,
  member_id uuid,
  -- Sem chave estrangeira: a execução ou a tarefa pode ser apagada (LGPD), e o registro do custo fica.
  run_id uuid,
  task_id uuid,
  step_id text check (char_length(step_id) <= 100),
  attempt integer check (attempt >= 1),
  provider text not null check (provider in ('claude', 'gpt', 'gemini')),
  model text not null check (char_length(model) between 1 and 200),
  tier text check (tier in ('economico', 'padrao', 'potente')),
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  -- Custo real em dólar e o câmbio usado para cobrar em reais.
  cost_usd numeric(12, 6) not null default 0 check (cost_usd >= 0),
  usd_brl numeric(8, 4) check (usd_brl > 0),
  -- false nas tentativas que falharam: a plataforma pagou, mas não cobrou (regra "etapa que falhou não é cobrada").
  charged boolean not null default false,
  status text not null check (status in ('ok', 'error')),
  error_code text check (char_length(error_code) <= 100),
  error_message text check (char_length(error_message) <= 2000),
  duration_ms integer check (duration_ms >= 0),
  created_at timestamptz not null default now(),
  foreign key (member_id, company_id) references public.members (id, company_id) on delete restrict
);

create index ai_calls_company_idx on public.ai_calls (company_id, created_at);
create index ai_calls_run_idx on public.ai_calls (run_id) where run_id is not null;

alter table public.ai_calls enable row level security;

revoke all on table public.ai_calls from public, anon, authenticated, service_role;
grant select, insert on table public.ai_calls to service_role;
