/**
 * Geração de imagens via fal.ai (Flux Dev — qualidade cinematic)
 * Identidade visual Oficina1 — Prompt Mestre v3.0 — Junho 2026
 * Logo compositado via Supabase Storage (confiável)
 */

import path from 'path'
import fs from 'fs'
import { createClient } from './supabase-server'

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
    // 1. Gera imagem com Flux Dev (qualidade muito superior ao Schnell)
    const res = await fetch('https://fal.run/fal-ai/flux/dev', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        image_size: 'square_hd',     // 1024×1024
        num_inference_steps: 20,      // Flux Dev: 20 = ótima qualidade, ~15s
        guidance_scale: 3.5,
        num_images: 1,
        enable_safety_checker: true,
        output_format: 'jpeg',
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`fal.ai Flux Dev error ${res.status}: ${err}`)
    }

    const data = await res.json()
    const imageUrl = data.images?.[0]?.url
    if (!imageUrl) throw new Error(`fal.ai sem imagem: ${JSON.stringify(data)}`)

    // 2. Composita logo e sobe para Supabase Storage
    const urlFinal = await compositarLogoSupabase(imageUrl)
    return { url: urlFinal, prompt, tipo: tipoPost }

  } catch (err: any) {
    console.error('[IMAGEM] Erro no Flux Dev:', err?.message ?? err)
    // Fallback para Flux Schnell se Flux Dev falhar
    return await gerarImagemFallback(tema, objetivo, textoPost, tipoPost, prompt, apiKey)
  }
}

// ─── Fallback: Flux Schnell se Dev falhar ────────────────────────────────────

async function gerarImagemFallback(
  tema: string,
  objetivo: string,
  textoPost: string,
  tipoPost: 'comercial' | 'autoridade',
  prompt: string,
  apiKey: string
): Promise<ResultadoImagem> {
  try {
    console.warn('[IMAGEM] Usando Flux Schnell como fallback')
    const res = await fetch('https://fal.run/fal-ai/flux/schnell', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        image_size: 'square_hd',
        num_inference_steps: 8,
        num_images: 1,
        enable_safety_checker: true,
        output_format: 'jpeg',
      }),
    })

    if (!res.ok) throw new Error(`Flux Schnell error ${res.status}`)
    const data = await res.json()
    const imageUrl = data.images?.[0]?.url
    if (!imageUrl) throw new Error('Sem imagem no fallback')

    const urlFinal = await compositarLogoSupabase(imageUrl)
    return { url: urlFinal, prompt, tipo: tipoPost }
  } catch (err: any) {
    console.error('[IMAGEM] Fallback também falhou:', err?.message)
    return {
      url: `https://placehold.co/1080x1080/000D2B/30F282?text=${encodeURIComponent(tema.slice(0, 30))}`,
      prompt,
      tipo: tipoPost,
    }
  }
}

// ─── Logo via Supabase Storage ────────────────────────────────────────────────

async function compositarLogoSupabase(imageUrl: string): Promise<string> {
  const BUCKET = 'post-images'

  try {
    const sharp = (await import('sharp')).default

    // Verifica se logo existe
    const logoPath = path.join(process.cwd(), 'public', 'logo-oficina1.png')
    if (!fs.existsSync(logoPath)) {
      console.warn('[LOGO] logo-oficina1.png não encontrado em public/')
      return imageUrl
    }

    // Baixa imagem gerada
    const imgRes = await fetch(imageUrl, { signal: AbortSignal.timeout(15000) })
    if (!imgRes.ok) throw new Error(`Erro ao baixar imagem: ${imgRes.status}`)
    const imgBuffer = Buffer.from(await imgRes.arrayBuffer())

    // Redimensiona logo para 18% da largura (≈185px de 1024)
    const logoBuffer = await sharp(logoPath)
      .resize(185, null, { fit: 'inside' })
      .toBuffer()

    const logoMeta = await sharp(logoBuffer).metadata()
    const logoW = logoMeta.width ?? 185
    const logoH = logoMeta.height ?? 50

    // Posição: canto inferior direito com margem de 32px
    const imgMeta = await sharp(imgBuffer).metadata()
    const imgW = imgMeta.width ?? 1024
    const imgH = imgMeta.height ?? 1024

    const left = imgW - logoW - 32
    const top  = imgH - logoH - 32

    // Composita o logo sobre a imagem
    const composited = await sharp(imgBuffer)
      .composite([{ input: logoBuffer, left, top, blend: 'over' }])
      .jpeg({ quality: 92 })
      .toBuffer()

    // Sobe para Supabase Storage
    const supabase = createClient()
    const fileName = `post-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`

    // Tenta criar o bucket se não existir (ignora erro se já existe)
    await supabase.storage.createBucket(BUCKET, { public: true }).catch(() => {})

    const { data: uploaded, error: uploadErr } = await supabase.storage
      .from(BUCKET)
      .upload(fileName, composited, {
        contentType: 'image/jpeg',
        upsert: false,
      })

    if (uploadErr) {
      console.error('[LOGO] Erro no upload Supabase:', uploadErr.message)
      return imageUrl // fallback sem logo
    }

    const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(uploaded.path)
    console.log('[LOGO] Composição OK →', publicUrl)
    return publicUrl

  } catch (err: any) {
    console.error('[LOGO] Erro na composição do logo:', err?.message ?? err)
    return imageUrl // fallback: imagem sem logo
  }
}

