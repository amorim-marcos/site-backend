const fs = require('fs')
const { dumpConfig } = require('./src/functions')

function dump(){
    let migrationsPath = process.cwd() + "/migrations/configs"
    let dateObj = new Date();
    let todayDate = dateObj.toISOString().split('T')[0]
    
    let configExportPath = migrationsPath + "/" + todayDate

    if (!fs.existsSync(configExportPath)){
        fs.mkdirSync(configExportPath);
    }

    dumpConfig('permission', 'users-permissions', configExportPath + '/users-permisions.json')
}

dump()
process.exit()