import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import bodyParser from "body-parser";

import { createServer } from "http";
import { setupSocket } from "./socket/socket.js";

import compression from "compression";
import rateLimit from "express-rate-limit";
//import helmet from "helmet";
import cors from "cors";
import mongoSanitize from "express-mongo-sanitize";
import hpp from "hpp";
import xss from "xss-clean";
import path from "path";


import AuthRoutes from "./routers/auth.routers.js";
import UserRoutes from "./routers/user.routers.js";
import PostRouters from "./routers/post.routers.js";
import connectmongoDB from "./DB/ConnectMongodb.js";
import Notification from "./routers/notification.routers.js"; 
import MessageRoutes from "./routers/message.routers.js";
import GroupRoutes from "./routers/group.routers.js";

dotenv.config();



const app=express();
const PORT=process.env.PORT || 5000;
app.use(compression());

const __dirname = path.resolve();
const limiter = rateLimit({
    windowMs: 3 * 60 * 1000, 
    max: 100, 
    message: "Too many requests from this IP, please try again later."
});
app.use(limiter);

//app.use(helmet()); 
//app.use(express.static(path.join(__dirname, '../Frontend/dist')));
app.use(cors({
  origin: "https://twitter-clone-git-main-arnolds-projects-9ad435f9.vercel.app/",
  credentials: true,
}));
app.use(mongoSanitize()); 
app.use(xss()); 
app.use(hpp()); 

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended:true}));
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));

app.use("/api/auth",AuthRoutes);
app.use("/api/users",UserRoutes);
app.use("/api/posts",PostRouters);
app.use("/api/notification",Notification);
app.use("/api/messages",MessageRoutes);
app.use("/api/groups", GroupRoutes);
//app.use('/uploads', express.static('uploads'));

const httpServer = createServer(app);
setupSocket(httpServer);

//app.use(express.static(path.join(__dirname, 'Frontend', 'build')));
//app.get('*', (req, res) => {
 // res.sendFile(path.join(__dirname, 'Frontend', 'build', 'index.html'));
//});

httpServer.listen(PORT, () => {
    console.log(`server is running in the port ${PORT}`);
    connectmongoDB();
});
