import type { UserId } from './ids';
import type { Timestamp, Audited } from './common';

/**
 * Roles are declared now, before workflows exist, so Approver is available
 * when approval workflows are built rather than being retrofitted later.
 */
export const ROLES = ['viewer', 'editor', 'approver', 'administrator'] as const;
export type Role = (typeof ROLES)[number];

export type Permission =
  | 'spec.read'
  | 'spec.create'
  | 'spec.update'
  | 'spec.archive'
  | 'spec.delete'
  | 'spec.publish'
  | 'spec.approve'
  | 'taxonomy.manage'
  | 'user.manage'
  | 'settings.manage';

export const ROLE_PERMISSIONS: Readonly<Record<Role, readonly Permission[]>> = {
  viewer: ['spec.read'],
  editor: ['spec.read', 'spec.create', 'spec.update', 'spec.archive'],
  approver: ['spec.read', 'spec.create', 'spec.update', 'spec.archive', 'spec.approve', 'spec.publish'],
  administrator: [
    'spec.read', 'spec.create', 'spec.update', 'spec.archive', 'spec.delete',
    'spec.publish', 'spec.approve', 'taxonomy.manage', 'user.manage', 'settings.manage',
  ],
};

export const can = (role: Role, permission: Permission): boolean =>
  ROLE_PERMISSIONS[role].includes(permission);

export interface User extends Audited {
  readonly id: UserId;
  readonly name: string;
  readonly email: string;
  readonly role: Role;
  readonly lastActiveAt: Timestamp | null;
  readonly invitedAt: Timestamp | null;
  readonly acceptedAt: Timestamp | null;
}

export const emptyUser = (id: UserId): User => ({
  id, name: '', email: '', role: 'viewer',
  lastActiveAt: null, invitedAt: null, acceptedAt: null,
  createdAt: null, createdBy: null, updatedAt: null, updatedBy: null,
});
