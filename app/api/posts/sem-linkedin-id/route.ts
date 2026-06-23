import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function GET() {
  const supabase = createClient()
  // Retorna posts sem ID real: linkedin_post_id NULL ou com prefixo make_ (ID falso do Make.com)
  const { data } = await supabase
    .from('posts')
    .select('id, texto, tema_nome, publicado_em')
    .eq('status', 'publicado')
    .not('publicado_em', 'is', null)
    .or('linkedin_post_id.is.null,linkedin_post_id.like.make_%')
    .order('publicado_em', { ascending: false })
    .limit(50)

  return NextResponse.json(data ?? [])
}
