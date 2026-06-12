/**
 * Geração de imagens via fal.ai (Flux Dev — qualidade cinematic)
 * Identidade visual Oficina1 — Prompt Mestre v4.0 — Junho 2026
 * Claude Sonnet como diretor de arte + fallback keyword-based
 * Logo compositado via Supabase Storage
 */

import path from 'path'
import fs from 'fs'
import { createClient } from './supabase-server'

type ResultadoImagem = {
  url: string
  prompt: string
  tipo: 'comercial' | 'autoridade'
}

// ─── Claude como Diretor de Arte ─────────────────────────────────────────────

const SYSTEM_PROMPT_ARTE_DIRETOR = `You are a news photo editor commissioning the hero image for a business magazine article. Write ONE Flux Dev image generation prompt (75-100 words, English only) for Oficina1 (Brazilian B2B company, TOTVS Protheus ERP specialists).

THE ONLY TEST: Someone sees the image WITHOUT seeing the post text and immediately says "this is about [specific topic]" — not "this is generic corporate content."

YOUR PROCESS:
1. Identify the EXACT TOPIC from the post
2. Match it to the CANONICAL SCENE LIBRARY below
3. Lead your prompt with THAT SCENE: specific people + specific visible objects + specific action
4. Add atmosphere, then lighting, then brand element last

SCENE-BUILDING METHOD (apply to ANY topic — not a closed list):

Step A — Ask: "What is the ONE physical action or situation this post is really about?"
Step B — Identify the KEY PROP that makes this topic unmistakable: the specific screen content, document type, physical object, or human interaction that NAMES the topic to a viewer
Step C — Describe WHO is doing WHAT with THAT PROP, in what specific setting

REFERENCE EXAMPLES (to calibrate the required level of specificity — invent new scenes for topics not listed):

→ ERP failure: three workers around a monitor showing a red error dialog, one on the phone — KEY PROP: crashed screen
→ Tax compliance: accountant's hands sorting NF-e printouts and regulation binders, deadline calendar visible — KEY PROP: fiscal documents
→ AI in ERP: split workstation, left = cluttered ERP grid, right = clean AI analysis appearing — KEY PROP: before/after screens
→ Project go-live: team in front of completion screen, physical kanban with columns on wall — KEY PROP: kanban + milestone
→ Leadership: manager explaining whiteboard diagrams to seated team, one taking notes — KEY PROP: human coaching interaction
→ Career: senior and junior over career portfolio documents, senior pointing to a section — KEY PROP: mentorship dynamic

FOR ANY OTHER TOPIC — apply the same method and invent the appropriate scene:
- Customer success → client and consultant reviewing results dashboard together, satisfaction visible
- Hiring/talent → interview scene, printed resume on table, two people in engaged conversation
- Product update → developer's hands, new feature visible on screen, release interface open
- Pricing/proposal → two professionals comparing printed proposals side by side, pen poised
- Training/workshop → instructor at front, participants with open notebooks, whiteboard with content
- ANY TOPIC → ask "what literal physical scene would a news photographer capture for this article?"

THEN ADD:
- ONE neon green (#30F282) element: screen glow, sticky note, indicator, pen accent, or light
- Photorealistic documentary corporate photography
- ONE specific light source + "35mm" or "50mm lens, f/2.8"
- Environment matching mood: CRISIS = harsh/emergency lighting; SOLUTION = bright office; AUTHORITY = soft natural window light

NEVER: vague "a person at a computer" without specifying WHAT IS ON SCREEN; full faces; handshakes; lightbulbs; generic bar charts; abstract metaphors that don't show the specific topic; glass walls/mirrors/reflective surfaces behind people (Flux hallucinates duplicate reflected figures); sticky-note-covered glass walls as primary scene; financial trading charts; "8K"; "masterpiece"

OUTPUT: Only the English prompt. Lead with the scene. 75-100 words. Nothing else.`


async function gerarPromptViaClaude(
  tema: string,
  textoPost: string,
  tipo: 'comercial' | 'autoridade'
): Promise<string | null> {
  const anthropicKey = process.env.ANTHROPIC_API_KEY
  if (!anthropicKey) return null

  try {
    const tipoDesc = tipo === 'autoridade'
      ? 'AUTORIDADE (reflexão, carreira, liderança — ambiente claro, minimalista)'
      : 'COMERCIAL (produto, solução, ERP — ambiente adequado ao mood do texto)'

    const userMsg = `LINKEDIN POST:\n"""\n${textoPost.slice(0, 1500)}\n"""\n\nTOPIC: ${tema}\nPOST TYPE: ${tipoDesc}`

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 500,
        system: SYSTEM_PROMPT_ARTE_DIRETOR,
        messages: [{ role: 'user', content: userMsg }],
      }),
    })

    if (!res.ok) {
      console.warn('[IMAGEM] Claude API error:', res.status)
      return null
    }

    const data = await res.json()
    const prompt = data.content?.[0]?.text?.trim()
    if (!prompt || prompt.length < 50) return null

    console.log('[IMAGEM] Prompt gerado pelo Claude Sonnet ✓')
    return prompt
  } catch (err: any) {
    console.warn('[IMAGEM] Claude falhou, usando fallback:', err?.message)
    return null
  }
}

