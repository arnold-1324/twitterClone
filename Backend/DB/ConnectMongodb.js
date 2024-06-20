import mongoose from "mongoose";

const connectmongoDB=async(req,res)=>{
    try {
        
      const conn=await mongoose.connect(process.env.MONGODB_URL)
      console.log(`mongoDB connected: ${conn.connection.host}`);


    } catch (error) {
       console.log(`Error connection to mongoDb: ${error.message}`);
       process.exit(1); 
    }
}

export default connectmongoDB;