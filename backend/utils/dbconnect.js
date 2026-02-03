import mongoose from "mongoose";

const connectDB = async () => {
  try {
    const URI = process.env.MONGO_URI;
    if (!URI) {
      throw new Error("MONGO_URI is not defined in environment variables");
    }
    const conn = await mongoose.connect(URI);
    console.log("MongoDB Connected Successfully");
  } catch (error) {
    console.log("Error connecting to MongoDB", error);
    throw error;
  }
};

export default connectDB;
