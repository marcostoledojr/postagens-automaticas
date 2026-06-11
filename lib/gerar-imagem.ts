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
        num_inference_steps: 8,   // aumentado de 4 para 8 → melhor qualidade
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

    // 2. Composita o logo em TODOS os posts (comercial e autoridade)
    const urlComLogo = await compositarLogo(imageUrl, apiKey)
    return { url: urlComLogo, prompt, tipo: tipoPost }

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
      console.warn('[LOGO] logo-oficina1.png não encontrado em public/ — usando imagem sem logo')
      return imageUrl
    }

    // Baixa a imagem gerada
    const imgRes = await fetch(imageUrl)
    if (!imgRes.ok) throw new Error('Erro ao baixar imagem do fal.ai')
    const imgBuffer = Buffer.from(await imgRes.arrayBuffer())

    // Redimensiona o logo para 20% da largura da imagem (aprox 200px de 1024)
    const logoBuffer = await sharp(logoPath)
      .resize(200, null, { fit: 'inside' })
      .toBuffer()

    const logoMeta = await sharp(logoBuffer).metadata()
    const logoW = logoMeta.width ?? 200
    const logoH = logoMeta.height ?? 55

    // Posiciona no canto inferior direito com margem de 36px
    const imgMeta = await sharp(imgBuffer).metadata()
    const imgW = imgMeta.width ?? 1024
    const imgH = imgMeta.height ?? 1024

    const left = imgW - logoW - 36
    const top = imgH - logoH - 36

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
      // Fallback: retorna dados URL base64 direto se upload falhar
      console.warn('[LOGO] Upload para fal.ai falhou, usando imagem sem logo')
      return imageUrl
    }

    const uploadData = await uploadRes.json()
    return uploadData.url ?? imageUrl

  } catch (err: any) {
    console.error('[LOGO] Erro na composição:', err?.message ?? err)
    return imageUrl
  }
}

// ─── Extração de conceito do texto do post ───────────────────────────────────

/**
 * Extrai o conceito central do post analisando o texto completo.
 * Retorna: gancho (primeira frase), palavras-chave, metáfora principal.
 */
function extrairConceitoDoPost(textoPost: string): {
  gancho: string
  palavrasChave: string[]
  metafora: string | null
} {
  const linhas = textoPost.split('\n').filter(l => l.trim().length > 0)
  const gancho = linhas[0]?.trim() ?? ''

  // Palavras-chave: substantivos importantes do texto (ignora stop words)
  const stopWords = new Set([
    'de', 'da', 'do', 'das', 'dos', 'para', 'com', 'por', 'em', 'uma', 'um',
    'que', 'não', 'mas', 'como', 'isso', 'este', 'esta', 'seu', 'sua', 'seus',
    'suas', 'todo', 'toda', 'mais', 'muito', 'quando', 'onde', 'quem', 'nos',
    'nas', 'nos', 'ao', 'aos', 'às', 'já', 'só', 'se', 'ou', 'e', 'a', 'o',
    'na', 'no', 'foi', 'são', 'era', 'está', 'ter', 'tem', 'ser', 'vez',
    'cada', 'antes', 'depois', 'sobre', 'entre', 'ainda', 'sem', 'até',
  ])

  const palavras = textoPost.toLowerCase()
    .replace(/[^\wÀ-ÿ\s]/g, ' ')
    .split(/\s+/)
    .filter(p => p.length >= 5 && !stopWords.has(p))

  // Conta frequência
  const freq: Record<string, number> = {}
  for (const p of palavras) freq[p] = (freq[p] ?? 0) + 1

  const palavrasChave = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([palavra]) => palavra)

  // Detecta metáfora principal (padrões como "como um", "é como", "parece", "imagine")
  const metaforaMatch = textoPost.match(/(?:como um|é como|como uma|parece|imagine|pensa como|funciona como)\s+([^,.!?]{5,40})/i)
  const metafora = metaforaMatch ? metaforaMatch[1].trim() : null

  return { gancho, palavrasChave, metafora }
}

// ─── Construtores de prompt ───────────────────────────────────────────────────

function construirPromptImagem(
  tema: string,
  objetivo: string,
  textoPost: string,
  tipo: 'comercial' | 'autoridade'
): string {
  const conceito = extrairConceitoDoPost(textoPost)
  const temaLower = tema.toLowerCase()

  if (tipo === 'autoridade') {
    return construirPromptAutoridade(temaLower, objetivo, conceito, textoPost)
  } else {
    return construirPromptComercial(temaLower, objetivo, conceito, textoPost)
  }
}