// ─── Extração de conceito do texto do post ───────────────────────────────────

function extrairConceitoDoPost(textoPost: string): {
  gancho: string
  palavrasChave: string[]
  metafora: string | null
} {
  const linhas = textoPost.split('\n').filter(l => l.trim().length > 0)
  const gancho = linhas[0]?.trim() ?? ''

  const stopWords = new Set([
    'de', 'da', 'do', 'das', 'dos', 'para', 'com', 'por', 'em', 'uma', 'um',
    'que', 'não', 'mas', 'como', 'isso', 'este', 'esta', 'seu', 'sua', 'seus',
    'suas', 'todo', 'toda', 'mais', 'muito', 'quando', 'onde', 'quem', 'nos',
    'nas', 'nos', 'ao', 'aos', 'às', 'já', 'só', 'se', 'ou', 'e', 'a', 'o',
    'na', 'no', 'foi', 'são', 'era', 'está', 'ter', 'tem', 'ser', 'vez',
    'cada', 'antes', 'depois', 'sobre', 'entre', 'ainda', 'sem', 'até',
    'sempre', 'nunca', 'pode', 'deve', 'precisa', 'faz', 'fazer', 'feito',
  ])

  const palavras = textoPost.toLowerCase()
    .replace(/[^\wÀ-ÿ\s]/g, ' ')
    .split(/\s+/)
    .filter(p => p.length >= 5 && !stopWords.has(p))

  const freq: Record<string, number> = {}
  for (const p of palavras) freq[p] = (freq[p] ?? 0) + 1

  const palavrasChave = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([palavra]) => palavra)

  const metaforaMatch = textoPost.match(
    /(?:como um|é como|como uma|parece|imagine|funciona como|é o mesmo que)\s+([^,.!?]{5,40})/i
  )
  const metafora = metaforaMatch ? metaforaMatch[1].trim() : null

  return { gancho, palavrasChave, metafora }
}

// ─── Builder principal ────────────────────────────────────────────────────────

function construirPromptImagem(
  tema: string,
  objetivo: string,
  textoPost: string,
  tipo: 'comercial' | 'autoridade'
): string {
  const conceito = extrairConceitoDoPost(textoPost)
  const temaLower = tema.toLowerCase()

  return tipo === 'autoridade'
    ? construirPromptAutoridade(temaLower, objetivo, conceito, textoPost)
    : construirPromptComercial(temaLower, objetivo, conceito, textoPost)
}

// ─── Prompt Comercial (fundo navy, verde neon) ────────────────────────────────

function construirPromptComercial(
  temaLower: string,
  objetivo: string,
  conceito: { gancho: string; palavrasChave: string[]; metafora: string | null },
  textoPost: string
): string {
  const visual = escolherVisualComercial(temaLower, conceito, textoPost)

  return `Cinematic professional photograph for a B2B LinkedIn post, square 1080x1080 format.

SCENE: ${visual}

COLOR PALETTE (mandatory):
- Background: deep navy blue, almost black (#000D2B)
- Primary accent: neon green (#30F282) as rim light, reflection, or glow on metallic surfaces
- Secondary: dark teal (#1AA191) used sparingly
- Overall mood: premium corporate, dark and sleek

PHOTOGRAPHY STYLE: High-end commercial photography. Dramatic single-source lighting from upper left or right. Strong rim light in neon green on key edges. Shallow depth of field — background slightly blurred. Film grain texture, subtle lens flare. Professional product or architectural photography aesthetic.

ABSOLUTE PROHIBITIONS (zero exceptions):
- No text, letters, numbers, or symbols of any kind in the image
- No logos, brand marks, watermarks (added separately in post-production)
- No tech clichés: no circuit boards, no Wi-Fi signals, no clouds, no globes, no grid overlays, no binary code
- No human faces (backs, silhouettes, and hands are acceptable)
- No cartoon style, no flat design, no illustration, no gradients
- No stock-photo look — must look like editorial commercial photography

COMPOSITION: Rule of thirds. Main subject occupies center-left or center, atmospheric negative space on right. Bokeh background in deep navy.

OUTPUT: Ultra-detailed photorealistic render. 8K quality. Award-winning commercial photography.`
}

