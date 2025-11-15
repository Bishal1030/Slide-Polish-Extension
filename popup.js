

const STORAGE_KEY = "slidePolishPopupState"
const GUARDRAIL_DIRECTIVE = "Important: Use only the information from the original text. Do not invent numbers, metrics, names, or facts. If details are missing, acknowledge the gap instead of guessing."
const SANITIZE_NOTICE = "Adjusted the rewrite to remove invented numbers. Please double-check the details before using.";
const TONE_MIGRATIONS = { sales: "growth" }
const NUMBER_WORD_MAP = {
  zero: "0",
  one: "1",
  two: "2",
  three: "3",
  four: "4",
  five: "5",
  six: "6",
  seven: "7",
  eight: "8",
  nine: "9",
  ten: "10",
  eleven: "11",
  twelve: "12",
  thirteen: "13",
  fourteen: "14",
  fifteen: "15",
  sixteen: "16",
  seventeen: "17",
  eighteen: "18",
  nineteen: "19",
  twenty: "20",
  thirty: "30",
  forty: "40",
  fifty: "50",
  sixty: "60",
  seventy: "70",
  eighty: "80",
  ninety: "90",
  hundred: "100"
}

function normalizeToneInput(tone) {
  const normalized = TONE_MIGRATIONS[tone] || tone || "executive"
  return normalized
}

let selectedTone = "executive"
let currentState = { text: "", tone: selectedTone, results: [] }

function updateState(updates = {}, { persist = true } = {}) {
  currentState = { ...currentState, ...updates }
  if (persist) {
    chrome.storage.local.set({ [STORAGE_KEY]: currentState })
  }
}

function clearState() {
  currentState = { text: "", tone: "executive", results: [] }
  chrome.storage.local.remove(STORAGE_KEY)
}

function restoreState() {
  chrome.storage.local.get([STORAGE_KEY], (data) => {
    const saved = data?.[STORAGE_KEY]
    if (!saved) return

    currentState = { ...currentState, ...saved }

    if (saved.text) {
      textInput.value = saved.text
    }

    if (saved.tone) {
      setActiveTone(saved.tone, { persist: false })
    }

    if (Array.isArray(saved.results) && saved.results.length > 0) {
      displayResults(saved.results, { skipSave: true })
    }
  })
}

const textInput = document.getElementById("textInput")
const polishBtn = document.getElementById("polishBtn")
const loadingDiv = document.getElementById("loading")
const closeBtn = document.getElementById("closeBtn") // Updated to match the HTML id
const resultsSection = document.getElementById("resultsSection")
const resultsList = document.getElementById("resultsList")
const errorMsg = document.getElementById("errorMsg")
const toneSection = document.getElementById("toneSection")
const tabs = document.querySelectorAll(".tab")
const toneBtns = document.querySelectorAll(".tone-btn")

function setActiveTone(tone, { persist = true } = {}) {
  selectedTone = normalizeToneInput(tone)
  toneBtns.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tone === selectedTone)
  })
  updateState({ tone: selectedTone }, { persist })
}

// Close button handler
closeBtn?.addEventListener("click", () => {
  textInput.value = ""
  resultsList.innerHTML = ""
  resultsSection.classList.add("hidden")
  document.querySelector(".content")?.classList.remove("has-results")
  setActiveTone(toneBtns[0]?.dataset.tone || "executive", { persist: false })
  clearState()
  window.close()
})


