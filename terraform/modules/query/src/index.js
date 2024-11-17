const { prompt } = require('/opt/nodejs/node20/openAI');
const { executeCypherQuery } = require('/opt/nodejs/node20/neo4j.js'); // Neo4j utility for query execution
const { fetchFromDdb } = require('/opt/nodejs/node20/ddb'); // DynamoDB utility for fetching app config

const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "OPTIONS,POST,GET",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Credentials": 'true',
    'Content-Type': 'application/json'
};

const NEO4J_URI = process.env.NEO4J_URI;
const NEO4J_USER = process.env.NEO4J_USER;
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD;
const OPEN_AI_API_KEY = process.env.OPEN_AI_API_KEY;
const KG_APP_CONFIG_TABLE_NAME = process.env.KG_APP_CONFIG_TABLE_NAME;

exports.handler = async (event) => {
    try {
        console.log("Event: ", JSON.stringify(event, null, 2));

        // Parse input
        const { content, user_id, app_id } = JSON.parse(event.body || {});

        // Step 1: Fetch app configuration from DynamoDB
        const appConfig = await fetchFromDdb({TableName: KG_APP_CONFIG_TABLE_NAME, Key: {id: app_id} });
        if (!appConfig) {
            throw new Error(`No configuration found for app_id: ${app_id}`);
        }

        const { entities_allowed, relations_allowed, relation_rules } = appConfig;

        if (!Array.isArray(entities_allowed) || !Array.isArray(relations_allowed) || !relation_rules) {
            throw new Error(`Invalid configuration for app_id: ${app_id}`);
            
        }

        // Step 2: Filter out entities, relations and rules for the query
        const q2 = `
You are an expert in knowledge graph query generation and data filtering. Your task is to process the input JSON and filter the entities, relationships, and rules relevant to the user's query. 

### Instructions:

1. **Input JSON Structure**:
   {
     "content": "${content}",
     "entities_allowed": ${JSON.stringify(entities_allowed)},
     "relations_allowed": ${JSON.stringify(relations_allowed)},
     "relation_rules": ${JSON.stringify(relation_rules)}
   }

2. **Goal**:
   - Filter and return only the entities, relationships, and rules that are most closely related to the user's query (\`content\`).
   - For example, if the query is: "What are the prices available?" 
     - Include only entities and relationships related to pricing.
     - Filter out unrelated entities (e.g., testimonials, features) and their corresponding rules.

3. **Output JSON Structure**: outpu shuold not contain prefix json literal, it shuld be only json format
   {
     "filtered_entities": ["RelevantEntity1", "RelevantEntity2"],
     "filtered_relations": ["RelevantRelation1", "RelevantRelation2"],
     "filtered_rules": {
       "Relation1": {
         "from": "Entity1",
         "to": "Entity2"
       },
       "Relation2": {
         "from": "Entity3",
         "to": "Entity4"
       }
     }
   }

4. **Guidelines for Filtering**:
   - Identify the user's intent by analyzing the query (\`content\`).
   - Select only the entities and relationships directly related to the intent.
   - Filter out unrelated entities, relationships, and rules.
   - Ensure the output contains the minimal but sufficient set of entities, relations, and rules to answer the query.

5. **Example Input**:
   Query: "What are the prices available?"
   Entities Allowed: ["Pricing", "Product", "TargetAudience", "Review"]
   Relations Allowed: ["HAS_PRICING", "TARGETS", "HAS_REVIEW"]
   Rules: {
     "HAS_PRICING": { "from": "Product", "to": "Pricing" },
     "TARGETS": { "from": "Pricing", "to": "TargetAudience" },
     "HAS_REVIEW": { "from": "Product", "to": "Review" }
   }

6. **Example Output**:
   {
     "filtered_entities": ["Pricing"],
     "filtered_relations": ["HAS_PRICING"],
     "filtered_rules": {
       "HAS_PRICING": { "from": "Product", "to": "Pricing" }
     }
   }

Process the input, analyze the query, and generate the filtered output as per the structure above.
`;

const { filtered_entities, filtered_relations, filtered_rules } = await prompt({
  q: q2,
  OPEN_AI_API_KEY,
  isJSON: true,
  max_tokens: 1000
});
console.log(`filtered entities , ${JSON.stringify(filtered_entities)}`);
console.log(`filtered_relations , ${JSON.stringify(filtered_relations)}`);
console.log(`filtered_rules , ${JSON.stringify(filtered_rules)}`);

        // Step 3: Generate Cypher command using OpenAI
        const q3 = `
You are an expert in data extraction and Cypher query generation for Neo4j knowledge graphs.
Your task is to process the JSON input and generate a MATCH Cypher query to retrieve nodes and relationships from the knowledge graph, adhering to the following instructions:

1. Input JSON Structure:
   {
     "content": ${JSON.stringify(content)},
     "user_id": ${user_id},
     "app_id": ${app_id},
     "include_nodes": ${JSON.stringify(filtered_entities)},
     "relations": ${JSON.stringify(filtered_relations)}
   }

2. Use the rules from the relation_rules field to determine the valid relationships between nodes:
   ${JSON.stringify(filtered_rules)}

3. Query Structure:
   - Use MATCH to retrieve nodes and relationships.
   - Ensure that all retrieved entities are directly or indirectly OWNED_BY the user_id.
   - Example:
     MATCH (entity)-[:OWNED_BY]->(user:User {id: $user_id})
     WHERE entity:EntityType
     RETURN entity

4. Structured and Parameterized Queries:
   - Ensure the Cypher query includes placeholders for user_id and app_id.
   - Example:
     MATCH (user:User {id: $user_id})
     MATCH (user)-[:OWNED_BY]->(entity:EntityType)
     RETURN entity

5. Include Valid Query Structure:
   - Ensure MATCH statements are used to traverse the graph.
   - Return data in JSON format for further NLP processing.
   - Avoid standalone MATCH statements; always return data.

6. generate cypher query
   - use only node entities and relations that are only required for the generating answer from KG
   - use minimal entities, relation, max 5 to 6 so that query may result in optimum answer.
   - use wild card * wherever possible
   - rules for relation should be followed 
   - cypher shuold be a single match statement do not concatenate mutliple match statement, it will result in empty results when hit on database
   - generated cypher query should be single match statement in a single line without new line
   - generated cypher query shouldnhave only one MATCH, only one WHERE command, other conditions shuld be liek this pattern. do not add any relation rules in the cpher query
    MATCH (entity)-[:OWNED_BY]->(user:User {id: "user123"})
  WHERE any(label IN ["Feature", "Pricing", "Product"] WHERE label IN labels(entity))
  RETURN entity

6. Output Format: do not prefix json liter in output, only json format in output
   {
     "cypher": "Generated Cypher query as a string"
   }

Process the input and generate the MATCH Cypher query as per the instructions.
`;

        const { cypher } = await prompt({
            q: q3,
            OPEN_AI_API_KEY,
            isJSON: true,
            max_tokens: 1000
        });

        if (!cypher || typeof cypher !== 'string') {
            throw new Error('Failed to generate Cypher query from OpenAI.');
        }

        // Step 4: Execute Cypher query in Neo4j
        const results = await executeCypherQuery(cypher, { user_id, app_id }, {
            uri: NEO4J_URI,
            user: NEO4J_USER,
            password: NEO4J_PASSWORD
        });

        if (!results || results.length === 0) {
            return {
                statusCode: 404,
                body: JSON.stringify({ message: "No relevant data found in KG." }),
                headers
            };
        }

        console.log(`Cypher query result: ${JSON.stringify(results)}`);

        // Step 5: Validate the results before NLP processing
        if (!results || results.length === 0) {
            throw new Error("No data retrieved from the KG to generate a response.");
        }

        // Step 6: Perform RAG (Retrieve-Answer-Generate) using OpenAI
        const ragPrompt = `
        You are an expert in answering queries based on retrieved knowledge graph data.
        Based on the user's query and retrieved data, generate a concise and accurate answer:

        1. User Query: "${content}"
        2. Retrieved Data: ${JSON.stringify(results)}
        3. App is not Knowledge graph, App is related to retrieved data

        Output Format:
        {
          "answer": "Generated answer using provided data"
        }

        Ensure the answer only uses the provided retrieved data. Do not infer or fabricate information.
        `;

        const { answer } = await prompt({
            q: ragPrompt,
            OPEN_AI_API_KEY,
            isJSON: true,
            max_tokens: 1500
        });

        if (!answer) {
            throw new Error('Failed to generate an answer from OpenAI.');
        }

        // Step 6: Return the answer in the response
        return {
            statusCode: 200,
            body: JSON.stringify({ answer }),
            headers
        };

    } catch (err) {
        console.error("Error:", err);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Internal server error", details: err.message }),
            headers
        };
    }
};