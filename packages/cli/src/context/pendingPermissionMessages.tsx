import React from 'react';
import { useState, createContext } from 'react';
import type { UserPermission } from '@baby-panda/types'
import type {ReactChildPropInterface} from '../types'
interface PendingPermissionMessagesObject {
    pendingPermissionMessages: UserPermission[],
    setPendingPermissionMessages: React.Dispatch<React.SetStateAction<UserPermission[]>>
}

export const PendingPermissionMessagesContext = createContext<PendingPermissionMessagesObject | null>(null);

export function PendingPermissionMessagesProvider({children}: ReactChildPropInterface) {
    const [pendingPermissionMessages, setPendingPermissionMessages] = useState<UserPermission[]>([]);
    return (
        <PendingPermissionMessagesContext.Provider value={{ pendingPermissionMessages, setPendingPermissionMessages }}>
            {children}
        </PendingPermissionMessagesContext.Provider>
    );
}
