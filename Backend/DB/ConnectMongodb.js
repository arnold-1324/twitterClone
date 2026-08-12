import mongoose from "mongoose";

const connectmongoDB = async () => {
  const defaultUri = process.env.MONGODB_URL;
  const fallbackUri =
    process.env.MONGODB_LOCAL_URL ||
    "mongodb://127.0.0.1:27017/twitterClone";

  const uri = defaultUri || fallbackUri;

  const mongoOptions = {
    proxyHost: "127.0.0.1",
    proxyPort: 9050,
  };

  try {
    const conn = await mongoose.connect(uri, mongoOptions);

    console.log(`mongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    console.log(`Error connecting to MongoDB: ${error.message}`);

    // Don't try the local fallback if we're already using it.
    if (uri !== fallbackUri) {
      console.warn(
        `Retrying with fallback local MongoDB: ${fallbackUri}`
      );

      try {
        const conn = await mongoose.connect(fallbackUri);

        console.log(
          `mongoDB connected to fallback: ${conn.connection.host}`
        );

        return;
      } catch (fallbackError) {
        console.log(
          `Fallback MongoDB connection failed: ${fallbackError.message}`
        );
      }
    }

    process.exit(1);
  }
};

export default connectmongoDB;