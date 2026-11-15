import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";

import { AppError } from "../../common/app-error.js";
import { databasePools } from "../../config/databases.js";
import type {
  Category,
  CategoryDepartmentMapping,
  Department,
  DepartmentAccountMapping,
  CategoryRouting
} from "./department.types.js";

interface DepartmentRow extends RowDataPacket, Department {}
interface CategoryRow extends RowDataPacket, Category {}
interface MappingRow extends RowDataPacket, CategoryDepartmentMapping {}
interface AccountMappingRow extends RowDataPacket, DepartmentAccountMapping {}
interface CategoryRoutingRow extends RowDataPacket, CategoryRouting {}
interface DepartmentIdRow extends RowDataPacket {
  departmentId: string;
}
interface UserIdRow extends RowDataPacket { userId: string }

export class DepartmentRepository {
  private readonly pool = databasePools.department;

  async listDepartments(): Promise<Department[]> {
    const [rows] = await this.pool.query<DepartmentRow[]>(
      `SELECT id, code, name, description, is_active AS isActive,
              created_at AS createdAt, updated_at AS updatedAt
       FROM departments ORDER BY name`
    );
    return rows.map((row) => ({ ...row, isActive: Boolean(row.isActive) }));
  }

  async findDepartment(id: string): Promise<Department | null> {
    const [rows] = await this.pool.execute<DepartmentRow[]>(
      `SELECT id, code, name, description, is_active AS isActive,
              created_at AS createdAt, updated_at AS updatedAt
       FROM departments WHERE id = ? LIMIT 1`,
      [id]
    );
    const row = rows[0];
    return row ? { ...row, isActive: Boolean(row.isActive) } : null;
  }

  async createDepartment(input: Department & { actorUserId: string }): Promise<void> {
    try {
      await this.pool.execute(
        `INSERT INTO departments
          (id, code, name, description, is_active, created_by_user_id, updated_by_user_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          input.id,
          input.code,
          input.name,
          input.description,
          input.isActive,
          input.actorUserId,
          input.actorUserId
        ]
      );
    } catch (error) {
      this.translateDuplicate(error, "DEPARTMENT_ALREADY_EXISTS");
    }
  }

  async updateDepartment(input: Department & { actorUserId: string }): Promise<void> {
    try {
      await this.pool.execute(
        `UPDATE departments
         SET code = ?, name = ?, description = ?, is_active = ?, updated_by_user_id = ?
         WHERE id = ?`,
        [
          input.code,
          input.name,
          input.description,
          input.isActive,
          input.actorUserId,
          input.id
        ]
      );
    } catch (error) {
      this.translateDuplicate(error, "DEPARTMENT_ALREADY_EXISTS");
    }
  }

  async listCategories(): Promise<Category[]> {
    const [rows] = await this.pool.query<CategoryRow[]>(
      `SELECT id, code, name, description, is_active AS isActive,
              created_at AS createdAt, updated_at AS updatedAt
       FROM categories ORDER BY name`
    );
    return rows.map((row) => ({ ...row, isActive: Boolean(row.isActive) }));
  }

  async listActiveCategories(): Promise<Category[]> {
    const [rows] = await this.pool.query<CategoryRow[]>(
      `SELECT id, code, name, description, is_active AS isActive,
              created_at AS createdAt, updated_at AS updatedAt
       FROM categories WHERE is_active = TRUE ORDER BY name`
    );
    return rows.map((row) => ({ ...row, isActive: true }));
  }

  async findActiveCategoryRouting(categoryId: string): Promise<CategoryRouting | null> {
    const [rows] = await this.pool.execute<CategoryRoutingRow[]>(
      `SELECT c.id AS categoryId, c.name AS categoryName,
              CASE WHEN m.is_active = TRUE AND d.is_active = TRUE THEN d.id ELSE NULL END AS departmentId,
              CASE WHEN m.is_active = TRUE AND d.is_active = TRUE THEN d.name ELSE NULL END AS departmentName
       FROM categories AS c
       LEFT JOIN category_department_mappings AS m ON m.category_id = c.id
       LEFT JOIN departments AS d ON d.id = m.department_id
       WHERE c.id = ? AND c.is_active = TRUE
       LIMIT 1`,
      [categoryId]
    );
    return rows[0] ?? null;
  }

  async findActiveDepartmentIdForAccount(userId: string): Promise<string | null> {
    const [rows] = await this.pool.execute<DepartmentIdRow[]>(
      `SELECT m.department_id AS departmentId
       FROM department_account_mappings AS m
       INNER JOIN departments AS d ON d.id = m.department_id
       WHERE m.user_id = ? AND m.is_active = TRUE AND d.is_active = TRUE
       LIMIT 1`,
      [userId]
    );
    return rows[0]?.departmentId ?? null;
  }

  async findActiveAccountUserIdForDepartment(departmentId: string): Promise<string | null> {
    const [rows] = await this.pool.execute<UserIdRow[]>(
      `SELECT m.user_id AS userId
       FROM department_account_mappings AS m
       INNER JOIN departments AS d ON d.id = m.department_id
       WHERE m.department_id = ? AND m.is_active = TRUE AND d.is_active = TRUE
       LIMIT 1`,
      [departmentId]
    );
    return rows[0]?.userId ?? null;
  }

  async findCategory(id: string): Promise<Category | null> {
    const [rows] = await this.pool.execute<CategoryRow[]>(
      `SELECT id, code, name, description, is_active AS isActive,
              created_at AS createdAt, updated_at AS updatedAt
       FROM categories WHERE id = ? LIMIT 1`,
      [id]
    );
    const row = rows[0];
    return row ? { ...row, isActive: Boolean(row.isActive) } : null;
  }

  async createCategory(input: Category & { actorUserId: string }): Promise<void> {
    try {
      await this.pool.execute(
        `INSERT INTO categories
          (id, code, name, description, is_active, created_by_user_id, updated_by_user_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          input.id,
          input.code,
          input.name,
          input.description,
          input.isActive,
          input.actorUserId,
          input.actorUserId
        ]
      );
    } catch (error) {
      this.translateDuplicate(error, "CATEGORY_ALREADY_EXISTS");
    }
  }

