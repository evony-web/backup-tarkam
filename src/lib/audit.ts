import { db } from '@/lib/db';

interface AuditLogInput {
  adminId?: string;
  adminName?: string;
  action: string;
  entity: string;
  entityId?: string;
  details?: string;
  metadata?: Record<string, unknown>;
}

interface PlayerAuditLogInput {
  playerId: string;
  playerName: string;
  action: string;
  entity: string;
  entityId?: string;
  details?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Create an audit log entry.
 * This is a fire-and-forget helper — errors are logged but don't throw.
 */
export async function createAuditLog(input: AuditLogInput): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        adminId: input.adminId,
        adminName: input.adminName,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId,
        details: input.details,
        metadata: input.metadata ? JSON.stringify(input.metadata) : undefined,
      },
    });
  } catch (error) {
    // Audit logging should never break the main operation
    console.error('[AUDIT_LOG_ERROR]', error);
  }
}

/**
 * Create an audit log entry for player actions.
 * Uses the same AuditLog table but stores playerId/playerName in the
 * adminId/adminName fields (with a "player:" prefix on adminId to distinguish),
 * since we cannot modify the database schema.
 *
 * Player actions tracked: register, login, donation, password_change
 */
export async function createPlayerAuditLog(input: PlayerAuditLogInput): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        adminId: `player:${input.playerId}`,
        adminName: input.playerName,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId,
        details: input.details,
        metadata: input.metadata ? JSON.stringify(input.metadata) : undefined,
      },
    });
  } catch (error) {
    // Audit logging should never break the main operation
    console.error('[PLAYER_AUDIT_LOG_ERROR]', error);
  }
}
