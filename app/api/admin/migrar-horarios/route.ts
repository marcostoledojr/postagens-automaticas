import { NextResponse } from 'next/server'
export async function GET() {
  return NextResponse.json({ erro: 'Rota desativada' }, { status: 404 })
}
