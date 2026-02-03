// task-dsl.js
// Central Task DSL contract used by teacher export and config loading.
(function () {
    /**
     * @readonly
     * @enum {string}
     */
    const TASK_TYPES = Object.freeze({
        MOVE: "move",
        RENAME: "rename",
        DELETE: "delete",
        PERMANENTLY_DELETE: "permanently-delete",
        CREATE: "create",
        RESTORE: "restore",
        COPY: "copy",
        ZIP_CREATE: "zip-create",
        ZIP_EXTRACT: "zip-extract",
    });

    const REQUIRED_FIELDS_BY_TYPE = Object.freeze({
        [TASK_TYPES.MOVE]: ["subjectId", "fromPath", "toPath"],
        [TASK_TYPES.RENAME]: ["subjectId", "fromName", "toName"],
        [TASK_TYPES.DELETE]: ["subjectId", "fromPath"],
        [TASK_TYPES.PERMANENTLY_DELETE]: ["subjectId", "fromPath"],
        [TASK_TYPES.CREATE]: ["subjectId", "toPath"],
        [TASK_TYPES.RESTORE]: ["subjectId", "toPath"],
        [TASK_TYPES.COPY]: ["subjectId", "fromPath", "toPath"],
        [TASK_TYPES.ZIP_CREATE]: ["inputIds", "outputName", "outputPath"],
        [TASK_TYPES.ZIP_EXTRACT]: ["archiveId", "destPath"],
    });

    /**
     * @typedef {Object} BaseTask
     * @property {string} type
     * @property {boolean=} strict
     */

    /**
     * @typedef {BaseTask & {
     *  type: "move",
     *  subjectId: string,
     *  fromPath: string,
     *  toPath: string
     * }} MoveTask
     */

    /**
     * @typedef {BaseTask & {
     *  type: "rename",
     *  subjectId: string,
     *  fromName: string,
     *  toName: string
     * }} RenameTask
     */

    /**
     * @typedef {BaseTask & {
     *  type: "delete",
     *  subjectId: string,
     *  fromPath: string
     * }} DeleteTask
     */

    /**
     * @typedef {BaseTask & {
     *  type: "permanently-delete",
     *  subjectId: string,
     *  fromPath: string
     * }} PermanentlyDeleteTask
     */

    /**
     * @typedef {BaseTask & {
     *  type: "create",
     *  subjectId: string,
     *  toPath: string
     * }} CreateTask
     */

    /**
     * @typedef {BaseTask & {
     *  type: "restore",
     *  subjectId: string,
     *  toPath: string
     * }} RestoreTask
     */

    /**
     * @typedef {BaseTask & {
     *  type: "copy",
     *  subjectId: string,
     *  fromPath: string,
     *  toPath: string
     * }} CopyTask
     */

    /**
     * @typedef {BaseTask & {
     *  type: "zip-create",
     *  inputIds: string[],
     *  outputName: string,
     *  outputPath: string
     * }} ZipCreateTask
     */

    /**
     * @typedef {BaseTask & {
     *  type: "zip-extract",
     *  archiveId: string,
     *  destPath: string
     * }} ZipExtractTask
     */

    /**
     * @typedef {MoveTask|RenameTask|DeleteTask|PermanentlyDeleteTask|CreateTask|RestoreTask|CopyTask|ZipCreateTask|ZipExtractTask} Task
     */

    function hasValue(task, fieldName) {
        if (!Object.prototype.hasOwnProperty.call(task, fieldName)) {
            return false;
        }

        const value = task[fieldName];
        if (Array.isArray(value)) return true;
        if (typeof value === "string") return value.trim() !== "";
        return value !== null && value !== undefined;
    }

    /**
     * Normalize unknown/missing tasks to a stable array contract.
     * @param {unknown} tasks
     * @returns {Task[]}
     */
    function normalizeTasks(tasks) {
        return Array.isArray(tasks) ? tasks : [];
    }

    /**
     * Validate Task DSL payload.
     * - Unknown type -> error
     * - Missing required fields -> error
     * @param {unknown} tasks
     * @returns {{ valid: boolean, errors: string[] }}
     */
    function validateTasks(tasks) {
        if (tasks === undefined || tasks === null) {
            return { valid: true, errors: [] };
        }

        if (!Array.isArray(tasks)) {
            return { valid: false, errors: ["tasks must be an array"] };
        }

        const errors = [];

        tasks.forEach((task, index) => {
            const at = `tasks[${index}]`;

            if (!task || typeof task !== "object" || Array.isArray(task)) {
                errors.push(`${at} must be an object`);
                return;
            }

            const type = task.type;
            if (typeof type !== "string" || type.trim() === "") {
                errors.push(`${at}.type is required`);
                return;
            }

            const requiredFields = REQUIRED_FIELDS_BY_TYPE[type];
            if (!requiredFields) {
                errors.push(`${at}.type "${type}" is unknown`);
                return;
            }

            requiredFields.forEach((fieldName) => {
                if (!hasValue(task, fieldName)) {
                    errors.push(`${at}.${fieldName} is required for type "${type}"`);
                }
            });

            if (
                Object.prototype.hasOwnProperty.call(task, "strict") &&
                typeof task.strict !== "boolean"
            ) {
                errors.push(`${at}.strict must be boolean when provided`);
            }
        });

        return { valid: errors.length === 0, errors };
    }

    window.TaskDSL = Object.freeze({
        TASK_TYPES,
        REQUIRED_FIELDS_BY_TYPE,
        normalizeTasks,
        validateTasks,
    });
})();
