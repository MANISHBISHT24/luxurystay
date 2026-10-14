import { Router, type IRouter } from "express";
import healthRouter from "./health";
import hotelRouter from "./hotel";
import bookingsRouter from "./bookings";
import adminRouter from "./admin";
import contactRouter from "./contact";

const router: IRouter = Router();

router.use(healthRouter);
router.use(hotelRouter);
router.use(bookingsRouter);
router.use(adminRouter);
router.use(contactRouter);

export default router;
