const fs = require('fs').promises;
const path = require('path');
const { parse } = require('csv-parse/sync');

class ReferenceService {
  constructor(logger) {
    this.logger = logger;
    this.isLoaded = false;
    this.cache = {};
  }

  async loadReferences() {
    if (this.isLoaded) {
      this.logger.info('Reference data already loaded.');
      return;
    }

    this.logger.info('Loading reference data into memory...');

    const referenceDir = path.resolve(__dirname, '..', '..', 'referencia');
    const files = await fs.readdir(referenceDir);

    const loaders = {
      'municipio.csv': (records) => this._createMap(records, 'id', record => ({ descricao: record.municipio, uf: record.uf })),
      'marca.csv': (records) => this._createMap(records, 'id', record => ({ descricao: record.marca })),
      'modelo.csv': (records) => this._createMap(records, 'id', record => ({ descricao: record.modelo, fk_marca: record.fk_marca, fk_segmento: record.fk_segmento, fk_sub_segmento: record.fk_sub_segmento, fk_grupo_modelo_veiculo: record.fk_grupo_modelo_veiculo })),
      'combustivel.csv': (records) => this._createMap(records, 'id', record => ({ descricao: record.combustivel })),
      'cor.csv': (records) => this._createMap(records, 'id', record => ({ descricao: record.cor })),
      'tipo_veiculo.csv': (records) => this._createMap(records, 'id', record => ({ descricao: record.tipo_veiculo })),
      'carroceria.csv': (records) => this._createMap(records, 'id', record => ({ descricao: record.carroceria })),
      'especie_veiculo.csv': (records) => this._createMap(records, 'id', record => ({ descricao: record.especie })),
      'grupo_modelo.csv': (records) => this._createMap(records, 'id', record => ({ descricao: record.grupo })),
      'nacionalidade.csv': (records) => this._createMap(records, 'id', record => ({ descricao: record.nacionalidade })),
      'regiao.csv': (records) => this._createMap(records, 'id', record => ({ descricao: record.regiao })),
      'restricoes.csv': (records) => this._createMap(records, 'id', record => ({ descricao: record.restricao })),
      'segmento_veiculo.csv': (records) => this._createMap(records, 'id', record => ({ descricao: record.segmento })),
      'sub_segmento_veiculo.csv': (records) => this._createMap(records, 'id', record => ({ descricao: record.sub_segmento, fk_segmento_veiculo: record.fk_segmento_veiculo })),
    };

    for (const file of files) {
      if (file.endsWith('.csv')) {
        const cacheKey = path.basename(file, '.csv');
        const loader = loaders[file];
        if (loader) {
          try {
            const filePath = path.join(referenceDir, file);
            const fileContent = await fs.readFile(filePath, 'utf-8');
            const records = parse(fileContent, {
              columns: true,
              delimiter: ';',
              skip_empty_lines: true,
            });
            this.cache[cacheKey] = loader(records);
            this.logger.info(`Loaded and cached ${records.length} records from ${file}.`);
          } catch (error) {
            this.logger.error(`Failed to load reference file ${file}:`, error);
          }
        }
      }
    }

    this.isLoaded = true;
    this.logger.info('Reference data loading complete.');
  }

  _createMap(records, keyColumn, valueFn) {
    const map = new Map();
    for (const record of records) {
      const key = record[keyColumn];
      if (key) {
        map.set(key, valueFn(record));
      }
    }
    return map;
  }

  getEnrichedData(type, id) {
    if (!this.isLoaded || !id || !this.cache[type]) {
      return { id };
    }

    const referenceData = this.cache[type].get(String(id));
    if (!referenceData) {
      return { id };
    }

    // Caso especial para marca_modelo
    if (type === 'modelo') {
      const enriched = {
        id,
        descricao: referenceData.descricao,
      };
      if (referenceData.fk_marca) {
        const marcaData = this.cache.marca.get(String(referenceData.fk_marca));
        if (marcaData) {
          enriched.marca = {
            id: referenceData.fk_marca,
            descricao: marcaData.descricao,
          };
        }
      }
      if (referenceData.fk_grupo_modelo_veiculo) {
        const grupoModeloData = this.cache.grupo_modelo.get(String(referenceData.fk_grupo_modelo_veiculo));
        if (grupoModeloData) {
            enriched.grupo_modelo = {
                id: referenceData.fk_grupo_modelo_veiculo,
                descricao: grupoModeloData.descricao
            };
        }
      }
      if (referenceData.fk_segmento) {
        const segmentoData = this.cache.segmento_veiculo.get(String(referenceData.fk_segmento));
        if (segmentoData) {
            enriched.segmento_veiculo = {
                id: referenceData.fk_segmento,
                descricao: segmentoData.descricao
            };
        }
      }
      if (referenceData.fk_sub_segmento) {
        const subSegmentoData = this.cache.sub_segmento_veiculo.get(String(referenceData.fk_sub_segmento));
        if (subSegmentoData) {
            enriched.sub_segmento_veiculo = {
                id: referenceData.fk_sub_segmento,
                descricao: subSegmentoData.descricao
            };
        }
      }
      return enriched;
    }

    // Caso especial para sub_segmento_veiculo
    if (type === 'sub_segmento_veiculo') {
        const enriched = {
            id,
            descricao: referenceData.descricao,
        };
        if (referenceData.fk_segmento_veiculo) {
            const segmentoData = this.cache.segmento_veiculo.get(String(referenceData.fk_segmento_veiculo));
            if (segmentoData) {
                enriched.segmento_veiculo = {
                    id: referenceData.fk_segmento_veiculo,
                    descricao: segmentoData.descricao,
                };
            }
        }
        return enriched;
    }

    return {
      id,
      ...referenceData,
    };
  }

