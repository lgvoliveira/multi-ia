-- Pastas de entregas ("tarefas"): o funcionário organiza as entregas (os arquivos que a IA faz) em pastas que ele mesmo
-- nomeia, e pode mover uma entrega de qualquer chat para a pasta que quiser. Cada pasta é de uma pessoa, dentro da empresa.
create table public.delivery_folders (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  member_id uuid not null,
  name text not null check (char_length(trim(name)) between 1 and 80),
  created_at timestamptz not null default now(),
  foreign key (member_id, company_id) references public.members (id, company_id) on delete cascade,
  -- Para a entrega apontar para (folder_id, company_id) com a trava da empresa.
  unique (id, company_id)
);

create index delivery_folders_member_idx on public.delivery_folders (member_id, created_at desc);

-- A entrega pode apontar para uma pasta (opcional). Apagar a pasta solta as entregas (ficam "sem pasta").
alter table public.files
  add column folder_id uuid,
  add constraint files_folder_fk
    foreign key (folder_id, company_id) references public.delivery_folders (id, company_id) on delete set null;

create index files_folder_idx on public.files (folder_id);

-- Regras de acesso: só a dona da pasta mexe nela; o dono da empresa também enxerga, para ver a organização das entregas.
-- Mover uma entrega para uma pasta (mudar files.folder_id) continua sendo só pelo servidor (files não dá update à sessão).
alter table public.delivery_folders enable row level security;
revoke all on table public.delivery_folders from public, anon, authenticated, service_role;
grant select, insert, update, delete on table public.delivery_folders to service_role;
grant select, insert, update, delete on table public.delivery_folders to authenticated;

create policy delivery_folders_select on public.delivery_folders
  for select to authenticated
  using (
    company_id = (select private.current_company_id())
    and (member_id = (select private.current_member_id()) or (select private.current_member_is_owner()))
  );

create policy delivery_folders_insert on public.delivery_folders
  for insert to authenticated
  with check (
    company_id = (select private.current_company_id())
    and member_id = (select private.current_member_id())
  );

create policy delivery_folders_update on public.delivery_folders
  for update to authenticated
  using (company_id = (select private.current_company_id()) and member_id = (select private.current_member_id()))
  with check (company_id = (select private.current_company_id()) and member_id = (select private.current_member_id()));

create policy delivery_folders_delete on public.delivery_folders
  for delete to authenticated
  using (company_id = (select private.current_company_id()) and member_id = (select private.current_member_id()));
