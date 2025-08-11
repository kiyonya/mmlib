import { ChildProcess } from "child_process";
import EventEmitter from "events";

export default class ClientProcessMonitor extends EventEmitter{
    /**
     * @param {ChildProcess} childProcess 
     * @param {*} param1 
     */
    constructor(childProcess,{}) {
        super()

        this.childProcess = childProcess
    }
    listenStd(){
        this.childProcess.on('close',this.handleProcessClose.bind(this))
    }

    handleProcessClose(){

    }
    
}