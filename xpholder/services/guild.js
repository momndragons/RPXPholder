const { listOfObjsToObj } = require("../utils")
const { LEVELS } = require("../config.json")

class guildService {
    constructor(database) {
        this.database = database;

        this.xpCache = {};
        this.registered = false;
        this.last_touched = Date.now();
    }

    /*
    -------------
    INITALIZATION
    -------------
    */
    async init() {
        if (!await this.isRegistered()) { return }
        this.config = await this.loadInit("config", "name", "value");
        this.levels = await this.loadInit("levels", "level", "xp_to_next");
        this.roles = await this.loadInit("roles", "role_id", "xp_bonus");
        this.channels = await this.loadInit("channels", "channel_id", "xp_per_post");
    }

    async loadInit(table, primaryKey, value) {
        const allowedTables = ["config", "levels", "roles", "channels"];
        if (!allowedTables.includes(table)) { return {}; }

        await this.database.openDatabase();
        let sqlTable = await this.database.getAll(`SELECT * FROM ${table};`)
        await this.database.closeDatabase();

        if (!sqlTable) { return {}; }
        return listOfObjsToObj(sqlTable, primaryKey, value);
    }

    /*
    ---------
    VALIDATOR
    ---------
    */
    isMod(listOfRoles) {
        return listOfRoles.includes(this.config["moderationRoleId"]);
    }

    async isRegistered() {
        await this.database.openDatabase();
        const config = await this.database.getAll("SELECT * FROM config;");
        this.registered = config ? true : false;
        await this.database.closeDatabase();
        return this.registered;
    }

    /*
    ---------
    CHARACTER
    ---------
    */
    async deleteCharacter(character) {
        await this.database.openDatabase();
        const response = await this.database.execute(
            "DELETE FROM characters WHERE character_id = ?;",
            [character["character_id"]]
        );
        await this.database.closeDatabase();
        return response;
    }

    async getAllCharacters(playerId) {
        await this.database.openDatabase();
        const response = await this.database.getAll(
            "SELECT * FROM characters WHERE player_id = ?;",
            [playerId]
        );
        await this.database.closeDatabase();
        return response;
    }

    async getAllGuildCharacters(){
        await this.database.openDatabase();
        const response = await this.database.getAll("SELECT * FROM characters;");
        await this.database.closeDatabase();
        return response;
    }

    async getCharacter(characterId) {
        await this.database.openDatabase();
        const response = await this.database.get(
            "SELECT * FROM characters WHERE character_id = ?;",
            [characterId]
        )
        await this.database.closeDatabase();
        return response;
    }

    async insertCharacter(character) {
        await this.database.openDatabase();
        const response = await this.database.execute(
            "INSERT INTO characters (character_id, character_index, name, sheet_url, picture_url, player_id, xp) VALUES (?, ?, ?, ?, ?, ?, ?);",
            [
                character.character_id,
                Number(character.character_index),
                character.name,
                character.sheet_url,
                character.picture_url,
                character.player_id,
                Number(character.xp || 0)
            ]
        );
        await this.database.closeDatabase();
        return response;
    }

    async updateCharacterInfo(character) {
        await this.database.openDatabase();
        const response = await this.database.execute(
            "UPDATE characters SET name = ?, sheet_url = ?, picture_url = ? WHERE character_id = ?;",
            [
                character.name,
                character.sheet_url,
                character.picture_url,
                character.character_id
            ]
        )
        await this.database.closeDatabase();
        return response;

    }

    async updateCharacterXP(character, deltaXp) {
        await this.database.openDatabase();
        const response = await this.database.execute(
            "UPDATE characters SET xp = xp + ? WHERE character_id = ?;",
            [Number(deltaXp || 0), character.character_id]
        )
        await this.database.closeDatabase();
        return response;

    }

    async setCharacterXP(character) {
        await this.database.openDatabase();
        const response = await this.database.execute(
            "UPDATE characters SET xp = ? WHERE character_id = ?;",
            [Number(character.xp || 0), character.character_id]
        )
        await this.database.closeDatabase();
        return response;
    }

    /*
    ---------------
    UPDATING TABLES
    ---------------
    */
    async updateConfig(config) {
        await this.database.openDatabase();
        for (const [name, value] of Object.entries(config)) {
            await this.database.execute(
                "UPDATE config SET value = ? WHERE name = ?;",
                [value, name]
            );
        }
        await this.database.closeDatabase();

        this.config = await this.loadInit("config", "name", "value");
    }

