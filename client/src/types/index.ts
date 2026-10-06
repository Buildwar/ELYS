export type Role = 'admin' | 'operator' | 'user';

export interface User {
  id: string;
  username: string;
  email: string;
  role: Role;
  is_active: number;
  must_change_password?: boolean | number;
  mustChangePassword?: boolean;
  created_at: string;
  updated_at?: string;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  color: string;
  icon: string;
  task_count?: number;
  created_at: string;
}

export type SystemType = 'windows_server' | 'windows_desktop' | 'linux' | 'bsd' | 'other';
export type ConnectionMethod = 'winrm' | 'ps_remoting' | 'ssh' | 'local';

export interface Credential {
  id: string;
  name: string;
  type: 'winrm_password' | 'ssh_password' | 'ssh_key' | 'service_account' | 'token';
  username: string;
  secret_masked?: string;
  domain?: string | null;
  description?: string | null;
  used_in_destinations?: number;
  used_in_tasks?: number;
  created_at: string;
  updated_at?: string;
}

export interface Destination {
  id: string;
  name: string;
  hostname: string;
  ip_address?: string | null;
  system_type: SystemType;
  os_name: string;
  os_version?: string | null;
  category: string;
  description?: string | null;
  is_active: number;
  connection_method: ConnectionMethod;
  credential_id?: string | null;
  credential_name?: string | null;
  credential_username?: string | null;
  port?: number | null;
  domain?: string | null;
  tags?: string;
  task_count?: number;
  created_at: string;
  last_used_at?: string | null;
}

export interface Template {
  id: string;
  name: string;
  description?: string | null;
  system_type: string;
  command_type: string;
  command_template: string;
  default_timeout: number;
  tags?: string;
  task_count?: number;
  created_at: string;
}

export type TaskType = 'command' | 'http' | 'script';
export type CommandType = 'powershell' | 'cmd' | 'bash' | 'script' | 'http';
export type ScheduleType = 'interval' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'cron' | 'once';
export type ExecutionStatus = 'pending' | 'running' | 'success' | 'failed' | 'cancelled';

export type TaskState = 'ACTIVE' | 'PAUSED' | 'DISABLED' | 'RUNNING' | 'WAITING' | 'FAILED';

export interface TaskVariable {
  key: string;
  value: string;
  is_secret?: boolean;
}

export interface TaskDependency {
  id: string;
  task_id: string;
  depends_on_task_id: string;
  condition: 'success' | 'failed' | 'completed';
  created_at: string;
  task_name?: string;
  depends_on_task_name?: string;
}

export interface TaskHistoryItem {
  id: string;
  task_id: string;
  action: string;
  changed_by: string;
  change_summary: string;
  diff?: any;
  created_at: string;
}

export interface ExecutionLog {
  id: string;
  execution_id: string;
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG' | 'SYSTEM';
  message: string;
  details?: string;
}

export interface Task {
  id: string;
  name: string;
  description?: string;
  category_id?: string;
  category_name?: string;
  category_color?: string;
  template_id?: string | null;
  credential_id?: string | null;
  credential_name?: string | null;
  target_type: 'single' | 'multiple' | 'group' | 'local';
  target_group?: string | null;
  destinations?: { id: string; name: string; os_name: string; system_type: string }[];
  is_active: number;
  state?: TaskState;
  paused_until?: string | null;
  is_favorite?: number;
  is_trashed?: number;
  deleted_at?: string | null;
  concurrency_limit?: number;
  concurrency_policy?: 'allow' | 'block' | 'queue' | 'replace';
  retry_interval_seconds?: number;
  retry_backoff?: 'fixed' | 'progressive';
  multitarget_error_policy?: 'continue_others' | 'abort_group' | 'stop_all';
  misfire_policy?: 'run_immediately' | 'skip' | 'tolerance_window';
  misfire_tolerance_minutes?: number;
  variables?: TaskVariable[] | string;
  target_params?: Record<string, Record<string, string>> | string;
  notify_telegram?: number;
  notify_email?: number;
  notify_on_success?: number;
  notify_on_fail?: number;
  task_type: TaskType;
  command_type: CommandType;
  payload: string; // JSON string
  schedule_type: ScheduleType;
  schedule_expression: string;
  timezone: string;
  timeout_seconds: number;
  max_retries: number;
  on_error: 'continue' | 'abort' | 'retry';
  next_run_at?: string | null;
  last_run_at?: string | null;
  last_status?: ExecutionStatus | null;
  last_duration_ms?: number | null;
  tags?: string[] | string;
  dependencies?: TaskDependency[];
  dependents?: TaskDependency[];
  created_by?: string;
  creator_username?: string;
  created_at: string;
  updated_at: string;
}

