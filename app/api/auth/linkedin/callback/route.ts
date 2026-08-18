/**
 * GET /api/auth/linkedin/callback
 * Recebe o código OAuth do LinkedIn, troca por token e salva no banco.
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
    console.error('[LinkedIn OAuth] Erro recebido do LinkedIn:', error, searchParams.get('error_description'))
    return NextResponse.redirect(`${appUrl}/analytics?erro=oauth_cancelado&detalhe=${detalhe}`)
  }

  const clientId = process.env.LINKEDIN_CLIENT_ID
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET
  const redirectUri = `${appUrl}/api/auth/linkedin/callback`

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${appUrl}/analytics?erro=credenciais_faltando`)
  }

  try {
    // Troca o código de autorização pelo access token
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
      console.error('[LinkedIn OAuth] Erro ao trocar código:', err)
      return NextResponse.redirect(`${appUrl}/analytics?erro=token_falhou`)
    }

    const tokenData = await tokenRes.json()
    const { access_token, expires_in } = tokenData

    if (!access_token) {
      return NextResponse.redirect(`${appUrl}/analytics?erro=token_vazio`)
    }

    // Token do LinkedIn dura 60 dias (5184000 segundos)
    const expiresAt = new Date(Date.now() + (expires_in ?? 5184000) * 1000).toISOString()

    // Salva token no banco (tabela configuracoes)
    const supabase = createClient()
    const { error: dbError } = await supabase.from('configuracoes').upsert(
      [
        { chave: 'linkedin_access_token', valor: access_token },
        { chave: 'linkedin_token_expiry', valor: expiresAt },
        { chave: 'linkedin_conectado_em', valor: new Date().toISOString() },
      ],
      { onConflict: 'chave' }
    )

    if (dbError) {
      console.error('[LinkedIn OAuth] Erro ao salvar token:', dbError)
      return NextResponse.redirect(`${appUrl}/analytics?erro=salvar_token`)
    }

    // Busca person URN (necessário para memberShareStatistics)
    try {
      const profileRes = await fetch('https://api.linkedin.com/v2/userinfo', {
        headers: { Authorization: `Bearer ${access_token}` },
      })
      if (profileRes.ok) {
        const profile = await profileRes.json()
        // sub = LinkedIn member ID (ex: "ABC123XYZ")
        const personUrn = `urn:li:person:${profile.sub}`
        await supabase.from('configuracoes').upsert(
          [{ chave: 'linkedin_person_urn', valor: personUrn }],
          { onConflict: 'chave' }
        )
        console.log('[LinkedIn OAuth] Person URN salvo:', personUrn)
      }
    } catch (e) {
      console.warn('[LinkedIn OAuth] Não foi possível salvar person URN:', e)
    }

    console.log('[LinkedIn OAuth] Token salvo com sucesso. Expira em:', expiresAt)
    return NextResponse.redirect(`${appUrl}/analytics?conectado=1`)
  } catch (err: any) {
    console.error('[LinkedIn OAuth] Erro inesperado:', err)
    return NextResponse.redirect(`${appUrl}/analytics?erro=inesperado`)
  }
}
