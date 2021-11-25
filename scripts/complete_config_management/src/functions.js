const fs = require('fs')
const strapi = require('strapi')
const _ = require('lodash');

CHUNK_SIZE = 100

function dataToJson(modelName, pluginName){
    return new Promise(async (resolve, reject) => {
        try{
            const app = await strapi().load();

            const count = (pluginName) ? await app.query(modelName, pluginName).count() : await app.query(modelName).count()
          
            const exportedData = []
          
            const pageCount = Math.ceil(count / CHUNK_SIZE)
          
            for (let page = 0; page < pageCount; page++) {
                var results 
                
                results = (pluginName) 
                    ? await app.query(modelName, pluginName).find({ _limit: CHUNK_SIZE, _start: page * CHUNK_SIZE})
                    : await app.query(modelName).find({ _limit: CHUNK_SIZE, _start: page * CHUNK_SIZE})
        
                // console.log(results)
          
                results.forEach(result => {
                    exportedData.push(result)
                })
            }
        
            resolve(exportedData)
        }catch(e){
            reject(e)
        }

    })

}

function saveAsFile(exportedData, filePath){
    return new Promise(async (resolve, reject) => {
        fs.writeFile(filePath, JSON.stringify(exportedData), 'utf8', () => {
            resolve(true)
        })
    })
}

function dumpConfig(modelName, pluginName, filePath){
    return new Promise(async (resolve, reject) => {
        try{
            const exportedData = await dataToJson(modelName, pluginName)
            await saveAsFile(exportedData, filePath)
            resolve(true)
        }catch(e){
            reject(e)
        }    
    })
}


function restoreConfig(app, modelName, pluginName, filePath){
    return new Promise(async (resolve, reject) => {
        try{
            const input = fs.readFileSync(filePath)
            
            dataToImport = JSON.parse(input)
        
            await cleanModelTable(app, modelName, pluginName)

            const importer = createImporter(app, modelName, pluginName);
        
            for (const config of dataToImport) {
              await importer.import(config)
            }

            resolve(importer.printStatistics())
        }catch(e){
            reject(e)
        }
    })

}

const cleanModelTable = (app, modelName, pluginName) => {
    return new Promise(async (resolve, reject) => {
        const model = (pluginName) ? await app.db.query(modelName, pluginName) : await app.db.query(modelName)
        try{
            resolve(app.connections.default.truncate(model.model.__schema__.collectionName))
        }catch(e){
            reject(e)
        }
    })
}

const createImporter = (app, modelName, pluginName) => {
    const stats = {
        created: 0,
        merged: 0,
    };

    return {
        printStatistics() {
            return `${stats.created} created, ${stats.merged} merged`;
        },

        formatFields(fields){
            let fieldsString = ``

            for(let field of fields){
                let fieldName = (typeof field === 'string') ? field : field[0]
                fieldsString = (fieldsString === ``) ? `${fieldName}` : fieldsString + `, ${fieldName}`
                 
            }

            return fieldsString
        },

        formatValues(totalVariables){
            let variables = `?` // at least there is one primary key.

            for(i=1; i<totalVariables; i++){
                variables = variables + `, ?`
            }

            return variables
        },

        preapareParameters(fields, conf){
            let parameters = []
            for(let field of fields){
                let fieldName
                let fieldDef
                let parameter

                if(typeof field !== 'string'){
                    fieldName = field[0]
                    fieldDef = field[1]

                    if(fieldDef.type == 'json'){
                        parameter = JSON.stringify(conf[fieldName])    
                    }else{
                        parameter = (conf[fieldName] && conf[fieldName].id != undefined) ? conf[fieldName].id : conf[fieldName]
                    }                   
                }else{
                    fieldName = field
                    parameter = conf[fieldName]
                }
                parameters.push(parameter) 
            }
            return parameters
        },

        async import(conf) {
            const model = (pluginName) ? await app.db.query(modelName, pluginName) : await app.db.query(modelName)
            const conn = app.connections.default

            const collectionName = model.model.__schema__.collectionName
            const primaryKey = model.model.primaryKey

            const otherFields = Object.entries(model.model.__schema__.attributes).filter((attribute) => attribute[1].type != undefined)

            const fields = otherFields
            fields.push(primaryKey)

            const formattedFields = this.formatFields(otherFields)
            const formattedVariablesParameters = this.formatValues(otherFields.length)
            const query = `
                INSERT INTO \`${collectionName}\` (${formattedFields})
                VALUES (${formattedVariablesParameters})
            `

            const preparedParameterValues = this.preapareParameters(fields, conf)

            await conn.raw(query, preparedParameterValues)
        },
    };
}

function buildMergeKeyObject(keyComposition, conf){
    let obj = {}

    for(const key of keyComposition){
        if(conf[key] && conf[key].id){ // if is object that contains id, it means a relationship connected by id.
            obj[key] = conf[key].id
        }else{
            obj[key] = conf[key]
        }
        
    }

    return obj
}

module.exports = {
    dumpConfig,
    restoreConfig
}