export interface Execution {
  id: string;
  task_id: string;
  task_name: string;
  current_task_name?: string;
  destination_id?: string | null;
  destination_name?: string | null;
  target_name?: string | null;
  destination_os?: string | null;
  execution_method?: string;
  task_type?: TaskType;
  triggered_by: 'scheduler' | 'manual';
  triggered_by_user?: string | null;
  status: ExecutionStatus;
  started_at: string;
  finished_at?: string | null;
  duration_ms?: number | null;
  exit_code?: number | null;
  output?: string;
  error_output?: string;
  is_dry_run?: number;
  retry_count?: number;
  max_retries?: number;
  error_type?: string;
  command_resolved?: string;
  group_execution_id?: string;
  cancelled_by?: string;
  cancelled_at?: string;
  cancellation_reason?: string;
  logs?: ExecutionLog[];
}

export interface DashboardMetrics {
  totalTasks: number;
  activeTasks: number;
  disabledTasks: number;
  pausedTasks?: number;
  trashedTasks?: number;
  totalDestinations: number;
  totalExecutions: number;
  successCount: number;
  failedCount: number;
  runningCount: number;
  dependenciesCount?: number;
}

export interface DashboardData {
  metrics: DashboardMetrics;
  isSchedulerPaused?: boolean;
  runningExecutions?: Execution[];
  upcomingExecutions: (Task & {
    destination_name?: string;
    destination_os?: string;
    destination_system_type?: string;
  })[];
  recentExecutions: Execution[];
  attentionTasks: (Task & { destination_name?: string })[];
}

export interface AboutData {
  name: string;
  version: string;
  description: string;
  author: string;
  releaseDate: string;
  nodeVersion: string;
  platform: string;
  uptimeSeconds: number;
  database: string;
}

export interface AuditLog {
  id: string;
  action: 'create' | 'update' | 'delete' | 'execute_manual' | string;
  entity_type: 'task' | 'destination' | 'credential' | 'user' | 'setting' | string;
  entity_id?: string | null;
  entity_name?: string | null;
  user_id?: string | null;
  username: string;
  details?: string | null;
  ip_address?: string | null;
  created_at: string;
}

export interface TelegramConfig {
  enabled: boolean;
  bot_token: string;
  chat_id: string;
}

export interface EmailConfig {
  enabled: boolean;
  smtp_host: string;
  smtp_port: number;
  smtp_secure: boolean;
  smtp_user: string;
  smtp_pass: string;
  from_email: string;
  from_name: string;
  to_email: string;
}

export interface NotificationRules {
  notify_on_success: boolean;
  notify_on_fail: boolean;
  notify_connection_error: boolean;
  notify_auth_error: boolean;
  channel_telegram: boolean;
  channel_email: boolean;
  group_notifications: boolean;
}

export interface NotificationSettings {
  telegram: TelegramConfig;
  email: EmailConfig;
  rules: NotificationRules;
}

export interface NotificationDelivery {
  id: string;
  channel: 'telegram' | 'email';
  event: string;
  recipient: string;
  status: 'SUCCESS' | 'FAILED';
  subject?: string;
  content?: string;
  error_details?: string;
  created_at: string;
}

export interface BackupItem {
  id: string;
  filename: string;
  version: number;
  elys_version: string;
  created_at: string;
  created_by: string;
  type: 'full' | 'auto_safety';
  size_bytes: number;
  summary: {
    users_count?: number;
    destinations_count?: number;
    credentials_count?: number;
    categories_count?: number;
    templates_count?: number;
    tasks_count?: number;
    settings_count?: number;
  };
}

export interface BackupPreview {
  valid: boolean;
  version: number;
  elys_version: string;
  created_at: string;
  created_by: string;
  type: string;
  summary: {
    users_count: number;
    tasks_count: number;
    destinations_count: number;
    credentials_count: number;
    templates_count: number;
  };
}