  async updateCategory(input: Category & { actorUserId: string }): Promise<void> {
    try {
      await this.pool.execute(
        `UPDATE categories
         SET code = ?, name = ?, description = ?, is_active = ?, updated_by_user_id = ?
         WHERE id = ?`,
        [
          input.code,
          input.name,
          input.description,
          input.isActive,
          input.actorUserId,
          input.id
        ]
      );
    } catch (error) {
      this.translateDuplicate(error, "CATEGORY_ALREADY_EXISTS");
    }
  }

  async listMappings(): Promise<CategoryDepartmentMapping[]> {
    const [rows] = await this.pool.query<MappingRow[]>(
      `SELECT m.id, m.category_id AS categoryId, c.name AS categoryName,
              m.department_id AS departmentId, d.name AS departmentName,
              m.is_active AS isActive, m.effective_from AS effectiveFrom,
              m.updated_at AS updatedAt
       FROM category_department_mappings AS m
       INNER JOIN categories AS c ON c.id = m.category_id
       INNER JOIN departments AS d ON d.id = m.department_id
       ORDER BY c.name`
    );
    return rows.map((row) => ({ ...row, isActive: Boolean(row.isActive) }));
  }

  async upsertMapping(input: {
    id: string;
    categoryId: string;
    departmentId: string;
    actorUserId: string;
  }): Promise<void> {
    await this.pool.execute(
      `INSERT INTO category_department_mappings
        (id, category_id, department_id, is_active, created_by_user_id, updated_by_user_id)
       VALUES (?, ?, ?, TRUE, ?, ?)
       AS incoming
       ON DUPLICATE KEY UPDATE
         department_id = incoming.department_id,
         is_active = TRUE,
         effective_from = CURRENT_TIMESTAMP(3),
         updated_by_user_id = incoming.updated_by_user_id`,
      [input.id, input.categoryId, input.departmentId, input.actorUserId, input.actorUserId]
    );
  }

  async listDepartmentAccountMappings(): Promise<DepartmentAccountMapping[]> {
    const [rows] = await this.pool.query<AccountMappingRow[]>(
      `SELECT m.id, m.user_id AS userId, m.department_id AS departmentId,
              d.name AS departmentName, m.is_active AS isActive, m.assigned_at AS assignedAt
       FROM department_account_mappings AS m
       INNER JOIN departments AS d ON d.id = m.department_id
       ORDER BY d.name, m.assigned_at`
    );
    return rows.map((row) => ({ ...row, isActive: Boolean(row.isActive) }));
  }

  async findDepartmentAccountMappingByDepartmentId(
    departmentId: string
  ): Promise<DepartmentAccountMapping | null> {
    const [rows] = await this.pool.execute<AccountMappingRow[]>(
      `SELECT m.id, m.user_id AS userId, m.department_id AS departmentId,
              d.name AS departmentName, m.is_active AS isActive, m.assigned_at AS assignedAt
       FROM department_account_mappings AS m
       INNER JOIN departments AS d ON d.id = m.department_id
       WHERE m.department_id = ? LIMIT 1`,
      [departmentId]
    );
    const row = rows[0];
    return row ? { ...row, isActive: Boolean(row.isActive) } : null;
  }

  async createDepartmentAccountMapping(input: {
    id: string;
    userId: string;
    departmentId: string;
    actorUserId: string;
  }): Promise<void> {
    try {
      await this.pool.execute(
        `INSERT INTO department_account_mappings
          (id, user_id, department_id, is_active, assigned_by_user_id)
         VALUES (?, ?, ?, TRUE, ?)`,
        [input.id, input.userId, input.departmentId, input.actorUserId]
      );
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ER_DUP_ENTRY") {
        throw new AppError(
          409,
          "DEPARTMENT_ACCOUNT_ALREADY_EXISTS",
          "This department already has a Department Account."
        );
      }
      throw error;
    }
  }

  async setDepartmentAccountMappingActive(userId: string, isActive: boolean): Promise<void> {
    const [result] = await this.pool.execute<ResultSetHeader>(
      `UPDATE department_account_mappings
       SET is_active = ?, deactivated_at = CASE WHEN ? THEN NULL ELSE CURRENT_TIMESTAMP(3) END
       WHERE user_id = ?`,
      [isActive, isActive, userId]
    );
    if (result.affectedRows !== 1) {
      throw new AppError(404, "DEPARTMENT_ACCOUNT_NOT_FOUND", "Department Account not found.");
    }
  }

  private translateDuplicate(error: unknown, code: string): never {
    if (error instanceof Error && "code" in error && error.code === "ER_DUP_ENTRY") {
      throw new AppError(409, code, "The code or name is already in use.");
    }
    throw error;
  }
}

