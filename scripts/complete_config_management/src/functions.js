const fs = require('fs')
const strapi = require('strapi')

CHUNK_SIZE = 100

function dataToJson(modelName, pluginName){
    const app = await strapi().load();

    const count = (pluginName) ? await app.query(modelName, pluginName).count() : await app.query(modelName).count()
  
    const exportedData = []
  
    const pageCount = Math.ceil(count / CHUNK_SIZE)
  
    for (let page = 0; page < pageCount; page++) {
        const results 
        
        results = (pluginName) 
            ? await app.query(modelName, pluginName).find({ _limit: CHUNK_SIZE, _start: page * CHUNK_SIZE})
            : await app.query(modelName).find({ _limit: CHUNK_SIZE, _start: page * CHUNK_SIZE})
        
  
        results.forEach(result => {
            exportedData.push(result)
        })
    }

    return exportedData
}

function saveAsFile(exportedData, filePath){
    const output = filePath ? fs.createWriteStream(filePath) : process.stdout
    output.write(JSON.stringify(exportedData))
    output.write('\n')
    output.end()
}


export default {
    dataToJson,
    saveAsFile
}