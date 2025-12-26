'use strict';

const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

const dbFiles = [
    'cadsus.sqlite',
    'contatos.db',
    'credilink.db',
    'dbcpfsimples.db',
    'fotorj.db',
    'scores.db',
    'telefoneclaro.db',
    'telefoneclaro.db',
    'telefonetim.db',
    'veiculos.db'
];

const results = [];
let done = 0;

function processDb(file) {
    const db = new sqlite3.Database(file, sqlite3.OPEN_READONLY, err => {
        if (err) {
            done++;
            return;
        }
    });

    db.get(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' LIMIT 1",
        (err, table) => {
            if (err || !table) {
                db.close();
                done++;
                finish();
                return;
            }

            db.get(
                `SELECT * FROM ${table.name} LIMIT 1`,
                (err, row) => {
                    if (!err && row) {
                        results.push({
                            database: file,
                            table: table.name,
                            sample: row
                        });
                    }
                    db.close();
                    done++;
                    finish();
                }
            );
        }
    );
}

function finish() {
    if (done === dbFiles.length) {
        fs.writeFileSync('output.json', JSON.stringify(results, null, 2));
        console.log('✅ 1 linha por DB, sem travar, fim.');
    }
}

dbFiles.forEach(processDb);
