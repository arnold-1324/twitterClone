import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import { v2 as cloudinary } from "cloudinary";


import AuthRoutes from "./routers/auth.routers.js";
import UserRoutes from "./routers/user.routers.js";
import PostRouters from "./routers/post.routers.js";
import connectmongoDB from "./DB/ConnectMongodb.js";
import Notification from "./routers/notification.routers.js"; 
import MessageRoutes from "./routers/message.routers.js";

dotenv.config();

const app=express();
const PORT=process.env.PORT || 5000;

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key:process.env.API_KEY,
    api_secret:process.env.SECRET_KEY,
})

app.use(cookieParser());
app.use(express.json({ limit: "50mb"}));
app.use(express.urlencoded({ extended:true}));

app.use("/api/auth",AuthRoutes);
app.use("/api/users",UserRoutes);
app.use("/api/posts",PostRouters);
app.use("/api/notification",Notification);
app.use("/api/messages",MessageRoutes);



app.listen(PORT,()=>{
    console.log(`server is running in the port ${PORT}`);
    connectmongoDB();
});