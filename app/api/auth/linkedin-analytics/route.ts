/**
 * GET /api/auth/linkedin-analytics
 * Inicia o fluxo OAuth do segundo app LinkedIn (exclusivo para analytics).
 * App: "Postagens Auto Oficina1 - Analytics"
 * Scope: r_member_postAnalytics (Community Management API)
 *
 * Pré-requisito: Community Management API aprovada no LinkedIn Developer Portal
 * para o app com Client ID = LINKEDIN_ANALYTICS_CLIENT_ID.
 */

import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const clientId = process.env.LINKEDIN_ANALYTICS_CLIENT_ID
  if (!clientId) {
    return NextResponse.json(
      { erro: 'LINKEDIN_ANALYTICS_CLIENT_ID não configurado. Adicione nas variáveis de ambiente do Vercel.' },
      { status: 500 }
    )
  }

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

  const redirectUri = `${appUrl}/api/auth/linkedin-analytics/callback`

  // r_member_postAnalytics: leitura de analytics de posts pessoais
  // Disponível após aprovação da Community Management API (Development Tier)
  const scope = 'openid profile r_member_postAnalytics'

  const url = new URL('https://www.linkedin.com/oauth/v2/authorization')
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('scope', scope)
  url.searchParams.set('state', 'analytics_connect')

  return NextResponse.redirect(url.toString())
}
