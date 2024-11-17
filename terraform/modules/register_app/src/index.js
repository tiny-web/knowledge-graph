const { putItem } = require('/opt/nodejs/node20/ddb.js'); // DynamoDB utility
const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "OPTIONS,POST,GET",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Credentials": 'true',
    'Content-Type': 'application/json'
};

const KG_APP_CONFIG_TABLE_NAME = process.env.KG_APP_CONFIG_TABLE_NAME;

exports.handler = async (event) => {
    try {
        console.log("Event: ", JSON.stringify(event, null, 2));

        // Parse input
        const { id, app_name, description, entities_allowed, relations_allowed, relation_rules } = JSON.parse(event.body || {});

        // Validate required fields
        if (!id || !app_name || !description || !Array.isArray(entities_allowed) || !Array.isArray(relations_allowed) || !relation_rules) {
            return {
                statusCode: 400,
                body: JSON.stringify({ message: "Invalid input: Missing or malformed required fields." }),
                headers
            };
        }

        // Prepare item for insertion
        const item = {
            id,
            app_name,
            description,
            entities_allowed,
            relations_allowed,
            relation_rules,
            created_at: new Date().toISOString()
        };

        // Insert into DynamoDB
        console.log("Inserting item into DynamoDB:", JSON.stringify(item, null, 2));
        await putItem({ TableName: KG_APP_CONFIG_TABLE_NAME, Item: item});

        // Success response
        return {
            statusCode: 200,
            body: JSON.stringify({ id, message: "Inserted successfully" }),
            headers
        };

    } catch (error) {
        console.error("Error inserting into DynamoDB:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Internal server error", details: error.message }),
            headers
        };
    }
};