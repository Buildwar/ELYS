import {
  User,
  Category,
  Task,
  Execution,
  ExecutionLog,
  DashboardData,
  AboutData,
  Destination,
  Credential,
  Template,
  AuditLog,
  NotificationSettings,
  NotificationDelivery,
  BackupItem,
  BackupPreview,
} from '../types/index.js';

const API_BASE = '/api';

class ApiService {
  private getToken(): string | null {
    return localStorage.getItem('elys_token');
  }

  setToken(token: string) {
    localStorage.setItem('elys_token', token);
  }

  clearToken() {
    localStorage.removeItem('elys_token');
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      this.clearToken();
      window.dispatchEvent(new CustomEvent('elys:unauthorized'));
      throw new Error('Unauthorized');
    }

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || data.message || `Error ${response.status}`);
    }

    return data as T;
  }

  // Auth
  async getSetupStatus(): Promise<{ initialized: boolean }> {
    return this.request<{ initialized: boolean }>('/auth/setup-status');
  }

  async setupAdmin(data: { username?: string; password?: string; email?: string }): Promise<{ token: string; user: User; message: string }> {
    const res = await this.request<{ token: string; user: User; message: string }>('/auth/setup', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (res.token) {
      this.setToken(res.token);
    }
    return res;
  }

  async login(credentials: { username: string; password: string }): Promise<{ token: string; user: User }> {
    const res = await this.request<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    this.setToken(res.token);
    return res;
  }

  async getMe(): Promise<User> {
    return this.request<User>('/auth/me');
  }

  async changePassword(passwords: { currentPassword: string; newPassword: string }): Promise<{ message: string; token?: string; user?: User }> {
    const res = await this.request<{ message: string; token?: string; user?: User }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(passwords),
    });
    if (res.token) {
      this.setToken(res.token);
    }
    return res;
  }

  // Tasks
  async getTasks(params?: {
    search?: string;
    category?: string;
    status?: string;
    type?: string;
    destination?: string;
    tag?: string;
    state?: string;
    favorite?: boolean;
    trashed?: boolean;
  }): Promise<Task[]> {
    const query = new URLSearchParams();
    if (params?.search) query.append('search', params.search);
    if (params?.category) query.append('category', params.category);
    if (params?.status) query.append('status', params.status);
    if (params?.type) query.append('type', params.type);
    if (params?.destination) query.append('destination', params.destination);
    if (params?.tag) query.append('tag', params.tag);
    if (params?.state) query.append('state', params.state);
    if (params?.favorite) query.append('favorite', '1');
    if (params?.trashed) query.append('trashed', '1');

    const qs = query.toString() ? `?${query.toString()}` : '';
    return this.request<Task[]>(`/tasks${qs}`);
  }

  async getTrashTasks(): Promise<Task[]> {
    return this.request<Task[]>('/tasks/trash');
  }

  async getTask(id: string): Promise<Task> {
    return this.request<Task>(`/tasks/${id}`);
  }

  async createTask(taskData: any): Promise<Task> {
    return this.request<Task>('/tasks', {
      method: 'POST',
      body: JSON.stringify(taskData),
    });
  }

  async updateTask(id: string, taskData: any): Promise<Task> {
    return this.request<Task>(`/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(taskData),
    });
  }

  async deleteTask(id: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/tasks/${id}`, {
      method: 'DELETE',
    });
  }

  async restoreTask(id: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/tasks/${id}/restore`, {
      method: 'POST',
    });
  }

  async deleteTaskPermanent(id: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/tasks/${id}/permanent`, {
      method: 'DELETE',
    });
  }

  async toggleTask(id: string): Promise<Task> {
    return this.request<Task>(`/tasks/${id}/toggle`, {
      method: 'POST',
    });
  }

  async toggleTaskFavorite(id: string): Promise<{ is_favorite: number }> {
    return this.request<{ is_favorite: number }>(`/tasks/${id}/favorite`, {
      method: 'POST',
    });
  }

  async pauseTask(id: string, pausedUntil?: string): Promise<{ state: string; paused_until?: string | null }> {
    return this.request<{ state: string; paused_until?: string | null }>(`/tasks/${id}/pause`, {
      method: 'POST',
      body: JSON.stringify({ pausedUntil }),
    });
  }

  async resumeTask(id: string): Promise<{ state: string }> {
    return this.request<{ state: string }>(`/tasks/${id}/resume`, {
      method: 'POST',
    });
  }

  async duplicateTask(id: string): Promise<Task> {
    return this.request<Task>(`/tasks/${id}/duplicate`, {
      method: 'POST',
    });
  }

  async executeTaskManual(
    id: string,
    options?: { specificDestinationId?: string; isDryRun?: boolean }
  ): Promise<{ message: string; executionId: string; isDryRun?: boolean }> {
    return this.request<{ message: string; executionId: string; isDryRun?: boolean }>(`/tasks/${id}/execute`, {
      method: 'POST',
      body: JSON.stringify(options || {}),
    });
  }

  async previewTaskCommand(id: string): Promise<{
    destination_id: string;
    destination_name: string;
    os_name: string;
    resolved_command: string;
    variables_evaluated: Record<string, string>;
  }[]> {
    return this.request<any[]>(`/tasks/${id}/preview`, {
      method: 'POST',
    });
  }

  async previewTask(id: string): Promise<any[]> {
    return this.previewTaskCommand(id);
  }

  async runTask(id: string, options?: { specificDestinationId?: string; dryRun?: boolean }): Promise<{ message: string; executionId: string; isDryRun?: boolean }> {
    return this.executeTaskManual(id, {
      specificDestinationId: options?.specificDestinationId,
      isDryRun: options?.dryRun,
    });
  }

  async toggleFavorite(id: string): Promise<{ is_favorite: number }> {
    return this.toggleTaskFavorite(id);
  }

  async permanentDeleteTask(id: string): Promise<{ message: string }> {
    return this.deleteTaskPermanent(id);
  }

  async pruneExecutions(options?: { daysToKeep?: number }): Promise<{ message: string; deletedExecutions: number }> {
    return this.pruneExecutionLogs(options?.daysToKeep ?? 30);
  }

  async bulkTasks(
    taskIds: string[],
    action: string,
    tag?: string
  ): Promise<{ message: string; affected: number }> {
    return this.request<{ message: string; affected: number }>('/tasks/bulk', {
      method: 'POST',
      body: JSON.stringify({ taskIds, action, tag }),
    });
  }

  async exportTasks(taskIds?: string[]): Promise<any> {
    return this.request<any>('/tasks/export', {
      method: 'POST',
      body: JSON.stringify({ taskIds }),
    });
  }

  async importTasks(importData: any, conflictResolution: string = 'create_new'): Promise<any> {
    return this.request<any>('/tasks/import', {
      method: 'POST',
      body: JSON.stringify({ importData, conflictResolution }),
    });
  }

  async getTaskDependencies(id: string): Promise<{ dependencies: any[]; dependents: any[] }> {
    return this.request<{ dependencies: any[]; dependents: any[] }>(`/tasks/${id}/dependencies`);
  }

  async addTaskDependency(id: string, dependsOnTaskId: string, condition: string = 'success'): Promise<any> {
    return this.request<any>(`/tasks/${id}/dependencies`, {
      method: 'POST',
      body: JSON.stringify({ dependsOnTaskId, condition }),
    });
  }

  async removeTaskDependency(taskId: string, depId: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/tasks/${taskId}/dependencies/${depId}`, {
      method: 'DELETE',
    });
  }

  async getTaskHistory(id: string): Promise<any[]> {
    return this.request<any[]>(`/tasks/${id}/history`);
  }

  async getTaskExecutions(id: string): Promise<Execution[]> {
    return this.request<Execution[]>(`/tasks/${id}/executions`);
  }

  // Destinations (Execution Targets)
  async getDestinations(params?: { system_type?: string; category?: string; search?: string; active?: string }): Promise<Destination[]> {
    const query = new URLSearchParams();
    if (params?.system_type) query.append('system_type', params.system_type);
    if (params?.category) query.append('category', params.category);
    if (params?.search) query.append('search', params.search);
    if (params?.active) query.append('active', params.active);

    const qs = query.toString() ? `?${query.toString()}` : '';
    return this.request<Destination[]>(`/destinations${qs}`);
  }

  async getDestination(id: string): Promise<Destination & { tasks: Task[]; recentExecutions: Execution[] }> {
    return this.request<Destination & { tasks: Task[]; recentExecutions: Execution[] }>(`/destinations/${id}`);
  }

  async createDestination(destData: any): Promise<Destination> {
    return this.request<Destination>('/destinations', {
      method: 'POST',
      body: JSON.stringify(destData),
    });
  }

  async updateDestination(id: string, destData: any): Promise<Destination> {
    return this.request<Destination>(`/destinations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(destData),
    });
  }

  async deleteDestination(id: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/destinations/${id}`, {
      method: 'DELETE',
    });
  }

  async testDestination(id: string): Promise<{
    success: boolean;
    destination?: string;
    hostname?: string;
    method?: string;
    port?: number;
    duration_ms?: number;
    message: string;
    details?: string;
    testedAt?: string;
  }> {
    return this.request<any>(`/destinations/${id}/test`, {
      method: 'POST',
    });
  }

  // Credentials
  async getCredentials(): Promise<Credential[]> {
    return this.request<Credential[]>('/credentials');
  }

  async createCredential(credData: any): Promise<Credential> {
    return this.request<Credential>('/credentials', {
      method: 'POST',
      body: JSON.stringify(credData),
    });
  }

  async updateCredential(id: string, credData: any): Promise<Credential> {
    return this.request<Credential>(`/credentials/${id}`, {
      method: 'PUT',
      body: JSON.stringify(credData),
    });
  }

  async deleteCredential(id: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/credentials/${id}`, {
      method: 'DELETE',
    });
  }

  // Templates
  async getTemplates(params?: { system_type?: string; command_type?: string; search?: string }): Promise<Template[]> {
    const query = new URLSearchParams();
    if (params?.system_type) query.append('system_type', params.system_type);
    if (params?.command_type) query.append('command_type', params.command_type);
    if (params?.search) query.append('search', params.search);

    const qs = query.toString() ? `?${query.toString()}` : '';
    return this.request<Template[]>(`/templates${qs}`);
  }

  async createTemplate(templateData: any): Promise<Template> {
    return this.request<Template>('/templates', {
      method: 'POST',
      body: JSON.stringify(templateData),
    });
  }

  async updateTemplate(id: string, templateData: any): Promise<Template> {
    return this.request<Template>(`/templates/${id}`, {
      method: 'PUT',
      body: JSON.stringify(templateData),
    });
  }

  async deleteTemplate(id: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/templates/${id}`, {
      method: 'DELETE',
    });
  }

  // Executions
  async getExecutions(params?: { status?: string; taskId?: string; limit?: number; offset?: number }): Promise<{
    data: Execution[];
    total: number;
    limit: number;
    offset: number;
  }> {
    const query = new URLSearchParams();
    if (params?.status) query.append('status', params.status);
    if (params?.taskId) query.append('taskId', params.taskId);
    if (params?.limit) query.append('limit', String(params.limit));
    if (params?.offset) query.append('offset', String(params.offset));

    const qs = query.toString() ? `?${query.toString()}` : '';
    return this.request<{ data: Execution[]; total: number; limit: number; offset: number }>(`/executions${qs}`);
  }

  async getExecution(id: string): Promise<Execution> {
    return this.request<Execution>(`/executions/${id}`);
  }

  async getExecutionLogs(id: string): Promise<ExecutionLog[]> {
    return this.request<ExecutionLog[]>(`/executions/${id}/logs`);
  }

  getExecutionDownloadUrl(id: string, format: 'txt' | 'json' | 'csv' = 'txt'): string {
    return `${API_BASE}/executions/${id}/download?format=${format}`;
  }

  async cancelExecution(id: string, reason?: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/executions/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  async pruneExecutionLogs(days: number = 30): Promise<{ message: string; deletedExecutions: number }> {
    return this.request<{ message: string; deletedExecutions: number }>('/executions/prune', {
      method: 'POST',
      body: JSON.stringify({ days }),
    });
  }

  // Categories
  async getCategories(): Promise<Category[]> {
    return this.request<Category[]>('/categories');
  }

  async createCategory(cat: { name: string; description?: string; color?: string; icon?: string }): Promise<Category> {
    return this.request<Category>('/categories', {
      method: 'POST',
      body: JSON.stringify(cat),
    });
  }

  async updateCategory(id: string, cat: { name?: string; description?: string; color?: string; icon?: string }): Promise<Category> {
    return this.request<Category>(`/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(cat),
    });
  }

  async deleteCategory(id: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/categories/${id}`, {
      method: 'DELETE',
    });
  }

  // Users
  async getUsers(): Promise<User[]> {
    return this.request<User[]>('/users');
  }

  async createUser(user: any): Promise<User> {
    return this.request<User>('/users', {
      method: 'POST',
      body: JSON.stringify(user),
    });
  }

  async updateUser(id: string, user: any): Promise<User> {
    return this.request<User>(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(user),
    });
  }

  async deleteUser(id: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/users/${id}`, {
      method: 'DELETE',
    });
  }

  // Settings
  async getSettings(): Promise<Record<string, any>> {
    return this.request<Record<string, any>>('/settings');
  }

  async updateSetting(key: string, value: any): Promise<{ key: string; value: any }> {
    return this.request<{ key: string; value: any }>(`/settings/${key}`, {
      method: 'PUT',
      body: JSON.stringify(value),
    });
  }

  // System
  async getDashboard(): Promise<DashboardData> {
    return this.request<DashboardData>('/system/dashboard');
  }

  async searchGlobal(q: string): Promise<{
    tasks: any[];
    destinations: any[];
    categories: any[];
    executions: any[];
  }> {
    return this.request<{ tasks: any[]; destinations: any[]; categories: any[]; executions: any[] }>(`/system/search?q=${encodeURIComponent(q)}`);
  }

  async getAbout(): Promise<AboutData> {
    return this.request<AboutData>('/system/about');
  }

  // Audit Logs
  async getAuditLogs(params?: { search?: string; action?: string; entity_type?: string; limit?: number }): Promise<AuditLog[]> {
    const query = new URLSearchParams();
    if (params?.search) query.append('search', params.search);
    if (params?.action) query.append('action', params.action);
    if (params?.entity_type) query.append('entity_type', params.entity_type);
    if (params?.limit) query.append('limit', params.limit.toString());

    const qs = query.toString() ? `?${query.toString()}` : '';
    return this.request<AuditLog[]>(`/audit${qs}`);
  }

  // Notifications
  async getNotifications(): Promise<NotificationSettings> {
    return this.request<NotificationSettings>('/notifications');
  }

  async updateNotifications(settings: Partial<NotificationSettings>): Promise<{ message: string }> {
    return this.request<{ message: string }>('/notifications', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  }

  async testTelegram(data: { bot_token?: string; chat_id?: string }): Promise<{ message: string }> {
    return this.request<{ message: string }>('/notifications/test/telegram', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async testEmail(data: any): Promise<{ message: string }> {
    return this.request<{ message: string }>('/notifications/test/email', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getNotificationDeliveries(limit: number = 50): Promise<NotificationDelivery[]> {
    return this.request<NotificationDelivery[]>(`/notifications/deliveries?limit=${limit}`);
  }

  // Backup & Restore
  async getBackups(): Promise<BackupItem[]> {
    return this.request<BackupItem[]>('/backup/list');
  }

  async createBackup(): Promise<{ message: string; backup: any }> {
    return this.request<{ message: string; backup: any }>('/backup/create', {
      method: 'POST',
    });
  }

  getBackupDownloadUrl(filename: string): string {
    return `${API_BASE}/backup/download/${encodeURIComponent(filename)}`;
  }

  async validateBackup(backupContent: string | object): Promise<BackupPreview> {
    return this.request<BackupPreview>('/backup/validate', {
      method: 'POST',
      body: JSON.stringify({ backupContent }),
    });
  }

  async restoreBackup(params: {
    backupId?: string;
    backupContent?: string | object;
    mode?: 'full' | 'selective';
    sections?: string[];
  }): Promise<{ success: boolean; message: string; safetyBackup: string }> {
    return this.request<{ success: boolean; message: string; safetyBackup: string }>('/backup/restore', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async deleteBackup(filename: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(`/backup/${encodeURIComponent(filename)}`, {
      method: 'DELETE',
    });
  }

  // Scheduler Control (Section 56)
  async getSchedulerStatus(): Promise<{ isPaused: boolean; running: number; activeTasks: number }> {
    return this.request<{ isPaused: boolean; running: number; activeTasks: number }>('/system/scheduler');
  }

  async pauseScheduler(): Promise<{ message: string; isPaused: boolean }> {
    return this.request<{ message: string; isPaused: boolean }>('/system/scheduler/pause', {
      method: 'POST',
    });
  }

  async resumeScheduler(): Promise<{ message: string; isPaused: boolean }> {
    return this.request<{ message: string; isPaused: boolean }>('/system/scheduler/resume', {
      method: 'POST',
    });
  }
}

export const api = new ApiService();
