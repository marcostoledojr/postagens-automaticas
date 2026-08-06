-- Email semanal para leads perdidos (Kommo) — gerado sexta, aprovado por Marcos, enviado sábado

create table if not exists emails_semanais (
  id uuid default gen_random_uuid() primary key,
  semana_inicio date not null,
  semana_fim date not null,
  assunto text not null,
  corpo_html text not null,
  corpo_texto text,
  posts_incluidos jsonb default '[]',
  status text not null default 'pendente', -- pendente | aprovado | enviado | erro | sem_conteudo
  destinatarios_total integer default 0,
  destinatarios_enviados integer default 0,
  destinatarios_erro integer default 0,
  erro_envio text,
  aprovado_em timestamptz,
  enviado_em timestamptz,
  criado_em timestamptz default now(),
  atualizado_em timestamptz default now(),
  unique (semana_inicio)
);

create index if not exists idx_emails_semanais_status on emails_semanais(status);

-- Descadastro (LGPD) — leads que pediram para não receber mais o email semanal
create table if not exists email_optout (
  id uuid default gen_random_uuid() primary key,
  email text not null unique,
  origem text default 'email_semanal',
  criado_em timestamptz default now()
);

insert into configuracoes (chave, valor, descricao) values
('kommo_pipeline_nome', '"OFICINA1"', 'Nome do funil no Kommo com os leads perdidos'),
('kommo_status_perdido_nome', '"Closed - lost"', 'Nome da etapa de leads perdidos dentro do funil'),
('email_semanal_cta', '"Precisando de apoio com TOTVS Protheus ou ERP? Fale com a gente: contato@oficina1.com.br"', 'Chamada final fixa do email semanal')
on conflict (chave) do nothing;
