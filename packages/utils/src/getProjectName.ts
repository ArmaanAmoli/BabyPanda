export default function getProjectName(){
    const projectName = process.cwd().replaceAll('/', '-').replace('-', '');
    return projectName;
}