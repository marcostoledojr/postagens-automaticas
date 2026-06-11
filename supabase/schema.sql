create table if not exists temas (
  id uuid default gen_random_uuid() primary key,
  nome text not null,
  descricao text,
  objetivo text not null,
  tom text not null default 'profissional',
  mencoes text[] default '{}',
  hashtags text[] default '{}',
  cta text,
  frequencia_semanal integer default 2,
  ativo boolean default true,
  cor text default '#3b82f6',
  criado_em timestamptz default now(),
  atualizado_em timestamptz default now()
);

create table if not exists posts (
  id uuid default gen_random_uuid() primary key,
  tema_id uuid references temas(id) on delete set null,
  tema_nome text,
  texto text not null,
  imagem_url text,
  imagem_prompt text,
  hashtags text[] default '{}',
  fontes_pesquisa jsonb default '[]',
  status text not null default 'pendente',
  data_agendada timestamptz,
  horario_publicacao text default '09:00',
  publicado_em timestamptz,
  linkedin_post_id text,
  make_webhook_enviado boolean default false,
  erro_publicacao text,
  texto_original text,
  editado_por_usuario boolean default false,
  nota_aprovacao text,
  criado_em timestamptz default now(),
  atualizado_em timestamptz default now()
);

create table if not exists metricas (
  id uuid default gen_random_uuid() primary key,
  post_id uuid references posts(id) on delete cascade,
  impressoes integer default 0,
  curtidas integer default 0,
  comentarios integer default 0,
  compartilhamentos integer default 0,
  cliques integer default 0,
  novos_seguidores integer default 0,
  score_engajamento decimal(10,4) default 0,
  coletado_em timestamptz default now(),
  periodo_horas integer default 24
);

create table if not exists configuracoes (
  chave text primary key,
  valor jsonb not null,
  descricao text,
  atualizado_em timestamptz default now()
);

create table if not exists logs_geracao (
  id uuid default gen_random_uuid() primary key,
  data_execucao timestamptz default now(),
  posts_gerados integer default 0,
  posts_com_erro integer default 0,
  detalhes jsonb default '{}',
  status text default 'sucesso'
);

create index if not exists idx_posts_status on posts(status);
create index if not exists idx_posts_data_agendada on posts(data_agendada);
create index if not exists idx_metricas_post_id on metricas(post_id);

insert into temas (nome, descricao, objetivo, tom, mencoes, hashtags, cta, frequencia_semanal, cor) values
('Comercial Oficina1', 'Posts para gerar negócios para a Oficina1', 'Atrair clientes e gerar oportunidades comerciais para a Oficina1', 'consultivo', array['@Oficina1'], array['#ERP','#TOTVS','#Protheus','#Oficina1'], 'Fale com a Oficina1 e saiba como podemos ajudar sua empresa.', 2, '#10b981'),
('Autoridade Oficina1', 'Posts para posicionar a Oficina1 como referência', 'Construir autoridade da Oficina1 no mercado de ERP', 'profissional', array['@Oficina1'], array['#Oficina1','#TOTVS','#ERP','#Inovação'], 'Conheça os casos de sucesso da Oficina1.', 2, '#6366f1'),
('Inteligência Artificial', 'Posts sobre IA para construir autoridade pessoal', 'Posicionar Marcos Toledo como referência em IA aplicada a negócios', 'inspiracional', array[]::text[], array['#InteligênciaArtificial','#IA','#AI','#Inovação'], null, 2, '#f59e0b'),
('Fatos Relevantes TOTVS Protheus', 'Posts sobre novidades e dicas do TOTVS Protheus', 'Gerar relevância no nicho TOTVS Protheus', 'técnico', array[]::text[], array['#TOTVS','#Protheus','#ERP','#TOTVSProtheus'], null, 4, '#ef4444')
on conflict do nothing;

insert into configuracoes (chave, valor, descricao) values
('horarios_publicacao', '["09:00","14:00"]', 'Horários de publicação'),
('dias_semana_ativos', '[1,2,3,4,5]', 'Dias ativos (1=Seg a 5=Sex)'),
('instrucoes_gerais', '"Você é Marcos Toledo Jr., Head Comercial da Oficina1. Escreva posts autênticos, diretos e que gerem valor real. Nunca use linguagem corporativa vazia. Foque em insights práticos."', 'Instrução base para geração de posts'),
('perfil_linkedin', '{"nome":"Marcos Toledo","empresa":"Oficina1","cargo":"Head Comercial"}', 'Dados do perfil')
on conflict (chave) do nothing;