document.addEventListener("DOMContentLoaded", () => {
  // Get DOM elements
  const rephraseAction = document.getElementById("rephraseAction")
  const adjustToneAction = document.getElementById("adjustToneAction")

  // Initialize state - hide all sections
  toneSection.classList.add("hidden")
  resultsSection.classList.add("hidden")
  loadingDiv.classList.add("hidden")
  errorMsg.classList.add("hidden")

  // Ensure tone selection reflects current state
  setActiveTone(selectedTone, { persist: false })

  chrome.storage.local.get(["selectedText"], (result) => {
    if (result.selectedText) {
      const newText = result.selectedText
      textInput.value = newText
      textInput.focus()
      updateState({ text: newText, results: [], tone: selectedTone })
      resultsList.innerHTML = ""
      resultsSection.classList.add("hidden")
      document.querySelector(".content")?.classList.remove("has-results")
      chrome.storage.local.remove(["selectedText"])
    } else {
      restoreState()
    }
  })

  // Setup action text listeners
  adjustToneAction.addEventListener("click", () => {
    rephraseAction.classList.remove("active")
    adjustToneAction.classList.add("active")
    toneSection.classList.remove("hidden")
    toneSection.style.display = "block"
    resultsSection.classList.add("hidden")
  })

  rephraseAction.addEventListener("click", async () => {
    // Always allow tab switching
    adjustToneAction.classList.remove("active")
    rephraseAction.classList.add("active")
    toneSection.classList.add("hidden")
    toneSection.style.display = "none"

    // Clear previous results first
    resultsList.innerHTML = ""
    resultsSection.classList.add("hidden")
    
    // Only generate new content if there's text
    if (!textInput.value.trim()) return;
    
    try {
      showLoading(true)
      hideError()
      polishBtn.disabled = true

      // Generate fresh rewrites using the rephrase function
      const { rewrites, sanitized } = await generateRephrases(textInput.value.trim(), selectedTone);

      if (!rewrites || rewrites.length === 0) {
        throw new Error("No results generated. Please try again.");
      }

      displayResults(rewrites);
      if (sanitized) {
        showError(SANITIZE_NOTICE);
      } else {
        hideError();
      }
    } catch (error) {
      showError(error.message || "Failed to generate rewrites. Please try again.");
    } finally {
      showLoading(false)
      polishBtn.disabled = false
    }
  })

  setupEventListeners()
})

function setupEventListeners() {

  // Tone buttons
  toneBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      setActiveTone(btn.dataset.tone)
    })
  })

  // Persist text input changes
  textInput.addEventListener("input", (e) => {
    updateState({ text: e.target.value })
  })

  // Polish button
  polishBtn.addEventListener("click", handleGenerate)

  textInput.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      handleGenerate()
    }
  })
}


async function handleGenerate(forceNew = false) {
  const text = textInput.value.trim()

  if (!text) {
    showError("Please paste some text to rewrite.")
    return
  }

  showLoading(true)
  hideError()
  resultsSection.classList.add("hidden")
  document.querySelector(".content").classList.remove("has-results")
  polishBtn.disabled = true

  try {
    const originalText = text
    const attemptConfigs = [
      { guardrail: false },
      { guardrail: true }
    ]

    let rewrites = []
    let lastValidation = null
    let lastFailedResponse = null
    let sanitizedFallback = null

    for (const attempt of attemptConfigs) {
      const response = await generateViaBackend(originalText, selectedTone, {
        forceNew: true,
        guardrail: attempt.guardrail,
        extraInstructions: attempt.guardrail ? GUARDRAIL_DIRECTIVE : ""
      })

      if (!response || response.length === 0) {
        continue
      }

      const validation = validateRewritesAgainstSource(originalText, response)

      if (validation.isValid) {
        rewrites = response
        break
      }

      lastValidation = validation
      lastFailedResponse = response

      const sanitized = sanitizeRewrites(originalText, response)
      const sanitizedValidation = validateRewritesAgainstSource(originalText, sanitized)
      if (sanitized.length > 0 && sanitizedValidation.isValid) {
        sanitizedFallback = sanitized
      }
    }

    if (!rewrites || rewrites.length === 0) {
      if (sanitizedFallback && sanitizedFallback.length > 0) {
        displayResults(sanitizedFallback)
        showError(SANITIZE_NOTICE)
        return
      }

      if (lastValidation && !lastValidation.isValid && lastFailedResponse) {
        throw new Error("Generated rewrites added details that aren't in your original text. Please simplify the request and try again.")
      }
      throw new Error("No rewrites generated. Please try again.")
    }

    displayResults(rewrites)
    hideError()
  } catch (error) {
    showError(error.message || "Failed to generate rewrites. Please try again.")
  } finally {
    showLoading(false)
    polishBtn.disabled = false
  }
}


