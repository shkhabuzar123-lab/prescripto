import express from 'express';
import { loginUser, registerUser, getProfile, updateProfile, bookAppointment, listAppointment, cancelAppointment, paymentRazorpay, verifyRazorpay, paymentStripe, verifyStripe } from '../controllers/userController.js';
import upload from '../middleware/multer.js';
import authUser from '../middleware/authUser.js';
import reportUpload from '../middleware/reportUpload.js';
import { getReportChat, sendReportMessage, clearReportChat } from '../controllers/reportController.js';
import rateLimit from 'express-rate-limit';
const userRouter = express.Router();

// each AI call costs money, so cap it per logged-in user (30 messages / hour)
const reportLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 30,
    keyGenerator: (req) => String(req.body.userId),
    
    handler: (req, res) => res.json({ success: false, message: "Message limit reached. Please try again in an hour." }),
})

userRouter.post("/register", registerUser)
userRouter.post("/login", loginUser)

userRouter.get("/get-profile", authUser, getProfile)
userRouter.post("/update-profile", upload.single('image'), authUser, updateProfile)
userRouter.post("/book-appointment", authUser, bookAppointment)
userRouter.get("/appointments", authUser, listAppointment)
userRouter.post("/cancel-appointment", authUser, cancelAppointment)
userRouter.post("/payment-razorpay", authUser, paymentRazorpay)
userRouter.post("/verifyRazorpay", authUser, verifyRazorpay)
userRouter.post("/payment-stripe", authUser, paymentStripe)
userRouter.post("/verifyStripe", authUser, verifyStripe)

// AI report assistant (chat history is saved per account in MongoDB)
userRouter.get("/report-chat", authUser, getReportChat)
// multer must run before authUser (it rebuilds req.body), same pattern as update-profile
userRouter.post("/report-chat", reportUpload, authUser, reportLimiter, sendReportMessage)
userRouter.delete("/report-chat", authUser, clearReportChat)

export default userRouter;