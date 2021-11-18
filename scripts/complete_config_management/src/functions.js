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


function restoreConfig(modelName, pluginName, filePath){
    const input = fs.readFileSync(filePath)

    const app = await strapi().load()

    dataToImport = JSON.parse(input)

    const importer = createMergeImporter(app.db, modelName, pluginName);

    for (const config of dataToImport) {
      await importer.import(config);
    }
}

const createMergeImporter = (db, modelName, pluginName) => {
    const stats = {
        created: 0,
        merged: 0,
    };

    return {
        printStatistics() {
            return `${stats.created} created, ${stats.merged} merged`;
        },

        async import(conf) {
            const model = (pluginName) ? await db.query(modelName, pluginName).model : await db.query(modelName)

            const existingConf = model.find({ key: conf.key });

            if (existingConf) {
                stats.merged += 1;
                await model.update({ key: conf.key }, _.merge(existingConf, conf));
            } else {
                stats.created += 1;
                await model.create(conf);
            }
        },
    };
};

module.exports = {
    dumpConfig,
    restoreConfig
}