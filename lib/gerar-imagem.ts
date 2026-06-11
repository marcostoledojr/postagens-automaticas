/**
 * Geração de imagens via fal.ai (Flux Schnell)
 * Identidade visual Oficina1 — Prompt Mestre Junho 2026
 */

type ResultadoImagem = {
  url: string
  prompt: string
  tipo: 'comercial' | 'autoridade'
}

export async function gerarImagem(
  tema: string,
  objetivo: string,
  textoPost: string,
  tipoPost: 'comercial' | 'autoridade' = 'comercial'
): Promise<ResultadoImagem> {
  const apiKey = process.env.FAL_API_KEY
  if (!apiKey) {
    console.warn('FAL_API_KEY não configurada. Retornando imagem placeholder.')
    return {
      url: `https://placehold.co/1080x1080/000D2B/30F282?text=${encodeURIComponent(tema)}`,
      prompt: 'placeholder',
      tipo: tipoPost,
    }
  }

  const prompt = construirPromptImagem(tema, objetivo, textoPost, tipoPost)

  try {
    const res = await fetch('https://fal.run/fal-ai/flux/schnell', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        image_size: 'square_hd',       // 1024x1024 — próximo do 1080x1080 do LinkedIn
        num_inference_steps: 4,
        num_images: 1,
        enable_safety_checker: true,
        output_format: 'jpeg',
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`fal.ai error ${res.status}: ${err}`)
    }

    const data = await res.json()
    const imageUrl = data.images?.[0]?.url

    if (!imageUrl) throw new Error(`fal.ai sem imagem na resposta: ${JSON.stringify(data)}`)

    return { url: imageUrl, prompt, tipo: tipoPost }
  } catch (err: any) {
    console.error('[IMAGEM] Erro fal.ai:', err?.message ?? err)
    return {
      url: `https://placehold.co/1080x1080/000D2B/30F282?text=${encodeURIComponent(tema.slice(0, 30))}`,
      prompt,
      tipo: tipoPost,
    }
  }
}

function construirPromptImagem(
  tema: string,
  objetivo: string,
  textoPost: string,
  tipo: 'comercial' | 'autoridade'
): string {

  // Extrai conceito visual das primeiras palavras do post
  const primeirasFrases = textoPost.split('.').slice(0, 2).join('. ')
  const palavrasChave = primeirasFrases.split(' ').slice(0, 8).join(' ')

  if (tipo === 'autoridade') {
    // Estilo 2 — Posts pessoais de autoridade do Marcos
    return `Professional LinkedIn post image, square format 1080x1080px.

Visual concept: ${conceituarVisual(tema, objetivo, palavrasChave)}

Style: editorial magazine cover style, clean and sophisticated, premium business publication aesthetic.
Background: pure white or very light off-white. Dark graphite tones as main elements. Minimal neon green (#30F282) accent only, not dominant.
NO text, NO logo, NO brand elements inside the image.
NO generic technology icons (no circuits, no clouds, no globes, no digital displays).
NO people with visible faces.
Lighting: clean, diffused, soft studio light. High contrast between elements and background.
Composition: minimalist, architectural, with strong geometric elements.
Output: photorealistic or realistic illustration, NEVER cartoon, NEVER flat design.`
  }

  // Estilo 1 — Posts comerciais da Oficina1
  const conceito = conceituarVisualComercial(tema, objetivo, palavrasChave)

  return `Professional LinkedIn post image, square format 1080x1080px.

Visual concept: ${conceito}

Color palette (MANDATORY):
- Background: deep navy blue #000D2B (petroleum blue)
- Highlights and accents: neon green #30F282 and turquoise #1AA191
- Subtle geometric pattern in background: rounded L-shapes repeated in grid, slightly lighter than background

Style: cinematic and editorial. Premium corporate photography or realistic illustration.
NO text inside the image (zero AI-generated text).
NO logo or brand marks (will be added separately).
NO generic technology icons (no circuits, no clouds, no globes, no digital grid lines).
NO people with visible faces.
Lighting: dramatic cinematic lighting with rim light in neon green or turquoise, deep shadows.
Composition: centered subject, strong visual metaphor that communicates the business message.
Output: photorealistic or realistic illustration, NEVER cartoon, NEVER flat design, NEVER stock photo aesthetic.`
}

function conceituarVisual(tema: string, objetivo: string, palavrasChave: string): string {
  // Posts de autoridade — conceitos minimalistas
  const mapaConceitosAutoridade: Record<string, string> = {
    'inteligência artificial': 'abstract minimalist representation of AI and human collaboration, geometric shapes suggesting neural connections, clean lines on white background',
    'ia': 'abstract minimalist technology metaphor, precise geometric forms suggesting intelligence and analysis, monochromatic with neon green accent',
    'liderança': 'architectural minimalist composition, strong vertical lines suggesting stability and direction, chessboard or compass metaphor',
    'carreira': 'road perspective, architectural elements suggesting progression and growth, clean geometric composition',
    'gestão': 'organizational chart reimagined as abstract sculpture, geometric balance and structure',
  }

  const temaLower = tema.toLowerCase()
  for (const [chave, conceito] of Object.entries(mapaConceitosAutoridade)) {
    if (temaLower.includes(chave)) return conceito
  }

  return `minimalist editorial concept representing: "${objetivo}". Abstract geometric shapes suggesting ${palavrasChave}. White background, clean composition.`
}

function conceituarVisualComercial(tema: string, objetivo: string, palavrasChave: string): string {
  // Posts comerciais — conceitos cinematográficos com paleta Oficina1
  const mapaConceitosComerciais: Record<string, string> = {
    'protheus': 'modern ERP dashboard interface reflected in dark glass surface, data visualization elements glowing in neon green, corporate control room atmosphere',
    'totvs': 'sophisticated enterprise software environment, screens displaying business intelligence charts in neon green, cinematic dark blue atmosphere',
    'fatos relevantes': 'precision machinery or financial ledger book with neon green digital data flowing, dark cinematic background, metaphor for accuracy and control',
    'fiscal': 'scales of justice or tax documents transformed into glowing data streams, neon green highlights on deep navy background, dramatic lighting',
    'erp': 'interconnected business modules visualized as glowing geometric structures on dark background, system integration metaphor',
    'implementação': 'architectural blueprint or foundation construction metaphor, precise lines in neon green on navy background, suggesting solid infrastructure',
    'customização': 'precision engineering tools or master key, detailed craftsmanship metaphor on dark background with green highlights',
    'migração': 'bridge or pathway between two architectural structures, transformation and transition metaphor, cinematic lighting',
    'licenciamento': 'legal document or contract transformed into digital precision instrument, official seal aesthetic with green glow',
    'financeiro': 'financial charts and data streams in green on dark background, corporate precision metaphor',
    'comercial': 'handshake or partnership metaphor in cinematic lighting, professional business meeting atmosphere on dark background',
  }

  const temaLower = tema.toLowerCase()
  for (const [chave, conceito] of Object.entries(mapaConceitosComerciais)) {
    if (temaLower.includes(chave)) return conceito
  }

  // Fallback genérico para tema não mapeado
  return `cinematic business metaphor representing: "${objetivo}". Scene inspired by: ${palavrasChave}. Deep navy blue environment with neon green accents, dramatic professional atmosphere.`
}
