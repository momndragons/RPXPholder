const { EmbedBuilder } = require('discord.js');

const { XPHOLDER_COLOUR, XPHOLDER_ICON_URL, DEV_SERVER_URL, XPHOLDER_RETIRE_COLOUR, TESTING_SERVER_ID, LOGING_CHANNEL_ID, ERROR_CHANNEL_ID } = require("./config.json");

/*
------
AWARDS
------
*/
function awardCXPs(startingXp, cxp, levels) {
    for (; cxp > 0; cxp--) {
        startingXp += awardCXP(startingXp, levels)
    }
    return startingXp;
}

function awardCXP(xp, levels) {
    const levelInfo = getLevelInfo(levels, xp);

    if (parseInt(levelInfo["level"]) < 4) {
        return levelInfo["xpToNext"] / 4
    }
    return levelInfo["xpToNext"] / 8
}

/*
-------
MAPPERS
-------
*/
function mergeListOfObjects(listOfObjects){
    let myObject= {}
    for (const listObject of listOfObjects){
        for(const [myKey, myValue] of Object.entries(listObject)){
            myObject[myKey] = myValue
        }
    }
    return myObject;
}

function chunkArray(myArray, chunkSize) {
    let chukedArray = [];
    let index = 0;
    for (; index + chunkSize <= myArray.length; index += chunkSize) {
        chukedArray.push(myArray.slice(index, index + chunkSize));
    }
    if (myArray.length % chunkSize) { chukedArray.push(myArray.slice(index, myArray.length)); }
    return chukedArray;
}

function splitObjectToList(myObject) {
    let myArray = []
    for (const [myKey, myValue] of Object.entries(myObject)) {
        let subObject = {}
        subObject[myKey] = myValue;
        myArray.push(subObject);
    }
    return myArray;
}

function listOfObjsToObj(listOfObjs, key, value) {
    let masterObj = {}
    for (const myObj of listOfObjs) { masterObj[myObj[key]] = myObj[value]; }
    return masterObj;
}

/*
-------
GETTERS
-------
*/
function getActiveCharacterIndex(serverConfig, userRoles) {
    for (let characterId = 1; characterId <= serverConfig["characterCount"]; characterId++) {
        if (userRoles.includes(serverConfig[`character${characterId}RoleId`])) {
            return characterId;
        }
    }

    return 1;
}

function getLevelInfo(levelObj, xp) {
    for (const [lvl, xpToNext] of Object.entries(levelObj)) {
        xp -= xpToNext;
        if (xp < 0) {
            xp += xpToNext;
            return { "level": lvl, "levelXp": xp, "xpToNext": xpToNext }
        }
    }

    return { "level": "20", "levelXp": xp, "xpToNext": xp }
}

function getRoleMultiplier(roleBonus, collectionOfGuildRoles, listOfPlayerRoles) {
    let roleMultiplier = 1;
    switch (roleBonus) {
        case "highest":
            for (const roleId of listOfPlayerRoles) {
                if (!(roleId in collectionOfGuildRoles)) { continue; }
                if (collectionOfGuildRoles[roleId] > roleMultiplier) { roleMultiplier = collectionOfGuildRoles[roleId]; }
                else if (collectionOfGuildRoles[roleId] == 0) { roleMultiplier = 0; break; }
            }
            break;
        case "sum":
            for (const roleId of listOfPlayerRoles) {
                if (!(roleId in collectionOfGuildRoles)) { continue; }
                if (collectionOfGuildRoles[roleId] == 0) { roleMultiplier = 0; break; }
                roleMultiplier += collectionOfGuildRoles[roleId];
            }
            break;
    }
    return roleMultiplier;
}

function getTier(level) {
    if (level <= 4) { return { "tier": 1, "nextTier": 2 }; }
    else if (level <= 10) { return { "tier": 2, "nextTier": 3 }; }
    else if (level <= 16) { return { "tier": 3, "nextTier": 4 }; }
    return { "tier": 4, "nextTier": 4 };
}

function getXp(wordCount, roleBonus, channelXpPerPost, xpPerPostDivisor, xpPerPostFormula) {
    switch (xpPerPostFormula) {
        case "exponential":
            return (channelXpPerPost + wordCount / xpPerPostDivisor) * (1 + wordCount / xpPerPostDivisor) * roleBonus;
        case "flat":
            return channelXpPerPost * roleBonus;
        case "linear":
            return (channelXpPerPost + wordCount / xpPerPostDivisor) * roleBonus;
    }
    return 0;
}

