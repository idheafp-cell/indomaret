import apiClient from "./client";

/* Dashboard & Peta */
export const getDashboard = (params) =>
  apiClient.get("/dashboard", { params }).then((r) => r.data.data);

export const getStoresMap = () =>
  apiClient.get("/stores/map").then((r) => r.data.data);

/* Regencies (khusus manager) */
export const listRegencies = () =>
  apiClient.get("/regencies").then((r) => r.data.data);
export const createRegency = (payload) =>
  apiClient.post("/regencies", payload).then((r) => r.data.data);

/* Stores */
export const listStores = (params) =>
  apiClient.get("/stores", { params }).then((r) => r.data.data);
export const getStore = (id) =>
  apiClient.get(`/stores/${id}`).then((r) => r.data.data);
/* Isi pop-up gerai di peta — dipanggil saat marker diklik, bukan saat
   halaman peta dimuat, supaya request awal peta tetap ringan. */
export const getStoreMapSummary = (id) =>
  apiClient.get(`/stores/${id}/map-summary`).then((r) => r.data.data);
export const createStore = (payload) =>
  apiClient.post("/stores", payload).then((r) => r.data.data);
export const updateStore = (id, payload) =>
  apiClient.put(`/stores/${id}`, payload).then((r) => r.data.data);
export const deleteStore = (id) =>
  apiClient.delete(`/stores/${id}`).then((r) => r.data);

/* Kategori Barang (Item Categories) */
export const listItemCategories = (params) =>
  apiClient.get("/item-categories", { params }).then((r) => r.data.data);
export const createItemCategory = (payload) =>
  apiClient.post("/item-categories", payload).then((r) => r.data.data);

/* Users (manager mengelola akun manager/supervisor/cashier) */
export const listUsers = (params) =>
  apiClient.get("/users", { params }).then((r) => r.data.data);
export const createUser = (payload) =>
  apiClient.post("/users", payload).then((r) => r.data.data);
export const updateUser = (id, payload) =>
  apiClient.put(`/users/${id}`, payload).then((r) => r.data.data);
export const deleteUser = (id) =>
  apiClient.delete(`/users/${id}`).then((r) => r.data);

/* Employees (kasir/karyawan) */
export const listEmployees = (params) =>
  apiClient.get("/employees", { params }).then((r) => r.data.data);
export const createEmployee = (payload) =>
  apiClient.post("/employees", payload).then((r) => r.data.data);
export const updateEmployee = (id, payload) =>
  apiClient.put(`/employees/${id}`, payload).then((r) => r.data.data);
export const deleteEmployee = (id) =>
  apiClient.delete(`/employees/${id}`).then((r) => r.data);

/* Expenses (Barang Keluar) */
export const listExpenses = (params) =>
  apiClient.get("/expenses", { params }).then((r) => r.data);
export const createExpense = (payload) =>
  apiClient.post("/expenses", payload).then((r) => r.data.data);
export const updateExpense = (id, payload) =>
  apiClient.put(`/expenses/${id}`, payload).then((r) => r.data.data);
export const deleteExpense = (id) =>
  apiClient.delete(`/expenses/${id}`).then((r) => r.data);
export const approveExpense = (id) =>
  apiClient.post(`/expenses/${id}/approve`).then((r) => r.data.data);
export const rejectExpense = (id, rejection_reason) =>
  apiClient.post(`/expenses/${id}/reject`, { rejection_reason }).then((r) => r.data.data);

/* Incomes (Pemasukan) */
export const listIncomes = (params) =>
  apiClient.get("/incomes", { params }).then((r) => r.data);
export const createIncome = (payload) =>
  apiClient.post("/incomes", payload).then((r) => r.data.data);
export const updateIncome = (id, payload) =>
  apiClient.put(`/incomes/${id}`, payload).then((r) => r.data.data);
export const deleteIncome = (id) =>
  apiClient.delete(`/incomes/${id}`).then((r) => r.data);
export const approveIncome = (id) =>
  apiClient.post(`/incomes/${id}/approve`).then((r) => r.data.data);
export const rejectIncome = (id, rejection_reason) =>
  apiClient.post(`/incomes/${id}/reject`, { rejection_reason }).then((r) => r.data.data);

/* Notifikasi (semua role, termasuk cashier) - di-poll berkala */
export const listNotifications = (params) =>
  apiClient.get("/notifications", { params }).then((r) => r.data);
export const markNotificationRead = (id) =>
  apiClient.post(`/notifications/${id}/read`).then((r) => r.data.data);
export const markAllNotificationsRead = () =>
  apiClient.post("/notifications/read-all").then((r) => r.data);
