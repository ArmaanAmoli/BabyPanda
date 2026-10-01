import {useContext} from 'react';
import {SessionContext} from '../context/sessionContext';

export default function useSession(){
    const sessionContext = useContext(SessionContext)
    if(!sessionContext){
        return;
    }
    return sessionContext;
}