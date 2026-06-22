/**
 * GET /api/auth/linkedin-analytics/callback
 * Callback OAuth do app de analytics (Community Management API).
 * Salva o token de analytics separado do token de publicação.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const error = searchParams.get('error')

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

  if (error || !code) {
    const detalhe = encodeURIComponent(error ?? 'sem_code')
    console.error('[LinkedIn Analytics OAuth] Erro recebido do LinkedIn:', error, searchParams.get('error_description'))
    return NextResponse.redirect(`${appUrl}/analytics?erro=analytics_oauth_cancelado&detalhe=${detalhe}`)
  }

  const clientId = process.env.LINKEDIN_ANALYTICS_CLIENT_ID
  const clientSecret = process.env.LINKEDIN_ANALYTICS_CLIENT_SECRET
  const redirectUri = `${appUrl}/api/auth/linkedin-analytics/callback`

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${appUrl}/analytics?erro=analytics_credenciais_faltando`)
  }

  try {
    const tokenRes = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    })

    if (!tokenRes.ok) {
      const err = await tokenRes.text()
      console.error('[LinkedIn Analytics OAuth] Erro ao trocar código:', err)
      return NextResponse.redirect(`${appUrl}/analytics?erro=analytics_token_falhou`)
    }

    const tokenData = await tokenRes.json()
    const { access_token, expires_in } = tokenData

    if (!access_token) {
      return NextResponse.redirect(`${appUrl}/analytics?erro=analytics_token_vazio`)
    }

    const expiresAt = new Date(Date.now() + (expires_in ?? 5184000) * 1000).toISOString()

    // Salva token de analytics separado (chaves distintas do token de publicação)
    const supabase = createClient()
    await supabase.from('configuracoes').upsert(
      [
        { chave: 'linkedin_analytics_token', valor: access_token },
        { chave: 'linkedin_analytics_token_expiry', valor: expiresAt },
        { chave: 'linkedin_analytics_conectado_em', valor: new Date().toISOString() },
      ],
      { onConflict: 'chave' }
    )

    console.log('[LinkedIn Analytics OAuth] Token salvo. Expira em:', expiresAt)
    return NextResponse.redirect(`${appUrl}/analytics?analytics_conectado=1`)
  } catch (err: any) {
    console.error('[LinkedIn Analytics OAuth] Erro inesperado:', err)
    return NextResponse.redirect(`${appUrl}/analytics?erro=analytics_inesperado`)
  }
}