function construirPromptComercial(
  temaLower: string,
  objetivo: string,
  conceito: { gancho: string; palavrasChave: string[]; metafora: string | null },
  textoPost: string
): string {
  const visual = escolherVisualComercial(temaLower, conceito, textoPost)

  return `Cinematic professional LinkedIn post image, square 1080x1080px.

Subject: ${visual}

MANDATORY color palette:
- Background: deep navy blue #000D2B
- Accent light: neon green #30F282
- Secondary accent: turquoise #1AA191
- Subtle L-shaped geometric pattern barely visible against background

Technical style: photorealistic cinematic, dramatic directional lighting, rim light in neon green, deep navy shadows, lens flare suggestion on metallic surfaces.

STRICT RULES — no exceptions:
- Zero text, zero letters, zero numbers inside the image
- Zero logo or brand marks (added separately after generation)
- Zero generic tech icons: no circuits, no clouds, no Wi-Fi symbols, no globes, no grid overlays
- Zero human faces visible (backs, silhouettes, hands are allowed)
- Zero cartoon, flat design, or illustration style

Composition: centered main subject with strong cinematic framing, ~60% subject / 40% atmospheric background, shallow depth of field on background.
Output: photorealistic high-detail render, award-winning commercial photography aesthetic.`
}

function construirPromptAutoridade(
  temaLower: string,
  objetivo: string,
  conceito: { gancho: string; palavrasChave: string[]; metafora: string | null },
  textoPost: string
): string {
  const visual = escolherVisualAutoridade(temaLower, conceito, textoPost)

  return `Editorial LinkedIn post image, square 1080x1080px.

Subject: ${visual}

Color palette:
- Background: pure white or very light warm gray (#F8F7F5)
- Main elements: deep graphite (#1A1A1A) and dark charcoal tones
- Single accent: neon green (#30F282) used sparingly — one element only, not dominant
- Negative space is intentional and should be generous

Technical style: editorial magazine cover, clean studio photography or high-end product photography aesthetic. Minimalist but with clear subject matter — NOT purely abstract.

STRICT RULES — no exceptions:
- Zero text, zero letters, zero numbers inside the image
- Zero logo or brand marks (added separately)
- Zero generic tech icons: no circuits, no clouds, no globes
- Zero human faces visible
- Zero neon colors as dominant (only as accent)
- Zero dark background (must be light/white)

Composition: asymmetric, strong negative space, deliberate visual tension. Subject occupies 30-45% of frame.
Output: high-end editorial photography or realistic product photography, NEVER cartoon, NEVER flat design.`
}

// ─── Escolha de conceito visual por tema ─────────────────────────────────────

function escolherVisualComercial(
  temaLower: string,
  conceito: { gancho: string; palavrasChave: string[]; metafora: string | null },
  textoPost: string
): string {
  // Release / versão / atualização
  if (textoPost.toLowerCase().match(/release|versão|atualização|v12|v11|patch|upgrade|migra/)) {
    return 'A precision mechanical gear system mid-transition, one gear replacing another with glowing neon green contact points, macro cinematic close-up against deep navy background. Metaphor for system version transition.'
  }

  // Licença / custo / investimento / ROI
  if (textoPost.toLowerCase().match(/licen|investimento|custo|economia|valor|preço|contrato|compra/)) {
    return 'A elegant digital scale or balance scale with glowing data streams on one side and green currency light on the other, dark cinematic navy environment, precise engineering aesthetic.'
  }

  // Implantação / projeto / entrega
  if (textoPost.toLowerCase().match(/implanta|projeto|entrega|prazo|cronograma|deploy|go.live|lançamento/)) {
    return 'Architectural blueprint perspective view of a building foundation being laid with neon green laser alignment lines, cinematic overhead angle, deep navy environment.'
  }

  // Integração / API / conexão
  if (textoPost.toLowerCase().match(/integra|api|conex|automação|webhook|erp|módulo|sincroniza/)) {
    return 'Two premium metallic server racks or circuit components connecting via a glowing neon green bridge of light, cinematic dark environment, macro precision photography.'
  }

  // Financeiro / fiscal / contabilidade / SPED
  if (textoPost.toLowerCase().match(/fiscal|financeiro|contábil|sped|nfe|nota fiscal|tribut|impostos?/)) {
    return 'Close-up of precision financial ledger or compliance form being processed by a robotic arm with neon green light tracing the document, dark cinematic background, ultra detailed.'
  }

  // Customização / desenvolvimento / código
  if (textoPost.toLowerCase().match(/customiz|desenvolv|código|advpl|programação|personaliz/)) {
    return 'Master craftsman hands (viewed from above, no face) working with precision tools on a complex dark metallic surface with green glowing circuit-like engravings, macro cinematic.'
  }

  // Suporte / atendimento / parceria / consultoria
  if (temaLower.includes('comercial') || textoPost.toLowerCase().match(/parceria|estratég|diagnóstico|consultor/)) {
    return 'A lone professional figure in silhouette against a floor-to-ceiling window in a modern high-rise at night, the city lights in navy blue and green below, contemplative strategic positioning.'
  }

  // TOTVS / Protheus genérico
  if (temaLower.includes('protheus') || temaLower.includes('totvs')) {
    return 'Premium enterprise ERP dashboard interface reflected on a polished dark glass desk surface, neon green data charts floating above, cinematic corporate control room atmosphere at night.'
  }

  // Fatos relevantes / notícias / mercado
  if (temaLower.includes('fatos') || temaLower.includes('relevantes')) {
    return 'A dramatic close-up of a high-precision compass or navigational instrument resting on a dark surface, neon green indicator light, cinematic depth of field. Metaphor for navigating relevant information.'
  }

  // Fallback comercial
  return `Premium corporate environment visual metaphor for: ${conceito.palavrasChave.slice(0, 3).join(', ')}. Dark navy background, neon green accent light, cinematic business photography.`
}

