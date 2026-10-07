import mongoose from "mongoose";

// One document per chat message. Messages are tied to the account via userId,
// so every patient only ever sees their own conversation.
const reportChatSchema = new mongoose.Schema({
    userId: { type: String, required: true, index: true },
    role: { type: String, enum: ["user", "assistant"], required: true },
    type: { type: String, enum: ["text", "analysis"], default: "text" },
    content: { type: String, default: "" },          // user text, assistant answer, or analysis summary
    fileNames: { type: [String], default: [] },      // names only; the files themselves are NOT stored
    language: { type: String, enum: ["en", "hi", "kn"], default: "en" },
    analysis: { type: Object, default: null },       // structured report analysis (type === "analysis")
    recommendations: { type: Array, default: [] },   // [{ speciality, reason, doctorIds: [] }]
    createdAt: { type: Date, default: Date.now },
}, { minimize: false })

const reportChatModel = mongoose.models.reportChat || mongoose.model("reportChat", reportChatSchema);
export default reportChatModel;
