import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import bodyParser from "body-parser";
import { createServer } from "http";
import { setupSocket } from "./socket/socket.js";

import AuthRoutes from "./routers/auth.routers.js";
import UserRoutes from "./routers/user.routers.js";
import PostRouters from "./routers/post.routers.js";
import connectmongoDB from "./DB/ConnectMongodb.js";
import Notification from "./routers/notification.routers.js"; 
import MessageRoutes from "./routers/message.routers.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

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
app.use('/uploads', express.static('uploads'));

const httpServer = createServer(app);
setupSocket(httpServer);

httpServer.listen(PORT, () => {
    console.log(`server is running in the port ${PORT}`);
    connectmongoDB();
});