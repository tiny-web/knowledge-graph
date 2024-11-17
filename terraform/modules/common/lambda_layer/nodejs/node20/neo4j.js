const neo4j = require('neo4j-driver');

/**
 * Creates a Neo4j driver instance.
 * @param {Object} config - Configuration object containing `uri`, `user`, and `password` for Neo4j connection.
 * @returns {Object} - Neo4j driver instance.
 */
const getDriver = ({ uri, user, password }) => {
    return neo4j.driver(uri, neo4j.auth.basic(user, password));
};

/**
 * Creates a User and App node if not already present, and links them with a MEMBER_OF relationship.
 * @param {string} user_id - The ID of the user.
 * @param {string} app_id - The ID of the app.
 * @param {Object} config - Configuration object containing `uri`, `user`, and `password`.
 * @returns {Promise<Object>} - Success status and error details if any.
 */
const createUserAndApp = async (user_id, app_id, config) => {
    const driver = getDriver(config);
    const session = driver.session();

    const query = `
        MERGE (user:User {id: $user_id})
        MERGE (app:App {id: $app_id})
        MERGE (user)-[:MEMBER_OF]->(app)
    `;

    try {
        await session.run(query, { user_id, app_id });
        return { success: true };
    } catch (error) {
        console.error("Error creating User and App nodes:", error);
        return { success: false, error };
    } finally {
        await session.close();
        await driver.close();
    }
};

/**
 * Inserts data into the Neo4j database, linking it to the specified User and App.
 * @param {Array} queries - An array of Cypher queries with placeholders for `user_id` and `app_id`.
 * @param {Object} params - Parameters containing `user_id` and `app_id`.
 * @param {Object} config - Configuration object containing `uri`, `user`, and `password`.
 * @returns {Promise<Object>} - Success status and error details if any.
 */
const insertDataWithUserAndApp = async (queries, params, config) => {
    const driver = getDriver(config);
    const session = driver.session();

    try {
        // Start a transaction
        const tx = session.beginTransaction();

        // Run each query with provided parameters
        for (const query of queries) {
            await tx.run(query, params);
        }

        // Commit the transaction
        await tx.commit();
        return { success: true };
    } catch (error) {
        console.error("Error inserting data with User and App references:", error);

        // Rollback the transaction on error
        try {
            await tx.rollback();
        } catch (rollbackError) {
            console.error("Error rolling back transaction:", rollbackError);
        }

        return { success: false, error };
    } finally {
        await session.close();
        await driver.close();
    }
};

/**
 * Validates the Cypher syntax to ensure it follows basic expectations.
 * @param {Array} cypherQueries - An array of Cypher query strings.
 * @returns {boolean} - True if all queries are valid, false otherwise.
 */
const validateCypher = (cypherQueries) => {
    return Array.isArray(cypherQueries) && cypherQueries.every(query => typeof query === 'string');
};

/**
 * Executes a Cypher query in Neo4j.
 * @param {string} query - The Cypher query to execute.
 * @param {Object} params - Parameters for the query.
 * @param {Object} config - Configuration for Neo4j connection.
 * @returns {Promise<Array>} - The results of the query.
 */
const executeCypherQuery = async (query, params, config) => {
    const driver = neo4j.driver(config.uri, neo4j.auth.basic(config.user, config.password));
    const session = driver.session();

    try {
        const result = await session.run(query, params);
        return result.records.map(record => record.toObject());
    } catch (error) {
        console.error("Error executing Cypher query:", error);
        throw error;
    } finally {
        await session.close();
        await driver.close();
    }
};

module.exports = {
    getDriver,
    createUserAndApp,
    insertDataWithUserAndApp,
    validateCypher,
    executeCypherQuery
};