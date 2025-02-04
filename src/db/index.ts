import mongoose from "mongoose";

const connectDb = async () => {
  try {
    const connectionInstance = await mongoose.connect(
      `${process.env.MONGO_URI}`
    );
    console.log(`MongoDB connected: ${connectionInstance.connection.host}`);
  } catch (error) {
    console.error("mongoDB connection error!", error);
    process.exit(1);
  }
};

export default connectDb;
