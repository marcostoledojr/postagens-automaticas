/**
 * GET /api/email-semanal/optout?email=fulano@empresa.com
 * Link público de descadastro (LGPD) — colocado no rodapé de todo email semanal.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const email = searchParams.get('email')?.toLowerCase().trim()

  if (!email) {
    return new NextResponse('Email não informado', { status: 400 })
  }

  const supabase = createClient()
  await supabase.from('email_optout').upsert({ email, origem: 'email_semanal' }, { onConflict: 'email' })

  return new NextResponse(
    `<!DOCTYPE html><html lang="pt-BR"><body style="font-family:Arial,sans-serif;padding:40px;text-align:center;">
      <h2>Pronto</h2>
      <p>${email} não vai mais receber o email semanal da Oficina1.</p>
    </body></html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  )
}
