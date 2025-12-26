// generate_schema.js
'use strict';

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbFileName = 'credilink.db';
const outputFileName = 'credilink_schema.json';

function generateDbSchema(dbFilePath) {
    console.log(`Analyzing database: ${dbFilePath}`);
    if (!fs.existsSync(dbFilePath)) {
        console.error(`Error: Database file not found at ${dbFilePath}`);
        return null;
    }

    try {
        const db = new Database(dbFilePath, { readonly: true });
        const schema = [];

        // Get all tables
        const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';`).all();

        console.log(`Found ${tables.length} tables.`);

        for (const table of tables) {
            const tableName = table.name;
            console.log(`  - Processing table: ${tableName}`);

            const tableInfo = {
                table: tableName,
                schema: [],
                sample: []
            };

            // Get table schema
            const columns = db.prepare(`PRAGMA table_info('${tableName}');`).all();
            for (const column of columns) {
                tableInfo.schema.push({
                    cid: column.cid,
                    name: column.name,
                    type: column.type,
                    notnull: column.notnull,
                    default_value: column.dflt_value,
                    pk: column.pk
                });
            }

            // Get sample data
            try {
                const sampleRows = db.prepare(`SELECT * FROM "${tableName}" LIMIT 5;`).all();
                tableInfo.sample = sampleRows;
            } catch (sampleError) {
                console.error(`    Could not get samples for ${tableName}: ${sampleError.message}`);
                tableInfo.sample = [{ error: `Could not retrieve samples: ${sampleError.message}` }];
            }

            schema.push(tableInfo);
        }

        db.close();
        return schema;

    } catch (error) {
        console.error(`Failed to analyze database: ${error.message}`);
        return null;
    }
}

const dbPath = path.join(__dirname, dbFileName);
const fullSchema = generateDbSchema(dbPath);

if (fullSchema) {
    const outputPath = path.join(__dirname, outputFileName);
    fs.writeFileSync(outputPath, JSON.stringify(fullSchema, null, 2));
    console.log(`Schema successfully generated and saved to ${outputPath}`);
} else {
    console.log(`Schema generation failed.`);
}
