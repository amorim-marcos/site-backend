const fs = require('fs')
const { restoreConfig } = require('./src/functions')

async function restore(){
    let migrationsPath = process.cwd() + "/migrations/configs"
    let configExportPath = migrationsPath

    try{
        await restoreConfig('role', 'users-permissions', configExportPath + '/users-permisions_role.json', ['type'])
        await restoreConfig('permission', 'users-permissions', configExportPath + '/users-permissions_permission.json', ['type', 'controller', 'action', 'role'])     
        await restoreConfig('strapi::permission', null, configExportPath + '/strapi_permission.json', ['action', 'subject', 'role'])
        await restoreConfig('strapi::role', null, configExportPath + '/strapi_role.json', ['name', 'code'])
        // await dumpConfig('i18n_locale', null, configExportPath + '/strapi_role.json')
        process.exit()
    }catch(e){
        console.log(e)
        process.exit(1)
    }
}

restore()
