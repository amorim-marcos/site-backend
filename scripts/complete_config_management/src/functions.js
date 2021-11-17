const { resolveObjectURL } = require('buffer');
const fs = require('fs')
const strapi = require('strapi')

CHUNK_SIZE = 100

function dataToJson(modelName, pluginName){
    return new Promise(async (resolve, reject) => {
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
        const exportedData = await dataToJson(modelName, pluginName)
        await saveAsFile(exportedData, filePath)
        resolve(true)
    })
}

module.exports = {
    dataToJson,
    saveAsFile,
    dumpConfig
}