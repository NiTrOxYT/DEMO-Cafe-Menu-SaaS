import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import categoriesRouter from "./categories";
import menuRouter from "./menu";
import storageRouter from "./storage";
import ordersRouter from "./orders";
import settingsRouter from "./settings";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(categoriesRouter);
router.use(menuRouter);
router.use(storageRouter);
router.use(ordersRouter);
router.use(settingsRouter);

export default router;
