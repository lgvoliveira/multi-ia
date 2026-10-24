-- A pasta fechada dos arquivos, no Storage do Supabase. Não é pública e não ganha regra de acesso nenhuma:
-- só o nosso servidor lê e grava, e o arquivo sai para a pessoa por um link temporário, gerado depois de o
-- servidor conferir (pela tabela files, com a sessão dela) que ela pode ver aquele arquivo.

insert into storage.buckets (id, name, public)
values ('files', 'files', false)
on conflict (id) do nothing;