  enrichVehicleData(vehicleData) {
    if (!this.isLoaded || !vehicleData) {
      return vehicleData;
    }
    
    const enriched = { ...vehicleData };

    if (enriched.municipio) {
      enriched.municipio = this.getEnrichedData('municipio', enriched.municipio);
    }
    if (enriched.marca_modelo) {
        enriched.marca_modelo = this.getEnrichedData('modelo', enriched.marca_modelo);
    }
    if (enriched.combustivel) {
      enriched.combustivel = this.getEnrichedData('combustivel', enriched.combustivel);
    }
    if (enriched.cor_veiculo) {
      // O nome do campo é 'cor_veiculo', mas o arquivo é 'cor.csv'
      enriched.cor_veiculo = this.getEnrichedData('cor', enriched.cor_veiculo);
    }
    if (enriched.tipo_veiculo) {
      enriched.tipo_veiculo = this.getEnrichedData('tipo_veiculo', enriched.tipo_veiculo);
    }
    // New fields enrichment
    if (enriched.carroceria) {
        enriched.carroceria = this.getEnrichedData('carroceria', enriched.carroceria);
    }
    if (enriched.especie_veiculo) {
        enriched.especie_veiculo = this.getEnrichedData('especie_veiculo', enriched.especie_veiculo);
    }
    if (enriched.nacionalidade) {
        enriched.nacionalidade = this.getEnrichedData('nacionalidade', enriched.nacionalidade);
    }
    // Assumindo que 'restricao_1' ou similar é o campo na base de dados
    if (enriched.restricao_1) { 
        enriched.restricao_1 = this.getEnrichedData('restricoes', enriched.restricao_1);
    }
    if (enriched.segmento_veiculo) { // if the raw data already contains 'segmento_veiculo' ID
        enriched.segmento_veiculo = this.getEnrichedData('segmento_veiculo', enriched.segmento_veiculo);
    } else if (enriched.marca_modelo && enriched.marca_modelo.segmento_veiculo) { // if 'segmento_veiculo' comes from 'modelo' enrichment
        enriched.segmento_veiculo = enriched.marca_modelo.segmento_veiculo;
    }
    if (enriched.sub_segmento_veiculo) { // if the raw data already contains 'sub_segmento_veiculo' ID
        enriched.sub_segmento_veiculo = this.getEnrichedData('sub_segmento_veiculo', enriched.sub_segmento_veiculo);
    } else if (enriched.marca_modelo && enriched.marca_modelo.sub_segmento_veiculo) { // if 'sub_segmento_veiculo' comes from 'modelo' enrichment
        enriched.sub_segmento_veiculo = enriched.marca_modelo.sub_segmento_veiculo;
    }
    if (enriched.grupo_modelo_veiculo) { // if the raw data already contains 'grupo_modelo_veiculo' ID
        enriched.grupo_modelo_veiculo = this.getEnrichedData('grupo_modelo', enriched.grupo_modelo_veiculo);
    } else if (enriched.marca_modelo && enriched.marca_modelo.grupo_modelo) { // if 'grupo_modelo_veiculo' comes from 'modelo' enrichment
        enriched.grupo_modelo_veiculo = enriched.marca_modelo.grupo_modelo;
    }
    
    // Add regiao based on municipio.uf if available
    if (enriched.municipio && enriched.municipio.uf) {
        // Find region by UF - this assumes a mapping from UF to region.
        // For simplicity, I'm assuming 'regiao.csv' contains 'uf' or a way to map.
        // If 'regiao.csv' is just a direct ID-description, a more complex mapping might be needed.
        // For now, I'll assume a direct lookup if UF matches 'id' in regiao.csv, which is unlikely.
        // A better approach would be to have a separate UF-to-Region mapping in a CSV or config.
        // For now, I'll just add the UF as a description if no direct region mapping is found.
        const uf = enriched.municipio.uf;
        // This is a placeholder for a proper UF-to-Region mapping.
        // For a real-world scenario, you'd load a dedicated UF-Region mapping.
        let regionDescription = { id: uf, descricao: uf }; // Default to just UF if no mapping
        if (this.cache.regiao) {
            // Find a region that contains this UF in its description or a dedicated UF field in regiao.csv
            // Since regiao.csv only has id;regiao, we can't directly map UF to it without more info.
            // So, for now, we'll keep the UF. If the user wants specific region mapping, a new CSV for it is needed.
        }
        enriched.municipio.regiao = regionDescription;
    }

    return enriched;
  }
}

// Padrão Singleton para garantir uma única instância
let instance = null;

module.exports = (logger) => {
  if (!instance) {
    instance = new ReferenceService(logger);
  }
  return instance;
};
