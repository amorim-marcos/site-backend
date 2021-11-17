const fs = require('fs')
const { dumpConfig } = require('./src/functions')

async function dump(){
    let migrationsPath = process.cwd() + "/migrations/configs"
    let dateObj = new Date();
    let todayDate = dateObj.toISOString().split('T')[0]
    
    let configExportPath = migrationsPath + "/" + todayDate

    if (!fs.existsSync(configExportPath)){
        fs.mkdirSync(configExportPath);
    }

    try{
        await dumpConfig('permission', 'users-permissions', configExportPath + '/users-permissions_permission.json')
        await dumpConfig('role', 'users-permissions', configExportPath + '/users-permisions_role.json')
        await dumpConfig('strapi::permission', null, configExportPath + '/strapi_permission.json')
        await dumpConfig('strapi::role', null, configExportPath + '/strapi_role.json')
        // await dumpConfig('i18n_locale', null, configExportPath + '/strapi_role.json')
        process.exit()
    }catch(e){
        console.log(e)
        process.exit(1)
    }
}

dump()
