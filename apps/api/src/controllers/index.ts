import Elysia from "elysia";
import { adminController } from "./admin-controller";
import { authController } from "./auth-controller";
import { connectionsController } from "./connections-controller";
import { dashboardController } from "./dashboard-controller";
import { entriesController } from "./entries-controller";
import { importController } from "./import-controller";
import { linksController } from "./links-controller";
import { loansController } from "./loans-controller";
import { profileController } from "./profile-controller";

/** Logged-in routes. Grouped so protectedUser's scoped hooks stop here
 * and never leak onto the public auth routes. */
const userControllers = new Elysia({ name: "user_controllers" })
  .use(profileController)
  .use(connectionsController)
  .use(entriesController)
  .use(loansController)
  .use(dashboardController)
  .use(importController)
  .use(linksController)
  .use(adminController);

export const mainController = new Elysia({
  name: "router",
  prefix: "/api",
})
  .use(authController)
  .use(userControllers);