// ─── Função principal ─────────────────────────────────────────────────────────

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

  // 1. Gera prompt via Claude Sonnet (director de arte) ou fallback keyword-based
  const claudePrompt = await gerarPromptViaClaude(tema, textoPost, tipoPost)
  const prompt = claudePrompt ?? construirPromptFallback(tema, textoPost, tipoPost)

  try {
    // 2. Gera imagem com Flux Dev
    const res = await fetch('https://fal.run/fal-ai/flux/dev', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        image_size: 'square_hd',
        num_inference_steps: 20,
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

    // 3. Composita logo e sobe para Supabase Storage
    const urlFinal = await compositarLogoSupabase(imageUrl)
    return { url: urlFinal, prompt, tipo: tipoPost }

  } catch (err: any) {
    console.error('[IMAGEM] Erro no Flux Dev:', err?.message ?? err)
    return await gerarImagemFallback(tema, textoPost, tipoPost, prompt, apiKey)
  }
}

// ─── Fallback: Flux Schnell se Dev falhar ────────────────────────────────────

async function gerarImagemFallback(
  tema: string,
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

    const logoPath = path.join(process.cwd(), 'public', 'logo-oficina1.png')
    if (!fs.existsSync(logoPath)) {
      console.warn('[LOGO] logo-oficina1.png não encontrado em public/')
      return imageUrl
    }

    const imgRes = await fetch(imageUrl, { signal: AbortSignal.timeout(15000) })
    if (!imgRes.ok) throw new Error(`Erro ao baixar imagem: ${imgRes.status}`)
    const imgBuffer = Buffer.from(await imgRes.arrayBuffer())

    const logoBuffer = await sharp(logoPath)
      .resize(185, null, { fit: 'inside' })
      .toBuffer()

    const logoMeta = await sharp(logoBuffer).metadata()
    const logoW = logoMeta.width ?? 185
    const logoH = logoMeta.height ?? 50

    const imgMeta = await sharp(imgBuffer).metadata()
    const imgW = imgMeta.width ?? 1024
    const imgH = imgMeta.height ?? 1024

    const left = imgW - logoW - 32
    const top  = imgH - logoH - 32

    const composited = await sharp(imgBuffer)
      .composite([{ input: logoBuffer, left, top, blend: 'over' }])
      .jpeg({ quality: 92 })
      .toBuffer()

    const supabase = createClient()
    const fileName = `post-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`

    await supabase.storage.createBucket(BUCKET, { public: true }).catch(() => {})

    const { data: uploaded, error: uploadErr } = await supabase.storage
      .from(BUCKET)
      .upload(fileName, composited, {
        contentType: 'image/jpeg',
        upsert: false,
      })

    if (uploadErr) {
      console.error('[LOGO] Erro no upload Supabase:', uploadErr.message)
      return imageUrl
    }

    const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(uploaded.path)
    console.log('[LOGO] Composição OK →', publicUrl)
    return publicUrl

  } catch (err: any) {
    console.error('[LOGO] Erro na composição do logo:', err?.message ?? err)
    return imageUrl
  }
}

// ─── Prompts fallback (cena canônica por tema) ───────────────────────────────

