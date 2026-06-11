import { NextResponse } from 'next/server'

export const maxDuration = 60

export async function GET() {
  const apiKey = process.env.FAL_API_KEY

  if (!apiKey) {
    return NextResponse.json({ erro: 'FAL_API_KEY não encontrada nas env vars' })
  }

  try {
    const res = await fetch('https://fal.run/fal-ai/flux/schnell', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: 'professional LinkedIn post image, modern office, clean design',
        image_size: 'landscape_16_9',
        num_inference_steps: 4,
        num_images: 1,
      }),
    })

    const body = await res.text()

    return NextResponse.json({
      status: res.status,
      ok: res.ok,
      resposta: body.slice(0, 500),
      keyPrimeiros8: apiKey.slice(0, 8) + '...',
    })
  } catch (err: any) {
    return NextResponse.json({ erro: err.message })
  }
}
