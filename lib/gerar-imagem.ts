/**
 * Geração de imagens via fal.ai (Flux Schnell)
 * Documentação: https://fal.ai/models/fal-ai/flux/schnell
 */

type ResultadoImagem = {
  url: string
  prompt: string
}

export async function gerarImagem(
  tema: string,
  objetivo: string,
  textoPost: string
): Promise<ResultadoImagem> {
  const apiKey = process.env.FAL_API_KEY
  if (!apiKey) {
    console.warn('FAL_API_KEY não configurada. Retornando imagem placeholder.')
    return {
      url: `https://placehold.co/1200x627/1e3a8a/white?text=${encodeURIComponent(tema)}`,
      prompt: 'placeholder',
    }
  }

  const prompt = construirPromptImagem(tema, objetivo, textoPost)

  try {
    const res = await fetch('https://fal.run/fal-ai/flux/schnell', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        image_size: 'landscape_16_9', // 1344x768 - bom para LinkedIn
        num_inference_steps: 4,
        num_images: 1,
        enable_safety_checker: true,
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`fal.ai error: ${res.status} - ${err}`)
    }

    const data = await res.json()
    const imageUrl = data.images?.[0]?.url

    if (!imageUrl) throw new Error('Nenhuma imagem retornada pelo fal.ai')

    return { url: imageUrl, prompt }
  } catch (err) {
    console.error('Erro ao gerar imagem:', err)
    // Fallback: imagem com texto
    return {
      url: `https://placehold.co/1200x627/1e3a8a/white?text=${encodeURIComponent(tema.slice(0, 30))}`,
      prompt,
    }
  }
}

function construirPromptImagem(tema: string, objetivo: string, textoPost: string): string {
  // Extrai palavras-chave do texto do post
  const palavrasChave = textoPost.split(' ').slice(0, 10).join(' ')

  const estiloBase = 'professional LinkedIn post image, clean modern design, corporate aesthetic, ' +
    'high quality photography or illustration, no text overlay, 16:9 aspect ratio'

  const mapaEstilos: Record<string, string> = {
    'Comercial':   'business meeting, handshake, professional office, growth chart, success',
    'Autoridade':  'technology company, modern office, team collaboration, innovation',
    'IA':          'artificial intelligence, neural network visualization, futuristic technology, data',
    'TOTVS':       'ERP software dashboard, business management, data visualization, enterprise',
    'Protheus':    'ERP system, business software, management dashboard, office technology',
  }

  let contexto = 'modern business professional setting'
  for (const [chave, estilo] of Object.entries(mapaEstilos)) {
    if (tema.includes(chave)) {
      contexto = estilo
      break
    }
  }

  return `${contexto}, ${estiloBase}, inspired by: "${palavrasChave.slice(0, 100)}"`
}