/*
------------------------
BUILDING CHARACTER EMBED
------------------------
*/
function buildCharacterEmbed(guildService, player, characterObj) {
    const levelInfo = getLevelInfo(guildService.levels, characterObj["xp"]);

    const progress = getProgressionBar(levelInfo["levelXp"], levelInfo["xpToNext"]);
    let tierInfo = getTier(parseInt(levelInfo["level"]));

    const roleBonus = getRoleMultiplier(guildService.config["roleBonus"], guildService.roles, player._roles)

    let characterEmbed = new EmbedBuilder()
        .setTitle(characterObj["name"])
        .setThumbnail((characterObj["picture_url"] != "" && characterObj["picture_url"] !== "null")? characterObj["picture_url"] : XPHOLDER_ICON_URL )
        .setFields(
            { inline: true, name: "Level", value: `${levelInfo["level"]}` },
            { inline: true, name: "Role Boost", value: `${roleBonus}` },
            { inline: true, name: "Current Tier", value: `<@&${guildService.config[`tier${tierInfo["tier"]}RoleId`]}>` },

            { inline: true, name: "Total Character XP", value: `${Math.floor(characterObj["xp"])}` },
            { inline: true, name: "Current Level XP", value: `${Math.floor(levelInfo["levelXp"])}` },
            { inline: true, name: "Next Level XP", value: `${Math.floor(levelInfo["xpToNext"])}` },

            { inline: false, name: `Progress`, value: `${progress}` }
        )
        .setFooter({ text: `Dont Like What You See? Try /edit_character (${characterObj["character_index"]}/${guildService.config["characterCount"]})` })
        .setColor(XPHOLDER_COLOUR);

    if (characterObj["sheet_url"] != "") {
        characterEmbed.setURL(characterObj["sheet_url"]);
    }
    return characterEmbed;
}

function getProgressionBar(xp, xpToNext) {
    let progressMessage = "```|";
    const progress = xp / xpToNext;

    for (let i = 0; i < Math.round(progress * 15); i++) { progressMessage += "█"; }
    for (let i = 0; i < Math.round((1 - progress) * 15); i++) { progressMessage += "-"; }
    progressMessage += `| ${Math.round(progress * 100)}% Complete\`\`\``

    return progressMessage;
}

/*
-------
LOGGING
-------
*/
async function logCommand(interaction){
    const logEmbed = new EmbedBuilder()
        .setTitle("Command Was Used")
        .setFields(
            {inline: false, name: "Guild", value: `${interaction.guild.name}`},
            {inline: false, name: "Guild Id", value: `${interaction.guild.id}`},
            {inline: false, name: "Author", value: `${interaction.user.username}`},
            {inline: false, name: "Author Id", value: `${interaction.user.id}`},
            {inline: false, name: "Command", value: `${interaction.commandName}`},
            )
        .setTimestamp()
        .setColor(XPHOLDER_COLOUR)
        .setThumbnail(`${interaction.client.user.avatarURL()}`)

    for(const option of interaction.options.data){
        logEmbed.addFields(
            {inline: true, name: `${option["name"]}`, value: `${option["value"]}`},
        )
    }

    const testingServer = await interaction.client.guilds.fetch(TESTING_SERVER_ID);
    const loggingChannel = await testingServer.channels.fetch(LOGING_CHANNEL_ID);

    loggingChannel.send({
        embeds: [logEmbed]
    });
}

async function logError(interaction, error){
    const logErrorEmbed = new EmbedBuilder()
        .setTitle("An Error Has Occured")
        .setDescription(`${error}`)
        .setFields(
            {inline: false, name: "Guild", value: `${interaction.guild.name}`},
            {inline: false, name: "Guild Id", value: `${interaction.guild.id}`},
            {inline: false, name: "Author", value: `${interaction.user.username}`},
            {inline: false, name: "Author Id", value: `${interaction.user.id}`},
            {inline: false, name: "Command", value: `${interaction.commandName}`},
            )
        .setTimestamp()
        .setColor(XPHOLDER_RETIRE_COLOUR)
        .setThumbnail(`${interaction.client.user.avatarURL()}`)

    for(const option of interaction.options.data){
        logErrorEmbed.addFields(
            {inline: true, name: `${option["name"]}`, value: `${option["value"]}`},
        )
    }

    const testingServer = await interaction.client.guilds.fetch(TESTING_SERVER_ID);
    const loggingChannel = await testingServer.channels.fetch(ERROR_CHANNEL_ID);

    loggingChannel.send({
        embeds: [logErrorEmbed]
    });
}

/*
--------
SECURITY
--------
*/

function sqlInjectionCheck(myString) {
    if (typeof myString !== "string") {
        return false;
    }

    return /(?:--|\/\*|\*\/|\b(drop|delete|update|insert|alter|create)\b)/i.test(myString);
}

module.exports = {
    awardCXPs,
    getActiveCharacterIndex,
    getLevelInfo,
    getRoleMultiplier,
    getTier,
    getXp,
    buildCharacterEmbed,
    getProgressionBar,
    sqlInjectionCheck,
    splitObjectToList,
    chunkArray,
    mergeListOfObjects,
    logCommand,
    logError,
    listOfObjsToObj
}