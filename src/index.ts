import dotenv from "dotenv";
import { httpServer } from "./app";
import connectDb from "./db";

dotenv.config();

const PORT = process.env.PORT || 3000;

connectDb()
  .then(() => {
    httpServer.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Error connecting to database", error);
  });
