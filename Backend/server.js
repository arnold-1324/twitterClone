import express from "express";
import dotenv from "dotenv";

import AuthRoutes from "./routers/auth.routers.js";
import connectmongoDB from "./DB/ConnectMongodb.js";
import cookieParser from "cookie-parser";

dotenv.config();

const app=express();
const PORT=process.env.PORT || 5000;

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended:true}));

app.use("/api/auth",AuthRoutes);

app.listen(PORT,()=>{
    console.log(`server is running in the port ${PORT}`);
    connectmongoDB();
});