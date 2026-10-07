import doctorModel from "../models/doctorModel.js";
import reportChatModel from "../models/reportChatModel.js";
import { generateReply } from "../services/reportAssistant.js";
import { LANGUAGES } from "../services/reportPrompt.js";

const MAX_MESSAGE_LENGTH = 8000
const HISTORY_FOR_AI = 20       // last N messages sent to Claude as context
const HISTORY_FOR_UI = 100      // last N messages returned to the page
const DOCTORS_PER_SPECIALITY = 3

// Attach fresh doctor details to stored recommendations (we only store doctor ids)
const serialize = async (messages) => {
    const ids = [...new Set(messages.flatMap((m) => (m.recommendations || []).flatMap((r) => r.doctorIds || [])))]
    const docs = ids.length
        ? await doctorModel.find({ _id: { $in: ids } }).select("name image speciality available").lean()
        : []
    const byId = new Map(docs.map((d) => [String(d._id), d]))

    return messages.map((m) => ({
        _id: m._id,
        role: m.role,
        type: m.type,
        content: m.content,
        fileNames: m.fileNames,
        language: m.language,
        analysis: m.analysis,
        createdAt: m.createdAt,
        recommendations: (m.recommendations || []).map((r) => ({
            speciality: r.speciality,
            reason: r.reason,
            doctors: (r.doctorIds || []).map((id) => byId.get(String(id))).filter(Boolean),
        })),
    }))
}

// API to load this user's saved conversation
const getReportChat = async (req, res) => {
    try {
        const { userId } = req.body
        const latest = await reportChatModel.find({ userId }).sort({ createdAt: -1 }).limit(HISTORY_FOR_UI).lean()
        res.json({ success: true, messages: await serialize(latest.reverse()) })
    } catch (error) {
        console.log(error)
        res.json({ success: false, message: "Couldn't load your conversation." })
    }
}

// API to send a message (text and/or report files) and get the assistant's reply
const sendReportMessage = async (req, res) => {
    try {
        const { userId } = req.body
        const files = req.files || []
        const message = (req.body.message || "").toString().trim().slice(0, MAX_MESSAGE_LENGTH)
        const language = LANGUAGES.includes(req.body.language) ? req.body.language : "en"

        if (!message && files.length === 0) {
            return res.json({ success: false, message: "Please type a message or attach a report." })
        }

        // Only recommend doctors who can be booked right now
        const doctors = await doctorModel.find({ available: true }).select("_id speciality").lean()
        const specialities = [...new Set(doctors.map((d) => d.speciality))]

        const past = await reportChatModel.find({ userId }).sort({ createdAt: -1 }).limit(HISTORY_FOR_AI).lean()
        const reply = await generateReply({ history: past.reverse(), message, files, specialities, language })

        const isAnalysis = reply.kind === "analysis"
        const recommendations = (isAnalysis && reply.isMedicalReport === false ? [] : reply.recommendedSpecialities || [])
            .filter((r) => specialities.includes(r.speciality))
            .map((r) => ({
                speciality: r.speciality,
                reason: r.reason,
                doctorIds: doctors.filter((d) => d.speciality === r.speciality).slice(0, DOCTORS_PER_SPECIALITY).map((d) => String(d._id)),
            }))

        // Save only after the AI succeeded, so history never has a question without an answer
        const now = Date.now()
        const userDoc = await reportChatModel.create({
            userId, role: "user", type: "text", content: message, language,
            fileNames: files.map((f) => f.originalname.slice(0, 100)),
            createdAt: new Date(now),
        })
        const assistantDoc = await reportChatModel.create({
            userId, role: "assistant", language, recommendations,
            type: isAnalysis ? "analysis" : "text",
            content: isAnalysis ? reply.summary : reply.answer,
            analysis: isAnalysis ? {
                isMedicalReport: reply.isMedicalReport !== false,
                reportType: reply.reportType || "",
                keyFindings: reply.keyFindings || [],
                urgency: reply.urgency || "routine",
                urgencyReason: reply.urgencyReason || "",
                questionsForDoctor: reply.questionsForDoctor || [],
            } : null,
            createdAt: new Date(now + 1),
        })

        const [userMessage, assistantMessage] = await serialize([userDoc.toObject(), assistantDoc.toObject()])
        res.json({ success: true, userMessage, assistantMessage })

    } catch (error) {
        console.log(error)
           const message = error.status === 429 || error.status === 503
            ? "The assistant is busy right now. Please try again in a minute."
            : error.status === 400
                ? "We couldn't read that file. Try a clearer photo or a PDF."
                : "Something went wrong. Please try again."
        res.json({ success: false, message })
    }
}

// API to delete this user's whole conversation
const clearReportChat = async (req, res) => {
    try {
        await reportChatModel.deleteMany({ userId: req.body.userId })
        res.json({ success: true })
    } catch (error) {
        console.log(error)
        res.json({ success: false, message: "Couldn't clear the conversation." })
    }
}

export { getReportChat, sendReportMessage, clearReportChat }