// ============================================
// API CALL
// ============================================
async function generateRewrites(text, tone) {
  const normalizedTone = normalizeToneInput(tone)
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
3. Use \n between lines
4. Use → for transitions
5. Include required labels shown in format
6. Use ONLY details from TEXT; never add numbers, metrics, names, or facts that are not present.

Generate 3 DIFFERENT rewrites in the SAME bullet structure.

JSON OUTPUT:
{
  "rewrites": [
    {"text": "bullets here"},
    {"text": "bullets here"},
    {"text": "bullets here"}
  ]
}`

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a slide formatter. You output ONLY bullet-point structured text. You NEVER output paragraphs or prose. You MUST use • for bullets, → for transitions, and include required prefixes. You NEVER fabricate numbers, metrics, or facts that are not explicitly present in the user's text. If detail is missing, leave it generalized without inventing specifics."
          },
          {
            role: "user",
            content: `Format in ${normalizedTone} tone: We improved onboarding and conversion went up.`
          },
          {
            role: "assistant",
            content: normalizedTone === 'executive' 
              ? `{"rewrites":[{"text":"Headline: \\"Onboarding optimization drove 40% conversion lift.\\"\\n• Signup friction reduced via UI simplification.\\n• Conversion rate increased from 45% → 62%.\\n• User satisfaction scores up 23 points."}]}`
              : normalizedTone === 'investor'
              ? `{"rewrites":[{"text":"• Conversion rate +38% after onboarding improvements.\\n• User feedback scores improved → informing Q4 product roadmap.\\n• Next: scale to enterprise segment; projected +20% ARR."}]}`
              : normalizedTone === 'product'
              ? `{"rewrites":[{"text":"• Streamline onboarding from 5 → 2 steps to boost activation (Now).\\n• Add conversion tracking dashboard for insight (Next).\\n• Expand A/B testing framework for optimization (Later)."}]}`
              : normalizedTone === 'growth'
              ? `{"rewrites":[{"text":"• Hook: \\"Complex onboarding kills conversions.\\"\\n• Value: \\"Simplified flow gets users started in under 2 minutes.\\"\\n• Proof: \\"Early adopters saw 38% higher activation rates.\\"\\n• Close: \\"Roll it out this quarter to keep the lift.\\""}]}`
              : normalizedTone === 'technical'
              ? `{"rewrites":[{"text":"• What it is: Automated onboarding and conversion tracking system.\\n• Why it matters: Eliminates manual steps and provides real-time analytics.\\n• Business impact: +38% conversions, reduced support costs, faster time-to-value."}]}`
              : `{"rewrites":[{"text":"• Onboarding simplified — 5 steps → 2.\\n• Conversions up 38%.\\n• Users report smoother experience."}]}`
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.4,
        max_tokens: 1200,
        response_format: { type: "json_object" }
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      const errorMessage = errorData.error?.message || "OpenAI API error"

      if (response.status === 401) {
        throw new Error("Invalid API key. Check your OpenAI credentials.")
      } else if (response.status === 429) {
        throw new Error("Rate limited. Please wait a moment and try again.")
      } else if (response.status === 500) {
        throw new Error("OpenAI service error. Please try again later.")
      }

      throw new Error(errorMessage)
    }

    const data = await response.json()
    const content = data.choices[0].message.content

    // Parse JSON response
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error("Invalid response format from API")
    }

    const parsed = JSON.parse(jsonMatch[0])
    return parsed.rewrites || []
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error("Failed to parse API response. Please try again.")
    }
    throw error
  }
}


function displayResults(rewrites, { skipSave = false } = {}) {
  resultsList.innerHTML = ""

  // Hide tone section when showing results
  toneSection.classList.add("hidden")
  toneSection.style.display = "none"
  
  rewrites.forEach((rewrite, index) => {
    const item = document.createElement("div")
    item.className = "result-item"

    // Convert \n to <br> for proper line breaks
    const formattedText = escapeHtml(rewrite.text).replace(/\n/g, '<br>')

    item.innerHTML = `
      <div class="result-text">${formattedText}</div>
      <div class="result-actions">
        <button class="copy-btn" data-index="${index}">Copy</button>
      </div>
    `

    const copyBtn = item.querySelector(".copy-btn")
    copyBtn.addEventListener("click", () => {
      copyToClipboard(rewrite.text, copyBtn)
    })

    resultsList.appendChild(item)
  })

  // Show results section and enable scrolling
  resultsSection.classList.remove("hidden")
  resultsSection.style.display = "block"
  document.querySelector(".content").classList.add("has-results")

  if (!skipSave) {
    updateState({ results: rewrites })
  }

  // Reset tab states
  const rephraseAction = document.getElementById("rephraseAction")
  const adjustToneAction = document.getElementById("adjustToneAction")
  rephraseAction.classList.add("active")
  adjustToneAction.classList.remove("active")
}

function copyToClipboard(text, btn) {
  navigator.clipboard
    .writeText(text)
    .then(() => {
      const originalText = btn.textContent
      btn.textContent = "✓ Copied!"
      btn.classList.add("copied")

      setTimeout(() => {
        btn.textContent = originalText
        btn.classList.remove("copied")
      }, 2000)
    })
    .catch(() => {
      showError("Failed to copy. Please try again.")
    })
}

function showLoading(show) {
  if (show) {
    loadingDiv.classList.remove("hidden")
    polishBtn.disabled = true
  } else {
    loadingDiv.classList.add("hidden")
    polishBtn.disabled = false
  }
}

function showError(message) {
  errorMsg.textContent = message
  errorMsg.classList.remove("hidden")
}

function hideError() {
  errorMsg.classList.add("hidden")
}

function escapeHtml(text) {
  const div = document.createElement("div")
  div.textContent = text
  return div.innerHTML
}

function extractNumericTokens(text) {
  if (!text) return []

  const numericMatches = (text.match(/\d[\d+.,%]*/g) || [])
    .map((match) => match.replace(/[^\d]/g, ""))
    .filter(Boolean)

  const spelledMatches = (text.toLowerCase().match(/\b(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred)\b/g) || [])
    .map((word) => NUMBER_WORD_MAP[word])
    .filter(Boolean)

  return [...numericMatches, ...spelledMatches]
}

function validateRewritesAgainstSource(originalText, rewrites) {
  const sourceNumbers = new Set(extractNumericTokens(originalText))
  const sourceHasNumbers = sourceNumbers.size > 0

  const invalidIndexes = []

  rewrites.forEach((rewrite, index) => {
    const text = typeof rewrite === "string" ? rewrite : rewrite?.text || ""
    const candidateNumbers = extractNumericTokens(text)

    if (!sourceHasNumbers && candidateNumbers.length > 0) {
      invalidIndexes.push(index)
      return
    }

    const hasUnsupportedNumber = candidateNumbers.some((num) => !sourceNumbers.has(num))
    if (hasUnsupportedNumber) {
      invalidIndexes.push(index)
    }
  })

  return {
    isValid: invalidIndexes.length === 0,
    invalidIndexes,
  }
}

function sanitizeRewrites(originalText, rewrites) {
  const sourceNumbers = new Set(extractNumericTokens(originalText))
  const cleaned = []

  rewrites.forEach((rewrite) => {
    const original = typeof rewrite === "string" ? rewrite : rewrite?.text || ""
    if (!original) return

    let sanitizedText = original.replace(/\d[\d.,%]*/g, (match) => {
      const normalized = match.replace(/[^\d]/g, "")
      if (!normalized) return match
      return sourceNumbers.has(normalized) ? match : ""
    })

    sanitizedText = sanitizedText
      .replace(/\s{2,}/g, " ")
      .replace(/\n\s+/g, "\n")
      .replace(/•\s*(?=\n|$)/g, "• ")
      .trim()

    if (!sanitizedText) return

    cleaned.push(
      typeof rewrite === "string"
        ? { text: sanitizedText, _sanitized: true }
        : { ...rewrite, text: sanitizedText, _sanitized: true }
    )
  })

  return cleaned
}


async function getApiKey() {
  try {
    const { OPENAI_API_KEY } = await chrome.storage.sync.get(["OPENAI_API_KEY"])
    return OPENAI_API_KEY || ""
  } catch (e) {
    return ""
  }
}


async function generateViaBackend(text, tone, options = {}) {
  const normalizedTone = normalizeToneInput(tone)
  if (!CONFIG || !CONFIG.BACKEND_URL) {
    throw new Error("Backend URL not configured")
  }

  const {
    forceNew = false,
    timestamp = null,
    guardrail = false,
    extraInstructions = ""
  } = options

  const url = CONFIG.BACKEND_URL
  let lastError

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const uniqueId = Math.random().toString(36).substring(7) + Date.now().toString(36)

      // Create a unique cache-busting URL for each request
      const params = new URLSearchParams({
        _: uniqueId,
        t: (timestamp || Date.now()),
        r: Math.random()
      })

      const payload = {
        text,
        tone: normalizedTone,
        uniqueId,
        timestamp: Date.now(),
        temperature: guardrail ? 0.4 : 0.9,
        forceNew: guardrail ? true : forceNew
      }

      if (guardrail) {
        payload.guardrail = true
        payload.instructions = extraInstructions || GUARDRAIL_DIRECTIVE
      }

      const res = await fetch(`${url}?${params}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Pragma": "no-cache",
          "Expires": "0"
        },
        body: JSON.stringify(payload)
      })

      if (!res.ok) {
        throw new Error(`Backend error: ${res.status}`)
      }

      const data = await res.json()
      console.log("Backend returned data:", data)

      if (!Array.isArray(data.rewrites)) {
        throw new Error("Invalid response format from backend")
      }

      return data.rewrites
    } catch (err) {
      lastError = err
      console.error("Backend fetch error:", err)
      if (attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 200 * (attempt + 1)))
      }
    }
  }

  throw new Error(lastError?.message || "Failed to connect to the backend. Please try again.")
}

