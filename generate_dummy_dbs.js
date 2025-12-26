const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbSpecs = [
  {
    name: 'cadsus.sqlite',
    tables: [
      {
        name: 'cadsus',
        schema: `
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          cpf TEXT UNIQUE,
          nome TEXT,
          mae TEXT,
          telefone TEXT,
          rgNumero TEXT,
          cep TEXT,
          logradouro TEXT
        `,
        data: [
          { cpf: '11122233344', nome: 'JOAO SILVA', mae: 'MARIA SILVA', telefone: '11987654321', rgNumero: '1234567', cep: '01000000' },
          { cpf: '55566677788', nome: 'ANA PEREIRA', mae: 'SOFIA PEREIRA', telefone: '21998765432', rgNumero: '7654321', cep: '20000000' },
        ],
      },
    ],
  },
  {
    name: 'contatos.db',
    tables: [
      {
        name: 'contatos',
        schema: `
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          cpf TEXT UNIQUE,
          nome TEXT,
          fone TEXT
        `,
        data: [
          { cpf: '11122233344', nome: 'JOAO SILVA', fone: '11987654321' },
          { cpf: '99988877766', nome: 'CARLOS GOMES', fone: '31912345678' },
        ],
      },
    ],
  },
  {
    name: 'credilink.db',
    tables: [
      {
        name: 'credilink',
        schema: `
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          CPF TEXT UNIQUE,
          NOME TEXT,
          NOME_MAE TEXT,
          CEP TEXT,
          RG TEXT
        `,
        data: [
          { CPF: '11122233344', NOME: 'JOAO SILVA', NOME_MAE: 'MARIA SILVA', CEP: '01000000', RG: '1234567' },
          { CPF: '44433322211', NOME: 'FERNANDA LIMA', NOME_MAE: 'PAULA LIMA', CEP: '30000000', RG: '7654321' },
        ],
      },
    ],
  },
  {
    name: 'dbcpfsimples.db',
    tables: [
      {
        name: 'dbcpfsimples',
        schema: `
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          cpf TEXT UNIQUE,
          nome_completo TEXT
        `,
        data: [
          { cpf: '11122233344', nome_completo: 'JOAO DA SILVA' },
          { cpf: '77788899900', nome_completo: 'BRUNA SOUZA' },
        ],
      },
    ],
  },
  {
    name: 'fotorj.db',
    tables: [
      {
        name: 'fotorj',
        schema: `
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          cpf TEXT UNIQUE,
          nome TEXT,
          data_nascimento TEXT,
          nome_mae TEXT,
          rg TEXT,
          foto_base64 TEXT
        `,
        data: [
          { cpf: '11122233344', nome: 'JOAO SILVA', data_nascimento: '01/01/1980', nome_mae: 'MARIA SILVA', rg: '1234567', foto_base64: 'base64_foto_joao' },
          { cpf: '66655544433', nome: 'GABRIEL COSTA', data_nascimento: '15/05/1990', nome_mae: 'PATRICIA COSTA', rg: '3456789', foto_base64: 'base64_foto_gabriel' },
        ],
      },
    ],
  },
  {
    name: 'scores.db',
    tables: [
      {
        name: 'scores',
        schema: `
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          cpf_consulta TEXT UNIQUE,
          score_risco_csb INTEGER
        `,
        data: [
          { cpf_consulta: '11122233344', score_risco_csb: 850 },
          { cpf_consulta: '22233344455', score_risco_csb: 600 },
        ],
      },
    ],
  },
  {
    name: 'telefoneclaro.db',
    tables: [
      {
        name: 'telefoneclaro',
        schema: `
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          cpf TEXT UNIQUE,
          nome TEXT,
          fone TEXT
        `,
        data: [
          { cpf: '11122233344', nome: 'JOAO SILVA', fone: '11987654321' },
          { cpf: '11223344556', nome: 'PEDRO ROCHA', fone: '11998877665' },
        ],
      },
    ],
  },
  {
    name: 'telefonetim.db',
    tables: [
      {
        name: 'telefonetim',
        schema: `
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          DOC TEXT UNIQUE,
          NOME TEXT,
          TEL TEXT
        `,
        data: [
          { DOC: '11122233344', NOME: 'JOAO SILVA', TEL: '11987654321' },
          { DOC: '33344455566', NOME: 'JULIA MENDES', TEL: '41912345678' },
        ],
      },
    ],
  },
  {
    name: 'veiculos.db',
    tables: [
      {
        name: 'veiculos',
        schema: `
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          chassi TEXT UNIQUE,
          placa TEXT,
          placa_modelo_antigo TEXT,
          placa_modelo_novo TEXT,
          marca_modelo TEXT
        `,
        data: [
          { chassi: 'ABC1234567890DEF1', placa: 'ABC1234', placa_modelo_antigo: 'ABC1234', placa_modelo_novo: 'ABC1C34', marca_modelo: 'FIAT/PALIO' },
          { chassi: 'DEF9876543210GHIJ', placa: 'XYZ5678', placa_modelo_antigo: 'XYZ5678', placa_modelo_novo: 'XYZ5J78', marca_modelo: 'VW/GOL' },
        ],
      },
    ],
  },
];

function createAndPopulateDb(dbSpec) {
  const dbPath = path.join(__dirname, '..', dbSpec.name);
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath); // Delete existing db to start fresh
  }
  const db = new Database(dbPath);

  dbSpec.tables.forEach(table => {
    db.exec(`CREATE TABLE IF NOT EXISTS ${table.name} (${table.schema});`);
    const columns = Object.keys(table.data[0]).join(', ');
    const placeholders = Object.keys(table.data[0]).map(() => '?').join(', ');
    const insert = db.prepare(`INSERT INTO ${table.name} (${columns}) VALUES (${placeholders});`);
    table.data.forEach(row => insert.run(Object.values(row)));
  });

  db.close();
  console.log(`Created and populated ${dbSpec.name}`);
}

dbSpecs.forEach(createAndPopulateDb);
console.log('All dummy databases generated.');
