
import { spawn } from 'child_process';
import { promisify } from 'util';
import path from 'path'
export default class CommandExec {
    /**
     * 执行命令（字符串形式）
     * @param {string} command 完整命令字符串
     * @param {object} options 选项
     * @param {string} options.cwd 工作目录
     * @param {boolean} options.redirectOutput 是否重定向输出
     * @returns {Promise<{exitCode: number, output: string, error: string}>}
     */
    static async executeCommand(command, options = {}) {
        const { cwd, redirectOutput = true } = options;
        
        return new Promise((resolve, reject) => {
            const child = spawn(command, {
                shell: true,
                cwd: cwd,
                stdio: redirectOutput ? 'pipe' : 'inherit',
                maxBuffer: 10 * 1024 * 1024
            });

            let output = '';
            let error = '';

            if (redirectOutput) {
                child.stdout.on('data', (data) => {
                    output += data.toString();
                });

                child.stderr.on('data', (data) => {
                    error += data.toString();
                });
            }

            child.on('close', (code) => {
                resolve({
                    exitCode: code,
                    output: output.trim(),
                    error: error.trim()
                });
            });

            child.on('error', (err) => {
                reject(err);
            });
        });
    }

    /**
     * 执行命令（参数列表形式）
     * @param {string} executable 可执行文件路径
     * @param {string[]} args 参数列表
     * @param {object} options 选项
     * @param {string} options.cwd 工作目录
     * @param {boolean} options.redirectOutput 是否重定向输出
     * @returns {Promise<{exitCode: number, output: string, error: string}>}
     */
    static async executeArguments(executable, args, options = {}) {
        const { cwd, redirectOutput = true } = options;
        
        return new Promise((resolve, reject) => {
            const child = spawn(executable, args, {
                shell: false,
                cwd: cwd,
                stdio: redirectOutput ? 'pipe' : 'inherit'
            });

            let output = '';
            let error = '';

            if (redirectOutput) {
                child.stdout.on('data', (data) => {
                    output += data.toString();
                });

                child.stderr.on('data', (data) => {
                    error += data.toString();
                });
            }

            child.on('close', (code) => {
                resolve({
                    exitCode: code,
                    output: output.trim(),
                    error: error.trim()
                });
            });

            child.on('error', (err) => {
                reject(err);
            });
        });
    }
}