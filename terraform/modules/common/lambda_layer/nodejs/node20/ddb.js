// ddb.js
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, BatchWriteCommand, ScanCommand  } = require("@aws-sdk/lib-dynamodb");

const ddbClient = new DynamoDBClient({ region: "ap-south-1" });
const docClient = DynamoDBDocumentClient.from(ddbClient);

async function fetchFromDdb({ TableName, Key }) {
    const params = {
        TableName,
        Key,
    };

    try {
        const data = await docClient.send(new GetCommand(params));
        console.log("Success:", data.Item);
        return data.Item;
    } catch (err) {
        console.error("Error:", err);
        return null;
    }
}

async function fetchAllFromDdb({ TableName }) {
    const params = {
        TableName,
    };

    try {
        const data = await docClient.send(new ScanCommand(params));
        console.log("Success:", data.Items);
        return data.Items;
    } catch (err) {
        console.error("Error:", err);
        return null;
    }
}


async function putItem({ TableName, Item }) {
    const params = {
        TableName,
        Item,
    };

    try {
        await docClient.send(new PutCommand(params));
        console.log("Item inserted successfully.");
    } catch (err) {
        console.error("Error inserting item:", err);
    }
}

async function batchPutItems({ TableName, Items }) {
    const MAX_BATCH_SIZE = 25;  // DynamoDB batch operations are limited to 25 items at a time

    // Split the items into batches of 25 (or fewer)
    const batches = [];
    for (let i = 0; i < Items.length; i += MAX_BATCH_SIZE) {
        batches.push(Items.slice(i, i + MAX_BATCH_SIZE));
    }

    console.log(`batches : ${JSON.stringify(batches)}`);
    // Process each batch
    for (const batch of batches) {
        const params = {
            RequestItems: {
                [TableName]: batch.map(item => ({
                    PutRequest: {
                        Item: item,
                    },
                })),
            },
        };

        try {
            await docClient.send(new BatchWriteCommand(params));
            console.log(`Batch of ${batch.length} items inserted successfully.`);
        } catch (err) {
            console.error("Error inserting batch:", err);
        }
    }
}

async function queryDdb({ TableName, IndexName, KeyConditionExpression, ExpressionAttributeValues }) {
    const params = {
      TableName,
      IndexName,
      KeyConditionExpression,
      ExpressionAttributeValues,
    };
  
    try {
      const data = await docClient.send(new QueryCommand(params));
      console.log("Query Success:", data.Items);
      return data.Items; // Return the items fetched based on the condition
    } catch (err) {
      console.error("Error fetching data: ", err);
      throw new Error("Could not fetch data for the given conditions");
    }
  }

module.exports = {
    fetchFromDdb,
    fetchAllFromDdb,
    putItem,
    batchPutItems,
    queryDdb
};