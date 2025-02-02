import express from "express";
import dotenv from "dotenv";

dotenv.config(); //for loading environment variables

const app = express(); //creating express app

//middlewares
app.use(express.json());

const port = process.env.PORT || 3000; //setting port

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
