-- Migração 002: Novos temas de conteúdo
-- Executar no Supabase Dashboard > SQL Editor
-- Data: 2026-06-19

-- ── Inserir novos temas (apenas se não existirem) ────────────────────────────

INSERT INTO temas (nome, descricao, objetivo, tom, mencoes, hashtags, cta, frequencia_semanal, cor, ativo)
SELECT nome, descricao, objetivo, tom, mencoes, hashtags, cta, frequencia_semanal, cor, ativo
FROM (VALUES

  ('Gestão & Liderança',
   'Times de alta performance, liderança, cultura organizacional, tomada de decisão',
   'Posicionar Marcos como referência em gestão de times e liderança executiva no mercado de tecnologia e serviços',
   'reflexivo e provocador — insights práticos de quem lidera e convive com líderes no dia a dia',
   '{}'::text[],
   ARRAY['#Liderança', '#Gestão', '#AltaPerformance', '#CulturaOrganizacional', '#Times'],
   NULL, 1, '#BA7517', true),

  ('Reforma Tributária',
   'IVA dual, CBS, IBS, IS, transição do sistema tributário brasileiro, impactos para empresas',
   'Trazer clareza sobre o novo sistema tributário para gestores, CFOs e empresários que precisam se preparar',
   'informativo e consultivo — traduz complexidade tributária em linguagem de negócios, sem juridiquês',
   '{}'::text[],
   ARRAY['#ReformaTributária', '#SistemaTributário', '#Impostos', '#GestãoFiscal', '#Tributação'],
   NULL, 1, '#993C1D', true),

  ('Mercado Financeiro',
   'Investimentos, renda fixa, bolsa, macroeconomia brasileira, juros, câmbio, gestão patrimonial',
   'Expandir o perfil profissional do Marcos com visão de mercado financeiro e economia — sem ser guru financeiro',
   'analítico e acessível — fala de finanças com contexto real, sem prometer retorno e sem jargão excessivo',
   '{}'::text[],
   ARRAY['#MercadoFinanceiro', '#Investimentos', '#EducaçãoFinanceira', '#Economia', '#Finanças'],
   NULL, 1, '#3C3489', true),

  ('Livros & Insights',
   'Insights aplicados de livros relevantes de tecnologia, gestão, liderança, comportamento e negócios',
   'Demonstrar amplitude intelectual e capacidade de extrair aprendizados práticos de leituras — sextas às 13h',
   'reflexivo e aplicado — conecta leitura com prática profissional real, sem resenha nem spoiler',
   '{}'::text[],
   ARRAY['#Livros', '#Leitura', '#Aprendizado', '#Desenvolvimento', '#Insights'],
   NULL, 1, '#444441', true),

  ('Saúde no trabalho',
   'Bem-estar corporativo, saúde mental, equilíbrio trabalho-vida, produtividade sustentável, burnout',
   'Humanizar o perfil profissional do Marcos e gerar identificação com pauta de saúde e bem-estar no ambiente corporativo',
   'energético e humano — trata saúde como ativo profissional e diferencial competitivo, não como fraqueza',
   '{}'::text[],
   ARRAY['#SaúdeNoTrabalho', '#BemEstar', '#SaúdeMental', '#Produtividade', '#Equilíbrio'],
   NULL, 1, '#0F6E56', true),

  ('Tecnologia & Lançamentos',
   'Hardware, software, sistemas, novidades tech, inovação — excluindo IA que tem slot próprio na sexta',
   'Posicionar Marcos como profissional atualizado com o ecossistema de tecnologia além do ERP',
   'dinâmico e curatorial — traz o relevante da semana sem hype, com olhar crítico de quem usa tecnologia no negócio',
   '{}'::text[],
   ARRAY['#Tecnologia', '#Inovação', '#Tech', '#Lançamentos', '#TransformaçãoDigital'],
   NULL, 1, '#D85A30', true)

) AS v(nome, descricao, objetivo, tom, mencoes, hashtags, cta, frequencia_semanal, cor, ativo)
WHERE NOT EXISTS (
  SELECT 1 FROM temas t WHERE t.nome = v.nome
);

-- ── Confirmar resultado ───────────────────────────────────────────────────────
SELECT nome, cor, frequencia_semanal, ativo
FROM temas
ORDER BY nome;
