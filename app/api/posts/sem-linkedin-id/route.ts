import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function GET() {
  const supabase = createClient()
  const { data } = await supabase
    .from('posts')
    .select('id, texto, tema_nome, publicado_em')
    .eq('status', 'publicado')
    .like('linkedin_post_id', 'make_%')
    .not('publicado_em', 'is', null)
    .order('publicado_em', { ascending: false })
    .limit(50)

  return NextResponse.json(data ?? [])
}
