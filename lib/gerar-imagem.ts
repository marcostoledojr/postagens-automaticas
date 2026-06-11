/**
 * Geração de imagens via fal.ai (Flux Schnell)
 * Identidade visual Oficina1 — Prompt Mestre Junho 2026
 * Inclui composição automática do logo via sharp
 */

import path from 'path'
import fs from 'fs'

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
    // 1. Gera imagem base com fal.ai
    const res = await fetch('https://fal.run/fal-ai/flux/schnell', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        image_size: 'square_hd',
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
    if (!imageUrl) throw new Error(`fal.ai sem imagem: ${JSON.stringify(data)}`)

    // 2. Para posts comerciais, composita o logo
    if (tipoPost === 'comercial') {
      const urlComLogo = await compositarLogo(imageUrl, apiKey)
      return { url: urlComLogo, prompt, tipo: tipoPost }
    }

    return { url: imageUrl, prompt, tipo: tipoPost }

  } catch (err: any) {
    console.error('[IMAGEM] Erro:', err?.message ?? err)
    return {
      url: `https://placehold.co/1080x1080/000D2B/30F282?text=${encodeURIComponent(tema.slice(0, 30))}`,
      prompt,
      tipo: tipoPost,
    }
  }
}

async function compositarLogo(imageUrl: string, falApiKey: string): Promise<string> {
  try {
    const sharp = (await import('sharp')).default

    // Busca o logo na pasta public
    const logoPath = path.join(process.cwd(), 'public', 'logo-oficina1.png')
    if (!fs.existsSync(logoPath)) {
      console.warn('[LOGO] logo-oficina1.png não encontrado em public/')
      return imageUrl
    }

    // Baixa a imagem gerada
    const imgRes = await fetch(imageUrl)
    if (!imgRes.ok) throw new Error('Erro ao baixar imagem do fal.ai')
    const imgBuffer = Buffer.from(await imgRes.arrayBuffer())

    // Redimensiona o logo para ~22% da largura da imagem (aprox 225px de 1024)
    const logoBuffer = await sharp(logoPath)
      .resize(225, null, { fit: 'inside' })
      .toBuffer()

    const logoMeta = await sharp(logoBuffer).metadata()
    const logoW = logoMeta.width ?? 225
    const logoH = logoMeta.height ?? 60

    // Posiciona no canto inferior direito com margem de 40px
    const imgMeta = await sharp(imgBuffer).metadata()
    const imgW = imgMeta.width ?? 1024
    const imgH = imgMeta.height ?? 1024

    const left = imgW - logoW - 40
    const top = imgH - logoH - 40

    // Composita logo sobre a imagem
    const composited = await sharp(imgBuffer)
      .composite([{
        input: logoBuffer,
        left,
        top,
        blend: 'over',
      }])
      .jpeg({ quality: 90 })
      .toBuffer()

    // Faz upload do resultado para o fal.ai storage
    const uploadRes = await fetch('https://rest.alpha.fal.ai/storage/upload/base64', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${falApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        file_name: `post-oficina1-${Date.now()}.jpg`,
        content_type: 'image/jpeg',
        b64_data: composited.toString('base64'),
      }),
    })

    if (!uploadRes.ok) {
      console.warn('[LOGO] Upload para fal.ai falhou, usando imagem sem logo')
      return imageUrl
    }

    const uploadData = await uploadRes.json()
    return uploadData.url ?? imageUrl

  } catch (err: any) {
    console.error('[LOGO] Erro na composição:', err?.message ?? err)
    return imageUrl // Retorna sem logo em caso de erro
  }
}