function construirPromptFallback(
  tema: string,
  textoPost: string,
  tipo: 'comercial' | 'autoridade'
): string {
  const t = (textoPost + ' ' + tema).toLowerCase()

  if (tipo === 'comercial') {

    if (/ibs|cbs|fiscal|tribut|reform|imposto|sped|nfe|nota fiscal|receita federal/.test(t)) {
      return `Close-up of an accountant's hands sorting through a pile of printed NF-e fiscal invoices and SPED regulation binders stacked on a desk, tax deadline calendar with circled date pinned to the wall directly behind, a pen underlining a government regulation clause, one invoice catching neon green (#30F282) desk lamp glow. Documentary corporate photography, 50mm lens f/2.8, warm bright office, no project charts or Gantt boards — only fiscal tax documents, the physical reality of Brazilian tax compliance.`
    }

    if (/erp.*par|sistema.*par|parou|travou|falhou|inst.vel|offline|suporte|caiu|indispon.vel/.test(t)) {
      return `Three office workers gathered urgently around a desk monitor showing a red error dialog on a frozen ERP screen, one person holding a phone to their ear calling support, another pointing at the display, papers thrown aside, visible stress in their posture, neon green (#30F282) emergency sign casting pale light from the dark corridor. Documentary crisis photography, 35mm lens, harsh fluorescent overhead light, the exact moment a critical system fails.`
    }

    if (/intelig.ncia artificial|ia|chatgpt|llm|automa..o|copilot/.test(t)) {
      return `Split dual-monitor workstation in a corporate office: left monitor shows the Protheus ERP module interface — dense rows of ledger data entries and fields; right monitor shows an AI chat assistant window with a structured text response appearing line by line, neon green (#30F282) cursor blinking in the AI reply box. A professional's hands rest on the keyboard at the exact moment of discovery. No financial trading charts, no stock graphs. Documentary technology photography, 35mm lens, cool blue monitor glow, the contrast between legacy ERP and intelligent AI analysis.`
    }

    if (/implant|projeto|go.live|cronograma|deploy|lan.amento|entrega|prazo/.test(t)) {
      return `A team of three professionals standing in front of a large monitor showing an implementation completion milestone screen, a physical kanban board with sticky note columns — backlog, in progress, done — clearly visible on the wall behind, one neon green (#30F282) sticky note marking the live milestone, focused celebratory energy. Documentary corporate photography, 28mm lens, warm office overhead lighting, the go-live moment after months of work.`
    }

    if (/integra|api|m.dulo|conex|sincron|webhook/.test(t)) {
      return `A developer's hands at a keyboard with a widescreen monitor showing two ERP system interface panels side by side, a neon green (#30F282) data pathway flowing between them with fields synchronizing in real time, the developer leaning forward watching the connection establish. Documentary technology photography, 35mm lens, cool monitor glow in medium corporate office, the moment two systems become one integrated platform.`
    }

    if (/licen|investimento|custo|contrato|proposta|pre.o|valor/.test(t)) {
      return `A procurement professional's hands holding two printed vendor proposal documents side by side on a conference table, columns of numbers visible but unreadable, one document edge catching neon green (#30F282) desk lamp light, a calculator open beside, a pen poised to mark a final choice. Documentary corporate photography, 50mm lens f/2.8, warm office lighting, the weight of a critical business decision.`
    }

    return `A corporate professional's hands at a workstation with a wide monitor showing multiple ERP module windows — inventory, financials, HR — open side by side, neon green (#30F282) system status indicators glowing in the navigation bar, the professional leaning forward studying integrated data. Documentary corporate photography, 35mm lens, natural office window light from the left, enterprise software in active professional use.`

  } else {

    if (/intelig.ncia artificial|ia|ferramenta|produtiv|m.todo/.test(t)) {
      return `A professional's hands on an open laptop on a clean white desk, a notebook with handwritten notes beside it, the laptop screen showing an AI interface responding with structured analysis results, a small neon green (#30F282) pen cap placed off-center on the white surface. Harvard Business Review editorial flat-lay photography, overhead perspective, soft natural window light, a practitioner using intelligence as a daily professional tool.`
    }

    if (/lideran.|gest.o|equipe|time|decis|reuni.o|cultura|medo|press.o|feedback|coaching/.test(t)) {
      return `A manager standing at a whiteboard actively explaining drawn diagrams to three seated colleagues around a table, one colleague taking notes on an open laptop, direct coaching engagement visible through posture and eye contact, a neon green (#30F282) circled item on the whiteboard drawing attention. Harvard Business Review editorial corporate photography, 35mm lens, warm natural window light mixed with overhead, leadership in an active teaching moment.`
    }

    if (/carreira|trajet.ria|anos|experi.ncia|crescimento|aprendizado|mentoria/.test(t)) {
      return `A senior professional and a younger colleague seated side by side at a solid wooden desk, both leaning over printed CV pages and career portfolio documents spread flat on the desk surface, the senior person's finger pointing to a specific line on the printed page while the junior listens attentively, a neon green (#30F282) highlighter resting on the documents. Solid wall background — no glass, no mirrors, no sticky-note boards. Harvard Business Review editorial photography, 50mm lens f/2.8, soft natural window light from the left, an authentic mentorship moment over career documents.`
    }

    if (/percebi|aprendi|reflex.o|insight|perspectiva|observ|pensar|espelho/.test(t)) {
      return `A smooth dark river stone — perfect oval, matte graphite — resting alone on a white cotton surface, single directional light from the left casting a shadow three times its length, a tiny neon green (#30F282) mineral vein visible through the stone surface. Harvard Business Review editorial macro photography, 90mm macro lens, soft studio light, deliberate stillness representing professional reflection and insight.`
    }

    return `A senior executive's hands opening a leather portfolio on a clean white desk revealing printed strategy documents with annotations, a premium pen resting on the page, a neon green (#30F282) sticky note marking a key decision point, a laptop open beside showing business results. Harvard Business Review editorial documentary photography, 50mm lens, soft natural window light from the left, strategic authority and professional preparation.`
  }
}
