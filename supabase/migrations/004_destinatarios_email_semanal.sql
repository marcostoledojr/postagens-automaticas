-- Lista nominal de quem recebeu cada email semanal (não só o total agregado)

create table if not exists emails_semanais_destinatarios (
  id uuid default gen_random_uuid() primary key,
  email_semanal_id uuid references emails_semanais(id) on delete cascade,
  email text not null,
  status text not null default 'enviado', -- enviado | erro
  erro text,
  criado_em timestamptz default now()
);

create index if not exists idx_destinatarios_email_semanal on emails_semanais_destinatarios(email_semanal_id);

-- Alinha o CTA do rodapé com o endereço real de resposta (comercial@oficina1.com.br)
update configuracoes
set valor = '"Precisando de apoio com TOTVS Protheus ou ERP? Fale com a gente: comercial@oficina1.com.br"'
where chave = 'email_semanal_cta';
