import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

const app = express();

//common middlewares
app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  })
);
app.use(
  express.json({
    limit: "50mb",
  })
);
app.use(
  express.urlencoded({
    extended: true,
    limit: "50mb",
  })
);
app.use(express.static("public"));
app.use(cookieParser());

//import routes
import healthcheckRoute from "./routes/healthcheck.route";

//use routes
app.use("/api/v1/healthcheck", healthcheckRoute);

export { app };
