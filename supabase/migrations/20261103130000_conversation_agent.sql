-- Agentes prontos (Fase 1): uma conversa pode nascer "com" um agente. Guardamos só o id do agente (texto curto, do
-- catálogo em lib/ock/agents.ts); a persona fica no código do servidor, não no banco. A sessão grava o agent_id ao
-- criar a conversa, então o grant de insert ganha essa coluna (o insert era só de "title"). Ler já vinha no grant de
-- select da tabela inteira; as políticas de RLS (dono = só as conversas da própria pessoa) não mudam.

alter table public.conversations
  add column agent_id text check (agent_id is null or char_length(agent_id) between 1 and 64);

grant insert (agent_id) on table public.conversations to authenticated;
