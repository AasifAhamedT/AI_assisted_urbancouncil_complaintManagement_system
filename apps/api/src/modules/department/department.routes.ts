import { Router } from "express";

import { validateBody, validateParams } from "../../common/validation.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { DepartmentController } from "./department.controller.js";
import {
  createCategorySchema,
  createDepartmentAccountSchema,
  createDepartmentSchema,
  identifierParamsSchema,
  mappingSchema,
  updateCategorySchema,
  updateDepartmentAccountStatusSchema,
  updateDepartmentSchema
} from "./department.schemas.js";

const controller = new DepartmentController();
export const departmentAdminRouter = Router();

departmentAdminRouter.use(authenticate, authorize("ADMINISTRATOR"));

departmentAdminRouter.get("/departments", controller.listDepartments);
departmentAdminRouter.post("/departments", validateBody(createDepartmentSchema), controller.createDepartment);
departmentAdminRouter.patch(
  "/departments/:id",
  validateParams(identifierParamsSchema),
  validateBody(updateDepartmentSchema),
  controller.updateDepartment
);

departmentAdminRouter.get("/categories", controller.listCategories);
departmentAdminRouter.post("/categories", validateBody(createCategorySchema), controller.createCategory);
departmentAdminRouter.patch(
  "/categories/:id",
  validateParams(identifierParamsSchema),
  validateBody(updateCategorySchema),
  controller.updateCategory
);
departmentAdminRouter.get("/category-mappings", controller.listMappings);
departmentAdminRouter.put(
  "/categories/:id/department-mapping",
  validateParams(identifierParamsSchema),
  validateBody(mappingSchema),
  controller.setMapping
);

departmentAdminRouter.get("/department-accounts", controller.listDepartmentAccounts);
departmentAdminRouter.post(
  "/department-accounts",
  validateBody(createDepartmentAccountSchema),
  controller.createDepartmentAccount
);
departmentAdminRouter.patch(
  "/department-accounts/:id/status",
  validateParams(identifierParamsSchema),
  validateBody(updateDepartmentAccountStatusSchema),
  controller.updateDepartmentAccountStatus
);

