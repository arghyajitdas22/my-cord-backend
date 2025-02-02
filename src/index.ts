import express from "express";
import dotenv from "dotenv";

import connectDb from "./db/connect";

dotenv.config(); //for loading environment variables

const app = express(); //creating express app

//middlewares
app.use(express.json());

const port = process.env.PORT || 3000; //setting port

app.get("/", (req, res) => {
  res.send("Hello World!");
});

//connecting to database
const run = async () => {
  try {
    await connectDb(process.env.MONGO_URI as string);
    app.listen(port, () => {
      console.log(`Server is running at http://localhost:${port}`);
    });
  } catch (error) {
    console.error(error);
  }
};

run(); //running the server
