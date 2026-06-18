/**
 * GET /api/auth/linkedin
 * Inicia o fluxo OAuth do LinkedIn para coleta de métricas.
 * Redireciona o usuário para a tela de autorização do LinkedIn.
 */

import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const clientId = process.env.LINKEDIN_CLIENT_ID
  if (!clientId) {
    return NextResponse.json(
      { erro: 'LINKEDIN_CLIENT_ID não configurado nas variáveis de ambiente do Vercel.' },
      { status: 500 }
    )
  }

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

  const redirectUri = `${appUrl}/api/auth/linkedin/callback`

  // Escopos disponíveis para apps LinkedIn padrão:
  // openid + profile + email → autenticação e person URN (via /v2/userinfo)
  // w_member_social → publicar posts e ler estatísticas dos próprios posts
  // Nota: r_member_social exige LinkedIn Marketing Partner Program (não disponível)
  const scope = 'openid profile email w_member_social'

  const url = new URL('https://www.linkedin.com/oauth/v2/authorization')
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('scope', scope)
  url.searchParams.set('state', 'analytics_connect')

  return NextResponse.redirect(url.toString())
}
