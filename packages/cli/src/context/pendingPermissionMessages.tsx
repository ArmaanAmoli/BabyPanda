import React from 'react';
import {useState , createContext} from 'react';
import type {UserPermission} from '@baby-panda/types'

interface PendingPermissionMessagesObject{

    pendingPermissionMessages:UserPermission[],
    setPendingPermissionMessages:React.Dispatch<React.SetStateAction<UserPermission[]>>
}

export const PendingPermissionMessagesContest = createContext<PendingPermissionMessagesObject|null>(null);

export function PendingPermissionMessagesProvider(children:React.ReactElement){
    const [pendingPermissionMessages , setPendingPermissionMessages] = useState<UserPermission[]>([]);
    return(
    <PendingPermissionMessagesContest.Provider value={{pendingPermissionMessages , setPendingPermissionMessages}}>
        {children}
    </PendingPermissionMessagesContest.Provider>
    );
}