function escolherVisualAutoridade(
  temaLower: string,
  conceito: { gancho: string; palavrasChave: string[]; metafora: string | null },
  textoPost: string
): string {
  const textoLower = textoPost.toLowerCase()

  // IA / inteligência artificial / Claude / automação
  if (temaLower.includes('artificial') || temaLower.includes(' ia') || temaLower.startsWith('ia') || textoLower.match(/inteligência artificial|claude|gemini|chatgpt|modelo de linguagem|llm/)) {
    if (textoLower.match(/prioridade|todos|empresas|mercado|adoção/)) {
      return 'Close-up of hands typing on a sleek dark laptop keyboard, a subtle holographic visualization in soft neon green glow rising from the screen, white studio background, editorial photography.'
    }
    if (textoLower.match(/ferramenta|usar|prático|dia a dia|trabalho|produtiv/)) {
      return 'A single premium mechanical pencil resting on a clean white surface next to a sleek open laptop showing abstract code reflection, minimal editorial still life, one neon green accent.'
    }
    return 'Person viewed from behind (no face) facing a large monitor with subtle AI visualization in a minimal white-walled modern office, clean editorial composition, soft neon green highlight on screen edge.'
  }

  // Liderança / gestão / decisão / reunião
  if (textoLower.match(/lideranç|gestão|decisão|reunião|consenso|equipe|time|cultura/)) {
    if (textoLower.match(/medo|silêncio|concordan|pressão|constrangimento/)) {
      return 'Empty modern boardroom with a single empty chair at the head of the table, dramatic side lighting creating deep shadows, white walls, graphite furniture. Metaphor for absent voice or avoided conversation.'
    }
    return 'Close-up of a single chess king piece (dark graphite) standing alone on a minimal white surface, dramatic directional lighting, deep shadows, editorial product photography.'
  }

  // Carreira / trajetória / crescimento
  if (textoLower.match(/carreira|trajetória|crescimento|aprendizado|experiência|anos|mercado/)) {
    return 'A minimalist staircase photographed from below looking up, graphite tones against white walls, strong geometric lines, editorial architectural photography.'
  }

  // Negócio / empresa / estratégia
  if (textoLower.match(/negócio|empresa|estratégia|resultado|crescimento|processo/)) {
    return 'Two abstract geometric dark forms — one sharp angular, one smooth curved — resting on a white surface, suggesting complementary forces, editorial still life photography.'
  }

  // Reflexão / pensamento / opinião
  if (textoLower.match(/percebi|aprendi|reflexão|pensar|questão|perspectiva/)) {
    return 'A single dark stone or architectural fragment resting on an empty white surface, long dramatic shadow from side lighting, minimal editorial photography. Metaphor for a grounding observation.'
  }

  // Fallback autoridade
  return `Minimalist editorial still life representing: ${conceito.palavrasChave.slice(0, 2).join(' and ')}. One or two dark graphite objects on white background, dramatic side lighting, one neon green accent element, premium magazine cover aesthetic.`
}
