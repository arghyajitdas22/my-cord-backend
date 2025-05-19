import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { errorHandler } from "./middlewares/error.middleware";
import logger from "./utils/logger";
import morgan from "morgan";
import { createServer } from "http";
import { Server } from "socket.io";
import dotenv from "dotenv";
dotenv.config({
  path: "./.env",
});

const morganFormat = ":method :url :status :response-time ms";

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  pingTimeout: 60000,
  cors: {
    origin: "http://localhost:5173",
    credentials: true,
  },
});
app.set("io", io);

//common middlewares
app.use(
  cors({
    origin: "http://localhost:5173",
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
app.use(
  morgan(morganFormat, {
    stream: {
      write: (message) => {
        const logObject = {
          method: message.split(" ")[0],
          url: message.split(" ")[1],
          status: message.split(" ")[2],
          responseTime: message.split(" ")[3],
        };
        logger.info(JSON.stringify(logObject));
      },
    },
  })
);

//--TODO: apply rate limiter

//import routes
import healthcheckRoute from "./routes/healthcheck.route";
import authRouter from "./routes/auth.route";
import userRouter from "./routes/user.route";
import serverRouter from "./routes/server.route";
import messageRouter from "./routes/message.route";
import { initializeSocketIO } from "./socket";

//use routes
app.use("/api/v1/healthcheck", healthcheckRoute);
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/users", userRouter);
app.use("/api/v1/server", serverRouter);
app.use("/api/v1/message", messageRouter);

initializeSocketIO(io);

app.use(errorHandler);

export { app, httpServer };