function construirPromptImagem(
  tema: string,
  objetivo: string,
  textoPost: string,
  tipo: 'comercial' | 'autoridade'
): string {
  const primeirasFrases = textoPost.split('.').slice(0, 2).join('. ')
  const palavrasChave = primeirasFrases.split(' ').slice(0, 8).join(' ')

  if (tipo === 'autoridade') {
    return `Professional LinkedIn post image, square format 1080x1080px.

Visual concept: ${conceituarVisual(tema, objetivo, palavrasChave)}

Style: editorial magazine cover style, clean and sophisticated, premium business publication aesthetic.
Background: pure white or very light off-white. Dark graphite tones as main elements. Minimal neon green (#30F282) accent only.
NO text, NO logo, NO brand elements inside the image.
NO generic technology icons (no circuits, no clouds, no globes).
NO people with visible faces.
Lighting: clean, diffused, soft studio light.
Composition: minimalist, architectural, strong geometric elements.
Output: photorealistic or realistic illustration, NEVER cartoon, NEVER flat design.`
  }

  const conceito = conceituarVisualComercial(tema, objetivo, palavrasChave)

  return `Professional LinkedIn post image, square format 1080x1080px.

Visual concept: ${conceito}

Color palette (MANDATORY):
- Background: deep navy blue #000D2B
- Highlights: neon green #30F282 and turquoise #1AA191
- Subtle geometric pattern: rounded L-shapes in grid, slightly lighter than background

Style: cinematic and editorial. Premium corporate.
NO text inside the image (zero AI-generated text or letters).
NO logo or brand marks (added separately).
NO generic technology icons (no circuits, no clouds, no globes, no grid lines).
NO people with visible faces.
Lighting: dramatic cinematic with rim light in neon green, deep shadows.
Composition: centered subject, strong visual metaphor.
Output: photorealistic or realistic illustration, NEVER cartoon, NEVER flat design.`
}

function conceituarVisual(tema: string, objetivo: string, palavrasChave: string): string {
  const mapaConceitosAutoridade: Record<string, string> = {
    'inteligência artificial': 'abstract minimalist representation of AI and human collaboration, geometric shapes suggesting neural connections, clean lines on white background',
    'ia': 'abstract minimalist technology metaphor, precise geometric forms suggesting intelligence, monochromatic with neon green accent',
    'liderança': 'architectural minimalist composition, strong vertical lines suggesting stability and direction, chess piece or compass metaphor',
    'carreira': 'road perspective, architectural elements suggesting progression and growth',
    'gestão': 'organizational structure reimagined as abstract sculpture, geometric balance',
  }
  const temaLower = tema.toLowerCase()
  for (const [chave, conceito] of Object.entries(mapaConceitosAutoridade)) {
    if (temaLower.includes(chave)) return conceito
  }
  return `minimalist editorial concept representing: "${objetivo}". Abstract geometric shapes suggesting ${palavrasChave}. White background.`
}

function conceituarVisualComercial(tema: string, objetivo: string, palavrasChave: string): string {
  const mapaConceitos: Record<string, string> = {
    'protheus': 'modern ERP dashboard interface reflected in dark glass surface, data visualization elements glowing in neon green, corporate control room atmosphere',
    'totvs': 'sophisticated enterprise software environment, screens displaying business intelligence charts in neon green, cinematic dark blue atmosphere',
    'fatos relevantes': 'precision financial ledger or compliance document transformed into glowing neon green data streams, dark cinematic background, metaphor for accuracy and operational control',
    'fiscal': 'scales of justice or tax system transformed into glowing data streams, neon green highlights on deep navy',
    'erp': 'interconnected business modules visualized as glowing geometric structures, system integration metaphor on dark background',
    'implementação': 'architectural blueprint or strong foundation metaphor, precise lines in neon green on navy background',
    'customização': 'precision engineering or master key metaphor on dark background with green highlights',
    'migração': 'bridge between two architectural structures, transformation metaphor, cinematic lighting',
    'financeiro': 'financial data streams and charts in neon green on dark background, corporate precision',
    'comercial': 'professional handshake or strategic partnership in cinematic lighting, dark atmosphere with green accents',
  }
  const temaLower = tema.toLowerCase()
  for (const [chave, conceito] of Object.entries(mapaConceitos)) {
    if (temaLower.includes(chave)) return conceito
  }
  return `cinematic business metaphor representing: "${objetivo}". Inspired by: ${palavrasChave}. Deep navy blue environment with neon green accents.`
}