    async updateChannel(channelId, xpPerPost) {
        await this.database.openDatabase();
        if (xpPerPost >= 0) {
            if (channelId in this.channels) {
                await this.database.execute(
                    "UPDATE channels SET xp_per_post = ? WHERE channel_id = ?;",
                    [Number(xpPerPost), channelId]
                );
            } else {
                await this.database.execute(
                    "INSERT INTO channels ( channel_id, xp_per_post ) VALUES (?, ?);",
                    [channelId, Number(xpPerPost)]
                );
            }
        } else {
            await this.database.execute(
                "DELETE FROM channels WHERE channel_id = ?;",
                [channelId]
            );
        }
        await this.database.closeDatabase();

        this.channels = await this.loadInit("channels", "channel_id", "xp_per_post");
    }

    async updateLevel(level, xpToNext) {
        await this.database.openDatabase();
        await this.database.execute(
            "UPDATE levels SET xp_to_next = ? WHERE level = ?;",
            [Number(xpToNext), Number(level)]
        );
        await this.database.closeDatabase();

        this.levels = await this.loadInit("levels", "level", "xp_to_next");
    }

    async updateRole(roleId, xpBonus) {
        await this.database.openDatabase();
        if (xpBonus >= 0) {
            if (roleId in this.roles) {
                await this.database.execute(
                    "UPDATE roles SET xp_bonus = ? WHERE role_id = ?;",
                    [Number(xpBonus), roleId]
                );
            } else {
                await this.database.execute(
                    "INSERT INTO roles ( role_id, xp_bonus ) VALUES (?, ?);",
                    [roleId, Number(xpBonus)]
                );
            }
        } else {
            await this.database.execute(
                "DELETE FROM roles WHERE role_id = ?;",
                [roleId]
            );
        }
        await this.database.closeDatabase();

        this.roles = await this.loadInit("roles", "role_id", "xp_bonus");
    }

    /*
    --------------------
    REGISTERING A SERVER
    --------------------
    */
    async registerServer(configDetails) {
        await this.createDatabases();

        await this.database.openDatabase();

        for (const [name, value] of Object.entries(configDetails)) {
            await this.database.execute(
                "INSERT OR REPLACE INTO config ( name, value ) VALUES (?, ?);",
                [name, value]
            );
        }

        for (const [level, xp_to_next] of Object.entries(LEVELS)) {
            await this.database.execute(
                "INSERT OR REPLACE INTO levels ( level, xp_to_next ) VALUES (?, ?);",
                [Number(level), Number(xp_to_next)]
            );
        }

        await this.database.execute(
            "INSERT OR REPLACE INTO roles ( role_id, xp_bonus ) VALUES (?, ?);",
            [configDetails["xpFreezeRoleId"], 0]
        );

        await this.database.closeDatabase();
    }

    /*
    ------------------------
    CREATING TABLE FUNCTIONS
    ------------------------
    */
    async createDatabases() {
        await this.createChannelsTable();
        await this.createCharactersTable();
        await this.createConfigTable();
        await this.createLevelsTable();
        await this.createRolesTable();
    }

    async createChannelsTable() {
        await this.database.openDatabase();
        const response = await this.database.execute("CREATE TABLE IF NOT EXISTS channels ( channel_id VARCHAR(100) PRIMARY KEY, xp_per_post NUMBER );");
        await this.database.closeDatabase();
        return response;
    }

    async createCharactersTable() {
        await this.database.openDatabase();
        const response = await this.database.execute("CREATE TABLE IF NOT EXISTS characters ( character_id STRING PRIMARY KEY , character_index NUMBER, name VARCHAR(100) , sheet_url VARCHAR(100) , picture_url VARCHAR(200) , player_id VARCHAR(100) , xp NUMBER  );");
        await this.database.closeDatabase();
        return response;
    }

    async createConfigTable() {
        await this.database.openDatabase();
        const response = await this.database.execute("CREATE TABLE IF NOT EXISTS config ( name VARCHAR(100) PRIMARY KEY, value VARCHAR(2000) );");
        await this.database.closeDatabase();
        return response;
    }

    async createLevelsTable() {
        await this.database.openDatabase();
        const response = await this.database.execute("CREATE TABLE IF NOT EXISTS levels ( level NUMBER PRIMARY KEY, xp_to_next NUMBER );");
        await this.database.closeDatabase();
        return response;
    }

    async createRolesTable() {
        await this.database.openDatabase();
        const response = await this.database.execute("CREATE TABLE IF NOT EXISTS roles ( role_id VARCHAR(100) PRIMARY KEY, xp_bonus NUMBER );");
        await this.database.closeDatabase();
        return response;
    }
}

module.exports = { guildService }