export interface Department {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Category {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CategoryDepartmentMapping {
  id: string;
  categoryId: string;
  categoryName: string;
  departmentId: string;
  departmentName: string;
  isActive: boolean;
  effectiveFrom: Date;
  updatedAt: Date;
}

export interface DepartmentAccountMapping {
  id: string;
  userId: string;
  departmentId: string;
  departmentName: string;
  isActive: boolean;
  assignedAt: Date;
}

export interface CategoryRouting {
  categoryId: string;
  categoryName: string;
  departmentId: string | null;
  departmentName: string | null;
}

