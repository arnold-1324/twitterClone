import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import multer from "multer";


import AuthRoutes from "./routers/auth.routers.js";
import UserRoutes from "./routers/user.routers.js";
import PostRouters from "./routers/post.routers.js";
import connectmongoDB from "./DB/ConnectMongodb.js";

dotenv.config();

const app=express();
const PORT=process.env.PORT || 5000;


app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended:true}));

app.use("/api/auth",AuthRoutes);
app.use("/api/users",UserRoutes);
app.use("/api/posts",PostRouters);



app.listen(PORT,()=>{
    console.log(`server is running in the port ${PORT}`);
    connectmongoDB();
});