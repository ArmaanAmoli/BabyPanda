import { useContext } from 'react';
import {PendingPermissionMessagesContest} from '../context/pendingPermissionMessages'

export default function usePendingPermissionMessages(){
    const pendingPermissionMessagesObject = useContext(PendingPermissionMessagesContest);
    return pendingPermissionMessagesObject;
}