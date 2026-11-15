import type { Request, Response } from "express";

import type {
  CreateCategoryInput,
  CreateDepartmentAccountInput,
  CreateDepartmentInput,
  UpdateCategoryInput,
  UpdateDepartmentInput
} from "./department.schemas.js";
import { DepartmentService } from "./department.service.js";

export class DepartmentController {
  constructor(private readonly service = new DepartmentService()) {}

  listDepartments = async (_request: Request, response: Response) => {
    response.json({ data: { departments: await this.service.listDepartments() } });
  };

  createDepartment = async (request: Request, response: Response) => {
    const department = await this.service.createDepartment(
      request.body as CreateDepartmentInput,
      request.auth!.userId
    );
    response.status(201).json({ data: { department } });
  };

  updateDepartment = async (request: Request, response: Response) => {
    const department = await this.service.updateDepartment(
      String(request.params.id),
      request.body as UpdateDepartmentInput,
      request.auth!.userId
    );
    response.json({ data: { department } });
  };

  listCategories = async (_request: Request, response: Response) => {
    response.json({ data: { categories: await this.service.listCategories() } });
  };

  createCategory = async (request: Request, response: Response) => {
    const category = await this.service.createCategory(
      request.body as CreateCategoryInput,
      request.auth!.userId
    );
    response.status(201).json({ data: { category } });
  };

  updateCategory = async (request: Request, response: Response) => {
    const category = await this.service.updateCategory(
      String(request.params.id),
      request.body as UpdateCategoryInput,
      request.auth!.userId
    );
    response.json({ data: { category } });
  };

  listMappings = async (_request: Request, response: Response) => {
    response.json({ data: { mappings: await this.service.listMappings() } });
  };

  setMapping = async (request: Request, response: Response) => {
    const mapping = await this.service.setMapping(
      String(request.params.id),
      String(request.body.departmentId),
      request.auth!.userId
    );
    response.json({ data: { mapping } });
  };

  listDepartmentAccounts = async (_request: Request, response: Response) => {
    response.json({ data: { accounts: await this.service.listDepartmentAccounts() } });
  };

  createDepartmentAccount = async (request: Request, response: Response) => {
    const account = await this.service.createDepartmentAccount(
      request.body as CreateDepartmentAccountInput,
      request.auth!.userId
    );
    response.status(201).json({ data: { account } });
  };

  updateDepartmentAccountStatus = async (request: Request, response: Response) => {
    await this.service.setDepartmentAccountStatus(String(request.params.id), request.body.status);
    response.status(204).send();
  };
}