async function generateRephrases(text, tone) {
  const normalizedTone = normalizeToneInput(tone)
  if (!CONFIG || !CONFIG.BACKEND_URL) {
    throw new Error("Backend URL not configured")
  }

  const fetchBatch = async (useGuardrail = false) => {
    const url = CONFIG.BACKEND_URL
    const promises = Array.from({ length: 3 }, (_, i) => {
      const uniqueId = Math.random().toString(36).substring(7) + Date.now().toString(36) + i
      const params = new URLSearchParams({
        _: uniqueId,
        t: Date.now() + i * 100,
        r: Math.random()
      })

      const payload = {
        text,
        tone: normalizedTone,
        uniqueId,
        timestamp: Date.now() + i,
        temperature: useGuardrail ? 0.4 : 0.9,
        seed: Math.random() * 1000000,
        forceNew: true
      }

      if (useGuardrail) {
        payload.guardrail = true
        payload.instructions = GUARDRAIL_DIRECTIVE
      }

      return fetch(`${url}?${params}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Pragma": "no-cache",
          "Expires": "0"
        },
        body: JSON.stringify(payload)
      })
    })

    const responses = await Promise.all(promises)
    const batchResults = []

    for (const res of responses) {
      if (!res.ok) {
        continue
      }

      const data = await res.json()
      if (Array.isArray(data.rewrites) && data.rewrites.length > 0) {
        batchResults.push(data.rewrites[0])
      }
    }

    return batchResults
  }

  try {
    let results = await fetchBatch(false)
    if (results.length === 0) {
      throw new Error("No results generated")
    }

    let validation = validateRewritesAgainstSource(text, results)
    if (validation.isValid) {
      return { rewrites: results, sanitized: false }
    }

    let sanitizedFallback = null
    const sanitizedInitial = sanitizeRewrites(text, results)
    const sanitizedInitialValidation = validateRewritesAgainstSource(text, sanitizedInitial)
    if (sanitizedInitial.length > 0 && sanitizedInitialValidation.isValid) {
      sanitizedFallback = sanitizedInitial
    }

    results = await fetchBatch(true)
    if (results.length === 0) {
      if (sanitizedFallback) {
        return { rewrites: sanitizedFallback, sanitized: true }
      }
      throw new Error("No results generated")
    }

    validation = validateRewritesAgainstSource(text, results)
    if (validation.isValid) {
      return { rewrites: results, sanitized: false }
    }

    const sanitizedGuardrail = sanitizeRewrites(text, results)
    const sanitizedGuardrailValidation = validateRewritesAgainstSource(text, sanitizedGuardrail)
    if (sanitizedGuardrail.length > 0 && sanitizedGuardrailValidation.isValid) {
      return { rewrites: sanitizedGuardrail, sanitized: true }
    }

    if (sanitizedFallback) {
      return { rewrites: sanitizedFallback, sanitized: true }
    }

    throw new Error("Generated rewrites added details that aren't in your original text. Please simplify the request and try again.")
  } catch (err) {
    console.error("Backend fetch error:", err)
    throw new Error("Failed to connect to the backend. Please try again.")
  }
}


