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
• ... (Now).
• ... (Next).
• ... (Later).

EXAMPLE:
• Reduce onboarding time from 7 → 2 minutes to boost activation (Now).
• Enable real-time conversion tracking for better user insight (Next).
• Expand analytics dashboard for A/B testing and product decisions (Later).`,

        sales: `OUTPUT FORMAT (DO NOT DEVIATE):
• Pain: "..."
• Value: "..."
• Proof: "..."

EXAMPLE:
• Pain: "Manual onboarding slows your growth."
• Value: "Automation lets users get started in 2 minutes — no setup needed."
• Proof: "Teams using this flow saw a 35% increase in activations."`,

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

      const prompt = `${toneDescriptions[tone]}

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
              content: `Format in ${tone} tone: We improved onboarding and conversion went up.`
            },
            {
              role: "assistant",
              content: tone === 'executive' 
                ? `{"rewrites":[{"text":"Headline: \\"Onboarding optimization drove 40% conversion lift.\\"\\n• Signup friction reduced via UI simplification.\\n• Conversion rate increased from 45% → 62%.\\n• User satisfaction scores up 23 points."}]}`
                : tone === 'investor'
                ? `{"rewrites":[{"text":"• Conversion rate +38% after onboarding improvements.\\n• User feedback scores improved → informing Q4 product roadmap.\\n• Next: scale to enterprise segment; projected +20% ARR."}]}`
                : tone === 'product'
                ? `{"rewrites":[{"text":"• Streamline onboarding from 5 → 2 steps to boost activation (Now).\\n• Add conversion tracking dashboard for insight (Next).\\n• Expand A/B testing framework for optimization (Later)."}]}`
                : tone === 'sales'
                ? `{"rewrites":[{"text":"• Pain: \\"Complex onboarding kills conversions.\\"\\n• Value: \\"Simplified flow gets users started in under 2 minutes.\\"\\n• Proof: \\"Early adopters saw 38% higher activation rates.\\""}]}`
                : tone === 'technical'
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


