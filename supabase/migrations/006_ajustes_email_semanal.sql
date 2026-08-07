-- Ajusta o texto do CTA do rodapé (agora em negrito no template, sem repetir o email)
update configuracoes
set valor = '"Precisando de apoio com TOTVS Protheus, fale com a gente!"'
where chave = 'email_semanal_cta';
