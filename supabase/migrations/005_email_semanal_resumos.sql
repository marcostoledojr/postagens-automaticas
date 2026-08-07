-- Guarda o parágrafo de abertura separado do HTML final, para poder
-- reconstruir o email no envio (sábado) com os links do LinkedIn já resolvidos,
-- sem precisar chamar a IA de novo.
alter table emails_semanais add column if not exists paragrafo_abertura text;
