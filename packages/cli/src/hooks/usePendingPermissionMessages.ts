import { useContext } from 'react';
import {PendingPermissionMessagesContext} from '../context/pendingPermissionMessages'

export default function usePendingPermissionMessages(){
    const pendingPermissionMessagesObject = useContext(PendingPermissionMessagesContext);
    return pendingPermissionMessagesObject;
}