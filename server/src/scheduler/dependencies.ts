import crypto from 'crypto';
import { db } from '../db/index.js';

export interface TaskDependency {
  id: string;
  task_id: string;
  depends_on_task_id: string;
  condition: 'success' | 'failed' | 'completed';
  created_at: string;
  // Join fields
  task_name?: string;
  depends_on_task_name?: string;
}

/**
 * Checks if adding an edge from taskId -> dependsOnTaskId would create a cycle.
 * That is, if dependsOnTaskId already reaches taskId in the dependency graph.
 */
export function wouldCreateCycle(taskId: string, dependsOnTaskId: string): boolean {
  if (taskId === dependsOnTaskId) return true;

  // Find if taskId is reachable from dependsOnTaskId
  // Graph: dependentTask -> depends_on -> ...
  const visited = new Set<string>();
  const queue = [dependsOnTaskId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === taskId) return true;
    if (visited.has(current)) continue;
    visited.add(current);

    // Find what 'current' depends on
    const deps = db.prepare(`
      SELECT depends_on_task_id FROM task_dependencies WHERE task_id = ?
    `).all(current) as { depends_on_task_id: string }[];

    for (const d of deps) {
      if (!visited.has(d.depends_on_task_id)) {
        queue.push(d.depends_on_task_id);
      }
    }
  }

  return false;
}

/**
 * Adds a dependency with circular check
 */
export function addTaskDependency(
  taskId: string,
  dependsOnTaskId: string,
  condition: 'success' | 'failed' | 'completed' = 'success'
): { success: boolean; error?: string; dependency?: TaskDependency } {
  if (taskId === dependsOnTaskId) {
    return { success: false, error: 'Una tarea no puede depender de sí misma.' };
  }

  if (wouldCreateCycle(taskId, dependsOnTaskId)) {
    return { success: false, error: 'Dependencia circular detectada. La relación provocaría un ciclo infinito.' };
  }

  try {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO task_dependencies (id, task_id, depends_on_task_id, condition, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, taskId, dependsOnTaskId, condition, now);

    return {
      success: true,
      dependency: { id, task_id: taskId, depends_on_task_id: dependsOnTaskId, condition, created_at: now },
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Error al registrar dependencia' };
  }
}

/**
 * Gets all dependencies for a task (tasks it depends on)
 */
export function getTaskDependencies(taskId: string): TaskDependency[] {
  return db.prepare(`
    SELECT td.*, t.name as depends_on_task_name
    FROM task_dependencies td
    JOIN tasks t ON t.id = td.depends_on_task_id
    WHERE td.task_id = ?
    ORDER BY td.created_at ASC
  `).all(taskId) as TaskDependency[];
}

/**
 * Gets all downstream dependents of a task (tasks that depend on this task)
 */
export function getTaskDependents(taskId: string): TaskDependency[] {
  return db.prepare(`
    SELECT td.*, t.name as task_name
    FROM task_dependencies td
    JOIN tasks t ON t.id = td.task_id
    WHERE td.depends_on_task_id = ?
    ORDER BY td.created_at ASC
  `).all(taskId) as TaskDependency[];
}

/**
 * Evaluates whether all dependencies for a task are currently satisfied
 */
export function areTaskDependenciesSatisfied(
  taskId: string,
  predecessorId: string,
  predecessorStatus: 'success' | 'failed' | 'cancelled'
): { satisfied: boolean; skippedReason?: string } {
  const deps = getTaskDependencies(taskId);
  if (deps.length === 0) return { satisfied: true };

  for (const dep of deps) {
    if (dep.depends_on_task_id === predecessorId) {
      if (dep.condition === 'success' && predecessorStatus !== 'success') {
        return {
          satisfied: false,
          skippedReason: `Dependencia fallida: la tarea predecesora "${dep.depends_on_task_name}" finalizó con estado "${predecessorStatus}".`,
        };
      }
      if (dep.condition === 'failed' && predecessorStatus === 'success') {
        return {
          satisfied: false,
          skippedReason: `Dependencia no activada: la tarea predecesora "${dep.depends_on_task_name}" finalizó con éxito pero se requería fallo.`,
        };
      }
    } else {
      // Check last run of this other dependency
      const otherTask = db.prepare('SELECT last_status FROM tasks WHERE id = ?').get(dep.depends_on_task_id) as any;
      if (!otherTask) continue;
      if (dep.condition === 'success' && otherTask.last_status !== 'success') {
        return {
          satisfied: false,
          skippedReason: `Dependencia previa no cumplida: la tarea "${dep.depends_on_task_name}" tiene estado "${otherTask.last_status}".`,
        };
      }
    }
  }

  return { satisfied: true };
}
