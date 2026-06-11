# Guia de Instalação — Postagens Automáticas LinkedIn

Siga os passos abaixo na ordem. Cada etapa tem um número e é simples de executar.
Qualquer dúvida, me chame no Claude e te guio em tempo real.

---

## ETAPA 1 — Criar conta no Supabase (banco de dados)

1. Acesse https://supabase.com e clique em **Start your project**
2. Faça login com sua conta Google
3. Clique em **New project**
4. Preencha:
   - **Organization**: seu nome
   - **Project name**: `postagens-automaticas`
   - **Database Password**: crie uma senha forte (guarde em lugar seguro)
   - **Region**: `South America (São Paulo)`
5. Clique em **Create new project** e aguarde ~2 minutos
6. No menu lateral, clique em **SQL Editor**
7. Clique em **New query**
8. Abra o arquivo `supabase/schema.sql` e cole todo o conteúdo na caixa de texto
9. Clique em **Run** (ou pressione Ctrl+Enter)
10. Você verá "Success" — o banco está pronto!

**Salve estas informações (você precisará delas depois):**
- Vá em Settings → API
- Copie o **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- Copie o **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Copie o **service_role** key → `SUPABASE_SERVICE_ROLE_KEY`

---

## ETAPA 2 — Criar conta na Anthropic (Claude Haiku - texto dos posts)

1. Acesse https://console.anthropic.com
2. Crie uma conta (pode usar Google)
3. Adicione um cartão de crédito (cobrança por uso, ~$0,30/mês)
4. Vá em **API Keys** → **Create Key**
5. Dê o nome `postagens-automaticas` e clique em **Create Key**
6. **Copie a chave** (ela só aparece uma vez!) → `ANTHROPIC_API_KEY`

---

## ETAPA 3 — Criar conta no fal.ai (Flux - imagens dos posts)

1. Acesse https://fal.ai
2. Crie uma conta com Google
3. Vá em **Dashboard** → **API Keys** → **Add key**
4. Dê o nome `postagens` e clique em criar
5. Adicione créditos ($5 iniciais — duram muitos meses)
6. **Copie a chave** → `FAL_API_KEY`

---

## ETAPA 4 — Criar conta no Serper (busca web para temas do dia)

1. Acesse https://serper.dev
2. Crie uma conta
3. O plano gratuito dá 2.500 buscas/mês (suficiente para anos)
4. Vá em **API Key** e copie → `SERPER_API_KEY`

---

## ETAPA 5 — Configurar o Make.com (publicação no LinkedIn)

1. Acesse https://make.com e crie uma conta grátis
2. Clique em **Create a new scenario**
3. Adicione o módulo **Webhooks → Custom webhook**
4. Clique em **Add** e dê o nome `linkedin-poster`
5. **Copie a URL do webhook** → `MAKE_WEBHOOK_URL`
6. Adicione o módulo **LinkedIn → Create a Post**
7. Conecte sua conta LinkedIn (vai pedir login — é seguro)
8. Configure o campo **Text** com a variável `texto` que chega no webhook
9. Configure o campo **Media** com a variável `imagem_url`
10. Ative o cenário (botão verde no canto inferior esquerdo)

---

## ETAPA 6 — Publicar o sistema no Vercel

1. Acesse https://github.com e crie uma conta grátis (se não tiver)
2. Clique em **New repository** → nome: `postagens-automaticas` → **Create**
3. Siga as instruções do GitHub para fazer upload dos arquivos do projeto
   (Me chame que te guio passo a passo nesta etapa)
4. Acesse https://vercel.com e faça login com sua conta GitHub
5. Clique em **New Project** → importe o repositório `postagens-automaticas`
6. Antes de clicar em Deploy, clique em **Environment Variables** e adicione:

```
NEXT_PUBLIC_SUPABASE_URL        = (valor da Etapa 1)
NEXT_PUBLIC_SUPABASE_ANON_KEY   = (valor da Etapa 1)
SUPABASE_SERVICE_ROLE_KEY       = (valor da Etapa 1)
ANTHROPIC_API_KEY               = (valor da Etapa 2)
FAL_API_KEY                     = (valor da Etapa 3)
SERPER_API_KEY                  = (valor da Etapa 4)
MAKE_WEBHOOK_URL                = (valor da Etapa 5)
CRON_SECRET                     = qualquer senha que você inventar (ex: marcos2025secreto)
```

7. Clique em **Deploy** e aguarde ~3 minutos
8. Pronto! O Vercel te dará uma URL como `https://postagens-automaticas.vercel.app`

---

## ETAPA 7 — Primeiro teste

1. Acesse a URL do seu sistema
2. Vá em **Temas** e confirme que os 4 temas padrão estão lá
3. Clique em **Fila de Aprovação**
4. Para gerar os primeiros posts manualmente, acesse:
   `https://seu-app.vercel.app/api/gerar` (via POST pelo navegador ou me peça para fazer)
5. Aguarde ~2 minutos e recarregue a **Fila de Aprovação**
6. Os posts aparecerão para você revisar!

---

## CUSTOS MENSAIS ESTIMADOS

| Serviço         | Custo estimado |
|-----------------|----------------|
| Supabase        | Gratuito       |
| Anthropic       | ~$0,30         |
| fal.ai          | ~$0,30         |
| Serper          | Gratuito       |
| Make.com        | ~$9,00         |
| Vercel          | Gratuito       |
| **TOTAL**       | **~$9,60/mês** |

---

Qualquer passo que travar, me chame com uma print da tela!
