export default {
  async fetch(request, env) {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    }

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors })
    }

    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json", ...cors },
      })
    }

    try {
      const { text, tone } = await request.json()
      if (!text || !tone) {
        return new Response(JSON.stringify({ error: "Missing text or tone" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...cors },
        })
      }

      const toneAlias = { sales: "growth" }
      const normalizedTone = toneAlias[tone] || tone

      const toneDescriptions = {
        executive: `OUTPUT FORMAT (DO NOT DEVIATE):
Headline: "..."
• ...
• ...
• ...

EXAMPLE:
Headline: "Onboarding automation cut signup friction by 35%."
• Signup flow now fully automated; reduced manual steps from 8 → 3.
• Activation rate improved from 62% → 84% post-release.
• Dashboards now track conversion trends across all user cohorts.`,

        investor: `OUTPUT FORMAT (DO NOT DEVIATE):
• ...
• ... → ...
• Next: ... → ...

EXAMPLE:
• Activation rate +22% MoM after onboarding automation.
• Dashboard analytics surfaced key drop-off points → guiding Q4 UX priorities.
• Next: expand automation to enterprise tier; expected +15% ARR uplift.`,

        product: `OUTPUT FORMAT (DO NOT DEVIATE):
• Now – ... (Current work + user/customer value).
• Next – ... (Upcoming work + measurable outcome or KPI).
• Later – ... (Future bet + strategic upside).

RULES:
• Every bullet MUST start with the label (Now/Next/Later).
• Include concrete user impact or metric wording when present in the source text.
• Keep verbs action-oriented (ship, expand, de-risk, unblock).

EXAMPLE:
• Now – Trim onboarding steps from 7 → 2 to unblock activation for new logos.
• Next – Launch live conversion dashboard so PMs can spot drop-offs in real time.
• Later – Layer experimentation tooling to forecast roadmap impact.`,

        growth: `OUTPUT FORMAT (DO NOT DEVIATE):
• Hook: "..." (Attention-grabbing stat or pain)
• Value: "..." (What we deliver + benefit)
• Proof: "..." (Evidence, metric, social proof)
• Close: "..." (Next action, CTA, or urgency)

RULES:
• ALWAYS output exactly 4 bullets in this order (Hook, Value, Proof, Close) and keep the label text.
• Preserve every metric, duration, or % exactly as it appears (if the user spells it out, you may restate it as numerals but never drop the unit or value).
• Keep tone energetic but credible—no hype without evidence from source text.
• Always mention the customer persona or market segment if it appears in the input.

EXAMPLE:
• Hook: "Broken onboarding leaks 1 in 3 prospects before they see value."
• Value: "We now launch them in 2 minutes with guided setup + live support."
• Proof: "Teams piloting the flow saw 35% more activations and faster handoffs."
• Close: "Plug this into your next campaign to turn trial intent into revenue."`,

        technical: `OUTPUT FORMAT (DO NOT DEVIATE):
• What it is: ...
• Why it matters: ...
• Business impact: ...

EXAMPLE:
• What it is: Automated signup and conversion tracking system.
• Why it matters: Removes manual verification and tracks real-time drop-offs.
• Business impact: Faster activations, +22% new user conversions, reduced support overhead.`,

        clarity: `OUTPUT FORMAT (DO NOT DEVIATE):
• ...
• ...
• ...

EXAMPLE:
• Signup flow automated — 8 steps → 3.
• Activation up 22%.
• Dashboard tracks user conversion in real time.`
      }

      const toneKey = toneDescriptions[normalizedTone] ? normalizedTone : "executive"
      const prompt = `${toneDescriptions[toneKey]}

TEXT: "${text}"

RULES:
1. Output ONLY bullets (use • character)
2. NO paragraphs, NO prose
3. Use \\n between lines
4. Use → for transitions
5. Include required labels shown in format

Generate 3 DIFFERENT rewrites in the SAME bullet structure.

JSON OUTPUT:
{
  "rewrites": [
    {"text": "bullets here"},
    {"text": "bullets here"},
    {"text": "bullets here"}
  ]
}`

      const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: "You are a slide formatter. You output ONLY bullet-point structured text. You NEVER output paragraphs or prose. You MUST use • for bullets, → for transitions, and include required prefixes."
            },
            {
              role: "user",
              content: `Format in ${toneKey} tone: We improved onboarding and conversion went up.`
            },
            {
              role: "assistant",
              content: toneKey === 'executive' 
                ? `{"rewrites":[{"text":"Headline: \\"Onboarding optimization drove 40% conversion lift.\\"\\n• Signup friction reduced via UI simplification.\\n• Conversion rate increased from 45% → 62%.\\n• User satisfaction scores up 23 points."}]}`
                : toneKey === 'investor'
                ? `{"rewrites":[{"text":"• Conversion rate +38% after onboarding improvements.\\n• User feedback scores improved → informing Q4 product roadmap.\\n• Next: scale to enterprise segment; projected +20% ARR."}]}`
                : toneKey === 'product'
                ? `{"rewrites":[{"text":"• Streamline onboarding from 5 → 2 steps to boost activation (Now).\\n• Add conversion tracking dashboard for insight (Next).\\n• Expand A/B testing framework for optimization (Later)."}]}`
                : toneKey === 'growth'
                ? `{"rewrites":[{"text":"• Hook: \\"Complex onboarding kills conversions.\\"\\n• Value: \\"Simplified flow gets users started in under 2 minutes.\\"\\n• Proof: \\"Early adopters saw 38% higher activation rates.\\"\\n• Close: \\"Roll it out this quarter to keep the lift.\\""}]}`
                : toneKey === 'technical'
                ? `{"rewrites":[{"text":"• What it is: Automated onboarding and conversion tracking system.\\n• Why it matters: Eliminates manual steps and provides real-time analytics.\\n• Business impact: +38% conversions, reduced support costs, faster time-to-value."}]}`
                : `{"rewrites":[{"text":"• Onboarding simplified — 5 steps → 2.\\n• Conversions up 38%.\\n• Users report smoother experience."}]}`
            },
            { 
              role: "user", 
              content: prompt 
            }
          ],
          temperature: 1.0,
          max_tokens: 1200,
          response_format: { type: "json_object" }
        }),
      })

      if (!aiRes.ok) {
        const err = await aiRes.json().catch(() => ({}))
        const msg = err?.error?.message || "OpenAI API error"
        return new Response(JSON.stringify({ error: msg }), {
          status: aiRes.status,
          headers: { "Content-Type": "application/json", ...cors },
        })
      }

      const data = await aiRes.json()
      const content = data?.choices?.[0]?.message?.content || ""
      const match = content.match(/\{[\s\S]*\}/)
      if (!match) {
        return new Response(JSON.stringify({ error: "Invalid response format from API" }), {
          status: 500,
          headers: { "Content-Type": "application/json", ...cors },
        })
      }
      const parsed = JSON.parse(match[0])
      return new Response(JSON.stringify({ rewrites: parsed.rewrites || [] }), {
        headers: { "Content-Type": "application/json", ...cors },
      })
    } catch (e) {
      return new Response(JSON.stringify({ error: e?.message || "Unexpected error" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...cors },
      })
    }
  },
}


