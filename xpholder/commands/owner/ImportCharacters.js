const { SlashCommandBuilder } = require('@discordjs/builders');
const { sqlInjectionCheck } = require('../../utils');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

module.exports = {
    data: new SlashCommandBuilder()
        .setName('import_characters_csv')
        .setDescription('CSV Loads Characters')
    
        .addAttachmentOption(option => option
            .setName("csv_file")
            .setDescription("File Created From /export_characters_csv [ OWNER ]")
            .setRequired(true))

        .addBooleanOption(option => option
            .setName("public")
            .setDescription("Show This Command To Everyone?")
            .setRequired(false))
    ,
    async execute(guildService, interaction) {
        /*
        ----------
        VALIDATION
        ----------
        */
        if (interaction.user.id != interaction.guild.ownerId) {
            await interaction.editReply("Sorry, but you are not the owner of the server, and can not use this command.")
            return;
        }

        /*
        --------------
        INITIALIZATION
        --------------
        */
        const csvFile = interaction.options.getAttachment("csv_file");
        const response = await fetch(csvFile.url);

        const csvContent = await response.text();
        const csvRows = csvContent
            .replace(/\r/g, "")
            .split("\n")
            .filter(row => row.trim() !== "");

        const csvHeaders = csvRows[0].split(",").map(header => header.trim());

        /*
        --------------
        IMPORTING DATA
        --------------
        */
        let importedCount = 0;

        for (const csvRow of csvRows.slice(1)) {
            const csvRowValues = csvRow.split(",");
            let csvData = {};

            for (const rowValueIndex in csvRowValues) {
                const header = csvHeaders[rowValueIndex];
                const value = csvRowValues[rowValueIndex];

                if (
                    sqlInjectionCheck(header) ||
                    sqlInjectionCheck(value)
                ) {
                    await interaction.editReply(`Malicious Data Found : ${header} - ${value}\nEnding Process`);
                    return;
                }

                csvData[header] = value;
            }

            /*
            --------------
            INIT CHARACTER
            --------------
            */
            const character = {
                "character_id": csvData["character_id"],
                "character_index": Number(csvData["character_index"]),
                "name": csvData["name"],
                "sheet_url": csvData["sheet_url"],
                "picture_url": csvData["picture_url"],
                "player_id": csvData["player_id"],
                "xp": Number(csvData["xp"] || 0)
            };

            if (!character.character_id || !character.player_id || !character.character_index) {
                continue;
            }

            let existingCharacter = await guildService.getCharacter(`${character["character_id"]}`);

            if (!existingCharacter) {
                await guildService.insertCharacter(character);
            } else {
                await guildService.updateCharacterInfo(character);
            }

            await guildService.setCharacterXP(character);
            importedCount++;
        }

        await interaction.editReply(`success - imported ${importedCount} characters`);
    },
};