// ─── Prompt Autoridade (fundo claro, minimalista) ─────────────────────────────

function construirPromptAutoridade(
  temaLower: string,
  objetivo: string,
  conceito: { gancho: string; palavrasChave: string[]; metafora: string | null },
  textoPost: string
): string {
  const visual = escolherVisualAutoridade(temaLower, conceito, textoPost)

  return `Editorial LinkedIn post photograph, square 1080x1080 format.

SCENE: ${visual}

COLOR PALETTE (mandatory):
- Background: pure white or warm light gray (#F5F5F3)
- Objects: dark graphite (#1A1A1A) and matte charcoal tones
- Accent: a single neon green (#30F282) element — used ONCE, small, as a visual focal point
- Generous negative space — minimalism is intentional

PHOTOGRAPHY STYLE: High-end editorial magazine photography. Studio lighting, soft shadows, impeccable detail. Think Bloomberg Businessweek cover or Harvard Business Review editorial. Clean, confident, sophisticated. NOT decorative — purposeful.

ABSOLUTE PROHIBITIONS (zero exceptions):
- No text, letters, numbers, or symbols
- No logos or brand marks
- No dark background (must be white or very light)
- No neon colors dominating the image (only as one small accent)
- No human faces
- No cartoon, flat design, or illustration
- No generic office stock photography look

COMPOSITION: Asymmetric. Subject occupies 30-40% of frame, deliberate negative space. Strong shadow creates visual depth. Single point of interest.

OUTPUT: Ultra-detailed photorealistic render. 8K quality. Premium editorial photography.`
}

// ─── Escolha de visual por tema/conteúdo ─────────────────────────────────────

function escolherVisualComercial(
  temaLower: string,
  conceito: { gancho: string; palavrasChave: string[]; metafora: string | null },
  textoPost: string
): string {
  const t = textoPost.toLowerCase()

  // Release / versão / atualização
  if (t.match(/release|versão|atualiza|v12|v11|patch|upgrade|migra/)) {
    return 'Macro close-up of a precision mechanical lock mechanism mid-transition: one tumbler rotating to a new position, neon green light tracing the moving part, droplets of condensation on the dark metal surface. Ultra detailed, cinematic lighting. Metaphor: system version transition.'
  }

  // Licença / custo / investimento
  if (t.match(/licen|investimento|custo|economia|valor|preço|contrato|compra/)) {
    return 'A precision jeweler\'s scale made of dark steel, one side holding a glowing neon green geometric solid, the other empty and tilted slightly down. Shot from a low angle, navy background, dramatic rim lighting. Metaphor: investment decision and ROI balance.'
  }

  // Implantação / projeto / entrega / go-live
  if (t.match(/implanta|projeto|entrega|prazo|cronograma|deploy|go.live|lançamento/)) {
    return 'An architect\'s technical compass — dark brushed steel — precisely placed on a black drafting surface, a single neon green laser line crossing the drawing. Top-down angle, dramatic shadows. Metaphor: precision project planning.'
  }

  // Integração / conexão / ERP / módulos
  if (t.match(/integra|api|conex|módulo|sincroniza|webhook/)) {
    return 'Two dark metallic connectors with male and female ends, aligned perfectly but not yet touching, a neon green arc of electrical light bridging the gap between them. Macro lens, navy background, ultra crisp. Metaphor: system integration.'
  }

  // Fiscal / tributário / contabilidade
  if (t.match(/fiscal|financeiro|contábil|sped|nfe|nota fiscal|tribut|reform|imposto/)) {
    return 'A stack of dark leather folders or bound documents on a black surface, one document partially open revealing neon green highlighted lines. Dramatic overhead lighting, deep shadows, editorial feel. Metaphor: fiscal compliance and documentation.'
  }

  // Customização / desenvolvimento
  if (t.match(/customiz|desenvolv|código|advpl|programação|personaliz/)) {
    return 'Close-up of a craftsman\'s hand (no face) using a precision engraving tool on a dark metal surface, sparks of neon green light where the tool meets the material. Shallow depth of field. Metaphor: bespoke system customization.'
  }

  // Suporte / parceria / consultoria / quando o ERP falha
  if (t.match(/parceria|consultor|diagnóstico|suporte|parou|falhou|travou|instável/)) {
    return 'A dark executive desk surface at night, a single focused desk lamp in neon green casting dramatic light on an open notebook and a sleek pen. Only the hands visible (no face). City lights blurred in background window. Metaphor: strategic consulting partnership.'
  }

  // TOTVS / Protheus genérico
  if (temaLower.match(/protheus|totvs|erp/)) {
    return 'A high-end dark server room corridor: two rows of glossy black server racks extending to a vanishing point, neon green status lights creating a hypnotic symmetrical pattern. No human visible. Cinematic ultra-wide perspective. Metaphor: enterprise infrastructure.'
  }

  // Fatos relevantes / notícias
  if (temaLower.match(/fatos|relevantes/)) {
    return 'A dark obsidian monolith or premium black stone tablet on a navy surface, a single neon green line of light cutting across it diagonally. Minimalist and powerful. Long shadows from directional lighting. Metaphor: impactful information.'
  }

  // Fallback comercial
  const kw = conceito.palavrasChave.slice(0, 3).join(', ')
  return `A single premium object related to "${kw}" — dark metal or glass, sitting on a navy reflective surface. Neon green rim light on one edge. Ultra macro detail, cinematic shallow depth of field. B2B editorial commercial photography.`
}

