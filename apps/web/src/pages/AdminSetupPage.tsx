import { useCallback, useEffect, useState, type FormEvent } from "react";

import { apiRequest, messageFromError } from "../api/client";
import type { Category, CategoryMapping, Department, DepartmentAccountMapping } from "../api/types";
import { EmptyState, ErrorBanner, LoadingState, SuccessBanner } from "../components/Feedback";
import { PageHeader } from "../components/PageHeader";
import { StatusBadge } from "../components/StatusBadge";

type Tab = "departments" | "categories" | "accounts";

export const AdminSetupPage = () => {
  const [tab, setTab] = useState<Tab>("departments");
  const [departments, setDepartments] = useState<Department[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [mappings, setMappings] = useState<CategoryMapping[]>([]);
  const [accounts, setAccounts] = useState<DepartmentAccountMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [departmentForm, setDepartmentForm] = useState({ code: "", name: "", description: "" });
  const [categoryForm, setCategoryForm] = useState({ code: "", name: "", description: "" });
  const [mappingForm, setMappingForm] = useState({ categoryId: "", departmentId: "" });
  const [accountForm, setAccountForm] = useState({ departmentId: "", email: "", password: "", displayName: "" });

  const load = useCallback(async () => {
    setError("");
    try {
      const [departmentResponse, categoryResponse, mappingResponse, accountResponse] = await Promise.all([
        apiRequest<{ data: { departments: Department[] } }>({ url: "/api/v1/admin/departments" }),
        apiRequest<{ data: { categories: Category[] } }>({ url: "/api/v1/admin/categories" }),
        apiRequest<{ data: { mappings: CategoryMapping[] } }>({ url: "/api/v1/admin/category-mappings" }),
        apiRequest<{ data: { accounts: DepartmentAccountMapping[] } }>({ url: "/api/v1/admin/department-accounts" })
      ]);
      setDepartments(departmentResponse.data.departments); setCategories(categoryResponse.data.categories); setMappings(mappingResponse.data.mappings); setAccounts(accountResponse.data.accounts);
    } catch (reason) { setError(messageFromError(reason)); } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const run = async (work: () => Promise<unknown>, message: string) => {
    setError(""); setSuccess("");
    try { await work(); setSuccess(message); await load(); } catch (reason) { setError(messageFromError(reason)); }
  };

  const createDepartment = (event: FormEvent) => { event.preventDefault(); void run(async () => { await apiRequest({ method: "POST", url: "/api/v1/admin/departments", data: { ...departmentForm, description: departmentForm.description || null } }); setDepartmentForm({ code: "", name: "", description: "" }); }, "Department created."); };
  const createCategory = (event: FormEvent) => { event.preventDefault(); void run(async () => { await apiRequest({ method: "POST", url: "/api/v1/admin/categories", data: { ...categoryForm, description: categoryForm.description || null } }); setCategoryForm({ code: "", name: "", description: "" }); }, "Category created."); };
  const saveMapping = (event: FormEvent) => { event.preventDefault(); void run(() => apiRequest({ method: "PUT", url: `/api/v1/admin/categories/${mappingForm.categoryId}/department-mapping`, data: { departmentId: mappingForm.departmentId } }), "Category routing updated."); };
  const createAccount = (event: FormEvent) => { event.preventDefault(); void run(async () => { await apiRequest({ method: "POST", url: "/api/v1/admin/department-accounts", data: accountForm }); setAccountForm({ departmentId: "", email: "", password: "", displayName: "" }); }, "Department Account created."); };
  const toggleAccount = (account: DepartmentAccountMapping) => void run(() => apiRequest({ method: "PATCH", url: `/api/v1/admin/department-accounts/${account.userId}/status`, data: { status: account.isActive ? "INACTIVE" : "ACTIVE" } }), `Department Account ${account.isActive ? "deactivated" : "activated"}.`);

  return (
    <div className="page-wrap">
      <PageHeader eyebrow="Administrator" title="Council setup" description="Maintain configurable departments, complaint categories, routing, and Department Accounts." />
      {error && <ErrorBanner message={error} />}{success && <SuccessBanner message={success} />}
      <div className="tabs" role="tablist">{(["departments", "categories", "accounts"] as Tab[]).map((item) => <button role="tab" aria-selected={tab === item} className={tab === item ? "active" : ""} onClick={() => setTab(item)} key={item}>{item === "accounts" ? "Department Accounts" : item[0]?.toUpperCase() + item.slice(1)}</button>)}</div>
      {loading ? <LoadingState label="Loading Council configuration" /> : tab === "departments" ? (
        <div className="setup-grid">
          <section className="panel"><div className="panel-heading"><div><p className="eyebrow">Configuration</p><h2>Departments</h2></div></div>{departments.length === 0 ? <EmptyState title="No departments" description="Create the first department." /> : <div className="admin-list">{departments.map((department) => <article key={department.id}><div><strong>{department.name}</strong><span>{department.code}</span><p>{department.description || "No description"}</p></div><StatusBadge value={department.isActive ? "ACTIVE" : "INACTIVE"} /></article>)}</div>}</section>
          <form className="panel side-form" onSubmit={createDepartment}><p className="eyebrow">Add configuration</p><h2>New department</h2><label>Code<input value={departmentForm.code} onChange={(event) => setDepartmentForm({ ...departmentForm, code: event.target.value.toUpperCase().replaceAll(" ", "_") })} required pattern="[A-Z][A-Z0-9_]+" minLength={2} maxLength={60} /></label><label>Name<input value={departmentForm.name} onChange={(event) => setDepartmentForm({ ...departmentForm, name: event.target.value })} required minLength={2} maxLength={150} /></label><label>Description<textarea rows={4} value={departmentForm.description} onChange={(event) => setDepartmentForm({ ...departmentForm, description: event.target.value })} maxLength={5000} /></label><button className="button button-primary button-wide">Create department</button></form>
        </div>
      ) : tab === "categories" ? (
        <div className="setup-grid setup-wide">
          <section className="panel"><div className="panel-heading"><div><p className="eyebrow">Complaint taxonomy</p><h2>Categories and routing</h2></div></div><div className="admin-list">{categories.map((category) => { const mapping = mappings.find((item) => item.categoryId === category.id); return <article key={category.id}><div><strong>{category.name}</strong><span>{category.code}</span><p>{mapping ? `Routes to ${mapping.departmentName}` : "No active department mapping"}</p></div><StatusBadge value={mapping ? "MAPPED" : "REVIEW_REQUIRED"} /></article>; })}</div></section>
          <div className="stacked-forms"><form className="panel side-form" onSubmit={createCategory}><p className="eyebrow">Add taxonomy</p><h2>New category</h2><label>Code<input value={categoryForm.code} onChange={(event) => setCategoryForm({ ...categoryForm, code: event.target.value.toUpperCase().replaceAll(" ", "_") })} required pattern="[A-Z][A-Z0-9_]+" /></label><label>Name<input value={categoryForm.name} onChange={(event) => setCategoryForm({ ...categoryForm, name: event.target.value })} required /></label><label>Description<textarea rows={3} value={categoryForm.description} onChange={(event) => setCategoryForm({ ...categoryForm, description: event.target.value })} /></label><button className="button button-primary button-wide">Create category</button></form><form className="panel side-form" onSubmit={saveMapping}><p className="eyebrow">Approved routing</p><h2>Map category</h2><label>Category<select value={mappingForm.categoryId} onChange={(event) => setMappingForm({ ...mappingForm, categoryId: event.target.value })} required><option value="">Select category</option>{categories.filter((item) => item.isActive).map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><label>Department<select value={mappingForm.departmentId} onChange={(event) => setMappingForm({ ...mappingForm, departmentId: event.target.value })} required><option value="">Select department</option>{departments.filter((item) => item.isActive).map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><button className="button button-secondary button-wide">Save routing</button></form></div>
        </div>
      ) : (
        <div className="setup-grid">
          <section className="panel"><div className="panel-heading"><div><p className="eyebrow">Access management</p><h2>Department Accounts</h2></div></div><div className="admin-list account-list">{accounts.map((account) => <article key={account.id}><div><strong>{account.user?.displayName || "Unavailable account"}</strong><span>{account.departmentName}</span><p>{account.user?.email}</p></div><div><StatusBadge value={account.isActive ? "ACTIVE" : "INACTIVE"} /><button className="button button-small button-secondary" onClick={() => toggleAccount(account)}>{account.isActive ? "Deactivate" : "Activate"}</button></div></article>)}</div></section>
          <form className="panel side-form" onSubmit={createAccount}><p className="eyebrow">Provision access</p><h2>New Department Account</h2><label>Department<select value={accountForm.departmentId} onChange={(event) => setAccountForm({ ...accountForm, departmentId: event.target.value })} required><option value="">Select department</option>{departments.filter((item) => item.isActive).map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label><label>Display name<input value={accountForm.displayName} onChange={(event) => setAccountForm({ ...accountForm, displayName: event.target.value })} required /></label><label>Email<input type="email" value={accountForm.email} onChange={(event) => setAccountForm({ ...accountForm, email: event.target.value })} required /></label><label>Temporary password<input type="password" value={accountForm.password} onChange={(event) => setAccountForm({ ...accountForm, password: event.target.value })} minLength={12} required /><small>Use at least 12 characters with uppercase, lowercase, and a number.</small></label><button className="button button-primary button-wide">Create Department Account</button></form>
        </div>
      )}
    </div>
  );
};
