import { buildSystemPrompt, buildTool, historyToMessages } from "./reportPrompt.js";

// Free Google Gemini API (https://aistudio.google.com/apikey).
// "gemini-flash-latest" always points at the current Flash model; override in .env if you like.
const MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest"
// If the main model is overloaded (503) we retry, then fall back to a lighter model.
const FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || "gemini-flash-lite-latest"
const ENDPOINT = (model) => `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Calls one model; retries a couple of times when Google says "overloaded" (503/500).
const callGemini = async (model, body) => {
    for (let attempt = 1; attempt <= 3; attempt++) {
        const res = await fetch(ENDPOINT(model), {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
            signal: AbortSignal.timeout(90_000),
            body,
        })
        if (res.ok) return res.json()

        const err = new Error(`Gemini API error ${res.status} (${model}): ${(await res.text()).slice(0, 300)}`)
        err.status = res.status
        if ((res.status === 503 || res.status === 500) && attempt < 3) {
            await sleep(1500 * attempt)
            continue
        }
        throw err
    }
}

const toPart = (file) => ({
    inlineData: { mimeType: file.mimetype, data: file.buffer.toString("base64") },
})

export const generateReply = async ({ history, message, files, specialities, language }) => {
    if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not set")

    const tool = buildTool(specialities)

    const contents = historyToMessages(history).map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
    }))
    contents.push({
        role: "user",
        parts: [
            ...files.map(toPart),
            { text: message || "Please analyse this medical report and explain it in simple terms." },
        ],
    })

    const body = JSON.stringify({
        systemInstruction: { parts: [{ text: buildSystemPrompt(language) }] },
        contents,
        tools: [{ functionDeclarations: [{ name: tool.name, description: tool.description, parameters: tool.input_schema }] }],
        toolConfig: { functionCallingConfig: { mode: "ANY", allowedFunctionNames: [tool.name] } },
    })

    let data
    try {
        data = await callGemini(MODEL, body)
    } catch (err) {
        // overloaded or model name not found -> try the fallback model once
        const canFallback = [500, 503, 404].includes(err.status) && FALLBACK_MODEL && FALLBACK_MODEL !== MODEL
        if (!canFallback) throw err
        console.log(`Primary model failed (${err.status}), trying ${FALLBACK_MODEL}`)
        data = await callGemini(FALLBACK_MODEL, body)
    }
    const parts = data.candidates?.[0]?.content?.parts || []
    const out = parts.find((p) => p.functionCall)?.functionCall?.args
    const complete = out && (out.kind === "analysis" ? out.summary : out.answer)
    if (!complete) throw new Error("The AI returned an incomplete reply")
    return out
}