function escolherVisualAutoridade(
  temaLower: string,
  conceito: { gancho: string; palavrasChave: string[]; metafora: string | null },
  textoPost: string
): string {
  const t = textoPost.toLowerCase()

  // IA / inteligência artificial / ferramentas
  if (temaLower.match(/artificial|intelig| ia$|^ia /) || t.match(/inteligência artificial|chatgpt|gemini|claude|llm|modelo de linguagem/)) {
    if (t.match(/ferramenta|usar|prático|trabalho|produtiv|método/)) {
      return 'Top-down flat lay: a sleek dark laptop keyboard, a Moleskine notebook open to a blank page, and a mechanical pencil — arranged geometrically on a white surface. A single neon green pen cap placed deliberately off-center. Studio overhead lighting, perfect shadows.'
    }
    if (t.match(/pensar|raciocínio|inteligente|profissional|vantagem/)) {
      return 'A single dark graphite chess knight piece standing alone on a white marble surface. Dramatic raking side light from the right, casting a long sharp shadow to the left. One neon green dot reflection on the surface. Minimalist editorial photography.'
    }
    return 'Close-up of hands (no face visible, wrists and above) hovering over a sleek laptop keyboard, fingertips not quite touching the keys yet. Clean white background, soft studio light from above, deliberate shallow focus on the fingertips.'
  }

  // Liderança / gestão / equipe / cultura
  if (t.match(/lideranç|gestão|equipe|time|cultura|decis|reunião|consenso/)) {
    if (t.match(/medo|silêncio|concordan|pressão|difícil/)) {
      return 'An empty modern conference room: long white table, chairs aligned, one chair at the head of the table slightly pushed back as if someone just stood up. Directional light from a tall window, long shadows across the table. One neon green pen left on the surface.'
    }
    return 'A single dark graphite chess king piece — tall, worn slightly — resting upright on a flat white marble surface. Single directional light source from the side creating dramatic shadow three times longer than the piece itself. Macro lens.'
  }

  // Carreira / trajetória / experiência / anos
  if (t.match(/carreira|trajetória|anos|experiência|aprendizado|crescimento/)) {
    return 'A winding minimalist staircase photographed from the bottom looking up: white walls, dark graphite handrail, geometric lines. One step has a small neon green geometric shape resting on it. High-contrast editorial architectural photography.'
  }

  // Percepção / reflexão / insight / opinião
  if (t.match(/percebi|aprendi|reflexão|pensar|questão|perspectiva|observ/)) {
    return 'A smooth dark river stone — perfect oval, matte black — resting alone on a white cotton surface. Single directional light from the left, shadow extending to the right three times its length. A tiny neon green fragment of mineral visible in the stone. Macro editorial.'
  }

  // Negócio / empresa / estratégia / resultado
  if (t.match(/negócio|empresa|estratégia|resultado|processo|operaç/)) {
    return 'An executive\'s desk corner: dark leather agenda open, a premium fountain pen resting diagonally across it, matte black business cards fanned slightly. White background, dramatic overhead spot light. Neon green line barely visible as a ruler or credit card edge.'
  }

  // Fallback autoridade
  const kw = conceito.palavrasChave.slice(0, 2).join(' and ')
  return `Minimal editorial still life representing "${kw}": one or two dark graphite objects — premium, intentional, specific — placed asymmetrically on a pure white surface. Single directional light source from upper right. Long dramatic shadow. One small neon green accent element. Premium magazine aesthetic.`
}
