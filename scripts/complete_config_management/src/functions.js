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

async function saveAsFile(exportedData, filePath){
    const output = fs.createWriteStream(filePath)
    output.write(JSON.stringify(exportedData))
    output.write('\n')
    output.end()
    return true
}

async function dumpConfig(modelName, pluginName, filePath){
    const exportedData = await dataToJson(modelName, pluginName)
    saveAsFile(exportedData, filePath)
}

module.exports = {
    dataToJson,
    saveAsFile,
    dumpConfig
}