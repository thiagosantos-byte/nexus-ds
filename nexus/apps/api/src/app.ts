import express, { type Express } from "express";
import { originPolicy } from "./middlewares/origin";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { identityRouter } from "./routes/identity";
import { platformRouter } from "./routes/platform";
import { workspaceRouter } from "./routes/workspace";
import { aiRouter } from "./routes/ai";


const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(originPolicy());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);
app.use("/api", identityRouter);
app.use("/api", platformRouter);
app.use("/api", workspaceRouter);
app.use("/api", aiRouter);
app.use("/api", (_req, res) => {
  res.status(404).json({ error: "Endpoint não encontrado" });
});

export default app;
