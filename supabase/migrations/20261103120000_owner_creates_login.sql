-- O dono passa a criar o login do funcionário com uma SENHA TEMPORÁRIA (no lugar do link de convite): o dono vê o e-mail
-- e a senha, entrega à pessoa, e ela troca por uma própria no primeiro acesso. must_change_password marca quem ainda
-- precisa trocar (o servidor marca ao criar/gerar senha nova, e tira quando a pessoa cria a dela). Decisão do Leandro.
alter table public.members add column must_change_password boolean not null default false;

-- O servidor (chave-mestra) liga e desliga a marca; a sessão de quem está logado não mexe nela.
grant update (must_change_password) on table public.members to service_role;
