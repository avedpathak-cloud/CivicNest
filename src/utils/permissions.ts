import type { UserAccount } from '../types/society';

export function isSecretary(user: UserAccount): boolean {
  return user.role === 'secretary';
}

export function canManageTickets(user: UserAccount): boolean {
  return (
    user.role === 'secretary' ||
    Boolean(user.permissions?.canManageTickets) ||
    user.role === 'facility_manager' ||
    user.role === 'treasurer'
  );
}

export function canManageBilling(user: UserAccount): boolean {
  return (
    user.role === 'secretary' ||
    Boolean(user.permissions?.canManageBilling) ||
    user.role === 'treasurer'
  );
}

export function canModeratePosts(user: UserAccount): boolean {
  return user.role === 'secretary' || Boolean(user.permissions?.canModeratePosts);
}

export function canCreatePosts(user: UserAccount): boolean {
  return user.role === 'secretary' || Boolean(user.permissions?.canCreatePosts);
}

export function isSocietyManagement(user: UserAccount): boolean {
  return isSecretary(user) || canManageTickets(user) || canManageBilling(user);
}
