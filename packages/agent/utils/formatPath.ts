// /user/folder/file -> user-folder-file
export default function formatPath(path:string):string{
    let result = '';
    for(let i = 0 ; i<path.length ; i++){
        if(i===0 && path.at(i) === '/'){
            continue;
        }
        else if(path.at(i) === '/'){
            result += '-';
        }
        else{
            result += path.at(i);
        }
    }
    return result;
}