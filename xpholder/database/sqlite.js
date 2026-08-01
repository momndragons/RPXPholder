const Database = require("better-sqlite3");

class sqlLite3DatabaseService {
    constructor(databaseNameOrDatabase) {
        this.databaseName = typeof databaseNameOrDatabase === "string"
            ? databaseNameOrDatabase
            : null;

        this.database = typeof databaseNameOrDatabase === "string"
            ? null
            : databaseNameOrDatabase;

        this.ownsDatabase = typeof databaseNameOrDatabase === "string";
    }

    async openDatabase() {
        try {
            if (!this.database || !this.database.open) {
                this.database = new Database(this.databaseName, {
                    timeout: 5000
                });

                this.ownsDatabase = true;
            }

            this.database.pragma("journal_mode = WAL");
            this.database.pragma("foreign_keys = ON");

            return this;
        } catch (error) {
            console.error(error.message);
            return false;
        }
    }

    async closeDatabase() {
        try {
            if (this.ownsDatabase && this.database && this.database.open) {
                this.database.close();
            }

            return this;
        } catch (error) {
            console.error(error.message);
            return false;
        }
    }

    async execute(query, params = []) {
        try {
            this.database.prepare(query).run(...params);
            return true;
        } catch (error) {
            console.error(error.message);
            return false;
        }
    }

    async getAll(query, params = []) {
        try {
            return this.database.prepare(query).all(...params);
        } catch (error) {
            console.error(error.message);
            return false;
        }
    }

    async get(query, params = []) {
        try {
            return this.database.prepare(query).get(...params);
        } catch (error) {
            console.error(error.message);
            return false;
        }
    }
}

module.exports = { sqlLite3DatabaseService }